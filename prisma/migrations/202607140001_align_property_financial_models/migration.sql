-- Add the new domain enums.
CREATE TYPE "FinancingSystem" AS ENUM ('SAC', 'PRICE', 'SACRE', 'OTHER');
CREATE TYPE "PaymentType" AS ENUM ('SIGNAL', 'DOWN_PAYMENT', 'MONTHLY_INSTALLMENT', 'INTERMEDIATE_INSTALLMENT', 'ANNUAL_INSTALLMENT', 'KEYS', 'CONSTRUCTION_FEE', 'OTHER');
CREATE TYPE "ExpenseCategory" AS ENUM ('DOCUMENTATION', 'ITBI', 'REGISTRATION', 'NOTARY', 'MOVING', 'RENOVATION', 'FURNITURE', 'APPLIANCES', 'CONDOMINIUM', 'IPTU', 'OTHER');
CREATE TYPE "AdjustmentIndexType" AS ENUM ('INCC', 'IPCA', 'IGPM', 'TR', 'OTHER');

-- Replace ConstructionStage while mapping removed values.
CREATE TYPE "ConstructionStage_new" AS ENUM ('PLANNING', 'FOUNDATION', 'STRUCTURE', 'MASONRY', 'FINISHING', 'INSPECTION', 'DELIVERED');
ALTER TABLE "properties"
  ALTER COLUMN "current_stage" TYPE "ConstructionStage_new"
  USING (
    CASE "current_stage"::text
      WHEN 'INSTALLATIONS' THEN 'FINISHING'
      WHEN 'COMPLETED' THEN 'DELIVERED'
      ELSE "current_stage"::text
    END
  )::"ConstructionStage_new";
ALTER TABLE "construction_progress"
  ALTER COLUMN "stage" TYPE "ConstructionStage_new"
  USING (
    CASE "stage"::text
      WHEN 'INSTALLATIONS' THEN 'FINISHING'
      WHEN 'COMPLETED' THEN 'DELIVERED'
      ELSE "stage"::text
    END
  )::"ConstructionStage_new";
DROP TYPE "ConstructionStage";
ALTER TYPE "ConstructionStage_new" RENAME TO "ConstructionStage";

-- Replace PaymentStatus and normalize the previous spelling.
ALTER TABLE "payments" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "construction_fees" ALTER COLUMN "status" DROP DEFAULT;
CREATE TYPE "PaymentStatus_new" AS ENUM ('PENDING', 'PAID', 'OVERDUE', 'CANCELED');
ALTER TABLE "payments"
  ALTER COLUMN "status" TYPE "PaymentStatus_new"
  USING (
    CASE "status"::text
      WHEN 'CANCELLED' THEN 'CANCELED'
      ELSE "status"::text
    END
  )::"PaymentStatus_new";
ALTER TABLE "construction_fees"
  ALTER COLUMN "status" TYPE "PaymentStatus_new"
  USING (
    CASE "status"::text
      WHEN 'CANCELLED' THEN 'CANCELED'
      ELSE "status"::text
    END
  )::"PaymentStatus_new";
DROP TYPE "PaymentStatus";
ALTER TYPE "PaymentStatus_new" RENAME TO "PaymentStatus";
ALTER TABLE "payments" ALTER COLUMN "status" SET DEFAULT 'PENDING';
ALTER TABLE "construction_fees" ALTER COLUMN "status" SET DEFAULT 'PENDING';

-- Financing: retain compatible values before removing legacy columns.
ALTER TABLE "financings"
  ADD COLUMN "installment_count" INTEGER,
  ADD COLUMN "interest_rate_month" DECIMAL(5,2),
  ADD COLUMN "interest_rate_year" DECIMAL(5,2),
  ADD COLUMN "system" "FinancingSystem";
UPDATE "financings"
SET "installment_count" = "term_months",
    "interest_rate_year" = ROUND("annual_interest_rate", 2);
ALTER TABLE "financings"
  DROP COLUMN "annual_interest_rate",
  DROP COLUMN "first_payment_date",
  DROP COLUMN "outstanding_balance",
  DROP COLUMN "term_months",
  ALTER COLUMN "bank_name" DROP NOT NULL,
  ALTER COLUMN "financed_amount" DROP NOT NULL,
  ALTER COLUMN "financed_amount" SET DATA TYPE DECIMAL(12,2);

-- Payments: carry the previous amount and payment date into the new fields.
ALTER TABLE "payments"
  ADD COLUMN "expected_amount" DECIMAL(12,2),
  ADD COLUMN "notes" TEXT,
  ADD COLUMN "paid_amount" DECIMAL(12,2),
  ADD COLUMN "paid_date" TIMESTAMP(3),
  ADD COLUMN "type" "PaymentType";
UPDATE "payments"
SET "expected_amount" = "amount",
    "paid_amount" = CASE WHEN "paid_at" IS NOT NULL OR "status" = 'PAID' THEN "amount" ELSE NULL END,
    "paid_date" = "paid_at",
    "type" = 'OTHER';
ALTER TABLE "payments"
  ALTER COLUMN "expected_amount" SET NOT NULL,
  ALTER COLUMN "type" SET NOT NULL,
  ALTER COLUMN "due_date" SET DATA TYPE TIMESTAMP(3),
  DROP COLUMN "amount",
  DROP COLUMN "paid_at";

-- Expenses represented incurred costs, so existing rows become paid expenses.
DROP INDEX "expenses_property_id_expense_date_idx";
ALTER TABLE "expenses"
  ADD COLUMN "category_new" "ExpenseCategory",
  ADD COLUMN "due_date" TIMESTAMP(3),
  ADD COLUMN "expected_amount" DECIMAL(12,2),
  ADD COLUMN "notes" TEXT,
  ADD COLUMN "paid_amount" DECIMAL(12,2),
  ADD COLUMN "paid_date" TIMESTAMP(3),
  ADD COLUMN "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING';
UPDATE "expenses"
SET "category_new" = CASE UPPER("category")
      WHEN 'DOCUMENTATION' THEN 'DOCUMENTATION'::"ExpenseCategory"
      WHEN 'ITBI' THEN 'ITBI'::"ExpenseCategory"
      WHEN 'REGISTRATION' THEN 'REGISTRATION'::"ExpenseCategory"
      WHEN 'NOTARY' THEN 'NOTARY'::"ExpenseCategory"
      WHEN 'MOVING' THEN 'MOVING'::"ExpenseCategory"
      WHEN 'RENOVATION' THEN 'RENOVATION'::"ExpenseCategory"
      WHEN 'FURNITURE' THEN 'FURNITURE'::"ExpenseCategory"
      WHEN 'APPLIANCES' THEN 'APPLIANCES'::"ExpenseCategory"
      WHEN 'CONDOMINIUM' THEN 'CONDOMINIUM'::"ExpenseCategory"
      WHEN 'IPTU' THEN 'IPTU'::"ExpenseCategory"
      ELSE 'OTHER'::"ExpenseCategory"
    END,
    "due_date" = "expense_date"::timestamp,
    "expected_amount" = "amount",
    "paid_amount" = "amount",
    "paid_date" = "expense_date"::timestamp,
    "status" = 'PAID';
ALTER TABLE "expenses"
  ALTER COLUMN "category_new" SET NOT NULL,
  ALTER COLUMN "expected_amount" SET NOT NULL,
  DROP COLUMN "amount",
  DROP COLUMN "expense_date",
  DROP COLUMN "category";
ALTER TABLE "expenses" RENAME COLUMN "category_new" TO "category";
CREATE INDEX "expenses_property_id_due_date_idx" ON "expenses"("property_id", "due_date");

-- Construction progress: keep its reference date and use actual progress as the initial schedule baseline.
DROP INDEX "construction_progress_property_id_reference_date_idx";
ALTER TABLE "construction_progress"
  ADD COLUMN "reference_month" TIMESTAMP(3),
  ADD COLUMN "scheduled_percent" DECIMAL(5,2);
UPDATE "construction_progress"
SET "reference_month" = "reference_date"::timestamp,
    "scheduled_percent" = "progress_percent";
ALTER TABLE "construction_progress"
  ALTER COLUMN "reference_month" SET NOT NULL,
  ALTER COLUMN "scheduled_percent" SET NOT NULL,
  ALTER COLUMN "stage" DROP NOT NULL,
  DROP COLUMN "reference_date",
  DROP COLUMN "updated_at";
CREATE INDEX "construction_progress_property_id_reference_month_idx" ON "construction_progress"("property_id", "reference_month");

-- Construction fees: preserve the previous paid date.
ALTER TABLE "construction_fees"
  ADD COLUMN "notes" TEXT,
  ADD COLUMN "paid_date" TIMESTAMP(3),
  ADD COLUMN "percentage_released" DECIMAL(5,2);
UPDATE "construction_fees" SET "paid_date" = "paid_at"::timestamp;
ALTER TABLE "construction_fees"
  ALTER COLUMN "reference_month" SET DATA TYPE TIMESTAMP(3),
  ALTER COLUMN "amount" SET DATA TYPE DECIMAL(12,2),
  DROP COLUMN "due_date",
  DROP COLUMN "paid_at";

-- Adjustment indexes: retain the previous enum values and percentage.
ALTER TABLE "adjustment_indexes"
  ADD COLUMN "amount_impact" DECIMAL(12,2),
  ADD COLUMN "type_new" "AdjustmentIndexType";
UPDATE "adjustment_indexes"
SET "type_new" = "type"::text::"AdjustmentIndexType";
ALTER TABLE "adjustment_indexes"
  ALTER COLUMN "type_new" SET NOT NULL,
  ALTER COLUMN "reference_month" SET DATA TYPE TIMESTAMP(3),
  ALTER COLUMN "percentage" SET DATA TYPE DECIMAL(6,4),
  DROP COLUMN "custom_name",
  DROP COLUMN "updated_at",
  DROP COLUMN "type";
ALTER TABLE "adjustment_indexes" RENAME COLUMN "type_new" TO "type";
DROP TYPE "IndexType";
CREATE UNIQUE INDEX "adjustment_indexes_property_id_type_reference_month_key"
  ON "adjustment_indexes"("property_id", "type", "reference_month");

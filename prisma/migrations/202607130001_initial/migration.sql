-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "ConstructionStage" AS ENUM ('FOUNDATION', 'STRUCTURE', 'MASONRY', 'INSTALLATIONS', 'FINISHING', 'INSPECTION', 'COMPLETED');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'PAID', 'OVERDUE', 'CANCELLED');

-- CreateEnum
CREATE TYPE "IndexType" AS ENUM ('INCC', 'IPCA', 'IGPM', 'OTHER');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "google_auth_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "revoked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "properties" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "builder_name" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "state" VARCHAR(2) NOT NULL,
    "street" TEXT NOT NULL,
    "purchase_date" DATE NOT NULL,
    "builder_signed_date" DATE,
    "bank_signed_date" DATE,
    "expected_key_date" DATE,
    "assessed_value" DECIMAL(14,2) NOT NULL,
    "purchase_value" DECIMAL(14,2) NOT NULL,
    "current_stage" "ConstructionStage",
    "progress_percent" DECIMAL(5,2),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "properties_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "financings" (
    "id" UUID NOT NULL,
    "property_id" UUID NOT NULL,
    "bank_name" TEXT NOT NULL,
    "financed_amount" DECIMAL(14,2) NOT NULL,
    "outstanding_balance" DECIMAL(14,2),
    "annual_interest_rate" DECIMAL(8,4) NOT NULL,
    "term_months" INTEGER NOT NULL,
    "first_payment_date" DATE NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "financings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" UUID NOT NULL,
    "property_id" UUID NOT NULL,
    "description" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "due_date" DATE NOT NULL,
    "paid_at" DATE,
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "expenses" (
    "id" UUID NOT NULL,
    "property_id" UUID NOT NULL,
    "description" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "expense_date" DATE NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "expenses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "construction_progress" (
    "id" UUID NOT NULL,
    "property_id" UUID NOT NULL,
    "reference_date" DATE NOT NULL,
    "stage" "ConstructionStage" NOT NULL,
    "progress_percent" DECIMAL(5,2) NOT NULL,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "construction_progress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "construction_fees" (
    "id" UUID NOT NULL,
    "property_id" UUID NOT NULL,
    "reference_month" DATE NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "due_date" DATE NOT NULL,
    "paid_at" DATE,
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "construction_fees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "adjustment_indexes" (
    "id" UUID NOT NULL,
    "property_id" UUID NOT NULL,
    "type" "IndexType" NOT NULL,
    "custom_name" TEXT,
    "reference_month" DATE NOT NULL,
    "percentage" DECIMAL(10,6) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "adjustment_indexes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_google_auth_id_key" ON "users"("google_auth_id");

-- CreateIndex
CREATE INDEX "refresh_tokens_user_id_idx" ON "refresh_tokens"("user_id");

-- CreateIndex
CREATE INDEX "refresh_tokens_expires_at_idx" ON "refresh_tokens"("expires_at");

-- CreateIndex
CREATE INDEX "properties_user_id_idx" ON "properties"("user_id");

-- CreateIndex
CREATE INDEX "properties_user_id_builder_name_idx" ON "properties"("user_id", "builder_name");

-- CreateIndex
CREATE INDEX "properties_user_id_city_idx" ON "properties"("user_id", "city");

-- CreateIndex
CREATE INDEX "properties_user_id_state_idx" ON "properties"("user_id", "state");

-- CreateIndex
CREATE INDEX "properties_user_id_street_idx" ON "properties"("user_id", "street");

-- CreateIndex
CREATE INDEX "properties_user_id_purchase_date_idx" ON "properties"("user_id", "purchase_date");

-- CreateIndex
CREATE INDEX "properties_user_id_created_at_idx" ON "properties"("user_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "financings_property_id_key" ON "financings"("property_id");

-- CreateIndex
CREATE INDEX "payments_property_id_idx" ON "payments"("property_id");

-- CreateIndex
CREATE INDEX "payments_property_id_due_date_idx" ON "payments"("property_id", "due_date");

-- CreateIndex
CREATE INDEX "expenses_property_id_idx" ON "expenses"("property_id");

-- CreateIndex
CREATE INDEX "expenses_property_id_expense_date_idx" ON "expenses"("property_id", "expense_date");

-- CreateIndex
CREATE INDEX "construction_progress_property_id_idx" ON "construction_progress"("property_id");

-- CreateIndex
CREATE INDEX "construction_progress_property_id_reference_date_idx" ON "construction_progress"("property_id", "reference_date");

-- CreateIndex
CREATE INDEX "construction_fees_property_id_idx" ON "construction_fees"("property_id");

-- CreateIndex
CREATE INDEX "construction_fees_property_id_reference_month_idx" ON "construction_fees"("property_id", "reference_month");

-- CreateIndex
CREATE INDEX "adjustment_indexes_property_id_idx" ON "adjustment_indexes"("property_id");

-- CreateIndex
CREATE INDEX "adjustment_indexes_property_id_reference_month_idx" ON "adjustment_indexes"("property_id", "reference_month");

-- CreateIndex
CREATE UNIQUE INDEX "adjustment_indexes_property_id_type_reference_month_key" ON "adjustment_indexes"("property_id", "type", "reference_month");

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "properties" ADD CONSTRAINT "properties_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financings" ADD CONSTRAINT "financings_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "construction_progress" ADD CONSTRAINT "construction_progress_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "construction_fees" ADD CONSTRAINT "construction_fees_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "adjustment_indexes" ADD CONSTRAINT "adjustment_indexes_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

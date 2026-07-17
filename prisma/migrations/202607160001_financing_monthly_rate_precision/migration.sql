-- Preserve the three decimal places used by monthly interest rates.
ALTER TABLE "financings"
  ALTER COLUMN "interest_rate_month" SET DATA TYPE DECIMAL(6,3);

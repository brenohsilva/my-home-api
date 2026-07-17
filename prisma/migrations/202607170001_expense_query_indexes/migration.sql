CREATE INDEX "expenses_property_id_status_due_date_idx"
  ON "expenses"("property_id", "status", "due_date");

CREATE INDEX "expenses_property_id_category_idx"
  ON "expenses"("property_id", "category");

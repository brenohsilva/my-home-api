CREATE INDEX "payments_property_id_status_due_date_idx"
  ON "payments"("property_id", "status", "due_date");

CREATE INDEX "payments_property_id_type_idx"
  ON "payments"("property_id", "type");

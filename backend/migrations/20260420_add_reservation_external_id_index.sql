-- Helps inbound reconciliation and avoids duplicated reservations from the same provider email.

ALTER TABLE reservations
  ADD UNIQUE KEY uq_reservations_property_external_id (property_id, external_id);

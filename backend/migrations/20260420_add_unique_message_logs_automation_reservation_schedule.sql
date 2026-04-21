-- Prevent duplicate automation logs for the same reservation and schedule.
-- Keep the oldest row when duplicates already exist.

DELETE ml
FROM message_logs ml
JOIN message_logs keep_ml
  ON keep_ml.automation_id = ml.automation_id
 AND keep_ml.reservation_id = ml.reservation_id
 AND keep_ml.scheduled_for = ml.scheduled_for
 AND keep_ml.id < ml.id;

ALTER TABLE message_logs
  ADD UNIQUE KEY uq_message_logs_automation_reservation_schedule (
    automation_id,
    reservation_id,
    scheduled_for
  );

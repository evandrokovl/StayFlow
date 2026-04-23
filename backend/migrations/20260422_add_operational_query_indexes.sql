START TRANSACTION;

DROP PROCEDURE IF EXISTS add_index_if_missing;

DELIMITER $$

CREATE PROCEDURE add_index_if_missing(
  IN table_name_value VARCHAR(64),
  IN index_name_value VARCHAR(64),
  IN index_sql_value TEXT
)
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = table_name_value
      AND INDEX_NAME = index_name_value
  ) THEN
    SET @sql = index_sql_value;
    PREPARE stmt FROM @sql;
    EXECUTE stmt;
    DEALLOCATE PREPARE stmt;
  END IF;
END$$

DELIMITER ;

CALL add_index_if_missing(
  'property_listings',
  'idx_property_listings_property_id',
  'ALTER TABLE property_listings ADD INDEX idx_property_listings_property_id (property_id)'
);

CALL add_index_if_missing(
  'financial_entries',
  'idx_financial_entries_user_property_date',
  'ALTER TABLE financial_entries ADD INDEX idx_financial_entries_user_property_date (user_id, property_id, entry_date)'
);

CALL add_index_if_missing(
  'reservations',
  'idx_reservations_property_dates',
  'ALTER TABLE reservations ADD INDEX idx_reservations_property_dates (property_id, start_date, end_date)'
);

CALL add_index_if_missing(
  'message_logs',
  'idx_message_logs_user_status_schedule',
  'ALTER TABLE message_logs ADD INDEX idx_message_logs_user_status_schedule (user_id, status, scheduled_for)'
);

CALL add_index_if_missing(
  'inbound_emails',
  'idx_inbound_emails_user_created',
  'ALTER TABLE inbound_emails ADD INDEX idx_inbound_emails_user_created (user_id, created_at)'
);

DROP PROCEDURE IF EXISTS add_index_if_missing;

COMMIT;

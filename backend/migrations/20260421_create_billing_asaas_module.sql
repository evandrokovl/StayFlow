START TRANSACTION;

ALTER TABLE users
  ADD COLUMN cpf_cnpj VARCHAR(20) NULL AFTER cpf,
  ADD COLUMN phone VARCHAR(30) NULL AFTER cpf_cnpj,
  ADD COLUMN asaas_customer_id VARCHAR(100) NULL AFTER phone,
  ADD COLUMN trial_starts_at DATETIME NULL AFTER asaas_customer_id,
  ADD COLUMN trial_ends_at DATETIME NULL AFTER trial_starts_at,
  ADD COLUMN billing_status ENUM('TRIAL', 'ACTIVE', 'PAST_DUE', 'CANCELED', 'BLOCKED') NOT NULL DEFAULT 'TRIAL' AFTER trial_ends_at,
  ADD COLUMN access_expires_at DATETIME NULL AFTER billing_status,
  ADD COLUMN billing_block_reason VARCHAR(255) NULL AFTER access_expires_at,
  ADD COLUMN current_plan_amount DECIMAL(10,2) NOT NULL DEFAULT 49.90 AFTER billing_block_reason,
  ADD COLUMN additional_properties_count INT UNSIGNED NOT NULL DEFAULT 0 AFTER current_plan_amount,
  ADD COLUMN last_billing_sync_at DATETIME NULL AFTER additional_properties_count,
  ADD UNIQUE KEY uq_users_asaas_customer_id (asaas_customer_id),
  ADD KEY idx_users_billing_status (billing_status),
  ADD KEY idx_users_access_expires_at (access_expires_at);

CREATE TABLE user_billing (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  plan_code VARCHAR(50) NOT NULL DEFAULT 'STAYFLOW_BASE',
  plan_name VARCHAR(100) NOT NULL DEFAULT 'StayFlow Base',
  base_price DECIMAL(10,2) NOT NULL DEFAULT 49.90,
  included_properties INT UNSIGNED NOT NULL DEFAULT 1,
  additional_property_price DECIMAL(10,2) NOT NULL DEFAULT 29.90,
  active_properties_count INT UNSIGNED NOT NULL DEFAULT 0,
  additional_properties_count INT UNSIGNED NOT NULL DEFAULT 0,
  calculated_amount DECIMAL(10,2) NOT NULL DEFAULT 49.90,
  currency CHAR(3) NOT NULL DEFAULT 'BRL',
  trial_days INT UNSIGNED NOT NULL DEFAULT 15,
  trial_started_at DATETIME NULL,
  trial_ends_at DATETIME NULL,
  subscription_status ENUM('TRIAL', 'ACTIVE', 'PAST_DUE', 'CANCELED', 'EXPIRED', 'PENDING') NOT NULL DEFAULT 'TRIAL',
  access_status ENUM('FULL', 'READ_ONLY', 'BLOCKED') NOT NULL DEFAULT 'FULL',
  grace_until DATETIME NULL,
  current_period_start DATETIME NULL,
  current_period_end DATETIME NULL,
  next_billing_date DATETIME NULL,
  last_payment_date DATETIME NULL,
  last_payment_amount DECIMAL(10,2) NULL,
  last_payment_status ENUM('PENDING', 'RECEIVED', 'CONFIRMED', 'OVERDUE', 'REFUNDED', 'RECEIVED_IN_CASH', 'REFUND_REQUESTED', 'REFUND_IN_PROGRESS', 'CHARGEBACK_REQUESTED', 'CHARGEBACK_DISPUTE', 'AWAITING_CHARGEBACK_REVERSAL', 'DUNNING_REQUESTED', 'DUNNING_RECEIVED', 'AWAITING_RISK_ANALYSIS', 'CANCELED') NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_user_billing_user_id (user_id),
  KEY idx_user_billing_subscription_status (subscription_status),
  KEY idx_user_billing_access_status (access_status),
  KEY idx_user_billing_next_billing_date (next_billing_date),
  CONSTRAINT fk_user_billing_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE subscriptions (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  user_billing_id BIGINT UNSIGNED NOT NULL,
  asaas_subscription_id VARCHAR(100) NOT NULL,
  asaas_customer_id VARCHAR(100) NOT NULL,
  billing_type ENUM('PIX', 'BOLETO', 'CREDIT_CARD') NOT NULL,
  cycle ENUM('MONTHLY') NOT NULL DEFAULT 'MONTHLY',
  status ENUM('ACTIVE', 'INACTIVE', 'EXPIRED', 'CANCELED', 'PENDING', 'PAST_DUE') NOT NULL DEFAULT 'PENDING',
  value DECIMAL(10,2) NOT NULL,
  next_due_date DATE NULL,
  remote_next_due_date DATE NULL,
  start_date DATE NULL,
  end_date DATE NULL,
  canceled_at DATETIME NULL,
  last_synced_at DATETIME NULL,
  raw_response_json JSON NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_subscriptions_asaas_subscription_id (asaas_subscription_id),
  KEY idx_subscriptions_user_id (user_id),
  KEY idx_subscriptions_user_billing_id (user_billing_id),
  KEY idx_subscriptions_asaas_customer_id (asaas_customer_id),
  KEY idx_subscriptions_status (status),
  KEY idx_subscriptions_next_due_date (next_due_date),
  CONSTRAINT fk_subscriptions_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_subscriptions_user_billing
    FOREIGN KEY (user_billing_id) REFERENCES user_billing(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE payments (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  subscription_id BIGINT UNSIGNED NULL,
  asaas_payment_id VARCHAR(100) NOT NULL,
  status ENUM('PENDING', 'RECEIVED', 'CONFIRMED', 'OVERDUE', 'REFUNDED', 'RECEIVED_IN_CASH', 'REFUND_REQUESTED', 'REFUND_IN_PROGRESS', 'CHARGEBACK_REQUESTED', 'CHARGEBACK_DISPUTE', 'AWAITING_CHARGEBACK_REVERSAL', 'DUNNING_REQUESTED', 'DUNNING_RECEIVED', 'AWAITING_RISK_ANALYSIS', 'CANCELED') NOT NULL DEFAULT 'PENDING',
  billing_type ENUM('PIX', 'BOLETO', 'CREDIT_CARD') NOT NULL,
  value DECIMAL(10,2) NOT NULL,
  net_value DECIMAL(10,2) NULL,
  due_date DATE NOT NULL,
  original_due_date DATE NULL,
  payment_date DATETIME NULL,
  confirmed_date DATETIME NULL,
  invoice_url TEXT NULL,
  bank_slip_url TEXT NULL,
  pix_qr_code TEXT NULL,
  pix_copy_paste TEXT NULL,
  description VARCHAR(255) NULL,
  raw_payload_json JSON NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_payments_asaas_payment_id (asaas_payment_id),
  KEY idx_payments_user_id (user_id),
  KEY idx_payments_subscription_id (subscription_id),
  KEY idx_payments_status (status),
  KEY idx_payments_due_date (due_date),
  CONSTRAINT fk_payments_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_payments_subscription
    FOREIGN KEY (subscription_id) REFERENCES subscriptions(id)
    ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE billing_events (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  provider ENUM('ASAAS') NOT NULL DEFAULT 'ASAAS',
  event_id VARCHAR(150) NOT NULL,
  event_type VARCHAR(100) NOT NULL,
  processed BOOLEAN NOT NULL DEFAULT FALSE,
  processed_at DATETIME NULL,
  payload_json JSON NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_billing_events_event_id (event_id),
  KEY idx_billing_events_provider (provider),
  KEY idx_billing_events_event_type (event_type),
  KEY idx_billing_events_processed (processed),
  KEY idx_billing_events_processed_at (processed_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

COMMIT;

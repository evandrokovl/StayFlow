-- Adds CPF enforcement for new users and secure password reset tokens.
-- Existing users receive a unique legacy placeholder CPF based on id so the
-- migration can run safely before a manual CPF backfill.

ALTER TABLE users
  ADD COLUMN cpf VARCHAR(11) NULL AFTER email;

UPDATE users
SET cpf = LPAD(CAST(id AS CHAR), 11, '0')
WHERE cpf IS NULL OR cpf = '';

ALTER TABLE users
  MODIFY cpf VARCHAR(11) NOT NULL;

ALTER TABLE users
  ADD UNIQUE KEY uq_users_cpf (cpf);

CREATE TABLE password_reset_tokens (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  token_hash CHAR(64) NOT NULL,
  expires_at DATETIME NOT NULL,
  used_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_password_reset_tokens_hash (token_hash),
  KEY idx_password_reset_tokens_user_active (user_id, used_at, expires_at)
);

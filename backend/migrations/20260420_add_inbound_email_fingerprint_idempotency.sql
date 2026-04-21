-- Strong idempotency for inbound email processing.
-- Apply before deploying code that writes inbound_emails.fingerprint.

ALTER TABLE inbound_emails
  ADD COLUMN fingerprint CHAR(64) NULL AFTER email_id;

UPDATE inbound_emails
SET fingerprint = SHA2(CONCAT_WS('|',
  COALESCE(provider, ''),
  COALESCE(email_id, ''),
  COALESCE(to_email, ''),
  COALESCE(from_email, ''),
  COALESCE(subject, '')
), 256)
WHERE fingerprint IS NULL;

ALTER TABLE inbound_emails
  MODIFY fingerprint CHAR(64) NOT NULL;

ALTER TABLE inbound_emails
  ADD UNIQUE KEY uq_inbound_emails_provider_email_id (provider, email_id),
  ADD UNIQUE KEY uq_inbound_emails_fingerprint (fingerprint);

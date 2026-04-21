require('dotenv').config();

const mysql = require('mysql2/promise');
const { env } = require('../src/config/env');

async function hasColumn(connection, tableName, columnName) {
  const [rows] = await connection.query(
    `
    SELECT COUNT(*) AS total
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = ?
      AND COLUMN_NAME = ?
    `,
    [tableName, columnName]
  );

  return Number(rows[0]?.total || 0) > 0;
}

async function hasIndex(connection, tableName, indexName) {
  const [rows] = await connection.query(
    `
    SELECT COUNT(*) AS total
    FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = ?
      AND INDEX_NAME = ?
    `,
    [tableName, indexName]
  );

  return Number(rows[0]?.total || 0) > 0;
}

async function runStep(label, callback) {
  process.stdout.write(`${label}... `);
  await callback();
  console.log('ok');
}

async function addInboundFingerprint(connection) {
  if (!(await hasColumn(connection, 'inbound_emails', 'fingerprint'))) {
    await connection.query(`
      ALTER TABLE inbound_emails
        ADD COLUMN fingerprint CHAR(64) NULL AFTER email_id
    `);
  }

  await connection.query(`
    UPDATE inbound_emails
    SET fingerprint = SHA2(CONCAT_WS('|',
      COALESCE(provider, ''),
      COALESCE(email_id, ''),
      COALESCE(to_email, ''),
      COALESCE(from_email, ''),
      COALESCE(subject, '')
    ), 256)
    WHERE fingerprint IS NULL
  `);

  await connection.query(`
    UPDATE inbound_emails ie
    JOIN (
      SELECT fingerprint, MIN(id) AS keep_id
      FROM inbound_emails
      WHERE fingerprint IS NOT NULL
      GROUP BY fingerprint
      HAVING COUNT(*) > 1
    ) duplicated ON duplicated.fingerprint = ie.fingerprint
    SET ie.fingerprint = SHA2(CONCAT(ie.fingerprint, '|legacy_duplicate|', ie.id), 256)
    WHERE ie.id <> duplicated.keep_id
  `);

  await connection.query(`
    UPDATE inbound_emails ie
    JOIN (
      SELECT provider, email_id, MIN(id) AS keep_id
      FROM inbound_emails
      WHERE email_id IS NOT NULL
      GROUP BY provider, email_id
      HAVING COUNT(*) > 1
    ) duplicated
      ON duplicated.provider = ie.provider
     AND duplicated.email_id = ie.email_id
    SET ie.email_id = CONCAT(ie.email_id, '#legacy_duplicate#', ie.id)
    WHERE ie.id <> duplicated.keep_id
  `);

  await connection.query(`
    ALTER TABLE inbound_emails
      MODIFY fingerprint CHAR(64) NOT NULL
  `);

  if (!(await hasIndex(connection, 'inbound_emails', 'uq_inbound_emails_provider_email_id'))) {
    await connection.query(`
      ALTER TABLE inbound_emails
        ADD UNIQUE KEY uq_inbound_emails_provider_email_id (provider, email_id)
    `);
  }

  if (!(await hasIndex(connection, 'inbound_emails', 'uq_inbound_emails_fingerprint'))) {
    await connection.query(`
      ALTER TABLE inbound_emails
        ADD UNIQUE KEY uq_inbound_emails_fingerprint (fingerprint)
    `);
  }
}

async function addReservationExternalIdIndex(connection) {
  await connection.query(`
    UPDATE reservations r
    JOIN (
      SELECT property_id, external_id, MIN(id) AS keep_id
      FROM reservations
      WHERE external_id IS NOT NULL
      GROUP BY property_id, external_id
      HAVING COUNT(*) > 1
    ) duplicated
      ON duplicated.property_id = r.property_id
     AND duplicated.external_id = r.external_id
    SET r.external_id = CONCAT(r.external_id, '#legacy_duplicate#', r.id)
    WHERE r.id <> duplicated.keep_id
  `);

  if (!(await hasIndex(connection, 'reservations', 'uq_reservations_property_external_id'))) {
    await connection.query(`
      ALTER TABLE reservations
        ADD UNIQUE KEY uq_reservations_property_external_id (property_id, external_id)
    `);
  }
}

async function addMessageLogAutomationIndex(connection) {
  await connection.query(`
    DELETE ml
    FROM message_logs ml
    JOIN message_logs keep_ml
      ON keep_ml.automation_id = ml.automation_id
     AND keep_ml.reservation_id = ml.reservation_id
     AND keep_ml.scheduled_for = ml.scheduled_for
     AND keep_ml.id < ml.id
  `);

  if (!(await hasIndex(connection, 'message_logs', 'uq_message_logs_automation_reservation_schedule'))) {
    await connection.query(`
      ALTER TABLE message_logs
        ADD UNIQUE KEY uq_message_logs_automation_reservation_schedule (
          automation_id,
          reservation_id,
          scheduled_for
        )
    `);
  }
}

async function main() {
  const connection = await mysql.createConnection({
    host: env.DB_HOST,
    port: env.DB_PORT,
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    database: env.DB_NAME
  });

  try {
    await runStep('Applying inbound fingerprint idempotency', () => addInboundFingerprint(connection));
    await runStep('Applying reservation external_id index', () => addReservationExternalIdIndex(connection));
    await runStep('Applying message log automation index', () => addMessageLogAutomationIndex(connection));
  } finally {
    await connection.end();
  }
}

main().catch((error) => {
  console.error('Migration failed:', error.code || error.name, error.message);
  process.exit(1);
});

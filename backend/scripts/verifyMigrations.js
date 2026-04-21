require('dotenv').config();

const mysql = require('mysql2/promise');
const { env } = require('../src/config/env');

async function main() {
  const connection = await mysql.createConnection({
    host: env.DB_HOST,
    port: env.DB_PORT,
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    database: env.DB_NAME
  });

  try {
    const [fingerprintColumn] = await connection.query(
      `
      SELECT COLUMN_NAME, IS_NULLABLE, COLUMN_TYPE
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = ?
        AND TABLE_NAME = 'inbound_emails'
        AND COLUMN_NAME = 'fingerprint'
      `,
      [env.DB_NAME]
    );

    const [indexes] = await connection.query(
      `
      SELECT
        TABLE_NAME,
        INDEX_NAME,
        GROUP_CONCAT(COLUMN_NAME ORDER BY SEQ_IN_INDEX) AS columns_list
      FROM information_schema.STATISTICS
      WHERE TABLE_SCHEMA = ?
        AND INDEX_NAME IN (
          'uq_inbound_emails_provider_email_id',
          'uq_inbound_emails_fingerprint',
          'uq_reservations_property_external_id',
          'uq_message_logs_automation_reservation_schedule'
        )
      GROUP BY TABLE_NAME, INDEX_NAME
      ORDER BY TABLE_NAME, INDEX_NAME
      `,
      [env.DB_NAME]
    );

    console.log(JSON.stringify({
      fingerprintColumn,
      indexes
    }, null, 2));
  } finally {
    await connection.end();
  }
}

main().catch((error) => {
  console.error('Verification failed:', error.code || error.name, error.message);
  process.exit(1);
});

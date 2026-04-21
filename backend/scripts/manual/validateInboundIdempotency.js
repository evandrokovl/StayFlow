require('dotenv').config();

const bcrypt = require('bcryptjs');
const { QueueEvents } = require('bullmq');

const pool = require('../../src/config/database');
const { getRedisConnection } = require('../../src/config/redis');
const { jobQueue, queueName } = require('../../src/queues/jobQueue');
const { startQueueWorker } = require('../../src/workers/queueWorker');

const runId = `idem_${new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14)}`;
const inboundAlias = `u888${Date.now()}@inbound.test`;
const listingCode = `idem${Date.now()}`;
const guestEmail = `${runId}@guest.test`;

function buildWebhook() {
  return {
    type: 'email.received',
    data: {
      to: inboundAlias,
      from: 'automated@airbnb.com',
      subject: `[${runId}] Reservation confirmed for Beatriz Costa`,
      text: `
        ---------- Forwarded message ---------
        From: Airbnb <automated@airbnb.com>
        Subject: Reservation confirmed

        Guest: Beatriz Costa
        Email: ${guestEmail}
        Phone: +55 21 98888-7777
        Check-in: 15 de junho de 2026
        Check-out: 18 de junho de 2026
        Total payout: R$ 2.100,00
        Stay: Apartamento Idempotência ${runId}
        https://www.airbnb.com/rooms/${listingCode}
      `
    }
  };
}

async function seedData(connection) {
  const password = await bcrypt.hash('manual-validation-password', 10);

  const [userInsert] = await connection.query(
    `
    INSERT INTO users (name, email, password, inbound_alias)
    VALUES (?, ?, ?, ?)
    `,
    [
      `Idempotency Validation ${runId}`,
      `${runId}@stayflow.test`,
      password,
      inboundAlias
    ]
  );

  const userId = userInsert.insertId;

  const [propertyInsert] = await connection.query(
    `
    INSERT INTO properties (
      user_id,
      name,
      description,
      address,
      city,
      state,
      country,
      airbnb_ical_url,
      booking_ical_url,
      internal_ical_token
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      userId,
      `Apartamento Idempotência ${runId}`,
      'Imóvel criado para validação manual de idempotência',
      'Avenida Atlântica 500',
      'Rio de Janeiro',
      'RJ',
      'Brasil',
      '',
      '',
      `ical_${runId}`
    ]
  );

  const propertyId = propertyInsert.insertId;

  await connection.query(
    `
    INSERT INTO property_listings (
      property_id,
      platform,
      listing_url,
      listing_code,
      is_active
    ) VALUES (?, 'airbnb', ?, ?, 1)
    `,
    [
      propertyId,
      `https://www.airbnb.com/rooms/${listingCode}`,
      listingCode
    ]
  );

  const [templateInsert] = await connection.query(
    `
    INSERT INTO message_templates (user_id, name, channel, subject, body)
    VALUES (?, ?, 'email', ?, ?)
    `,
    [
      userId,
      `Template Idempotência ${runId}`,
      'Confirmação {guest_name}',
      'Olá {guest_name}, reserva em {property_name}: {start_date} a {end_date}.'
    ]
  );

  const [automationInsert] = await connection.query(
    `
    INSERT INTO message_automations (
      user_id,
      property_id,
      template_id,
      name,
      trigger_type,
      trigger_offset_value,
      trigger_offset_unit,
      is_active
    ) VALUES (?, ?, ?, ?, 'reservation_created', 0, 'days', 1)
    `,
    [
      userId,
      propertyId,
      templateInsert.insertId,
      `Automação Idempotência ${runId}`
    ]
  );

  return {
    userId,
    propertyId,
    automationId: automationInsert.insertId
  };
}

async function waitForJob(job, queueEvents) {
  return job.waitUntilFinished(queueEvents, 30000);
}

async function enqueueAndWait(name, data, jobId, queueEvents) {
  const job = await jobQueue.add(name, data, { jobId });
  const result = await waitForJob(job, queueEvents);
  console.log(JSON.stringify({ jobName: name, jobId: job.id, result }, null, 2));
  return result;
}

async function snapshot(connection, ids, label) {
  const [[inboundCount]] = await connection.query(
    'SELECT COUNT(*) AS total FROM inbound_emails WHERE user_id = ?',
    [ids.userId]
  );

  const [[reservationCount]] = await connection.query(
    'SELECT COUNT(*) AS total FROM reservations WHERE property_id = ?',
    [ids.propertyId]
  );

  const [[financialCount]] = await connection.query(
    'SELECT COUNT(*) AS total FROM financial_entries WHERE property_id = ?',
    [ids.propertyId]
  );

  const [[messageLogCount]] = await connection.query(
    'SELECT COUNT(*) AS total FROM message_logs WHERE automation_id = ?',
    [ids.automationId]
  );

  const [inboundRows] = await connection.query(
    `
    SELECT id, email_id, fingerprint, parsing_status, created_reservation_id
    FROM inbound_emails
    WHERE user_id = ?
    ORDER BY id ASC
    `,
    [ids.userId]
  );

  const [reservationRows] = await connection.query(
    `
    SELECT id, guest_name, start_date, end_date, status, external_id, total_amount
    FROM reservations
    WHERE property_id = ?
    ORDER BY id ASC
    `,
    [ids.propertyId]
  );

  const [financialRows] = await connection.query(
    `
    SELECT id, reservation_id, amount, status, source
    FROM financial_entries
    WHERE property_id = ?
    ORDER BY id ASC
    `,
    [ids.propertyId]
  );

  const [messageLogRows] = await connection.query(
    `
    SELECT id, reservation_id, guest_contact, subject, status
    FROM message_logs
    WHERE automation_id = ?
    ORDER BY id ASC
    `,
    [ids.automationId]
  );

  const data = {
    label,
    counts: {
      inbound_emails: Number(inboundCount.total),
      reservations: Number(reservationCount.total),
      financial_entries: Number(financialCount.total),
      message_logs: Number(messageLogCount.total)
    },
    inbound_emails: inboundRows,
    reservations: reservationRows,
    financial_entries: financialRows,
    message_logs: messageLogRows
  };

  console.log(JSON.stringify(data, null, 2));
  return data;
}

async function main() {
  const connection = await pool.getConnection();
  const redisConnection = getRedisConnection();
  const queueEvents = new QueueEvents(queueName, {
    connection: redisConnection.duplicate()
  });
  const worker = startQueueWorker();

  try {
    await queueEvents.waitUntilReady();

    const ids = await seedData(connection);
    const webhook = buildWebhook();

    console.log(JSON.stringify({
      runId,
      queueName,
      inboundAlias,
      listingCode,
      ...ids
    }, null, 2));

    await enqueueAndWait(
      'inbound_resend',
      { payload: webhook },
      `${runId}_same_webhook_first`,
      queueEvents
    );

    await enqueueAndWait(
      'process_message_automations',
      { userId: ids.userId },
      `${runId}_automation_first`,
      queueEvents
    );

    const afterFirst = await snapshot(connection, ids, 'after_first_webhook');

    await enqueueAndWait(
      'inbound_resend',
      { payload: webhook },
      `${runId}_same_webhook_second`,
      queueEvents
    );

    await enqueueAndWait(
      'process_message_automations',
      { userId: ids.userId },
      `${runId}_automation_second`,
      queueEvents
    );

    const afterSecond = await snapshot(connection, ids, 'after_second_same_webhook');

    console.log(JSON.stringify({
      validation: 'idempotency_result',
      runId,
      passed:
        afterFirst.counts.inbound_emails === 1 &&
        afterSecond.counts.inbound_emails === 1 &&
        afterFirst.counts.reservations === 1 &&
        afterSecond.counts.reservations === 1 &&
        afterFirst.counts.financial_entries === 1 &&
        afterSecond.counts.financial_entries === 1 &&
        afterFirst.counts.message_logs === 1 &&
        afterSecond.counts.message_logs === 1,
      before: afterFirst.counts,
      after: afterSecond.counts
    }, null, 2));
  } finally {
    connection.release();
    await worker.close();
    await queueEvents.close();
    await jobQueue.close();
    await redisConnection.quit();
    await pool.end();
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Manual idempotency validation failed:', error);
    process.exit(1);
  });

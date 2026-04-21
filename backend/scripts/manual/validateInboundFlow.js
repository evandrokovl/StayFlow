require('dotenv').config();

const bcrypt = require('bcryptjs');
const { QueueEvents } = require('bullmq');

const pool = require('../../src/config/database');
const { getRedisConnection } = require('../../src/config/redis');
const { jobQueue, queueName } = require('../../src/queues/jobQueue');
const { startQueueWorker } = require('../../src/workers/queueWorker');

const runId = `manual_${new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14)}`;
const inboundAlias = `u999${Date.now()}@inbound.test`;
const listingCode = `sf${Date.now()}`;
const guestEmail = `${runId}@guest.test`;

function buildEvent({ scenario, subject, body }) {
  return {
    type: 'email.received',
    data: {
      to: inboundAlias,
      from: scenario === 'booking'
        ? 'reservation@booking.com'
        : 'automated@airbnb.com',
      subject: `[${runId}] ${subject}`,
      text: body
    }
  };
}

async function waitForJob(job, queueEvents) {
  return job.waitUntilFinished(queueEvents, 30000);
}

async function seedData(connection) {
  const password = await bcrypt.hash('manual-validation-password', 10);

  const [userInsert] = await connection.query(
    `
    INSERT INTO users (name, email, password, inbound_alias)
    VALUES (?, ?, ?, ?)
    `,
    [
      `Manual Validation ${runId}`,
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
      `Casa Azul Centro ${runId}`,
      'Imóvel criado para validação manual inbound',
      'Rua das Flores 123',
      'São Paulo',
      'SP',
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
      `Template Validação ${runId}`,
      'Bem-vindo {guest_name}',
      'Olá {guest_name}, sua reserva em {property_name} está confirmada de {start_date} até {end_date}.'
    ]
  );

  const templateId = templateInsert.insertId;

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
      templateId,
      `Automação Validação ${runId}`
    ]
  );

  return {
    userId,
    propertyId,
    templateId,
    automationId: automationInsert.insertId
  };
}

async function snapshot(connection, ids) {
  const [inboundRows] = await connection.query(
    `
    SELECT id, property_id, created_reservation_id, email_id, parsing_status, parsing_notes
    FROM inbound_emails
    WHERE user_id = ?
    ORDER BY id ASC
    `,
    [ids.userId]
  );

  const [reservationRows] = await connection.query(
    `
    SELECT id, property_id, guest_name, guest_email, guest_phone, source, start_date, end_date, status, external_id, total_amount, notes
    FROM reservations
    WHERE property_id = ?
    ORDER BY id ASC
    `,
    [ids.propertyId]
  );

  const [messageLogRows] = await connection.query(
    `
    SELECT id, automation_id, reservation_id, property_id, channel, guest_name, guest_contact, subject, scheduled_for, status, error_message
    FROM message_logs
    WHERE automation_id = ?
    ORDER BY id ASC
    `,
    [ids.automationId]
  );

  const [systemLogRows] = await connection.query(
    `
    SELECT id, level, message, service, created_at
    FROM system_logs
    WHERE created_at >= DATE_SUB(NOW(), INTERVAL 10 MINUTE)
      AND service IN ('inbound', 'queue', 'message-automation')
    ORDER BY id DESC
    LIMIT 20
    `
  );

  return {
    inbound_emails: inboundRows,
    reservations: reservationRows,
    message_logs: messageLogRows,
    recent_system_logs: systemLogRows
  };
}

async function main() {
  const connection = await pool.getConnection();
  const queueEvents = new QueueEvents(queueName, {
    connection: getRedisConnection().duplicate()
  });
  const worker = startQueueWorker();

  try {
    await queueEvents.waitUntilReady();

    const ids = await seedData(connection);

    console.log(JSON.stringify({
      runId,
      queueName,
      inboundAlias,
      listingCode,
      ...ids
    }, null, 2));

    const scenarios = [
      {
        label: 'novo',
        event: buildEvent({
          scenario: 'airbnb',
          subject: 'Reservation confirmed for Ana Silva',
          body: `
            ---------- Forwarded message ---------
            From: Airbnb <automated@airbnb.com>
            Subject: Reservation confirmed

            Guest: Ana Silva
            Email: ${guestEmail}
            Phone: +55 11 99999-8888
            Check-in: 10 de maio de 2026
            Check-out: 12 de maio de 2026
            Total payout: R$ 1.250,00
            Stay: Casa Azul Centro ${runId}
            https://www.airbnb.com/rooms/${listingCode}
          `
        })
      },
      {
        label: 'alteracao',
        event: buildEvent({
          scenario: 'airbnb',
          subject: 'Reservation updated for Ana Silva',
          body: `
            Airbnb reservation updated
            Guest: Ana Silva
            Email: ${guestEmail}
            Phone: +55 11 99999-8888
            Check-in: 11 de maio de 2026
            Check-out: 13 de maio de 2026
            Total payout: R$ 1.400,00
            Stay: Casa Azul Centro ${runId}
            https://www.airbnb.com/rooms/${listingCode}
          `
        })
      },
      {
        label: 'cancelamento',
        event: buildEvent({
          scenario: 'airbnb',
          subject: 'Reservation cancelled for Ana Silva',
          body: `
            Airbnb reservation cancelled
            Guest: Ana Silva
            Email: ${guestEmail}
            Phone: +55 11 99999-8888
            Check-in: 11 de maio de 2026
            Check-out: 13 de maio de 2026
            Total payout: R$ 1.400,00
            Stay: Casa Azul Centro ${runId}
            https://www.airbnb.com/rooms/${listingCode}
          `
        })
      }
    ];

    for (const scenario of scenarios) {
      const job = await jobQueue.add(
        'inbound_resend',
        { payload: scenario.event },
        {
          jobId: `${runId}_${scenario.label}`
        }
      );

      const result = await waitForJob(job, queueEvents);
      console.log(JSON.stringify({
        scenario: scenario.label,
        jobId: job.id,
        workerResult: result
      }, null, 2));

      if (scenario.label === 'novo') {
        const automationJob = await jobQueue.add(
          'process_message_automations',
          { userId: ids.userId },
          {
            jobId: `${runId}_process_message_automations`
          }
        );

        const automationResult = await waitForJob(automationJob, queueEvents);
        console.log(JSON.stringify({
          scenario: 'message_automation_after_new_reservation',
          jobId: automationJob.id,
          workerResult: automationResult
        }, null, 2));
      }
    }

    const result = await snapshot(connection, ids);
    console.log(JSON.stringify({
      validation: 'final_snapshot',
      runId,
      ...result
    }, null, 2));
  } finally {
    connection.release();
    await worker.close();
    await queueEvents.close();
    await jobQueue.close();
    await getRedisConnection().quit();
    await pool.end();
  }
}

main().catch((error) => {
  console.error('Manual validation failed:', error);
  process.exit(1);
});

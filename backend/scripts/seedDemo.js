require('dotenv').config({ quiet: true });

const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const mysql = require('mysql2/promise');
const { env } = require('../src/config/env');

const DEMO_EMAIL = 'demo@stayflowapp.online';
const DEMO_PASSWORD = 'StayFlowDemo123!';
const DEMO_CPF = '90000000000';

function addDays(days) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function makeToken(label) {
  return `demo_${label}_${crypto.createHash('sha256').update(label).digest('hex').slice(0, 24)}`;
}

async function ensureDemoUser(connection) {
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  const [users] = await connection.query(
    'SELECT id FROM users WHERE email = ? LIMIT 1',
    [DEMO_EMAIL]
  );

  if (users.length > 0) {
    await connection.query(
      `
      UPDATE users
      SET
        name = ?,
        cpf = ?,
        password = ?,
        inbound_alias = ?,
        billing_status = 'TRIAL',
        trial_starts_at = COALESCE(trial_starts_at, NOW()),
        trial_ends_at = DATE_ADD(NOW(), INTERVAL 15 DAY),
        access_expires_at = DATE_ADD(NOW(), INTERVAL 15 DAY),
        current_plan_amount = 49.90
      WHERE id = ?
      `,
      ['Usuario Demo StayFlow', DEMO_CPF, passwordHash, 'demo-stayflow', users[0].id]
    );

    return users[0].id;
  }

  const [result] = await connection.query(
    `
    INSERT INTO users (
      name,
      email,
      cpf,
      password,
      inbound_alias,
      billing_status,
      trial_starts_at,
      trial_ends_at,
      access_expires_at,
      current_plan_amount
    ) VALUES (?, ?, ?, ?, ?, 'TRIAL', NOW(), DATE_ADD(NOW(), INTERVAL 15 DAY), DATE_ADD(NOW(), INTERVAL 15 DAY), 49.90)
    `,
    ['Usuario Demo StayFlow', DEMO_EMAIL, DEMO_CPF, passwordHash, 'demo-stayflow']
  );

  return result.insertId;
}

async function ensureUserBilling(connection, userId) {
  const [rows] = await connection.query(
    'SELECT id FROM user_billing WHERE user_id = ? LIMIT 1',
    [userId]
  );

  if (rows.length > 0) {
    await connection.query(
      `
      UPDATE user_billing
      SET
        active_properties_count = 2,
        additional_properties_count = 1,
        calculated_amount = 79.80,
        subscription_status = 'TRIAL',
        access_status = 'FULL',
        trial_started_at = COALESCE(trial_started_at, NOW()),
        trial_ends_at = DATE_ADD(NOW(), INTERVAL 15 DAY),
        next_billing_date = DATE_ADD(NOW(), INTERVAL 15 DAY)
      WHERE id = ?
      `,
      [rows[0].id]
    );
    return rows[0].id;
  }

  const [result] = await connection.query(
    `
    INSERT INTO user_billing (
      user_id,
      active_properties_count,
      additional_properties_count,
      calculated_amount,
      trial_started_at,
      trial_ends_at,
      next_billing_date,
      subscription_status,
      access_status
    ) VALUES (?, 2, 1, 79.80, NOW(), DATE_ADD(NOW(), INTERVAL 15 DAY), DATE_ADD(NOW(), INTERVAL 15 DAY), 'TRIAL', 'FULL')
    `,
    [userId]
  );

  return result.insertId;
}

async function ensureProperty(connection, userId, data) {
  const [rows] = await connection.query(
    'SELECT id, internal_ical_token FROM properties WHERE user_id = ? AND name = ? LIMIT 1',
    [userId, data.name]
  );

  if (rows.length > 0) {
    await connection.query(
      `
      UPDATE properties
      SET
        description = ?,
        address = ?,
        city = ?,
        state = ?,
        country = ?,
        airbnb_ical_url = ?,
        booking_ical_url = ?
      WHERE id = ?
      `,
      [
        data.description,
        data.address,
        data.city,
        data.state,
        'Brasil',
        data.airbnb_ical_url,
        data.booking_ical_url,
        rows[0].id
      ]
    );

    return rows[0].id;
  }

  const [result] = await connection.query(
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
    ) VALUES (?, ?, ?, ?, ?, ?, 'Brasil', ?, ?, ?)
    `,
    [
      userId,
      data.name,
      data.description,
      data.address,
      data.city,
      data.state,
      data.airbnb_ical_url,
      data.booking_ical_url,
      makeToken(data.name)
    ]
  );

  return result.insertId;
}

async function ensureListing(connection, propertyId, data) {
  const [rows] = await connection.query(
    `
    SELECT id
    FROM property_listings
    WHERE property_id = ? AND platform = ? AND listing_code = ?
    LIMIT 1
    `,
    [propertyId, data.platform, data.listing_code]
  );

  if (rows.length > 0) {
    await connection.query(
      'UPDATE property_listings SET listing_url = ?, is_active = 1 WHERE id = ?',
      [data.listing_url, rows[0].id]
    );
    return rows[0].id;
  }

  const [result] = await connection.query(
    `
    INSERT INTO property_listings (
      property_id,
      platform,
      listing_url,
      listing_code,
      is_active
    ) VALUES (?, ?, ?, ?, 1)
    `,
    [propertyId, data.platform, data.listing_url, data.listing_code]
  );

  return result.insertId;
}

async function ensureReservation(connection, propertyId, data) {
  const [rows] = await connection.query(
    'SELECT id FROM reservations WHERE property_id = ? AND external_id = ? LIMIT 1',
    [propertyId, data.external_id]
  );

  if (rows.length > 0) {
    await connection.query(
      `
      UPDATE reservations
      SET
        guest_name = ?,
        source = ?,
        start_date = ?,
        end_date = ?,
        status = 'confirmed',
        notes = ?,
        guest_email = ?,
        guest_phone = ?,
        total_amount = ?
      WHERE id = ?
      `,
      [
        data.guest_name,
        data.source,
        data.start_date,
        data.end_date,
        data.notes,
        data.guest_email,
        data.guest_phone,
        data.total_amount,
        rows[0].id
      ]
    );
    return rows[0].id;
  }

  const [result] = await connection.query(
    `
    INSERT INTO reservations (
      property_id,
      guest_name,
      source,
      start_date,
      end_date,
      status,
      external_id,
      notes,
      guest_email,
      guest_phone,
      total_amount
    ) VALUES (?, ?, ?, ?, ?, 'confirmed', ?, ?, ?, ?, ?)
    `,
    [
      propertyId,
      data.guest_name,
      data.source,
      data.start_date,
      data.end_date,
      data.external_id,
      data.notes,
      data.guest_email,
      data.guest_phone,
      data.total_amount
    ]
  );

  return result.insertId;
}

async function ensureFinancialEntry(connection, userId, propertyId, reservationId, data) {
  const reservationClause = reservationId ? 'reservation_id = ?' : 'reservation_id IS NULL';
  const params = reservationId
    ? [userId, propertyId, reservationId, data.description, data.source]
    : [userId, propertyId, data.description, data.source];

  const [rows] = await connection.query(
    `
    SELECT id
    FROM financial_entries
    WHERE user_id = ?
      AND property_id = ?
      AND ${reservationClause}
      AND description = ?
      AND source = ?
    LIMIT 1
    `,
    params
  );

  if (rows.length > 0) {
    await connection.query(
      `
      UPDATE financial_entries
      SET type = ?, category = ?, amount = ?, entry_date = ?, status = ?
      WHERE id = ?
      `,
      [data.type, data.category, data.amount, data.entry_date, data.status, rows[0].id]
    );
    return rows[0].id;
  }

  const [result] = await connection.query(
    `
    INSERT INTO financial_entries (
      user_id,
      property_id,
      reservation_id,
      type,
      category,
      description,
      amount,
      entry_date,
      status,
      source
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      userId,
      propertyId,
      reservationId || null,
      data.type,
      data.category,
      data.description,
      data.amount,
      data.entry_date,
      data.status,
      data.source
    ]
  );

  return result.insertId;
}

async function ensureTemplate(connection, userId, data) {
  const [rows] = await connection.query(
    'SELECT id FROM message_templates WHERE user_id = ? AND name = ? LIMIT 1',
    [userId, data.name]
  );

  if (rows.length > 0) {
    await connection.query(
      'UPDATE message_templates SET channel = ?, subject = ?, body = ? WHERE id = ?',
      [data.channel, data.subject, data.body, rows[0].id]
    );
    return rows[0].id;
  }

  const [result] = await connection.query(
    `
    INSERT INTO message_templates (
      user_id,
      name,
      channel,
      subject,
      body
    ) VALUES (?, ?, ?, ?, ?)
    `,
    [userId, data.name, data.channel, data.subject, data.body]
  );

  return result.insertId;
}

async function ensureAutomation(connection, userId, propertyId, templateId, data) {
  const [rows] = await connection.query(
    'SELECT id FROM message_automations WHERE user_id = ? AND name = ? LIMIT 1',
    [userId, data.name]
  );

  if (rows.length > 0) {
    await connection.query(
      `
      UPDATE message_automations
      SET
        property_id = ?,
        template_id = ?,
        trigger_type = ?,
        trigger_offset_value = ?,
        trigger_offset_unit = ?,
        is_active = 1
      WHERE id = ?
      `,
      [
        propertyId,
        templateId,
        data.trigger_type,
        data.trigger_offset_value,
        data.trigger_offset_unit,
        rows[0].id
      ]
    );
    return rows[0].id;
  }

  const [result] = await connection.query(
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
    ) VALUES (?, ?, ?, ?, ?, ?, ?, 1)
    `,
    [
      userId,
      propertyId,
      templateId,
      data.name,
      data.trigger_type,
      data.trigger_offset_value,
      data.trigger_offset_unit
    ]
  );

  return result.insertId;
}

async function seedDemo() {
  if (env.IS_PRODUCTION) {
    throw new Error('Seed demo bloqueado em NODE_ENV=production.');
  }

  const connection = await mysql.createConnection({
    host: env.DB_HOST,
    port: env.DB_PORT,
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    database: env.DB_NAME
  });

  try {
    await connection.beginTransaction();

    const userId = await ensureDemoUser(connection);
    await ensureUserBilling(connection, userId);

    const apartmentId = await ensureProperty(connection, userId, {
      name: 'Demo Apartamento Vista Mar',
      description: 'Imovel ficticio para demonstracao do fluxo StayFlow.',
      address: 'Rua Demo, 100',
      city: 'Florianopolis',
      state: 'SC',
      airbnb_ical_url: 'https://example.com/demo-airbnb.ics',
      booking_ical_url: 'https://example.com/demo-booking.ics'
    });

    const chaletId = await ensureProperty(connection, userId, {
      name: 'Demo Chale Serra',
      description: 'Segundo imovel ficticio para demonstrar operacao multi-imoveis.',
      address: 'Estrada Demo, 55',
      city: 'Gramado',
      state: 'RS',
      airbnb_ical_url: 'https://example.com/demo-chale-airbnb.ics',
      booking_ical_url: 'https://example.com/demo-chale-booking.ics'
    });

    await ensureListing(connection, apartmentId, {
      platform: 'airbnb',
      listing_url: 'https://www.airbnb.com.br/rooms/demo-stayflow-vista-mar',
      listing_code: 'DEMO-AIRBNB-001'
    });
    await ensureListing(connection, apartmentId, {
      platform: 'booking',
      listing_url: 'https://www.booking.com/hotel/br/demo-stayflow-vista-mar.html',
      listing_code: 'DEMO-BOOKING-001'
    });
    await ensureListing(connection, chaletId, {
      platform: 'airbnb',
      listing_url: 'https://www.airbnb.com.br/rooms/demo-stayflow-chale',
      listing_code: 'DEMO-AIRBNB-002'
    });

    const airbnbReservationId = await ensureReservation(connection, apartmentId, {
      external_id: 'demo-airbnb-001',
      guest_name: 'Hospede Demo Airbnb',
      source: 'airbnb',
      start_date: addDays(3),
      end_date: addDays(6),
      notes: 'Reserva ficticia importada para demonstracao.',
      guest_email: 'hospede.airbnb@example.com',
      guest_phone: '+5500000000000',
      total_amount: 1850.00
    });

    const bookingReservationId = await ensureReservation(connection, chaletId, {
      external_id: 'demo-booking-001',
      guest_name: 'Hospede Demo Booking',
      source: 'booking',
      start_date: addDays(9),
      end_date: addDays(12),
      notes: 'Reserva ficticia de Booking para demonstracao.',
      guest_email: 'hospede.booking@example.com',
      guest_phone: '+5500000000001',
      total_amount: 2420.00
    });

    await ensureReservation(connection, apartmentId, {
      external_id: 'demo-block-001',
      guest_name: 'Bloqueio Demo Manutencao',
      source: 'manual',
      start_date: addDays(14),
      end_date: addDays(15),
      notes: 'Bloqueio ficticio para manutencao preventiva.',
      guest_email: null,
      guest_phone: null,
      total_amount: null
    });

    await ensureFinancialEntry(connection, userId, apartmentId, airbnbReservationId, {
      type: 'income',
      category: 'reserva',
      description: 'Demo receita reserva Airbnb',
      amount: 1850.00,
      entry_date: addDays(3),
      status: 'paid',
      source: 'demo'
    });
    await ensureFinancialEntry(connection, userId, apartmentId, null, {
      type: 'expense',
      category: 'limpeza',
      description: 'Demo limpeza apartamento',
      amount: 180.00,
      entry_date: addDays(6),
      status: 'pending',
      source: 'demo'
    });
    await ensureFinancialEntry(connection, userId, chaletId, bookingReservationId, {
      type: 'income',
      category: 'reserva',
      description: 'Demo receita reserva Booking',
      amount: 2420.00,
      entry_date: addDays(9),
      status: 'paid',
      source: 'demo'
    });

    const preCheckinTemplateId = await ensureTemplate(connection, userId, {
      name: 'Demo pre-check-in',
      channel: 'email',
      subject: 'Sua estadia esta chegando',
      body: 'Ola {{guest_name}}, sua estadia no {{property_name}} esta chegando. Em breve enviaremos as instrucoes principais.'
    });
    const checkinTemplateId = await ensureTemplate(connection, userId, {
      name: 'Demo check-in',
      channel: 'email',
      subject: 'Instrucoes de check-in',
      body: 'Ola {{guest_name}}, seja bem-vindo. Confira as instrucoes de acesso ao {{property_name}}.'
    });
    const checkoutTemplateId = await ensureTemplate(connection, userId, {
      name: 'Demo checkout',
      channel: 'email',
      subject: 'Orientacoes de checkout',
      body: 'Ola {{guest_name}}, esperamos que tenha aproveitado a estadia. Veja as orientacoes para checkout.'
    });

    await ensureAutomation(connection, userId, apartmentId, preCheckinTemplateId, {
      name: 'Demo envio pre-check-in',
      trigger_type: 'before_checkin',
      trigger_offset_value: 1,
      trigger_offset_unit: 'days'
    });
    await ensureAutomation(connection, userId, apartmentId, checkinTemplateId, {
      name: 'Demo envio no check-in',
      trigger_type: 'checkin_day',
      trigger_offset_value: 0,
      trigger_offset_unit: 'days'
    });
    await ensureAutomation(connection, userId, chaletId, checkoutTemplateId, {
      name: 'Demo envio checkout',
      trigger_type: 'checkout_day',
      trigger_offset_value: 0,
      trigger_offset_unit: 'days'
    });

    await connection.commit();

    console.log(JSON.stringify({
      ok: true,
      demoUser: {
        email: DEMO_EMAIL,
        password: DEMO_PASSWORD
      },
      userId,
      properties: 2,
      reservations: 3,
      financialEntries: 3,
      templates: 3,
      automations: 3
    }, null, 2));
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    await connection.end();
  }
}

seedDemo().catch((error) => {
  console.error(JSON.stringify({
    ok: false,
    error: error.code || error.name,
    message: error.message
  }, null, 2));
  process.exit(1);
});

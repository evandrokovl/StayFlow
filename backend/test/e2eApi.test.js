require('dotenv').config({ quiet: true });

const assert = require('node:assert/strict');
const test = require('node:test');

const shouldRun = process.env.RUN_DB_E2E === '1' && process.env.NODE_ENV !== 'production';

let app;
let pool;
let jobQueue;
let getRedisConnection;

function loadAppDeps() {
  if (!app) {
    app = require('../src/app');
    pool = require('../src/config/database');
    jobQueue = require('../src/queues/jobQueue').jobQueue;
    getRedisConnection = require('../src/config/redis').getRedisConnection;
  }
}

function onlyDigits(value) {
  return String(value).replace(/\D/g, '');
}

function makeCpf(seed) {
  const base = String(seed).padStart(9, '0').slice(-9).split('').map(Number);

  function digit(numbers, factorStart) {
    const sum = numbers.reduce((total, number, index) => total + number * (factorStart - index), 0);
    const rest = (sum * 10) % 11;
    return rest === 10 ? 0 : rest;
  }

  const d1 = digit(base, 10);
  const d2 = digit([...base, d1], 11);
  return [...base, d1, d2].join('');
}

async function requestJson(baseUrl, path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
      ...(options.headers || {})
    },
    body: options.body ? JSON.stringify(options.body) : undefined
  });

  const text = await response.text();
  let body = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
  }

  return { response, body };
}

async function cleanupE2E(stamp) {
  loadAppDeps();
  const emailLike = `e2e+${stamp}%@stayflowapp.online`;
  const [users] = await pool.query('SELECT id FROM users WHERE email LIKE ?', [emailLike]);
  const userIds = users.map((user) => user.id);

  if (!userIds.length) return;

  const placeholders = userIds.map(() => '?').join(',');
  const [properties] = await pool.query(
    `SELECT id FROM properties WHERE user_id IN (${placeholders})`,
    userIds
  );
  const propertyIds = properties.map((property) => property.id);
  const propertyPlaceholders = propertyIds.map(() => '?').join(',');

  if (propertyIds.length) {
    await pool.query(`DELETE FROM financial_entries WHERE property_id IN (${propertyPlaceholders})`, propertyIds);
    await pool.query(`DELETE FROM message_logs WHERE property_id IN (${propertyPlaceholders})`, propertyIds);
    await pool.query(`DELETE FROM reservations WHERE property_id IN (${propertyPlaceholders})`, propertyIds);
    await pool.query(`DELETE FROM property_listings WHERE property_id IN (${propertyPlaceholders})`, propertyIds);
  }

  await pool.query(`DELETE FROM message_automations WHERE user_id IN (${placeholders})`, userIds);
  await pool.query(`DELETE FROM message_templates WHERE user_id IN (${placeholders})`, userIds);
  await pool.query(`DELETE FROM user_billing WHERE user_id IN (${placeholders})`, userIds);
  await pool.query(`DELETE FROM password_reset_tokens WHERE user_id IN (${placeholders})`, userIds);

  if (propertyIds.length) {
    await pool.query(`DELETE FROM properties WHERE id IN (${propertyPlaceholders})`, propertyIds);
  }

  await pool.query(`DELETE FROM users WHERE id IN (${placeholders})`, userIds);
}

test('E2E API: cadastro, login, imovel, iCal, template, automacao, reserva e isolamento multiusuario', {
  skip: shouldRun ? false : 'Defina RUN_DB_E2E=1 para executar o E2E com banco local.'
}, async () => {
  loadAppDeps();
  const stamp = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
  const password = 'E2eStayFlow123!';
  const userA = {
    name: 'E2E Usuario A',
    email: `e2e+${stamp}-a@stayflowapp.online`,
    cpf: makeCpf(stamp.slice(-9)),
    password
  };
  const userB = {
    name: 'E2E Usuario B',
    email: `e2e+${stamp}-b@stayflowapp.online`,
    cpf: makeCpf(Number(stamp.slice(-9)) + 1),
    password
  };

  await cleanupE2E(stamp);

  const server = await new Promise((resolve) => {
    const instance = app.listen(0, () => resolve(instance));
  });
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  try {
    const registerA = await requestJson(baseUrl, '/auth/register', { method: 'POST', body: userA });
    assert.equal(registerA.response.status, 201);

    const registerB = await requestJson(baseUrl, '/auth/register', { method: 'POST', body: userB });
    assert.equal(registerB.response.status, 201);

    const loginA = await requestJson(baseUrl, '/auth/login', {
      method: 'POST',
      body: { email: userA.email, password }
    });
    assert.equal(loginA.response.status, 200);
    const tokenA = loginA.body.data.token;

    const loginB = await requestJson(baseUrl, '/auth/login', {
      method: 'POST',
      body: { email: userB.email, password }
    });
    assert.equal(loginB.response.status, 200);
    const tokenB = loginB.body.data.token;

    const propertyResponse = await requestJson(baseUrl, '/properties', {
      method: 'POST',
      token: tokenA,
      body: {
        name: `E2E Imovel ${stamp}`,
        description: 'Imovel ficticio para teste E2E.',
        address: 'Rua E2E, 123',
        city: 'Florianopolis',
        state: 'SC',
        country: 'Brasil',
        airbnb_ical_url: 'https://example.com/e2e-airbnb.ics',
        booking_ical_url: 'https://example.com/e2e-booking.ics',
        listing_url: `https://www.airbnb.com.br/rooms/${stamp}`
      }
    });
    assert.equal(propertyResponse.response.status, 201);
    const propertyId = propertyResponse.body.property.id;

    const icalProperty = await requestJson(baseUrl, `/ical/property/${propertyId}`, {
      token: tokenA
    });
    assert.equal(icalProperty.response.status, 200);
    const internalToken = icalProperty.body.internal_ical_token;

    const feedResponse = await fetch(`${baseUrl}/ical/${internalToken}.ics`);
    assert.equal(feedResponse.status, 200);
    assert.match(await feedResponse.text(), /BEGIN:VCALENDAR/);

    const templateResponse = await requestJson(baseUrl, '/message-templates', {
      method: 'POST',
      token: tokenA,
      body: {
        name: `E2E Pre check-in ${stamp}`,
        channel: 'email',
        subject: 'Chegada proxima',
        body: 'Ola {{guest_name}}, sua estadia esta chegando.'
      }
    });
    assert.equal(templateResponse.response.status, 201);
    const templateId = templateResponse.body.template.id;

    const automationResponse = await requestJson(baseUrl, '/message-automations', {
      method: 'POST',
      token: tokenA,
      body: {
        property_id: propertyId,
        template_id: templateId,
        name: `E2E Automacao ${stamp}`,
        trigger_type: 'pre_check_in',
        offset_days: 1,
        is_active: true
      }
    });
    assert.equal(automationResponse.response.status, 201);

    const reservationResponse = await requestJson(baseUrl, '/reservations', {
      method: 'POST',
      token: tokenA,
      body: {
        property_id: propertyId,
        guest_name: 'Hospede E2E',
        start_date: '2026-05-10',
        end_date: '2026-05-12',
        type: 'manual',
        total_amount: 1200
      }
    });
    assert.equal(reservationResponse.response.status, 201);

    const forbiddenProperty = await requestJson(baseUrl, `/properties/${propertyId}`, {
      token: tokenB
    });
    assert.equal(forbiddenProperty.response.status, 404);

    const forbiddenReservation = await requestJson(baseUrl, '/reservations', {
      method: 'POST',
      token: tokenB,
      body: {
        property_id: propertyId,
        guest_name: 'Tentativa B',
        start_date: '2026-06-10',
        end_date: '2026-06-12',
        type: 'manual',
        total_amount: 500
      }
    });
    assert.equal(forbiddenReservation.response.status, 404);
  } finally {
    await cleanupE2E(stamp);
    await new Promise((resolve) => server.close(resolve));
    await jobQueue.close().catch(() => {});
    await getRedisConnection().quit().catch(() => {});
    await pool.end().catch(() => {});
  }
});

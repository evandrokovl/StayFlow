const test = require('node:test');
const assert = require('node:assert/strict');

const { parseInboundReservation } = require('../src/services/inbound/reservationParser');
const { scoreListingCandidate } = require('../src/services/inbound/propertyMatcher');
const { scoreReservationCandidate } = require('../src/services/inbound/reservationReconciler');
const { buildInboundFingerprint } = require('../src/services/inbound/idempotency');

test('parser inbound reconhece forward Airbnb com score por campo', () => {
  const parsed = parseInboundReservation({
    fromEmail: 'automated@airbnb.com',
    subject: 'Fwd: Reservation confirmed for Ana Silva',
    bodyText: `
      ---------- Forwarded message ---------
      From: Airbnb <automated@airbnb.com>
      Subject: Reservation confirmed

      Guest: Ana Silva
      Check-in: 10 de maio de 2026
      Check-out: 12 de maio de 2026
      Total payout: R$ 1.250,00
      Phone: +55 11 99999-8888
      https://www.airbnb.com/rooms/123456
    `
  });

  assert.equal(parsed.platform, 'airbnb');
  assert.equal(parsed.action, 'new');
  assert.equal(parsed.workflowAction, 'created');
  assert.equal(parsed.guestName, 'Ana Silva');
  assert.equal(parsed.startDate, '2026-05-10');
  assert.equal(parsed.endDate, '2026-05-12');
  assert.equal(parsed.totalAmount, 1250);
  assert.ok(parsed.confidence >= 70);
  assert.ok(parsed.fieldScores.startDate >= 80);
});

test('property matcher pontua listing_code e nome do imóvel', () => {
  const parsed = parseInboundReservation({
    fromEmail: 'automated@airbnb.com',
    subject: 'Reservation confirmed',
    bodyText: `
      Guest: Ana Silva
      Check-in: 2026-05-10
      Check-out: 2026-05-12
      Stay: Casa Azul Centro
      https://www.airbnb.com/rooms/123456
    `
  });

  const result = scoreListingCandidate({
    property_id: 5,
    platform: 'airbnb',
    listing_url: 'https://www.airbnb.com/rooms/123456',
    listing_code: '123456',
    property_name: 'Casa Azul Centro',
    address: 'Rua A',
    city: 'São Paulo',
    state: 'SP',
    country: 'Brasil'
  }, {
    platform: parsed.platform,
    cleanedText: parsed.normalized.cleanedText,
    comparableText: parsed.normalized.comparableText
  });

  assert.ok(result.score >= 250);
  assert.ok(result.reasons.includes('airbnb_room_id'));
});

test('reservation reconciler pontua nome, datas e contato', () => {
  const result = scoreReservationCandidate({
    id: 7,
    guest_name: 'Ana Silva',
    guest_email: 'ana@test.com',
    guest_phone: null,
    start_date: '2026-05-10',
    end_date: '2026-05-12',
    total_amount: 1250,
    status: 'confirmed'
  }, {
    guestName: 'Ana Silva',
    guestEmail: 'ana@test.com',
    startDate: '2026-05-10',
    endDate: '2026-05-12',
    totalAmount: 1250
  });

  assert.ok(result.score >= 250);
  assert.ok(result.reasons.includes('guest_email_exact'));
});

test('idempotency gera fingerprint estável para mesmo email', () => {
  const first = buildInboundFingerprint({
    emailId: '',
    toEmail: 'U1@Inbound.test',
    fromEmail: 'Automated@Airbnb.com',
    subject: 'Reservation confirmed',
    bodyText: 'Guest: Ana Silva Check-in: 2026-05-10'
  });

  const second = buildInboundFingerprint({
    emailId: '',
    toEmail: 'u1@inbound.test',
    fromEmail: 'automated@airbnb.com',
    subject: '  reservation   confirmed ',
    bodyText: 'Guest: Ana Silva\nCheck-in: 2026-05-10'
  });

  assert.equal(first, second);
  assert.equal(first.length, 64);
});

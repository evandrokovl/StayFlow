const pool = require('../config/database');
const logger = require('../utils/logger');

// =========================
// FUNÇÕES DE DATA SEGURAS
// =========================

function parseDateSafe(dateValue) {
  if (!dateValue) return null;

  if (dateValue instanceof Date) {
    return new Date(dateValue.getTime());
  }

  if (typeof dateValue === 'string') {
    const onlyDate = dateValue.slice(0, 10);
    const parts = onlyDate.split('-');

    if (parts.length === 3) {
      const year = Number(parts[0]);
      const month = Number(parts[1]);
      const day = Number(parts[2]);

      if (!Number.isNaN(year) && !Number.isNaN(month) && !Number.isNaN(day)) {
        return new Date(year, month - 1, day);
      }
    }
  }

  const fallback = new Date(dateValue);
  return Number.isNaN(fallback.getTime()) ? null : fallback;
}

function formatDateBR(dateValue) {
  const date = parseDateSafe(dateValue);
  if (!date) return '';

  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();

  return `${day}/${month}/${year}`;
}

function toDateOnlyString(dateValue) {
  const d = parseDateSafe(dateValue);
  if (!d) return null;

  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

function addOffset(dateValue, value, unit) {
  const d = parseDateSafe(dateValue);
  if (!d) return null;

  if (unit === 'minutes') d.setMinutes(d.getMinutes() + value);
  else if (unit === 'hours') d.setHours(d.getHours() + value);
  else d.setDate(d.getDate() + value);

  return d;
}

// =========================
// TEMPLATE RENDER
// =========================

function renderTemplate(templateBody, data = {}) {
  let output = templateBody || '';

  Object.keys(data).forEach((key) => {
    const value = data[key] == null ? '' : String(data[key]);
    const regex = new RegExp(`\\{${key}\\}`, 'g');
    output = output.replace(regex, value);
  });

  return output;
}

function renderSubject(templateSubject, data = {}) {
  return renderTemplate(templateSubject || '', data);
}

// =========================
// CONTATO
// =========================

function normalizeOptionalText(value) {
  if (value === undefined || value === null) return null;

  const normalized = String(value).trim();
  return normalized === '' ? null : normalized;
}

function pickGuestContact(channel, reservation) {
  if (channel === 'whatsapp') {
    return normalizeOptionalText(reservation.guest_phone);
  }

  return normalizeOptionalText(reservation.guest_email);
}

function buildMissingContactMessage(channel) {
  if (channel === 'whatsapp') {
    return 'Hóspede sem telefone disponível para automação WhatsApp';
  }

  return 'Hóspede sem email disponível para automação de email';
}

// =========================
// LOG DUPLICADO
// =========================

async function logAlreadyExists(automationId, reservationId, scheduledFor) {
  const [rows] = await pool.query(
    `
    SELECT id
    FROM message_logs
    WHERE automation_id = ?
      AND reservation_id = ?
      AND scheduled_for = ?
    LIMIT 1
    `,
    [automationId, reservationId, scheduledFor]
  );

  return rows.length > 0;
}

// =========================
// CALCULAR DATA
// =========================

function buildScheduledDate(triggerType, startDate, endDate, offsetValue, offsetUnit) {
  if (triggerType === 'reservation_created') {
    return new Date();
  }

  if (triggerType === 'before_checkin') {
    return addOffset(startDate, -Math.abs(offsetValue), offsetUnit);
  }

  if (triggerType === 'checkin_day') {
    return addOffset(startDate, 0, offsetUnit);
  }

  if (triggerType === 'before_checkout') {
    return addOffset(endDate, -Math.abs(offsetValue), offsetUnit);
  }

  if (triggerType === 'checkout_day') {
    return addOffset(endDate, 0, offsetUnit);
  }

  if (triggerType === 'after_checkout') {
    return addOffset(endDate, Math.abs(offsetValue), offsetUnit);
  }

  return new Date();
}

// =========================
// PROCESSAMENTO PRINCIPAL
// =========================

async function processMessageAutomations(userId = null) {
  const params = [];
  let whereUser = '';

  if (userId) {
    whereUser = 'WHERE ma.user_id = ?';
    params.push(userId);
  }

  const [automations] = await pool.query(
    `
    SELECT
      ma.id,
      ma.user_id,
      ma.property_id,
      ma.template_id,
      ma.name,
      ma.trigger_type,
      ma.trigger_offset_value,
      ma.trigger_offset_unit,
      ma.is_active,
      mt.channel,
      mt.subject,
      mt.body
    FROM message_automations ma
    JOIN message_templates mt ON mt.id = ma.template_id
    ${whereUser}
    ORDER BY ma.id ASC
    `,
    params
  );

  let createdLogs = 0;
  let processedAutomations = 0;
  let needsContactLogs = 0;

  for (const automation of automations) {
    if (!automation.is_active) continue;

    processedAutomations++;

    const reservationParams = [automation.user_id];
    let propertyFilter = '';

    if (automation.property_id) {
      propertyFilter = 'AND r.property_id = ?';
      reservationParams.push(automation.property_id);
    }

    const [reservations] = await pool.query(
      `
      SELECT
        r.id,
        r.property_id,
        r.guest_name,
        r.guest_email,
        r.guest_phone,
        r.start_date,
        r.end_date,
        r.status,
        p.name AS property_name
      FROM reservations r
      JOIN properties p ON p.id = r.property_id
      WHERE p.user_id = ?
        ${propertyFilter}
        AND r.status = 'confirmed'
      ORDER BY r.id ASC
      `,
      reservationParams
    );

    for (const reservation of reservations) {
      const scheduledDate = buildScheduledDate(
        automation.trigger_type,
        reservation.start_date,
        reservation.end_date,
        Number(automation.trigger_offset_value || 0),
        automation.trigger_offset_unit || 'days'
      );

      const scheduledDateOnly = toDateOnlyString(scheduledDate);

      if (!scheduledDateOnly) {
        logger.warn('Data inválida ao gerar automação', {
          service: 'message-automation',
          reservationId: reservation.id,
          startDate: reservation.start_date,
          endDate: reservation.end_date,
          automationId: automation.id
        });
        continue;
      }

      const scheduledFor = `${scheduledDateOnly} 09:00:00`;

      const alreadyExists = await logAlreadyExists(
        automation.id,
        reservation.id,
        scheduledFor
      );

      if (alreadyExists) {
        continue;
      }

      const data = {
        guest_name: reservation.guest_name || 'Hóspede',
        property_name: reservation.property_name || 'Imóvel',
        start_date: formatDateBR(reservation.start_date),
        end_date: formatDateBR(reservation.end_date),
        days_before_checkin: String(automation.trigger_offset_value || 0)
      };

      const bodyRendered = renderTemplate(automation.body, data);
      const subjectRendered = renderSubject(automation.subject, data);
      const guestContact = pickGuestContact(automation.channel, reservation);

      const status = guestContact ? 'pending' : 'needs_contact';
      const errorMessage = guestContact ? null : buildMissingContactMessage(automation.channel);

      await pool.query(
        `
        INSERT INTO message_logs (
          automation_id,
          reservation_id,
          property_id,
          channel,
          guest_name,
          guest_contact,
          subject,
          body_rendered,
          scheduled_for,
          processed_at,
          status,
          error_message
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          automation.id,
          reservation.id,
          reservation.property_id,
          automation.channel || 'email',
          reservation.guest_name || null,
          guestContact,
          subjectRendered || null,
          bodyRendered,
          scheduledFor,
          null,
          status,
          errorMessage
        ]
      );

      createdLogs++;

      if (status === 'needs_contact') {
        needsContactLogs++;

        logger.warn('Log criado sem contato do hóspede', {
          service: 'message-automation',
          automationId: automation.id,
          reservationId: reservation.id,
          propertyId: reservation.property_id,
          channel: automation.channel || 'email',
          status
        });
      }
    }
  }

  return {
    processedAutomations,
    createdLogs,
    needsContactLogs
  };
}

module.exports = {
  processMessageAutomations,
  renderTemplate
};
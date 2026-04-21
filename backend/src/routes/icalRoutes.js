const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const authMiddleware = require('../middlewares/authMiddleware');
const { requireFullBilling } = require('../middlewares/billingAccessMiddleware');

function formatDateICS(date) {
  const d = new Date(date);
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${year}${month}${day}`;
}

function escapeICS(text = '') {
  return String(text)
    .replace(/\\/g, '\\\\')
    .replace(/\n/g, '\\n')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;');
}

router.get('/:token.ics', async (req, res) => {
  try {
    const { token } = req.params;

    const [properties] = await pool.query(
      `SELECT id, name, internal_ical_token
       FROM properties
       WHERE internal_ical_token = ?
       LIMIT 1`,
      [token]
    );

    if (properties.length === 0) {
      return res.status(404).send('Imóvel não encontrado');
    }

    const property = properties[0];

    const [reservations] = await pool.query(
      `SELECT id, guest_name, source, start_date, end_date, status, external_id, notes
       FROM reservations
       WHERE property_id = ?
         AND status IN ('confirmed', 'blocked')
       ORDER BY start_date ASC`,
      [property.id]
    );

    let ics = '';
    ics += 'BEGIN:VCALENDAR\r\n';
    ics += 'VERSION:2.0\r\n';
    ics += 'PRODID:-//StayControl//Calendario Interno//PT-BR\r\n';
    ics += 'CALSCALE:GREGORIAN\r\n';
    ics += 'METHOD:PUBLISH\r\n';
    ics += `X-WR-CALNAME:${escapeICS(property.name)}\r\n`;
    ics += `X-WR-CALDESC:${escapeICS(`Calendário do imóvel ${property.name}`)}\r\n`;

    for (const reservation of reservations) {
      const uid = reservation.external_id
        ? `${reservation.source}-${reservation.external_id}@staycontrol`
        : `reservation-${reservation.id}@staycontrol`;

      let summary = `Reserva - ${property.name}`;

      if (reservation.source === 'manual') {
        summary = `Reserva manual - ${property.name}`;
      } else if (reservation.source === 'airbnb') {
        summary = `Reserva Airbnb - ${property.name}`;
      } else if (reservation.source === 'booking') {
        summary = `Reserva Booking - ${property.name}`;
      } else if (reservation.source === 'blocked' || reservation.source === 'bloqueio') {
        summary = `Bloqueio - ${property.name}`;
      }

      const descriptionParts = [];
      if (reservation.guest_name) descriptionParts.push(`Hóspede: ${reservation.guest_name}`);
      if (reservation.source) descriptionParts.push(`Origem: ${reservation.source}`);
      if (reservation.notes) descriptionParts.push(`Obs: ${reservation.notes}`);

      const description = descriptionParts.join(' | ');

      ics += 'BEGIN:VEVENT\r\n';
      ics += `UID:${escapeICS(uid)}\r\n`;
      ics += `DTSTAMP:${formatDateICS(new Date())}T000000Z\r\n`;
      ics += `DTSTART;VALUE=DATE:${formatDateICS(reservation.start_date)}\r\n`;
      ics += `DTEND;VALUE=DATE:${formatDateICS(reservation.end_date)}\r\n`;
      ics += `SUMMARY:${escapeICS(summary)}\r\n`;
      ics += `DESCRIPTION:${escapeICS(description)}\r\n`;
      ics += 'STATUS:CONFIRMED\r\n';
      ics += 'TRANSP:OPAQUE\r\n';
      ics += 'END:VEVENT\r\n';
    }

    ics += 'END:VCALENDAR\r\n';

    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Content-Disposition', `inline; filename="${property.name}.ics"`);
    res.send(ics);
  } catch (error) {
    console.error('Erro ao gerar iCal:', error.message);
    res.status(500).send('Erro ao gerar iCal');
  }
});

router.get('/property/:id', authMiddleware, requireFullBilling, async (req, res) => {
  try {
    const { id } = req.params;

    const [properties] = await pool.query(
      `SELECT id, name, internal_ical_token
       FROM properties
       WHERE id = ?
         AND (user_id = ? OR ? = 'admin')
       LIMIT 1`,
      [id, req.user.id, req.user.role || 'user']
    );

    if (properties.length === 0) {
      return res.status(404).json({ error: 'Imóvel não encontrado' });
    }

    const property = properties[0];

    res.json({
      id: property.id,
      name: property.name,
      internal_ical_token: property.internal_ical_token,
      ical_url: `http://localhost:3000/ical/${property.internal_ical_token}.ics`
    });
  } catch (error) {
    console.error('Erro ao buscar link do iCal:', error.message);
    res.status(500).json({ error: 'Erro ao buscar link do iCal' });
  }
});

module.exports = router;

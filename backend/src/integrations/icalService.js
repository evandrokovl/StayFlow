const axios = require('axios');
const ical = require('node-ical');
const { validateExternalUrl } = require('../utils/security');
const logger = require('../utils/logger');

async function fetchIcalEvents(icalUrl) {
  try {
    if (!icalUrl || typeof icalUrl !== 'string') {
      return [];
    }

    const validation = validateExternalUrl(icalUrl);

    if (!validation.valid) {
      logger.warn('URL de iCal bloqueada por validação de segurança', {
        service: 'sync',
        scope: 'ical_fetch',
        icalUrl,
        reason: validation.reason
      });
      return [];
    }

    const response = await axios.get(icalUrl, {
      timeout: 15000,
      responseType: 'text',
      maxRedirects: 3
    });

    const rawIcal = response.data;

    if (!rawIcal || typeof rawIcal !== 'string') {
      return [];
    }

    const parsedData = ical.parseICS(rawIcal);

    const events = Object.values(parsedData)
      .filter((item) => item.type === 'VEVENT')
      .map((event) => ({
        uid: event.uid || null,
        summary: event.summary || 'Reserva',
        description: event.description || '',
        start_date: event.start ? formatDateOnly(event.start) : null,
        end_date: event.end ? formatDateOnly(event.end) : null,
        raw: event
      }))
      .filter((event) => event.start_date && event.end_date);

    return events;
  } catch (error) {
    logger.error('Erro ao buscar/processar iCal', {
      service: 'sync',
      scope: 'ical_fetch',
      icalUrl,
      error
    });
    return [];
  }
}

function formatDateOnly(date) {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

module.exports = {
  fetchIcalEvents
};
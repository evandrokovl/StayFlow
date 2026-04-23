const axios = require('axios');
const ical = require('node-ical');
const { validateExternalUrlAsync } = require('../utils/security');
const logger = require('../utils/logger');

const MAX_ICAL_REDIRECTS = 3;

async function fetchIcalEvents(icalUrl) {
  try {
    if (!icalUrl || typeof icalUrl !== 'string') {
      return [];
    }

    const response = await fetchValidatedIcalUrl(icalUrl);

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

async function fetchValidatedIcalUrl(initialUrl) {
  let currentUrl = initialUrl;

  for (let redirects = 0; redirects <= MAX_ICAL_REDIRECTS; redirects += 1) {
    const validation = await validateExternalUrlAsync(currentUrl);

    if (!validation.valid) {
      logger.warn('URL de iCal bloqueada por validação de segurança', {
        service: 'sync',
        scope: 'ical_fetch',
        icalUrl: currentUrl,
        reason: validation.reason
      });

      return {
        data: ''
      };
    }

    const response = await axios.get(currentUrl, {
      timeout: 15000,
      responseType: 'text',
      maxRedirects: 0,
      validateStatus(status) {
        return (status >= 200 && status < 300) || (status >= 300 && status < 400);
      }
    });

    if (response.status >= 300 && response.status < 400 && response.headers.location) {
      currentUrl = new URL(response.headers.location, currentUrl).toString();
      continue;
    }

    return response;
  }

  logger.warn('URL de iCal bloqueada por excesso de redirecionamentos', {
    service: 'sync',
    scope: 'ical_fetch',
    icalUrl: initialUrl,
    maxRedirects: MAX_ICAL_REDIRECTS
  });

  return {
    data: ''
  };
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

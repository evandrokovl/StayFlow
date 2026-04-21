const crypto = require('crypto');
const pool = require('../config/database');
const logger = require('../utils/logger');
const { buildInboundFingerprint, findExistingInboundEmail, isDuplicateInboundError } = require('./inbound/idempotency');
const { parseInboundReservation } = require('./inbound/reservationParser');
const { findBestPropertyMatch } = require('./inbound/propertyMatcher');
const { findBestReservationMatch } = require('./inbound/reservationReconciler');

function normalizeEmail(value) {
  if (!value) return null;
  return String(value).trim().toLowerCase();
}

function normalizeText(value) {
  if (value == null) return '';
  return String(value).trim();
}

function normalizeComparableText(value) {
  return normalizeParseText(value)
    .toLowerCase();
}

function normalizeParseText(value, options = {}) {
  const { preserveLines = false } = options;

  let normalized = normalizeText(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  if (preserveLines) {
    normalized = normalized
      .replace(/\r\n/g, '\n')
      .replace(/[ \t\f\v]+/g, ' ')
      .replace(/[ \t]*\n[ \t]*/g, '\n');
  } else {
    normalized = normalized.replace(/\s+/g, ' ');
  }

  return normalized.trim();
}

function firstEmail(value) {
  if (!value) return null;

  if (Array.isArray(value)) {
    if (!value.length) return null;
    return normalizeEmail(value[0]);
  }

  return normalizeEmail(value);
}

function extractAliasUserId(toEmail) {
  if (!toEmail) return null;

  const match = String(toEmail).match(/^u(\d+)@/i);
  if (!match) return null;

  const userId = Number(match[1]);
  return Number.isNaN(userId) ? null : userId;
}

function cleanEmailText(text) {
  if (!text) return '';

  let cleaned = String(text);

  const signaturePatterns = [
    /esta mensagem pode conter informações[\s\S]*$/i,
    /this message may contain confidential information[\s\S]*$/i,
    /sent from my iphone[\s\S]*$/i,
    /enviado do meu iphone[\s\S]*$/i
  ];

  for (const pattern of signaturePatterns) {
    cleaned = cleaned.replace(pattern, '');
  }

  return cleaned.trim();
}

function parseDateToYmd(text) {
  if (!text) return null;

  const normalized = normalizeParseText(text);

  const isoMatch = normalized.match(/\b(20\d{2})-(\d{2})-(\d{2})\b/);
  if (isoMatch) {
    return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
  }

  const brMatch = normalized.match(/\b(\d{2})\/(\d{2})\/(20\d{2})\b/);
  if (brMatch) {
    return `${brMatch[3]}-${brMatch[2]}-${brMatch[1]}`;
  }

  const longPtMatch = normalized.match(/\b(\d{1,2})\s+de\s+([a-z]+)\s+de\s+(20\d{2})\b/i);
  if (longPtMatch) {
    const month = monthNameToNumber(longPtMatch[2]);
    if (month) {
      return `${longPtMatch[3]}-${String(month).padStart(2, '0')}-${String(longPtMatch[1]).padStart(2, '0')}`;
    }
  }

  return null;
}

function monthNameToNumber(value) {
  const normalized = normalizeComparableText(value);
  const months = {
    janeiro: 1,
    jan: 1,
    fevereiro: 2,
    fev: 2,
    marco: 3,
    mar: 3,
    abril: 4,
    abr: 4,
    maio: 5,
    mai: 5,
    junho: 6,
    jun: 6,
    julho: 7,
    jul: 7,
    agosto: 8,
    ago: 8,
    setembro: 9,
    set: 9,
    outubro: 10,
    out: 10,
    novembro: 11,
    nov: 11,
    dezembro: 12,
    dez: 12
  };

  return months[normalized] || null;
}

function extractDatesWithPositions(text) {
  if (!text) return null;

  const matches = [];
  const normalized = normalizeParseText(text);

  const isoRegex = /\b(20\d{2})-(\d{2})-(\d{2})\b/g;
  let isoMatch;
  while ((isoMatch = isoRegex.exec(normalized)) !== null) {
    matches.push({
      value: `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`,
      index: isoMatch.index
    });
  }

  const brRegex = /\b(\d{2})\/(\d{2})\/(20\d{2})\b/g;
  let brMatch;
  while ((brMatch = brRegex.exec(normalized)) !== null) {
    matches.push({
      value: `${brMatch[3]}-${brMatch[2]}-${brMatch[1]}`,
      index: brMatch.index
    });
  }

  const longPtRegex = /\b(\d{1,2})\s+de\s+([a-z]+)\s+de\s+(20\d{2})\b/gi;
  let longPtMatch;
  while ((longPtMatch = longPtRegex.exec(normalized)) !== null) {
    const month = monthNameToNumber(longPtMatch[2]);
    if (!month) continue;

    matches.push({
      value: `${longPtMatch[3]}-${String(month).padStart(2, '0')}-${String(longPtMatch[1]).padStart(2, '0')}`,
      index: longPtMatch.index
    });
  }

  const seen = new Set();
  return matches
    .sort((a, b) => a.index - b.index)
    .filter((item) => {
      if (seen.has(item.value)) return false;
      seen.add(item.value);
      return true;
    });
}

function parseSecondDateToYmd(text, firstDate) {
  const matches = extractDatesWithPositions(text);

  if (!matches || !matches.length) return null;
  if (!firstDate) return matches[1]?.value || matches[0]?.value || null;

  const filtered = matches.filter((item) => item.value !== firstDate);
  return filtered[0]?.value || null;
}

function parseAmount(text) {
  if (!text) return null;

  const normalized = normalizeParseText(text);

  const patterns = [
    /R\$\s*([\d.]+,\d{2})/i,
    /\$\s*([\d,.]+)/i,
    /total[:\s-]*([\d,.]+)/i,
    /valor[:\s-]*([\d,.]+)/i
  ];

  for (const pattern of patterns) {
    const match = normalized.match(pattern);
    if (!match || !match[1]) continue;

    const raw = match[1].trim();

    if (/,/.test(raw) && /\./.test(raw)) {
      const amount = Number(raw.replace(/\./g, '').replace(',', '.'));
      if (!Number.isNaN(amount)) return amount;
      continue;
    }

    if (/,/.test(raw) && !/\./.test(raw)) {
      const amount = Number(raw.replace(',', '.'));
      if (!Number.isNaN(amount)) return amount;
      continue;
    }

    if (/\./.test(raw) && !/,/.test(raw)) {
      const parts = raw.split('.');
      if (parts.length > 2) {
        const amount = Number(raw.replace(/\./g, ''));
        if (!Number.isNaN(amount)) return amount;
        continue;
      }

      const amount = Number(raw);
      if (!Number.isNaN(amount)) return amount;
      continue;
    }

    const amount = Number(raw);
    if (!Number.isNaN(amount)) return amount;
  }

  return null;
}

function parseGuestName(subject, bodyText) {
  const sourceText = normalizeParseText(`${subject || ''}\n${bodyText || ''}`, {
    preserveLines: true
  });

  const patterns = [
    /hospede[:\s-]+([^\n\r|]+)/i,
    /guest[:\s-]+([^\n\r|]+)/i,
    /nome[:\s-]+([^\n\r|]+)/i,
    /name[:\s-]+([^\n\r|]+)/i,
    /reserva para[:\s-]+([^\n\r|]+)/i,
    /reservation for[:\s-]+([^\n\r|]+)/i
  ];

  for (const pattern of patterns) {
    const match = sourceText.match(pattern);
    if (match && match[1]) {
      const name = match[1].trim();
      if (name) return name.slice(0, 150);
    }
  }

  return null;
}

function parseGuestEmail(bodyText) {
  if (!bodyText) return null;
  const match = normalizeParseText(bodyText).match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  return match ? match[0].toLowerCase() : null;
}

function parseGuestPhone(bodyText) {
  if (!bodyText) return null;

  const text = normalizeParseText(bodyText);

  const phonePatterns = [
    /(?:telefone|phone|celular|whatsapp|fone)[:\s-]+(\+?\d[\d\s().-]{7,}\d)/i,
    /\b(\+55\s?\(?\d{2}\)?\s?\d{4,5}-?\d{4})\b/,
    /\b(\(?\d{2}\)?\s?\d{4,5}-?\d{4})\b/
  ];

  for (const pattern of phonePatterns) {
    const match = text.match(pattern);
    if (!match || !match[1]) continue;

    const candidate = match[1].trim();

    if (/^\d{4}-\d{2}-\d{2}$/.test(candidate)) {
      continue;
    }

    return candidate;
  }

  return null;
}

function parseDateNearLabels(text, labels) {
  if (!text) return null;

  const normalized = normalizeParseText(text, { preserveLines: true });
  const datePattern = '(20\\d{2}-\\d{2}-\\d{2}|\\d{1,2}\\/\\d{1,2}\\/20\\d{2}|\\d{1,2}\\s+de\\s+[a-z]+\\s+de\\s+20\\d{2})';

  for (const label of labels) {
    const escapedLabel = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const afterRegex = new RegExp(`${escapedLabel}[^\\n\\r\\d]{0,60}${datePattern}`, 'i');
    const afterMatch = normalized.match(afterRegex);
    if (afterMatch && afterMatch[1]) return parseDateToYmd(afterMatch[1]);

    const beforeRegex = new RegExp(`${datePattern}[^\\n\\r]{0,60}${escapedLabel}`, 'i');
    const beforeMatch = normalized.match(beforeRegex);
    if (beforeMatch && beforeMatch[1]) return parseDateToYmd(beforeMatch[1]);
  }

  return null;
}

function parseReservationDates(text, labelConfig = {}) {
  const startLabels = labelConfig.startLabels || [];
  const endLabels = labelConfig.endLabels || [];
  const startDate = parseDateNearLabels(text, startLabels);
  const endDate = parseDateNearLabels(text, endLabels);

  if (startDate || endDate) {
    const fallbackStart = startDate || parseDateToYmd(text);
    const fallbackEnd = endDate || parseSecondDateToYmd(text, fallbackStart);

    return {
      startDate: fallbackStart,
      endDate: fallbackEnd
    };
  }

  const dates = extractDatesWithPositions(text);
  const fallbackStart = dates?.[0]?.value || null;

  return {
    startDate: fallbackStart,
    endDate: parseSecondDateToYmd(text, fallbackStart)
  };
}

function parseTextByLabels(text, labels) {
  if (!text) return null;

  const normalized = normalizeParseText(text, { preserveLines: true });

  for (const label of labels) {
    const escapedLabel = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`${escapedLabel}[:\\s-]+([^\\n\\r|]+)`, 'i');
    const match = normalized.match(regex);
    if (!match || !match[1]) continue;

    const value = match[1].trim();
    if (value) return value.slice(0, 150);
  }

  return null;
}

function parseAmountByLabels(text, labels) {
  if (!text) return null;

  const normalized = normalizeParseText(text);

  for (const label of labels) {
    const escapedLabel = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`${escapedLabel}[:\\s-]*(?:R\\$|\\$)?\\s*([\\d.,]+)`, 'i');
    const match = normalized.match(regex);
    if (!match || !match[1]) continue;

    const amount = parseAmount(match[1]);
    if (amount != null) return amount;
  }

  return null;
}

function parseGenericReservationData({ subject, fullText }) {
  const { startDate, endDate } = parseReservationDates(fullText, {
    startLabels: ['check-in', 'check in', 'entrada', 'arrival', 'chegada', 'inicio'],
    endLabels: ['check-out', 'check out', 'saida', 'departure', 'partida', 'fim']
  });

  return {
    parser: 'generic',
    startDate,
    endDate,
    totalAmount: parseAmount(fullText),
    guestName: parseGuestName(subject, fullText),
    guestEmail: parseGuestEmail(fullText),
    guestPhone: parseGuestPhone(fullText)
  };
}

function parseAirbnbReservationData({ subject, fullText }) {
  const { startDate, endDate } = parseReservationDates(fullText, {
    startLabels: ['check-in', 'check in', 'entrada', 'arrival'],
    endLabels: ['check-out', 'check out', 'saida', 'departure']
  });

  return {
    parser: 'airbnb',
    startDate,
    endDate,
    totalAmount: parseAmountByLabels(fullText, ['total payout', 'payout', 'total', 'valor total', 'valor'])
      || parseAmount(fullText),
    guestName: parseTextByLabels(`${subject || ''}\n${fullText || ''}`, [
      'guest',
      'hospede',
      'reservation for',
      'reserva para'
    ]) || parseGuestName(subject, fullText),
    guestEmail: parseGuestEmail(fullText),
    guestPhone: parseGuestPhone(fullText)
  };
}

function parseBookingReservationData({ subject, fullText }) {
  const { startDate, endDate } = parseReservationDates(fullText, {
    startLabels: ['check-in', 'check in', 'arrival', 'entrada'],
    endLabels: ['check-out', 'check out', 'departure', 'saida']
  });

  return {
    parser: 'booking',
    startDate,
    endDate,
    totalAmount: parseAmountByLabels(fullText, ['reservation total', 'total price', 'total', 'valor total', 'valor'])
      || parseAmount(fullText),
    guestName: parseTextByLabels(`${subject || ''}\n${fullText || ''}`, [
      'guest name',
      'booker',
      'guest',
      'hospede',
      'nome'
    ]) || parseGuestName(subject, fullText),
    guestEmail: parseGuestEmail(fullText),
    guestPhone: parseGuestPhone(fullText)
  };
}

function parseVrboReservationData({ subject, fullText }) {
  const { startDate, endDate } = parseReservationDates(fullText, {
    startLabels: ['arrival', 'check-in', 'check in', 'entrada'],
    endLabels: ['departure', 'check-out', 'check out', 'saida']
  });

  return {
    parser: 'vrbo',
    startDate,
    endDate,
    totalAmount: parseAmountByLabels(fullText, ['total', 'traveler pays', 'valor total', 'valor'])
      || parseAmount(fullText),
    guestName: parseTextByLabels(`${subject || ''}\n${fullText || ''}`, [
      'traveler',
      'guest',
      'hospede',
      'nome'
    ]) || parseGuestName(subject, fullText),
    guestEmail: parseGuestEmail(fullText),
    guestPhone: parseGuestPhone(fullText)
  };
}

function parseReservationBySource({ subject, fullText, source }) {
  if (source === 'airbnb') return parseAirbnbReservationData({ subject, fullText });
  if (source === 'booking') return parseBookingReservationData({ subject, fullText });
  if (source === 'vrbo') return parseVrboReservationData({ subject, fullText });
  return parseGenericReservationData({ subject, fullText });
}

function parseReservationData({ subject, fullText, source, reservationAction }) {
  const parsed = parseReservationBySource({ subject, fullText, source });
  const {
    parser,
    startDate,
    endDate,
    totalAmount,
    guestName,
    guestEmail,
    guestPhone
  } = parsed;

  const missingFields = [];
  const notes = [`parser:${parser}`];
  let confidence = 0;

  if (startDate) confidence += 20;
  else missingFields.push('startDate');

  if (endDate) confidence += 20;
  else missingFields.push('endDate');

  if (guestName) confidence += 15;
  else missingFields.push('guestName');

  if (guestEmail || guestPhone) confidence += 15;
  else missingFields.push('guestContact');

  if (totalAmount != null) confidence += 10;
  else missingFields.push('totalAmount');

  if (source && source !== 'manual') confidence += 5;
  else notes.push('source_not_detected');

  if (reservationAction && reservationAction !== 'unknown') confidence += 15;
  else notes.push('action_not_detected');

  if (startDate && endDate && new Date(startDate) >= new Date(endDate)) {
    confidence = Math.max(0, confidence - 25);
    notes.push('invalid_date_order');
  }

  if (!guestEmail && guestPhone) {
    notes.push('guest_email_missing_phone_found');
  }

  if (missingFields.length) {
    notes.push(`missing_fields:${missingFields.join(',')}`);
  }

  return {
    startDate,
    endDate,
    totalAmount,
    guestName,
    guestEmail,
    guestPhone,
    parser,
    confidence: Math.min(confidence, 100),
    missingFields,
    notes
  };
}

function buildParseDiagnostic(parseResult, details = []) {
  const parts = [
    `parser=${parseResult.parser}`,
    `confidence=${parseResult.confidence}`
  ];

  if (parseResult.missingFields.length) {
    parts.push(`missing=${parseResult.missingFields.join(',')}`);
  }

  if (parseResult.notes.length) {
    parts.push(`notes=${parseResult.notes.join(',')}`);
  }

  if (details.length) {
    parts.push(`details=${details.join(',')}`);
  }

  return ` | Diagnostico do parse: ${parts.join('; ')}`;
}

function logInboundParseIssue(reason, context = {}) {
  logger.warn('Inbound ignorado durante parsing', {
    service: 'inbound',
    scope: 'reservation_parse',
    reason,
    inboundEmailId: context.inboundEmailId || null,
    propertyId: context.propertyId || null,
    source: context.source || null,
    reservationAction: context.reservationAction || null,
    parseResult: context.parseResult || null
  });
}

function detectSource(subject, fromEmail, bodyText) {
  const joined = normalizeComparableText(`${subject || ''} ${fromEmail || ''} ${bodyText || ''}`);

  if (joined.includes('airbnb.com') || joined.includes('airbnb')) return 'airbnb';

  if (
    joined.includes('booking.com') ||
    joined.includes('reservation@booking') ||
    joined.includes('booking reservation')
  ) return 'booking';

  if (joined.includes('vrbo')) return 'vrbo';

  return 'manual';
}

function classifyReservationAction(subject, fromEmail, bodyText) {
  const joined = normalizeComparableText(`${subject || ''}\n${fromEmail || ''}\n${bodyText || ''}`);

  const cancelPatterns = [
    /reserva cancelada/i,
    /cancelamento/i,
    /cancelled/i,
    /cancellation/i,
    /booking cancelled/i,
    /reservation cancelled/i
  ];

  for (const pattern of cancelPatterns) {
    if (pattern.test(joined)) return 'cancelled';
  }

  const updatePatterns = [
    /reserva alterada/i,
    /reserva atualizada/i,
    /alteracao/i,
    /updated reservation/i,
    /reservation updated/i,
    /reservation changed/i,
    /booking modified/i,
    /modificada/i
  ];

  for (const pattern of updatePatterns) {
    if (pattern.test(joined)) return 'updated';
  }

  const createPatterns = [
    /nova reserva/i,
    /new reservation/i,
    /nova solicitacao/i,
    /reserva confirmada/i,
    /reservation confirmed/i,
    /confirmed booking/i,
    /confirmacao de reserva/i,
    /check-in/i,
    /check-out/i
  ];

  for (const pattern of createPatterns) {
    if (pattern.test(joined)) return 'created';
  }

  return 'unknown';
}

function extractUrls(text) {
  if (!text) return [];
  const matches = String(text).match(/https?:\/\/[^\s<>"')]+/gi);
  return matches ? [...new Set(matches)] : [];
}

function extractPossibleAirbnbRoomIds(text) {
  if (!text) return [];

  const matches = [];
  const normalized = normalizeParseText(text);
  const regexes = [
    /airbnb\.com\/rooms\/(\d+)/gi,
    /\broom\s*id[:\s#-]*(\d+)\b/gi,
    /\banuncio[:\s#-]*(\d+)\b/gi,
    /\blisting[:\s#-]*(\d+)\b/gi
  ];

  for (const regex of regexes) {
    let match;
    while ((match = regex.exec(normalized)) !== null) {
      matches.push(match[1]);
    }
  }

  return [...new Set(matches)];
}

function extractPossibleBookingCodes(text) {
  if (!text) return [];

  const matches = [];
  const regexes = [
    /booking\.com\/hotel\/[^/]+\/([^.\/?\s]+)/gi,
    /\bhotel_id[:\s#-]*([A-Z0-9_-]+)\b/gi,
    /\bbooking[:\s#-]*([A-Z0-9_-]{4,})\b/gi
  ];

  for (const regex of regexes) {
    let match;
    while ((match = regex.exec(text)) !== null) {
      matches.push(match[1]);
    }
  }

  return [...new Set(matches)];
}

function stripHtml(html) {
  if (!html) return '';

  return String(html)
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<\/(p|div|br|li|tr|h\d)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\r/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

function getNestedString(obj, paths = []) {
  for (const path of paths) {
    const parts = path.split('.');
    let current = obj;

    for (const part of parts) {
      if (current == null) {
        current = null;
        break;
      }
      current = current[part];
    }

    if (typeof current === 'string' && current.trim()) {
      return current;
    }
  }

  return null;
}

function daysBetween(dateA, dateB) {
  if (!dateA || !dateB) return 9999;

  const a = new Date(`${dateA}T00:00:00Z`);
  const b = new Date(`${dateB}T00:00:00Z`);

  return Math.round(Math.abs(a.getTime() - b.getTime()) / 86400000);
}

function scoreReservationMatch(reservation, payload) {
  let score = 0;

  const reservationGuest = normalizeComparableText(reservation.guest_name);
  const payloadGuest = normalizeComparableText(payload.guestName);

  if (payloadGuest && reservationGuest) {
    if (reservationGuest === payloadGuest) score += 100;
    else if (
      reservationGuest.includes(payloadGuest) ||
      payloadGuest.includes(reservationGuest)
    ) {
      score += 70;
    }
  }

  if (payload.startDate && reservation.start_date) {
    const diff = daysBetween(payload.startDate, reservation.start_date);
    if (diff === 0) score += 50;
    else if (diff <= 2) score += 35;
    else if (diff <= 7) score += 20;
  }

  if (payload.endDate && reservation.end_date) {
    const diff = daysBetween(payload.endDate, reservation.end_date);
    if (diff === 0) score += 50;
    else if (diff <= 2) score += 35;
    else if (diff <= 7) score += 20;
  }

  if (payload.guestEmail && reservation.guest_email) {
    if (normalizeEmail(payload.guestEmail) === normalizeEmail(reservation.guest_email)) {
      score += 80;
    }
  }

  if (payload.totalAmount != null && reservation.total_amount != null) {
    const diff = Math.abs(Number(payload.totalAmount) - Number(reservation.total_amount));
    if (diff === 0) score += 20;
    else if (diff <= 50) score += 10;
  }

  if (reservation.status && String(reservation.status).toLowerCase() === 'cancelled') {
    score -= 30;
  }

  return score;
}

function tokenizeText(value) {
  return normalizeComparableText(value)
    .split(/[^a-z0-9]+/g)
    .filter((token) => token && token.length >= 3);
}

function scoreTokenOverlap(sourceText, candidateText) {
  const sourceTokens = new Set(tokenizeText(sourceText));
  const candidateTokens = new Set(tokenizeText(candidateText));

  if (!sourceTokens.size || !candidateTokens.size) return 0;

  let overlap = 0;
  for (const token of candidateTokens) {
    if (sourceTokens.has(token)) overlap += 1;
  }

  return overlap;
}

function getDomainFromUrl(url) {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return '';
  }
}

function normalizeUrlForComparison(url) {
  try {
    const parsed = new URL(url);
    return `${parsed.hostname}${parsed.pathname}`.toLowerCase();
  } catch {
    return normalizeComparableText(url);
  }
}

function buildPropertyMatchResult(listing, score, reasons) {
  return {
    listing,
    score,
    reasons: [...new Set(reasons)].filter(Boolean)
  };
}

async function findUserByAliasOrId(toEmail, extractedUserId) {
  if (!toEmail && !extractedUserId) return null;

  if (toEmail) {
    const [rows] = await pool.query(
      `
      SELECT id, name, email, inbound_alias
      FROM users
      WHERE inbound_alias = ?
      LIMIT 1
      `,
      [toEmail]
    );

    if (rows.length > 0) return rows[0];
  }

  if (extractedUserId) {
    const [rows] = await pool.query(
      `
      SELECT id, name, email, inbound_alias
      FROM users
      WHERE id = ?
      LIMIT 1
      `,
      [extractedUserId]
    );

    if (rows.length > 0) return rows[0];
  }

  return null;
}

async function findPropertiesForUser(userId) {
  const [rows] = await pool.query(
    `
    SELECT
      p.id,
      p.user_id,
      p.name,
      p.city,
      p.state,
      p.country
    FROM properties p
    WHERE p.user_id = ?
    ORDER BY p.id ASC
    `,
    [userId]
  );

  return rows;
}

async function findPropertyByListingData(userId, source, fullText) {
  const [listings] = await pool.query(
    `
    SELECT
      pl.id,
      pl.property_id,
      pl.platform,
      pl.listing_url,
      pl.listing_code,
      p.name AS property_name,
      p.city,
      p.state,
      p.country,
      p.user_id
    FROM property_listings pl
    JOIN properties p ON p.id = pl.property_id
    WHERE p.user_id = ?
      AND pl.is_active = 1
    ORDER BY pl.id ASC
    `,
    [userId]
  );

  if (!listings.length) {
    return null;
  }

  const fullTextNormalized = normalizeComparableText(fullText);
  const urlsInEmail = extractUrls(fullText).map((item) => item.toLowerCase());
  const normalizedUrlsInEmail = urlsInEmail.map(normalizeUrlForComparison);
  const airbnbIds = extractPossibleAirbnbRoomIds(fullText);
  const bookingCodes = extractPossibleBookingCodes(fullText).map((item) => item.toLowerCase());

  const candidates = [];

  for (const listing of listings) {
    let score = 0;
    const reasons = [];

    const listingUrl = normalizeText(listing.listing_url);
    const listingUrlLower = listingUrl.toLowerCase();
    const listingUrlNormalized = normalizeUrlForComparison(listingUrlLower);
    const listingCode = listing.listing_code ? String(listing.listing_code).toLowerCase() : '';
    const propertyName = normalizeComparableText(listing.property_name);
    const platform = normalizeComparableText(listing.platform);
    const city = normalizeComparableText(listing.city);
    const state = normalizeComparableText(listing.state);
    const country = normalizeComparableText(listing.country);
    const listingDomain = getDomainFromUrl(listingUrl);

    if (source && source !== 'manual' && platform === source) {
      score += 15;
      reasons.push(`plataforma compatível (${platform})`);
    }

    if (listingUrlLower && fullText.toLowerCase().includes(listingUrlLower)) {
      score += 140;
      reasons.push('listing_url completa encontrada no e-mail');
    }

    if (listingUrlNormalized) {
      for (const normalizedEmailUrl of normalizedUrlsInEmail) {
        if (!normalizedEmailUrl) continue;

        if (normalizedEmailUrl === listingUrlNormalized) {
          score += 130;
          reasons.push('URL do anúncio bate exatamente');
        } else if (
          normalizedEmailUrl.includes(listingUrlNormalized) ||
          listingUrlNormalized.includes(normalizedEmailUrl)
        ) {
          score += 90;
          reasons.push('URL do anúncio parecida');
        }
      }
    }

    if (listingDomain && urlsInEmail.some((url) => getDomainFromUrl(url) === listingDomain)) {
      score += 10;
      reasons.push(`domínio compatível (${listingDomain})`);
    }

    if (listingCode) {
      if (fullTextNormalized.includes(listingCode)) {
        score += 120;
        reasons.push('listing_code encontrado no texto');
      }

      if (platform === 'airbnb' && airbnbIds.includes(String(listing.listing_code))) {
        score += 130;
        reasons.push('room id Airbnb compatível');
      }

      if (platform === 'booking' && bookingCodes.includes(listingCode)) {
        score += 130;
        reasons.push('código Booking compatível');
      }
    }

    if (propertyName) {
      if (fullTextNormalized.includes(propertyName)) {
        score += 90;
        reasons.push('nome exato do imóvel encontrado');
      } else {
        const overlap = scoreTokenOverlap(fullText, listing.property_name);
        if (overlap >= 3) {
          score += 60;
          reasons.push(`nome do imóvel com ${overlap} tokens em comum`);
        } else if (overlap === 2) {
          score += 35;
          reasons.push('nome do imóvel parcialmente compatível');
        }
      }
    }

    if (city && fullTextNormalized.includes(city)) {
      score += 12;
      reasons.push(`cidade compatível (${listing.city})`);
    }

    if (state && fullTextNormalized.includes(state)) {
      score += 8;
      reasons.push(`estado compatível (${listing.state})`);
    }

    if (country && fullTextNormalized.includes(country)) {
      score += 5;
      reasons.push(`país compatível (${listing.country})`);
    }

    if (score > 0) {
      candidates.push(buildPropertyMatchResult(listing, score, reasons));
    }
  }

  if (!candidates.length) {
    return null;
  }

  candidates.sort((a, b) => b.score - a.score);

  logger.info('Candidatos de match de imóvel calculados', {
    service: 'inbound',
    scope: 'property_match',
    userId,
    source,
    candidates: candidates.slice(0, 5).map((item) => ({
      propertyId: item.listing.property_id,
      propertyName: item.listing.property_name,
      platform: item.listing.platform,
      score: item.score,
      reasons: item.reasons
    }))
  });

  const best = candidates[0];
  const second = candidates[1] || null;

  if (best.score < 60) {
    return null;
  }

  if (second && best.score - second.score < 15) {
    logger.warn('Match de imóvel ambíguo; diferença de score muito pequena', {
      service: 'inbound',
      scope: 'property_match',
      userId,
      source,
      best: {
        propertyId: best.listing.property_id,
        propertyName: best.listing.property_name,
        score: best.score
      },
      second: {
        propertyId: second.listing.property_id,
        propertyName: second.listing.property_name,
        score: second.score
      }
    });

    return null;
  }

  return {
    ...best.listing,
    match_score: best.score,
    match_reasons: best.reasons
  };
}

async function findExistingReservationForAction(connection, propertyId, payload) {
  const [rows] = await connection.query(
    `
    SELECT
      id,
      property_id,
      guest_name,
      guest_email,
      guest_phone,
      start_date,
      end_date,
      status,
      external_id,
      total_amount,
      notes
    FROM reservations
    WHERE property_id = ?
    ORDER BY id DESC
    LIMIT 50
    `,
    [propertyId]
  );

  if (!rows.length) return null;

  const scored = rows
    .map((reservation) => ({
      reservation,
      score: scoreReservationMatch(reservation, payload)
    }))
    .sort((a, b) => b.score - a.score);

  logger.info('Candidatas para reconciliação', {
    service: 'inbound',
    scope: 'reservation_match',
    propertyId,
    candidates: scored.slice(0, 5).map((item) => ({
      id: item.reservation.id,
      guest_name: item.reservation.guest_name,
      start_date: item.reservation.start_date,
      end_date: item.reservation.end_date,
      status: item.reservation.status,
      total_amount: item.reservation.total_amount,
      score: item.score
    }))
  });

  if (!scored.length || scored[0].score < 70) {
    return null;
  }

  return scored[0].reservation;
}

async function tryUpdateFinancialEntryForReservation(connection, reservationId, data) {
  try {
    const fields = [];
    const params = [];

    if (data.amount != null) {
      fields.push('amount = ?');
      params.push(data.amount);
    }

    if (data.entry_date) {
      fields.push('entry_date = ?');
      params.push(data.entry_date);
    }

    if (data.description) {
      fields.push('description = ?');
      params.push(data.description);
    }

    if (data.status) {
      fields.push('status = ?');
      params.push(data.status);
    }

    if (!fields.length) return;

    params.push(reservationId);

    await connection.query(
      `
      UPDATE financial_entries
      SET ${fields.join(', ')}
      WHERE reservation_id = ?
      `,
      params
    );
  } catch (error) {
    logger.warn('Não foi possível atualizar financial_entries automaticamente', {
      service: 'inbound',
      reservationId,
      error
    });
  }
}

function getResendApiKey() {
  return (
    process.env.RESEND_API_KEY ||
    process.env.RESEND_KEY ||
    process.env.RESEND_SECRET ||
    null
  );
}

async function fetchJsonWithTimeout(url, options = {}, timeoutMs = 15000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {})
      }
    });

    const rawText = await response.text();
    let parsed;

    try {
      parsed = rawText ? JSON.parse(rawText) : null;
    } catch {
      parsed = { raw: rawText };
    }

    return {
      ok: response.ok,
      status: response.status,
      statusText: response.statusText,
      data: parsed
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchReceivedEmailFromResend(emailId) {
  const apiKey = getResendApiKey();

  if (!apiKey) {
    throw new Error('RESEND_API_KEY não configurada no ambiente');
  }

  if (!emailId) {
    throw new Error('email_id não informado para consulta na API do Resend');
  }

  const url = `https://api.resend.com/emails/receiving/${encodeURIComponent(emailId)}`;

  const result = await fetchJsonWithTimeout(
    url,
    {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${apiKey}`
      }
    },
    20000
  );

  if (!result.ok) {
    throw new Error(
      `Falha ao buscar e-mail no Resend. Status ${result.status}: ${
        result.data?.message || result.data?.error || result.statusText
      }`
    );
  }

  return result.data;
}

async function fetchReceivedEmailAttachmentsFromResend(emailId) {
  const apiKey = getResendApiKey();

  if (!apiKey || !emailId) return [];

  const url = `https://api.resend.com/emails/receiving/${encodeURIComponent(emailId)}/attachments`;

  try {
    const result = await fetchJsonWithTimeout(
      url,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${apiKey}`
        }
      },
      20000
    );

    if (!result.ok) return [];

    if (Array.isArray(result.data?.data)) return result.data.data;
    if (Array.isArray(result.data?.attachments)) return result.data.attachments;
    if (Array.isArray(result.data)) return result.data;

    return [];
  } catch {
    return [];
  }
}

function extractBodiesFromFetchedEmail(fetched) {
  const bodyText =
    getNestedString(fetched, [
      'text',
      'body_text',
      'plain',
      'content.text',
      'content.plain',
      'email.text',
      'email.body_text',
      'data.text',
      'data.body_text'
    ]) || '';

  const bodyHtml =
    getNestedString(fetched, [
      'html',
      'body_html',
      'content.html',
      'email.html',
      'email.body_html',
      'data.html',
      'data.body_html'
    ]) || null;

  const synthesizedTextFromHtml = !bodyText && bodyHtml ? stripHtml(bodyHtml) : '';

  return {
    bodyText: bodyText || synthesizedTextFromHtml || '',
    bodyHtml: bodyHtml || null
  };
}

function mergeWebhookAndFetchedEmail(eventData, fetchedEmail, attachmentsFromApi) {
  const fetched = fetchedEmail?.data || fetchedEmail || {};
  const extractedBodies = extractBodiesFromFetchedEmail(fetched);

  const mergedAttachments = Array.isArray(attachmentsFromApi) && attachmentsFromApi.length > 0
    ? attachmentsFromApi
    : Array.isArray(fetched.attachments) && fetched.attachments.length > 0
      ? fetched.attachments
      : Array.isArray(eventData.attachments)
        ? eventData.attachments
        : [];

  const mergedHeaders =
    fetched.headers ||
    fetched.email?.headers ||
    fetched.data?.headers ||
    eventData.headers ||
    null;

  const toValue =
    fetched.to ||
    fetched.email?.to ||
    fetched.data?.to ||
    eventData.to;

  const fromValue =
    fetched.from ||
    fetched.email?.from ||
    fetched.data?.from ||
    eventData.from;

  const subjectValue =
    fetched.subject ||
    fetched.email?.subject ||
    fetched.data?.subject ||
    eventData.subject ||
    null;

  return {
    emailId:
      fetched.id ||
      fetched.email_id ||
      fetched.email?.id ||
      fetched.data?.id ||
      eventData.email_id ||
      eventData.id ||
      null,
    toEmail: firstEmail(toValue),
    fromEmail: normalizeEmail(fromValue),
    subject: subjectValue,
    bodyText:
      extractedBodies.bodyText ||
      eventData.text ||
      eventData.body_text ||
      '',
    bodyHtml:
      extractedBodies.bodyHtml ||
      eventData.html ||
      eventData.body_html ||
      null,
    attachments: mergedAttachments,
    headers: mergedHeaders,
    rawFetched: fetched
  };
}

function makeFallbackInboundEmailId(emailData) {
  const base = emailData.emailId || `${emailData.toEmail || ''}|${emailData.fromEmail || ''}|${emailData.subject || ''}`;
  return `inbound_${crypto.createHash('sha1').update(base).digest('hex').slice(0, 16)}`;
}

async function processInboundResendWebhook(event) {
  let connection;

  const eventType = event?.type || 'unknown';
  const data = event?.data || {};

  if (eventType !== 'email.received') {
    return {
      success: true,
      ignored: true,
      message: 'Evento ignorado'
    };
  }

  const webhookEmailId = data.email_id || data.id || null;

  let fetchedEmail = null;
  let fetchedAttachments = [];
  let fetchErrorMessage = null;

  if (webhookEmailId) {
    try {
      fetchedEmail = await fetchReceivedEmailFromResend(webhookEmailId);
      fetchedAttachments = await fetchReceivedEmailAttachmentsFromResend(webhookEmailId);
    } catch (error) {
      fetchErrorMessage = error.message;
      logger.warn('Falha ao obter conteúdo completo do Resend, seguindo com webhook', {
        service: 'inbound',
        webhookEmailId,
        error
      });
    }
  } else {
    fetchErrorMessage = 'Webhook não trouxe email_id';
  }

  const emailData = mergeWebhookAndFetchedEmail(data, fetchedEmail, fetchedAttachments);
  const {
    emailId,
    toEmail,
    fromEmail,
    subject,
    bodyText,
    bodyHtml,
    attachments,
    headers,
    rawFetched
  } = emailData;
  const inboundFingerprint = buildInboundFingerprint(emailData);
  const inboundEmailExternalId = emailId || makeFallbackInboundEmailId(emailData);

  const extractedUserId = extractAliasUserId(toEmail);
  const user = await findUserByAliasOrId(toEmail, extractedUserId);

  if (!user) {
    logger.warn('Usuário não encontrado para alias inbound', {
      service: 'inbound',
      toEmail
    });

    return {
      success: true,
      ignored: true,
      message: 'Usuário não encontrado para este alias'
    };
  }

  const rawFullText = `${subject || ''}\n${bodyText || ''}\n${bodyHtml || ''}`;
  const fullText = cleanEmailText(rawFullText);
  const parseResult = parseInboundReservation({
    subject,
    bodyText,
    bodyHtml,
    fromEmail
  });
  const source = parseResult.source === 'unknown' ? 'manual' : parseResult.source;
  const reservationAction = parseResult.workflowAction || 'unknown';
  const propertyMatch = await findBestPropertyMatch(pool, user.id, parseResult, logger);
  const matchedListing = propertyMatch.matched;

  connection = await pool.getConnection();
  await connection.beginTransaction();

  try {
    const existingInbound = await findExistingInboundEmail(connection, {
      provider: 'resend',
      emailId: inboundEmailExternalId,
      fingerprint: inboundFingerprint
    });

    if (existingInbound) {
      await connection.commit();

      logger.info('Inbound duplicado ignorado por idempotência', {
        service: 'inbound',
        inboundEmailId: existingInbound.id,
        emailId: inboundEmailExternalId,
        fingerprint: inboundFingerprint
      });

      return {
        success: true,
        ignored: true,
        duplicate: true,
        inbound_email_id: existingInbound.id,
        reservation_id: existingInbound.created_reservation_id || null,
        property_id: existingInbound.property_id || null,
        message: 'Inbound duplicado ignorado por idempotência'
      };
    }

    const parsingNotesBase = [];

    if (matchedListing) {
      parsingNotesBase.push(
        `Imóvel identificado automaticamente via property_listings (${matchedListing.property_name})`
      );
      if (matchedListing.match_score != null) {
        parsingNotesBase.push(`Score do match: ${matchedListing.match_score}`);
      }
      if (Array.isArray(matchedListing.match_reasons) && matchedListing.match_reasons.length) {
        parsingNotesBase.push(`Motivos: ${matchedListing.match_reasons.join(', ')}`);
      }
    } else {
      parsingNotesBase.push('Inbound recebido com sucesso');
    }

    parsingNotesBase.push(`Plataforma detectada: ${parseResult.platform}`);
    parsingNotesBase.push(`Ação detectada: ${parseResult.action}`);
    parsingNotesBase.push(`Ação do workflow: ${reservationAction}`);
    parsingNotesBase.push(`Confianca do parse: ${parseResult.confidence}`);
    parsingNotesBase.push(`Fingerprint: ${inboundFingerprint}`);

    if (propertyMatch.decision) {
      parsingNotesBase.push(`Decisão do imóvel: ${propertyMatch.decision.status}:${propertyMatch.decision.reason}`);
    }

    if (parseResult.missingFields.length) {
      parsingNotesBase.push(`Campos ausentes: ${parseResult.missingFields.join(', ')}`);
    }

    if (parseResult.notes.length) {
      parsingNotesBase.push(`Notas do parse: ${parseResult.notes.join(', ')}`);
    }

    if (fetchedEmail) {
      parsingNotesBase.push('Conteúdo completo recuperado via API do Resend');
    } else if (fetchErrorMessage) {
      parsingNotesBase.push(`Fallback para webhook: ${fetchErrorMessage}`);
    }

    let inboundInsert;

    try {
      [inboundInsert] = await connection.query(
        `
        INSERT INTO inbound_emails (
          user_id,
          property_id,
          provider,
          event_type,
          email_id,
          fingerprint,
          to_email,
          from_email,
          subject,
          body_text,
          body_html,
          attachments_json,
          headers_json,
          raw_payload,
          parsing_status,
          parsing_notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          user.id,
          matchedListing ? matchedListing.property_id : null,
          'resend',
          eventType,
          inboundEmailExternalId,
          inboundFingerprint,
          toEmail,
          fromEmail,
          subject,
          bodyText || null,
          bodyHtml || null,
          JSON.stringify(Array.isArray(attachments) ? attachments : []),
          headers ? JSON.stringify(headers) : null,
          JSON.stringify({
            webhook_event: event,
            resend_email: rawFetched || null,
            resend_fetch_failed: fetchErrorMessage || null,
            detected_source: source,
            detected_platform: parseResult.platform,
            detected_action: parseResult.action,
            workflow_action: reservationAction,
            fingerprint: inboundFingerprint,
            parse_result: {
              ...parseResult,
              normalized: undefined
            },
            property_match: matchedListing
              ? {
                  property_id: matchedListing.property_id,
                  property_name: matchedListing.property_name,
                  score: matchedListing.match_score || null,
                  reasons: matchedListing.match_reasons || []
                }
              : null,
            property_match_decision: propertyMatch.decision || null,
            property_match_candidates: propertyMatch.candidates
              ? propertyMatch.candidates.slice(0, 5).map((candidate) => ({
                  property_id: candidate.listing.property_id,
                  property_name: candidate.listing.property_name,
                  score: candidate.score,
                  reasons: candidate.reasons
                }))
              : []
          }),
          'pending',
          parsingNotesBase.join(' | ')
        ]
      );
    } catch (error) {
      if (!isDuplicateInboundError(error)) {
        throw error;
      }

      const duplicatedInbound = await findExistingInboundEmail(connection, {
        provider: 'resend',
        emailId: inboundEmailExternalId,
        fingerprint: inboundFingerprint
      });

      await connection.commit();

      return {
        success: true,
        ignored: true,
        duplicate: true,
        inbound_email_id: duplicatedInbound?.id || null,
        reservation_id: duplicatedInbound?.created_reservation_id || null,
        property_id: duplicatedInbound?.property_id || null,
        message: 'Inbound duplicado ignorado por idempotência'
      };
    }

    const inboundEmailId = inboundInsert.insertId;

    const {
      startDate,
      endDate,
      totalAmount,
      guestName,
      guestEmail,
      guestPhone
    } = parseResult;

    let propertyId = matchedListing ? matchedListing.property_id : null;
    let propertyName = matchedListing ? matchedListing.property_name : null;

    if (!propertyId) {
      const userProperties = await findPropertiesForUser(user.id);

      if (userProperties.length === 1) {
        propertyId = userProperties[0].id;
        propertyName = userProperties[0].name;

        await connection.query(
          `
          UPDATE inbound_emails
          SET
            property_id = ?,
            parsing_notes = CONCAT(
              COALESCE(parsing_notes, ''),
              ' | Fallback aplicado: único imóvel do usuário selecionado automaticamente'
            )
          WHERE id = ?
          `,
          [propertyId, inboundEmailId]
        );
      }
    }

    if (!propertyId) {
      const diagnostic = buildParseDiagnostic(parseResult, ['missing_property_match']);

      await connection.query(
        `
        UPDATE inbound_emails
        SET
          parsing_status = 'ignored',
          parsing_notes = CONCAT(
            COALESCE(parsing_notes, ''),
            ?
          )
        WHERE id = ?
        `,
        [
          ` | Não foi possível identificar automaticamente o imóvel deste inbound${diagnostic}`,
          inboundEmailId
        ]
      );

      logInboundParseIssue('missing_property_match', {
        inboundEmailId,
        source,
        reservationAction,
        parseResult
      });

      await connection.commit();

      return {
        success: true,
        inbound_email_id: inboundEmailId,
        created_reservation: false,
        reservation_action: reservationAction,
        message: 'Inbound salvo, mas sem imóvel identificado automaticamente'
      };
    }

    if (reservationAction === 'updated' || reservationAction === 'cancelled') {
      const reservationMatch = await findBestReservationMatch(connection, propertyId, {
        guestName,
        guestEmail,
        startDate,
        endDate,
        totalAmount
      }, logger);
      const existingReservation = reservationMatch.matched;

      if (!existingReservation) {
        const diagnostic = buildParseDiagnostic(parseResult, ['no_matching_reservation']);

        await connection.query(
          `
          UPDATE inbound_emails
          SET
            property_id = ?,
            parsing_status = 'ignored',
            parsing_notes = CONCAT(
              COALESCE(parsing_notes, ''),
              ?
            )
          WHERE id = ?
          `,
          [
            propertyId,
            ` | Nenhuma reserva compatível foi encontrada para aplicar ação automática | Decisão da reconciliação: ${reservationMatch.decision.status}:${reservationMatch.decision.reason}${diagnostic}`,
            inboundEmailId
          ]
        );

        logInboundParseIssue('no_matching_reservation', {
          inboundEmailId,
          propertyId,
          source,
          reservationAction,
          parseResult
        });

        await connection.commit();

        return {
          success: true,
          inbound_email_id: inboundEmailId,
          created_reservation: false,
          reservation_action: reservationAction,
          property_id: propertyId,
          message: 'Nenhuma reserva compatível foi encontrada para reconciliação automática'
        };
      }

      const newStatus = reservationAction === 'cancelled' ? 'cancelled' : 'confirmed';

      await connection.query(
        `
        UPDATE reservations
        SET
          guest_name = ?,
          guest_email = ?,
          guest_phone = ?,
          start_date = ?,
          end_date = ?,
          total_amount = ?,
          notes = CONCAT(COALESCE(notes, ''), ?),
          status = ?
        WHERE id = ?
        `,
        [
          guestName || existingReservation.guest_name,
          guestEmail || existingReservation.guest_email,
          guestPhone || existingReservation.guest_phone,
          startDate || existingReservation.start_date,
          endDate || existingReservation.end_date,
          totalAmount != null ? totalAmount : existingReservation.total_amount,
          ` | Atualizado automaticamente via inbound (${fromEmail || 'sem remetente'})`,
          newStatus,
          existingReservation.id
        ]
      );

      await tryUpdateFinancialEntryForReservation(connection, existingReservation.id, {
        amount: totalAmount != null ? totalAmount : null,
        entry_date: startDate || null,
        description: `Receita atualizada automaticamente da reserva #${existingReservation.id} - ${propertyName || 'Imóvel'}`,
        status: reservationAction === 'cancelled' ? 'pending' : 'paid'
      });

      await connection.query(
        `
        UPDATE inbound_emails
        SET
          property_id = ?,
          created_reservation_id = ?,
          parsing_status = 'processed',
          parsing_notes = CONCAT(
            COALESCE(parsing_notes, ''),
            ?
          )
        WHERE id = ?
        `,
        [
          propertyId,
          existingReservation.id,
          reservationAction === 'cancelled'
            ? ' | Reserva existente cancelada automaticamente'
            : ' | Reserva existente atualizada automaticamente',
          inboundEmailId
        ]
      );

      await connection.commit();

      return {
        success: true,
        inbound_email_id: inboundEmailId,
        created_reservation: false,
        reservation_action: reservationAction,
        reservation_id: existingReservation.id,
        property_id: propertyId,
        message:
          reservationAction === 'cancelled'
            ? 'Reserva existente cancelada automaticamente'
            : 'Reserva existente atualizada automaticamente'
      };
    }

    if (reservationAction !== 'created') {
      const diagnostic = buildParseDiagnostic(parseResult, ['unsupported_or_unknown_action']);

      await connection.query(
        `
        UPDATE inbound_emails
        SET
          property_id = ?,
          parsing_status = 'ignored',
          parsing_notes = CONCAT(
            COALESCE(parsing_notes, ''),
            ?
          )
        WHERE id = ?
        `,
        [
          propertyId,
          ` | Tipo de inbound não reconhecido com segurança para criação automática${diagnostic}`,
          inboundEmailId
        ]
      );

      logInboundParseIssue('unsupported_or_unknown_action', {
        inboundEmailId,
        propertyId,
        source,
        reservationAction,
        parseResult
      });

      await connection.commit();

      return {
        success: true,
        inbound_email_id: inboundEmailId,
        created_reservation: false,
        reservation_action: reservationAction,
        property_id: propertyId,
        message: 'Inbound salvo, mas sem segurança suficiente para criar reserva automaticamente'
      };
    }

    if (!startDate || !endDate) {
      const missingDateDetails = [];
      if (!startDate) missingDateDetails.push('missing_start_date');
      if (!endDate) missingDateDetails.push('missing_end_date');

      const diagnostic = buildParseDiagnostic(parseResult, missingDateDetails);

      await connection.query(
        `
        UPDATE inbound_emails
        SET
          property_id = ?,
          parsing_status = 'ignored',
          parsing_notes = CONCAT(
            COALESCE(parsing_notes, ''),
            ?
          )
        WHERE id = ?
        `,
        [
          propertyId,
          ` | Imóvel identificado, mas não foi possível reconhecer check-in e check-out${diagnostic}`,
          inboundEmailId
        ]
      );

      logInboundParseIssue('missing_reservation_dates', {
        inboundEmailId,
        propertyId,
        source,
        reservationAction,
        parseResult
      });

      await connection.commit();

      return {
        success: true,
        inbound_email_id: inboundEmailId,
        created_reservation: false,
        reservation_action: reservationAction,
        message: 'Inbound salvo, imóvel identificado, mas datas não reconhecidas'
      };
    }

    const externalId = inboundEmailExternalId || `inbound_${inboundEmailId}`;

    const [existingReservations] = await connection.query(
      `
      SELECT id
      FROM reservations
      WHERE property_id = ?
        AND external_id = ?
      LIMIT 1
      `,
      [propertyId, externalId]
    );

    if (existingReservations.length > 0) {
      await connection.query(
        `
        UPDATE inbound_emails
        SET
          property_id = ?,
          created_reservation_id = ?,
          parsing_status = 'processed',
          parsing_notes = CONCAT(
            COALESCE(parsing_notes, ''),
            ' | Reserva já existia para este inbound'
          )
        WHERE id = ?
        `,
        [propertyId, existingReservations[0].id, inboundEmailId]
      );

      await connection.commit();

      return {
        success: true,
        inbound_email_id: inboundEmailId,
        created_reservation: false,
        reservation_action: reservationAction,
        reservation_id: existingReservations[0].id,
        message: 'Reserva já existente para este inbound'
      };
    }

    const [reservationInsert] = await connection.query(
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
        guestName || 'Hóspede inbound',
        source === 'vrbo' ? 'manual' : source,
        startDate,
        endDate,
        externalId,
        `Reserva criada automaticamente via inbound (${fromEmail || 'sem remetente'})`,
        guestEmail || null,
        guestPhone || null,
        totalAmount
      ]
    );

    const reservationId = reservationInsert.insertId;

    if (totalAmount !== null && totalAmount > 0) {
      await connection.query(
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
        ) VALUES (?, ?, ?, 'income', 'reserva', ?, ?, ?, 'paid', 'inbound_email')
        `,
        [
          user.id,
          propertyId,
          reservationId,
          `Receita automática da reserva #${reservationId} - ${propertyName || 'Imóvel'}`,
          totalAmount,
          startDate
        ]
      );
    }

    await connection.query(
      `
      UPDATE inbound_emails
      SET
        property_id = ?,
        created_reservation_id = ?,
        parsing_status = 'processed',
        parsing_notes = CONCAT(
          COALESCE(parsing_notes, ''),
          ' | Reserva criada automaticamente com sucesso'
        )
      WHERE id = ?
      `,
      [propertyId, reservationId, inboundEmailId]
    );

    await connection.commit();

    return {
      success: true,
      inbound_email_id: inboundEmailId,
      created_reservation: true,
      reservation_action: reservationAction,
      reservation_id: reservationId,
      property_id: propertyId,
      fetched_from_resend_api: !!fetchedEmail,
      used_webhook_fallback: !fetchedEmail
    };
  } catch (error) {
    await connection.rollback();

    logger.error('Erro ao processar inbound do Resend', {
      service: 'inbound',
      error
    });

    throw error;
  } finally {
    if (connection) {
      connection.release();
    }
  }
}

module.exports = {
  processInboundResendWebhook
};

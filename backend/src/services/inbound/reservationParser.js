const {
  buildNormalizedInboundText,
  normalizeComparable,
  normalizeText,
  normalizeWhitespace
} = require('./textTools');

function normalizeEmail(value) {
  if (!value) return null;
  return String(value).trim().toLowerCase();
}

function monthNameToNumber(value) {
  const normalized = normalizeComparable(value);
  const months = {
    january: 1,
    jan: 1,
    janeiro: 1,
    fevereiro: 2,
    february: 2,
    fev: 2,
    feb: 2,
    marco: 3,
    march: 3,
    mar: 3,
    abril: 4,
    april: 4,
    abr: 4,
    apr: 4,
    maio: 5,
    may: 5,
    junho: 6,
    june: 6,
    jun: 6,
    julho: 7,
    july: 7,
    jul: 7,
    agosto: 8,
    august: 8,
    ago: 8,
    aug: 8,
    setembro: 9,
    september: 9,
    set: 9,
    sep: 9,
    outubro: 10,
    october: 10,
    out: 10,
    oct: 10,
    novembro: 11,
    november: 11,
    nov: 11,
    dezembro: 12,
    december: 12,
    dez: 12,
    dec: 12
  };

  return months[normalized] || null;
}

function parseDateToYmd(value) {
  if (!value) return null;
  const text = normalizeWhitespace(value);

  const iso = text.match(/\b(20\d{2})-(\d{1,2})-(\d{1,2})\b/);
  if (iso) return `${iso[1]}-${String(iso[2]).padStart(2, '0')}-${String(iso[3]).padStart(2, '0')}`;

  const br = text.match(/\b(\d{1,2})\/(\d{1,2})\/(20\d{2})\b/);
  if (br) return `${br[3]}-${String(br[2]).padStart(2, '0')}-${String(br[1]).padStart(2, '0')}`;

  const us = text.match(/\b(\d{1,2})\/(\d{1,2})\/(20\d{2})\b/);
  if (us) return `${us[3]}-${String(us[1]).padStart(2, '0')}-${String(us[2]).padStart(2, '0')}`;

  const long = text.match(/\b(\d{1,2})\s+(?:de\s+)?([a-z]+)\s+(?:de\s+)?(20\d{2})\b/i);
  if (long) {
    const month = monthNameToNumber(long[2]);
    if (month) return `${long[3]}-${String(month).padStart(2, '0')}-${String(long[1]).padStart(2, '0')}`;
  }

  const longEn = text.match(/\b([a-z]+)\s+(\d{1,2}),?\s+(20\d{2})\b/i);
  if (longEn) {
    const month = monthNameToNumber(longEn[1]);
    if (month) return `${longEn[3]}-${String(month).padStart(2, '0')}-${String(longEn[2]).padStart(2, '0')}`;
  }

  return null;
}

function extractDates(text) {
  const source = normalizeWhitespace(text, { preserveLines: true });
  const regexes = [
    /\b20\d{2}-\d{1,2}-\d{1,2}\b/g,
    /\b\d{1,2}\/\d{1,2}\/20\d{2}\b/g,
    /\b\d{1,2}\s+(?:de\s+)?[a-z]+\s+(?:de\s+)?20\d{2}\b/gi,
    /\b[a-z]+\s+\d{1,2},?\s+20\d{2}\b/gi
  ];
  const found = [];

  for (const regex of regexes) {
    let match;
    while ((match = regex.exec(source)) !== null) {
      const value = parseDateToYmd(match[0]);
      if (value) found.push({ value, index: match.index, raw: match[0] });
    }
  }

  const seen = new Set();
  return found
    .sort((a, b) => a.index - b.index)
    .filter((item) => {
      if (seen.has(item.value)) return false;
      seen.add(item.value);
      return true;
    });
}

function extractDateNearLabels(text, labels) {
  const source = normalizeWhitespace(text, { preserveLines: true });
  const datePattern = '(20\\d{2}-\\d{1,2}-\\d{1,2}|\\d{1,2}\\/\\d{1,2}\\/20\\d{2}|\\d{1,2}\\s+(?:de\\s+)?[a-z]+\\s+(?:de\\s+)?20\\d{2}|[a-z]+\\s+\\d{1,2},?\\s+20\\d{2})';

  for (const label of labels) {
    const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const after = new RegExp(`${escaped}[^\\n\\r\\dA-Za-z]{0,80}${datePattern}`, 'i');
    const afterMatch = source.match(after);
    if (afterMatch) return parseDateToYmd(afterMatch[1]);

    const before = new RegExp(`${datePattern}[^\\n\\r]{0,80}${escaped}`, 'i');
    const beforeMatch = source.match(before);
    if (beforeMatch) return parseDateToYmd(beforeMatch[1]);
  }

  return null;
}

function extractFirstByLabels(text, labels) {
  const source = normalizeWhitespace(text, { preserveLines: true });

  for (const label of labels) {
    const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`${escaped}[:\\s-]+([^\\n\\r|•]+)`, 'i');
    const match = source.match(regex);
    if (match?.[1]) {
      const value = match[1].replace(/\s{2,}/g, ' ').trim();
      if (value) return value.slice(0, 150);
    }
  }

  return null;
}

function extractEmails(text) {
  const matches = normalizeWhitespace(text).match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi);
  return matches ? [...new Set(matches.map((item) => item.toLowerCase()))] : [];
}

function extractPhones(text) {
  const source = normalizeWhitespace(text);
  const patterns = [
    /(?:telefone|phone|celular|whatsapp|fone|mobile)[:\s-]+(\+?\d[\d\s().-]{7,}\d)/gi,
    /\b(\+55\s?\(?\d{2}\)?\s?\d{4,5}-?\d{4})\b/g,
    /\b(\+?\d{1,3}\s?\(?\d{2,4}\)?\s?\d{3,5}[-.\s]?\d{4})\b/g
  ];
  const phones = [];

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(source)) !== null) {
      const candidate = normalizeText(match[1]);
      const digits = candidate.replace(/\D/g, '');
      if (digits.length >= 8 && !/^\d{8}$/.test(digits)) phones.push(candidate);
    }
  }

  return [...new Set(phones)];
}

function parseAmount(text) {
  const source = normalizeWhitespace(text);
  const patterns = [
    /(?:R\$|BRL)\s*([\d.]+,\d{2})/i,
    /(?:US\$|\$|USD)\s*([\d,.]+)/i,
    /(?:total payout|payout|reservation total|total price|total|valor total|valor)[:\s-]*(?:R\$|BRL|US\$|\$|USD)?\s*([\d.,]+)/i
  ];

  for (const pattern of patterns) {
    const match = source.match(pattern);
    if (!match?.[1]) continue;

    const raw = match[1].trim();
    const normalized = raw.includes(',') && raw.includes('.')
      ? raw.replace(/\./g, '').replace(',', '.')
      : raw.includes(',') && !raw.includes('.')
        ? raw.replace(',', '.')
        : raw;
    const value = Number(normalized.replace(/,/g, ''));
    if (!Number.isNaN(value)) return value;
  }

  return null;
}

function classifyPlatform({ subject, fromEmail, text }) {
  const source = normalizeComparable(`${subject || ''} ${fromEmail || ''} ${text || ''}`);
  const scores = [
    { platform: 'airbnb', score: 0, reasons: [] },
    { platform: 'booking', score: 0, reasons: [] }
  ];

  const airbnb = scores[0];
  const booking = scores[1];

  if (source.includes('airbnb')) {
    airbnb.score += 80;
    airbnb.reasons.push('airbnb_keyword');
  }
  if (source.includes('airbnb.com')) {
    airbnb.score += 80;
    airbnb.reasons.push('airbnb_domain');
  }
  if (source.includes('reservation confirmed') || source.includes('host payout')) {
    airbnb.score += 15;
    airbnb.reasons.push('airbnb_layout_hint');
  }

  if (source.includes('booking.com') || source.includes('booking')) {
    booking.score += 80;
    booking.reasons.push('booking_keyword');
  }
  if (source.includes('reservation@booking') || source.includes('guest has booked')) {
    booking.score += 30;
    booking.reasons.push('booking_layout_hint');
  }

  scores.sort((a, b) => b.score - a.score);
  const best = scores[0];

  if (best.score < 30) {
    return { value: 'unknown', confidence: 0, candidates: scores };
  }

  return {
    value: best.platform,
    confidence: Math.min(100, best.score),
    candidates: scores
  };
}

function classifyAction({ subject, text }) {
  const source = normalizeComparable(`${subject || ''}\n${text || ''}`);
  const candidates = [
    { action: 'cancelled', score: 0, reasons: [] },
    { action: 'modified', score: 0, reasons: [] },
    { action: 'new', score: 0, reasons: [] }
  ];

  const add = (action, score, reason) => {
    const item = candidates.find((candidate) => candidate.action === action);
    item.score += score;
    item.reasons.push(reason);
  };

  if (/(cancelled|canceled|cancellation|cancelamento|reserva cancelada|booking cancelled)/i.test(source)) {
    add('cancelled', 100, 'cancel_keyword');
  }
  if (/(modified|changed|updated|alterada|atualizada|modificada|booking modified)/i.test(source)) {
    add('modified', 85, 'modify_keyword');
  }
  if (/(new reservation|nova reserva|reservation confirmed|reserva confirmada|confirmed booking|guest has booked|confirmacao de reserva)/i.test(source)) {
    add('new', 90, 'new_keyword');
  }
  if (/check-?in/i.test(source) && /check-?out/i.test(source)) {
    add('new', 15, 'date_layout_hint');
  }

  candidates.sort((a, b) => b.score - a.score);
  const best = candidates[0];

  if (best.score < 30) {
    return { value: 'unknown', confidence: 0, candidates };
  }

  return {
    value: best.action,
    confidence: Math.min(100, best.score),
    candidates
  };
}

function buildField(value, score, source, candidates = []) {
  return {
    value: value ?? null,
    score: value == null || value === '' ? 0 : score,
    source,
    candidates
  };
}

function parseInboundReservation(input) {
  const normalized = buildNormalizedInboundText(input);
  const text = normalized.cleanedText;
  const subjectAndText = `${input.subject || ''}\n${text}`;

  const platform = classifyPlatform({
    subject: input.subject,
    fromEmail: input.fromEmail,
    text
  });
  const action = classifyAction({
    subject: input.subject,
    text
  });

  const startDate = extractDateNearLabels(text, [
    'check-in',
    'check in',
    'entrada',
    'arrival',
    'chegada',
    'inicio'
  ]);
  const endDate = extractDateNearLabels(text, [
    'check-out',
    'check out',
    'saida',
    'departure',
    'partida',
    'fim'
  ]);
  const dates = extractDates(text);
  const selectedStartDate = startDate || dates[0]?.value || null;
  const selectedEndDate = endDate || dates.find((item) => item.value !== selectedStartDate)?.value || null;

  const emails = extractEmails(text);
  const phones = extractPhones(text);
  const guestName =
    extractFirstByLabels(subjectAndText, [
      'guest name',
      'guest',
      'booker',
      'hospede',
      'nome do hospede',
      'nome',
      'reservation for',
      'reserva para'
    ]) ||
    null;

  const totalAmount = parseAmount(text);
  const fields = {
    guestName: buildField(guestName, guestName ? 75 : 0, 'label'),
    guestEmail: buildField(emails[0] || null, emails[0] ? 85 : 0, 'email_regex', emails),
    guestPhone: buildField(phones[0] || null, phones[0] ? 75 : 0, 'phone_regex', phones),
    startDate: buildField(selectedStartDate, selectedStartDate ? (startDate ? 90 : 65) : 0, startDate ? 'date_label' : 'date_sequence', dates),
    endDate: buildField(selectedEndDate, selectedEndDate ? (endDate ? 90 : 65) : 0, endDate ? 'date_label' : 'date_sequence', dates),
    totalAmount: buildField(totalAmount, totalAmount != null ? 65 : 0, 'amount_regex')
  };

  const notes = [];
  const missingFields = [];
  const required = ['guestName', 'startDate', 'endDate'];

  for (const field of required) {
    if (!fields[field].value) missingFields.push(field);
  }

  if (!fields.guestEmail.value && !fields.guestPhone.value) {
    missingFields.push('guestContact');
    notes.push('guest_contact_missing');
  }

  if (fields.startDate.value && fields.endDate.value && new Date(fields.startDate.value) >= new Date(fields.endDate.value)) {
    notes.push('invalid_date_order');
    fields.startDate.score = Math.max(0, fields.startDate.score - 35);
    fields.endDate.score = Math.max(0, fields.endDate.score - 35);
  }

  if (platform.value === 'unknown') notes.push('platform_unknown');
  if (action.value === 'unknown') notes.push('action_unknown');

  const weightedScore = Math.round((
    fields.guestName.score * 0.15 +
    Math.max(fields.guestEmail.score, fields.guestPhone.score) * 0.15 +
    fields.startDate.score * 0.2 +
    fields.endDate.score * 0.2 +
    fields.totalAmount.score * 0.1 +
    platform.confidence * 0.1 +
    action.confidence * 0.1
  ));

  return {
    parser: platform.value === 'unknown' ? 'generic' : platform.value,
    platform: platform.value,
    source: platform.value,
    action: action.value,
    workflowAction: action.value === 'new' ? 'created' : action.value === 'modified' ? 'updated' : action.value,
    confidence: Math.max(0, Math.min(100, weightedScore)),
    fields,
    fieldScores: Object.fromEntries(Object.entries(fields).map(([key, field]) => [key, field.score])),
    missingFields,
    notes,
    candidates: {
      platform: platform.candidates,
      action: action.candidates,
      dates,
      emails,
      phones
    },
    normalized,
    startDate: fields.startDate.value,
    endDate: fields.endDate.value,
    totalAmount: fields.totalAmount.value,
    guestName: fields.guestName.value,
    guestEmail: normalizeEmail(fields.guestEmail.value),
    guestPhone: fields.guestPhone.value
  };
}

module.exports = {
  parseInboundReservation,
  parseDateToYmd
};

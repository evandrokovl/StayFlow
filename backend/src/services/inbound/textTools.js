const crypto = require('crypto');

function normalizeText(value) {
  if (value == null) return '';
  return String(value).trim();
}

function stripDiacritics(value) {
  return normalizeText(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function normalizeWhitespace(value, options = {}) {
  const { preserveLines = false } = options;
  let text = stripDiacritics(value)
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n');

  if (preserveLines) {
    text = text
      .replace(/[ \t\f\v]+/g, ' ')
      .replace(/[ \t]*\n[ \t]*/g, '\n')
      .replace(/\n{3,}/g, '\n\n');
  } else {
    text = text.replace(/\s+/g, ' ');
  }

  return text.trim();
}

function normalizeComparable(value) {
  return normalizeWhitespace(value).toLowerCase();
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
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([a-f0-9]+);/gi, (_, code) => String.fromCharCode(parseInt(code, 16)))
    .replace(/\r/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

function removeForwardedNoise(text) {
  if (!text) return '';

  const lines = String(text).replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  const cleaned = [];
  const forwardMarkers = [
    /^-{2,}\s*forwarded message\s*-{2,}$/i,
    /^-{2,}\s*mensagem encaminhada\s*-{2,}$/i,
    /^de:\s.+/i,
    /^from:\s.+/i,
    /^enviado:\s.+/i,
    /^sent:\s.+/i,
    /^para:\s.+/i,
    /^to:\s.+/i,
    /^assunto:\s.+/i,
    /^subject:\s.+/i
  ];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      cleaned.push('');
      continue;
    }

    if (/^>+/.test(trimmed)) continue;
    if (forwardMarkers.some((pattern) => pattern.test(trimmed))) continue;

    cleaned.push(line);
  }

  return cleaned.join('\n').trim();
}

function removeSignatures(text) {
  if (!text) return '';

  const signaturePatterns = [
    /\n--\s*\n[\s\S]*$/i,
    /\n_{5,}[\s\S]*$/i,
    /esta mensagem pode conter informacoes[\s\S]*$/i,
    /this message may contain confidential information[\s\S]*$/i,
    /sent from my iphone[\s\S]*$/i,
    /enviado do meu iphone[\s\S]*$/i,
    /powered by airbnb[\s\S]*$/i
  ];

  let output = String(text);

  for (const pattern of signaturePatterns) {
    output = output.replace(pattern, '');
  }

  return output.trim();
}

function buildNormalizedInboundText({ subject, bodyText, bodyHtml }) {
  const textFromHtml = bodyHtml ? stripHtml(bodyHtml) : '';
  const joined = [
    subject || '',
    bodyText || '',
    textFromHtml
  ].filter(Boolean).join('\n');

  const cleaned = removeSignatures(removeForwardedNoise(joined));

  return {
    rawText: joined,
    cleanedText: normalizeWhitespace(cleaned, { preserveLines: true }),
    comparableText: normalizeComparable(cleaned)
  };
}

function tokenize(value) {
  return normalizeComparable(value)
    .split(/[^a-z0-9]+/g)
    .filter((token) => token && token.length >= 3);
}

function tokenOverlap(source, candidate) {
  const sourceTokens = new Set(tokenize(source));
  const candidateTokens = new Set(tokenize(candidate));
  if (!sourceTokens.size || !candidateTokens.size) return 0;

  let overlap = 0;
  for (const token of candidateTokens) {
    if (sourceTokens.has(token)) overlap += 1;
  }

  return overlap;
}

function similarityRatio(a, b) {
  const left = tokenize(a);
  const right = tokenize(b);
  if (!left.length || !right.length) return 0;

  const leftSet = new Set(left);
  const rightSet = new Set(right);
  let intersection = 0;

  for (const token of leftSet) {
    if (rightSet.has(token)) intersection += 1;
  }

  return intersection / Math.max(leftSet.size, rightSet.size);
}

function hashStable(value) {
  return crypto
    .createHash('sha256')
    .update(String(value || ''))
    .digest('hex');
}

module.exports = {
  buildNormalizedInboundText,
  hashStable,
  normalizeComparable,
  normalizeText,
  normalizeWhitespace,
  similarityRatio,
  stripHtml,
  tokenOverlap,
  tokenize
};

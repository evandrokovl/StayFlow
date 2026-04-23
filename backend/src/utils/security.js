const net = require('net');
const dns = require('dns').promises;

function isValidHttpUrl(value) {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function normalizeHostname(hostname) {
  return String(hostname || '')
    .trim()
    .toLowerCase()
    .replace(/^\[/, '')
    .replace(/\]$/, '');
}

function isBlockedIp(host) {
  const ipVersion = net.isIP(host);
  if (!ipVersion) return false;

  if (ipVersion === 4) {
    const parts = host.split('.').map(Number);
    const [a, b] = parts;

    if (a === 0) return true;
    if (a === 10) return true;
    if (a === 127) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true;
    if (a >= 224) return true;

    return false;
  }

  const normalized = host.toLowerCase();

  if (normalized === '::1' || normalized === '::') return true;
  if (normalized.startsWith('fc') || normalized.startsWith('fd')) return true;
  if (normalized.startsWith('fe80:')) return true;

  if (normalized.startsWith('::ffff:')) {
    return isBlockedIp(normalized.replace('::ffff:', ''));
  }

  return false;
}

function isBlockedHostname(hostname) {
  const host = normalizeHostname(hostname);

  if (!host) return true;

  if (
    host === 'localhost' ||
    host.endsWith('.localhost') ||
    host === 'metadata.google.internal'
  ) {
    return true;
  }

  return isBlockedIp(host);
}

function validateExternalUrl(url) {
  if (!isValidHttpUrl(url)) {
    return {
      valid: false,
      reason: 'URL inválida. Apenas http/https são permitidos.'
    };
  }

  const parsed = new URL(url);

  if (isBlockedHostname(parsed.hostname)) {
    return {
      valid: false,
      reason: 'Hostname não permitido para consumo externo.'
    };
  }

  return {
    valid: true,
    reason: null
  };
}

async function validateExternalUrlAsync(url) {
  const basicValidation = validateExternalUrl(url);

  if (!basicValidation.valid) {
    return basicValidation;
  }

  const parsed = new URL(url);
  const host = normalizeHostname(parsed.hostname);

  if (net.isIP(host)) {
    return {
      valid: true,
      reason: null
    };
  }

  try {
    const addresses = await dns.lookup(host, { all: true, verbatim: true });
    const blockedAddress = addresses.find((item) => isBlockedIp(normalizeHostname(item.address)));

    if (blockedAddress) {
      return {
        valid: false,
        reason: 'Hostname resolve para IP interno ou nao permitido.'
      };
    }

    return {
      valid: true,
      reason: null
    };
  } catch {
    return {
      valid: false,
      reason: 'Nao foi possivel resolver o hostname informado.'
    };
  }
}

module.exports = {
  validateExternalUrl,
  validateExternalUrlAsync,
  isBlockedHostname,
  isBlockedIp
};

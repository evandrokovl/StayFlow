const net = require('net');

function isValidHttpUrl(value) {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function isBlockedHostname(hostname) {
  const host = String(hostname || '').toLowerCase();

  if (!host) return true;

  if (
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host === '0.0.0.0' ||
    host === '::1'
  ) {
    return true;
  }

  if (net.isIP(host)) {
    if (host.startsWith('10.')) return true;
    if (host.startsWith('192.168.')) return true;
    if (host.startsWith('172.16.')) return true;
    if (host.startsWith('172.17.')) return true;
    if (host.startsWith('172.18.')) return true;
    if (host.startsWith('172.19.')) return true;
    if (host.startsWith('172.2')) return true;
  }

  return false;
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

module.exports = {
  validateExternalUrl
};
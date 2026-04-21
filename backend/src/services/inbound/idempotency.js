const { hashStable, normalizeComparable, normalizeText } = require('./textTools');

function buildInboundFingerprint(emailData = {}) {
  const stableParts = [
    normalizeText(emailData.emailId),
    normalizeText(emailData.toEmail).toLowerCase(),
    normalizeText(emailData.fromEmail).toLowerCase(),
    normalizeComparable(emailData.subject),
    normalizeComparable(emailData.bodyText || emailData.bodyHtml).slice(0, 5000)
  ];

  return hashStable(stableParts.join('|'));
}

async function findExistingInboundEmail(connection, { provider = 'resend', emailId, fingerprint }) {
  if (!emailId && !fingerprint) return null;

  const conditions = [];
  const params = [];

  if (emailId) {
    conditions.push('(provider = ? AND email_id = ?)');
    params.push(provider, emailId);
  }

  if (fingerprint) {
    conditions.push('fingerprint = ?');
    params.push(fingerprint);
  }

  const [rows] = await connection.query(
    `
    SELECT id, created_reservation_id, parsing_status, property_id
    FROM inbound_emails
    WHERE ${conditions.join(' OR ')}
    ORDER BY id ASC
    LIMIT 1
    `,
    params
  );

  return rows[0] || null;
}

function isDuplicateInboundError(error) {
  return (
    error &&
    (
      error.code === 'ER_DUP_ENTRY' ||
      error.errno === 1062 ||
      error.sqlState === '23000'
    )
  );
}

module.exports = {
  buildInboundFingerprint,
  findExistingInboundEmail,
  isDuplicateInboundError
};

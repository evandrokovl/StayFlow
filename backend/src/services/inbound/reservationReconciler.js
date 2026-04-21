const {
  normalizeComparable,
  normalizeText,
  similarityRatio
} = require('./textTools');

function normalizeEmail(value) {
  if (!value) return null;
  return String(value).trim().toLowerCase();
}

function dateOnly(value) {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}

function daysBetween(a, b) {
  const left = dateOnly(a);
  const right = dateOnly(b);
  if (!left || !right) return 9999;

  const leftDate = new Date(`${left}T00:00:00Z`);
  const rightDate = new Date(`${right}T00:00:00Z`);
  return Math.round(Math.abs(leftDate.getTime() - rightDate.getTime()) / 86400000);
}

function scoreReservationCandidate(reservation, parsed) {
  let score = 0;
  const reasons = [];

  const incomingName = normalizeComparable(parsed.guestName);
  const existingName = normalizeComparable(reservation.guest_name);

  if (incomingName && existingName) {
    if (incomingName === existingName) {
      score += 90;
      reasons.push('guest_name_exact');
    } else {
      const ratio = similarityRatio(incomingName, existingName);
      if (ratio >= 0.75) {
        score += 65;
        reasons.push('guest_name_fuzzy_high');
      } else if (ratio >= 0.45) {
        score += 35;
        reasons.push('guest_name_fuzzy_medium');
      }
    }
  }

  if (parsed.guestEmail && reservation.guest_email) {
    if (normalizeEmail(parsed.guestEmail) === normalizeEmail(reservation.guest_email)) {
      score += 90;
      reasons.push('guest_email_exact');
    }
  }

  if (parsed.guestPhone && reservation.guest_phone) {
    const incomingDigits = normalizeText(parsed.guestPhone).replace(/\D/g, '');
    const existingDigits = normalizeText(reservation.guest_phone).replace(/\D/g, '');
    if (incomingDigits && existingDigits && incomingDigits.slice(-8) === existingDigits.slice(-8)) {
      score += 70;
      reasons.push('guest_phone_exact_tail');
    }
  }

  const startDiff = daysBetween(parsed.startDate, reservation.start_date);
  if (startDiff === 0) {
    score += 55;
    reasons.push('start_date_exact');
  } else if (startDiff <= 2) {
    score += 35;
    reasons.push('start_date_close');
  }

  const endDiff = daysBetween(parsed.endDate, reservation.end_date);
  if (endDiff === 0) {
    score += 55;
    reasons.push('end_date_exact');
  } else if (endDiff <= 2) {
    score += 35;
    reasons.push('end_date_close');
  }

  if (parsed.totalAmount != null && reservation.total_amount != null) {
    const diff = Math.abs(Number(parsed.totalAmount) - Number(reservation.total_amount));
    if (diff === 0) {
      score += 20;
      reasons.push('amount_exact');
    } else if (diff <= 50) {
      score += 10;
      reasons.push('amount_close');
    }
  }

  if (String(reservation.status || '').toLowerCase() === 'cancelled') {
    score -= 25;
    reasons.push('existing_cancelled_penalty');
  }

  return {
    reservation,
    score,
    reasons
  };
}

async function findBestReservationMatch(connection, propertyId, parsed, logger) {
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
    LIMIT 80
    `,
    [propertyId]
  );

  const candidates = rows
    .map((reservation) => scoreReservationCandidate(reservation, parsed))
    .sort((a, b) => b.score - a.score);

  logger?.info?.('Candidatas para reconciliação', {
    service: 'inbound',
    scope: 'reservation_match',
    propertyId,
    candidates: candidates.slice(0, 5).map((candidate) => ({
      id: candidate.reservation.id,
      guest_name: candidate.reservation.guest_name,
      start_date: candidate.reservation.start_date,
      end_date: candidate.reservation.end_date,
      status: candidate.reservation.status,
      total_amount: candidate.reservation.total_amount,
      score: candidate.score,
      reasons: candidate.reasons
    }))
  });

  if (!candidates.length || candidates[0].score < 80) {
    return {
      matched: null,
      candidates,
      decision: {
        status: 'low_confidence',
        reason: 'best_reservation_score_below_threshold',
        threshold: 80,
        bestScore: candidates[0]?.score || 0
      }
    };
  }

  const best = candidates[0];
  const second = candidates[1] || null;

  if (second && best.score - second.score < 20) {
    return {
      matched: null,
      candidates,
      decision: {
        status: 'ambiguous',
        reason: 'best_reservation_score_too_close_to_second',
        bestScore: best.score,
        secondScore: second.score
      }
    };
  }

  return {
    matched: best.reservation,
    candidates,
    decision: {
      status: 'matched',
      reason: 'best_reservation_score_accepted',
      bestScore: best.score,
      reasons: best.reasons
    }
  };
}

module.exports = {
  findBestReservationMatch,
  scoreReservationCandidate
};

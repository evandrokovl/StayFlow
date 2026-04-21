const {
  normalizeComparable,
  normalizeText,
  similarityRatio,
  tokenOverlap
} = require('./textTools');

function extractUrls(text) {
  if (!text) return [];
  const matches = String(text).match(/https?:\/\/[^\s<>"')]+/gi);
  return matches ? [...new Set(matches)] : [];
}

function normalizeUrlForComparison(url) {
  try {
    const parsed = new URL(url);
    return `${parsed.hostname}${parsed.pathname}`.toLowerCase().replace(/\/+$/, '');
  } catch {
    return normalizeComparable(url).replace(/\s+/g, '');
  }
}

function getDomainFromUrl(url) {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return '';
  }
}

function extractListingHints(text) {
  const source = String(text || '');
  const normalized = normalizeComparable(source);
  const hints = {
    urls: extractUrls(source),
    airbnbRoomIds: [],
    bookingCodes: [],
    genericCodes: []
  };

  const patterns = [
    { key: 'airbnbRoomIds', regex: /airbnb\.com\/rooms\/(\d+)/gi },
    { key: 'airbnbRoomIds', regex: /\b(?:room id|anuncio|listing)[:\s#-]*(\d{4,})\b/gi },
    { key: 'bookingCodes', regex: /\b(?:booking|reservation|hotel_id)[:\s#-]*([a-z0-9_-]{4,})\b/gi },
    { key: 'genericCodes', regex: /\b(?:codigo|code|listing id|id)[:\s#-]*([a-z0-9_-]{4,})\b/gi }
  ];

  for (const { key, regex } of patterns) {
    let match;
    while ((match = regex.exec(normalized)) !== null) {
      hints[key].push(match[1].toLowerCase());
    }
  }

  hints.airbnbRoomIds = [...new Set(hints.airbnbRoomIds)];
  hints.bookingCodes = [...new Set(hints.bookingCodes)];
  hints.genericCodes = [...new Set(hints.genericCodes)];

  return hints;
}

function scoreListingCandidate(listing, context) {
  let score = 0;
  const reasons = [];

  const text = context.cleanedText || '';
  const comparableText = context.comparableText || normalizeComparable(text);
  const platform = normalizeComparable(context.platform || context.source);
  const listingPlatform = normalizeComparable(listing.platform);
  const listingUrl = normalizeText(listing.listing_url);
  const listingCode = normalizeComparable(listing.listing_code);
  const listingUrlNormalized = normalizeUrlForComparison(listingUrl);
  const listingDomain = getDomainFromUrl(listingUrl);
  const propertyName = normalizeComparable(listing.property_name);
  const address = normalizeComparable(listing.address);
  const city = normalizeComparable(listing.city);
  const state = normalizeComparable(listing.state);
  const country = normalizeComparable(listing.country);
  const hints = context.hints || extractListingHints(text);

  if (platform && platform !== 'unknown' && listingPlatform === platform) {
    score += 20;
    reasons.push(`platform:${listingPlatform}`);
  }

  if (listingUrl) {
    const urls = hints.urls.map((url) => ({
      raw: url,
      normalized: normalizeUrlForComparison(url),
      domain: getDomainFromUrl(url)
    }));

    if (urls.some((url) => url.normalized === listingUrlNormalized)) {
      score += 150;
      reasons.push('listing_url_exact');
    } else if (urls.some((url) => url.normalized.includes(listingUrlNormalized) || listingUrlNormalized.includes(url.normalized))) {
      score += 105;
      reasons.push('listing_url_partial');
    }

    if (listingDomain && urls.some((url) => url.domain === listingDomain)) {
      score += 10;
      reasons.push(`domain:${listingDomain}`);
    }
  }

  if (listingCode) {
    if (comparableText.includes(listingCode)) {
      score += 130;
      reasons.push('listing_code_text');
    }

    if (listingPlatform === 'airbnb' && hints.airbnbRoomIds.includes(listingCode)) {
      score += 150;
      reasons.push('airbnb_room_id');
    }

    if (listingPlatform === 'booking' && hints.bookingCodes.includes(listingCode)) {
      score += 150;
      reasons.push('booking_code');
    }

    if (hints.genericCodes.includes(listingCode)) {
      score += 90;
      reasons.push('generic_listing_code');
    }
  }

  if (propertyName) {
    if (comparableText.includes(propertyName)) {
      score += 100;
      reasons.push('property_name_exact');
    } else {
      const overlap = tokenOverlap(text, listing.property_name);
      const ratio = similarityRatio(text, listing.property_name);

      if (ratio >= 0.75 || overlap >= 4) {
        score += 75;
        reasons.push('property_name_fuzzy_high');
      } else if (ratio >= 0.45 || overlap >= 2) {
        score += 45;
        reasons.push('property_name_fuzzy_medium');
      }
    }
  }

  if (address && comparableText.includes(address)) {
    score += 80;
    reasons.push('address_exact');
  } else if (address && tokenOverlap(text, listing.address) >= 3) {
    score += 50;
    reasons.push('address_fuzzy');
  }

  if (city && comparableText.includes(city)) {
    score += 12;
    reasons.push(`city:${listing.city}`);
  }

  if (state && comparableText.includes(state)) {
    score += 8;
    reasons.push(`state:${listing.state}`);
  }

  if (country && comparableText.includes(country)) {
    score += 5;
    reasons.push(`country:${listing.country}`);
  }

  return {
    listing,
    score,
    reasons: [...new Set(reasons)]
  };
}

async function findBestPropertyMatch(pool, userId, parseResult, logger) {
  const [listings] = await pool.query(
    `
    SELECT
      pl.id,
      pl.property_id,
      pl.platform,
      pl.listing_url,
      pl.listing_code,
      p.name AS property_name,
      p.address,
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
    return {
      matched: null,
      candidates: [],
      decision: {
        status: 'no_candidates',
        reason: 'user_has_no_active_property_listings'
      }
    };
  }

  const context = {
    platform: parseResult.platform,
    source: parseResult.source,
    cleanedText: parseResult.normalized.cleanedText,
    comparableText: parseResult.normalized.comparableText,
    hints: extractListingHints(parseResult.normalized.cleanedText)
  };

  const candidates = listings
    .map((listing) => scoreListingCandidate(listing, context))
    .filter((candidate) => candidate.score > 0)
    .sort((a, b) => b.score - a.score);

  logger?.info?.('Candidatos de match de imóvel calculados', {
    service: 'inbound',
    scope: 'property_match',
    userId,
    candidates: candidates.slice(0, 5).map((candidate) => ({
      propertyId: candidate.listing.property_id,
      propertyName: candidate.listing.property_name,
      platform: candidate.listing.platform,
      score: candidate.score,
      reasons: candidate.reasons
    }))
  });

  if (!candidates.length || candidates[0].score < 65) {
    return {
      matched: null,
      candidates,
      decision: {
        status: 'low_confidence',
        reason: 'best_property_score_below_threshold',
        threshold: 65,
        bestScore: candidates[0]?.score || 0
      }
    };
  }

  const best = candidates[0];
  const second = candidates[1] || null;

  if (second && best.score - second.score < 20) {
    logger?.warn?.('Match de imóvel ambíguo; diferença de score muito pequena', {
      service: 'inbound',
      scope: 'property_match',
      userId,
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

    return {
      matched: null,
      candidates,
      decision: {
        status: 'ambiguous',
        reason: 'best_property_score_too_close_to_second',
        bestScore: best.score,
        secondScore: second.score
      }
    };
  }

  return {
    matched: {
      ...best.listing,
      match_score: best.score,
      match_reasons: best.reasons
    },
    candidates,
    decision: {
      status: 'matched',
      reason: 'best_property_score_accepted',
      bestScore: best.score
    }
  };
}

module.exports = {
  extractListingHints,
  findBestPropertyMatch,
  scoreListingCandidate
};

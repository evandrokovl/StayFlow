const express = require('express');
const crypto = require('crypto');
const pool = require('../config/database');
const authMiddleware = require('../middlewares/authMiddleware');
const { requireFullBilling, requireWritableBilling } = require('../middlewares/billingAccessMiddleware');
const billingService = require('../services/billingService');
const logger = require('../utils/logger');
const validate = require('../middlewares/validate');
const { propertyCreateSchema, propertyUpdateSchema } = require('../schemas/propertySchemas');

const router = express.Router();

function buildInternalIcalUrl(token) {
  const baseUrl = process.env.APP_BASE_URL || 'http://localhost:3000';
  return token ? `${baseUrl}/ical/${token}.ics` : null;
}

function normalizeText(value) {
  if (value == null) return null;
  const text = String(value).trim();
  return text === '' ? null : text;
}

function detectPlatformFromListingUrl(url) {
  if (!url) return 'other';

  const normalized = String(url).toLowerCase();

  if (normalized.includes('airbnb')) return 'airbnb';
  if (normalized.includes('booking')) return 'booking';
  if (normalized.includes('vrbo')) return 'vrbo';
  if (normalized.includes('olx')) return 'olx';

  return 'other';
}

function extractListingCode(url, platform) {
  if (!url) return null;

  const normalizedUrl = String(url).trim();

  if (platform === 'airbnb') {
    const match =
      normalizedUrl.match(/\/rooms\/(\d+)/i) ||
      normalizedUrl.match(/[?&]room_id=(\d+)/i);
    return match ? match[1] : null;
  }

  if (platform === 'booking') {
    const match =
      normalizedUrl.match(/hotel\/[^/]+\/([^.\/?]+)/i) ||
      normalizedUrl.match(/[?&]hotel_id=([^&]+)/i);
    return match ? match[1] : null;
  }

  if (platform === 'vrbo') {
    const match = normalizedUrl.match(/\/(\d+)\b/);
    return match ? match[1] : null;
  }

  return null;
}

async function getPropertyListings(propertyId) {
  const [rows] = await pool.query(
    `
    SELECT
      id,
      property_id,
      platform,
      listing_url,
      listing_code,
      is_active,
      created_at
    FROM property_listings
    WHERE property_id = ?
    ORDER BY id ASC
    `,
    [propertyId]
  );

  return rows;
}

async function getPropertyListingsMap(propertyIds) {
  if (!propertyIds.length) return new Map();

  const placeholders = propertyIds.map(() => '?').join(', ');
  const [rows] = await pool.query(
    `
    SELECT
      id,
      property_id,
      platform,
      listing_url,
      listing_code,
      is_active,
      created_at
    FROM property_listings
    WHERE property_id IN (${placeholders})
    ORDER BY property_id ASC, id ASC
    `,
    propertyIds
  );

  return rows.reduce((map, row) => {
    const key = Number(row.property_id);
    if (!map.has(key)) {
      map.set(key, []);
    }
    map.get(key).push(row);
    return map;
  }, new Map());
}

async function buildPropertyResponse(property, preloadedListings = null) {
  const listings = preloadedListings || await getPropertyListings(property.id);

  return {
    ...property,
    internal_ical_url: buildInternalIcalUrl(property.internal_ical_token),
    listing_url: listings[0]?.listing_url || null,
    listing_platform: listings[0]?.platform || null,
    listing_code: listings[0]?.listing_code || null,
    property_listings: listings
  };
}

router.use(authMiddleware);

async function recalculateBillingSafely(userId) {
  try {
    await billingService.recalculateUserPlan(userId);
  } catch (error) {
    logger.warn('Falha ao recalcular billing apos alteracao de imovel', {
      service: 'billing',
      userId,
      error
    });
  }
}

// LISTAR IMÓVEIS
router.get('/', requireFullBilling, async (req, res) => {
  try {
    const [properties] = await pool.query(
      `
      SELECT
        id,
        user_id,
        name,
        description,
        address,
        city,
        state,
        country,
        airbnb_ical_url,
        booking_ical_url,
        internal_ical_token,
        created_at,
        updated_at
      FROM properties
      WHERE user_id = ?
      ORDER BY id ASC
      `,
      [req.user.id]
    );

    const listingsMap = await getPropertyListingsMap(properties.map((property) => property.id));
    const result = properties.map((property) => (
      buildPropertyResponse(property, listingsMap.get(Number(property.id)) || [])
    ));

    return res.json(result);
  } catch (error) {
    logger.error("Erro ao listar imóveis", { service: 'api', route: req.originalUrl, userId: req.user?.id || null, error });
    return res.status(500).json({ error: 'Erro ao listar imóveis' });
  }
});

// BUSCAR IMÓVEL POR ID
router.get('/:id', requireFullBilling, async (req, res) => {
  try {
    const [properties] = await pool.query(
      `
      SELECT
        id,
        user_id,
        name,
        description,
        address,
        city,
        state,
        country,
        airbnb_ical_url,
        booking_ical_url,
        internal_ical_token,
        created_at,
        updated_at
      FROM properties
      WHERE id = ? AND user_id = ?
      LIMIT 1
      `,
      [req.params.id, req.user.id]
    );

    if (properties.length === 0) {
      return res.status(404).json({ error: 'Imóvel não encontrado' });
    }

    return res.json(await buildPropertyResponse(properties[0]));
  } catch (error) {
    logger.error("Erro ao buscar imóvel", { service: 'api', route: req.originalUrl, userId: req.user?.id || null, error });
    return res.status(500).json({ error: 'Erro ao buscar imóvel' });
  }
});

// CRIAR IMÓVEL
router.post('/', requireWritableBilling, validate(propertyCreateSchema), async (req, res) => {
  let connection;

  try {
    const {
      name,
      description,
      address,
      city,
      state,
      country,
      airbnb_ical_url,
      booking_ical_url,
      listing_url
    } = req.body;

    if (!name || !city || !listing_url) {
      return res.status(400).json({
        error: 'name, city e listing_url são obrigatórios'
      });
    }

    const normalizedListingUrl = normalizeText(listing_url);

    if (!normalizedListingUrl) {
      return res.status(400).json({
        error: 'listing_url é obrigatório'
      });
    }

    const internalIcalToken = crypto.randomBytes(24).toString('hex');
    const platform = detectPlatformFromListingUrl(normalizedListingUrl);
    const listingCode = extractListingCode(normalizedListingUrl, platform);

    connection = await pool.getConnection();
    await connection.beginTransaction();

    const [result] = await connection.query(
      `
      INSERT INTO properties (
        user_id,
        name,
        description,
        address,
        city,
        state,
        country,
        airbnb_ical_url,
        booking_ical_url,
        internal_ical_token
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        req.user.id,
        normalizeText(name),
        normalizeText(description),
        normalizeText(address),
        normalizeText(city),
        normalizeText(state),
        normalizeText(country) || 'Brasil',
        normalizeText(airbnb_ical_url),
        normalizeText(booking_ical_url),
        internalIcalToken
      ]
    );

    await connection.query(
      `
      INSERT INTO property_listings (
        property_id,
        platform,
        listing_url,
        listing_code,
        is_active
      ) VALUES (?, ?, ?, ?, 1)
      `,
      [
        result.insertId,
        platform,
        normalizedListingUrl,
        listingCode
      ]
    );

    await connection.commit();
    await recalculateBillingSafely(req.user.id);

    const [rows] = await pool.query(
      `
      SELECT
        id,
        user_id,
        name,
        description,
        address,
        city,
        state,
        country,
        airbnb_ical_url,
        booking_ical_url,
        internal_ical_token,
        created_at,
        updated_at
      FROM properties
      WHERE id = ? AND user_id = ?
      LIMIT 1
      `,
      [result.insertId, req.user.id]
    );

    return res.status(201).json({
      message: 'Imóvel cadastrado com sucesso',
      property: await buildPropertyResponse(rows[0])
    });
  } catch (error) {
    if (connection) {
      await connection.rollback();
    }

    logger.error("Erro ao cadastrar imóvel", { service: 'api', route: req.originalUrl, userId: req.user?.id || null, error });
    return res.status(500).json({
      error: 'Erro ao cadastrar imóvel',
    });
  } finally {
    if (connection) {
      connection.release();
    }
  }
});

// ATUALIZAR IMÓVEL
router.put('/:id', requireWritableBilling, validate(propertyUpdateSchema), async (req, res) => {
  let connection;

  try {
    const {
      name,
      description,
      address,
      city,
      state,
      country,
      airbnb_ical_url,
      booking_ical_url,
      listing_url
    } = req.body;

    if (!name || !city || !listing_url) {
      return res.status(400).json({
        error: 'name, city e listing_url são obrigatórios'
      });
    }

    const normalizedListingUrl = normalizeText(listing_url);

    if (!normalizedListingUrl) {
      return res.status(400).json({
        error: 'listing_url é obrigatório'
      });
    }

    const [existing] = await pool.query(
      `
      SELECT id
      FROM properties
      WHERE id = ? AND user_id = ?
      LIMIT 1
      `,
      [req.params.id, req.user.id]
    );

    if (existing.length === 0) {
      return res.status(404).json({ error: 'Imóvel não encontrado' });
    }

    const platform = detectPlatformFromListingUrl(normalizedListingUrl);
    const listingCode = extractListingCode(normalizedListingUrl, platform);

    connection = await pool.getConnection();
    await connection.beginTransaction();

    await connection.query(
      `
      UPDATE properties
      SET
        name = ?,
        description = ?,
        address = ?,
        city = ?,
        state = ?,
        country = ?,
        airbnb_ical_url = ?,
        booking_ical_url = ?,
        updated_at = NOW()
      WHERE id = ? AND user_id = ?
      `,
      [
        normalizeText(name),
        normalizeText(description),
        normalizeText(address),
        normalizeText(city),
        normalizeText(state),
        normalizeText(country) || 'Brasil',
        normalizeText(airbnb_ical_url),
        normalizeText(booking_ical_url),
        req.params.id,
        req.user.id
      ]
    );

    const [listingRows] = await connection.query(
      `
      SELECT id
      FROM property_listings
      WHERE property_id = ?
      ORDER BY id ASC
      LIMIT 1
      `,
      [req.params.id]
    );

    if (listingRows.length > 0) {
      await connection.query(
        `
        UPDATE property_listings
        SET
          platform = ?,
          listing_url = ?,
          listing_code = ?,
          is_active = 1
        WHERE id = ?
        `,
        [
          platform,
          normalizedListingUrl,
          listingCode,
          listingRows[0].id
        ]
      );
    } else {
      await connection.query(
        `
        INSERT INTO property_listings (
          property_id,
          platform,
          listing_url,
          listing_code,
          is_active
        ) VALUES (?, ?, ?, ?, 1)
        `,
        [
          req.params.id,
          platform,
          normalizedListingUrl,
          listingCode
        ]
      );
    }

    await connection.commit();
    await recalculateBillingSafely(req.user.id);

    const [rows] = await pool.query(
      `
      SELECT
        id,
        user_id,
        name,
        description,
        address,
        city,
        state,
        country,
        airbnb_ical_url,
        booking_ical_url,
        internal_ical_token,
        created_at,
        updated_at
      FROM properties
      WHERE id = ? AND user_id = ?
      LIMIT 1
      `,
      [req.params.id, req.user.id]
    );

    return res.json({
      message: 'Imóvel atualizado com sucesso',
      property: await buildPropertyResponse(rows[0])
    });
  } catch (error) {
    if (connection) {
      await connection.rollback();
    }

    logger.error("Erro ao atualizar imóvel", { service: 'api', route: req.originalUrl, userId: req.user?.id || null, error });
    return res.status(500).json({
      error: 'Erro ao atualizar imóvel',
    });
  } finally {
    if (connection) {
      connection.release();
    }
  }
});

// EXCLUIR IMÓVEL
router.delete('/:id', requireWritableBilling, async (req, res) => {
  try {
    const [existing] = await pool.query(
      `
      SELECT id
      FROM properties
      WHERE id = ? AND user_id = ?
      LIMIT 1
      `,
      [req.params.id, req.user.id]
    );

    if (existing.length === 0) {
      return res.status(404).json({ error: 'Imóvel não encontrado' });
    }

    await pool.query(
      `
      DELETE FROM properties
      WHERE id = ? AND user_id = ?
      `,
      [req.params.id, req.user.id]
    );

    await recalculateBillingSafely(req.user.id);

    return res.json({ message: 'Imóvel excluído com sucesso' });
  } catch (error) {
    logger.error("Erro ao excluir imóvel", { service: 'api', route: req.originalUrl, userId: req.user?.id || null, error });
    return res.status(500).json({ error: 'Erro ao excluir imóvel' });
  }
});

module.exports = router;

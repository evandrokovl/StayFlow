const express = require('express');
const crypto = require('crypto');
const pool = require('../config/database');
const authMiddleware = require('../middlewares/authMiddleware');

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

async function buildPropertyResponse(property) {
  const listings = await getPropertyListings(property.id);

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

// LISTAR IMÓVEIS
router.get('/', async (req, res) => {
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

    const result = [];
    for (const property of properties) {
      result.push(await buildPropertyResponse(property));
    }

    return res.json(result);
  } catch (error) {
    console.error('Erro ao listar imóveis:', error.message);
    return res.status(500).json({ error: 'Erro ao listar imóveis' });
  }
});

// BUSCAR IMÓVEL POR ID
router.get('/:id', async (req, res) => {
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
    console.error('Erro ao buscar imóvel:', error.message);
    return res.status(500).json({ error: 'Erro ao buscar imóvel' });
  }
});

// CRIAR IMÓVEL
router.post('/', async (req, res) => {
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

    console.error('Erro ao cadastrar imóvel:', error.message);
    return res.status(500).json({
      error: 'Erro ao cadastrar imóvel',
      details: error.message
    });
  } finally {
    if (connection) {
      connection.release();
    }
  }
});

// ATUALIZAR IMÓVEL
router.put('/:id', async (req, res) => {
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

    console.error('Erro ao atualizar imóvel:', error.message);
    return res.status(500).json({
      error: 'Erro ao atualizar imóvel',
      details: error.message
    });
  } finally {
    if (connection) {
      connection.release();
    }
  }
});

// EXCLUIR IMÓVEL
router.delete('/:id', async (req, res) => {
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

    return res.json({ message: 'Imóvel excluído com sucesso' });
  } catch (error) {
    console.error('Erro ao excluir imóvel:', error.message);
    return res.status(500).json({ error: 'Erro ao excluir imóvel' });
  }
});

module.exports = router;
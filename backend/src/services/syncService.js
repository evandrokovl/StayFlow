const pool = require('../config/database');
const { fetchIcalEvents } = require('../integrations/icalService');
const logger = require('../utils/logger');

async function syncAllProperties() {
  const startedAt = Date.now();

  try {
    logger.info('Iniciando sincronização automática de iCal', {
      service: 'sync',
      scope: 'all_properties'
    });

    const [properties] = await pool.query(`
      SELECT id, name, airbnb_ical_url, booking_ical_url
      FROM properties
      ORDER BY id ASC
    `);

    if (!properties || properties.length === 0) {
      logger.warn('Nenhum imóvel cadastrado para sincronização', {
        service: 'sync',
        scope: 'all_properties',
        durationMs: Date.now() - startedAt
      });

      return {
        success: true,
        propertiesProcessed: 0,
        totalInserted: 0,
        totalUpdated: 0,
        totalSkipped: 0,
        durationMs: Date.now() - startedAt
      };
    }

    let totalInserted = 0;
    let totalUpdated = 0;
    let totalSkipped = 0;
    let propertiesProcessed = 0;

    for (const property of properties) {
      const propertyStartedAt = Date.now();

      try {
        logger.info('Sincronizando imóvel', {
          service: 'sync',
          scope: 'property',
          propertyId: property.id,
          propertyName: property.name
        });

        const propertyResult = await syncPropertyFeeds(property);

        propertiesProcessed += 1;
        totalInserted += propertyResult.inserted;
        totalUpdated += propertyResult.updated;
        totalSkipped += propertyResult.skipped;

        logger.info('Sincronização do imóvel finalizada', {
          service: 'sync',
          scope: 'property',
          propertyId: property.id,
          propertyName: property.name,
          durationMs: Date.now() - propertyStartedAt,
          result: propertyResult
        });
      } catch (error) {
        logger.error('Erro ao sincronizar imóvel', {
          service: 'sync',
          scope: 'property',
          propertyId: property.id,
          propertyName: property.name,
          durationMs: Date.now() - propertyStartedAt,
          error
        });
      }
    }

    const result = {
      success: true,
      propertiesProcessed,
      totalInserted,
      totalUpdated,
      totalSkipped,
      durationMs: Date.now() - startedAt
    };

    logger.info('Sincronização automática finalizada', {
      service: 'sync',
      scope: 'all_properties',
      result
    });

    return result;
  } catch (error) {
    logger.error('Erro geral na sincronização automática', {
      service: 'sync',
      scope: 'all_properties',
      durationMs: Date.now() - startedAt,
      error
    });

    throw error;
  }
}

async function syncOneProperty(propertyId) {
  const startedAt = Date.now();

  try {
    const [rows] = await pool.query(`
      SELECT id, name, airbnb_ical_url, booking_ical_url
      FROM properties
      WHERE id = ?
      LIMIT 1
    `, [propertyId]);

    if (!rows || rows.length === 0) {
      logger.warn('Imóvel não encontrado para sincronização individual', {
        service: 'sync',
        scope: 'single_property',
        propertyId
      });

      return {
        success: false,
        message: 'Imóvel não encontrado'
      };
    }

    const property = rows[0];

    logger.info('Iniciando sincronização individual do imóvel', {
      service: 'sync',
      scope: 'single_property',
      propertyId: property.id,
      propertyName: property.name
    });

    const result = await syncPropertyFeeds(property);

    const response = {
      success: true,
      message: `Sincronização concluída para ${property.name}`,
      propertyId: property.id,
      propertyName: property.name,
      inserted: result.inserted,
      updated: result.updated,
      skipped: result.skipped,
      durationMs: Date.now() - startedAt
    };

    logger.info('Sincronização individual finalizada', {
      service: 'sync',
      scope: 'single_property',
      result: response
    });

    return response;
  } catch (error) {
    logger.error('Erro ao sincronizar imóvel individual', {
      service: 'sync',
      scope: 'single_property',
      propertyId,
      durationMs: Date.now() - startedAt,
      error
    });

    return {
      success: false,
      message: error.message
    };
  }
}

async function syncPropertyFeeds(property) {
  const feeds = await getConfiguredIcalFeeds(property);

  if (!feeds.length) {
    logger.warn('Imóvel sem iCal configurado. Sincronização ignorada', {
      service: 'sync',
      scope: 'property',
      propertyId: property.id,
      propertyName: property.name
    });

    return {
      inserted: 0,
      updated: 0,
      skipped: 0
    };
  }

  let inserted = 0;
  let updated = 0;
  let skipped = 0;

  for (const feed of feeds) {
    try {
      const events = await fetchIcalEvents(feed.ical_url);
      const result = await saveEvents(property.id, feed.channel, events);

      inserted += result.inserted;
      updated += result.updated;
      skipped += result.skipped;

      await updateIcalFeedStatus(property.id, feed.channel, feed.ical_url, events.length, null);
    } catch (error) {
      await updateIcalFeedStatus(property.id, feed.channel, feed.ical_url, 0, error.message);
      logger.error('Erro ao sincronizar feed iCal', {
        service: 'sync',
        scope: 'feed',
        propertyId: property.id,
        source: feed.channel,
        error
      });
    }
  }

  return {
    inserted,
    updated,
    skipped
  };
}

async function getConfiguredIcalFeeds(property) {
  const feeds = [];

  if (property.airbnb_ical_url) {
    feeds.push({ channel: 'airbnb', ical_url: property.airbnb_ical_url });
  }

  if (property.booking_ical_url) {
    feeds.push({ channel: 'booking', ical_url: property.booking_ical_url });
  }

  try {
    const [rows] = await pool.query(
      `
      SELECT channel, ical_url
      FROM property_ical_feeds
      WHERE property_id = ?
        AND is_active = 1
      ORDER BY id ASC
      `,
      [property.id]
    );

    rows.forEach((row) => {
      feeds.push({
        channel: row.channel || 'other',
        ical_url: row.ical_url
      });
    });
  } catch (error) {
    if (error.code !== 'ER_NO_SUCH_TABLE') {
      throw error;
    }
  }

  const seen = new Set();
  return feeds.filter((feed) => {
    if (!feed.ical_url) return false;
    const key = `${feed.channel}|${feed.ical_url}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function updateIcalFeedStatus(propertyId, channel, icalUrl, eventCount, errorMessage) {
  try {
    await pool.query(
      `
      UPDATE property_ical_feeds
      SET
        last_synced_at = NOW(),
        last_error = ?,
        last_event_count = ?,
        updated_at = NOW()
      WHERE property_id = ?
        AND channel = ?
        AND ical_url = ?
      `,
      [
        errorMessage ? String(errorMessage).slice(0, 500) : null,
        Number.isFinite(eventCount) ? eventCount : 0,
        propertyId,
        channel,
        icalUrl
      ]
    );
  } catch (error) {
    if (error.code !== 'ER_NO_SUCH_TABLE') {
      logger.warn('Falha ao atualizar status do feed iCal', {
        service: 'sync',
        scope: 'feed_status',
        propertyId,
        channel,
        error
      });
    }
  }
}

async function saveEvents(propertyId, source, events) {
  if (!events || !Array.isArray(events) || events.length === 0) {
    logger.info('Nenhum evento encontrado no feed iCal', {
      service: 'sync',
      scope: 'feed',
      propertyId,
      source
    });

    return {
      inserted: 0,
      updated: 0,
      skipped: 0
    };
  }

  let inserted = 0;
  let updated = 0;
  let skipped = 0;

  for (const event of events) {
    const externalId = event.uid ? String(event.uid).trim() : null;
    const startDate = event.start_date || null;
    const endDate = event.end_date || null;
    const summary = event.summary || 'Reserva';
    const description = event.description || null;

    if (!externalId || !startDate || !endDate) {
      skipped += 1;

      logger.warn('Evento iCal ignorado por falta de dados obrigatórios', {
        service: 'sync',
        scope: 'event',
        propertyId,
        source,
        externalId,
        startDate,
        endDate,
        summary
      });

      continue;
    }

    try {
      const [existingRows] = await pool.query(
        `
        SELECT id, start_date, end_date, status, notes
        FROM reservations
        WHERE property_id = ?
          AND source = ?
          AND external_id = ?
        LIMIT 1
        `,
        [propertyId, source, externalId]
      );

      if (existingRows.length === 0) {
        await pool.query(
          `
          INSERT INTO reservations (
            property_id,
            guest_name,
            source,
            start_date,
            end_date,
            status,
            external_id,
            notes
          ) VALUES (?, ?, ?, ?, ?, 'confirmed', ?, ?)
          `,
          [
            propertyId,
            summary,
            source,
            startDate,
            endDate,
            externalId,
            description
          ]
        );

        inserted += 1;

        logger.info('Reserva criada a partir do iCal', {
          service: 'sync',
          scope: 'event',
          propertyId,
          source,
          externalId,
          startDate,
          endDate
        });

        continue;
      }

      const existing = existingRows[0];
      const sameStartDate = normalizeDateValue(existing.start_date) === startDate;
      const sameEndDate = normalizeDateValue(existing.end_date) === endDate;
      const sameStatus = String(existing.status || '') === 'confirmed';
      const sameNotes = String(existing.notes || '') === String(description || '');

      if (sameStartDate && sameEndDate && sameStatus && sameNotes) {
        skipped += 1;

        logger.debug('Reserva já estava atualizada. Nenhuma alteração necessária', {
          service: 'sync',
          scope: 'event',
          propertyId,
          source,
          externalId,
          reservationId: existing.id
        });

        continue;
      }

      await pool.query(
        `
        UPDATE reservations
        SET
          guest_name = ?,
          start_date = ?,
          end_date = ?,
          status = 'confirmed',
          notes = ?
        WHERE id = ?
        `,
        [
          summary,
          startDate,
          endDate,
          description,
          existing.id
        ]
      );

      updated += 1;

      logger.info('Reserva existente atualizada a partir do iCal', {
        service: 'sync',
        scope: 'event',
        propertyId,
        source,
        externalId,
        reservationId: existing.id,
        startDate,
        endDate
      });
    } catch (error) {
      logger.error('Erro ao persistir evento iCal', {
        service: 'sync',
        scope: 'event',
        propertyId,
        source,
        externalId,
        startDate,
        endDate,
        error
      });
    }
  }

  const result = {
    inserted,
    updated,
    skipped
  };

  logger.info('Processamento do feed iCal finalizado', {
    service: 'sync',
    scope: 'feed',
    propertyId,
    source,
    totalEvents: events.length,
    result
  });

  return result;
}

function normalizeDateValue(value) {
  if (!value) return null;

  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }

  return String(value).slice(0, 10);
}

module.exports = {
  syncAllProperties,
  syncOneProperty
};

const test = require('node:test');
const assert = require('node:assert/strict');
const { srcPath, withRoute } = require('./helpers');

test('ical gera calendario ICS para token valido', async () => {
  const pool = {
    async query(sql, params) {
      if (sql.includes('WHERE internal_ical_token = ?')) {
        assert.equal(params[0], 'token123');
        return [[{ id: 10, name: 'Casa Teste', internal_ical_token: 'token123' }]];
      }

      if (sql.includes('FROM reservations')) {
        assert.equal(params[0], 10);
        return [[{
          id: 1,
          guest_name: 'Maria',
          source: 'manual',
          start_date: '2026-05-10',
          end_date: '2026-05-12',
          status: 'confirmed',
          external_id: 'abc',
          notes: 'observacao'
        }]];
      }

      throw new Error(`Query nao mockada: ${sql}`);
    }
  };

  await withRoute(
    srcPath('routes', 'icalRoutes.js'),
    '/ical',
    async (baseUrl) => {
      const response = await fetch(`${baseUrl}/ical/token123.ics`);
      const body = await response.text();

      assert.equal(response.status, 200);
      assert.match(response.headers.get('content-type'), /text\/calendar/);
      assert.match(body, /BEGIN:VCALENDAR/);
      assert.match(body, /BEGIN:VEVENT/);
      assert.match(body, /DTSTART;VALUE=DATE:20260510/);
      assert.match(body, /DTEND;VALUE=DATE:20260512/);
    },
    {
      mocks: {
        [srcPath('config', 'database.js')]: pool,
        [srcPath('middlewares', 'authMiddleware.js')]: (req, res, next) => next(),
        [srcPath('services', 'billingService.js')]: {
          refreshUserAccessStatus: async () => ({
            billingStatus: 'ACTIVE',
            accessStatus: 'FULL'
          })
        }
      }
    }
  );
});

test('ical property retorna token do imovel existente', async () => {
  const pool = {
    async query(sql, params) {
      if (sql.includes('WHERE id = ?')) {
        assert.equal(params[0], '10');
        return [[{ id: 10, name: 'Casa Teste', internal_ical_token: 'token123' }]];
      }

      throw new Error(`Query nao mockada: ${sql}`);
    }
  };

  await withRoute(
    srcPath('routes', 'icalRoutes.js'),
    '/ical',
    async (baseUrl) => {
      const response = await fetch(`${baseUrl}/ical/property/10`, {
        headers: { Authorization: 'Bearer token-teste' }
      });
      const body = await response.json();

      assert.equal(response.status, 200);
      assert.equal(body.internal_ical_token, 'token123');
      assert.equal(body.ical_url, 'http://localhost:3000/ical/token123.ics');
    },
    {
      mocks: {
        [srcPath('config', 'database.js')]: pool,
        [srcPath('middlewares', 'authMiddleware.js')]: (req, res, next) => {
          req.user = { id: 7, email: 'pessoa@email.com' };
          next();
        },
        [srcPath('services', 'billingService.js')]: {
          refreshUserAccessStatus: async () => ({
            billingStatus: 'ACTIVE',
            accessStatus: 'FULL'
          })
        }
      }
    }
  );
});

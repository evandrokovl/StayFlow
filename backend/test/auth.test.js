const test = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { srcPath, withRoute, requestJson } = require('./helpers');

test('auth registra usuario com senha criptografada e alias inbound', async () => {
  const calls = [];
  const pool = {
    async execute(sql, params) {
      calls.push({ sql, params });

      if (sql.includes('SELECT id FROM users')) return [[]];
      if (sql.includes('INSERT INTO users')) return [{ insertId: 42 }];
      if (sql.includes('UPDATE users')) return [{ affectedRows: 1 }];

      throw new Error(`Query nao mockada: ${sql}`);
    }
  };

  await withRoute(
    srcPath('routes', 'authRoutes.js'),
    '/auth',
    async (baseUrl) => {
      const response = await requestJson(`${baseUrl}/auth/register`, {
        method: 'POST',
        body: JSON.stringify({
          name: 'Teste Usuario',
          email: 'Pessoa@Email.COM',
          password: 'senha123'
        })
      });

      assert.equal(response.status, 201);
      assert.equal(response.body.success, true);
      assert.equal(response.body.data.userId, 42);
      assert.equal(response.body.data.inbound_alias, 'u42@inbound.test');

      const insert = calls.find((item) => item.sql.includes('INSERT INTO users'));
      assert.equal(insert.params[1], 'pessoa@email.com');
      assert.notEqual(insert.params[2], 'senha123');
      assert.equal(await bcrypt.compare('senha123', insert.params[2]), true);
    },
    {
      mocks: {
        [srcPath('config', 'database.js')]: pool,
        [srcPath('config', 'env.js')]: {
          env: {
            JWT_SECRET: 'test-secret',
            INBOUND_DOMAIN: 'inbound.test',
            LOG_LEVEL: 'error'
          }
        }
      }
    }
  );
});

test('auth login retorna token JWT valido', async () => {
  const passwordHash = await bcrypt.hash('senha123', 10);
  const pool = {
    async execute(sql, params) {
      if (sql.includes('SELECT id, email, password FROM users')) {
        assert.equal(params[0], 'pessoa@email.com');
        return [[{ id: 7, email: 'pessoa@email.com', password: passwordHash }]];
      }

      throw new Error(`Query nao mockada: ${sql}`);
    }
  };

  await withRoute(
    srcPath('routes', 'authRoutes.js'),
    '/auth',
    async (baseUrl) => {
      const response = await requestJson(`${baseUrl}/auth/login`, {
        method: 'POST',
        body: JSON.stringify({
          email: 'Pessoa@Email.COM',
          password: 'senha123'
        })
      });

      assert.equal(response.status, 200);
      assert.equal(response.body.success, true);
      assert.equal(response.body.data.user.id, 7);

      const decoded = jwt.verify(response.body.data.token, 'test-secret');
      assert.equal(decoded.id, 7);
      assert.equal(decoded.email, 'pessoa@email.com');
    },
    {
      mocks: {
        [srcPath('config', 'database.js')]: pool,
        [srcPath('config', 'env.js')]: {
          env: {
            JWT_SECRET: 'test-secret',
            INBOUND_DOMAIN: 'inbound.test',
            LOG_LEVEL: 'error'
          }
        }
      }
    }
  );
});

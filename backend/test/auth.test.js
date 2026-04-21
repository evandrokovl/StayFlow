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

      if (sql.includes('SELECT id, email, cpf FROM users')) return [[]];
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
          cpf: '529.982.247-25',
          password: 'senha123'
        })
      });

      assert.equal(response.status, 201);
      assert.equal(response.body.success, true);
      assert.equal(response.body.data.userId, 42);
      assert.equal(response.body.data.inbound_alias, 'u42@inbound.test');

      const insert = calls.find((item) => item.sql.includes('INSERT INTO users'));
      assert.equal(insert.params[1], 'pessoa@email.com');
      assert.equal(insert.params[2], '52998224725');
      assert.notEqual(insert.params[3], 'senha123');
      assert.equal(await bcrypt.compare('senha123', insert.params[3]), true);
    },
    {
      mocks: {
        [srcPath('config', 'database.js')]: pool,
        [srcPath('services', 'passwordResetEmailService.js')]: {
          sendPasswordResetEmail: async () => ({ success: true })
        },
        [srcPath('services', 'billingService.js')]: {
          ensureTrialForUser: async () => ({})
        },
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
      if (sql.includes('information_schema.COLUMNS')) {
        return [[{ total: 1 }]];
      }

      if (sql.includes('SELECT id, name, email, cpf, inbound_alias, password FROM users')) {
        assert.equal(params[0], 'pessoa@email.com');
        return [[{
          id: 7,
          name: 'Pessoa Teste',
          email: 'pessoa@email.com',
          cpf: '52998224725',
          inbound_alias: 'u7@inbound.test',
          password: passwordHash
        }]];
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
      assert.equal(response.body.data.user.name, 'Pessoa Teste');
      assert.equal(response.body.data.user.cpf, '529.982.247-25');
      assert.equal(response.body.data.user.inbound_alias, 'u7@inbound.test');

      const decoded = jwt.verify(response.body.data.token, 'test-secret');
      assert.equal(decoded.id, 7);
      assert.equal(decoded.email, 'pessoa@email.com');
    },
    {
      mocks: {
        [srcPath('config', 'database.js')]: pool,
        [srcPath('services', 'passwordResetEmailService.js')]: {
          sendPasswordResetEmail: async () => ({ success: true })
        },
        [srcPath('services', 'billingService.js')]: {
          ensureTrialForUser: async () => ({})
        },
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

test('auth me retorna dados pessoais e alias inbound', async () => {
  const pool = {
    async execute(sql, params) {
      if (sql.includes('information_schema.COLUMNS')) {
        return [[{ total: 1 }]];
      }

      if (sql.includes('SELECT') && sql.includes('inbound_alias')) {
        assert.equal(params[0], 7);
        return [[{
          id: 7,
          name: 'Teste Usuario',
          email: 'pessoa@email.com',
          cpf: '52998224725',
          inbound_alias: 'u7@inbound.test'
        }]];
      }

      throw new Error(`Query nao mockada: ${sql}`);
    }
  };

  await withRoute(
    srcPath('routes', 'authRoutes.js'),
    '/auth',
    async (baseUrl) => {
      const token = jwt.sign({ id: 7, email: 'pessoa@email.com' }, 'test-secret');
      const response = await requestJson(`${baseUrl}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      assert.equal(response.status, 200);
      assert.equal(response.body.success, true);
      assert.equal(response.body.data.user.name, 'Teste Usuario');
      assert.equal(response.body.data.user.cpf, '529.982.247-25');
      assert.equal(response.body.data.user.inbound_alias, 'u7@inbound.test');
    },
    {
      mocks: {
        [srcPath('config', 'database.js')]: pool,
        [srcPath('services', 'passwordResetEmailService.js')]: {
          sendPasswordResetEmail: async () => ({ success: true })
        },
        [srcPath('services', 'billingService.js')]: {
          ensureTrialForUser: async () => ({})
        },
        [srcPath('config', 'env.js')]: {
          env: {
            JWT_SECRET: 'test-secret',
            INBOUND_DOMAIN: 'inbound.test',
            IS_PRODUCTION: false,
            LOG_LEVEL: 'error'
          }
        }
      }
    }
  );
});

test('auth solicita recuperacao de senha com token seguro sem enumerar email', async () => {
  const sentEmails = [];
  const calls = [];
  const pool = {
    async execute(sql, params) {
      calls.push({ sql, params });

      if (sql.includes('SELECT id, email FROM users')) {
        return [[{ id: 9, email: 'pessoa@email.com' }]];
      }
      if (sql.includes('UPDATE password_reset_tokens')) return [{ affectedRows: 1 }];
      if (sql.includes('INSERT INTO password_reset_tokens')) return [{ insertId: 1 }];

      throw new Error(`Query nao mockada: ${sql}`);
    }
  };

  await withRoute(
    srcPath('routes', 'authRoutes.js'),
    '/auth',
    async (baseUrl) => {
      const response = await requestJson(`${baseUrl}/auth/forgot-password`, {
        method: 'POST',
        body: JSON.stringify({ email: 'Pessoa@Email.COM' })
      });

      assert.equal(response.status, 200);
      assert.equal(response.body.success, true);
      assert.equal(typeof response.body.data.reset_token, 'string');
      assert.equal(response.body.data.reset_token.length, 64);
      assert.equal(sentEmails.length, 1);

      const insert = calls.find((item) => item.sql.includes('INSERT INTO password_reset_tokens'));
      assert.equal(insert.params[0], 9);
      assert.equal(insert.params[1].length, 64);
      assert.notEqual(insert.params[1], response.body.data.reset_token);
    },
    {
      mocks: {
        [srcPath('config', 'database.js')]: pool,
        [srcPath('services', 'passwordResetEmailService.js')]: {
          sendPasswordResetEmail: async (payload) => {
            sentEmails.push(payload);
            return { success: true };
          }
        },
        [srcPath('services', 'billingService.js')]: {
          ensureTrialForUser: async () => ({})
        },
        [srcPath('config', 'env.js')]: {
          env: {
            JWT_SECRET: 'test-secret',
            INBOUND_DOMAIN: 'inbound.test',
            IS_PRODUCTION: false,
            LOG_LEVEL: 'error'
          }
        }
      }
    }
  );
});

test('auth redefine senha e invalida token usado', async () => {
  let savedPassword = '';
  let usedTokenId = null;
  const pool = {
    async execute(sql, params) {
      if (sql.includes('SELECT id, user_id') && sql.includes('password_reset_tokens')) {
        assert.equal(params[0].length, 64);
        return [[{ id: 3, user_id: 11 }]];
      }
      if (sql.includes('UPDATE users SET password')) {
        savedPassword = params[0];
        assert.equal(params[1], 11);
        return [{ affectedRows: 1 }];
      }
      if (sql.includes('UPDATE password_reset_tokens') && sql.includes('WHERE id = ?')) {
        usedTokenId = params[0];
        return [{ affectedRows: 1 }];
      }

      throw new Error(`Query nao mockada: ${sql}`);
    }
  };

  await withRoute(
    srcPath('routes', 'authRoutes.js'),
    '/auth',
    async (baseUrl) => {
      const response = await requestJson(`${baseUrl}/auth/reset-password`, {
        method: 'POST',
        body: JSON.stringify({
          token: 'a'.repeat(64),
          password: 'nova123'
        })
      });

      assert.equal(response.status, 200);
      assert.equal(response.body.success, true);
      assert.equal(await bcrypt.compare('nova123', savedPassword), true);
      assert.equal(usedTokenId, 3);
    },
    {
      mocks: {
        [srcPath('config', 'database.js')]: pool,
        [srcPath('services', 'passwordResetEmailService.js')]: {
          sendPasswordResetEmail: async () => ({ success: true })
        },
        [srcPath('services', 'billingService.js')]: {
          ensureTrialForUser: async () => ({})
        },
        [srcPath('config', 'env.js')]: {
          env: {
            JWT_SECRET: 'test-secret',
            INBOUND_DOMAIN: 'inbound.test',
            IS_PRODUCTION: false,
            LOG_LEVEL: 'error'
          }
        }
      }
    }
  );
});

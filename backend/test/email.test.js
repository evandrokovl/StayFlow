const test = require('node:test');
const assert = require('node:assert/strict');
const { srcPath, resetBackendModules, mockModule } = require('./helpers');

test('emailDispatchService marca message_log como sent quando Resend retorna id', async () => {
  resetBackendModules();

  const executeCalls = [];

  class FakeResend {
    constructor(apiKey) {
      assert.equal(apiKey, 'resend-test-key');
      this.emails = {
        send: async (payload) => {
          assert.equal(payload.from, 'StayFlow <sender@test.com>');
          assert.equal(payload.to, 'guest@test.com');
          assert.equal(payload.subject, 'Bem-vindo');
          assert.equal(payload.html, '<p>Oi</p>');
          return { data: { id: 'resend_123' } };
        }
      };
    }
  }

  mockModule(require.resolve('resend'), { Resend: FakeResend });
  mockModule(srcPath('config', 'env.js'), {
    env: {
      RESEND_API_KEY: 'resend-test-key',
      EMAIL_FROM: 'StayFlow <sender@test.com>',
      LOG_LEVEL: 'error'
    }
  });
  mockModule(srcPath('config', 'database.js'), {
    async execute(sql, params) {
      executeCalls.push({ sql, params });

      if (sql.includes('SELECT') && sql.includes('FROM message_logs')) {
        return [[{
          id: 55,
          guest_contact: 'guest@test.com',
          subject: 'Bem-vindo',
          body_rendered: '<p>Oi</p>',
          status: 'queued',
          channel: 'email',
          scheduled_for: '2026-05-01'
        }]];
      }

      if (sql.includes("SET status = 'sent'")) {
        assert.deepEqual(params, ['resend_123', 55]);
        return [{ affectedRows: 1 }];
      }

      throw new Error(`Query nao mockada: ${sql}`);
    }
  });
  mockModule(srcPath('queues', 'jobQueue.js'), {
    jobQueue: {
      async add() {}
    }
  });
  mockModule(srcPath('utils', 'logger.js'), {
    info() {},
    warn() {},
    error() {}
  });

  const { sendGuestEmailFromLog } = require(srcPath('services', 'emailDispatchService.js'));
  const result = await sendGuestEmailFromLog(55);

  assert.equal(result.success, true);
  assert.equal(result.externalId, 'resend_123');
  assert.equal(executeCalls.some((item) => item.sql.includes("SET status = 'sent'")), true);

  resetBackendModules();
});

test('emailDispatchService marca message_log como failed quando Resend retorna erro', async () => {
  resetBackendModules();

  let failedUpdate = null;

  class FakeResend {
    constructor() {
      this.emails = {
        send: async () => ({ error: { message: 'domain not verified' } })
      };
    }
  }

  mockModule(require.resolve('resend'), { Resend: FakeResend });
  mockModule(srcPath('config', 'env.js'), {
    env: {
      RESEND_API_KEY: 'resend-test-key',
      EMAIL_FROM: 'StayFlow <sender@test.com>',
      LOG_LEVEL: 'error'
    }
  });
  mockModule(srcPath('config', 'database.js'), {
    async execute(sql, params) {
      if (sql.includes('SELECT') && sql.includes('FROM message_logs')) {
        return [[{
          id: 55,
          guest_contact: 'guest@test.com',
          subject: 'Bem-vindo',
          body_rendered: '<p>Oi</p>',
          status: 'queued',
          channel: 'email',
          scheduled_for: '2026-05-01'
        }]];
      }

      if (sql.includes("SET status = 'failed'")) {
        failedUpdate = params;
        return [{ affectedRows: 1 }];
      }

      throw new Error(`Query nao mockada: ${sql}`);
    }
  });
  mockModule(srcPath('queues', 'jobQueue.js'), {
    jobQueue: {
      async add() {}
    }
  });
  mockModule(srcPath('utils', 'logger.js'), {
    info() {},
    warn() {},
    error() {}
  });

  const { sendGuestEmailFromLog } = require(srcPath('services', 'emailDispatchService.js'));

  await assert.rejects(() => sendGuestEmailFromLog(55), /domain not verified/);
  assert.deepEqual(failedUpdate, ['domain not verified', 55]);

  resetBackendModules();
});

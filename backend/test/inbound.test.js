const test = require('node:test');
const assert = require('node:assert/strict');
const { srcPath, withRoute, requestJson } = require('./helpers');

test('inbound rejeita webhook sem segredo valido', async () => {
  let enqueued = false;

  await withRoute(
    srcPath('routes', 'inboundEmailRoutes.js'),
    '/inbound-emails',
    async (baseUrl) => {
      const response = await requestJson(`${baseUrl}/inbound-emails/resend`, {
        method: 'POST',
        body: JSON.stringify({
          type: 'email.received',
          data: { email_id: 'email_1' }
        })
      });

      assert.equal(response.status, 401);
      assert.equal(enqueued, false);
    },
    {
      mocks: {
        [srcPath('config', 'env.js')]: {
          env: {
            WEBHOOK_SECRET: 'secret',
            IS_PRODUCTION: true,
            LOG_LEVEL: 'error'
          }
        },
        [srcPath('queues', 'jobQueue.js')]: {
          async enqueueInboundResendWebhook() {
            enqueued = true;
          }
        },
        [srcPath('utils', 'logger.js')]: {
          info() {},
          warn() {},
          error() {}
        }
      }
    }
  );
});

test('inbound enfileira webhook recebido com segredo valido', async () => {
  let payload = null;

  await withRoute(
    srcPath('routes', 'inboundEmailRoutes.js'),
    '/inbound-emails',
    async (baseUrl) => {
      const response = await requestJson(`${baseUrl}/inbound-emails/resend`, {
        method: 'POST',
        headers: {
          'x-webhook-secret': 'secret'
        },
        body: JSON.stringify({
          type: 'email.received',
          data: { email_id: 'email_1' }
        })
      });

      assert.equal(response.status, 202);
      assert.equal(response.body.queued, true);
      assert.equal(response.body.email_id, 'email_1');
      assert.equal(payload.data.email_id, 'email_1');
    },
    {
      mocks: {
        [srcPath('config', 'env.js')]: {
          env: {
            WEBHOOK_SECRET: 'secret',
            IS_PRODUCTION: true,
            LOG_LEVEL: 'error'
          }
        },
        [srcPath('queues', 'jobQueue.js')]: {
          async enqueueInboundResendWebhook(event) {
            payload = event;
            return { id: 'job_1' };
          }
        },
        [srcPath('utils', 'logger.js')]: {
          info() {},
          warn() {},
          error() {}
        }
      }
    }
  );
});

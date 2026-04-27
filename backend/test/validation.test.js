const assert = require('node:assert/strict');
const test = require('node:test');

const {
  requestJson,
  srcPath,
  withRoute
} = require('./helpers');

test('message automation schema aceita payload legado do frontend', () => {
  const { messageAutomationCreateSchema } = require(srcPath('schemas', 'messageAutomationSchemas.js'));

  const parsed = messageAutomationCreateSchema.parse({
    body: {
      property_id: '',
      template_id: '10',
      name: 'Pre check-in',
      trigger_type: 'pre_check_in',
      offset_days: '2',
      send_time: '09:00',
      is_active: true
    },
    params: {},
    query: {}
  });

  assert.equal(parsed.body.property_id, null);
  assert.equal(parsed.body.template_id, 10);
  assert.equal(parsed.body.trigger_type, 'before_checkin');
  assert.equal(parsed.body.trigger_offset_value, 2);
  assert.equal(parsed.body.trigger_offset_unit, 'days');
});

test('message template route retorna erro padronizado para payload invalido', async () => {
  const routePath = srcPath('routes', 'messageTemplateRoutes.js');

  await withRoute(routePath, '/message-templates', async (baseUrl) => {
    const response = await requestJson(`${baseUrl}/message-templates`, {
      method: 'POST',
      body: JSON.stringify({
        name: '',
        body: ''
      })
    });

    assert.equal(response.status, 400);
    assert.equal(response.body.success, false);
    assert.equal(Array.isArray(response.body.errors), true);
    assert.ok(response.body.errors.some((item) => item.field === 'body.name'));
    assert.ok(response.body.errors.some((item) => item.field === 'body.body'));
  }, {
    mocks: {
      [srcPath('config', 'database.js')]: {
        async query() {
          throw new Error('database should not be called for invalid payload');
        }
      },
      [srcPath('utils', 'logger.js')]: {
        error() {},
        warn() {},
        info() {},
        debug() {}
      },
      [srcPath('middlewares', 'authMiddleware.js')]: (req, res, next) => {
        req.user = { id: 1 };
        next();
      },
      [srcPath('middlewares', 'billingAccessMiddleware.js')]: {
        requireFullBilling(req, res, next) {
          next();
        },
        requireWritableBilling(req, res, next) {
          next();
        }
      }
    }
  });
});

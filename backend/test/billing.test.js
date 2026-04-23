const test = require('node:test');
const assert = require('node:assert/strict');
const { srcPath, resetBackendModules, mockModule, withRoute, requestJson } = require('./helpers');

test('billing calcula plano base e imoveis adicionais', () => {
  resetBackendModules();

  mockModule(srcPath('config', 'database.js'), {});
  mockModule(srcPath('services', 'asaasService.js'), {});
  mockModule(srcPath('utils', 'logger.js'), {
    info() {},
    warn() {},
    error() {}
  });

  const billingService = require(srcPath('services', 'billingService.js'));

  assert.equal(billingService.calculatePlanValue(0).calculatedAmount, 49.9);
  assert.equal(billingService.calculatePlanValue(0).additionalPropertiesCount, 0);
  assert.equal(billingService.calculatePlanValue(1).calculatedAmount, 49.9);
  assert.equal(billingService.calculatePlanValue(1).additionalPropertiesCount, 0);
  assert.equal(billingService.calculatePlanValue(3).calculatedAmount, 109.7);
  assert.equal(billingService.calculatePlanValue(3).additionalPropertiesCount, 2);

  resetBackendModules();
});

test('billing me exige autenticacao e retorna estado do usuario logado', async () => {
  await withRoute(
    srcPath('routes', 'billingRoutes.js'),
    '/billing',
    async (baseUrl) => {
      const response = await requestJson(`${baseUrl}/billing/me`);

      assert.equal(response.status, 200);
      assert.equal(response.body.success, true);
      assert.equal(response.body.data.userId, 15);
      assert.equal(response.body.data.billing_status, 'TRIAL');
    },
    {
      mocks: {
        [srcPath('middlewares', 'authMiddleware.js')]: (req, res, next) => {
          req.user = { id: 15, email: 'teste@stayflowapp.online' };
          next();
        },
        [srcPath('controllers', 'billingController.js')]: {
          getMyBilling(req, res) {
            res.json({
              success: true,
              data: {
                userId: req.user.id,
                billing_status: 'TRIAL',
                access_status: 'FULL'
              }
            });
          },
          activateSubscription(req, res) {
            res.status(201).json({ success: true });
          },
          recalculate(req, res) {
            res.json({ success: true });
          },
          cancelSubscription(req, res) {
            res.json({ success: true });
          },
          listPayments(req, res) {
            res.json({ success: true, data: [] });
          }
        }
      }
    }
  );
});

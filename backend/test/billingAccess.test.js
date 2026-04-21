const test = require('node:test');
const assert = require('node:assert/strict');
const { srcPath, resetBackendModules, mockModule } = require('./helpers');

async function runBillingMiddleware(middlewareName, access) {
  resetBackendModules();

  mockModule(srcPath('services', 'billingService.js'), {
    refreshUserAccessStatus: async () => access
  });

  const middleware = require(srcPath('middlewares', 'billingAccessMiddleware.js'))[middlewareName];
  let nextError = null;

  await middleware({ user: { id: 10 } }, {}, (error) => {
    nextError = error || null;
  });

  resetBackendModules();
  return nextError;
}

test('billing access permite FULL em leitura operacional e escrita', async () => {
  const access = { billingStatus: 'ACTIVE', accessStatus: 'FULL' };

  assert.equal(await runBillingMiddleware('requireFullBilling', access), null);
  assert.equal(await runBillingMiddleware('requireWritableBilling', access), null);
});

test('billing access bloqueia dados operacionais e escrita em READ_ONLY', async () => {
  const access = { billingStatus: 'PAST_DUE', accessStatus: 'READ_ONLY' };

  const readError = await runBillingMiddleware('requireFullBilling', access);
  assert.equal(readError.statusCode, 403);
  assert.match(readError.message, /operacional/i);

  const writeError = await runBillingMiddleware('requireWritableBilling', access);
  assert.equal(writeError.statusCode, 403);
  assert.match(writeError.message, /somente leitura/i);
});

test('billing access bloqueia tudo fora de billing em BLOCKED', async () => {
  const access = {
    billingStatus: 'CANCELED',
    accessStatus: 'BLOCKED',
    blockReason: 'Assinatura cancelada'
  };

  const activeError = await runBillingMiddleware('requireActiveBilling', access);
  assert.equal(activeError.statusCode, 403);
  assert.equal(activeError.message, 'Assinatura cancelada');

  const fullError = await runBillingMiddleware('requireFullBilling', access);
  assert.equal(fullError.statusCode, 403);
  assert.equal(fullError.message, 'Assinatura cancelada');
});

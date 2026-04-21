const test = require('node:test');
const assert = require('node:assert/strict');

const { srcPath, resetBackendModules, mockModule } = require('./helpers');

test('messageAutomationService ignora duplicidade protegida por chave unica', async () => {
  resetBackendModules();

  const duplicateError = new Error('Duplicate entry');
  duplicateError.code = 'ER_DUP_ENTRY';
  duplicateError.errno = 1062;
  duplicateError.sqlState = '23000';

  const queryCalls = [];

  mockModule(srcPath('config', 'database.js'), {
    async query(sql, params) {
      queryCalls.push({ sql, params });

      if (sql.includes('FROM message_automations')) {
        return [[{
          id: 1,
          user_id: 7,
          property_id: null,
          template_id: 3,
          name: 'Pre check-in',
          trigger_type: 'before_checkin',
          trigger_offset_value: 1,
          trigger_offset_unit: 'days',
          is_active: 1,
          channel: 'email',
          subject: 'Ola {guest_name}',
          body: 'Reserva em {property_name}'
        }]];
      }

      if (sql.includes('FROM reservations')) {
        return [[{
          id: 10,
          property_id: 20,
          guest_name: 'Ana',
          guest_email: 'ana@test.com',
          guest_phone: null,
          start_date: '2026-05-10',
          end_date: '2026-05-12',
          status: 'confirmed',
          property_name: 'Casa Azul'
        }]];
      }

      if (sql.includes('FROM message_logs') && sql.includes('LIMIT 1')) {
        return [[]];
      }

      if (sql.includes('INSERT INTO message_logs')) {
        throw duplicateError;
      }

      throw new Error(`Query nao mockada: ${sql}`);
    }
  });

  const logs = [];
  mockModule(srcPath('utils', 'logger.js'), {
    info(message, meta) {
      logs.push({ level: 'info', message, meta });
    },
    warn() {},
    error() {},
    debug() {}
  });

  const { processMessageAutomations } = require(srcPath('services', 'messageAutomationService.js'));

  const result = await processMessageAutomations(7);

  assert.equal(result.processedAutomations, 1);
  assert.equal(result.createdLogs, 0);
  assert.equal(result.duplicateLogsSkipped, 1);
  assert.equal(queryCalls.some((call) => call.sql.includes('INSERT INTO message_logs')), true);
  assert.equal(logs.some((log) => log.message === 'Log de automação duplicado ignorado'), true);

  resetBackendModules();
});

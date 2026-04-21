const pool = require('../config/database');

let isWriting = false;

async function saveSystemLog(entry) {
  try {
    const {
      level,
      message,
      service = null,
      userId = null,
      context = null
    } = entry;

    await pool.query(
      `
      INSERT INTO system_logs (
        level,
        message,
        service,
        user_id,
        context_json
      ) VALUES (?, ?, ?, ?, ?)
      `,
      [
        level,
        String(message || '').slice(0, 255),
        service,
        userId,
        context ? JSON.stringify(context) : null
      ]
    );
  } catch (error) {
    if (!isWriting) {
      isWriting = true;
      console.error(JSON.stringify({
        timestamp: new Date().toISOString(),
        level: 'error',
        message: 'Falha ao salvar system_log no banco',
        service: 'system_logs',
        error: {
          message: error.message,
          stack: error.stack,
          name: error.name
        }
      }));
      isWriting = false;
    }
  }
}

module.exports = {
  saveSystemLog
};
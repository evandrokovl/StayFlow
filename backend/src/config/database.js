const mysql = require('mysql2/promise');
const { env } = require('./env');

const poolConfig = {
  host: env.DB_HOST,
  port: env.DB_PORT,
  user: env.DB_USER,
  password: env.DB_PASSWORD,
  database: env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
};

if (env.DB_SSL_ENABLED) {
  poolConfig.ssl = {
    rejectUnauthorized: env.DB_SSL_REJECT_UNAUTHORIZED
  };
}

const pool = mysql.createPool(poolConfig);

module.exports = pool;

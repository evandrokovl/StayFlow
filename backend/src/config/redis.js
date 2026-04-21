const Redis = require('ioredis');
const { env } = require('./env');

let connection;

function createRedisConnection() {
  if (env.REDIS_URL) {
    return new Redis(env.REDIS_URL, {
      maxRetriesPerRequest: null,
      enableReadyCheck: true
    });
  }

  return new Redis({
    host: env.REDIS_HOST,
    port: env.REDIS_PORT,
    password: env.REDIS_PASSWORD || undefined,
    db: env.REDIS_DB,
    maxRetriesPerRequest: null,
    enableReadyCheck: true
  });
}

function getRedisConnection() {
  if (!connection) {
    connection = createRedisConnection();
  }

  return connection;
}

module.exports = {
  getRedisConnection
};
const test = require('node:test');
const assert = require('node:assert/strict');
const { srcPath, resetBackendModules, mockModule } = require('./helpers');

test('jobQueue reutiliza queueName e enfileira inbound com job deduplicado', async () => {
  resetBackendModules();

  let queueInstance = null;

  class FakeQueue {
    constructor(name, options) {
      this.name = name;
      this.options = options;
      this.jobs = [];
      queueInstance = this;
    }

    async add(name, data, options) {
      const job = { id: options?.jobId || 'job_1', name, data, options };
      this.jobs.push(job);
      return job;
    }
  }

  mockModule(require.resolve('bullmq'), { Queue: FakeQueue });
  mockModule(srcPath('config', 'redis.js'), {
    getRedisConnection() {
      return { connectionName: 'redis-test' };
    }
  });
  mockModule(srcPath('config', 'env.js'), {
    env: {
      QUEUE_PREFIX: 'stayflow_test'
    }
  });

  const { queueName, enqueueInboundResendWebhook } = require(srcPath('queues', 'jobQueue.js'));

  assert.equal(queueName, 'stayflow_test_jobs');
  assert.equal(queueInstance.name, 'stayflow_test_jobs');

  const job = await enqueueInboundResendWebhook({
    data: {
      email_id: 'email_123'
    }
  });

  assert.equal(job.name, 'inbound_resend');
  assert.equal(job.options.jobId, 'inbound_resend_email_123');
  assert.deepEqual(job.data, {
    payload: {
      data: {
        email_id: 'email_123'
      }
    }
  });

  resetBackendModules();
});

test('jobQueue enfileira processamento de automacoes por usuario', async () => {
  resetBackendModules();

  let queueInstance = null;

  class FakeQueue {
    constructor(name) {
      this.name = name;
      this.jobs = [];
      queueInstance = this;
    }

    async add(name, data, options) {
      const job = { id: options?.jobId || 'job_1', name, data, options };
      this.jobs.push(job);
      return job;
    }
  }

  mockModule(require.resolve('bullmq'), { Queue: FakeQueue });
  mockModule(srcPath('config', 'redis.js'), {
    getRedisConnection() {
      return {};
    }
  });
  mockModule(srcPath('config', 'env.js'), {
    env: {
      QUEUE_PREFIX: 'stayflow_test'
    }
  });

  const { enqueueProcessMessageAutomations } = require(srcPath('queues', 'jobQueue.js'));
  const job = await enqueueProcessMessageAutomations(12);

  assert.equal(job.name, 'process_message_automations');
  assert.deepEqual(job.data, { userId: 12 });
  assert.match(job.options.jobId, /^process_message_automations_user_12_/);
  assert.equal(queueInstance.jobs.length, 1);

  resetBackendModules();
});

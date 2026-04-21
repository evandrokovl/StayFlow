require('dotenv').config();

const { Queue } = require('bullmq');
const { getRedisConnection } = require('../../src/config/redis');
const { queueName } = require('../../src/queues/jobQueue');

const messageLogId = process.argv[2] || process.env.MESSAGE_LOG_ID;

async function main() {
  if (!messageLogId) {
    console.error('Informe um messageLogId válido. Exemplo: node testQueue.js 123');
    process.exit(1);
  }

  const connection = getRedisConnection();
  const queue = new Queue(queueName, { connection });

  try {
    const job = await queue.add(
      'send_guest_email',
      { messageLogId: Number(messageLogId) },
      {
        jobId: `test_send_guest_email_${messageLogId}_${Date.now()}`,
        removeOnComplete: 200,
        removeOnFail: 500
      }
    );

    console.log('Job enviado com sucesso');
    console.log(`Fila: ${queueName}`);
    console.log(`Job ID: ${job.id}`);
    console.log(`messageLogId: ${messageLogId}`);
  } catch (error) {
    console.error('Erro ao enviar job para a fila');
    console.error(error.message);
    process.exitCode = 1;
  } finally {
    await queue.close();
    await connection.quit();
    process.exit(process.exitCode || 0);
  }
}

main();

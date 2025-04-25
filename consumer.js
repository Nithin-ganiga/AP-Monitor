import { kafka } from './client.js';
import { createLogger, format, transports } from 'winston';
import LokiTransport from 'winston-loki';

// Logger setup
const logger = createLogger({
  format: format.combine(
    format.timestamp(),
    format.json()
  ),
  transports: [
    new LokiTransport({
      host: "http://127.0.0.1:3100",
      labels: { job: "kafka-consumer", app: "api-server" },
      json: true,
    })
  ]
});

async function init() {
  const consumer = kafka.consumer({ groupId: 'test-group' });
  console.log("Connecting to consumer...");

  await consumer.connect();
  console.log("Connected to consumer");

  // Subscribe to relevant topics
  const topics = ['error-logs', 'info', 'alerts'];
  for (const topic of topics) {
    await consumer.subscribe({ topic, fromBeginning: true });
  }

  // Start consuming messages
  await consumer.run({
    eachMessage: async ({ topic, partition, message }) => {
      const value = message.value.toString();

      // Map topic to log level
      const levelMap = {
        'error-logs': 'error',
        'alerts': 'warn',
        'info': 'info'
      };
      const level = levelMap[topic] || 'info';

      if (topic === 'error-logs') {
        let parsedValue = {};
        try {
          parsedValue = JSON.parse(value);
        } catch (err) {
          console.error("❌ Failed to parse error-logs value as JSON:", value);
          parsedValue = { error: "Invalid JSON", originalValue: value };
        }

        logger.log({
          level,
          message: parsedValue.message || 'Received error-log',
          ...parsedValue,
          timestamp: message.timestamp
        });

        console.log(`[${level.toUpperCase()}] Logged error-logs: ${JSON.stringify(parsedValue)}`);
      } else {
        const logMessage = {
          message: 'Received',
          value,
          timestamp: message.timestamp,
        };

        logger.log({
          level,
          ...logMessage
        });

        console.log(`[${level.toUpperCase()}] ${logMessage.message}: ${value}`);
      }
    },
  });
}

// Handle top-level errors
init().catch(err => {
  logger.error("Error in consumer init", { error: err.message });
  console.error("❌ Error in consumer init", err);
});

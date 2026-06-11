import { KafkaConfig } from 'kafkajs';

export const kafkaConfig = (): KafkaConfig => ({
  clientId: process.env.KAFKA_CLIENT_ID ?? 'shopflow',
  brokers: (process.env.KAFKA_BROKERS ?? 'localhost:9092').split(','),
  retry: {
    initialRetryTime: 300,
    retries: 8,
  },
});

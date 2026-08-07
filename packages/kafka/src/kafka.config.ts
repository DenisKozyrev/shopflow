import { ConfigService } from '@nestjs/config';
import { KafkaConfig } from 'kafkajs';

export const kafkaConfig = (config: ConfigService): KafkaConfig => ({
  clientId: config.get<string>('KAFKA_CLIENT_ID', 'shopflow'),
  brokers: config.get<string>('KAFKA_BROKERS', 'localhost:9092').split(','),
  retry: {
    initialRetryTime: 300,
    retries: 8,
  },
});

import { z } from 'zod';

export const kafkaEnvSchema = z.object({
  KAFKA_BROKERS: z.string().default('localhost:9092'),
  KAFKA_CLIENT_ID: z.string().default('shopflow'),
});

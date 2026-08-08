import { z } from 'zod';

export const kafkaEnvSchema = z.object({
  // .default() only fires on undefined — .min(1) is what rejects an explicitly empty
  // value (e.g. an unresolved CI secret) instead of silently producing brokers: [''].
  KAFKA_BROKERS: z.string().min(1).default('localhost:9092'),
  KAFKA_CLIENT_ID: z.string().min(1).default('shopflow'),
});

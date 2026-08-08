import { ConfigService } from '@nestjs/config';
import { KafkaConfig } from 'kafkajs';

// Defaults live in kafkaEnvSchema (the single source of truth, applied at ConfigModule
// validation time) — no fallback values are duplicated here. The `!` is safe because
// this package's own tsconfig doesn't know the consuming app validated its env, but
// kafkaEnvSchema guarantees both keys are always present by the time this runs.
export const kafkaConfig = (config: ConfigService): KafkaConfig => ({
  clientId: config.get<string>('KAFKA_CLIENT_ID')!,
  brokers: config.get<string>('KAFKA_BROKERS')!.split(','),
  retry: {
    initialRetryTime: 300,
    retries: 8,
  },
});

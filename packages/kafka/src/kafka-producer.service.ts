import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Kafka, Producer } from 'kafkajs';
import { kafkaConfig } from './kafka.config';
import { KafkaTopic } from './index';

@Injectable()
export class KafkaProducerService implements OnModuleInit, OnModuleDestroy {
  private readonly producer: Producer;

  private readonly logger = new Logger(KafkaProducerService.name);

  // Rate-limits reconnect attempts by elapsed time rather than by tracking whether
  // the previous attempt has *resolved* — a single connect() call can itself hang
  // for a long time inside kafkajs's own retry/backoff, and gating on its promise
  // would mean no fresh attempt can start until that stuck one finally gives up.
  private lastConnectAttemptAt = 0;
  private static readonly RECONNECT_COOLDOWN_MS = 5000;

  constructor(configService: ConfigService) {
    const kafka = new Kafka(kafkaConfig(configService));
    this.producer = kafka.producer();
  }

  async onModuleInit() {
    this.connect();
  }

  async onModuleDestroy() {
    await this.producer.disconnect();
  }

  async emit<T extends object>(topic: KafkaTopic, payload: T): Promise<void> {
    try {
      await this.producer.send({
        topic,
        messages: [{ value: JSON.stringify(payload) }],
      });
    } catch (error) {
      // Don't make this request wait out kafkajs's own connect retry/backoff —
      // kick off a reconnect in the background so the *next* emit() can succeed
      // once the broker recovers, and let this one fail fast.
      this.connect();
      throw error;
    }
  }

  private connect(): void {
    const now = Date.now();
    if (now - this.lastConnectAttemptAt < KafkaProducerService.RECONNECT_COOLDOWN_MS) {
      return;
    }
    this.lastConnectAttemptAt = now;

    this.producer.connect().catch((error) => {
      this.logger.error('Failed to connect to Kafka', error);
    });
  }
}

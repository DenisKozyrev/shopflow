import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { Kafka, Producer } from 'kafkajs';
import { kafkaConfig } from './kafka.config';
import { KafkaTopic } from './index';

@Injectable()
export class KafkaProducerService implements OnModuleInit, OnModuleDestroy {
  private readonly producer: Producer;

  constructor() {
    const kafka = new Kafka(kafkaConfig());
    this.producer = kafka.producer();
  }

  async onModuleInit() {
    await this.producer.connect();
  }

  async onModuleDestroy() {
    await this.producer.disconnect();
  }

  async emit<T extends object>(topic: KafkaTopic, payload: T): Promise<void> {
    await this.producer.send({
      topic,
      messages: [{ value: JSON.stringify(payload) }],
    });
  }
}

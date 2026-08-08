import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { KafkaProducerService } from './kafka-producer.service';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [KafkaProducerService],
  exports: [KafkaProducerService],
})
export class KafkaModule {}

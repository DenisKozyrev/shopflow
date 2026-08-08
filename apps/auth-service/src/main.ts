import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { Logger } from '@nestjs/common';
import { join } from 'path';
import { AppModule } from './app.module';

async function bootstrap() {
  const logger = new Logger('AuthService');

  const app = await NestFactory.createMicroservice<MicroserviceOptions>(AppModule, {
    transport: Transport.GRPC,
    options: {
      package: 'auth',
      protoPath: join(__dirname, '../../../packages/proto/proto/auth.proto'),
      url: `0.0.0.0:${process.env.AUTH_GRPC_PORT ?? 5001}`,
    },
  });

  await app.listen();
  logger.log(`Auth Service gRPC listening on port ${process.env.AUTH_GRPC_PORT ?? 5001}`);
}

bootstrap();

import { NestFactory, HttpAdapterHost } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { AppModule } from './app.module';
import { GrpcExceptionFilter } from './common/filters/grpc-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const logger = new Logger('Bootstrap');

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const { httpAdapter } = app.get(HttpAdapterHost);
  app.useGlobalFilters(new GrpcExceptionFilter(httpAdapter));

  app.enableCors({
    origin: process.env.FRONTEND_URL ?? 'http://localhost:3001',
    credentials: true,
  });

  app.setGlobalPrefix('api/v1');

  const port = process.env.API_GATEWAY_PORT ?? 3000;
  await app.listen(port);
  logger.log(`API Gateway running on port ${port}`);
}

bootstrap();

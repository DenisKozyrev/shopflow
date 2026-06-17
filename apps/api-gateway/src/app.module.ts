import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { join } from 'path';
import { GRPC_SERVICE_TOKENS } from '@shopflow/common';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: '../../.env' }),

    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),

    // gRPC client connections to microservices
    ClientsModule.register([
      {
        name: GRPC_SERVICE_TOKENS.AUTH_SERVICE,
        transport: Transport.GRPC,
        options: {
          package: 'auth',
          protoPath: join(__dirname, '../../../../packages/proto/proto/auth.proto'),
          url: `localhost:${process.env.AUTH_GRPC_PORT ?? 5001}`,
        },
      },
      {
        name: GRPC_SERVICE_TOKENS.PRODUCT_SERVICE,
        transport: Transport.GRPC,
        options: {
          package: 'product',
          protoPath: join(__dirname, '../../../../packages/proto/proto/product.proto'),
          url: `localhost:${process.env.PRODUCT_GRPC_PORT ?? 5002}`,
        },
      },
      {
        name: GRPC_SERVICE_TOKENS.ORDER_SERVICE,
        transport: Transport.GRPC,
        options: {
          package: 'order',
          protoPath: join(__dirname, '../../../../packages/proto/proto/order.proto'),
          url: `localhost:${process.env.ORDER_GRPC_PORT ?? 5003}`,
        },
      },
    ]),
  ],
})
export class AppModule {}

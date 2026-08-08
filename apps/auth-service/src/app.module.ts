import { z } from 'zod';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PrismaModule, prismaEnvSchema } from '@shopflow/prisma';
import { KafkaModule, kafkaEnvSchema } from '@shopflow/kafka';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { TokenService } from './token.service';

// jsonwebtoken hands this straight to the `ms` package — a unitless value like "15"
// parses as 15 milliseconds, not 15 seconds, so the unit must be explicit.
const durationSchema = z
  .string()
  .regex(/^\d+(\.\d+)?(ms|s|m|h|d|w|y)$/, 'must be a duration with an explicit unit, e.g. "15m"');

const validateSchema = z
  .object({
    JWT_ACCESS_SECRET: z.string().min(32),
    JWT_REFRESH_SECRET: z.string().min(32),
    JWT_ACCESS_EXPIRES_IN: durationSchema,
    JWT_REFRESH_EXPIRES_IN: durationSchema,
  })
  .merge(prismaEnvSchema)
  .merge(kafkaEnvSchema);

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '../../.env',
      validate: (config) => validateSchema.parse(config),
    }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        global: true,
        secret: config.get<string>('JWT_ACCESS_SECRET'),
        signOptions: { expiresIn: config.get<string>('JWT_ACCESS_EXPIRES_IN') },
      }),
    }),
    PrismaModule,
    KafkaModule,
  ],
  controllers: [AuthController],
  providers: [AuthService, TokenService],
})
export class AppModule {}

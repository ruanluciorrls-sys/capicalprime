import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule } from '@nestjs/throttler';
import { EventEmitterModule } from '@nestjs/event-emitter';

import { DatabaseModule } from './database/database.module';
import { AuthModule } from './modules/auth/auth.module';
import { AdminModule } from './modules/admin/admin.module';
import { UsersModule } from './modules/users/users.module';
import { QrModule } from './modules/qr/qr.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { ExtensionModule } from './modules/extension/extension.module';
import { EventsModule } from './modules/events/events.module';
import { HealthModule } from './modules/health/health.module';
import { WebhookModule } from './modules/webhook/webhook.module';
import { LogsModule } from './modules/logs/logs.module';
import { CommonModule } from './common/common.module';

import { AuditLogEntity } from './database/entities/audit-log.entity';
import { BankAccountEntity } from './database/entities/bank-account.entity';
import { FinancialReceiptEntity } from './database/entities/financial-receipt.entity';
import { PaymentWebhookEntity } from './database/entities/payment-webhook.entity';
import { RequestIdMiddleware } from './common/middleware/request-id.middleware';
import { AppController } from './app.controller';

@Module({
  controllers: [AppController],
  imports: [
    // Config (must be first)
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '../../.env'],
    }),

    // Event Emitter (internal bus)
    EventEmitterModule.forRoot({
      wildcard: true,
      delimiter: '.',
      maxListeners: 20,
    }),

    // Rate Limiting
    ThrottlerModule.forRoot([
      {
        name: 'short',
        ttl: 1000,
        limit: 10,
      },
      {
        name: 'medium',
        ttl: 10000,
        limit: 50,
      },
      {
        name: 'long',
        ttl: 60000,
        limit: 200,
      },
    ]),

    // Database
    DatabaseModule,
    CommonModule,

    // Global services
    TypeOrmModule.forFeature([AuditLogEntity, BankAccountEntity, FinancialReceiptEntity, PaymentWebhookEntity]),

    // Auth & Admin (Auth é @Global, deve vir antes de quem usa ApiKeyGuard)
    AuthModule,
    AdminModule,

    // Feature Modules
    UsersModule,
    QrModule,
    PaymentsModule,
    ExtensionModule,
    EventsModule,
    HealthModule,
    WebhookModule,
    LogsModule,
  ],
  providers: [],
  exports: [],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestIdMiddleware).forRoutes('*');
  }
}

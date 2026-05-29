import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';

import { QrCodeEntity } from './entities/qr-code.entity';
import { PaymentEntity } from './entities/payment.entity';
import { UserEntity } from './entities/user.entity';
import { ExtensionDeviceEntity } from './entities/extension-device.entity';
import { AuditLogEntity } from './entities/audit-log.entity';
import { BankAccountEntity } from './entities/bank-account.entity';
import { FinancialReceiptEntity } from './entities/financial-receipt.entity';
import { PaymentWebhookEntity } from './entities/payment-webhook.entity';
import { RawQrCaptureEntity } from './entities/raw-qr-capture.entity';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const type = config.get<string>('DATABASE_TYPE', 'sqlite') as any;

        if (type === 'sqlite') {
          return {
            type: 'better-sqlite3',
            database: config.get<string>('DATABASE_PATH', './data/aios.db'),
            entities: [
              QrCodeEntity,
              PaymentEntity,
              UserEntity,
              ExtensionDeviceEntity,
              AuditLogEntity,
              BankAccountEntity,
              FinancialReceiptEntity,
              PaymentWebhookEntity,
              RawQrCaptureEntity,
            ],
            // WAL mode for concurrent read/write performance
            extra: {
              pragma: {
                journal_mode: 'WAL',
                synchronous: 'NORMAL',
                cache_size: -20000, // 20MB cache
                foreign_keys: true,
                busy_timeout: 5000,
              },
            },
            synchronize: config.get('NODE_ENV') !== 'production',
            migrations: [__dirname + '/migrations/*.js'],
            migrationsRun: true,
            logging: config.get('NODE_ENV') === 'development',
          };
        }

        return {
          type: 'postgres',
          host: config.get('DATABASE_HOST', 'localhost'),
          port: config.get<number>('DATABASE_PORT', 5432),
          username: config.get('DATABASE_USER', 'aios'),
          password: config.get('DATABASE_PASS', ''),
          database: config.get('DATABASE_NAME', 'aios_db'),
          entities: [
            QrCodeEntity,
            PaymentEntity,
            UserEntity,
            ExtensionDeviceEntity,
            AuditLogEntity,
            BankAccountEntity,
            FinancialReceiptEntity,
            PaymentWebhookEntity,
            RawQrCaptureEntity,
          ],
          // Synchronize cria as tabelas automaticamente a partir das entidades.
          // Em dev, sempre on. Em prod, on por padrao tambem (este e um sistema
          // single-tenant interno sem migrations geradas; sem isto o backend
          // crasha com "relation does not exist" no primeiro acesso).
          // Pode ser explicitamente desabilitado com DB_SYNC=false.
          synchronize:
            String(config.get('DB_SYNC', 'true')).toLowerCase() !== 'false',
          migrations: [__dirname + '/migrations/*.js'],
          migrationsRun: true,
          logging: config.get('NODE_ENV') === 'development',
          // SSL apenas quando explicitamente habilitado via DB_SSL=true.
          // Postgres em container interno (rede docker) nao tem SSL — habilitar SSL
          // sem suporte do servidor causa "The server does not support SSL connections".
          ssl:
            String(config.get('DB_SSL', 'false')).toLowerCase() === 'true'
              ? { rejectUnauthorized: false }
              : false,
          poolSize: config.get<number>('DB_POOL_SIZE', 20),
          extra: {
            max: config.get<number>('DB_POOL_SIZE', 20),
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 5000,
          },
        };
      },
    }),
  ],
})
export class DatabaseModule {}

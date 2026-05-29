import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';

import { PaymentEntity } from '../../database/entities/payment.entity';
import { QrCodeEntity } from '../../database/entities/qr-code.entity';
import { UserEntity } from '../../database/entities/user.entity';
import { AuditLogEntity } from '../../database/entities/audit-log.entity';
import { BankAccountEntity } from '../../database/entities/bank-account.entity';
import { FinancialReceiptEntity } from '../../database/entities/financial-receipt.entity';
import { ApiKeyGuard } from '../../common/guards/api-key.guard';
import { CommonModule } from '../../common/common.module';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { PaymentsRepository } from './payments.repository';
import { PaymentAdapterFactory } from './adapters/adapter.factory';
import { PaymentQueueService } from './services/payment-queue.service';
import { PaymentStatusPollerService } from './services/payment-status-poller.service';

@Module({
  imports: [
    ConfigModule,
    CommonModule,
    TypeOrmModule.forFeature([
      PaymentEntity, QrCodeEntity, UserEntity, AuditLogEntity,
      BankAccountEntity, FinancialReceiptEntity,
    ]),
  ],
  controllers: [PaymentsController],
  providers: [PaymentsService, PaymentsRepository, PaymentAdapterFactory, PaymentQueueService, PaymentStatusPollerService, ApiKeyGuard],
  exports: [PaymentsService, PaymentQueueService, PaymentAdapterFactory],
})
export class PaymentsModule {}

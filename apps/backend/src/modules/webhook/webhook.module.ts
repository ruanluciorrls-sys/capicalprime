import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PaymentEntity } from '../../database/entities/payment.entity';
import { QrCodeEntity } from '../../database/entities/qr-code.entity';
import { WebhookController } from './webhook.controller';
import { WebhookService } from './webhook.service';

@Module({
  imports: [TypeOrmModule.forFeature([PaymentEntity, QrCodeEntity])],
  controllers: [WebhookController],
  providers: [WebhookService],
})
export class WebhookModule {}

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PaymentEntity } from '../../database/entities/payment.entity';
import { QrCodeEntity } from '../../database/entities/qr-code.entity';
import { HealthController } from './health.controller';

@Module({
  imports: [TypeOrmModule.forFeature([QrCodeEntity, PaymentEntity])],
  controllers: [HealthController],
})
export class HealthModule {}

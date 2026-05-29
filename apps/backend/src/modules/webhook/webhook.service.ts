import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PaymentEntity } from '../../database/entities/payment.entity';
import { QrCodeEntity } from '../../database/entities/qr-code.entity';

@Injectable()
export class WebhookService {
  private readonly logger = new Logger(WebhookService.name);

  constructor(
    @InjectRepository(PaymentEntity)
    private readonly paymentRepo: Repository<PaymentEntity>,
    @InjectRepository(QrCodeEntity)
    private readonly qrRepo: Repository<QrCodeEntity>,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async handleBankCallback(payload: {
    paymentId?: string;
    transferId?: string;
    bankEnd2EndId?: string;
    status: 'SUCCESS' | 'FAILED' | 'PENDING';
    errorMessage?: string;
    rawResponse?: any;
  }): Promise<PaymentEntity | null> {
    
    if (payload.status === 'PENDING') return null;

    let payment: PaymentEntity | null = null;

    // Search by our internal ID if available (from externalReference)
    if (payload.paymentId) {
      payment = await this.paymentRepo.findOne({ where: { id: payload.paymentId } });
    }
    
    // If not found, try to search by bankEnd2EndId or transfer ID from the rawResponse
    if (!payment && payload.rawResponse) {
       // Check if there is an endToEndId stored in rawResponse
       const endToEnd = payload.bankEnd2EndId || payload.rawResponse?.transfer?.endToEndIdentifier;
       if (endToEnd) {
         payment = await this.paymentRepo.findOne({ where: { bankEnd2EndId: endToEnd } });
       }
    }

    if (!payment) {
      this.logger.warn(`WEBHOOK: Payment not found for payload: ${JSON.stringify(payload)}`);
      return null;
    }

    const updateData: Partial<PaymentEntity> = {
      status: payload.status,
      bankEnd2EndId: payload.bankEnd2EndId ?? payment.bankEnd2EndId,
      errorMessage: payload.errorMessage ?? null,
      bankResponse: payload.rawResponse ?? null,
    };

    if (payload.status === 'SUCCESS') {
      updateData.executedAt = new Date();
    }

    await this.paymentRepo.update(payment.id, updateData as any);
    const updated = await this.paymentRepo.findOneOrFail({ where: { id: payment.id } });

    if (payload.status === 'SUCCESS') {
      await this.qrRepo.update(payment.qrCodeId, { status: 'PAID' });
      this.eventEmitter.emit('payment.success', updated);
      this.logger.log(`WEBHOOK: Payment SUCCESS: ${payment.id}`);
    } else {
      await this.qrRepo.update(payment.qrCodeId, { status: 'ERROR' });
      this.eventEmitter.emit('payment.failed', updated);
      this.logger.warn(`WEBHOOK: Payment FAILED: ${payment.id} | ${payload.errorMessage}`);
    }

    return updated;
  }
}

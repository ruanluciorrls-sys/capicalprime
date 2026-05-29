import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { QrCodeEntity } from '../../database/entities/qr-code.entity';
import { PaymentsService } from '../payments/payments.service';

/**
 * Listens to domain events and orchestrates cross-module reactions.
 * Keeps modules decoupled through the EventEmitter bus.
 */
@Injectable()
export class EventsService {
  private readonly logger = new Logger(EventsService.name);

  constructor(private readonly paymentsService: PaymentsService) {}

  @OnEvent('qr.approved')
  async handleQrApproved(qrCode: QrCodeEntity) {
    this.logger.log(`[EVENT] qr.approved → triggering payment for: ${qrCode.id}`);
    try {
      await this.paymentsService.execute(qrCode);
    } catch (err) {
      this.logger.error(`Failed to execute payment for QR ${qrCode.id}: ${err.message}`);
    }
  }
}

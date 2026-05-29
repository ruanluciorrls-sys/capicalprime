import {
  Controller, Post, Body, Headers, HttpCode, HttpStatus, Logger,
} from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { WebhookService } from './webhook.service';
import * as crypto from 'crypto';

@SkipThrottle()
@Controller('webhook')
export class WebhookController {
  private readonly logger = new Logger(WebhookController.name);
  private readonly webhookSecret = process.env.WEBHOOK_SECRET ?? '';

  constructor(private readonly webhookService: WebhookService) {}

  @Post('bank-callback')
  @HttpCode(HttpStatus.OK)
  async handleBankCallback(
    @Body() body: any,
    @Headers('x-webhook-signature') signature: string,
  ) {
    if (this.webhookSecret && !this.verifySignature(body, signature)) {
      this.logger.warn('Webhook signature mismatch');
      return { received: false };
    }

    // Parse Asaas payload
    let internalPayload: any = body;
    
    // Check if it's an Asaas Transfer Webhook (for when we PAY a Pix)
    if (body.event && body.event.startsWith('TRANSFER_') && body.transfer) {
      // For Asaas transfers, the externalReference or operationType might be used, 
      // but if we don't have our internal payment ID, we'd need to search by endToEndId
      // However, Asaas usually includes the `endToEndIdentifier` in the transfer object.
      // For now we map it directly assuming the dashboard sets externalReference if possible,
      // or we emit an event for the service to find by endToEndId
      internalPayload = {
        event: body.event,
        transferId: body.transfer.id,
        status: body.event === 'TRANSFER_CONFIRMED' || body.event === 'TRANSFER_REALIZED' ? 'SUCCESS' : 
                (body.event === 'TRANSFER_FAILED' || body.event === 'TRANSFER_CANCELLED' ? 'FAILED' : 'PENDING'),
        rawResponse: body,
      };
    } else if (body.event && body.payment) {
      // Receiver webhook
      internalPayload = {
        event: body.event,
        paymentId: body.payment.externalReference, // If we set it
        status: body.event === 'PAYMENT_RECEIVED' || body.event === 'PAYMENT_CONFIRMED' ? 'SUCCESS' : 'FAILED',
        rawResponse: body
      };
    }

    return this.webhookService.handleBankCallback(internalPayload);
  }

  private verifySignature(body: any, signature: string): boolean {
    if (!this.webhookSecret || !signature) return true;
    const payload = typeof body === 'string' ? body : JSON.stringify(body);
    const expected = crypto
      .createHmac('sha256', this.webhookSecret)
      .update(payload)
      .digest('hex');
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  }
}

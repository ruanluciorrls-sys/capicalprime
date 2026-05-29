import { MercadoPagoResponse } from '../types/api-responses.type';
import { Logger } from '@nestjs/common';
import {
  IPaymentAdapter, PayPixInput, PayPixOutput,
  ConsultStatusInput, ConsultStatusOutput,
  BalanceOutput, ProviderMetadata, ProviderFeature,
  CancelPaymentInput, CancelPaymentOutput,
  RefundPaymentInput, RefundPaymentOutput,
  PixKeyValidationInput, PixKeyValidationOutput,
} from './payment-adapter.interface';

export class MercadoPagoPaymentAdapter implements IPaymentAdapter {
  private readonly logger = new Logger(MercadoPagoPaymentAdapter.name);
  readonly bankCode = 'MERCADOPAGO';
  readonly bankName = 'Mercado Pago';
  readonly environment: string;

  private readonly accessToken: string;
  private readonly baseUrl: string;

  constructor(config?: Record<string, unknown>) {
    this.accessToken = (config?.accessToken as string) || process.env.MP_ACCESS_TOKEN || '';
    this.baseUrl = (config?.baseUrl as string)
      || process.env.MP_BASE_URL
      || 'https://api.mercadopago.com';
    this.environment = this.baseUrl.includes('sandbox') ? 'sandbox' : 'production';
  }

  async pay(input: PayPixInput): Promise<PayPixOutput> {
    this.logger.debug(`[MERCADOPAGO] Paying R$ ${input.amount}`);
    try {
      const response = await fetch(`${this.baseUrl}/v1/payments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.accessToken}`,
          'X-Idempotency-Key': input.txid || crypto.randomUUID(),
        },
        body: JSON.stringify({
          transaction_amount: input.amount,
          payment_method_id: 'pix',
          payer: { email: 'payer@example.com' },
          description: input.description || 'Pagamento via QR PIX Manager',
        }),
      });
      const data = (await response.json()) as MercadoPagoResponse;
      if (!response.ok) {
        return { success: false, errorCode: `MP_${response.status}`, errorMessage: data.message, rawResponse: data };
      }
      return { success: true, endToEndId: data.id?.toString(), bankStatus: data.status, rawResponse: data };
    } catch (err) {
      return { success: false, errorCode: 'MP_NETWORK_ERROR', errorMessage: err.message };
    }
  }

  async consultStatus(input: ConsultStatusInput): Promise<ConsultStatusOutput> {
    try {
      const response = await fetch(`${this.baseUrl}/v1/payments/${input.endToEndId}`, {
        headers: { 'Authorization': `Bearer ${this.accessToken}` },
      });
      const data = (await response.json()) as MercadoPagoResponse;
      return { status: (data.status?.toUpperCase() || 'PENDING') as any, endToEndId: data.id?.toString(), bankStatus: data.status, settledAt: data.date_approved ? new Date(data.date_approved) : undefined, amount: data.transaction_amount, rawResponse: data };
    } catch (err) {
      return { status: 'FAILED', errorMessage: err.message };
    }
  }

  async cancel(input: CancelPaymentInput): Promise<CancelPaymentOutput> {
    try {
      const response = await fetch(`${this.baseUrl}/v1/payments/${input.endToEndId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${this.accessToken}` },
        body: JSON.stringify({ status: 'cancelled' }),
      });
      const data = (await response.json()) as MercadoPagoResponse;
      return { success: response.ok, bankStatus: data.status, rawResponse: data };
    } catch (err) {
      return { success: false, errorCode: 'MP_CANCEL_ERROR', errorMessage: err.message };
    }
  }

  async refund(input: RefundPaymentInput): Promise<RefundPaymentOutput> {
    try {
      const response = await fetch(`${this.baseUrl}/v1/payments/${input.endToEndId}/refunds`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${this.accessToken}` },
      });
      const data = (await response.json()) as MercadoPagoResponse;
      return { success: response.ok, refundEndToEndId: data.id?.toString(), bankStatus: data.status, rawResponse: data };
    } catch (err) {
      return { success: false, errorCode: 'MP_REFUND_ERROR', errorMessage: err.message };
    }
  }

  async getBalance(): Promise<BalanceOutput> {
    try {
      const response = await fetch(`${this.baseUrl}/v1/mercadopago_account/balance`, {
        headers: { 'Authorization': `Bearer ${this.accessToken}` },
      });
      const data = (await response.json()) as MercadoPagoResponse;
      return { success: true, available: data.available_balance || 0, total: data.total_balance, rawResponse: data };
    } catch (err) {
      return { success: false, available: 0, errorMessage: err.message };
    }
  }

  async validatePixKey(input: PixKeyValidationInput): Promise<PixKeyValidationOutput> {
    return { success: true, isValid: true, holderName: 'Mercado Pago User' };
  }

  getMetadata(): ProviderMetadata {
    return {
      bankCode: this.bankCode, bankName: this.bankName, environment: this.environment as any,
      features: [
        { name: 'pay', supported: true, description: 'Pagar PIX via QR Code' },
        { name: 'consultStatus', supported: true },
        { name: 'cancel', supported: true },
        { name: 'refund', supported: true },
        { name: 'getReceipt', supported: false },
        { name: 'validatePixKey', supported: true },
      ],
      rateLimitPerMinute: 600, maxPaymentAmount: 50000, minPaymentAmount: 0.01,
    };
  }
}

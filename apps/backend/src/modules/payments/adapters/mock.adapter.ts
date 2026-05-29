import { Logger } from '@nestjs/common';
import {
  IPaymentAdapter, PayPixInput, PayPixOutput,
  ConsultStatusInput, ConsultStatusOutput,
  BalanceOutput, ProviderMetadata,
  CancelPaymentInput, CancelPaymentOutput,
  RefundPaymentInput, RefundPaymentOutput,
} from './payment-adapter.interface';

export class MockPaymentAdapter implements IPaymentAdapter {
  private readonly logger = new Logger(MockPaymentAdapter.name);
  readonly bankCode = 'MOCK';
  readonly bankName = 'Mock Bank (Desenvolvimento)';
  readonly environment = 'sandbox';

  async pay(input: PayPixInput): Promise<PayPixOutput> {
    this.logger.debug(`[MOCK] Paying R$ ${input.amount} → ${input.pixKey}`);
    await this.sleep(500 + Math.random() * 1500);
    if (Math.random() < 0.1) {
      return { success: false, errorCode: 'MOCK_RANDOM_FAILURE', errorMessage: 'Falha simulada para teste de retry' };
    }
    const endToEndId = `E${Date.now()}MOCK${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
    return {
      success: true, endToEndId, bankStatus: 'ACSC',
      rawResponse: { mock: true, endToEndId, timestamp: new Date().toISOString(), input: { amount: input.amount, pixKey: input.pixKey } },
    };
  }

  async consultStatus(input: ConsultStatusInput): Promise<ConsultStatusOutput> {
    return { status: 'SUCCESS', endToEndId: input.endToEndId, bankStatus: 'ACSC', settledAt: new Date() };
  }

  async cancel(input: CancelPaymentInput): Promise<CancelPaymentOutput> {
    return { success: true, bankStatus: 'CANCELLED' };
  }

  async refund(input: RefundPaymentInput): Promise<RefundPaymentOutput> {
    return { success: true, refundEndToEndId: `REF${Date.now()}`, bankStatus: 'REFUNDED' };
  }

  async getBalance(): Promise<BalanceOutput> {
    return { success: true, available: 99999.99, total: 199999.99, currency: 'BRL' };
  }

  getMetadata(): ProviderMetadata {
    return {
      bankCode: this.bankCode, bankName: this.bankName, environment: 'sandbox',
      features: [
        { name: 'pay', supported: true }, { name: 'consultStatus', supported: true },
        { name: 'cancel', supported: true }, { name: 'refund', supported: true },
        { name: 'getReceipt', supported: true }, { name: 'validatePixKey', supported: true },
      ],
      rateLimitPerMinute: 9999, maxPaymentAmount: 999999, minPaymentAmount: 0.01,
    };
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

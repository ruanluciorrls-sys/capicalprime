import { IPaymentAdapter, PayPixInput, PayPixOutput } from './payment-adapter.interface';
import { Logger } from '@nestjs/common';

/**
 * Adapter para o banco Sicoob (Open Finance / API Pix)
 * Documentação: https://developers.sicoob.com.br/
 */
export class SicoobPaymentAdapter implements IPaymentAdapter {
  private readonly logger = new Logger(SicoobPaymentAdapter.name);
  readonly bankCode = 'SICOOB';
  readonly bankName = 'Sicoob';

  readonly environment: string = 'sandbox';

  private readonly config: Record<string, unknown>;

  constructor(config?: Record<string, unknown>) {
    this.config = config || {};
  }

  async pay(input: PayPixInput): Promise<PayPixOutput> {
    this.logger.warn('Sicoob adapter não implementado ainda. Use mock para desenvolvimento.');
    throw new Error('Sicoob adapter não implementado. Configure as credenciais e implemente o método pay().');
  }

  async consultStatus(input: any): Promise<any> {
    throw new Error('Sicoob adapter não implementado.');
  }

  async getBalance(): Promise<any> {
    return { success: false, available: 0, errorMessage: 'Sicoob adapter não implementado.' };
  }

  getMetadata(): any {
    return {
      bankCode: this.bankCode, bankName: this.bankName, environment: this.environment,
      features: [], rateLimitPerMinute: 0, maxPaymentAmount: 0, minPaymentAmount: 0
    };
  }
}

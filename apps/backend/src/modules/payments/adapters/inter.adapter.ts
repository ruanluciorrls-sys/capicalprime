import { InterResponse } from '../types/api-responses.type';
import { Logger } from '@nestjs/common';
import {
  IPaymentAdapter, PayPixInput, PayPixOutput,
  ConsultStatusInput, ConsultStatusOutput,
  BalanceOutput, ProviderMetadata,
} from './payment-adapter.interface';

export class InterPaymentAdapter implements IPaymentAdapter {
  private readonly logger = new Logger(InterPaymentAdapter.name);
  readonly bankCode = 'INTER';
  readonly bankName = 'Banco Inter';
  readonly environment: string;

  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly certificatePath: string;
  private readonly baseUrl: string;
  private accessToken: string | null = null;

  constructor(config?: Record<string, unknown>) {
    this.clientId = (config?.clientId as string) || process.env.INTER_CLIENT_ID || '';
    this.clientSecret = (config?.clientSecret as string) || process.env.INTER_CLIENT_SECRET || '';
    this.certificatePath = (config?.certificatePath as string) || process.env.INTER_CERTIFICATE_PATH || '';
    this.baseUrl = (config?.baseUrl as string) || process.env.INTER_BASE_URL || 'https://cdpj.partners.bancointer.com.br';
    this.environment = this.baseUrl.includes('cdpj') ? 'production' : 'sandbox';
  }

  private async authenticate(): Promise<string> {
    if (this.accessToken) return this.accessToken;
    const response = await fetch(`${this.baseUrl}/oauth/v2/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: this.clientId,
        client_secret: this.clientSecret,
        grant_type: 'client_credentials',
        scope: 'pix cob.write pix.read cob.read',
      }),
    });
    const data = (await response.json()) as InterResponse;
    this.accessToken = data.access_token || null;
    setTimeout(() => { this.accessToken = null; }, (data.expires_in || 3600) * 900);
    return this.accessToken!;
  }

  async pay(input: PayPixInput): Promise<PayPixOutput> {
    const token = await this.authenticate();
    try {
      const response = await fetch(`${this.baseUrl}/pix/v2/cob/${input.txid || crypto.randomUUID()}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          calendario: { expiracao: 3600 },
          valor: { original: input.amount.toFixed(2) },
          chave: input.pixKey,
          solicitacaoPagador: input.description || 'QR PIX Manager',
        }),
      });
      const data = (await response.json()) as InterResponse;
      if (!response.ok) return { success: false, errorCode: `INTER_${response.status}`, errorMessage: data.title, rawResponse: data };
      return { success: true, endToEndId: data.txid, bankStatus: 'ATIVA', rawResponse: data };
    } catch (err) {
      return { success: false, errorCode: 'INTER_NETWORK_ERROR', errorMessage: err.message };
    }
  }

  async consultStatus(input: ConsultStatusInput): Promise<ConsultStatusOutput> {
    const token = await this.authenticate();
    try {
      const response = await fetch(`${this.baseUrl}/pix/v2/cob/${input.txid}`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      const data = (await response.json()) as InterResponse;
      return { status: (data.status === 'CONCLUIDA' ? 'SUCCESS' : 'PENDING') as any, endToEndId: data.txid, bankStatus: data.status, rawResponse: data };
    } catch (err) {
      return { status: 'FAILED', errorMessage: err.message };
    }
  }

  async getBalance(): Promise<BalanceOutput> {
    const token = await this.authenticate();
    try {
      const response = await fetch(`${this.baseUrl}/banking/v2/saldo`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      const data = (await response.json()) as InterResponse;
      return { success: true, available: parseFloat(data.saldo_disponivel || '0'), total: parseFloat(data.saldo_total || '0'), rawResponse: data };
    } catch (err) {
      return { success: false, available: 0, errorMessage: err.message };
    }
  }

  getMetadata(): ProviderMetadata {
    return {
      bankCode: this.bankCode, bankName: this.bankName, environment: this.environment as any,
      features: [
        { name: 'pay', supported: true }, { name: 'consultStatus', supported: true },
        { name: 'cancel', supported: false }, { name: 'refund', supported: false },
        { name: 'getReceipt', supported: false }, { name: 'validatePixKey', supported: false },
      ],
      rateLimitPerMinute: 300, maxPaymentAmount: 100000, minPaymentAmount: 0.01,
    };
  }
}

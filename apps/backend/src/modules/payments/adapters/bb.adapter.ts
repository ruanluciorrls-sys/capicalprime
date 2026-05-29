import { BancoDoBrasilResponse } from '../types/api-responses.type';
import { Logger } from '@nestjs/common';
import {
  IPaymentAdapter, PayPixInput, PayPixOutput,
  ConsultStatusInput, ConsultStatusOutput,
  BalanceOutput, ProviderMetadata,
} from './payment-adapter.interface';

export class BancoDoBrasilPaymentAdapter implements IPaymentAdapter {
  private readonly logger = new Logger(BancoDoBrasilPaymentAdapter.name);
  readonly bankCode = 'BB';
  readonly bankName = 'Banco do Brasil';
  readonly environment: string;

  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly developerKey: string;
  private readonly baseUrl: string;
  private accessToken: string | null = null;

  constructor(config?: Record<string, unknown>) {
    this.clientId = (config?.clientId as string) || process.env.BB_CLIENT_ID || '';
    this.clientSecret = (config?.clientSecret as string) || process.env.BB_CLIENT_SECRET || '';
    this.developerKey = (config?.developerKey as string) || process.env.BB_DEVELOPER_KEY || '';
    this.baseUrl = (config?.baseUrl as string) || process.env.BB_BASE_URL || 'https://api.bb.com.br/pix/v2';
    this.environment = this.baseUrl.includes('sandbox') ? 'sandbox' : 'production';
  }

  private async authenticate(): Promise<string> {
    if (this.accessToken) return this.accessToken;
    const response = await fetch(`${this.baseUrl}/../oauth/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64')}`,
      },
      body: new URLSearchParams({ grant_type: 'client_credentials', scope: 'pix.cobranca.gerar pix.cobranca.consultar' }),
    });
    const data = (await response.json()) as BancoDoBrasilResponse;
    this.accessToken = data.access_token || null;
    setTimeout(() => { this.accessToken = null; }, (data.expires_in || 3600) * 900);
    return this.accessToken!;
  }

  async pay(input: PayPixInput): Promise<PayPixOutput> {
    const token = await this.authenticate();
    try {
      const gwDevAppKey = this.developerKey;
      const response = await fetch(`${this.baseUrl}/cob?gw-dev-app-key=${gwDevAppKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          calendario: { expiracao: 3600 },
          devedor: { cpf: '00000000000', nome: 'QR PIX Manager' },
          valor: { original: input.amount.toFixed(2) },
          chave: input.pixKey,
          infoAdicionais: [{ nome: 'Descricao', valor: input.description || 'Pagamento QR PIX Manager' }],
        }),
      });
      const data = (await response.json()) as BancoDoBrasilResponse;
      if (!response.ok) return { success: false, errorCode: `BB_${response.status}`, errorMessage: data.title || data.message, rawResponse: data };
      return { success: true, endToEndId: data.txid, bankStatus: data.status, rawResponse: data };
    } catch (err) {
      return { success: false, errorCode: 'BB_NETWORK_ERROR', errorMessage: err.message };
    }
  }

  async consultStatus(input: ConsultStatusInput): Promise<ConsultStatusOutput> {
    const token = await this.authenticate();
    try {
      const gwDevAppKey = this.developerKey;
      const response = await fetch(`${this.baseUrl}/cob/${input.txid}?gw-dev-app-key=${gwDevAppKey}`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      const data = (await response.json()) as BancoDoBrasilResponse;
      return { status: (data.status === 'CONCLUIDA' ? 'SUCCESS' : 'PENDING') as any, endToEndId: data.txid, bankStatus: data.status, rawResponse: data };
    } catch (err) {
      return { status: 'FAILED', errorMessage: err.message };
    }
  }

  async getBalance(): Promise<BalanceOutput> {
    return { success: false, available: 0, errorMessage: 'Balance consult not available via PIX API. Use banking API.' };
  }

  getMetadata(): ProviderMetadata {
    return {
      bankCode: this.bankCode, bankName: this.bankName, environment: this.environment as any,
      features: [
        { name: 'pay', supported: true }, { name: 'consultStatus', supported: true },
        { name: 'cancel', supported: false }, { name: 'refund', supported: false },
        { name: 'getReceipt', supported: false }, { name: 'validatePixKey', supported: false },
      ],
      rateLimitPerMinute: 200, maxPaymentAmount: 100000, minPaymentAmount: 0.01,
    };
  }
}

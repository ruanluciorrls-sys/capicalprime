import { EfiResponse } from '../types/api-responses.type';
import { Logger } from '@nestjs/common';
import {
  IPaymentAdapter, PayPixInput, PayPixOutput,
  ConsultStatusInput, ConsultStatusOutput,
  BalanceOutput, ProviderMetadata,
} from './payment-adapter.interface';

export class EfiPaymentAdapter implements IPaymentAdapter {
  private readonly logger = new Logger(EfiPaymentAdapter.name);
  readonly bankCode = 'EFI';
  readonly bankName = 'Efi / Gerencianet';
  readonly environment: string;

  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly baseUrl: string;
  private readonly certP12: string;
  private accessToken: string | null = null;

  constructor(config?: Record<string, unknown>) {
    this.clientId = (config?.clientId as string) || process.env.EFI_CLIENT_ID || '';
    this.clientSecret = (config?.clientSecret as string) || process.env.EFI_CLIENT_SECRET || '';
    this.certP12 = (config?.certP12 as string) || process.env.EFI_CERT_P12 || '';
    this.baseUrl = (config?.baseUrl as string) || process.env.EFI_BASE_URL || 'https://pix.api.efipay.com.br';
    this.environment = this.baseUrl.includes('sandbox') ? 'sandbox' : 'production';
  }

  private async authenticate(): Promise<string> {
    if (this.accessToken) return this.accessToken;
    const response = await fetch(`${this.baseUrl}/oauth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ grant_type: 'client_credentials' }),
      ...(this.clientId && this.clientSecret ? {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Basic ${Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64')}`,
        },
      } : {}),
    });
    const data = (await response.json()) as EfiResponse;
    this.accessToken = data.access_token || null;
    setTimeout(() => { this.accessToken = null; }, (data.expires_in || 3600) * 900);
    return this.accessToken!;
  }

  async pay(input: PayPixInput): Promise<PayPixOutput> {
    const token = await this.authenticate();
    try {
      const response = await fetch(`${this.baseUrl}/v2/cob`, {
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
      const data = (await response.json()) as EfiResponse;
      if (!response.ok) return { success: false, errorCode: `EFI_${response.status}`, errorMessage: data.error_description, rawResponse: data };
      return { success: true, endToEndId: data.txid, bankStatus: data.status, rawResponse: data };
    } catch (err) {
      return { success: false, errorCode: 'EFI_NETWORK_ERROR', errorMessage: err.message };
    }
  }

  async consultStatus(input: ConsultStatusInput): Promise<ConsultStatusOutput> {
    const token = await this.authenticate();
    try {
      const response = await fetch(`${this.baseUrl}/v2/cob/${input.txid}`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      const data = (await response.json()) as EfiResponse;
      return { status: (data.status === 'CONCLUIDA' ? 'SUCCESS' : 'PENDING') as any, endToEndId: data.txid, bankStatus: data.status, rawResponse: data };
    } catch (err) {
      return { status: 'FAILED', errorMessage: err.message };
    }
  }

  async getBalance(): Promise<BalanceOutput> {
    const token = await this.authenticate();
    try {
      const response = await fetch(`${this.baseUrl}/v2/saldo`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      const data = (await response.json()) as EfiResponse;
      return { success: true, available: parseFloat(data.saldo || '0'), rawResponse: data };
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
      rateLimitPerMinute: 300, maxPaymentAmount: 50000, minPaymentAmount: 0.01,
    };
  }
}

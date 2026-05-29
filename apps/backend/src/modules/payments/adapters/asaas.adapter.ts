import { AsaasResponse } from '../types/api-responses.type';
import { Injectable, Logger } from '@nestjs/common';
import { normalizePixInput } from '@aios/shared';
import {
  IPaymentAdapter, PayPixInput, PayPixOutput,
  ConsultStatusInput, ConsultStatusOutput,
  BalanceOutput, ProviderMetadata, ProviderFeature,
  CancelPaymentInput, CancelPaymentOutput,
  RefundPaymentInput, RefundPaymentOutput,
  GetReceiptInput, GetReceiptOutput,
  PixKeyValidationInput, PixKeyValidationOutput,
  TransactionsOutput, TransactionItem,
} from './payment-adapter.interface';

@Injectable()
export class AsaasPaymentAdapter implements IPaymentAdapter {
  private readonly logger = new Logger(AsaasPaymentAdapter.name);
  readonly bankCode = 'ASAAS';
  readonly bankName = 'Asaas (GestÃ£o Financeira)';
  readonly environment: string;

  private readonly baseUrl: string;
  private readonly apiKey: string;

  constructor(config?: Record<string, unknown>) {
    this.apiKey = (config?.apiKey as string) || process.env.ASAAS_API_KEY || '';
    this.baseUrl = (config?.baseUrl as string)
      || process.env.ASAAS_BASE_URL
      || 'https://api.asaas.com/v3';  // PadrÃ£o: PRODUÃ‡ÃƒO (nÃ£o sandbox)
    this.environment = this.baseUrl.includes('sandbox') ? 'sandbox' : 'production';
  }

  async pay(input: PayPixInput): Promise<PayPixOutput> {
    const cleanPayload = normalizePixInput(input.payload);
    this.logger.log(`[ASAAS] pay() â€” R$ ${input.amount} | payload[50]: ${cleanPayload.slice(0, 50)}`);

    // â”€â”€ EstratÃ©gia 1: decode â†’ pega ID â†’ paga com o ID (fluxo correto Asaas) â”€â”€
    // O Asaas requer que o QR seja decodificado primeiro; o pagamento usa o id
    // retornado pelo decode, nÃ£o o payload EMV bruto.
    const decoded = await this.decodeQrRaw(cleanPayload);
    if (decoded?.id) {
      this.logger.log(`[ASAAS] QR decodificado â€” asaas_id: ${decoded.id} | valor: ${decoded.totalValue ?? decoded.value ?? 'N/A'}`);
      const effectiveAmount = decoded.totalValue ?? decoded.value ?? decoded.originalValue ?? input.amount;
      const result = await this.payViaDecodedId(
        decoded.id,
        Number(effectiveAmount) || input.amount,
        input.amount,
        !!input.isDynamic,
      );
      if (result.success) return result;

      const requiresValueOnDynamicId =
        !!input.isDynamic &&
        !result.success &&
        /informe o valor a ser transferido/i.test(result.errorMessage || '');
      if (requiresValueOnDynamicId) {
        this.logger.warn('[ASAAS] payViaId dinÃ¢mico exigiu value â€” re-tentando com value...');
        const retryWithValue = await this.payViaDecodedId(
          decoded.id,
          Number(effectiveAmount) || input.amount,
          input.amount,
          true,
          true,
        );
        if (retryWithValue.success) return retryWithValue;
      }

      this.logger.warn(`[ASAAS] payViaId falhou (${result.errorCode}) â†’ tentando payload direto`);
    }

    // â”€â”€ EstratÃ©gia 2: payload direto (fallback â€” funciona em algumas configs) â”€â”€
    const directResult = await this.payViaPayload(cleanPayload, input.amount, !!input.isDynamic);
    if (directResult.success) return directResult;

    const requiresValueOnDynamicPayload =
      !!input.isDynamic &&
      !directResult.success &&
      /informe o valor a ser transferido/i.test(directResult.errorMessage || '');
    if (requiresValueOnDynamicPayload) {
      this.logger.warn('[ASAAS] payViaPayload dinÃ¢mico exigiu value â€” re-tentando com value...');
      const retryWithValue = await this.payViaPayload(cleanPayload, input.amount, true, true);
      if (retryWithValue.success) return retryWithValue;
    }

    // Regra de negócio: sem fallback para /transfers.
    // O pagamento deve ser liquidado apenas pelo QR enviado.
    return directResult;
  }

  // Decodifica o QR e retorna o objeto cru da Asaas (incluindo o `id` para pagamento)
  private async decodeQrRaw(payload: string): Promise<any | null> {
    try {
      const res = await fetch(`${this.baseUrl}/pix/qrCodes/decode`, {
        method: 'POST',
        headers: { 'access_token': this.apiKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ payload }),
      });
      if (!res.ok) {
        this.logger.warn(`[ASAAS] decodeQrRaw HTTP ${res.status}`);
        return null;
      }
      return await res.json();
    } catch (err: any) {
      this.logger.warn(`[ASAAS] decodeQrRaw error: ${err.message}`);
      return null;
    }
  }

  // Paga usando o ID retornado pelo decode (fluxo oficial Asaas)
  private async payViaDecodedId(
    qrCodeId: string,
    amount: number,
    fallbackAmount: number,
    isDynamic = false,
    forceValue = false,
  ): Promise<PayPixOutput> {
    try {
      const body: Record<string, unknown> = { qrCode: { id: qrCodeId } };
      if (!isDynamic || forceValue) {
        body.value = amount || fallbackAmount;
      }
      this.logger.log(`[ASAAS] payViaId â†’ id: ${qrCodeId} | modo: ${isDynamic ? 'DINAMICO' : 'ESTATICO'}${!isDynamic ? ` | R$ ${body.value}` : ''}`);

      const response = await fetch(`${this.baseUrl}/pix/qrCodes/pay`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'access_token': this.apiKey },
        body: JSON.stringify(body),
      });

      const rawText = await response.text();
      let data: any;
      try { data = JSON.parse(rawText); } catch { data = { message: rawText }; }

      if (!response.ok) {
        const code = data?.errors?.[0]?.code ?? null;
        const desc = data?.errors?.[0]?.description ?? data?.message ?? `HTTP ${response.status}`;
        this.logger.error(`[ASAAS] payViaId FAILED â€” ${response.status} | ${code} | ${rawText.slice(0, 300)}`);
        return { success: false, errorCode: `ASAAS_${response.status}`, errorMessage: desc, rawResponse: data };
      }

      // Asaas pode retornar HTTP 200 mas jÃ¡ com status de falha imediata
      const immediateStatus = String(data?.status || '').toUpperCase();
      if (['FAILED', 'CANCELLED', 'REFUSED', 'REJECTED', 'OVERDUE'].includes(immediateStatus)) {
        const failReason = data?.failureReason || data?.reason || data?.failReason || '';
        const desc = failReason || data?.errors?.[0]?.description || data?.message || immediateStatus;
        this.logger.error(`[ASAAS] payViaId HTTP 200 mas status ${immediateStatus} | motivo: ${failReason} | ${rawText.slice(0, 300)}`);
        return { success: false, errorCode: `ASAAS_${immediateStatus}`, errorMessage: desc, rawResponse: data };
      }

      this.logger.log(`[ASAAS] payViaId SUCCESS â€” id: ${data?.id} | status: ${data?.status}`);
      return { success: true, endToEndId: data?.endToEndId, bankStatus: data?.status, rawResponse: data };
    } catch (err: any) {
      return { success: false, errorCode: 'ASAAS_PAY_ID_ERROR', errorMessage: err.message };
    }
  }

  // Paga com payload EMV direto (compatibilidade â€” algumas versÃµes da API aceitam)
  private async payViaPayload(payload: string, amount: number, isDynamic = false, forceValue = false): Promise<PayPixOutput> {
    try {
      const body: Record<string, unknown> = { qrCode: { payload } };
      if (!isDynamic || forceValue) body.value = amount;
      const response = await fetch(`${this.baseUrl}/pix/qrCodes/pay`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'access_token': this.apiKey },
        body: JSON.stringify(body),
      });

      const rawText = await response.text();
      let data: any;
      try { data = JSON.parse(rawText); } catch { data = { message: rawText }; }

      if (!response.ok) {
        const code = data?.errors?.[0]?.code ?? null;
        const desc = data?.errors?.[0]?.description ?? data?.message ?? `HTTP ${response.status}`;
        this.logger.error(`[ASAAS] payViaPayload FAILED â€” ${response.status} | ${code} | ${rawText.slice(0, 300)}`);
        return { success: false, errorCode: `ASAAS_${response.status}`, errorMessage: desc, rawResponse: data };
      }

      const immediateStatus2 = String(data?.status || '').toUpperCase();
      if (['FAILED', 'CANCELLED', 'REFUSED', 'REJECTED', 'OVERDUE'].includes(immediateStatus2)) {
        const failReason = data?.failureReason || data?.reason || data?.failReason || '';
        const desc = failReason || data?.errors?.[0]?.description || data?.message || immediateStatus2;
        this.logger.error(`[ASAAS] payViaPayload HTTP 200 mas status ${immediateStatus2} | motivo: ${failReason} | ${rawText.slice(0, 300)}`);
        return { success: false, errorCode: `ASAAS_${immediateStatus2}`, errorMessage: desc, rawResponse: data };
      }

      this.logger.log(`[ASAAS] payViaPayload SUCCESS â€” id: ${data?.id} | status: ${data?.status}`);
      return { success: true, endToEndId: data?.endToEndId, bankStatus: data?.status, rawResponse: data };
    } catch (err: any) {
      return { success: false, errorCode: 'ASAAS_PAY_PAYLOAD_ERROR', errorMessage: err.message };
    }
  }

  async consultStatus(input: ConsultStatusInput): Promise<ConsultStatusOutput> {
    try {
      const response = await fetch(`${this.baseUrl}/pix/qrCodes/${input.endToEndId}`, {
        headers: { 'access_token': this.apiKey },
      });
      const data = (await response.json()) as AsaasResponse;
      return { status: (data.status === 'CONFIRMED' ? 'SUCCESS' : 'PENDING') as any, endToEndId: data.endToEndId, bankStatus: data.status, rawResponse: data };
    } catch (err) {
      return { status: 'FAILED', errorMessage: err.message };
    }
  }

  async cancel(input: CancelPaymentInput): Promise<CancelPaymentOutput> {
    return { success: false, errorCode: 'ASAAS_CANCEL_UNSUPPORTED', errorMessage: 'Asaas does not support cancellation via API' };
  }

  async refund(input: RefundPaymentInput): Promise<RefundPaymentOutput> {
    return { success: false, errorCode: 'ASAAS_REFUND_UNSUPPORTED', errorMessage: 'Asaas does not support refund via API' };
  }

  async getReceipt(input: GetReceiptInput): Promise<GetReceiptOutput> {
    try {
      const response = await fetch(`${this.baseUrl}/pix/qrCodes/${input.endToEndId}/receipt`, {
        headers: { 'access_token': this.apiKey },
      });
      const data = (await response.json()) as AsaasResponse;
      if (!response.ok) return { success: false, errorCode: `ASAAS_${response.status}`, errorMessage: data.message, rawResponse: data };
      return { success: true, receiptUrl: data.receiptUrl, receiptBase64: data.receiptBase64, receiptData: data, rawResponse: data };
    } catch (err) {
      return { success: false, errorCode: 'ASAAS_RECEIPT_ERROR', errorMessage: err.message };
    }
  }

  async getBalance(): Promise<BalanceOutput> {
    try {
      // â”€â”€ Saldo â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
      const balanceRes = await fetch(`${this.baseUrl}/finance/balance`, {
        headers: { 'access_token': this.apiKey },
      });

      if (!balanceRes.ok) {
        const errData = (await balanceRes.json()) as any;
        return {
          success: false, available: 0,
          errorMessage: errData.errors?.[0]?.description || errData.message || `HTTP ${balanceRes.status}`,
        };
      }

      const balanceData = (await balanceRes.json()) as any;
      this.logger.debug(`[Asaas] /finance/balance: ${JSON.stringify(balanceData)}`);
      const available = typeof balanceData.balance === 'number' ? balanceData.balance : 0;

      // â”€â”€ Dados da conta: /accounts â”€â”€
      let holderName = '';
      let agency: string | null = null;
      let account: string | null = null;
      let accountDigit: string | null = null;

      // 1a. Dados comerciais (Nome)
      try {
        const commRes = await fetch(`${this.baseUrl}/myAccount/commercialInfo`, {
          headers: { 'access_token': this.apiKey },
        });
        if (commRes.ok) {
          const commData = (await commRes.json()) as any;
          holderName = commData?.companyName || commData?.tradingName || commData?.name || '';
        }
      } catch (e) {}

      // 1b. NÃºmero da conta e agÃªncia
      try {
        const numRes = await fetch(`${this.baseUrl}/myAccount/accountNumber`, {
          headers: { 'access_token': this.apiKey },
        });
        if (numRes.ok) {
          const numData = (await numRes.json()) as any;
          agency = numData?.agency || null;
          account = numData?.account || numData?.accountNumber || null;
          accountDigit = numData?.accountDigit || null;
        }
      } catch (e) {}

      // 1c. Dados da conta via /accounts (fallback principal para subcontas white label)
      const accRes = await fetch(`${this.baseUrl}/accounts`, {
        headers: { 'access_token': this.apiKey },
      });
      if (accRes.ok) {
        const accPayload = (await accRes.json()) as any;
        this.logger.debug(`[Asaas] /accounts: ${JSON.stringify(accPayload)}`);
        const obj: any = accPayload?.object === 'list' && Array.isArray(accPayload?.data)
          ? (accPayload.data[0] ?? {})
          : (Array.isArray(accPayload) ? accPayload[0] : accPayload);
        const bankAccObj: any = obj?.bankAccount ?? obj?.accountNumber ?? {};
        
        if (!holderName) holderName = obj?.name || obj?.companyName || obj?.tradingName || '';
        if (!agency) agency = bankAccObj?.agency ?? obj?.agency ?? null;
        if (!account) account = bankAccObj?.account ?? obj?.account ?? null;
        if (!accountDigit) accountDigit = bankAccObj?.accountDigit ?? obj?.accountDigit ?? null;
      }

      return {
        success: true,
        available,
        total: available,
        currency: 'BRL',
        accountData: {
          name: holderName || undefined,
          agency: agency ?? undefined,
          account: account ?? undefined,
          accountDigit: accountDigit ?? undefined,
        },
        rawResponse: { balance: balanceData },
      };
    } catch (err) {
      return { success: false, available: 0, errorMessage: err.message };
    }
  }

  async validatePixKey(input: PixKeyValidationInput): Promise<PixKeyValidationOutput> {
    try {
      const response = await fetch(`${this.baseUrl}/pix/keys/${input.pixKey}`, {
        headers: { 'access_token': this.apiKey },
      });
      const data = (await response.json()) as AsaasResponse;
      return { success: true, isValid: response.ok, holderName: data.holderName, holderTaxId: data.holderTaxId, bankName: data.bankName, rawResponse: data };
    } catch (err) {
      return { success: false, isValid: false, errorMessage: err.message };
    }
  }

  async getTransactions(limit = 20, offset = 0): Promise<TransactionsOutput> {
    try {
      const response = await fetch(`${this.baseUrl}/payments?limit=${limit}&offset=${offset}`, {
        headers: { 'access_token': this.apiKey },
      });
      const data = (await response.json()) as any;
      if (!response.ok) {
        return { items: [], meta: { total: 0, page: 1, limit, totalPages: 0 }, error: data.errors?.[0]?.description || data.message || 'Erro na API Asaas' };
      }
      const rawItems: any[] = data.data || [];
      const items: TransactionItem[] = rawItems.map((t: any) => ({
        id: String(t.id),
        date: t.dateCreated || t.paymentDate || '',
        amount: typeof t.value === 'number' ? t.value : 0,
        type: t.billingType || 'PAYMENT',
        description: t.description || t.billingType || 'Cobranca Asaas',
        status: t.status || 'PENDING',
      }));
      const total = data.totalCount ?? rawItems.length;
      const page = Math.floor(offset / limit) + 1;
      return { items, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
    } catch (err) {
      return { items: [], meta: { total: 0, page: 1, limit, totalPages: 0 }, error: err.message };
    }
  }

  async decodeQr(payload: string): Promise<{
    amount?: number;
    merchantName?: string;
    merchantCity?: string;
    pixKey?: string;
    institutionName?: string;
    asaasStatus?: string;
    expirationDate?: string;
    txid?: string;
  } | null> {
    try {
      // Limpa payload antes de enviar ao Asaas
      const cleanPayload = normalizePixInput(payload);

      // Asaas /pix/qrCodes/decode espera POST com body { payload }, nÃ£o GET
      const res = await fetch(`${this.baseUrl}/pix/qrCodes/decode`, {
        method: 'POST',
        headers: {
          'access_token': this.apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ payload: cleanPayload }),
      });
      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        this.logger.warn(`[ASAAS] decodeQr falhou: HTTP ${res.status} â€” ${errText.slice(0, 200)}`);
        return null;
      }
      const data = await res.json() as any;
      this.logger.debug(`[ASAAS] decodeQr response: ${JSON.stringify(data).slice(0, 400)}`);

      // Asaas pode retornar amount em diferentes campos dependendo do tipo de PIX
      const rawValue =
        data.totalValue ?? data.value ?? data.amount ?? data.valor ??
        data.transactionAmount ?? data.payment?.value;
      const parsedAmount = rawValue != null ? parseFloat(String(rawValue)) : NaN;

      return {
        amount:          !isNaN(parsedAmount) && parsedAmount > 0 ? parsedAmount : undefined,
        merchantName:    data.merchant?.name ?? data.nome ?? data.creditorName ?? undefined,
        merchantCity:    data.merchant?.city ?? data.creditorCity ?? undefined,
        pixKey:          data.pixKey ?? data.key ?? data.creditorAccount?.pixKey ?? undefined,
        institutionName: data.merchant?.ispbName ?? data.creditorAccount?.ispbName ?? data.instituicao ?? undefined,
        asaasStatus:     data.status ?? undefined,
        expirationDate:  data.expirationDate ?? data.calendar?.expiry ?? undefined,
        txid:            data.txid ?? data.conciliationIdentifier ?? undefined,
      };
    } catch (err: any) {
      this.logger.warn(`[ASAAS] decodeQr erro: ${err.message}`);
      return null;
    }
  }

  getMetadata(): ProviderMetadata {
    return {
      bankCode: this.bankCode, bankName: this.bankName, environment: this.environment as any,
      features: [
        { name: 'pay', supported: true }, { name: 'consultStatus', supported: true },
        { name: 'cancel', supported: false }, { name: 'refund', supported: false },
        { name: 'getReceipt', supported: true }, { name: 'validatePixKey', supported: true },
      ],
      rateLimitPerMinute: 300, maxPaymentAmount: 50000, minPaymentAmount: 0.01,
    };
  }
}


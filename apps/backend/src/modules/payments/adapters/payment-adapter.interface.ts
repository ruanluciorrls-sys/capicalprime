// ── Payment Request/Response Types ──────────────────────────

export interface PayPixInput {
  payload: string;
  amount: number;
  pixKey: string;
  txid?: string;
  description?: string;
  /**
   * true = PIX dinâmico (URL no campo 26).
   * Quando true, o adapter NÃO envia o campo `value` para a Asaas — ela lê o valor
   * diretamente da URL do QR. Enviar `value` em PIX dinâmico com valor fixo pode
   * fazer a Asaas retornar "payload inválido" se o valor não bater exatamente.
   */
  isDynamic?: boolean;
}

export interface PayPixOutput {
  success: boolean;
  endToEndId?: string;
  bankStatus?: string;
  rawResponse?: unknown;
  errorCode?: string;
  errorMessage?: string;
}

export interface ConsultStatusInput {
  endToEndId: string;
  txid?: string;
  paymentId?: string;
}

export interface ConsultStatusOutput {
  status: 'PENDING' | 'PROCESSING' | 'SUCCESS' | 'FAILED' | 'REFUNDED' | 'CANCELLED';
  endToEndId?: string;
  bankStatus?: string;
  settledAt?: Date;
  amount?: number;
  rawResponse?: unknown;
  errorMessage?: string;
}

export interface CancelPaymentInput {
  endToEndId: string;
  txid?: string;
  reason?: string;
}

export interface CancelPaymentOutput {
  success: boolean;
  bankStatus?: string;
  rawResponse?: unknown;
  errorCode?: string;
  errorMessage?: string;
}

export interface RefundPaymentInput {
  endToEndId: string;
  amount?: number;
  reason?: string;
}

export interface RefundPaymentOutput {
  success: boolean;
  refundEndToEndId?: string;
  bankStatus?: string;
  rawResponse?: unknown;
  errorCode?: string;
  errorMessage?: string;
}

export interface GetReceiptInput {
  endToEndId: string;
  format?: 'pdf' | 'json' | 'html';
}

export interface GetReceiptOutput {
  success: boolean;
  receiptUrl?: string;
  receiptBase64?: string;
  receiptData?: unknown;
  rawResponse?: unknown;
  errorCode?: string;
  errorMessage?: string;
}

export interface BalanceOutput {
  success: boolean;
  available: number;
  blocked?: number;
  total?: number;
  currency?: string;
  accountData?: {
    name?: string;
    agency?: string;
    account?: string;
    accountDigit?: string;
  };
  rawResponse?: unknown;
  errorMessage?: string;
}

export interface TransactionItem {
  id: string;
  date: string;
  amount: number;
  type: 'CREDIT' | 'DEBIT' | string;
  description: string;
  status: string;
  balance?: number;
}

export interface TransactionsOutput {
  items: TransactionItem[];
  meta: { total: number; page: number; limit: number; totalPages: number };
  error?: string;
  message?: string;
}

export interface PixKeyValidationInput {
  pixKey: string;
  pixKeyType?: 'CPF' | 'CNPJ' | 'EMAIL' | 'PHONE' | 'EVP';
}

export interface PixKeyValidationOutput {
  success: boolean;
  isValid: boolean;
  holderName?: string;
  holderTaxId?: string;
  bankName?: string;
  rawResponse?: unknown;
  errorMessage?: string;
}

// ── Provider Metadata ───────────────────────────────────────

export interface ProviderFeature {
  name: string;
  supported: boolean;
  description?: string;
}

export interface ProviderMetadata {
  bankCode: string;
  bankName: string;
  environment: 'sandbox' | 'production';
  features: ProviderFeature[];
  rateLimitPerMinute: number;
  maxPaymentAmount: number;
  minPaymentAmount: number;
}

// ── Main Interface ──────────────────────────────────────────

export interface IPaymentAdapter {
  readonly bankCode: string;
  readonly bankName: string;
  readonly environment: string;

  // Core
  pay(input: PayPixInput): Promise<PayPixOutput>;
  consultStatus(input: ConsultStatusInput): Promise<ConsultStatusOutput>;

  // Management
  cancel?(input: CancelPaymentInput): Promise<CancelPaymentOutput>;
  refund?(input: RefundPaymentInput): Promise<RefundPaymentOutput>;

  // Receipts
  getReceipt?(input: GetReceiptInput): Promise<GetReceiptOutput>;

  // Account
  getBalance(): Promise<BalanceOutput>;
  getTransactions?(limit?: number, offset?: number): Promise<TransactionsOutput>;
  validatePixKey?(input: PixKeyValidationInput): Promise<PixKeyValidationOutput>;

  // Metadata
  getMetadata(): ProviderMetadata;
}

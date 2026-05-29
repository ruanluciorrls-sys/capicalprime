export interface AsaasResponse {
  status?: string;
  endToEndId?: string;
  errors?: Array<{ description: string }>;
  message?: string;
  receiptUrl?: string;
  receiptBase64?: string;
  balance?: number;
  holderName?: string;
  holderTaxId?: string;
  bankName?: string;
}

export interface BancoDoBrasilResponse {
  access_token?: string;
  expires_in?: number;
  status?: string;
  txid?: string;
  title?: string;
  message?: string;
}

export interface EfiResponse {
  access_token?: string;
  expires_in?: number;
  status?: string;
  txid?: string;
  error_description?: string;
  saldo?: string;
}

export interface InterResponse {
  access_token?: string;
  expires_in?: number;
  status?: string;
  txid?: string;
  title?: string;
  saldo_disponivel?: string;
  saldo_total?: string;
}

export interface MercadoPagoResponse {
  status?: string;
  id?: string | number;
  message?: string;
  date_approved?: string;
  transaction_amount?: number;
  available_balance?: number;
  total_balance?: number;
}

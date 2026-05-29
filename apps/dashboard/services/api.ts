'use client';

const API_PREFIX = '/api';

export interface UpdateBankConfigPayload {
  bankAdapter: string;
  bankConfig: Record<string, unknown>;
  dryRun?: boolean;
}

export interface BankConfigResponse {
  bankAdapter: string;
  bankConfig: {
    hasApiKey: boolean;
    maskedApiKey: string | null;
    environment?: 'sandbox' | 'production' | null;
    accountData?: Record<string, unknown> | null;
    accountHolderName?: string | null;
    agency?: string | null;
    accountNumber?: string | null;
    balance?: number | null;
    lastSyncAt?: string | null;
  };
}

export async function getMe(apiKey: string) {
  return fetch(`${API_PREFIX}/users/me`, {
    headers: { 'X-Api-Key': apiKey },
  });
}

export async function updateBankConfig(apiKey: string, payload: UpdateBankConfigPayload) {
  return fetch(`${API_PREFIX}/users/me/bank-config`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'X-Api-Key': apiKey,
    },
    body: JSON.stringify(payload),
  });
}

export async function updateAsaasConfig(
  apiKey: string,
  environment: 'production' | 'production2' | 'production3' | 'sandbox',
  payload: UpdateBankConfigPayload & { dryRun?: boolean }
) {
  return fetch(`${API_PREFIX}/users/me/bank-config/asaas/${environment}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'X-Api-Key': apiKey,
    },
    body: JSON.stringify(payload),
  });
}

export async function getBankConfig(apiKey: string) {
  return fetch(`${API_PREFIX}/users/me/bank-config`, {
    headers: { 'X-Api-Key': apiKey },
  });
}

export async function getBalance(apiKey: string) {
  return fetch(`${API_PREFIX}/payments/balance`, {
    headers: { 'X-Api-Key': apiKey },
  });
}

export async function getExtensions(apiKey: string) {
  return fetch(`${API_PREFIX}/extension/devices`, {
    headers: { 'X-Api-Key': apiKey },
  });
}

export async function revokeExtension(apiKey: string, deviceId: string) {
  return fetch(`${API_PREFIX}/extension/devices/${deviceId}`, {
    method: 'DELETE',
    headers: { 'X-Api-Key': apiKey },
  });
}

export async function testExtensionConnection(apiKey: string, deviceId: string) {
  return fetch(`${API_PREFIX}/extension/devices/${deviceId}/test`, {
    method: 'POST',
    headers: { 'X-Api-Key': apiKey },
  });
}

export async function downloadExtension(apiKey: string) {
  return fetch(`${API_PREFIX}/extension/download`, {
    headers: { 'X-Api-Key': apiKey },
  });
}

export async function updatePreferences(
  headers: Record<string, string>,
  prefs: { rotationInterval?: number; autoPayEnabled?: boolean; autoPayDelaySeconds?: number }
) {
  return fetch(`${API_PREFIX}/users/me/preferences`, {
    method: 'PATCH',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify(prefs),
  });
}

export async function getTransactions(apiKey: string, page = 1, limit = 20) {
  return fetch(`${API_PREFIX}/payments/asaas/transactions?page=${page}&limit=${limit}`, {
    headers: { 'X-Api-Key': apiKey },
  });
}

'use client';

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { getApiKey, authHeaders } from '@/lib/apiKey';
import { getBalance } from '@/services/api';

export type QrStatus = 'PENDING' | 'APPROVED' | 'PAYING' | 'REJECTED' | 'PAID' | 'ERROR' | 'CANCELLED' | 'RAW_CAPTURED';
export type PaymentStatus = 'PENDING' | 'PROCESSING' | 'SUCCESS' | 'FAILED';

export interface QrCode {
  id: string;
  payload: string;
  amount: number | null;
  merchantName: string | null;
  merchantCity: string | null;
  pixKey: string | null;
  transactionId: string | null;
  sourceUrl: string;
  status: QrStatus;
  capturedAt: string;
  deviceId: string | null;
  canPay: boolean;
  isRaw: boolean;
  // Campos preenchidos pelo Asaas decode (chegam via QR_ENRICHED)
  institutionName: string | null;
  asaasStatus: string | null;
  expirationDate: string | null;
}

export interface RawQrCapture {
  id: string;
  rawContent: string;
  sourceUrl: string | null;
  pageTitle: string | null;
  captureMethod: string | null;
  status: string;
  validationStatus: string;
  canPay: boolean;
  capturedAt: string;
  deviceId: string | null;
}

export interface Payment {
  id: string;
  qrCodeId: string;
  amount: number;
  status: PaymentStatus;
  adapterUsed: string;
  bankEnd2EndId: string | null;
  errorMessage: string | null;
  executedAt: string | null;
  createdAt: string;
  accountLabel: string | null;
}

interface QrStore {
  qrCodes: QrCode[];
  rawCaptures: RawQrCapture[];
  payments: Payment[];
  pendingCount: number;
  isConnected: boolean;
  availableBalance: number | null;

  // Actions
  addQr: (qr: QrCode) => void;
  addRawCapture: (capture: RawQrCapture) => void;
  updateQrStatus: (id: string, status: QrStatus, extra?: Partial<QrCode>) => void;
  addPayment: (payment: Payment) => void;
  updatePaymentStatus: (data: Partial<Payment> & { qrCodeId: string }) => void;
  setConnected: (connected: boolean) => void;
  initQrCodes: (qrs: QrCode[]) => void;
  initRawCaptures: (captures: RawQrCapture[]) => void;
  initPayments: (payments: Payment[]) => void;
  enrichQr: (id: string, data: Partial<QrCode>) => void;
  approveQr: (id: string) => Promise<void>;
  rejectQr: (id: string) => Promise<void>;
  cancelQr: (id: string) => Promise<void>;
  deleteRawCapture: (id: string) => Promise<void>;
  fetchBalance: () => Promise<void>;
}

export const useQrStore = create<QrStore>()(
  immer((set, get) => ({
    qrCodes: [],
    rawCaptures: [],
    payments: [],
    pendingCount: 0,
    isConnected: false,
    availableBalance: null,

    addQr: (qr) =>
      set((state) => {
        if (state.qrCodes.find((q) => q.id === qr.id)) return;
        state.qrCodes.unshift(qr);
        if (qr.status === 'PENDING') state.pendingCount++;
      }),

    addRawCapture: (capture) =>
      set((state) => {
        if (state.rawCaptures.find((c) => c.id === capture.id)) return;
        state.rawCaptures.unshift(capture);
      }),

    updateQrStatus: (id, status, extra) =>
      set((state) => {
        const qr = state.qrCodes.find((q) => q.id === id);
        if (!qr) return;
        const wasPending = qr.status === 'PENDING';
        qr.status = status;
        if (extra) Object.assign(qr, extra);
        if (wasPending && status !== 'PENDING') state.pendingCount = Math.max(0, state.pendingCount - 1);
        if (!wasPending && status === 'PENDING') state.pendingCount++;
      }),

    addPayment: (payment) =>
      set((state) => {
        const idx = state.payments.findIndex((p) => p.id === payment.id);
        if (idx >= 0) {
          state.payments[idx] = payment;
        } else {
          state.payments.unshift(payment);
        }
      }),

    updatePaymentStatus: (data) =>
      set((state) => {
        const payment = state.payments.find((p) => p.qrCodeId === data.qrCodeId);
        if (payment) Object.assign(payment, data);
        const qr = state.qrCodes.find((q) => q.id === data.qrCodeId);
        if (qr) {
          if (data.status === 'SUCCESS') qr.status = 'PAID';
          if (data.status === 'FAILED') qr.status = 'ERROR';
        }
      }),

    setConnected: (connected) =>
      set((state) => {
        state.isConnected = connected;
      }),

    initQrCodes: (qrs) =>
      set((state) => {
        state.qrCodes = qrs;
        state.pendingCount = qrs.filter((q) => q.status === 'PENDING').length;
      }),

    initRawCaptures: (captures) =>
      set((state) => {
        state.rawCaptures = captures;
      }),

    initPayments: (payments) =>
      set((state) => {
        state.payments = payments;
      }),

    enrichQr: (id, data) =>
      set((state) => {
        const qr = state.qrCodes.find((q) => q.id === id);
        if (qr) Object.assign(qr, data);
      }),

    approveQr: async (id) => {
      const res = await fetch(`/api/qr/${id}/approve`, {
        method: 'POST',
        headers: authHeaders(),
      });
      if (!res.ok) throw new Error('Falha ao aprovar QR Code');
      get().updateQrStatus(id, 'APPROVED');
    },

    rejectQr: async (id) => {
      const res = await fetch(`/api/qr/${id}/reject`, {
        method: 'POST',
        headers: authHeaders(),
      });
      if (!res.ok) throw new Error('Falha ao rejeitar QR Code');
      get().updateQrStatus(id, 'REJECTED');
    },

    cancelQr: async (id) => {
      const res = await fetch(`/api/qr/${id}`, {
        method: 'DELETE',
        headers: authHeaders(),
      });
      if (!res.ok) throw new Error('Falha ao cancelar QR Code');
      get().updateQrStatus(id, 'CANCELLED');
    },

    deleteRawCapture: async (id) => {
      const res = await fetch(`/api/qr/raw-capture/${id}`, {
        method: 'DELETE',
        headers: authHeaders(),
      });
      if (!res.ok) throw new Error('Falha ao excluir captura bruta');
      set((state) => {
        state.rawCaptures = state.rawCaptures.filter((c) => c.id !== id);
      });
    },

    fetchBalance: async () => {
      const apiKey = getApiKey();
      const res = await getBalance(apiKey);
      if (!res.ok) {
        set((state) => { state.availableBalance = null; });
        return;
      }
      const data = await res.json();
      set((state) => {
        // Se configured=false (sem API key), mantém null para não exibir R$ 0,00
        if (data?.configured === false) {
          state.availableBalance = null;
          return;
        }
        state.availableBalance = typeof data?.available === 'number' ? data.available : null;
      });
    },
  })),
);

'use client';

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { getApiKey, authHeaders } from '@/lib/apiKey';
import { getBalance } from '@/services/api';
import toast from 'react-hot-toast';

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
  serverStats: {
    pending: number;
    paid: number;
    rejected: number;
    totalAmountPaid: number;
  } | null;

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
  approveQr: (id: string, amount?: number) => Promise<void>;
  rejectQr: (id: string) => Promise<void>;
  cancelQr: (id: string) => Promise<void>;
  deleteRawCapture: (id: string) => Promise<void>;
  fetchBalance: () => Promise<void>;
  fetchStats: () => Promise<void>;
}

export const useQrStore = create<QrStore>()(
  immer((set, get) => ({
    qrCodes: [],
    rawCaptures: [],
    payments: [],
    pendingCount: 0,
    isConnected: false,
    availableBalance: null,
    serverStats: null,

    addQr: (qr) =>
      set((state) => {
        if (state.qrCodes.find((q) => q.id === qr.id)) return;
        
        // Ignora QRs brutos sem valor e sem destinatário (capturas sujas da extensão)
        if (qr.isRaw && !qr.amount && !qr.merchantName) return;

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
        const oldStatus = qr.status;
        
        qr.status = status;
        if (extra) Object.assign(qr, extra);
        if (wasPending && status !== 'PENDING') state.pendingCount = Math.max(0, state.pendingCount - 1);
        if (!wasPending && status === 'PENDING') state.pendingCount++;

        // Atualização otimista dos serverStats para manter o dashboard fluído
        if (state.serverStats) {
           if (status === 'PAID' && oldStatus !== 'PAID') {
             state.serverStats.paid++;
             state.serverStats.totalAmountPaid += (qr.amount || 0);
           }
           if (oldStatus === 'PAID' && status !== 'PAID') {
             state.serverStats.paid = Math.max(0, state.serverStats.paid - 1);
             state.serverStats.totalAmountPaid = Math.max(0, state.serverStats.totalAmountPaid - (qr.amount || 0));
           }
           if ((status === 'REJECTED' || status === 'ERROR') && oldStatus !== 'REJECTED' && oldStatus !== 'ERROR') {
             state.serverStats.rejected++;
           }
        }
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
        if (!payment) return;
        const oldStatus = payment.status;
        Object.assign(payment, data);

        // Atualização otimista caso seja PAYMENT_SUCCESS via socket e o QR não atualizou
        if (state.serverStats) {
          if (data.status === 'SUCCESS' && oldStatus !== 'SUCCESS') {
            state.serverStats.totalAmountPaid += Number(payment.amount || 0);
            state.serverStats.paid++;
          }
        }
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
        // Filtra QRs inúteis para não poluir o painel
        const validQrs = qrs.filter(q => !(q.isRaw && !q.amount && !q.merchantName));
        state.qrCodes = validQrs;
        state.pendingCount = validQrs.filter((q) => q.status === 'PENDING').length;
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

    approveQr: async (id, amount) => {
      const qr = get().qrCodes.find(q => q.id === id);
      if (!qr) throw new Error('QR não encontrado');
      
      const effectiveAmount = amount ?? qr.amount;
      const { availableBalance } = get();
      
      // Validação de saldo (evita enviar para o backend e dar erro na fila)
      if (effectiveAmount && availableBalance !== null && availableBalance < effectiveAmount) {
        const msg = `Saldo insuficiente na Asaas!\nVocê tem R$ ${availableBalance.toFixed(2).replace('.', ',')} e a cobrança é de R$ ${effectiveAmount.toFixed(2).replace('.', ',')}.`;
        toast.error(msg, {
          icon: '⚠️',
          duration: 5000,
          style: { background: '#090d16', color: '#f87171', border: '1px solid rgba(239, 68, 68, 0.3)' }
        });
        throw new Error(msg);
      }

      const res = await fetch(`/api/qr/${id}/approve`, {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: amount ? JSON.stringify({ amount }) : undefined,
      });
      if (!res.ok) throw new Error('Falha ao aprovar QR Code');
      
      // Subtrai o saldo localmente para refletir aprovações em massa ou rápidas
      if (effectiveAmount && availableBalance !== null) {
        set((state) => {
          if (state.availableBalance !== null) {
            state.availableBalance -= effectiveAmount;
          }
        });
      }
      
      get().updateQrStatus(id, 'APPROVED', amount ? { amount } : undefined);
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
        if (data?.configured === false) {
          state.availableBalance = null;
          return;
        }
        state.availableBalance = typeof data?.available === 'number' ? data.available : null;
      });
    },

    fetchStats: async () => {
      try {
        const res = await fetch('/api/qr/stats', { headers: authHeaders() });
        if (res.ok) {
          const data = await res.json();
          set((state) => {
            state.serverStats = {
              pending: data.pending + data.approved, // processando
              paid: data.paid,
              rejected: data.rejected + data.error + data.cancelled,
              totalAmountPaid: data.totalAmountPaid
            };
          });
        }
      } catch (err) {
        console.error('Failed to fetch stats', err);
      }
    },
  })),
);

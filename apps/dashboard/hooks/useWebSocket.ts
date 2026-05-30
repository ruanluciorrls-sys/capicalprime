'use client';

import { useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { useQrStore } from '@/store/qrStore';
import { useExtensionStore } from '@/store/extensionStore';
import { getApiKey, getAuthToken, clearAuth } from '@/lib/apiKey';
import toast from 'react-hot-toast';

// URL do WebSocket: usa variável de ambiente se disponível,
// senão detecta ambiente automaticamente (produção = fly.dev, dev = localhost)
const WS_URL = process.env.NEXT_PUBLIC_WS_URL
  ?? (typeof window !== 'undefined' && !window.location.hostname.includes('localhost')
    ? 'https://meu-backend-aios.fly.dev'
    : 'http://localhost:3001');

let socket: Socket | null = null;

export function useWebSocket() {
  const {
    addQr, addRawCapture, updateQrStatus, updatePaymentStatus,
    addPayment, setConnected, enrichQr, fetchBalance
  } = useQrStore();
  const { upsertDevice } = useExtensionStore();

  const initialized = useRef(false);

  const connect = useCallback(() => {
    if (socket?.connected) return;

    // Preferência: token JWT (login). Fallback: apiKey (legado).
    const token = getAuthToken();
    const apiKey = getApiKey();

    socket = io(WS_URL, {
      auth: token ? { token } : undefined,
      query: token ? undefined : { apiKey },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 10000,
      reconnectionAttempts: Infinity,
    });

    socket.on('connect', () => {
      console.log('[WS] Connected:', socket?.id);
      setConnected(true);
      toast.success('Conectado ao servidor de eventos real-time', {
        id: 'ws-conn-status',
        duration: 3000,
        style: {
          background: '#090d16',
          color: '#34d399',
          border: '1px solid rgba(52, 211, 153, 0.2)',
          borderRadius: '12px',
        }
      });
    });

    socket.on('disconnect', (reason) => {
      console.log('[WS] Disconnected:', reason);
      setConnected(false);
      toast.error('Conexão perdida. Tentando reconectar...', {
        id: 'ws-conn-status',
        duration: 4000,
        style: {
          background: '#090d16',
          color: '#f87171',
          border: '1px solid rgba(248, 113, 113, 0.2)',
          borderRadius: '12px',
        }
      });
    });

    socket.on('QR_RECEIVED', (event: any) => {
      const qr = event?.data ?? event;
      if (!qr?.id) return;
      addQr(qr);

      // In-app Toast notification
      const amountStr = qr.amount
        ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(qr.amount)
        : 'Valor em Aberto';

      toast.success(
        `Novo QR Pix Capturado!\n${amountStr} — ${qr.merchantName ?? 'Favorecido Desconhecido'}`,
        {
          id: `qr-${qr.id}`,
          duration: 5000,
          icon: '⚡',
          style: {
            background: '#090d16',
            color: '#f1f5f9',
            border: '1px solid rgba(59, 130, 246, 0.3)',
            borderRadius: '16px',
            boxShadow: '0 20px 25px -5px rgba(59, 130, 246, 0.1)',
            padding: '16px',
            whiteSpace: 'pre-line',
          }
        }
      );

      // Browser native notification (sem ícone — Chrome usa favicon como fallback)
      if (typeof window !== 'undefined' && 'Notification' in window) {
        if (Notification.permission === 'granted') {
          new Notification('👑 Capital Prime — Novo QR Pix', {
            body: qr.amount
              ? `R$ ${Number(qr.amount).toFixed(2)} — ${qr.merchantName ?? 'Favorecido desconhecido'}`
              : `QR Code de ${qr.merchantName ?? 'favorecido desconhecido'}`,
            tag: qr.id,
          });
        }
      }
    });

    socket.on('raw_qr_capture_created', (event: any) => {
      const capture = event?.data ?? event;
      if (!capture?.id) return;
      addRawCapture(capture);

      toast('Conteúdo Bruto Capturado', {
        id: `raw-${capture.id}`,
        duration: 4000,
        icon: '👀',
        style: {
          background: '#090d16',
          color: '#eab308',
          border: '1px solid rgba(234, 179, 8, 0.3)',
          borderRadius: '16px',
          padding: '16px',
        }
      });
    });

    socket.on('QR_STATUS_UPDATE', (event: any) => {
      const data = event?.data ?? event;
      if (!data?.id) return;
      updateQrStatus(data.id, data.status, data);
    });

    socket.on('PAYMENT_PENDING', (event: any) => {
      const d = event?.data ?? event;
      addPayment({ ...d, id: d.paymentId ?? d.id, status: 'PENDING' });
    });

    socket.on('PAYMENT_PROCESSING', (event: any) => {
      const d = event?.data ?? event;
      updatePaymentStatus({ ...d, id: d.paymentId ?? d.id, status: 'PROCESSING' });
      toast(`Pagamento aceito pelo Asaas. Aguardando confirmação BACEN...`, {
        id: `pay-${d.paymentId ?? d.id}`,
        icon: '⚡',
        duration: 3500,
        style: {
          background: '#0c1018',
          color: '#fbbf24',
          border: '1px solid rgba(245, 158, 11, 0.25)',
        }
      });
    });

    socket.on('PAYMENT_SUCCESS', (event: any) => {
      const d = event?.data ?? event;
      updatePaymentStatus({ ...d, id: d.paymentId ?? d.id });
      fetchBalance().catch(() => {});
      const amountStr = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(d.amount);
      toast.success(`Pagamento Concluído com sucesso:\n${amountStr}!`, {
        icon: '✅',
        duration: 5000,
        style: {
          background: '#090d16',
          color: '#10b981',
          border: '1px solid rgba(16, 185, 129, 0.3)',
          borderRadius: '16px',
          boxShadow: '0 20px 25px -5px rgba(16, 185, 129, 0.1)',
          padding: '16px',
          whiteSpace: 'pre-line',
        }
      });
    });

    socket.on('PAYMENT_FAILED', (event: any) => {
      const d = event?.data ?? event;
      updatePaymentStatus({ ...d, id: d.paymentId ?? d.id });
      fetchBalance().catch(() => {});
      toast.error(`Pagamento Falhou:\n${d.errorMessage ?? 'Erro inesperado'}`, {
        icon: '🚨',
        duration: 6000,
        style: {
          background: '#090d16',
          color: '#f87171',
          border: '1px solid rgba(239, 68, 68, 0.3)',
          borderRadius: '16px',
          boxShadow: '0 20px 25px -5px rgba(239, 68, 68, 0.1)',
          padding: '16px',
          whiteSpace: 'pre-line',
        }
      });
    });

    socket.on('extension.status.update', (event: any) => {
      const device = event?.data ?? event;
      if (!device?.deviceId) return;
      upsertDevice(device);
    });

    socket.on('QR_ENRICHED', (event: any) => {
      const data = event?.data ?? event;
      if (!data?.id) return;
      enrichQr(data.id, data);
    });

    socket.on('DEVICE_ONLINE', (event: any) => {
      const data = event?.data ?? event;
      if (!data?.deviceId) return;
      upsertDevice({ deviceId: data.deviceId, isOnline: true });
    });

    socket.on('DEVICE_OFFLINE', (event: any) => {
      const data = event?.data ?? event;
      if (!data?.deviceId) return;
      upsertDevice({ deviceId: data.deviceId, isOnline: false });
    });

    // Sessão revogada (login em outro dispositivo ou ação admin)
    socket.on('SESSION_REVOKED', (event: any) => {
      const reason = event?.reason ?? 'Sua sessão foi encerrada.';
      toast.error(reason, {
        id: 'session-revoked',
        duration: 6000,
        icon: '🔒',
        style: {
          background: '#090d16',
          color: '#f87171',
          border: '1px solid rgba(239, 68, 68, 0.3)',
          borderRadius: '16px',
          padding: '16px',
        }
      });
      clearAuth();
      setTimeout(() => { window.location.href = '/login'; }, 1500);
    });
  }, [addQr, addRawCapture, updateQrStatus, updatePaymentStatus, addPayment, setConnected, upsertDevice, enrichQr, fetchBalance]);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    if (typeof window !== 'undefined' && 'Notification' in window) {
      Notification.requestPermission();
    }

    connect();

    return () => {
      // Don't disconnect on component unmount (singleton)
    };
  }, [connect]);

  return { isConnected: socket?.connected ?? false, socket };
}

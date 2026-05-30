'use client';

import { useWebSocket } from '@/hooks/useWebSocket';
import { useQrStore } from '@/store/qrStore';
import { useAsaasStore } from '@/store/asaasStore';
import { useEffect, useState } from 'react';
import { authHeaders } from '@/lib/apiKey';
import { WifiOff } from 'lucide-react';

export function RealtimeProvider({ children }: { children: React.ReactNode }) {
  useWebSocket();

  const { initQrCodes, initRawCaptures, initPayments, fetchBalance, fetchStats } = useQrStore();
  const { fetchAsaasData } = useAsaasStore();
  const [backendOk, setBackendOk] = useState<boolean | null>(null);

  // Load initial data on mount
  useEffect(() => {
    const headers = authHeaders();

    // Health check first
    fetch('/api/health')
      .then(r => setBackendOk(r.ok))
      .catch(() => setBackendOk(false));

    Promise.all([
      fetch('/api/qr?limit=50',         { headers }),
      fetch('/api/qr/raw-captures',     { headers }),
      fetch('/api/payments?limit=20',   { headers }),
    ])
      .then(async ([qrRes, rawRes, payRes]) => {
        if (qrRes.ok) {
          const data = await qrRes.json();
          initQrCodes(data.items ?? []);
        }
        if (rawRes.ok) {
          const data = await rawRes.json();
          initRawCaptures(data ?? []);
        }
        if (payRes.ok) {
          const data = await payRes.json();
          initPayments(data.items ?? []);
        }
      })
      .catch(console.error);
    fetchBalance().catch(console.error);
    fetchStats().catch(console.error);
    fetchAsaasData().catch(console.error);

    // Polling de dados Asaas a cada 30 segundos
    const asaasInterval = window.setInterval(() => {
      fetchAsaasData().catch(console.error);
    }, 30000);

    const interval = window.setInterval(() => {
      fetchBalance().catch(console.error);
      fetchStats().catch(console.error);
    }, 60000);

    return () => {
      window.clearInterval(interval);
      window.clearInterval(asaasInterval);
    };
  }, [initQrCodes, initRawCaptures, initPayments, fetchBalance, fetchStats]);

  if (backendOk === false) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-950">
        <div className="text-center space-y-4 animate-fade-in">
          <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto">
            <WifiOff className="w-8 h-8 text-red-400" />
          </div>
          <h2 className="text-xl font-bold text-white">Backend Indisponível</h2>
          <p className="text-gray-400 text-sm max-w-sm">
            Não foi possível conectar ao backend em <code className="text-blue-400">localhost:3001</code>.
            Certifique-se de que o servidor NestJS está rodando.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="btn-primary mx-auto"
          >
            Tentar novamente
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

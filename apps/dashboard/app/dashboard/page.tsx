'use client';

import { useQrStore } from '@/store/qrStore';
import { useAsaasStore } from '@/store/asaasStore';
import { QrQueue } from '@/components/qr/QrQueue';
import { ManualQrPay } from '@/components/qr/ManualQrPay';
import { StatsGrid } from '@/components/dashboard/StatsGrid';
import { RecentPayments } from '@/components/dashboard/RecentPayments';
import { Activity, Zap } from 'lucide-react';
import { useEffect, useMemo } from 'react';

export default function DashboardPage() {
  const { pendingCount, qrCodes, rawCaptures } = useQrStore();
  const { fetchAsaasData } = useAsaasStore();

  const hasPending = useMemo(() =>
    qrCodes.some(q => q.status === 'PENDING' || q.status === 'RAW_CAPTURED') ||
    rawCaptures.some(c => c.validationStatus === 'pending_validation'),
    [qrCodes, rawCaptures]
  );

  useEffect(() => {
    fetchAsaasData();
    const timer = window.setInterval(() => fetchAsaasData(), 30000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Dashboard</h1>
          <p className="text-gray-400 mt-1 text-sm">Monitoramento em tempo real de QR Codes Pix</p>
        </div>

        {pendingCount > 0 && (
          <div className="flex items-center gap-2 px-4 py-2 bg-amber-500/10 border border-amber-500/20 rounded-xl">
            <div className="pulse-dot amber" />
            <span className="text-amber-400 text-sm font-medium">
              {pendingCount} aguardando aprovação
            </span>
          </div>
        )}
      </div>

      {/* Stats */}
      <StatsGrid />

      {/* Fila de Aprovação + Pagamento Manual */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <Zap className="w-4 h-4 text-amber-400" />
          <h2 className="text-lg font-semibold text-white">Fila de Aprovação</h2>
          {pendingCount > 0 && (
            <span className="badge-pending">{pendingCount}</span>
          )}
        </div>

        {hasPending ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            <div className="lg:col-span-2">
              <QrQueue />
            </div>
            <div className="lg:col-span-1">
              <ManualQrPay />
            </div>
          </div>
        ) : (
          <ManualQrPay />
        )}
      </section>

      {/* Recent Payments */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <Activity className="w-4 h-4 text-violet-400" />
          <h2 className="text-lg font-semibold text-white">Pagamentos Recentes</h2>
        </div>
        <RecentPayments />
      </section>
    </div>
  );
}

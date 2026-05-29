'use client';

import { useEffect, useState } from 'react';
import { Landmark, PlugZap } from 'lucide-react';
import { useAsaasStore } from '@/store/asaasStore';
import Link from 'next/link';

/** Retorna "Primeiro Último" (máx 2 palavras) */
const shortName = (name: string | null | undefined): string => {
  if (!name) return 'Conta Asaas';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return parts.slice(0, 2).join(' ');
};

export function AsaasSummary() {
  const { isConnected, productionConfig, sandboxConfig, fetchAsaasData } = useAsaasStore();
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    setLoading(true);
    await fetchAsaasData();
    setLoading(false);
  };

  useEffect(() => {
    refresh();
    window.addEventListener('asaas-config-updated', refresh);
    return () => window.removeEventListener('asaas-config-updated', refresh);
  }, []);

  if (loading) {
    return (
      <div
        className="flex items-center gap-2 rounded-xl px-3 py-2 animate-pulse"
        style={{ background: 'rgba(16,185,129,0.04)', border: '1px solid rgba(16,185,129,0.10)' }}
      >
        <span className="h-4 w-4 rounded-full bg-slate-700" />
        <div className="h-3 w-20 bg-slate-700 rounded" />
      </div>
    );
  }

  if (!isConnected) {
    return (
      <Link
        href="/dashboard/settings"
        className="flex items-center gap-1.5 rounded-xl px-3 py-2 hover:opacity-80 transition cursor-pointer"
        style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.18)' }}
      >
        <PlugZap className="w-3.5 h-3.5 text-amber-400" />
        <span className="hidden sm:inline text-amber-400 text-xs font-medium">Conectar Asaas</span>
      </Link>
    );
  }

  const accountHolderName = productionConfig?.accountHolderName || sandboxConfig?.accountHolderName;
  const agency = productionConfig?.agency || sandboxConfig?.agency;
  const accountNumber = productionConfig?.accountNumber || sandboxConfig?.accountNumber;

  return (
    <Link href="/dashboard/settings" className="block hover:opacity-85 transition">
      <div
        className="flex items-center gap-2 rounded-xl px-3 py-2"
        style={{
          background: 'rgba(16,185,129,0.06)',
          border: '1px solid rgba(16,185,129,0.18)',
        }}
      >
        <div
          className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ background: 'rgba(16,185,129,0.14)', border: '1px solid rgba(16,185,129,0.25)' }}
        >
          <Landmark className="w-3 h-3 text-emerald-400" />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-bold text-white leading-none truncate" style={{ maxWidth: 140 }}>
            {shortName(accountHolderName)}
          </p>
          <p className="text-[10px] font-mono leading-none mt-0.5" style={{ color: 'rgba(148,163,184,0.55)' }}>
            {agency || '—'} / {accountNumber || '—'}
          </p>
        </div>
      </div>
    </Link>
  );
}

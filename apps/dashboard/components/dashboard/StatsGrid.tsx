'use client';

import { useQrStore } from '@/store/qrStore';
import { CheckCircle2, Clock, XCircle, DollarSign } from 'lucide-react';

interface StatCardProps {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  accent: string;        // CSS color
  accentBg: string;      // rgba bg
  accentBorder: string;  // rgba border
}

function StatCard({ label, value, icon, accent, accentBg, accentBorder }: StatCardProps) {
  return (
    <div
      className="rounded-2xl p-5 flex flex-col gap-4 transition-all duration-300 group cursor-default"
      style={{
        background: 'var(--surface-1)',
        border: `1px solid ${accentBorder}`,
        boxShadow: `0 4px 24px -8px rgba(0,0,0,0.5)`,
      }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)';
        (e.currentTarget as HTMLElement).style.boxShadow = `0 8px 32px -8px rgba(0,0,0,0.6), 0 0 0 1px ${accentBorder}`;
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLElement).style.transform = '';
        (e.currentTarget as HTMLElement).style.boxShadow = `0 4px 24px -8px rgba(0,0,0,0.5)`;
      }}
    >
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold tracking-widest uppercase" style={{ color: 'rgba(148,163,184,0.7)' }}>
          {label}
        </span>
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center transition-transform duration-300 group-hover:scale-110"
          style={{ background: accentBg, color: accent }}
        >
          {icon}
        </div>
      </div>
      <span className="text-3xl font-black tracking-tight text-white">{value}</span>
    </div>
  );
}

export function StatsGrid() {
  const { qrCodes, payments } = useQrStore();

  const stats = {
    pending:    qrCodes.filter(q => q.status === 'PENDING' || q.status === 'APPROVED' || q.status === 'PAYING').length,
    approved:   qrCodes.filter(q => q.status === 'PAID').length,
    rejected:   qrCodes.filter(q => q.status === 'REJECTED' || q.status === 'ERROR' || q.status === 'CANCELLED').length,
    amountPaid: payments.filter(p => p.status === 'SUCCESS').reduce((acc, p) => acc + p.amount, 0),
  };

  const BRL = (n: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n);

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 animate-fade-in">
      <StatCard
        label="Processando"
        value={stats.pending}
        icon={<Clock className="w-4 h-4" />}
        accent="#fbbf24"
        accentBg="rgba(245,158,11,0.12)"
        accentBorder="rgba(245,158,11,0.18)"
      />
      <StatCard
        label="Concluídas"
        value={stats.approved}
        icon={<CheckCircle2 className="w-4 h-4" />}
        accent="#34d399"
        accentBg="rgba(16,185,129,0.12)"
        accentBorder="rgba(16,185,129,0.18)"
      />
      <StatCard
        label="Rejeitadas / Falhas"
        value={stats.rejected}
        icon={<XCircle className="w-4 h-4" />}
        accent="#f87171"
        accentBg="rgba(239,68,68,0.12)"
        accentBorder="rgba(239,68,68,0.18)"
      />
      <StatCard
        label="Total Pago"
        value={BRL(stats.amountPaid)}
        icon={<DollarSign className="w-4 h-4" />}
        accent="#fcd34d"
        accentBg="rgba(245,158,11,0.10)"
        accentBorder="rgba(245,158,11,0.22)"
      />
    </div>
  );
}

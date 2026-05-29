'use client';

import Link from 'next/link';
import { useState, useRef, useEffect } from 'react';
import { useQrStore } from '@/store/qrStore';
import { useAsaasStore } from '@/store/asaasStore';
import { Crown, Bell, Wallet, Wifi, WifiOff, ChevronDown } from 'lucide-react';
import clsx from 'clsx';
import { AsaasSummary } from '@/components/asaas/AsaasSummary';

const BRL = (n: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n);

function shortName(name: string | null) {
  if (!name) return 'Conta';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[parts.length - 1]}`;
}

export default function Header() {
  const { isConnected, pendingCount, availableBalance } = useQrStore();
  const { balance: asaasBalance, productionConfig, production2Config, production3Config, sandboxConfig, connectedCount } = useAsaasStore();

  // Saldo principal: live (fetchBalance, atualiza a cada 60s) com fallback para o armazenado.
  // Usamos comparação explícita com null/undefined para não deixar 0 substituir um valor real.
  const primaryBalance = availableBalance !== null && availableBalance !== undefined
    ? availableBalance
    : (asaasBalance !== null && asaasBalance !== undefined ? asaasBalance : null);

  // Lista de contas de PRODUÇÃO conectadas para o dropdown (sandbox excluído)
  const allAccounts = [
    { label: productionConfig?.accountHolderName ?? 'Conta Principal', balance: productionConfig?.balance ?? null, connected: productionConfig?.connected ?? false },
    { label: production2Config?.accountHolderName ?? 'Conta 2',        balance: production2Config?.balance ?? null, connected: production2Config?.connected ?? false },
    { label: production3Config?.accountHolderName ?? 'Conta 3',        balance: production3Config?.balance ?? null, connected: production3Config?.connected ?? false },
  ].filter(a => a.connected);

  const [showBalanceDropdown, setShowBalanceDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showBalanceDropdown) return;
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowBalanceDropdown(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showBalanceDropdown]);

  return (
    <header
      className="flex items-center justify-between px-6 py-4 relative z-30"
      style={{
        background: 'rgba(6,9,15,0.85)',
        borderBottom: '1px solid var(--border-subtle)',
        backdropFilter: 'blur(16px)',
      }}
    >
      {/* Left: brand (mobile only) */}
      <div className="md:hidden flex items-center gap-2.5">
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center"
          style={{ background: 'linear-gradient(135deg,#f59e0b,#d97706)', boxShadow: '0 2px 10px rgba(245,158,11,0.4)' }}
        >
          <Crown className="w-3.5 h-3.5 text-white" />
        </div>
        <span
          className="gold-text font-black tracking-widest uppercase text-sm"
          style={{ fontFamily: 'var(--font-playfair), serif' }}
        >
          Capital Prime
        </span>
      </div>

      {/* Desktop: Capital Prime no centro */}
      <div className="hidden md:flex flex-col items-center select-none pointer-events-none absolute left-1/2 transform -translate-x-1/2">
        <span
          className="gold-text font-black uppercase tracking-widest leading-none"
          style={{ fontSize: '22px', fontFamily: 'var(--font-playfair), serif', letterSpacing: '0.22em' }}
        >
          Capital Prime
        </span>
        <span
          className="text-[11px] font-bold tracking-[0.45em] uppercase mt-1"
          style={{ color: 'rgba(245,158,11,0.50)' }}
        >
          Pix Dashboard
        </span>
      </div>

      {/* Right controls: Balance & Account Info */}
      <div className="flex items-center gap-3 ml-auto">
        {/* Saldo — clicável, com dropdown multi-conta */}
        {primaryBalance !== null && (
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => connectedCount > 1 ? setShowBalanceDropdown(s => !s) : undefined}
              className="flex items-center gap-2 px-3 py-2 rounded-xl font-bold font-mono transition-all hover:scale-[1.02]"
              style={{
                background: 'rgba(52,211,153,0.06)',
                border: '1px solid rgba(52,211,153,0.22)',
                color: '#34d399',
                fontSize: '14px',
                boxShadow: '0 2px 12px rgba(52,211,153,0.08)',
                cursor: connectedCount > 1 ? 'pointer' : 'default',
              }}
            >
              <Wallet className="w-4 h-4 text-emerald-400" />
              {BRL(primaryBalance)}
              {connectedCount > 1 && (
                <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showBalanceDropdown ? 'rotate-180' : ''}`} />
              )}
            </button>

            {/* Dropdown — todas as contas conectadas (alinhado à direita) */}
            {showBalanceDropdown && connectedCount > 1 && (
              <div
                className="absolute right-0 top-full mt-2 rounded-xl overflow-hidden animate-fade-in z-50"
                style={{
                  background: 'var(--surface-1)',
                  border: '1px solid rgba(16,185,129,0.18)',
                  boxShadow: '0 16px 40px -8px rgba(0,0,0,0.7)',
                  minWidth: '220px',
                }}
              >
                <div className="px-3 py-2 border-b" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Contas Conectadas</p>
                </div>
                {allAccounts.map((acc, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between px-4 py-2.5 gap-3"
                    style={{ borderBottom: i < allAccounts.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}
                  >
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-white truncate">{shortName(acc.label)}</p>
                    </div>
                    <span
                      className="text-xs font-bold font-mono flex-shrink-0"
                      style={{ color: '#34d399' }}
                    >
                      {acc.balance !== null ? BRL(acc.balance) : '—'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Informações da Conta Asaas */}
        <AsaasSummary />

        {/* Pendentes badge */}
        {pendingCount > 0 && (
          <div
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-bold animate-pulse"
            style={{
              background: 'rgba(245,158,11,0.10)',
              border: '1px solid rgba(245,158,11,0.25)',
              color: '#fbbf24',
            }}
          >
            <Bell className="w-3.5 h-3.5" />
            {pendingCount} pendente{pendingCount > 1 ? 's' : ''}
          </div>
        )}
      </div>
    </header>
  );
}

'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useQrStore } from '@/store/qrStore';
import { getAuthUser, clearAuth, authHeaders, AuthUser } from '@/lib/apiKey';
import {
  LayoutDashboard, Clock, CreditCard, Settings,
  Wifi, WifiOff, Crown, Monitor, Users, ShieldCheck, LogOut, KeyRound, HelpCircle,
} from 'lucide-react';
import clsx from 'clsx';
import { ChangePasswordModal } from '@/components/auth/ChangePasswordModal';

const baseNav = [
  { href: '/dashboard',            label: 'Dashboard',              icon: LayoutDashboard, roles: ['MASTER_ADMIN','ADMIN','USER','VIEWER'] },
  { href: '/dashboard/qr-queue',   label: 'Fila QR',                icon: Clock,           roles: ['MASTER_ADMIN','ADMIN','USER'] },
  { href: '/dashboard/payments',   label: 'Pagamentos / Histórico', icon: CreditCard,      roles: ['MASTER_ADMIN','ADMIN','USER','VIEWER'] },
  { href: '/dashboard/extensions', label: 'Extensões',              icon: Monitor,         roles: ['MASTER_ADMIN','ADMIN','USER'] },
  { href: '/dashboard/admin',      label: 'Admin',                  icon: ShieldCheck,     roles: ['MASTER_ADMIN','ADMIN'] },
  { href: '/dashboard/users',      label: 'Usuários',               icon: Users,           roles: ['MASTER_ADMIN','ADMIN'] },
  { href: '/dashboard/support',    label: 'Suporte',                icon: HelpCircle,      roles: ['MASTER_ADMIN','ADMIN','USER','VIEWER'] },
  { href: '/dashboard/settings',   label: 'Configurações',          icon: Settings,        roles: ['MASTER_ADMIN','ADMIN','USER'] },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { pendingCount, isConnected } = useQrStore();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [showPwdModal, setShowPwdModal] = useState(false);

  useEffect(() => {
    setUser(getAuthUser());
  }, []);

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST', headers: authHeaders() });
    } catch {}
    clearAuth();
    router.replace('/login');
  };

  const navItems = user
    ? baseNav.filter(n => n.roles.includes(user.role))
    : baseNav.filter(n => n.roles.includes('USER'));

  return (
    <aside
      className="w-60 flex-shrink-0 flex flex-col z-20"
      style={{
        background: 'var(--surface-1)',
        borderRight: '1px solid var(--border-subtle)',
      }}
    >
      {/* Brand */}
      <div
        className="flex flex-col items-center justify-center gap-2 px-5 py-5 text-center"
        style={{ borderBottom: '1px solid var(--border-subtle)' }}
      >
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 hover:scale-105 transition-transform duration-300"
          style={{
            background: 'linear-gradient(135deg,#f59e0b,#d97706)',
            boxShadow: '0 4px 16px rgba(245,158,11,0.40)',
          }}
        >
          <Crown className="w-4.5 h-4.5 text-white" />
        </div>
        <div className="min-w-0">
          <span
            className="block gold-text font-black tracking-[0.20em] uppercase text-[20px] leading-tight"
            style={{ fontFamily: 'var(--font-playfair), serif' }}
          >
            Capital Prime
          </span>
          <span className="section-label text-[10px] mt-0.5 block tracking-[0.35em]">Pix Dashboard</span>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
        {navItems.map(({ href, label, icon: Icon }) => {
          const isActive = pathname === href || (href !== '/dashboard' && pathname.startsWith(href));
          const isAdminLink = label === 'Admin';
          return (
            <Link
              key={href}
              href={href}
              className={clsx(
                'flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-medium transition-all duration-200',
                isActive ? (isAdminLink ? 'text-amber-200' : 'text-amber-300') : 'text-slate-500 hover:text-slate-200'
              )}
              style={isActive ? {
                background: 'rgba(245,158,11,0.10)',
                borderLeft: '2px solid rgba(245,158,11,0.6)',
                paddingLeft: '10px',
              } : {}}
            >
              <Icon className={clsx('w-4 h-4 flex-shrink-0', isActive ? 'text-amber-400' : 'text-slate-600')} />
              <span className="flex-1 truncate">{label}</span>
              {label === 'Fila QR' && pendingCount > 0 && (
                <span
                  className="text-[10px] font-black px-1.5 py-0.5 rounded-full"
                  style={{
                    background: 'linear-gradient(135deg,#f59e0b,#d97706)',
                    color: '#fff',
                    boxShadow: '0 1px 6px rgba(245,158,11,0.4)',
                  }}
                >
                  {pendingCount}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* User card + logout */}
      {user && (
        <div className="p-3 space-y-2" style={{ borderTop: '1px solid var(--border-subtle)' }}>
          <div
            className="rounded-xl px-3 py-2.5 flex items-center gap-2.5"
            style={{ background: 'var(--surface-2)' }}
          >
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{
                background: user.role === 'MASTER_ADMIN' ? 'rgba(245,158,11,0.20)' : 'rgba(148,163,184,0.10)',
                color: user.role === 'MASTER_ADMIN' ? '#fcd34d' : '#94a3b8',
              }}
            >
              {user.role === 'MASTER_ADMIN' ? <Crown className="w-3.5 h-3.5" /> : <Users className="w-3.5 h-3.5" />}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs text-white font-semibold truncate">{user.name}</p>
              <p className="text-[10px] text-slate-500 truncate">
                {user.role === 'MASTER_ADMIN' ? '👑 Master Admin' :
                  user.subscriptionDaysRemaining != null
                    ? `${user.subscriptionDaysRemaining}d restantes`
                    : 'Sem assinatura'}
              </p>
            </div>
          </div>

          {/* Connection */}
          <div
            className={clsx(
              'flex items-center gap-2 px-3 py-1.5 rounded-xl text-[10px] font-semibold',
              isConnected ? 'text-emerald-400' : 'text-red-400'
            )}
            style={{
              background: isConnected ? 'rgba(16,185,129,0.07)' : 'rgba(239,68,68,0.07)',
              border: isConnected ? '1px solid rgba(16,185,129,0.15)' : '1px solid rgba(239,68,68,0.15)',
            }}
          >
            {isConnected
              ? <><Wifi className="w-3 h-3 animate-pulse" /> Realtime ativo</>
              : <><WifiOff className="w-3 h-3" /> Reconectando...</>}
          </div>

          <div className="flex gap-1">
            <button
              onClick={() => setShowPwdModal(true)}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-[11px] font-medium text-slate-500 hover:text-amber-400 transition-colors"
              style={{ background: 'rgba(245,158,11,0.04)', border: '1px solid rgba(245,158,11,0.08)' }}
              title="Alterar minha senha"
            >
              <KeyRound className="w-3 h-3" />
              Senha
            </button>
            <button
              onClick={handleLogout}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-[11px] font-medium text-slate-500 hover:text-red-400 transition-colors"
              style={{ background: 'rgba(239,68,68,0.04)', border: '1px solid rgba(239,68,68,0.08)' }}
            >
              <LogOut className="w-3 h-3" />
              Sair
            </button>
          </div>
        </div>
      )}

      {showPwdModal && <ChangePasswordModal onClose={() => setShowPwdModal(false)} />}
    </aside>
  );
}

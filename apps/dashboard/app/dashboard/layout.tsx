'use client';

import { usePathname } from 'next/navigation';
import { Sidebar } from '@/components/layout/Sidebar';
import { RealtimeProvider } from '@/components/layout/RealtimeProvider';
import Header from '@/components/layout/Header';
import { QrLiveDrawer } from '@/components/qr/QrLiveDrawer';
import { AuthGuard } from '@/components/auth/AuthGuard';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isQrQueuePage = pathname === '/dashboard/qr-queue';

  return (
    <AuthGuard>
    <RealtimeProvider>
      <div className="flex h-screen overflow-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-slate-100 antialiased">
        <Sidebar />
        <div className="flex-1 flex flex-col overflow-hidden">
          <Header />
          <main className="flex-1 overflow-y-auto">
            <div className="p-6 lg:p-8 max-w-7xl mx-auto">
              {children}
            </div>
          </main>
        </div>
      </div>
      {/* Não exibe o botão flutuante QRs na página de Fila QR (funcionalidade duplicada) */}
      {!isQrQueuePage && <QrLiveDrawer />}
    </RealtimeProvider>
    </AuthGuard>
  );
}


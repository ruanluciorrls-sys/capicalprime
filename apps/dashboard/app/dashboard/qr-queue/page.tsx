'use client';

import { QrQueue } from '@/components/qr/QrQueue';

export default function QrQueuePage() {
  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-white">Fila de QR Codes</h1>
        <p className="text-gray-400 mt-1">Aprove ou rejeite as capturas recebidas da extensão.</p>
      </div>

      <QrQueue />
    </div>
  );
}

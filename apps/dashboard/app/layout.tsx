import type { Metadata } from 'next';
import { Toaster } from 'react-hot-toast';
import './globals.css';

export const metadata: Metadata = {
  title: 'Capital Prime — Pix Dashboard',
  description: 'Sistema de captura e aprovação automática de QR Codes Pix em tempo real',
  keywords: ['Pix', 'QR Code', 'pagamentos', 'automação'],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@100..900&family=Playfair+Display:ital,wght@0,400..900;1,400..900&display=swap" rel="stylesheet" />
        <style dangerouslySetInnerHTML={{__html: `
          :root {
            --font-inter: 'Inter', system-ui, sans-serif;
            --font-playfair: 'Playfair Display', serif;
          }
        `}} />
      </head>
      <body className="bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-slate-100 antialiased min-h-screen">
        {children}
        <Toaster
          position="bottom-center"
          gutter={10}
          toastOptions={{
            duration: 4000,
            style: {
              background: '#0c1018',
              color: '#f1f5f9',
              border: '1px solid rgba(245, 158, 11, 0.18)',
              borderRadius: '14px',
              fontSize: '14px',
              padding: '14px 16px',
              boxShadow: '0 12px 40px -8px rgba(0, 0, 0, 0.6)',
            },
          }}
        />
      </body>
    </html>
  );
}

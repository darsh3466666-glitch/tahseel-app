import AppShell from '@/components/layout/AppShell';
import DataSyncProvider from '@/components/DataSyncProvider';
import './globals.css';
import type { Metadata, Viewport } from 'next';

export const metadata: Metadata = {
  title: { default: 'منظومة التحصيل', template: '%s | منظومة التحصيل' },
  description: 'نظام متكامل لإدارة التحصيل والعملاء والمدفوعات',
  manifest: '/manifest.json',
  appleWebApp: { capable: true, statusBarStyle: 'default', title: 'منظومة التحصيل' },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: '#1e40af',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl" className="h-full">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Cairo:wght@300;400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="h-full antialiased" style={{ background: 'var(--background)', color: 'var(--foreground)' }}>
        <DataSyncProvider>
          <AppShell>{children}</AppShell>
        </DataSyncProvider>
      </body>
    </html>
  );
}

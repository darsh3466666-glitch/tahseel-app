'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  MapPin,
  Users,
  CreditCard,
  Eye,
  HandshakeIcon,
  BarChart3,
  CheckSquare,
  Bell,
  FileText,
  Upload,
  HardDrive,
  Settings,
  Menu,
  X,
  ChevronLeft,
  TrendingUp,
} from 'lucide-react';

const NAV_ITEMS = [
  { href: '/',             label: 'لوحة التحكم',     icon: LayoutDashboard },
  { href: '/route',        label: 'مسار اليوم',       icon: MapPin },
  { href: '/customers',   label: 'العملاء',           icon: Users },
  { href: '/payments',    label: 'المدفوعات',          icon: CreditCard },
  { href: '/visits',      label: 'الزيارات',           icon: Eye },
  { href: '/promises',    label: 'الوعود',             icon: HandshakeIcon },
  { href: '/debt',        label: 'تحليل المديونية',   icon: TrendingUp },
  { href: '/reports',     label: 'التقارير',           icon: BarChart3 },
  { href: '/settings',    label: 'الإعدادات',         icon: Settings },
];

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

function Sidebar({ isOpen, onClose }: SidebarProps) {
  const pathname = usePathname();

  return (
    <>
      {/* Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed top-0 right-0 h-full w-64 z-50 flex flex-col
          transition-transform duration-300 ease-in-out
          lg:translate-x-0 lg:static lg:z-auto bg-card border-l border-border
          ${isOpen ? 'translate-x-0' : 'translate-x-full'}
        `}
      >
        {/* Logo */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div>
            <h1 className="text-primary font-black text-lg tracking-tight">منظومة التحصيل</h1>
            <p className="text-muted-foreground text-xs font-medium">مصطفى إبراهيم</p>
          </div>
          <button
            onClick={onClose}
            className="lg:hidden text-muted-foreground hover:text-foreground p-1 rounded-md"
          >
            <X size={20} />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
            const isActive = pathname === href || (href !== '/' && pathname.startsWith(href));
            return (
              <Link
                key={href}
                href={href}
                onClick={onClose}
                className={`
                  flex items-center gap-3 px-3 py-3 rounded-xl
                  text-sm font-bold transition-all duration-200
                  touch-target
                  ${isActive
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  }
                `}
              >
                <Icon size={20} strokeWidth={isActive ? 2.5 : 2} className="shrink-0" />
                <span>{label}</span>
                {isActive && <ChevronLeft size={16} strokeWidth={2.5} className="mr-auto opacity-70" />}
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="p-4 border-t border-border bg-muted/20">
          <p className="text-muted-foreground text-xs text-center font-medium">
            النسخة 1.0.0 — يعمل بدون إنترنت
          </p>
        </div>
      </aside>
    </>
  );
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pathname = usePathname();

  const currentPage = NAV_ITEMS.find(item =>
    pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href))
  );

  return (
    <div className="flex h-screen overflow-hidden" dir="rtl">
      {/* Desktop sidebar */}
      <div className="hidden lg:flex">
        <Sidebar isOpen={true} onClose={() => {}} />
      </div>

      {/* Mobile sidebar */}
      <div className="lg:hidden">
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top bar */}
        <header
          className="flex items-center justify-between px-4 py-3 border-b shrink-0"
          style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
        >
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-white/10 touch-target"
            >
              <Menu size={20} />
            </button>
            <h2 className="font-bold text-base" style={{ color: 'var(--foreground)' }}>
              {currentPage?.label ?? 'منظومة التحصيل'}
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/notifications" className="relative p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-white/10 touch-target">
              <Bell size={18} />
            </Link>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-4 bg-background">
          <div className="animate-fade-in w-full max-w-5xl mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

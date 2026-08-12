'use client';

import { useEffect, useState } from 'react';
import {
  TrendingUp, Users, CreditCard, Eye, AlertTriangle,
  CheckCircle, Clock, Target, Star, ArrowUpRight, Upload, Map, FileText, MapPin
} from 'lucide-react';
import { formatCurrency, formatPercent, formatDate, RISK_COLORS, RISK_LABELS } from '@/lib/utils/helpers';
import type { Customer, DailyStats } from '@/types/domain';
import Link from 'next/link';

interface StatCard {
  label: string;
  value: string;
  sub?: string;
  icon: React.ElementType;
  color: string;
  href?: string;
}

function KPICard({ label, value, sub, icon: Icon, color, href }: StatCard) {
  const content = (
    <div className="card flex items-start gap-4 hover:shadow-md transition-shadow cursor-pointer">
      <div
        className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
        style={{ background: `${color}20` }}
      >
        <Icon size={22} style={{ color }} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>{label}</p>
        <p className="text-xl font-bold mt-0.5" style={{ color: 'var(--foreground)' }}>{value}</p>
        {sub && <p className="text-xs mt-0.5" style={{ color: 'var(--muted-foreground)' }}>{sub}</p>}
      </div>
      {href && <ArrowUpRight size={14} style={{ color: 'var(--muted-foreground)' }} className="shrink-0 mt-1" />}
    </div>
  );
  return href ? <Link href={href}>{content}</Link> : content;
}

function ProgressBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className="w-full h-2 rounded-full bg-gray-100 dark:bg-slate-700 overflow-hidden">
      <div
        className="h-full rounded-full transition-all duration-500"
        style={{ width: `${pct}%`, background: color }}
      />
    </div>
  );
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DailyStats | null>(null);
  const [highRisk, setHighRisk] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [customerCount, setCustomerCount] = useState(0);
  const [collectionRate, setCollectionRate] = useState(0);

  useEffect(() => {
    async function load() {
      try {
        const { getDb } = await import('@/lib/db/database');
        const { dailyStatsRepo } = await import('@/lib/db/settingsRepo');
        const { customerRepo } = await import('@/lib/db/customerRepo');

        const db = getDb();
        const today = new Date().toISOString().slice(0, 10);

        // Load today's stats
        const todayStats = await dailyStatsRepo.getByDate(today);
        setStats(todayStats ?? null);

        // Customer summary
        const count = await customerRepo.count();
        setCustomerCount(count);

        // High risk
        const risk = await customerRepo.getHighRisk();
        setHighRisk(risk.slice(0, 5));

        // Collection rate from stats
        if (todayStats) {
          setCollectionRate(todayStats.collectionRate);
        }
      } catch (err) {
        console.error('Dashboard load error:', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p style={{ color: 'var(--muted-foreground)' }}>جاري التحميل...</p>
        </div>
      </div>
    );
  }

  const target = stats?.targetAmount ?? 0;
  const collected = stats?.collectedAmount ?? 0;
  const remaining = Math.max(0, target - collected);
  const scoreColor = stats?.collectorScore
    ? stats.collectorScore >= 80 ? '#16a34a'
    : stats.collectorScore >= 60 ? '#d97706'
    : '#dc2626'
    : '#94a3b8';

  return (
    <div className="space-y-6 pb-8">
      {/* Greeting */}
      <div>
        <h1 className="text-2xl font-bold">مرحباً، مصطفى 👋</h1>
        <p style={{ color: 'var(--muted-foreground)' }} className="text-sm mt-1">
          {new Date().toLocaleDateString('ar-EG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </p>
      </div>

      {/* Action Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Link href="/route" className="block bg-gradient-to-br from-primary to-primary/90 text-primary-foreground p-6 rounded-[2rem] shadow-md hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -mr-8 -mt-8 transition-transform group-hover:scale-150 duration-500"></div>
          <div className="relative z-10">
            <div className="w-12 h-12 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center mb-4 shadow-sm">
              <Map className="w-6 h-6 text-white" strokeWidth={2.5} />
            </div>
            <h2 className="text-2xl font-bold mb-2 tracking-tight">سير العمل اليومي</h2>
            <p className="text-primary-foreground/80 text-sm leading-relaxed">عرض خط سير المناطق، أهداف التحصيل، وتسجيل الزيارات والردود بسهولة.</p>
          </div>
          <Map className="absolute -left-8 -bottom-8 w-40 h-40 text-black/5 group-hover:scale-110 group-hover:rotate-6 transition-transform duration-500" strokeWidth={1} />
        </Link>
        <Link href="/reports/daily" className="block bg-gradient-to-br from-card to-muted border border-border/50 p-6 rounded-[2rem] shadow-sm hover:shadow-lg transition-all duration-300 transform hover:-translate-y-1 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-2xl -mr-8 -mt-8 transition-transform group-hover:scale-150 duration-500"></div>
          <div className="relative z-10">
            <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center mb-4 shadow-sm group-hover:bg-primary/20 transition-colors duration-300">
              <FileText className="w-6 h-6 text-primary" strokeWidth={2.5} />
            </div>
            <h2 className="text-2xl font-bold mb-2 tracking-tight text-foreground">التقرير الختامي</h2>
            <p className="text-muted-foreground text-sm leading-relaxed">استخراج تقرير مفصل بزيارات اليوم، الردود، وتقييم الأداء لمشاركته فوراً.</p>
          </div>
          <FileText className="absolute -left-8 -bottom-8 w-40 h-40 text-primary/5 group-hover:scale-110 group-hover:-rotate-6 transition-transform duration-500" strokeWidth={1} />
        </Link>
      </div>

      {/* Collection progress */}
      {target > 0 && (
        <div className="card space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-bold">تقدم التحصيل اليوم</h2>
            <span className="text-sm font-bold" style={{ color: '#1e40af' }}>
              {formatPercent(target > 0 ? collected / target : 0)}
            </span>
          </div>
          <ProgressBar value={collected} max={target} color="#1e40af" />
          <div className="flex justify-between text-sm">
            <span style={{ color: 'var(--muted-foreground)' }}>المحصّل: <strong style={{ color: '#16a34a' }}>{formatCurrency(collected)}</strong></span>
            <span style={{ color: 'var(--muted-foreground)' }}>الباقي: <strong style={{ color: '#dc2626' }}>{formatCurrency(remaining)}</strong></span>
          </div>
        </div>
      )}

      {/* KPI Grid */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        <KPICard
          label="إجمالي العملاء"
          value={String(customerCount)}
          icon={Users}
          color="#1e40af"
          href="/customers"
        />
        <KPICard
          label="المستهدف"
          value={formatCurrency(target)}
          sub="هدف اليوم"
          icon={Target}
          color="#7c3aed"
          href="/route"
        />
        <KPICard
          label="المحصّل"
          value={formatCurrency(collected)}
          sub={`${formatPercent(target > 0 ? collected / target : 0)} من الهدف`}
          icon={CreditCard}
          color="#16a34a"
          href="/payments"
        />
        <KPICard
          label="زيارات اليوم"
          value={String(stats?.totalCustomers ?? 0)}
          sub={`${stats?.completedVisits ?? 0} مكتملة`}
          icon={Eye}
          color="#0891b2"
          href="/visits"
        />
        <KPICard
          label="زيارات معلقة"
          value={String(stats?.pendingVisits ?? 0)}
          icon={Clock}
          color="#d97706"
          href="/visits"
        />
        <KPICard
          label="وعود متأخرة"
          value={String(stats?.overduePromises ?? 0)}
          icon={AlertTriangle}
          color="#dc2626"
          href="/promises"
        />
        <KPICard
          label="عملاء خطر"
          value={String(highRisk.length)}
          icon={AlertTriangle}
          color="#ea580c"
          href="/customers?risk=RED"
        />
        <KPICard
          label="تقييم المحصّل"
          value={`${stats?.collectorScore ?? 0}/100`}
          icon={Star}
          color={scoreColor}
        />
      </div>

      {/* High Risk Customers */}
      {highRisk.length > 0 && (
        <div className="card space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-bold flex items-center gap-2">
              <AlertTriangle size={18} className="text-red-500" />
              عملاء عالي الخطورة
            </h2>
            <Link href="/customers?risk=RED" className="text-sm text-blue-600 hover:underline">
              عرض الكل
            </Link>
          </div>
          <div className="space-y-2">
            {highRisk.map(customer => (
              <Link
                key={customer.id}
                href={`/customers/details?id=${customer.id}`}
                className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
              >
                <div>
                  <p className="font-medium text-sm">{customer.name}</p>
                  <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>{customer.region}</p>
                </div>
                <div className="text-left flex flex-col items-end gap-1">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${RISK_COLORS[customer.riskLevel]}`}>
                    {RISK_LABELS[customer.riskLevel]}
                  </span>
                  <span className="text-xs font-bold" style={{ color: 'var(--muted-foreground)' }}>
                    {formatCurrency(customer.currentBalance)}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Quick actions */}
      <div className="grid grid-cols-2 gap-3">
        <Link href="/route" className="card text-center py-4 hover:shadow-md transition-shadow">
          <MapPin size={24} className="mx-auto mb-2 text-blue-600" />
          <p className="font-medium text-sm">مسار اليوم</p>
        </Link>
        <Link href="/import" className="card text-center py-4 hover:shadow-md transition-shadow">
          <Upload size={24} className="mx-auto mb-2 text-purple-600" />
          <p className="font-medium text-sm">استيراد الشيت</p>
        </Link>
      </div>
    </div>
  );
}


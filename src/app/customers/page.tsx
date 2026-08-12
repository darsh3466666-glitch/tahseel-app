'use client';

import { useEffect, useState, useCallback } from 'react';
import { Search, Filter, Plus, ChevronLeft, AlertTriangle, CheckCircle } from 'lucide-react';
import Link from 'next/link';
import type { Customer, CustomerStatus, RiskLevel } from '@/types/domain';
import {
  formatCurrency, formatDate, RISK_COLORS, RISK_LABELS,
  STATUS_LABELS, truncate
} from '@/lib/utils/helpers';

const STATUS_FILTERS: { label: string; value: CustomerStatus | '' }[] = [
  { label: 'الكل', value: '' },
  { label: 'نشط', value: 'active' },
  { label: 'متأخر', value: 'overdue' },
  { label: 'مسدد', value: 'paid' },
  { label: 'غير نشط', value: 'inactive' },
];

const RISK_FILTERS: { label: string; value: RiskLevel | '' }[] = [
  { label: 'كل المخاطر', value: '' },
  { label: '🟢 ممتاز', value: 'GREEN' },
  { label: '🟡 متوسط', value: 'YELLOW' },
  { label: '🟠 مرتفع', value: 'ORANGE' },
  { label: '🔴 عالي', value: 'RED' },
];

function CustomerRow({ customer }: { customer: Customer }) {
  const riskClass = RISK_COLORS[customer.riskLevel] || 'risk-bg-yellow';

  return (
    <Link
      href={`/customers/${customer.id}`}
      className="block border-b last:border-b-0 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
      style={{ borderColor: 'var(--border)' }}
    >
      <div className="px-4 py-3 flex items-center gap-3">
        {/* Name + region */}
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm truncate">{customer.name}</p>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
              {customer.code}
            </span>
            {customer.region && (
              <>
                <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>•</span>
                <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                  {customer.region}
                </span>
              </>
            )}
          </div>
        </div>

        {/* Balance + Risk */}
        <div className="text-left flex flex-col items-end gap-1 shrink-0">
          <p className="text-sm font-bold">{formatCurrency(customer.currentBalance)}</p>
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${riskClass}`}>
            {RISK_LABELS[customer.riskLevel]}
          </span>
        </div>

        <ChevronLeft size={14} style={{ color: 'var(--muted-foreground)' }} />
      </div>
    </Link>
  );
}

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<CustomerStatus | ''>('');
  const [riskFilter, setRiskFilter] = useState<RiskLevel | ''>('');
  const [showFilters, setShowFilters] = useState(false);

  const load = useCallback(async () => {
    try {
      const { customerRepo } = await import('@/lib/db/customerRepo');
      const results = await customerRepo.getAll({
        search: search || undefined,
        status: statusFilter || undefined,
        riskLevel: riskFilter || undefined,
      });
      setCustomers(results);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, riskFilter]);

  useEffect(() => {
    load();
  }, [load]);

  const totalBalance = customers.reduce((s, c) => s + c.currentBalance, 0);

  return (
    <div className="space-y-4 pb-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">العملاء</h1>
          <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
            {customers.length} عميل — إجمالي المديونية: {formatCurrency(totalBalance)}
          </p>
        </div>
        <Link
          href="/customers/new"
          className="flex items-center gap-2 bg-blue-600 text-white px-3 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors touch-target"
        >
          <Plus size={16} />
          <span className="hidden sm:inline">إضافة عميل</span>
        </Link>
      </div>

      {/* Search */}
      <div className="flex gap-2">
        <div className="flex-1 relative">
          <Search size={16} className="absolute top-1/2 -translate-y-1/2 right-3" style={{ color: 'var(--muted-foreground)' }} />
          <input
            type="text"
            placeholder="بحث بالاسم أو الكود..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pr-9 pl-4 py-2.5 rounded-lg border text-sm"
            style={{ background: 'var(--card)', borderColor: 'var(--border)', color: 'var(--foreground)' }}
          />
        </div>
        <button
          onClick={() => setShowFilters(f => !f)}
          className={`p-2.5 rounded-lg border touch-target transition-colors ${showFilters ? 'bg-blue-600 text-white border-blue-600' : ''}`}
          style={!showFilters ? { background: 'var(--card)', borderColor: 'var(--border)' } : {}}
        >
          <Filter size={16} />
        </button>
      </div>

      {/* Filters */}
      {showFilters && (
        <div className="card space-y-3 animate-fade-in">
          <div>
            <p className="text-xs font-medium mb-2" style={{ color: 'var(--muted-foreground)' }}>الحالة</p>
            <div className="flex flex-wrap gap-2">
              {STATUS_FILTERS.map(f => (
                <button
                  key={f.value}
                  onClick={() => setStatusFilter(f.value as any)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                    statusFilter === f.value ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-white/10'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="text-xs font-medium mb-2" style={{ color: 'var(--muted-foreground)' }}>مستوى الخطورة</p>
            <div className="flex flex-wrap gap-2">
              {RISK_FILTERS.map(f => (
                <button
                  key={f.value}
                  onClick={() => setRiskFilter(f.value as any)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                    riskFilter === f.value ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-white/10'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Customer list */}
      {loading ? (
        <div className="card py-12 text-center">
          <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
          <p style={{ color: 'var(--muted-foreground)' }} className="text-sm">جاري التحميل...</p>
        </div>
      ) : customers.length === 0 ? (
        <div className="card py-12 text-center">
          <Users size={40} className="mx-auto mb-3 opacity-20" />
          <p style={{ color: 'var(--muted-foreground)' }} className="text-sm">لا يوجد عملاء</p>
          <Link href="/import" className="mt-3 inline-block text-sm text-blue-600 hover:underline font-medium">
            استيراد من الشيت ←
          </Link>
        </div>
      ) : (
        <div className="card overflow-hidden p-0">
          {customers.map(customer => (
            <CustomerRow key={customer.id} customer={customer} />
          ))}
        </div>
      )}
    </div>
  );
}

import { Users } from 'lucide-react';

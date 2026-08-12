// ============================================================
// Helper Utilities
// ============================================================
import { v4 as uuidv4 } from 'uuid';
import { format, parseISO, isValid, addDays, differenceInDays } from 'date-fns';
import { ar } from 'date-fns/locale';

// ── ID generation ──────────────────────────────────────────
export function generateId(): string {
  return uuidv4();
}

// ── Date helpers ───────────────────────────────────────────
export function nowISO(): string {
  return new Date().toISOString();
}

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export function formatDate(date: string | null | undefined, fmt = 'dd/MM/yyyy'): string {
  if (!date) return '—';
  try {
    const parsed = parseISO(date);
    if (!isValid(parsed)) return '—';
    return format(parsed, fmt, { locale: ar });
  } catch {
    return '—';
  }
}

export function formatDateTime(date: string | null | undefined): string {
  return formatDate(date, 'dd/MM/yyyy HH:mm');
}

/**
 * Convert Excel date serial number to ISO date string
 * Excel stores dates as days since 1900-01-01 (with a leap year bug on day 60)
 */
export function excelDateToISO(serial: number | string | null | undefined): string | null {
  if (!serial) return null;
  const n = typeof serial === 'string' ? parseFloat(serial) : serial;
  if (isNaN(n) || n <= 0) return null;
  // Excel epoch: December 30, 1899
  const date = new Date(Date.UTC(1899, 11, 30) + n * 86400000);
  if (!isValid(date)) return null;
  return date.toISOString().slice(0, 10);
}

export function excelDateToISOFull(serial: number | null | undefined): string | null {
  if (!serial) return null;
  const date = new Date(Date.UTC(1899, 11, 30) + serial * 86400000);
  if (!isValid(date)) return null;
  return date.toISOString();
}

export function daysOverdue(dateStr: string | null | undefined): number {
  if (!dateStr) return 0;
  const date = parseISO(dateStr);
  if (!isValid(date)) return 0;
  return Math.max(0, differenceInDays(new Date(), date));
}

export function daysSincePayment(lastPaymentDate: string | null | undefined): number {
  if (!lastPaymentDate) return 999;
  return daysOverdue(lastPaymentDate);
}

// ── Number formatting ──────────────────────────────────────
export function formatCurrency(amount: number, currency = 'ج.م'): string {
  return `${amount.toLocaleString('ar-EG', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} ${currency}`;
}

export function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

// ── String helpers ─────────────────────────────────────────
export function normalizeArabicName(name: string): string {
  return name
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/أ|إ|آ/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي');
}

export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength) + '...';
}

// ── Risk level display ─────────────────────────────────────
export const RISK_LABELS: Record<string, string> = {
  GREEN: '🟢 ممتاز',
  YELLOW: '🟡 متوسط',
  ORANGE: '🟠 مرتفع',
  RED: '🔴 عالي جداً',
};

export const RISK_COLORS: Record<string, string> = {
  GREEN: 'risk-bg-green',
  YELLOW: 'risk-bg-yellow',
  ORANGE: 'risk-bg-orange',
  RED: 'risk-bg-red',
};

// ── Status display ─────────────────────────────────────────
export const STATUS_LABELS: Record<string, string> = {
  active: 'نشط',
  inactive: 'غير نشط',
  overdue: 'متأخر',
  paid: 'مسدد',
};

export const VISIT_STATUS_LABELS: Record<string, string> = {
  planned: 'مجدول',
  started: 'جاري',
  completed: 'مكتمل',
  skipped: 'متخطي',
};

export const VISIT_RESULT_LABELS: Record<string, string> = {
  collected: 'تم التحصيل',
  promise: 'وعد بالسداد',
  no_response: 'لا يرد',
  refused: 'رفض',
};

export const PROMISE_STATUS_LABELS: Record<string, string> = {
  active: 'فعّال',
  fulfilled: 'تم الوفاء',
  partial: 'وفاء جزئي',
  broken: 'مكسور',
};

// ── Array helpers ──────────────────────────────────────────
export function groupBy<T>(arr: T[], key: keyof T): Record<string, T[]> {
  return arr.reduce((acc, item) => {
    const k = String(item[key]);
    if (!acc[k]) acc[k] = [];
    acc[k].push(item);
    return acc;
  }, {} as Record<string, T[]>);
}

export function sumBy<T>(arr: T[], key: keyof T): number {
  return arr.reduce((sum, item) => sum + (Number(item[key]) || 0), 0);
}

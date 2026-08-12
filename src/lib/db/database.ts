// ============================================================
// Dexie Database Schema — منظومة التحصيل
// Primary offline storage using IndexedDB
// ============================================================

import Dexie, { type EntityTable } from 'dexie';
import type {
  Customer,
  Payment,
  Invoice,
  Visit,
  PaymentPromise,
  Route,
  RouteStop,
  Task,
  AppNotification,
  DailyStats,
  AuditLog,
  ImportRecord,
} from '@/types/domain';

// Settings stored as key-value pairs
export interface SettingsRow {
  key: string;
  value: string;
}

// ── Database class ─────────────────────────────────────────
export class TahseelDatabase extends Dexie {
  customers!: EntityTable<Customer, 'id'>;
  payments!: EntityTable<Payment, 'id'>;
  invoices!: EntityTable<Invoice, 'id'>;
  visits!: EntityTable<Visit, 'id'>;
  promises!: EntityTable<PaymentPromise, 'id'>;
  routes!: EntityTable<Route, 'id'>;
  routeStops!: EntityTable<RouteStop, 'id'>;
  tasks!: EntityTable<Task, 'id'>;
  notifications!: EntityTable<AppNotification, 'id'>;
  dailyStats!: EntityTable<DailyStats, 'id'>;
  auditLogs!: EntityTable<AuditLog, 'id'>;
  imports!: EntityTable<ImportRecord, 'id'>;
  settings!: EntityTable<SettingsRow, 'key'>;

  constructor() {
    super('TahseelDB');

    this.version(1).stores({
      // customers: primary lookup by id, code, name, status, riskLevel, region
      customers: 'id, code, name, status, riskLevel, region, currentBalance, lastPaymentDate, updatedAt',

      // payments: by id, customer, date
      payments: 'id, customerId, date, visitId, createdAt',

      // invoices: by id, customer, invoice number, date
      invoices: 'id, invoiceNumber, customerId, date, createdAt',

      // visits: by id, customer, status, date
      visits: 'id, customerId, status, result, plannedDate, createdAt',

      // promises: by id, customer, status, dueDate
      promises: 'id, customerId, status, dueDate, createdAt',

      // routes: by id, date
      routes: 'id, date, status, createdAt',

      // routeStops: by id, routeId, customerId
      routeStops: 'id, routeId, customerId, status, order',

      // tasks: by id, date, status
      tasks: 'id, date, status, createdAt',

      // notifications: by id, type, read, customerId
      notifications: 'id, type, read, customerId, scheduledAt, createdAt',

      // dailyStats: by id and date (unique)
      dailyStats: 'id, &date, createdAt',

      // auditLogs: by id, table, action
      auditLogs: 'id, table, action, recordId, createdAt',

      // imports: by id, status
      imports: 'id, status, createdAt',

      // settings: key-value store
      settings: '&key',
    });
  }
}

// ── Singleton instance ─────────────────────────────────────
let _db: TahseelDatabase | null = null;

export function getDb(): TahseelDatabase {
  if (typeof window === 'undefined') {
    throw new Error('Database can only be accessed on the client side');
  }
  if (!_db) {
    _db = new TahseelDatabase();
  }
  return _db;
}

// Export a proxy that initializes lazily (safe for SSR)
export const db = new Proxy({} as TahseelDatabase, {
  get(_target, prop) {
    return getDb()[prop as keyof TahseelDatabase];
  },
});

// ============================================================
// Payment Repository
// ============================================================
import { getDb } from './database';
import type { Payment } from '@/types/domain';
import { generateId, nowISO } from '@/lib/utils/helpers';

export const paymentRepo = {
  async getAll(): Promise<Payment[]> {
    return getDb().payments.orderBy('date').reverse().toArray();
  },

  async getByCustomer(customerId: string): Promise<Payment[]> {
    return getDb().payments.where('customerId').equals(customerId).reverse().sortBy('date');
  },

  async getByDateRange(from: string, to: string): Promise<Payment[]> {
    return getDb().payments.where('date').between(from, to, true, true).toArray();
  },

  async create(data: Omit<Payment, 'id' | 'createdAt'>): Promise<Payment> {
    const payment: Payment = { ...data, id: generateId(), createdAt: nowISO() };
    await getDb().payments.add(payment);
    return payment;
  },

  async bulkCreate(payments: Omit<Payment, 'id' | 'createdAt'>[]): Promise<Payment[]> {
    const created = payments.map(p => ({ ...p, id: generateId(), createdAt: nowISO() }));
    await getDb().payments.bulkAdd(created);
    return created;
  },

  async delete(id: string): Promise<void> {
    return getDb().payments.delete(id);
  },

  async getTotalByCustomer(customerId: string): Promise<number> {
    const payments = await getDb().payments.where('customerId').equals(customerId).toArray();
    return payments.reduce((sum, p) => sum + p.amount, 0);
  },

  async getByDate(date: string): Promise<Payment[]> {
    // date is YYYY-MM-DD prefix
    return getDb().payments.where('date').startsWith(date).toArray();
  },

  async count(): Promise<number> {
    return getDb().payments.count();
  },
};

// ============================================================
// Invoice Repository
// ============================================================
import type { Invoice } from '@/types/domain';

export const invoiceRepo = {
  async getAll(): Promise<Invoice[]> {
    return getDb().invoices.orderBy('date').reverse().toArray();
  },

  async getByCustomer(customerId: string): Promise<Invoice[]> {
    return getDb().invoices.where('customerId').equals(customerId).reverse().sortBy('date');
  },

  async getByNumber(invoiceNumber: string): Promise<Invoice | undefined> {
    return getDb().invoices.where('invoiceNumber').equals(invoiceNumber).first();
  },

  async create(data: Omit<Invoice, 'id' | 'createdAt'>): Promise<Invoice> {
    const invoice: Invoice = { ...data, id: generateId(), createdAt: nowISO() };
    await getDb().invoices.add(invoice);
    return invoice;
  },

  async bulkCreate(invoices: Omit<Invoice, 'id' | 'createdAt'>[]): Promise<Invoice[]> {
    const created = invoices.map(i => ({ ...i, id: generateId(), createdAt: nowISO() }));
    await getDb().invoices.bulkAdd(created);
    return created;
  },

  async delete(id: string): Promise<void> {
    return getDb().invoices.delete(id);
  },

  async count(): Promise<number> {
    return getDb().invoices.count();
  },

  async getTotalByCustomer(customerId: string): Promise<number> {
    const invoices = await getDb().invoices.where('customerId').equals(customerId).toArray();
    return invoices.reduce((sum, i) => sum + i.amount, 0);
  },
};

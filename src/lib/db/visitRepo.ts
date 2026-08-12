// ============================================================
// Visit Repository
// ============================================================
import { getDb } from './database';
import type { Visit, VisitStatus, VisitResult, PaymentPromise, PromiseStatus } from '@/types/domain';
import { generateId, nowISO, todayISO } from '@/lib/utils/helpers';

export const visitRepo = {
  async getAll(): Promise<Visit[]> {
    return getDb().visits.orderBy('plannedDate').reverse().toArray();
  },

  async getByCustomer(customerId: string): Promise<Visit[]> {
    return getDb().visits.where('customerId').equals(customerId).reverse().sortBy('plannedDate');
  },

  async getByDate(date: string): Promise<Visit[]> {
    return getDb().visits.where('plannedDate').startsWith(date).toArray();
  },

  async getToday(): Promise<Visit[]> {
    return visitRepo.getByDate(todayISO());
  },

  async getByStatus(status: VisitStatus): Promise<Visit[]> {
    return getDb().visits.where('status').equals(status).toArray();
  },

  async create(data: Omit<Visit, 'id' | 'createdAt'>): Promise<Visit> {
    const visit: Visit = { ...data, id: generateId(), createdAt: nowISO() };
    await getDb().visits.add(visit);
    return visit;
  },

  async update(id: string, changes: Partial<Omit<Visit, 'id' | 'createdAt'>>): Promise<Visit> {
    const db = getDb();
    const existing = await db.visits.get(id);
    if (!existing) throw new Error(`Visit ${id} not found`);
    const updated: Visit = { ...existing, ...changes };
    await db.visits.put(updated);
    return updated;
  },

  async startVisit(id: string): Promise<Visit> {
    return visitRepo.update(id, { status: 'started', startedAt: nowISO() });
  },

  async completeVisit(id: string, result: VisitResult, collectedAmount: number, notes?: string): Promise<Visit> {
    return visitRepo.update(id, {
      status: 'completed',
      result,
      collectedAmount,
      completedAt: nowISO(),
      notes: notes ?? '',
    });
  },

  async skipVisit(id: string, notes?: string): Promise<Visit> {
    return visitRepo.update(id, {
      status: 'skipped',
      completedAt: nowISO(),
      notes: notes ?? 'تم التخطي',
    });
  },

  async delete(id: string): Promise<void> {
    return getDb().visits.delete(id);
  },

  async count(): Promise<number> {
    return getDb().visits.count();
  },

  async getTodayStats(): Promise<{ total: number; completed: number; pending: number; skipped: number }> {
    const visits = await visitRepo.getToday();
    return {
      total: visits.length,
      completed: visits.filter(v => v.status === 'completed').length,
      pending: visits.filter(v => v.status === 'planned' || v.status === 'started').length,
      skipped: visits.filter(v => v.status === 'skipped').length,
    };
  },
};

// ============================================================
// Promise Repository
// ============================================================
export const promiseRepo = {
  async getAll(): Promise<PaymentPromise[]> {
    return getDb().promises.orderBy('dueDate').toArray();
  },

  async getByCustomer(customerId: string): Promise<PaymentPromise[]> {
    return getDb().promises.where('customerId').equals(customerId).toArray();
  },

  async getActive(): Promise<PaymentPromise[]> {
    return getDb().promises.where('status').equals('active').toArray();
  },

  async getOverdue(): Promise<PaymentPromise[]> {
    const today = todayISO();
    const active = await promiseRepo.getActive();
    return active.filter(p => p.dueDate < today);
  },

  async getDueSoon(days: number = 2): Promise<PaymentPromise[]> {
    const today = new Date();
    const soon = new Date(today);
    soon.setDate(soon.getDate() + days);
    const active = await promiseRepo.getActive();
    return active.filter(p => {
      const due = new Date(p.dueDate);
      return due >= today && due <= soon;
    });
  },

  async create(data: Omit<PaymentPromise, 'id' | 'createdAt' | 'updatedAt'>): Promise<PaymentPromise> {
    const promise: PaymentPromise = {
      ...data,
      id: generateId(),
      createdAt: nowISO(),
      updatedAt: nowISO(),
    };
    await getDb().promises.add(promise);
    return promise;
  },

  async update(id: string, changes: Partial<Omit<PaymentPromise, 'id' | 'createdAt'>>): Promise<PaymentPromise> {
    const db = getDb();
    const existing = await db.promises.get(id);
    if (!existing) throw new Error(`Promise ${id} not found`);
    const updated: PaymentPromise = { ...existing, ...changes, updatedAt: nowISO() };
    await db.promises.put(updated);
    return updated;
  },

  async markFulfilled(id: string, amount: number): Promise<PaymentPromise> {
    return promiseRepo.update(id, {
      status: 'fulfilled',
      fulfilledAmount: amount,
    });
  },

  async markBroken(id: string): Promise<PaymentPromise> {
    return promiseRepo.update(id, { status: 'broken' });
  },

  async markPartial(id: string, amount: number): Promise<PaymentPromise> {
    return promiseRepo.update(id, {
      status: 'partial',
      fulfilledAmount: amount,
    });
  },

  async delete(id: string): Promise<void> {
    return getDb().promises.delete(id);
  },

  async count(): Promise<number> {
    return getDb().promises.count();
  },

  // Auto-mark overdue promises as broken
  async processOverdue(): Promise<number> {
    const overdue = await promiseRepo.getOverdue();
    for (const p of overdue) {
      await promiseRepo.markBroken(p.id);
    }
    return overdue.length;
  },
};

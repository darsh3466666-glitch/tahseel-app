// ============================================================
// Customer Repository
// All database operations for customers
// ============================================================

import { getDb } from './database';
import type { Customer, CustomerStatus, RiskLevel } from '@/types/domain';
import { generateId, nowISO } from '@/lib/utils/helpers';
import { computeRiskLevel } from '@/lib/scoring/risk';

export interface CustomerFilters {
  status?: CustomerStatus;
  riskLevel?: RiskLevel;
  region?: string;
  collectorName?: string;
  search?: string;
}

export const customerRepo = {
  async getAll(filters?: CustomerFilters): Promise<Customer[]> {
    const db = getDb();
    let collection = db.customers.orderBy('name');

    if (filters?.status) {
      collection = db.customers.where('status').equals(filters.status).sortBy('name') as any;
    }
    if (filters?.riskLevel) {
      collection = db.customers.where('riskLevel').equals(filters.riskLevel).sortBy('name') as any;
    }

    let results = await collection.toArray();

    if (filters?.region) {
      results = results.filter(c => c.region === filters.region);
    }
    if (filters?.collectorName) {
      results = results.filter(c => c.collectorName === filters.collectorName);
    }
    if (filters?.search) {
      const q = filters.search.toLowerCase();
      results = results.filter(
        c => c.name.toLowerCase().includes(q) || c.code.includes(q)
      );
    }

    return results;
  },

  async getById(id: string): Promise<Customer | undefined> {
    return getDb().customers.get(id);
  },

  async getByCode(code: string): Promise<Customer | undefined> {
    return getDb().customers.where('code').equals(code).first();
  },

  async findByName(name: string): Promise<Customer | undefined> {
    // Exact match first
    const exact = await getDb().customers.where('name').equals(name).first();
    if (exact) return exact;
    // Partial match (truncated names from Excel)
    const all = await getDb().customers.toArray();
    return all.find(c => c.name.startsWith(name.slice(0, 10)) || name.startsWith(c.name.slice(0, 10)));
  },

  async upsert(data: Omit<Customer, 'id' | 'createdAt' | 'updatedAt'>): Promise<Customer> {
    const db = getDb();
    const existing = await db.customers.where('code').equals(data.code).first();
    const now = nowISO();

    if (existing) {
      const updated: Customer = { ...existing, ...data, id: existing.id, createdAt: existing.createdAt, updatedAt: now };
      await db.customers.put(updated);
      return updated;
    } else {
      const customer: Customer = { ...data, id: generateId(), createdAt: now, updatedAt: now };
      await db.customers.add(customer);
      return customer;
    }
  },

  async update(id: string, changes: Partial<Omit<Customer, 'id' | 'createdAt'>>): Promise<Customer> {
    const db = getDb();
    const existing = await db.customers.get(id);
    if (!existing) throw new Error(`Customer ${id} not found`);
    const updated: Customer = { ...existing, ...changes, updatedAt: nowISO() };
    await db.customers.put(updated);
    return updated;
  },

  async updateBalance(id: string, delta: number): Promise<Customer> {
    const db = getDb();
    const customer = await db.customers.get(id);
    if (!customer) throw new Error(`Customer ${id} not found`);
    const newBalance = customer.currentBalance - delta; // payment reduces balance
    const risk = computeRiskLevel({
      currentBalance: newBalance,
      totalWithdrawn: customer.totalWithdrawn,
      totalPaid: customer.totalPaid + delta,
      lastPaymentDate: customer.lastPaymentDate,
    });
    return customerRepo.update(id, {
      currentBalance: newBalance,
      totalPaid: customer.totalPaid + delta,
      lastPaymentDate: nowISO(),
      riskLevel: risk.level,
      riskScore: risk.score,
    });
  },

  async delete(id: string): Promise<void> {
    return getDb().customers.delete(id);
  },

  async count(): Promise<number> {
    return getDb().customers.count();
  },

  async getByRegion(region: string): Promise<Customer[]> {
    return getDb().customers.where('region').equals(region).toArray();
  },

  async getOverdue(): Promise<Customer[]> {
    return getDb().customers.where('status').equals('overdue').toArray();
  },

  async getHighRisk(): Promise<Customer[]> {
    return getDb().customers
      .where('riskLevel').anyOf(['RED', 'ORANGE'])
      .toArray();
  },

  async bulkUpsert(customers: Omit<Customer, 'id' | 'createdAt' | 'updatedAt'>[]): Promise<{ added: number; updated: number }> {
    let added = 0;
    let updated = 0;
    for (const c of customers) {
      const existing = await getDb().customers.where('code').equals(c.code).first();
      if (existing) {
        await customerRepo.update(existing.id, c);
        updated++;
      } else {
        await customerRepo.upsert(c);
        added++;
      }
    }
    return { added, updated };
  },
};

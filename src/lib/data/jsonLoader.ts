/**
 * Data loader — loads JSON data from public/data/ into IndexedDB on first run
 * Called once on app startup if IndexedDB is empty
 */

import type { Customer, Payment, Invoice, Task } from '@/types/domain';
import { generateId, nowISO } from '@/lib/utils/helpers';

export interface JsonDataFiles {
  customers: any[];
  payments:  any[];
  invoices:  any[];
  route:     any[];
  tasks:     any[];
  stats:     any;
  meta:      { exportedAt: string; version: number };
}

// Fetch all JSON data files from public/data/
export async function fetchJsonData(): Promise<JsonDataFiles | null> {
  const t = Date.now();
  try {
    const [customers, payments, invoices, route, tasks, stats, meta] = await Promise.all([
      fetch(`/tahseel-app/data/customers.json?t=${t}`).then(r => r.ok ? r.json() : []),
      fetch(`/tahseel-app/data/payments.json?t=${t}`).then(r => r.ok ? r.json() : []),
      fetch(`/tahseel-app/data/invoices.json?t=${t}`).then(r => r.ok ? r.json() : []),
      fetch(`/tahseel-app/data/route.json?t=${t}`).then(r => r.ok ? r.json() : []),
      fetch(`/tahseel-app/data/tasks.json?t=${t}`).then(r => r.ok ? r.json() : []),
      fetch(`/tahseel-app/data/stats.json?t=${t}`).then(r => r.ok ? r.json() : {}),
      fetch(`/tahseel-app/data/meta.json?t=${t}`).then(r => r.ok ? r.json() : { exportedAt: '', version: 0 }),
    ]);
    return { customers, payments, invoices, route, tasks, stats, meta };
  } catch {
    return null;
  }
}

// Load JSON data into IndexedDB (only if newer than last import)
export async function seedFromJson(): Promise<{ seeded: boolean; source: string }> {
  const { getDb } = await import('@/lib/db/database');
  const { settingsRepo } = await import('@/lib/db/settingsRepo');
  const db = getDb();

  // Check if we already have data
  const existingCount = await db.customers.count();

  // Fetch JSON meta first
  let meta: { exportedAt: string; version: number } = { exportedAt: '', version: 0 };
  try {
    const res = await fetch(`/tahseel-app/data/meta.json?t=${Date.now()}`);
    if (res.ok) meta = await res.json();
  } catch {
    return { seeded: false, source: 'no_json' };
  }

  if (!meta.exportedAt) return { seeded: false, source: 'no_json' };

  // Check last seed time
  const lastSeed = await settingsRepo.getValue('lastJsonSeed');
  if (lastSeed && lastSeed >= meta.exportedAt && existingCount > 0) {
    return { seeded: false, source: 'already_current' };
  }

  // Fetch all data
  const data = await fetchJsonData();
  if (!data) return { seeded: false, source: 'fetch_failed' };

  console.log(`[Seed] Loading ${data.customers.length} customers from JSON...`);

  const now = nowISO();

  // Seed customers
  if (data.customers.length > 0) {
    const customers: Customer[] = data.customers.map((c: any) => ({
      id:              generateId(),
      code:            c.code || '',
      name:            c.name || '',
      currentBalance:  c.currentBalance || 0,
      lastPaymentDate: c.lastPaymentDate || null,
      lastInvoiceDate: c.lastInvoiceDate || null,
      lastVisitDate:   c.lastVisitDate || null,
      paymentTerms:    c.paymentTerms || '',
      collectionDate:  c.collectionDate || '',
      status:          c.status || 'active',
      classification:  c.classification || '',
      notes:           c.notes || '',
      agreements:      c.agreements || '',
      cycleStartDate:  c.cycleStartDate || null,
      totalWithdrawn:  c.totalWithdrawn || 0,
      totalPaid:       c.totalPaid || 0,
      location:        c.location || null,
      region:          c.region || '',
      riskLevel:       c.riskLevel || 'YELLOW',
      riskScore:       c.riskScore || 50,
      previousBalance: c.previousBalance || 0,
      createdAt:       now,
      updatedAt:       now,
    }));

    // Clear and re-seed customers (JSON is source of truth for master data)
    await db.customers.clear();
    await db.customers.bulkAdd(customers);

    // Build name→id map for linking
    const nameMap = new Map(customers.map(c => [c.name, c.id]));

    // Seed payments
    if (data.payments.length > 0) {
      await db.payments.clear();
      const payments: Payment[] = data.payments.map((p: any) => ({
        id:           generateId(),
        customerId:   nameMap.get(p.customerName) || '',
        customerName: p.customerName || '',
        amount:       p.amount || 0,
        date:         p.date || now.slice(0, 10),
        visitId:      null,
        notes:        '',
        receiptNumber: null,
        createdAt:    now,
      }));
      await db.payments.bulkAdd(payments);
    }

    // Seed invoices
    if (data.invoices.length > 0) {
      await db.invoices.clear();
      const invoices = data.invoices.map((inv: any) => ({
        id:            generateId(),
        invoiceNumber: inv.invoiceNumber || '',
        customerId:    nameMap.get(inv.customerName) || '',
        customerName:  inv.customerName || '',
        amount:        inv.amount || 0,
        date:          inv.date || now.slice(0, 10),
        createdAt:     now,
      }));
      await db.invoices.bulkAdd(invoices);
    }

    // Seed today's tasks
    if (data.tasks.length > 0) {
      const today = now.slice(0, 10);
      const existingTasks = await db.tasks.where('date').equals(today).count();
      if (existingTasks === 0) {
        const tasks = data.tasks.map((t: any) => ({
          id:             generateId(),
          date:           today,
          title:          t.title || '',
          status:         t.status || 'pending',
          completionRate: t.completionRate || 0,
          notes:          '',
          dueTime:        t.dueTime || null,
          createdAt:      now,
        }));
        await db.tasks.bulkAdd(tasks);
      }
    }

    // Seed daily stats
    if (data.stats && data.stats.date) {
      const { dailyStatsRepo } = await import('@/lib/db/settingsRepo');
      await dailyStatsRepo.upsert({
        date:             data.stats.date,
        targetAmount:     data.stats.targetAmount || 0,
        collectedAmount:  data.stats.collectedAmount || 0,
        collectionRate:   data.stats.collectionRate || 0,
        totalCustomers:   customers.length,
        visitedCustomers: 0,
        completedVisits:  0,
        pendingVisits:    0,
        overduePromises:  0,
        brokenPromises:   0,
        collectorScore:   0,
      });
    }
  }

  // Save seed timestamp
  await settingsRepo.setValue('lastJsonSeed', meta.exportedAt);

  console.log(`[Seed] ✅ Done: ${data.customers.length} customers, ${data.payments.length} payments`);
  return { seeded: true, source: 'json' };
}

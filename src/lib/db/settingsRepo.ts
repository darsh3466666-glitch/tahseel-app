// ============================================================
// Settings Repository + Daily Stats + Audit Log
// ============================================================
import { getDb } from './database';
import type { DailyStats, AppNotification, NotificationEventType, AuditLog, AppSettings, ImportRecord, ImportStatus } from '@/types/domain';
import { generateId, nowISO, todayISO } from '@/lib/utils/helpers';

// ── Default settings ──────────────────────────────────────
const DEFAULT_SETTINGS: AppSettings = {
  collectorName: 'مصطفى إبراهيم',
  collectorId: 'collector-1',
  nextAlarmBaseUrl: '',
  nextAlarmEnabled: false,
  weeklyTarget: 4_000_000,
  currency: 'ج.م',
  defaultRegion: '',
  theme: 'system',
};

export const settingsRepo = {
  async get(): Promise<AppSettings> {
    const db = getDb();
    const rows = await db.settings.toArray();
    const map = Object.fromEntries(rows.map(r => [r.key, r.value]));
    const merged: AppSettings = { ...DEFAULT_SETTINGS };
    for (const key of Object.keys(DEFAULT_SETTINGS) as (keyof AppSettings)[]) {
      if (map[key] !== undefined) {
        // Parse booleans and numbers stored as strings
        const val = map[key];
        if (val === 'true') (merged as any)[key] = true;
        else if (val === 'false') (merged as any)[key] = false;
        else if (!isNaN(Number(val)) && typeof (DEFAULT_SETTINGS as any)[key] === 'number') {
          (merged as any)[key] = Number(val);
        } else {
          (merged as any)[key] = val;
        }
      }
    }
    return merged;
  },

  async set(settings: Partial<AppSettings>): Promise<void> {
    const db = getDb();
    const rows = Object.entries(settings).map(([key, value]) => ({
      key,
      value: String(value),
    }));
    await db.settings.bulkPut(rows);
  },

  async setValue(key: string, value: string): Promise<void> {
    await getDb().settings.put({ key, value });
  },

  async getValue(key: string): Promise<string | undefined> {
    const row = await getDb().settings.get(key);
    return row?.value;
  },
};

// ── Daily Stats ───────────────────────────────────────────
export const dailyStatsRepo = {
  async getByDate(date: string): Promise<DailyStats | undefined> {
    return getDb().dailyStats.where('date').equals(date).first();
  },

  async getToday(): Promise<DailyStats | undefined> {
    return dailyStatsRepo.getByDate(todayISO());
  },

  async getRange(from: string, to: string): Promise<DailyStats[]> {
    return getDb().dailyStats.where('date').between(from, to, true, true).toArray();
  },

  async upsert(data: Omit<DailyStats, 'id' | 'createdAt' | 'updatedAt'>): Promise<DailyStats> {
    const db = getDb();
    const existing = await db.dailyStats.where('date').equals(data.date).first();
    const now = nowISO();

    if (existing) {
      const updated: DailyStats = { ...existing, ...data, updatedAt: now };
      await db.dailyStats.put(updated);
      return updated;
    } else {
      const stat: DailyStats = { ...data, id: generateId(), createdAt: now, updatedAt: now };
      await db.dailyStats.add(stat);
      return stat;
    }
  },

  async getLast30Days(): Promise<DailyStats[]> {
    const from = new Date();
    from.setDate(from.getDate() - 30);
    return dailyStatsRepo.getRange(from.toISOString().slice(0, 10), todayISO());
  },
};

// ── Notifications ─────────────────────────────────────────
export const notificationRepo = {
  async getAll(limit = 50): Promise<AppNotification[]> {
    return getDb().notifications
      .orderBy('createdAt')
      .reverse()
      .limit(limit)
      .toArray();
  },

  async getUnread(): Promise<AppNotification[]> {
    return getDb().notifications.where('read').equals(0 as any).toArray();
  },

  async create(data: Omit<AppNotification, 'id' | 'createdAt'>): Promise<AppNotification> {
    const notification: AppNotification = {
      ...data,
      id: generateId(),
      createdAt: nowISO(),
    };
    await getDb().notifications.add(notification);
    return notification;
  },

  async markRead(id: string): Promise<void> {
    await getDb().notifications.update(id, { read: true });
  },

  async markAllRead(): Promise<void> {
    const unread = await notificationRepo.getUnread();
    await getDb().notifications.bulkPut(unread.map(n => ({ ...n, read: true })));
  },

  async delete(id: string): Promise<void> {
    return getDb().notifications.delete(id);
  },

  async unreadCount(): Promise<number> {
    const unread = await notificationRepo.getUnread();
    return unread.length;
  },
};

// ── Audit Logs ─────────────────────────────────────────────
export const auditRepo = {
  async log(
    action: AuditLog['action'],
    table: string,
    recordId: string,
    before: object | null,
    after: object | null,
  ): Promise<void> {
    const entry: AuditLog = {
      id: generateId(),
      action,
      table,
      recordId,
      before: before ? JSON.stringify(before) : null,
      after: after ? JSON.stringify(after) : null,
      createdAt: nowISO(),
    };
    await getDb().auditLogs.add(entry);
  },

  async getAll(limit = 100): Promise<AuditLog[]> {
    return getDb().auditLogs.orderBy('createdAt').reverse().limit(limit).toArray();
  },
};

// ── Import Records ─────────────────────────────────────────
export const importRepo = {
  async create(data: Omit<ImportRecord, 'id' | 'createdAt'>): Promise<ImportRecord> {
    const record: ImportRecord = { ...data, id: generateId(), createdAt: nowISO() };
    await getDb().imports.add(record);
    return record;
  },

  async update(id: string, changes: Partial<ImportRecord>): Promise<void> {
    await getDb().imports.update(id, changes);
  },

  async getAll(): Promise<ImportRecord[]> {
    return getDb().imports.orderBy('createdAt').reverse().toArray();
  },
};

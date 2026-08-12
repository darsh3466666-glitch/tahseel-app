// ============================================================
// Notification Adapters
// ============================================================

import type {
  NotificationAdapter,
  SchedulePayload,
  NotificationEventType,
  AppNotification,
} from '@/types/domain';
import { notificationRepo } from '@/lib/db/settingsRepo';
import { getDb } from '@/lib/db/database';
import { generateId, nowISO } from '@/lib/utils/helpers';

// ── Local Notification Adapter ─────────────────────────────
// Stores notifications in IndexedDB and uses browser Notification API
export class LocalNotificationAdapter implements NotificationAdapter {
  async schedule(payload: SchedulePayload): Promise<{ success: boolean; externalId?: string }> {
    const notification: AppNotification = {
      id: generateId(),
      type: payload.id.startsWith('promise') ? 'PROMISE_DUE' as NotificationEventType : 'TASK_DUE' as NotificationEventType,
      title: payload.title,
      body: payload.message,
      customerId: null,
      promiseId: null,
      visitId: null,
      read: false,
      scheduledAt: payload.scheduledAt.toISOString(),
      createdAt: nowISO(),
    };
    await getDb().notifications.add(notification);

    // Try browser notification if permission granted
    if (typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'granted') {
        const delay = payload.scheduledAt.getTime() - Date.now();
        if (delay <= 0) {
          new Notification(payload.title, { body: payload.message });
        } else if (delay < 24 * 60 * 60 * 1000) {
          // Schedule if within 24 hours
          setTimeout(() => {
            new Notification(payload.title, { body: payload.message });
          }, delay);
        }
      }
    }

    return { success: true, externalId: payload.id };
  }

  async cancel(id: string): Promise<void> {
    await notificationRepo.delete(id);
  }

  async reschedule(id: string, newDate: Date): Promise<void> {
    // Update the scheduled date in local DB
    const db = (await import('@/lib/db/database')).getDb();
    await db.notifications.update(id, { scheduledAt: newDate.toISOString() });
  }

  async list(): Promise<SchedulePayload[]> {
    const notifications = await notificationRepo.getAll();
    return notifications.map(n => ({
      id: n.id,
      title: n.title,
      message: n.body,
      scheduledAt: new Date(n.scheduledAt),
    }));
  }

  async markRead(id: string): Promise<void> {
    await notificationRepo.markRead(id);
  }

  async test(_chatId: string): Promise<{ success: boolean; message: string }> {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        new Notification('🔔 اختبار التنبيهات', { body: 'تم الاتصال بنجاح!' });
        return { success: true, message: 'تم إرسال إشعار الاختبار بنجاح' };
      }
      return { success: false, message: 'تم رفض إذن الإشعارات' };
    }
    return { success: false, message: 'المتصفح لا يدعم الإشعارات' };
  }

  async requestPermission(): Promise<boolean> {
    if (typeof window === 'undefined' || !('Notification' in window)) return false;
    const result = await Notification.requestPermission();
    return result === 'granted';
  }
}

// ── Next Alarm Adapter ─────────────────────────────────────
// Connects to the running Next Alarm server via its REST API
// Does NOT modify Next Alarm source code
export class NextAlarmAdapter implements NotificationAdapter {
  private baseUrl: string;
  private chatIds: string[];

  constructor(baseUrl: string, chatIds: string[]) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.chatIds = chatIds;
  }

  private async fetch(path: string, options?: RequestInit): Promise<Response> {
    const url = `${this.baseUrl}${path}`;
    const response = await fetch(url, {
      ...options,
      headers: { 'Content-Type': 'application/json', ...(options?.headers ?? {}) },
    });
    return response;
  }

  async schedule(payload: SchedulePayload): Promise<{ success: boolean; externalId?: string }> {
    try {
      const response = await this.fetch('/api/alarms', {
        method: 'POST',
        body: JSON.stringify({
          time: payload.scheduledAt.toISOString(),
          message: `${payload.title}\n${payload.message}`,
          chatIds: payload.chatIds ?? this.chatIds,
          repeat: payload.repeat ?? 'none',
        }),
      });

      if (!response.ok) {
        const err = await response.text();
        console.error('NextAlarm schedule error:', err);
        return { success: false };
      }

      const alarm = await response.json();
      return { success: true, externalId: alarm.id };
    } catch (err) {
      console.error('NextAlarm schedule failed:', err);
      return { success: false };
    }
  }

  async cancel(id: string): Promise<void> {
    try {
      await this.fetch(`/api/alarms/${id}`, { method: 'DELETE' });
    } catch (err) {
      console.error('NextAlarm cancel failed:', err);
    }
  }

  async reschedule(id: string, newDate: Date): Promise<void> {
    try {
      // Fetch existing alarm first
      const res = await this.fetch('/api/alarms');
      const alarms = await res.json();
      const existing = alarms.find((a: any) => a.id === id);
      if (!existing) return;

      await this.fetch(`/api/alarms/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ ...existing, time: newDate.toISOString() }),
      });
    } catch (err) {
      console.error('NextAlarm reschedule failed:', err);
    }
  }

  async list(): Promise<SchedulePayload[]> {
    try {
      const res = await this.fetch('/api/alarms');
      const alarms = await res.json();
      return alarms.map((a: any) => ({
        id: a.id,
        title: 'تنبيه',
        message: a.message,
        scheduledAt: new Date(a.time),
        chatIds: a.chatIds,
        repeat: a.repeat,
      }));
    } catch {
      return [];
    }
  }

  async markRead(_id: string): Promise<void> {
    // Next Alarm doesn't have a read concept; no-op
  }

  async test(chatId: string): Promise<{ success: boolean; message: string }> {
    try {
      const res = await this.fetch('/api/contacts/test', {
        method: 'POST',
        body: JSON.stringify({ chatId, name: 'منظومة التحصيل' }),
      });
      const data = await res.json();
      return { success: data.success, message: data.message ?? data.error ?? '' };
    } catch (err) {
      return { success: false, message: 'فشل الاتصال بخادم Next Alarm' };
    }
  }
}

// ── Factory ────────────────────────────────────────────────
let _adapter: NotificationAdapter | null = null;

export async function getNotificationAdapter(): Promise<NotificationAdapter> {
  if (_adapter) return _adapter;

  const { settingsRepo } = await import('@/lib/db/settingsRepo');
  const settings = await settingsRepo.get();

  if (settings.nextAlarmEnabled && settings.nextAlarmBaseUrl) {
    _adapter = new NextAlarmAdapter(settings.nextAlarmBaseUrl, []);
  } else {
    _adapter = new LocalNotificationAdapter();
  }

  return _adapter;
}

// Reset adapter (called after settings change)
export function resetAdapter(): void {
  _adapter = null;
}

// ── Notification event helpers ─────────────────────────────
export async function schedulePromiseReminder(
  promiseId: string,
  customerName: string,
  amount: number,
  dueDate: Date,
): Promise<void> {
  const adapter = await getNotificationAdapter();
  const { formatCurrency } = await import('@/lib/utils/helpers');
  await adapter.schedule({
    id: `promise-${promiseId}`,
    title: `⚠️ وعد استحقاق — ${customerName}`,
    message: `موعد الوعد بالسداد ${formatCurrency(amount)} — ${customerName}`,
    scheduledAt: dueDate,
  });
}

export async function cancelPromiseReminder(promiseId: string): Promise<void> {
  const adapter = await getNotificationAdapter();
  await adapter.cancel(`promise-${promiseId}`);
}

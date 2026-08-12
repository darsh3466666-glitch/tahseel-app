// ============================================================
// Domain Types — منظومة التحصيل
// Source of truth for all entities
// ============================================================

// ── Customer ──────────────────────────────────────────────
export type CustomerStatus = 'active' | 'inactive' | 'overdue' | 'paid';
export type RiskLevel = 'GREEN' | 'YELLOW' | 'ORANGE' | 'RED';

export interface CustomerLocation {
  lat: number;
  lng: number;
  address?: string;
}

export interface Customer {
  id: string;
  code: string;           // كود العميل
  name: string;           // اسم العميل
  currentBalance: number; // الرصيد الحالي
  lastPaymentDate: string | null;   // ISO date string
  lastInvoiceDate: string | null;
  lastVisitDate: string | null;
  paymentTerms: string;   // شروط السداد
  collectionDate: string; // موعد التحصيل (e.g. "الثلاثاء")
  status: CustomerStatus;
  classification: string; // تصنيف العميل
  notes: string;
  agreements: string;     // الاتفاقيات
  cycleStartDate: string | null;
  totalWithdrawn: number; // إجمالي المسحوب
  totalPaid: number;      // إجمالي المدفوع
  location: CustomerLocation | null;
  region: string;         // خط السير / المنطقة
  riskLevel: RiskLevel;
  riskScore: number;      // 0–100
  previousBalance: number; // الرصيد السابق
  collectorName: string;   // المسئول عن التحصيل
  createdAt: string;
  updatedAt: string;
}

// ── Payment ───────────────────────────────────────────────
export interface Payment {
  id: string;
  customerId: string;
  customerName: string;
  amount: number;
  date: string;           // ISO date string
  visitId: string | null;
  notes: string;
  receiptNumber: string | null;
  createdAt: string;
}

// ── Invoice ───────────────────────────────────────────────
export interface Invoice {
  id: string;
  invoiceNumber: string;  // رقم الفاتورة (e.g. "M3185")
  customerId: string;
  customerName: string;
  amount: number;
  date: string;           // ISO date string
  createdAt: string;
}

// ── Visit ─────────────────────────────────────────────────
export type VisitStatus = 'planned' | 'started' | 'completed' | 'skipped';
export type VisitResult = 'collected' | 'promise' | 'no_response' | 'refused' | null;
export type ContactMethod = 'in_person' | 'phone' | 'whatsapp' | null;

export interface Visit {
  id: string;
  customerId: string;
  customerName: string;
  plannedDate: string;
  startedAt: string | null;
  completedAt: string | null;
  status: VisitStatus;
  result: VisitResult;
  collectedAmount: number;
  targetAmount: number;
  notes: string;
  contactMethod: ContactMethod;
  createdAt: string;
}

// ── Promise ───────────────────────────────────────────────
export type PromiseStatus = 'active' | 'fulfilled' | 'partial' | 'broken';

export interface PaymentPromise {
  id: string;
  customerId: string;
  customerName: string;
  amount: number;
  dueDate: string;
  status: PromiseStatus;
  visitId: string | null;
  fulfilledAmount: number;
  notes: string;
  reminderSent: boolean;
  createdAt: string;
  updatedAt: string;
}

// ── Route ─────────────────────────────────────────────────
export type RouteStatus = 'planned' | 'started' | 'completed';
export type RouteStopStatus = 'pending' | 'visited' | 'skipped';

export interface Route {
  id: string;
  date: string;           // ISO date string (YYYY-MM-DD)
  name: string;           // e.g. "مسار مصطفى 12/8/2026"
  collectorName: string;
  status: RouteStatus;
  totalTarget: number;
  totalCollected: number;
  createdAt: string;
}

export interface RouteStop {
  id: string;
  routeId: string;
  customerId: string;
  customerName: string;
  order: number;
  status: RouteStopStatus;
  targetAmount: number;
  region: string;
  lastPaymentDate?: string | null;
  lastInvoiceDate?: string | null;
  lastReply?: string;
  totalWithdrawn?: number;
  totalPaid?: number;
  remainingDebt?: number;
  collectionRatio?: number;
  rating?: string;
}

// ── Task ──────────────────────────────────────────────────
export type TaskStatus = 'pending' | 'in_progress' | 'done';

export interface Task {
  id: string;
  date: string;           // ISO date (YYYY-MM-DD)
  title: string;
  status: TaskStatus;
  completionRate: number; // 0–1
  notes: string;
  dueTime: string | null; // e.g. "17:00"
  createdAt: string;
}

// ── Notification ──────────────────────────────────────────
export type NotificationEventType =
  | 'PROMISE_CREATED'
  | 'PROMISE_DUE_SOON'
  | 'PROMISE_DUE'
  | 'PROMISE_BROKEN'
  | 'VISIT_DUE'
  | 'VISIT_OVERDUE'
  | 'ROUTE_NOT_STARTED'
  | 'ROUTE_INCOMPLETE'
  | 'TASK_DUE'
  | 'TASK_OVERDUE'
  | 'HIGH_RISK_CUSTOMER';

export interface AppNotification {
  id: string;
  type: NotificationEventType;
  title: string;
  body: string;
  customerId: string | null;
  promiseId: string | null;
  visitId: string | null;
  read: boolean;
  scheduledAt: string;
  createdAt: string;
}

// ── Daily Stats ───────────────────────────────────────────
export interface DailyStats {
  id: string;
  date: string;           // YYYY-MM-DD
  targetAmount: number;
  collectedAmount: number;
  collectionRate: number; // 0–1
  totalCustomers: number;
  visitedCustomers: number;
  completedVisits: number;
  pendingVisits: number;
  overduePromises: number;
  brokenPromises: number;
  collectorScore: number; // 0–100
  createdAt: string;
  updatedAt: string;
}

// ── Settings ──────────────────────────────────────────────
export interface AppSettings {
  collectorName: string;
  collectorId: string;
  nextAlarmBaseUrl: string;    // e.g. "https://alarm.example.com"
  nextAlarmEnabled: boolean;
  weeklyTarget: number;        // مستهدف أسبوعي 4,000,000
  currency: string;            // e.g. "ج.م"
  defaultRegion: string;
  theme: 'light' | 'dark' | 'system';
}

// ── Audit Log ─────────────────────────────────────────────
export interface AuditLog {
  id: string;
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'IMPORT';
  table: string;
  recordId: string;
  before: string | null;  // JSON
  after: string | null;   // JSON
  createdAt: string;
}

// ── Import Record ─────────────────────────────────────────
export type ImportStatus = 'preview' | 'committed' | 'failed';

export interface ImportRecord {
  id: string;
  filename: string;
  status: ImportStatus;
  rowsDetected: number;
  newRecords: number;
  updates: number;
  conflicts: number;
  invalid: number;
  errorDetails: string | null;
  createdAt: string;
}

// ── Notification Adapter Interface ────────────────────────
export interface SchedulePayload {
  id: string;
  title: string;
  message: string;
  scheduledAt: Date;
  chatIds?: string[];
  repeat?: 'none' | 'daily' | 'weekly' | 'monthly';
}

export interface NotificationAdapter {
  schedule(payload: SchedulePayload): Promise<{ success: boolean; externalId?: string }>;
  cancel(id: string): Promise<void>;
  reschedule(id: string, newDate: Date): Promise<void>;
  list(): Promise<SchedulePayload[]>;
  markRead(id: string): Promise<void>;
  test(chatId: string): Promise<{ success: boolean; message: string }>;
}

// ── Collector Scoring ─────────────────────────────────────
export interface CollectorScore {
  total: number;              // 0–100
  collectionRate: number;     // 35%
  visitCompletion: number;    // 20%
  promiseFollowUp: number;    // 15%
  dataQuality: number;        // 10%
  routeCompliance: number;    // 10%
  debtQuality: number;        // 10%
  date: string;
}

// ── Import Preview Types ───────────────────────────────────
export interface ImportPreviewRow<T> {
  rowIndex: number;
  data: T;
  action: 'new' | 'update' | 'skip' | 'invalid';
  reason?: string;
  existing?: T;
}

export interface ImportPreview<T> {
  sheetName: string;
  totalRows: number;
  valid: number;
  invalid: number;
  newRecords: number;
  updates: number;
  conflicts: number;
  rows: ImportPreviewRow<T>[];
}

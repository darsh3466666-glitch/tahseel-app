// ============================================================
// Excel Importer — Complete workbook parser
// Converts Excel sheets to normalized domain objects
// NEVER modifies existing records silently
// ============================================================

import * as XLSX from 'xlsx';
import type {
  Customer,
  Payment,
  Invoice,
  Task,
} from '@/types/domain';
import type { ImportPreview, ImportPreviewRow } from '@/types/domain';
export type { ImportPreview, ImportPreviewRow };
import {
  excelDateToISO,
  normalizeArabicName,
  generateId,
  nowISO,
} from '@/lib/utils/helpers';
import { computeRiskLevel } from '@/lib/scoring/risk';

// ── Workbook loading ───────────────────────────────────────
export function loadWorkbook(file: File): Promise<XLSX.WorkBook> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target!.result as ArrayBuffer);
        const wb = XLSX.read(data, {
          type: 'array',
          cellDates: false,
          cellNF: false,
          cellFormula: false,
        });
        resolve(wb);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

function getSheet(wb: XLSX.WorkBook, name: string): any[][] | null {
  const ws = wb.Sheets[name];
  if (!ws || !ws['!ref']) return null;
  return XLSX.utils.sheet_to_json(ws, {
    header: 1,
    defval: '',
    blankrows: false,
  }) as any[][];
}

function parseNum(val: any): number {
  const n = parseFloat(String(val).replace(/,/g, ''));
  return isNaN(n) ? 0 : n;
}

function parseDate(val: any): string | null {
  if (!val) return null;
  const n = parseFloat(String(val));
  if (!isNaN(n) && n > 1000) return excelDateToISO(n);
  if (typeof val === 'string' && val.match(/\d{1,2}\/\d{1,2}\/\d{4}/)) {
    const parts = val.split('/');
    return `20${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
  }
  return null;
}

function cleanStr(val: any): string {
  return String(val ?? '').trim();
}

// ── Parse Master_Data sheet ────────────────────────────────
export function parseMasterData(wb: XLSX.WorkBook): ImportPreview<Partial<Customer>> {
  const rows = getSheet(wb, 'Master_Data');
  if (!rows || rows.length < 2) {
    return { sheetName: 'Master_Data', totalRows: 0, valid: 0, invalid: 0, newRecords: 0, updates: 0, conflicts: 0, rows: [] };
  }

  // First row is headers
  const headers = rows[0].map(h => cleanStr(h));
  const dataRows = rows.slice(1);

  const findCol = (keywords: string[]): number => {
    return headers.findIndex(h => keywords.some(kw => h.includes(kw)));
  };

  const colCode        = findCol(['كود']);
  const colName        = findCol(['اسم العميل', 'اسم']);
  const colBalance     = findCol(['الرصيد الحالي', 'الرصيد']);
  const colLastPayment = findCol(['تاريخ اخر سداد', 'آخر سداد', 'اخر سداد']);
  const colLastInvoice = findCol(['تاريخ اخر فاتورة', 'آخر فاتورة']);
  const colTerms       = findCol(['شروط السداد', 'شروط']);
  const colCollDate    = findCol(['موعد التحصيل', 'تاريخ التحصيل']);
  const colStatus      = findCol(['حالة العميل', 'الحالة']);
  const colClass       = findCol(['تصنيف']);
  const colNotes       = findCol(['ملاحظات']);
  const colRegion      = findCol(['خط السير', 'المنطقة']);
  const colWithdrawn   = findCol(['اجمالي المسحوب', 'المسحوب']);
  const colPaid        = findCol(['اجمالي المدفوع', 'المدفوع']);

  const previewRows: ImportPreviewRow<Partial<Customer>>[] = [];
  let valid = 0, invalid = 0;

  for (let i = 0; i < dataRows.length; i++) {
    const row = dataRows[i];
    const name = cleanStr(row[colName] ?? '');
    const code = cleanStr(row[colCode] ?? '');

    if (!name || name.length < 2) {
      invalid++;
      previewRows.push({
        rowIndex: i + 2,
        data: { name, code },
        action: 'invalid',
        reason: 'اسم العميل مفقود',
      });
      continue;
    }

    const balance = parseNum(row[colBalance]);
    const totalWithdrawn = parseNum(row[colWithdrawn]);
    const totalPaid = parseNum(row[colPaid]);
    const lastPaymentDate = parseDate(row[colLastPayment]);
    const lastInvoiceDate = parseDate(row[colLastInvoice]);

    const risk = computeRiskLevel({ currentBalance: balance, totalWithdrawn, totalPaid, lastPaymentDate });

    const customer: Partial<Customer> = {
      code: code || `AUTO-${i}`,
      name: normalizeArabicName(name),
      currentBalance: balance,
      lastPaymentDate,
      lastInvoiceDate,
      paymentTerms: colTerms >= 0 ? cleanStr(row[colTerms]) : '',
      collectionDate: colCollDate >= 0 ? cleanStr(row[colCollDate]) : '',
      status: 'active',
      classification: colClass >= 0 ? cleanStr(row[colClass]) : '',
      notes: colNotes >= 0 ? cleanStr(row[colNotes]) : '',
      region: colRegion >= 0 ? cleanStr(row[colRegion]) : '',
      totalWithdrawn,
      totalPaid,
      riskLevel: risk.level,
      riskScore: risk.score,
      agreements: '',
      previousBalance: 0,
      location: null,
      cycleStartDate: null,
      lastVisitDate: null,
    };

    valid++;
    previewRows.push({ rowIndex: i + 2, data: customer, action: 'new' });
  }

  return {
    sheetName: 'Master_Data',
    totalRows: dataRows.length,
    valid,
    invalid,
    newRecords: valid,
    updates: 0,
    conflicts: 0,
    rows: previewRows,
  };
}

// ── Parse قبض (Payments) ───────────────────────────────────
export function parsePayments(wb: XLSX.WorkBook): ImportPreview<Partial<Payment>> {
  const rows = getSheet(wb, 'قبض');
  if (!rows || rows.length < 2) {
    return { sheetName: 'قبض', totalRows: 0, valid: 0, invalid: 0, newRecords: 0, updates: 0, conflicts: 0, rows: [] };
  }

  const headers = rows[0].map(h => cleanStr(h));
  const dataRows = rows.slice(1);

  const colName   = headers.findIndex(h => h.includes('اسم') || h.includes('العميل'));
  const colDate   = headers.findIndex(h => h.includes('تاريخ'));
  const colAmount = headers.findIndex(h => h.includes('المبلغ') || h.includes('القيمة'));

  const previewRows: ImportPreviewRow<Partial<Payment>>[] = [];
  let valid = 0, invalid = 0;

  for (let i = 0; i < dataRows.length; i++) {
    const row = dataRows[i];
    const customerName = cleanStr(row[colName] ?? '');
    const amount = parseNum(row[colAmount]);
    const date = parseDate(row[colDate]);

    if (!customerName || amount <= 0) {
      invalid++;
      previewRows.push({ rowIndex: i + 2, data: { customerName, amount }, action: 'invalid', reason: 'بيانات غير مكتملة' });
      continue;
    }

    valid++;
    previewRows.push({
      rowIndex: i + 2,
      data: {
        customerName: normalizeArabicName(customerName),
        customerId: '', // resolved during commit
        amount,
        date: date ?? nowISO().slice(0, 10),
        visitId: null,
        notes: '',
        receiptNumber: null,
      },
      action: 'new',
    });
  }

  return { sheetName: 'قبض', totalRows: dataRows.length, valid, invalid, newRecords: valid, updates: 0, conflicts: 0, rows: previewRows };
}

// ── Parse فواتير (Invoices) ────────────────────────────────
export function parseInvoices(wb: XLSX.WorkBook): ImportPreview<Partial<Invoice>> {
  const rows = getSheet(wb, 'فواتير');
  if (!rows || rows.length < 2) {
    return { sheetName: 'فواتير', totalRows: 0, valid: 0, invalid: 0, newRecords: 0, updates: 0, conflicts: 0, rows: [] };
  }

  const headers = rows[0].map(h => cleanStr(h));
  const dataRows = rows.slice(1);

  const colInvNum  = headers.findIndex(h => h.includes('رقم'));
  const colDate    = headers.findIndex(h => h.includes('تاريخ'));
  const colName    = headers.findIndex(h => h.includes('العميل') || h.includes('اسم'));
  const colAmount  = headers.findIndex(h => h.includes('اجمالي') || h.includes('المبلغ') || h.includes('القيمة'));

  const previewRows: ImportPreviewRow<Partial<Invoice>>[] = [];
  let valid = 0, invalid = 0;

  for (let i = 0; i < dataRows.length; i++) {
    const row = dataRows[i];
    const invoiceNumber = cleanStr(row[colInvNum] ?? `INV-${i}`);
    const customerName  = cleanStr(row[colName] ?? '');
    const amount        = parseNum(row[colAmount]);
    const date          = parseDate(row[colDate]);

    if (!customerName || amount <= 0) {
      invalid++;
      previewRows.push({ rowIndex: i + 2, data: { invoiceNumber, customerName, amount }, action: 'invalid', reason: 'بيانات غير مكتملة' });
      continue;
    }

    valid++;
    previewRows.push({
      rowIndex: i + 2,
      data: {
        invoiceNumber,
        customerName: normalizeArabicName(customerName),
        customerId: '',
        amount,
        date: date ?? nowISO().slice(0, 10),
      },
      action: 'new',
    });
  }

  return { sheetName: 'فواتير', totalRows: dataRows.length, valid, invalid, newRecords: valid, updates: 0, conflicts: 0, rows: previewRows };
}

// ── Parse مهام يومية (Tasks) ───────────────────────────────
export function parseTasks(wb: XLSX.WorkBook): ImportPreview<Partial<Task>> {
  const sheetName = 'مهام يومية ';
  const rows = getSheet(wb, sheetName) ?? getSheet(wb, 'مهام يومية');
  if (!rows || rows.length < 2) {
    return { sheetName, totalRows: 0, valid: 0, invalid: 0, newRecords: 0, updates: 0, conflicts: 0, rows: [] };
  }

  // Row 0: summary, Row 1: headers, Row 2+: data
  const dataRows = rows.slice(2);
  const previewRows: ImportPreviewRow<Partial<Task>>[] = [];
  let valid = 0, invalid = 0;
  const today = nowISO().slice(0, 10);

  for (let i = 0; i < dataRows.length; i++) {
    const row = dataRows[i];
    const title = cleanStr(row[1] ?? '');
    if (!title) { invalid++; continue; }

    const statusRaw = cleanStr(row[2] ?? '');
    let status: Task['status'] = 'pending';
    if (statusRaw.includes('تم') || statusRaw.includes('انتهاء')) status = 'done';
    else if (statusRaw.includes('جاري') || statusRaw.includes('يجري')) status = 'in_progress';

    const completionRaw = parseNum(row[3]);
    const completionRate = isNaN(completionRaw) ? (status === 'done' ? 1 : 0) : completionRaw;

    valid++;
    previewRows.push({
      rowIndex: i + 3,
      data: { title, status, completionRate, date: today, notes: '', dueTime: null },
      action: 'new',
    });
  }

  return { sheetName, totalRows: dataRows.length, valid, invalid, newRecords: valid, updates: 0, conflicts: 0, rows: previewRows };
}

// ── Full workbook analysis ─────────────────────────────────
export interface WorkbookAnalysis {
  customers: ImportPreview<Partial<Customer>>;
  payments: ImportPreview<Partial<Payment>>;
  invoices: ImportPreview<Partial<Invoice>>;
  tasks: ImportPreview<Partial<Task>>;
  sheetsFound: string[];
}

export function analyzeWorkbook(wb: XLSX.WorkBook): WorkbookAnalysis {
  return {
    customers: parseMasterData(wb),
    payments:  parsePayments(wb),
    invoices:  parseInvoices(wb),
    tasks:     parseTasks(wb),
    sheetsFound: wb.SheetNames,
  };
}

'use client';

import { useState, useCallback } from 'react';
import { Upload, FileSpreadsheet, CheckCircle, AlertCircle, Info, Loader2 } from 'lucide-react';
import type { WorkbookAnalysis } from '@/lib/import/excelParser';
import type { ImportPreview } from '@/types/domain';
import { formatCurrency } from '@/lib/utils/helpers';

function PreviewCard({ preview, label }: { preview: ImportPreview<any>; label: string }) {
  const [expanded, setExpanded] = useState(false);
  if (preview.totalRows === 0) return null;

  return (
    <div className="card space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-sm">{label}</h3>
        <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
          {preview.totalRows} صف
        </span>
      </div>

      <div className="grid grid-cols-4 gap-2 text-center">
        <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-2">
          <p className="text-lg font-bold text-green-600">{preview.newRecords}</p>
          <p className="text-xs text-green-600">جديد</p>
        </div>
        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-2">
          <p className="text-lg font-bold text-blue-600">{preview.updates}</p>
          <p className="text-xs text-blue-600">تحديث</p>
        </div>
        <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-2">
          <p className="text-lg font-bold text-yellow-600">{preview.conflicts}</p>
          <p className="text-xs text-yellow-600">تعارض</p>
        </div>
        <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-2">
          <p className="text-lg font-bold text-red-600">{preview.invalid}</p>
          <p className="text-xs text-red-600">خطأ</p>
        </div>
      </div>

      {preview.rows.length > 0 && (
        <button
          onClick={() => setExpanded(e => !e)}
          className="text-xs text-blue-600 hover:underline"
        >
          {expanded ? 'إخفاء التفاصيل' : 'عرض التفاصيل'}
        </button>
      )}

      {expanded && (
        <div className="overflow-x-auto rounded-lg border" style={{ borderColor: 'var(--border)' }}>
          <table className="w-full text-xs min-w-[400px]">
            <thead>
              <tr style={{ background: 'var(--muted)' }}>
                <th className="px-2 py-1.5 text-right">صف</th>
                <th className="px-2 py-1.5 text-right">الاسم / البيان</th>
                <th className="px-2 py-1.5 text-right">الإجراء</th>
                <th className="px-2 py-1.5 text-right">السبب</th>
              </tr>
            </thead>
            <tbody>
              {preview.rows.slice(0, 20).map((row: any, i: number) => (
                <tr
                  key={i}
                  className="border-t"
                  style={{ borderColor: 'var(--border)' }}
                >
                  <td className="px-2 py-1.5" style={{ color: 'var(--muted-foreground)' }}>{row.rowIndex}</td>
                  <td className="px-2 py-1.5 font-medium">
                    {(row.data as any).name || (row.data as any).customerName || '—'}
                  </td>
                  <td className="px-2 py-1.5">
                    <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                      row.action === 'new' ? 'bg-green-100 text-green-700' :
                      row.action === 'update' ? 'bg-blue-100 text-blue-700' :
                      row.action === 'invalid' ? 'bg-red-100 text-red-700' :
                      'bg-gray-100 text-gray-600'
                    }`}>
                      {row.action === 'new' ? 'إضافة' :
                       row.action === 'update' ? 'تحديث' :
                       row.action === 'invalid' ? 'خطأ' : 'تخطي'}
                    </span>
                  </td>
                  <td className="px-2 py-1.5" style={{ color: 'var(--muted-foreground)' }}>
                    {row.reason || '—'}
                  </td>
                </tr>
              ))}
              {preview.rows.length > 20 && (
                <tr>
                  <td colSpan={4} className="px-2 py-2 text-center" style={{ color: 'var(--muted-foreground)' }}>
                    + {preview.rows.length - 20} صف أخرى
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function ImportPage() {
  const [dragging, setDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [analysis, setAnalysis] = useState<WorkbookAnalysis | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [committed, setCommitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const analyze = useCallback(async (f: File) => {
    setFile(f);
    setAnalyzing(true);
    setError(null);
    setAnalysis(null);
    setCommitted(false);

    try {
      const { loadWorkbook, analyzeWorkbook } = await import('@/lib/import/excelParser');
      const wb = await loadWorkbook(f);
      const result = analyzeWorkbook(wb);
      setAnalysis(result);
    } catch (err) {
      setError(`فشل تحليل الملف: ${String(err)}`);
    } finally {
      setAnalyzing(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) analyze(f);
  }, [analyze]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) analyze(f);
  }, [analyze]);

  const commit = useCallback(async () => {
    if (!analysis) return;
    setCommitting(true);
    setError(null);

    try {
      const { customerRepo } = await import('@/lib/db/customerRepo');
      const { paymentRepo, invoiceRepo } = await import('@/lib/db/paymentRepo');
      const { getDb } = await import('@/lib/db/database');
      const db = getDb();
      const { generateId, nowISO, normalizeArabicName } = await import('@/lib/utils/helpers');

      // 1. Import customers
      const validCustomers = analysis.customers.rows
        .filter(r => r.action !== 'invalid')
        .map(r => r.data as any);

      for (const c of validCustomers) {
        await customerRepo.upsert({
          ...c,
          lastVisitDate: null,
          agreements: c.agreements || '',
          previousBalance: c.previousBalance || 0,
        });
      }

      // 2. Import payments (link by name)
      const allCustomers = await customerRepo.getAll();
      const nameMap = new Map(allCustomers.map(c => [normalizeArabicName(c.name), c.id]));

      const validPayments = analysis.payments.rows
        .filter(r => r.action !== 'invalid')
        .map(r => r.data as any)
        .map((p: any) => ({
          ...p,
          customerId: nameMap.get(normalizeArabicName(p.customerName)) || '',
        }));

      await paymentRepo.bulkCreate(validPayments);

      // 3. Import invoices
      const validInvoices = analysis.invoices.rows
        .filter(r => r.action !== 'invalid')
        .map(r => r.data as any)
        .map((inv: any) => ({
          ...inv,
          customerId: nameMap.get(normalizeArabicName(inv.customerName)) || '',
        }));

      await invoiceRepo.bulkCreate(validInvoices);

      // 4. Import tasks
      const { getDb: getDb2 } = await import('@/lib/db/database');
      const validTasks = analysis.tasks.rows
        .filter(r => r.action !== 'invalid')
        .map(r => ({ ...(r.data as any), id: generateId(), createdAt: nowISO() }));

      if (validTasks.length > 0) {
        await getDb2().tasks.bulkAdd(validTasks);
      }

      setCommitted(true);
    } catch (err) {
      setError(`فشل الاستيراد: ${String(err)}`);
    } finally {
      setCommitting(false);
    }
  }, [analysis]);

  const total = analysis
    ? analysis.customers.newRecords + analysis.payments.newRecords + analysis.invoices.newRecords
    : 0;

  return (
    <div className="space-y-5 pb-8">
      <div>
        <h1 className="text-xl font-bold">استيراد البيانات</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--muted-foreground)' }}>
          استيراد بيانات شيت التحصيل من Excel — مع معاينة كاملة قبل الحفظ
        </p>
      </div>

      {/* Upload zone */}
      {!analysis && !analyzing && (
        <label
          className={`block border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
            dragging ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : ''
          }`}
          style={!dragging ? { borderColor: 'var(--border)' } : {}}
          onDragOver={e => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
        >
          <input
            type="file"
            accept=".xlsx,.xlsm,.xls"
            onChange={handleFileInput}
            className="hidden"
          />
          <FileSpreadsheet size={48} className="mx-auto mb-4 text-green-600" />
          <p className="font-bold text-lg mb-2">اسحب ملف Excel هنا أو اضغط للاختيار</p>
          <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
            يدعم ملفات .xlsx و .xlsm و .xls
          </p>
          <p className="text-xs mt-2 text-blue-600 font-medium">
            شيت تحصيل.xlsm
          </p>
        </label>
      )}

      {/* Analyzing */}
      {analyzing && (
        <div className="card text-center py-12">
          <Loader2 size={36} className="animate-spin mx-auto mb-4 text-blue-600" />
          <p className="font-medium">جاري تحليل الملف...</p>
          <p className="text-sm mt-1" style={{ color: 'var(--muted-foreground)' }}>
            قراءة وتحليل البيانات من جميع الشيتات
          </p>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="card border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 flex gap-3 p-4">
          <AlertCircle size={20} className="text-red-500 shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-red-700 dark:text-red-400">خطأ</p>
            <p className="text-sm text-red-600 dark:text-red-300 mt-1">{error}</p>
          </div>
        </div>
      )}

      {/* Success */}
      {committed && (
        <div className="card border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20 flex gap-3 p-4">
          <CheckCircle size={20} className="text-green-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-green-700 dark:text-green-400">تم الاستيراد بنجاح!</p>
            <p className="text-sm text-green-600 dark:text-green-300 mt-1">
              تم حفظ {total} سجل في قاعدة البيانات المحلية.
            </p>
          </div>
        </div>
      )}

      {/* Analysis results */}
      {analysis && !committed && (
        <>
          <div className="card border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 flex gap-3 p-4">
            <Info size={20} className="text-blue-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-blue-700 dark:text-blue-400">
                تم تحليل الملف — {file?.name}
              </p>
              <p className="text-sm text-blue-600 dark:text-blue-300 mt-1">
                الشيتات المكتشفة: {analysis.sheetsFound.join(' ، ')}
              </p>
              <p className="text-sm text-blue-600 dark:text-blue-300">
                إجمالي السجلات المراد إضافتها: <strong>{total}</strong>
              </p>
            </div>
          </div>

          {/* Preview cards */}
          <PreviewCard preview={analysis.customers} label="العملاء (Master_Data)" />
          <PreviewCard preview={analysis.payments} label="المدفوعات (قبض)" />
          <PreviewCard preview={analysis.invoices} label="الفواتير (فواتير)" />
          <PreviewCard preview={analysis.tasks} label="المهام اليومية" />

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={() => { setAnalysis(null); setFile(null); }}
              className="flex-1 py-3 rounded-xl border font-medium text-sm hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
              style={{ borderColor: 'var(--border)' }}
            >
              إلغاء
            </button>
            <button
              onClick={commit}
              disabled={committing || total === 0}
              className="flex-1 py-3 rounded-xl bg-blue-600 text-white font-medium text-sm hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
            >
              {committing ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
              {committing ? 'جاري الحفظ...' : `حفظ ${total} سجل`}
            </button>
          </div>
        </>
      )}

      {/* Info note */}
      <div className="card bg-yellow-50 dark:bg-yellow-900/10 border border-yellow-200 dark:border-yellow-800 p-4">
        <p className="text-sm font-medium text-yellow-800 dark:text-yellow-400">⚠️ ملاحظة مهمة</p>
        <ul className="mt-2 text-xs text-yellow-700 dark:text-yellow-300 space-y-1 list-disc pr-4">
          <li>ستحتفظ العملاء الموجودون ببياناتهم وسيتم تحديث أرصدتهم فقط</li>
          <li>المدفوعات والفواتير يتم إضافتها ولا يتم حذف السجلات القديمة</li>
          <li>يتم التعرف على العملاء بالكود أولاً ثم بالاسم</li>
        </ul>
      </div>
    </div>
  );
}

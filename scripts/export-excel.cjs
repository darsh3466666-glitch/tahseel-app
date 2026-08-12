/**
 * export-excel.cjs
 * ─────────────────────────────────────────────────────────
 * Reads شيت تحصيل.xlsm → exports JSON files to public/data/
 * Called automatically by the PowerShell watcher on file change
 * ─────────────────────────────────────────────────────────
 */

const XLSX = require('xlsx');
const fs   = require('fs');
const path = require('path');

const EXCEL_PATH = 'D:\\Mostafa Ibrahim\\شيت تحصيل.xlsm';
const OUT_DIR    = path.join(__dirname, 'public', 'data');

// ── Helpers ──────────────────────────────────────────────────
function excelDateToISO(serial) {
  if (!serial || isNaN(serial)) return null;
  const d = new Date(Date.UTC(1899, 11, 30) + Number(serial) * 86400000);
  return isNaN(d) ? null : d.toISOString().slice(0, 10);
}

function num(val) {
  const n = parseFloat(String(val).replace(/,/g, ''));
  return isNaN(n) ? 0 : n;
}

function str(val) {
  return String(val ?? '').trim();
}

function normalizeAr(name) {
  return name.trim().replace(/\s+/g,' ').replace(/[أإآ]/g,'ا').replace(/ة/g,'ه').replace(/ى/g,'ي');
}

function getSheet(wb, name) {
  const ws = wb.Sheets[name];
  if (!ws || !ws['!ref']) return [];
  return XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', blankrows: false });
}

function findCol(headers, keywords) {
  return headers.findIndex(h => keywords.some(k => str(h).includes(k)));
}

// ── Parse Master_Data → customers.json ───────────────────────
function parseCustomers(wb) {
  const rows = getSheet(wb, 'Master_Data');
  if (rows.length < 2) return [];
  const h = rows[0];
  const ci = {
    code:        findCol(h, ['كود']),
    name:        findCol(h, ['اسم العميل','اسم']),
    balance:     findCol(h, ['الرصيد الحالي','الرصيد']),
    lastPay:     findCol(h, ['تاريخ اخر سداد','آخر سداد']),
    lastInv:     findCol(h, ['تاريخ اخر فاتورة','آخر فاتورة']),
    terms:       findCol(h, ['شروط السداد','شروط']),
    collDate:    findCol(h, ['موعد التحصيل','تاريخ التحصيل']),
    status:      findCol(h, ['حالة العميل','الحالة']),
    class:       findCol(h, ['تصنيف']),
    notes:       findCol(h, ['ملاحظات']),
    region:      findCol(h, ['خط السير','المنطقة']),
    withdrawn:   findCol(h, ['اجمالي المسحوب','المسحوب']),
    paid:        findCol(h, ['اجمالي المدفوع','المدفوع']),
  };

  return rows.slice(1)
    .filter(r => str(r[ci.name]).length > 1)
    .map((r, i) => {
      const totalWithdrawn = num(r[ci.withdrawn]);
      const totalPaid      = num(r[ci.paid]);
      const balance        = num(r[ci.balance]);
      const lastPaymentDate = excelDateToISO(r[ci.lastPay]);
      
      // Compute risk level
      const payRatio = totalWithdrawn > 0 ? totalPaid / totalWithdrawn : 0;
      const daysSince = lastPaymentDate
        ? Math.floor((Date.now() - new Date(lastPaymentDate).getTime()) / 86400000)
        : 999;

      let riskScore = 100;
      if (payRatio < 0.5) riskScore -= 35;
      else if (payRatio < 0.7) riskScore -= 20;
      else if (payRatio < 0.85) riskScore -= 10;
      if (daysSince > 90) riskScore -= 30;
      else if (daysSince > 30) riskScore -= 20;
      else if (daysSince > 7) riskScore -= 10;
      if (balance > 500000) riskScore -= 15;
      else if (balance > 200000) riskScore -= 8;
      riskScore = Math.max(0, Math.min(100, riskScore));

      const riskLevel = riskScore >= 80 ? 'GREEN'
        : riskScore >= 60 ? 'YELLOW'
        : riskScore >= 40 ? 'ORANGE'
        : 'RED';

      return {
        code:            str(r[ci.code]) || `AUTO-${i}`,
        name:            normalizeAr(str(r[ci.name])),
        currentBalance:  balance,
        lastPaymentDate,
        lastInvoiceDate: excelDateToISO(r[ci.lastInv]),
        paymentTerms:    ci.terms >= 0 ? str(r[ci.terms]) : '',
        collectionDate:  ci.collDate >= 0 ? str(r[ci.collDate]) : '',
        status:          'active',
        classification:  ci.class >= 0 ? str(r[ci.class]) : '',
        notes:           ci.notes >= 0 ? str(r[ci.notes]) : '',
        region:          ci.region >= 0 ? str(r[ci.region]) : '',
        totalWithdrawn,
        totalPaid,
        riskLevel,
        riskScore,
        previousBalance: 0,
        location:        null,
        lastVisitDate:   null,
        cycleStartDate:  null,
        agreements:      '',
      };
    });
}

// ── Parse قبض → payments.json ─────────────────────────────────
function parsePayments(wb) {
  const rows = getSheet(wb, 'قبض');
  if (rows.length < 2) return [];
  const h = rows[0];
  const colName   = findCol(h, ['اسم','العميل']);
  const colDate   = findCol(h, ['تاريخ']);
  const colAmount = findCol(h, ['المبلغ','القيمة']);

  return rows.slice(1)
    .filter(r => str(r[colName]).length > 1 && num(r[colAmount]) > 0)
    .map(r => ({
      customerName: normalizeAr(str(r[colName])),
      amount:       num(r[colAmount]),
      date:         excelDateToISO(r[colDate]) ?? new Date().toISOString().slice(0,10),
    }));
}

// ── Parse فواتير → invoices.json ──────────────────────────────
function parseInvoices(wb) {
  const rows = getSheet(wb, 'فواتير');
  if (rows.length < 2) return [];
  const h = rows[0];
  const colNum    = findCol(h, ['رقم']);
  const colDate   = findCol(h, ['تاريخ']);
  const colName   = findCol(h, ['العميل','اسم']);
  const colAmount = findCol(h, ['اجمالي','المبلغ','القيمة']);

  return rows.slice(1)
    .filter(r => str(r[colName]).length > 1 && num(r[colAmount]) > 0)
    .map((r, i) => ({
      invoiceNumber: str(r[colNum]) || `INV-${i}`,
      customerName:  normalizeAr(str(r[colName])),
      amount:        num(r[colAmount]),
      date:          excelDateToISO(r[colDate]) ?? new Date().toISOString().slice(0,10),
    }));
}

// ── Parse خط_سير → route.json ─────────────────────────────────
function parseRoute(wb) {
  const rows = getSheet(wb, 'خط_سير');
  if (rows.length < 2) return [];
  const h = rows[0];
  const colName   = findCol(h, ['اسم العميل','اسم']);
  const colTarget = findCol(h, ['المديونية المستهدفة','المستهدفة']);
  const colRegion = findCol(h, ['خط السير','المنطقة']);
  const colLastPay= findCol(h, ['تاريخ اخر سداد']);
  const colRating = findCol(h, ['تقييم العميل']);

  return rows.slice(1)
    .filter(r => str(r[colName]).length > 1)
    .map((r, i) => ({
      order:          i + 1,
      customerName:   normalizeAr(str(r[colName])),
      targetAmount:   num(r[colTarget]),
      region:         colRegion >= 0 ? str(r[colRegion]) : '',
      lastPaymentDate: excelDateToISO(r[colLastPay]),
      rating:         colRating >= 0 ? str(r[colRating]) : '',
    }));
}

// ── Parse مهام يومية → tasks.json ─────────────────────────────
function parseTasks(wb) {
  const sheetName = wb.SheetNames.find(s => s.includes('مهام')) ?? 'مهام يومية';
  const rows = getSheet(wb, sheetName);
  if (rows.length < 3) return [];

  return rows.slice(2)
    .filter(r => str(r[1]).length > 1)
    .map((r, i) => {
      const statusRaw = str(r[2]);
      const status = statusRaw.includes('تم') ? 'done'
        : statusRaw.includes('جاري') ? 'in_progress'
        : 'pending';
      const rate = parseFloat(str(r[3]));
      return {
        order:          i + 1,
        title:          str(r[1]),
        status,
        completionRate: isNaN(rate) ? (status === 'done' ? 1 : 0) : rate,
        dueTime:        str(r[4]) || null,
      };
    });
}

// ── Parse cash flow summary → stats.json ──────────────────────
function parseStats(wb) {
  const rows = getSheet(wb, 'cash flow');
  if (rows.length < 2) return {};
  const r1 = rows[1];
  return {
    date:          excelDateToISO(r1[2]),
    targetAmount:  num(r1[3]),
    collectedAmount: num(r1[4]),
    collectionRate:  parseFloat(str(r1[5])) || 0,
    remaining:     num(r1[6]),
  };
}

// ── Main export ───────────────────────────────────────────────
function main() {
  console.log(`[${new Date().toLocaleTimeString('ar-EG')}] 📂 قراءة الشيت...`);

  if (!fs.existsSync(EXCEL_PATH)) {
    console.error(`❌ الملف غير موجود: ${EXCEL_PATH}`);
    process.exit(1);
  }

  let wb;
  try {
    wb = XLSX.readFile(EXCEL_PATH, { cellFormula: false, cellNF: false, cellHTML: false });
  } catch (err) {
    console.error(`❌ فشل فتح الشيت: ${err.message}`);
    process.exit(1);
  }

  // Ensure output directory
  if (!fs.existsSync(OUT_DIR)) {
    fs.mkdirSync(OUT_DIR, { recursive: true });
  }

  const customers = parseCustomers(wb);
  const payments  = parsePayments(wb);
  const invoices  = parseInvoices(wb);
  const route     = parseRoute(wb);
  const tasks     = parseTasks(wb);
  const stats     = parseStats(wb);
  const meta      = { exportedAt: new Date().toISOString(), version: 1 };

  const files = {
    'customers.json': customers,
    'payments.json':  payments,
    'invoices.json':  invoices,
    'route.json':     route,
    'tasks.json':     tasks,
    'stats.json':     stats,
    'meta.json':      meta,
  };

  for (const [name, data] of Object.entries(files)) {
    fs.writeFileSync(path.join(OUT_DIR, name), JSON.stringify(data, null, 2), 'utf8');
    const count = Array.isArray(data) ? data.length : 1;
    console.log(`  ✅ ${name}: ${count} سجل`);
  }

  console.log(`✨ تم التصدير بنجاح إلى public/data/`);
  console.log(`   العملاء: ${customers.length} | مدفوعات: ${payments.length} | فواتير: ${invoices.length}`);
}

main();

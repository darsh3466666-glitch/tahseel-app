import React, { useState } from 'react';
import { X, Calendar, DollarSign, FileText } from 'lucide-react';
import type { Customer, VisitResult } from '@/types/domain';
import { visitRepo, promiseRepo } from '@/lib/db/visitRepo';
import { schedulePromiseReminder } from '@/lib/notifications/adapters';
import { nowISO } from '@/lib/utils/helpers';
import { getDb } from '@/lib/db/database';
import { generateId } from '@/lib/utils/helpers';

interface VisitModalProps {
  customer: Customer;
  onClose: () => void;
  onSuccess: () => void;
}

export default function VisitModal({ customer, onClose, onSuccess }: VisitModalProps) {
  const [result, setResult] = useState<VisitResult>('promise');
  const [amount, setAmount] = useState('');
  const [notes, setNotes] = useState('');
  
  // For Promises
  const [promiseDate, setPromiseDate] = useState('');
  const [promiseTime, setPromiseTime] = useState('12:00');

  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);

    try {
      const numAmount = amount ? parseFloat(amount) : 0;

      // 1. Create the visit record
      const visit = await visitRepo.create({
        customerId: customer.id,
        customerName: customer.name,
        plannedDate: nowISO(),
        startedAt: nowISO(),
        completedAt: nowISO(),
        status: 'completed',
        result,
        collectedAmount: result === 'collected' ? numAmount : 0,
        targetAmount: customer.currentBalance,
        notes,
        contactMethod: 'in_person',
      });

      // 2. Handle specific results
      if (result === 'collected' && numAmount > 0) {
        // We simulate saving a payment by putting it in Dexie directly
        // Ideally we'd use paymentRepo, but the repo might not have create() if we only import
        // Let's use getDb directly just like in `paymentRepo.ts`
        const { paymentRepo } = await import('@/lib/db/paymentRepo');
        await paymentRepo.create({
          customerId: customer.id,
          customerName: customer.name,
          amount: numAmount,
          date: nowISO(),
          visitId: visit.id,
          notes,
          receiptNumber: null,
        });
        
        // Also update customer balance
        const { customerRepo } = await import('@/lib/db/customerRepo');
        await customerRepo.updateBalance(customer.id, numAmount);
      } 
      else if (result === 'promise' && promiseDate) {
        // Create Promise
        const dueDate = new Date(`${promiseDate}T${promiseTime}`);
        
        const promise = await promiseRepo.create({
          customerId: customer.id,
          customerName: customer.name,
          amount: numAmount,
          dueDate: dueDate.toISOString(),
          status: 'active',
          visitId: visit.id,
          fulfilledAmount: 0,
          notes,
          reminderSent: false,
        });

        // Schedule Next Alarm!
        await schedulePromiseReminder(promise.id, customer.name, numAmount, dueDate);
      }

      onSuccess();
    } catch (err) {
      console.error('Failed to save visit:', err);
      alert('حدث خطأ أثناء حفظ الزيارة');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-card w-full sm:w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl border border-border shadow-2xl p-6 animate-in slide-in-from-bottom-8 sm:slide-in-from-bottom-0 sm:zoom-in-95">
        
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold">تسجيل إجراء لـ {customer.name}</h2>
          <button onClick={onClose} className="p-2 bg-muted rounded-full text-muted-foreground hover:text-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          
          {/* Result Selection */}
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setResult('promise')}
              className={`p-3 rounded-xl border ${result === 'promise' ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-background hover:bg-muted'} flex flex-col items-center gap-2 transition-colors`}
            >
              <Calendar className="w-6 h-6" />
              <span className="text-sm font-medium">وعد بالسداد</span>
            </button>
            <button
              type="button"
              onClick={() => setResult('collected')}
              className={`p-3 rounded-xl border ${result === 'collected' ? 'border-emerald-500 bg-emerald-500/10 text-emerald-500' : 'border-border bg-background hover:bg-muted'} flex flex-col items-center gap-2 transition-colors`}
            >
              <DollarSign className="w-6 h-6" />
              <span className="text-sm font-medium">تحصيل نقدية</span>
            </button>
            <button
              type="button"
              onClick={() => setResult('no_response')}
              className={`p-3 rounded-xl border ${result === 'no_response' ? 'border-orange-500 bg-orange-500/10 text-orange-500' : 'border-border bg-background hover:bg-muted'} flex flex-col items-center gap-2 transition-colors`}
            >
              <X className="w-6 h-6" />
              <span className="text-sm font-medium">لم يتم الرد</span>
            </button>
            <button
              type="button"
              onClick={() => setResult('refused')}
              className={`p-3 rounded-xl border ${result === 'refused' ? 'border-destructive bg-destructive/10 text-destructive' : 'border-border bg-background hover:bg-muted'} flex flex-col items-center gap-2 transition-colors`}
            >
              <X className="w-6 h-6" />
              <span className="text-sm font-medium">رفض السداد</span>
            </button>
          </div>

          {/* Amount Field (For Promise or Collected) */}
          {(result === 'promise' || result === 'collected') && (
            <div>
              <label className="block text-sm font-medium mb-1">المبلغ</label>
              <div className="relative">
                <input
                  type="number"
                  required
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full bg-background border border-border rounded-xl py-3 px-4 outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                  placeholder="أدخل المبلغ..."
                />
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-medium">ج.م</span>
              </div>
            </div>
          )}

          {/* Date & Time for Promise */}
          {result === 'promise' && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium mb-1">تاريخ الوعد</label>
                <input
                  type="date"
                  required
                  value={promiseDate}
                  onChange={(e) => setPromiseDate(e.target.value)}
                  className="w-full bg-background border border-border rounded-xl py-3 px-4 outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">وقت التنبيه</label>
                <input
                  type="time"
                  required
                  value={promiseTime}
                  onChange={(e) => setPromiseTime(e.target.value)}
                  className="w-full bg-background border border-border rounded-xl py-3 px-4 outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                />
              </div>
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium mb-1">ملاحظات (اختياري)</label>
            <div className="relative">
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full bg-background border border-border rounded-xl py-3 px-10 outline-none focus:border-primary focus:ring-1 focus:ring-primary resize-none h-24"
                placeholder="تفاصيل إضافية عن الزيارة..."
              />
              <FileText className="w-5 h-5 absolute right-3 top-3 text-muted-foreground" />
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-xl py-4 shadow-lg disabled:opacity-50 mt-4"
          >
            {isSubmitting ? 'جاري الحفظ...' : 'حفظ الإجراء'}
          </button>

        </form>
      </div>
    </div>
  );
}

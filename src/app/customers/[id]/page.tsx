'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { customerRepo } from '@/lib/db/customerRepo';
import { visitRepo, promiseRepo } from '@/lib/db/visitRepo';
import { paymentRepo } from '@/lib/db/paymentRepo';
import type { Customer, Visit, PaymentPromise, Payment, Invoice } from '@/types/domain';
import { ArrowRight, MapPin, Phone, Calendar, DollarSign, Clock, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';
import { formatCurrency, formatDate } from '@/lib/utils/helpers';
import VisitModal from '@/components/features/VisitModal';
import { getDb } from '@/lib/db/database';

export default function CustomerDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [customer, setCustomer] = useState<Customer | null>(null);
  const [visits, setVisits] = useState<Visit[]>([]);
  const [promises, setPromises] = useState<PaymentPromise[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);

  const [isVisitModalOpen, setIsVisitModalOpen] = useState(false);

  const loadData = async () => {
    try {
      const cust = await customerRepo.getById(id);
      if (cust) {
        setCustomer(cust);
        const [v, p, pay, inv] = await Promise.all([
          visitRepo.getByCustomer(id),
          promiseRepo.getByCustomer(id),
          paymentRepo.getByCustomer(id),
          getDb().invoices.where('customerId').equals(id).reverse().sortBy('date'),
        ]);
        setVisits(v);
        setPromises(p);
        setPayments(pay);
        setInvoices(inv);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) loadData();
  }, [id]);

  if (loading) {
    return <div className="p-6 text-center text-muted-foreground">جاري تحميل بيانات العميل...</div>;
  }

  if (!customer) {
    return (
      <div className="p-6 text-center">
        <AlertTriangle className="w-12 h-12 text-destructive mx-auto mb-4" />
        <h2 className="text-xl font-bold mb-2">لم يتم العثور على العميل</h2>
        <button onClick={() => router.back()} className="text-primary hover:underline">العودة للسابق</button>
      </div>
    );
  }

  const getRiskColor = (level: string) => {
    switch (level) {
      case 'RED': return 'bg-red-500/10 text-red-500 border-red-500/20';
      case 'ORANGE': return 'bg-orange-500/10 text-orange-500 border-orange-500/20';
      case 'YELLOW': return 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20';
      default: return 'bg-green-500/10 text-green-500 border-green-500/20';
    }
  };

  const getRiskLabel = (level: string) => {
    switch (level) {
      case 'RED': return 'خطورة عالية جداً';
      case 'ORANGE': return 'خطورة عالية';
      case 'YELLOW': return 'متوسط';
      default: return 'جيد';
    }
  };

  return (
    <div className="pb-24">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-md border-b border-border p-4 flex items-center gap-4">
        <button onClick={() => router.back()} className="p-2 -ml-2 rounded-full hover:bg-muted text-foreground">
          <ArrowRight className="w-6 h-6" />
        </button>
        <h1 className="text-lg font-bold flex-1 truncate">تفاصيل العميل</h1>
      </div>

      <div className="p-4 space-y-6">
        {/* Hero Card */}
        <div className="bg-card border border-border rounded-2xl p-5 shadow-sm">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h2 className="text-xl font-bold text-foreground mb-1">{customer.name}</h2>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span className="bg-muted px-2 py-0.5 rounded-md text-xs font-mono">{customer.code}</span>
                {customer.region && (
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3 h-3" /> {customer.region}
                  </span>
                )}
              </div>
            </div>
            <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${getRiskColor(customer.riskLevel)}`}>
              {getRiskLabel(customer.riskLevel)}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-4 mt-6">
            <div className="bg-background rounded-xl p-3 border border-border">
              <p className="text-xs text-muted-foreground mb-1">الرصيد الحالي</p>
              <p className="text-xl font-bold text-destructive">{formatCurrency(customer.currentBalance)}</p>
            </div>
            <div className="bg-background rounded-xl p-3 border border-border">
              <p className="text-xs text-muted-foreground mb-1">إجمالي المدفوع</p>
              <p className="text-xl font-bold text-emerald-500">{formatCurrency(customer.totalPaid)}</p>
            </div>
          </div>
        </div>

        {/* Action Button */}
        <button
          onClick={() => setIsVisitModalOpen(true)}
          className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-xl py-4 flex items-center justify-center gap-2 shadow-lg transition-transform active:scale-[0.98]"
        >
          <Calendar className="w-5 h-5" />
          <span>تسجيل زيارة / إجراء</span>
        </button>

        {/* Tabs - Simple Stack for Mobile */}
        <div className="space-y-6">
          {/* Active Promises */}
          {promises.filter(p => p.status === 'active').length > 0 && (
            <section>
              <h3 className="text-sm font-bold text-muted-foreground mb-3 uppercase tracking-wider flex items-center gap-2">
                <Clock className="w-4 h-4" /> الوعود القائمة
              </h3>
              <div className="space-y-3">
                {promises.filter(p => p.status === 'active').map(promise => (
                  <div key={promise.id} className="bg-orange-500/5 border border-orange-500/20 rounded-xl p-4">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-orange-500 font-bold">{formatCurrency(promise.amount)}</span>
                      <span className="text-xs text-orange-500/80 bg-orange-500/10 px-2 py-1 rounded-md">{formatDate(promise.dueDate)}</span>
                    </div>
                    {promise.notes && <p className="text-sm text-muted-foreground mt-2">{promise.notes}</p>}
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Recent Visits */}
          <section>
            <h3 className="text-sm font-bold text-muted-foreground mb-3 uppercase tracking-wider flex items-center gap-2">
              <MapPin className="w-4 h-4" /> آخر الزيارات
            </h3>
            {visits.length === 0 ? (
              <p className="text-sm text-muted-foreground bg-muted/50 p-4 rounded-xl text-center">لا توجد زيارات مسجلة</p>
            ) : (
              <div className="space-y-3">
                {visits.slice(0, 5).map(visit => (
                  <div key={visit.id} className="bg-card border border-border rounded-xl p-4">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <span className="text-sm font-medium">
                          {visit.result === 'collected' ? 'تحصيل دفعة' :
                           visit.result === 'promise' ? 'وعد بالسداد' :
                           visit.result === 'refused' ? 'رفض السداد' :
                           visit.result === 'no_response' ? 'لم يتم الرد' : 'زيارة'}
                        </span>
                        <p className="text-xs text-muted-foreground">{formatDate(visit.createdAt)}</p>
                      </div>
                      {visit.result === 'collected' && (
                        <span className="text-emerald-500 font-bold text-sm">+{formatCurrency(visit.collectedAmount)}</span>
                      )}
                    </div>
                    {visit.notes && <p className="text-sm text-muted-foreground mt-2 border-t border-border pt-2">{visit.notes}</p>}
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Recent Payments */}
          <section>
            <h3 className="text-sm font-bold text-muted-foreground mb-3 uppercase tracking-wider flex items-center gap-2">
              <DollarSign className="w-4 h-4" /> سجل الدفعات
            </h3>
            {payments.length === 0 ? (
              <p className="text-sm text-muted-foreground bg-muted/50 p-4 rounded-xl text-center">لا توجد دفعات مسجلة</p>
            ) : (
              <div className="space-y-3">
                {payments.slice(0, 5).map(payment => (
                  <div key={payment.id} className="bg-card border border-border rounded-xl p-4 flex justify-between items-center">
                    <div>
                      <p className="text-sm font-medium">{formatDate(payment.date)}</p>
                      {payment.receiptNumber && <p className="text-xs text-muted-foreground mt-1">إيصال: {payment.receiptNumber}</p>}
                    </div>
                    <span className="text-emerald-500 font-bold">{formatCurrency(payment.amount)}</span>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>

      {isVisitModalOpen && (
        <VisitModal 
          customer={customer}
          onClose={() => setIsVisitModalOpen(false)}
          onSuccess={() => {
            setIsVisitModalOpen(false);
            loadData(); // Refresh data
          }}
        />
      )}
    </div>
  );
}

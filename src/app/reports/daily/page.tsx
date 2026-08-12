'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { visitRepo } from '@/lib/db/visitRepo';
import { routeRepo } from '@/lib/db/routeRepo';
import type { Visit, RouteStop } from '@/types/domain';
import { FileText, Copy, ArrowRight, TrendingUp, CheckCircle, Clock, CheckCircle2 } from 'lucide-react';
import { formatCurrency, todayISO } from '@/lib/utils/helpers';

export default function DailyReportPage() {
  const router = useRouter();
  const [visits, setVisits] = useState<Visit[]>([]);
  const [stops, setStops] = useState<RouteStop[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const [v, s] = await Promise.all([
          visitRepo.getToday(),
          routeRepo.getTodayStops()
        ]);
        setVisits(v);
        setStops(s);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const totalTarget = stops.reduce((acc, stop) => acc + stop.targetAmount, 0);
  const totalCollected = visits.reduce((acc, v) => acc + (v.collectedAmount || 0), 0);
  const totalPromises = visits.filter(v => v.result === 'promise').length;
  
  const score = totalTarget > 0 ? Math.round((totalCollected / totalTarget) * 100) : 0;
  
  // Format report for copying
  const generateTextReport = () => {
    let report = `📊 تقرير التحصيل اليومي - ${todayISO()}\n`;
    report += `ــــــــــــــــــــــــــــــــــــــــ\n`;
    report += `🎯 إجمالي المستهدف: ${formatCurrency(totalTarget)}\n`;
    report += `✅ إجمالي المحصل: ${formatCurrency(totalCollected)}\n`;
    report += `📈 نسبة التحقيق: ${score}%\n\n`;
    
    report += `تفاصيل الزيارات والردود:\n`;
    visits.forEach((v, i) => {
      let resultText = '';
      if (v.result === 'collected') resultText = `تم تحصيل ${formatCurrency(v.collectedAmount)}`;
      else if (v.result === 'promise') resultText = `وعد بالسداد`;
      else if (v.result === 'refused') resultText = `رفض السداد`;
      else if (v.result === 'no_response') resultText = `لم يتم الرد`;
      
      report += `${i + 1}. ${v.customerName}: ${resultText}`;
      if (v.notes) report += ` (${v.notes})`;
      report += `\n`;
    });
    
    return report;
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(generateTextReport());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) return <div className="p-6 text-center">جاري استخراج التقرير...</div>;

  return (
    <div className="pb-24">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-md border-b border-border p-4 flex items-center gap-4">
        <button onClick={() => router.back()} className="p-2 -ml-2 rounded-full hover:bg-muted text-foreground">
          <ArrowRight className="w-6 h-6" />
        </button>
        <h1 className="text-lg font-bold flex-1">تقرير نهاية اليوم</h1>
        <button 
          onClick={handleCopy}
          className="flex items-center gap-2 bg-primary/10 text-primary px-3 py-1.5 rounded-full text-sm font-medium hover:bg-primary/20 transition-colors"
        >
          {copied ? <CheckCircle2 className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
          {copied ? 'تم النسخ' : 'نسخ'}
        </button>
      </div>

      <div className="p-4 space-y-6">
        
        {/* Score Card */}
        <div className="bg-card border border-border rounded-2xl p-6 text-center shadow-sm">
          <h2 className="text-muted-foreground font-medium mb-2">تقييم الأداء والمحصل</h2>
          <div className="flex items-center justify-center gap-3 mb-4">
            <TrendingUp className={`w-8 h-8 ${score >= 50 ? 'text-emerald-500' : 'text-orange-500'}`} />
            <span className={`text-4xl font-bold ${score >= 50 ? 'text-emerald-500' : 'text-orange-500'}`}>
              {score}%
            </span>
          </div>
          <div className="grid grid-cols-2 gap-4 mt-6 text-right">
            <div className="bg-background rounded-xl p-3 border border-border">
              <p className="text-xs text-muted-foreground mb-1">المستهدف</p>
              <p className="text-lg font-bold">{formatCurrency(totalTarget)}</p>
            </div>
            <div className="bg-background rounded-xl p-3 border border-border">
              <p className="text-xs text-muted-foreground mb-1">تم تحصيله</p>
              <p className="text-lg font-bold text-emerald-500">{formatCurrency(totalCollected)}</p>
            </div>
          </div>
        </div>

        {/* Responses List */}
        <div className="bg-card border border-border rounded-2xl p-4 shadow-sm">
          <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" />
            ردود العملاء اليوم
          </h3>
          
          {visits.length === 0 ? (
            <p className="text-center text-muted-foreground py-6">لم يتم تسجيل أي زيارات أو ردود اليوم</p>
          ) : (
            <div className="space-y-3">
              {visits.map((v, i) => (
                <div key={v.id} className="p-3 bg-background border border-border rounded-xl">
                  <div className="flex justify-between items-start mb-2">
                    <span className="font-bold text-sm flex-1">{i + 1}. {v.customerName}</span>
                    <span className={`text-xs px-2 py-1 rounded-md font-medium whitespace-nowrap ${
                      v.result === 'collected' ? 'bg-emerald-500/10 text-emerald-500' :
                      v.result === 'promise' ? 'bg-orange-500/10 text-orange-500' :
                      'bg-destructive/10 text-destructive'
                    }`}>
                      {v.result === 'collected' ? `تم تحصيل ${formatCurrency(v.collectedAmount)}` :
                       v.result === 'promise' ? 'وعد بالسداد' :
                       v.result === 'refused' ? 'رفض السداد' : 'لم يتم الرد'}
                    </span>
                  </div>
                  {v.notes && (
                    <p className="text-xs text-muted-foreground mt-2 pt-2 border-t border-border">
                      {v.notes}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

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
      <div className="sticky top-0 z-20 bg-background/90 backdrop-blur-xl border-b border-border/50 p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => router.back()} 
            className="w-10 h-10 flex items-center justify-center rounded-full bg-muted/50 hover:bg-muted text-foreground transition-colors active:scale-95"
            aria-label="عودة"
          >
            <ArrowRight className="w-5 h-5" strokeWidth={2.5} />
          </button>
          <h1 className="text-xl font-bold tracking-tight">التقرير الختامي</h1>
        </div>
        <button 
          onClick={handleCopy}
          className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-full text-sm font-bold shadow-sm hover:shadow-md hover:bg-primary/90 active:scale-95 transition-all"
        >
          {copied ? <CheckCircle2 className="w-4 h-4" strokeWidth={2.5} /> : <Copy className="w-4 h-4" strokeWidth={2.5} />}
          {copied ? 'تم النسخ' : 'مشاركة'}
        </button>
      </div>

      <div className="p-5 space-y-8">
        
        {/* Score Card */}
        <div className="bg-gradient-to-br from-card to-muted border border-border rounded-[2rem] p-6 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 right-0 w-40 h-40 bg-primary/5 rounded-full blur-3xl -mr-10 -mt-10"></div>
          <div className="relative z-10">
            <h2 className="text-muted-foreground font-medium mb-6 text-center text-sm uppercase tracking-wider">تقييم الأداء والمحصل</h2>
            <div className="flex flex-col items-center justify-center gap-3 mb-8">
              <div className={`p-4 rounded-2xl ${score >= 50 ? 'bg-emerald-500/10 text-emerald-500' : 'bg-orange-500/10 text-orange-500'} mb-1 shadow-inner`}>
                <TrendingUp className="w-10 h-10" strokeWidth={2} />
              </div>
              <span className={`text-6xl font-black tracking-tighter ${score >= 50 ? 'text-emerald-500' : 'text-orange-500'}`}>
                {score}%
              </span>
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-background/80 backdrop-blur-md rounded-2xl p-4 border border-border/50 flex flex-col items-center text-center shadow-sm">
                <p className="text-[11px] font-bold text-muted-foreground mb-1 uppercase tracking-wider">المستهدف</p>
                <p className="text-lg font-black text-foreground">{formatCurrency(totalTarget)}</p>
              </div>
              <div className="bg-background/80 backdrop-blur-md rounded-2xl p-4 border border-border/50 flex flex-col items-center text-center shadow-sm">
                <p className="text-[11px] font-bold text-muted-foreground mb-1 uppercase tracking-wider">تم تحصيله</p>
                <p className="text-lg font-black text-emerald-500">{formatCurrency(totalCollected)}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Responses List */}
        <div className="space-y-4">
          <h3 className="font-bold text-lg flex items-center gap-2 px-1 tracking-tight">
            <div className="p-2 bg-primary/10 rounded-xl text-primary">
              <FileText className="w-5 h-5" strokeWidth={2} />
            </div>
            تفاصيل الزيارات
          </h3>
          
          {visits.length === 0 ? (
            <div className="bg-card border border-border rounded-3xl p-10 text-center shadow-sm">
               <FileText className="w-12 h-12 mx-auto text-muted-foreground/30 mb-4" strokeWidth={1.5} />
               <p className="text-muted-foreground font-medium">لم يتم تسجيل أي زيارات أو ردود اليوم</p>
            </div>
          ) : (
            <div className="space-y-3">
              {visits.map((v, i) => (
                <div key={v.id} className="p-4 bg-card hover:bg-muted/30 transition-colors border border-border rounded-2xl shadow-sm group">
                  <div className="flex justify-between items-start gap-3">
                    <div className="flex items-start gap-3 flex-1">
                      <span className="w-7 h-7 flex items-center justify-center bg-muted/50 rounded-full text-xs font-bold text-muted-foreground shrink-0 mt-0.5">
                        {i + 1}
                      </span>
                      <div>
                        <h4 className="font-bold text-foreground text-sm leading-tight">{v.customerName}</h4>
                        {v.notes && (
                          <p className="text-xs text-muted-foreground mt-2 leading-relaxed bg-muted/30 p-2 rounded-lg border border-border/50 inline-block">
                            {v.notes}
                          </p>
                        )}
                      </div>
                    </div>
                    <span className={`shrink-0 text-[11px] px-2.5 py-1.5 rounded-full font-bold tracking-wide ${
                      v.result === 'collected' ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' :
                      v.result === 'promise' ? 'bg-orange-500/10 text-orange-500 border border-orange-500/20' :
                      'bg-destructive/10 text-destructive border border-destructive/20'
                    }`}>
                      {v.result === 'collected' ? `+ ${formatCurrency(v.collectedAmount)}` :
                       v.result === 'promise' ? 'وعد بالسداد' :
                       v.result === 'refused' ? 'رفض السداد' : 'لم يتم الرد'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

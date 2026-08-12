'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { routeRepo } from '@/lib/db/routeRepo';
import { customerRepo } from '@/lib/db/customerRepo';
import type { RouteStop, Customer } from '@/types/domain';
import { Map, CheckCircle, Clock, Navigation, CheckCircle2, ChevronDown, ChevronUp, Printer } from 'lucide-react';
import { formatCurrency } from '@/lib/utils/helpers';
import VisitModal from '@/components/features/VisitModal';

interface GroupedStops {
  [region: string]: {
    stops: RouteStop[];
    completed: number;
    total: number;
  }
}

export default function DailyRoutePage() {
  const router = useRouter();
  const [stops, setStops] = useState<RouteStop[]>([]);
  const [grouped, setGrouped] = useState<GroupedStops>({});
  const [loading, setLoading] = useState(true);
  
  // Modal state
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [expandedRegions, setExpandedRegions] = useState<Record<string, boolean>>({});

  const loadData = async () => {
    try {
      const allStops = await routeRepo.getTodayStops();
      setStops(allStops);

      const groupedData: GroupedStops = {};
      const expansions: Record<string, boolean> = {};

      allStops.forEach(stop => {
        const r = stop.region || 'أخرى';
        if (!groupedData[r]) {
          groupedData[r] = { stops: [], completed: 0, total: 0 };
          expansions[r] = true; // Default expand all
        }
        groupedData[r].stops.push(stop);
        groupedData[r].total++;
        if (stop.status === 'visited' || stop.status === 'skipped') {
          groupedData[r].completed++;
        }
      });

      setGrouped(groupedData);
      setExpandedRegions(expansions);
    } catch (err) {
      console.error('Failed to load route', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const openVisitModal = async (stop: RouteStop) => {
    const cust = await customerRepo.getById(stop.customerId);
    if (cust) {
      // Small hack: add stopId to customer object just so VisitModal can update it
      (cust as any)._routeStopId = stop.id;
      setSelectedCustomer(cust);
    } else {
      alert("لم يتم العثور على بيانات العميل كاملة");
    }
  };

  const toggleRegion = (region: string) => {
    setExpandedRegions(prev => ({ ...prev, [region]: !prev[region] }));
  };

  if (loading) {
    return <div className="p-6 text-center text-muted-foreground">جاري تحميل خط السير...</div>;
  }

  const totalStops = stops.length;
  const completedStops = stops.filter(s => s.status !== 'pending').length;
  const progressPercent = totalStops === 0 ? 0 : Math.round((completedStops / totalStops) * 100);

  return (
    <div className="pb-24">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-background/90 backdrop-blur-xl border-b border-border/50 p-5 no-print">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 flex items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Map className="w-5 h-5" strokeWidth={2.5} />
            </div>
            <h1 className="text-xl font-bold tracking-tight">سير العمل اليومي</h1>
          </div>
          <button 
            onClick={() => window.print()} 
            className="flex items-center gap-2 bg-secondary text-secondary-foreground hover:bg-secondary/80 px-4 py-2 rounded-xl text-sm font-bold transition-colors"
          >
            <Printer size={16} />
            <span className="hidden sm:inline">طباعة / واتساب</span>
          </button>
        </div>
        <div className="bg-muted/30 p-4 rounded-2xl border border-border/50">
          <div className="flex justify-between text-sm mb-2">
            <span className="text-muted-foreground font-medium">الإنجاز: <strong className="text-foreground">{completedStops}</strong> من {totalStops}</span>
            <span className="font-black text-primary">{progressPercent}%</span>
          </div>
          <div className="h-2.5 bg-muted/80 rounded-full overflow-hidden shadow-inner">
            <div className="h-full bg-gradient-to-r from-primary/80 to-primary transition-all duration-700 ease-out" style={{ width: `${progressPercent}%` }} />
          </div>
        </div>
      </div>

      <div className="p-4 space-y-6">
        {Object.keys(grouped).length === 0 ? (
          <div className="text-center py-16 px-6 bg-card rounded-[2rem] border-2 border-dashed border-border/60 shadow-sm flex flex-col items-center">
            <div className="w-20 h-20 bg-muted rounded-full flex items-center justify-center mb-5">
              <Navigation className="w-10 h-10 text-muted-foreground opacity-60" strokeWidth={1.5} />
            </div>
            <p className="text-lg font-bold text-foreground mb-2">لا يوجد عملاء في خط السير اليوم</p>
            <p className="text-sm text-muted-foreground max-w-[250px] leading-relaxed">يرجى التأكد من تحديث شيت الإكسيل (خط_سير) والمزامنة.</p>
          </div>
        ) : (
          Object.entries(grouped).map(([region, data]) => (
            <div key={region} className="bg-card rounded-[1.5rem] border border-border/60 overflow-hidden shadow-sm hover:shadow-md transition-all duration-300">
              <button 
                onClick={() => toggleRegion(region)}
                className="w-full flex items-center justify-between p-5 bg-muted/20 hover:bg-muted/40 transition-colors active:bg-muted/60"
              >
                <div className="flex items-center gap-3">
                  <h2 className="font-bold text-lg tracking-tight">{region}</h2>
                  <span className="bg-background border border-border/50 text-foreground text-xs px-2.5 py-1 rounded-full font-bold shadow-sm">
                    {data.completed} / {data.total}
                  </span>
                </div>
                <div className={`p-1.5 rounded-full bg-background border border-border/50 transition-transform duration-300 ${expandedRegions[region] ? 'rotate-180' : ''}`}>
                  <ChevronDown className="w-4 h-4 text-foreground" strokeWidth={2.5} />
                </div>
              </button>

              {expandedRegions[region] && (
                <div className="divide-y divide-border/50 bg-background/50">
                  {data.stops.map(stop => (
                    <div key={stop.id} className="p-5 hover:bg-muted/30 transition-colors group print:break-inside-avoid print:p-2 print:border-b print:border-black/20">
                      <div className="flex flex-col md:flex-row items-center justify-between gap-4 w-full">
                        <div 
                          className="cursor-pointer mb-2 print:mb-0"
                          onClick={() => router.push(`/customers/details?id=${stop.customerId}`)}
                        >
                          <div className="flex flex-col md:flex-row md:items-center justify-center gap-2 mb-1.5">
                            <h3 className="font-bold text-foreground text-base md:text-lg group-hover:text-primary transition-colors leading-tight">
                              {stop.customerName}
                            </h3>
                            {stop.rating && (
                              <span className="text-[10px] bg-muted px-2 py-0.5 rounded-full text-muted-foreground font-bold">
                                {stop.rating}
                              </span>
                            )}
                          </div>
                          
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs mt-3 bg-card p-3 rounded-xl border border-border/50 shadow-sm print:shadow-none print:border-black/20 text-center">
                            <div>
                              <span className="block text-muted-foreground mb-0.5 text-[10px]">المديونية المتبقية</span>
                              <span className="font-bold text-foreground">{formatCurrency(stop.remainingDebt || stop.targetAmount)}</span>
                            </div>
                            <div>
                              <span className="block text-muted-foreground mb-0.5 text-[10px]">المسحوب / المدفوع</span>
                              <span className="font-bold text-foreground">{formatCurrency(stop.totalWithdrawn || 0)} / {formatCurrency(stop.totalPaid || 0)}</span>
                            </div>
                            <div>
                              <span className="block text-muted-foreground mb-0.5 text-[10px]">آخر فاتورة / سداد</span>
                              <span className="font-bold text-foreground">
                                {stop.lastInvoiceDate ? stop.lastInvoiceDate.slice(5) : '-'} / {stop.lastPaymentDate ? stop.lastPaymentDate.slice(5) : '-'}
                              </span>
                            </div>
                            <div>
                              <span className="block text-muted-foreground mb-0.5 text-[10px]">آخر رد</span>
                              <span className="font-bold text-foreground truncate">{stop.lastReply || '-'}</span>
                            </div>
                          </div>
                        </div>
                        
                        <div className="w-full sm:w-auto no-print">
                          {stop.status === 'visited' ? (
                            <div className="flex items-center justify-center gap-1.5 text-emerald-500 bg-emerald-500/10 border border-emerald-500/20 px-4 py-2 rounded-xl text-sm font-bold tracking-wide">
                              <CheckCircle2 className="w-5 h-5" strokeWidth={2.5} />
                              تمت
                            </div>
                          ) : stop.status === 'skipped' ? (
                            <div className="flex items-center justify-center gap-1.5 text-orange-500 bg-orange-500/10 border border-orange-500/20 px-4 py-2 rounded-xl text-sm font-bold tracking-wide">
                              <Clock className="w-5 h-5" strokeWidth={2.5} />
                              مؤجل
                            </div>
                          ) : (
                            <button 
                              onClick={() => openVisitModal(stop)}
                              className="bg-primary text-primary-foreground px-6 py-2.5 rounded-xl text-sm font-bold shadow-md hover:shadow-lg hover:bg-primary/90 active:scale-95 transition-all w-full"
                            >
                              تسجيل رد
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {selectedCustomer && (
        <VisitModal 
          customer={selectedCustomer}
          onClose={() => setSelectedCustomer(null)}
          onSuccess={async () => {
            const stopId = (selectedCustomer as any)._routeStopId;
            if (stopId) {
              await routeRepo.updateStopStatus(stopId, 'visited');
            }
            setSelectedCustomer(null);
            loadData();
          }}
        />
      )}
    </div>
  );
}

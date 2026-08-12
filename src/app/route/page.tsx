'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { routeRepo } from '@/lib/db/routeRepo';
import { customerRepo } from '@/lib/db/customerRepo';
import type { RouteStop, Customer } from '@/types/domain';
import { Map, CheckCircle, Clock, Navigation, CheckCircle2, ChevronDown, ChevronUp } from 'lucide-react';
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
      <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-md border-b border-border p-4">
        <h1 className="text-xl font-bold flex items-center gap-2">
          <Map className="w-6 h-6 text-primary" />
          سير العمل اليومي
        </h1>
        <div className="mt-3">
          <div className="flex justify-between text-sm mb-1">
            <span className="text-muted-foreground">الإنجاز: {completedStops} من {totalStops}</span>
            <span className="font-bold text-primary">{progressPercent}%</span>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div className="h-full bg-primary transition-all" style={{ width: `${progressPercent}%` }} />
          </div>
        </div>
      </div>

      <div className="p-4 space-y-6">
        {Object.keys(grouped).length === 0 ? (
          <div className="text-center py-12 bg-card rounded-2xl border border-border">
            <Navigation className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-50" />
            <p className="font-medium text-foreground">لا يوجد عملاء في خط السير اليوم</p>
            <p className="text-sm text-muted-foreground mt-1">تأكد من شيت الإكسيل (خط_سير)</p>
          </div>
        ) : (
          Object.entries(grouped).map(([region, data]) => (
            <div key={region} className="bg-card rounded-2xl border border-border overflow-hidden shadow-sm">
              <button 
                onClick={() => toggleRegion(region)}
                className="w-full flex items-center justify-between p-4 bg-muted/30 hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <h2 className="font-bold text-lg">{region}</h2>
                  <span className="bg-primary/10 text-primary text-xs px-2 py-1 rounded-full font-medium">
                    {data.completed}/{data.total}
                  </span>
                </div>
                {expandedRegions[region] ? <ChevronUp className="w-5 h-5 text-muted-foreground" /> : <ChevronDown className="w-5 h-5 text-muted-foreground" />}
              </button>

              {expandedRegions[region] && (
                <div className="divide-y divide-border">
                  {data.stops.map(stop => (
                    <div key={stop.id} className="p-4 hover:bg-muted/10 transition-colors">
                      <div className="flex justify-between items-start mb-3">
                        <div 
                          className="cursor-pointer group flex-1"
                          onClick={() => router.push(`/customers/details?id=${stop.customerId}`)}
                        >
                          <h3 className="font-bold text-foreground group-hover:text-primary transition-colors">
                            {stop.customerName}
                          </h3>
                          <p className="text-sm text-muted-foreground mt-1">
                            المستهدف: <span className="font-bold text-destructive">{formatCurrency(stop.targetAmount)}</span>
                          </p>
                        </div>
                        
                        {stop.status === 'visited' ? (
                          <div className="flex items-center gap-1 text-emerald-500 bg-emerald-500/10 px-2 py-1 rounded-md text-sm font-medium">
                            <CheckCircle2 className="w-4 h-4" />
                            تمت
                          </div>
                        ) : stop.status === 'skipped' ? (
                          <div className="flex items-center gap-1 text-orange-500 bg-orange-500/10 px-2 py-1 rounded-md text-sm font-medium">
                            <Clock className="w-4 h-4" />
                            مؤجل
                          </div>
                        ) : (
                          <button 
                            onClick={() => openVisitModal(stop)}
                            className="bg-primary text-primary-foreground px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-primary/90 active:scale-95 transition-all"
                          >
                            تسجيل رد
                          </button>
                        )}
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

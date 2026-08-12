'use client';

import { useEffect, useState } from 'react';
import { Save, Bell, Globe, CheckCircle, AlertTriangle } from 'lucide-react';
import { useForm } from 'react-hook-form';
import type { AppSettings } from '@/types/domain';
import { NextAlarmAdapter } from '@/lib/notifications/adapters';

const DEFAULT_URL = 'https://ais-pre-3vthytiufcvga24j7xahcr-520796885999.europe-west2.run.app/';

export default function SettingsPage() {
  const { register, handleSubmit, setValue, watch } = useForm<AppSettings>();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [testing, setTesting] = useState(false);

  const nextAlarmEnabled = watch('nextAlarmEnabled');
  const nextAlarmBaseUrl = watch('nextAlarmBaseUrl');

  useEffect(() => {
    async function load() {
      const { settingsRepo } = await import('@/lib/db/settingsRepo');
      const settings = await settingsRepo.get();
      setValue('currency', settings.currency || 'EGP');
      setValue('defaultPaymentTerms', settings.defaultPaymentTerms || '');
      setValue('workingDays', settings.workingDays || [0, 1, 2, 3, 4]); // Sun-Thu
      setValue('nextAlarmEnabled', settings.nextAlarmEnabled ?? false);
      setValue('nextAlarmBaseUrl', settings.nextAlarmBaseUrl || DEFAULT_URL);
      setLoading(false);
    }
    load();
  }, [setValue]);

  const onSubmit = async (data: AppSettings) => {
    setSaving(true);
    try {
      const { settingsRepo } = await import('@/lib/db/settingsRepo');
      await settingsRepo.update(data);
      const { resetAdapter } = await import('@/lib/notifications/adapters');
      resetAdapter();
      alert('تم حفظ الإعدادات بنجاح');
    } catch (err) {
      console.error(err);
      alert('حدث خطأ أثناء الحفظ');
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    if (!nextAlarmBaseUrl) return;
    setTesting(true);
    setTestResult(null);
    try {
      const adapter = new NextAlarmAdapter(nextAlarmBaseUrl, []);
      // For testing, we use a dummy chat ID or rely on the server to broadcast
      const result = await adapter.test('test-chat-id');
      setTestResult(result);
    } catch (err) {
      setTestResult({ success: false, message: 'تعذر الاتصال بالسيرفر' });
    } finally {
      setTesting(false);
    }
  };

  if (loading) return <div className="text-center py-12 text-sm text-gray-500">جاري التحميل...</div>;

  return (
    <div className="max-w-2xl mx-auto pb-8 space-y-6">
      <h1 className="text-xl font-bold">الإعدادات</h1>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        
        {/* Next Alarm Integration */}
        <div className="card space-y-4">
          <div className="flex items-center gap-3 border-b pb-4" style={{ borderColor: 'var(--border)' }}>
            <div className="p-2 bg-blue-500/10 text-blue-500 rounded-lg">
              <Bell size={20} />
            </div>
            <div>
              <h2 className="font-semibold">ربط الإشعارات (Next Alarm)</h2>
              <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
                تفعيل إرسال إشعارات التحصيل التلقائية إلى سيرفر Next Alarm
              </p>
            </div>
          </div>

          <label className="flex items-center gap-3 cursor-pointer p-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
            <input
              type="checkbox"
              {...register('nextAlarmEnabled')}
              className="w-5 h-5 rounded text-blue-600 focus:ring-blue-500"
            />
            <span className="font-medium text-sm">تفعيل الربط مع Next Alarm</span>
          </label>

          {nextAlarmEnabled && (
            <div className="space-y-4 pl-8 animate-fade-in">
              <div>
                <label className="block text-sm font-medium mb-1">رابط السيرفر (Cloud Run URL)</label>
                <div className="relative">
                  <Globe size={16} className="absolute top-1/2 -translate-y-1/2 right-3" style={{ color: 'var(--muted-foreground)' }} />
                  <input
                    type="url"
                    {...register('nextAlarmBaseUrl')}
                    placeholder="https://..."
                    className="w-full pl-4 pr-9 py-2 rounded-lg border text-sm text-left"
                    style={{ background: 'var(--input-bg)', borderColor: 'var(--input-border)', color: 'var(--foreground)' }}
                    dir="ltr"
                  />
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleTest}
                  disabled={testing || !nextAlarmBaseUrl}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-white/10 dark:hover:bg-white/20 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                >
                  {testing ? 'جاري الفحص...' : 'اختبار الاتصال 🔄'}
                </button>
                
                {testResult && (
                  <div className={`flex items-center gap-2 text-sm ${testResult.success ? 'text-green-500' : 'text-red-500'}`}>
                    {testResult.success ? <CheckCircle size={16} /> : <AlertTriangle size={16} />}
                    {testResult.message}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* General Settings */}
        <div className="card space-y-4">
          <h2 className="font-semibold border-b pb-4" style={{ borderColor: 'var(--border)' }}>إعدادات عامة</h2>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">العملة الافتراضية</label>
              <select
                {...register('currency')}
                className="w-full px-3 py-2 rounded-lg border text-sm"
                style={{ background: 'var(--input-bg)', borderColor: 'var(--input-border)', color: 'var(--foreground)' }}
              >
                <option value="EGP">جنيه مصري (ج.م)</option>
                <option value="USD">دولار أمريكي ($)</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">شروط السداد الافتراضية</label>
              <input
                type="text"
                {...register('defaultPaymentTerms')}
                className="w-full px-3 py-2 rounded-lg border text-sm"
                style={{ background: 'var(--input-bg)', borderColor: 'var(--input-border)', color: 'var(--foreground)' }}
                placeholder="مثال: نقدي 100%"
              />
            </div>
          </div>
        </div>

        {/* Submit */}
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-lg font-medium transition-colors disabled:opacity-50 touch-target"
          >
            <Save size={18} />
            {saving ? 'جاري الحفظ...' : 'حفظ الإعدادات'}
          </button>
        </div>

      </form>
    </div>
  );
}

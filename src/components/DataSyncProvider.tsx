'use client';

import { useEffect, useState } from 'react';

/**
 * DataSyncProvider — runs on every page load
 * Checks if JSON data is newer than IndexedDB, and re-seeds if needed.
 * Shows a brief toast notification when sync occurs.
 */
export default function DataSyncProvider({ children }: { children: React.ReactNode }) {
  const [syncMsg, setSyncMsg] = useState<string | null>(null);

  useEffect(() => {
    async function sync() {
      try {
        const { seedFromJson } = await import('@/lib/data/jsonLoader');
        const result = await seedFromJson();
        if (result.seeded) {
          setSyncMsg('✅ تم تحديث البيانات من الشيت تلقائياً');
          setTimeout(() => setSyncMsg(null), 4000);
        }
      } catch (err) {
        console.warn('[DataSync] Auto-seed failed silently:', err);
      }
    }
    // Run sync after 1 second (let the page render first)
    const timer = setTimeout(sync, 1000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <>
      {children}
      {syncMsg && (
        <div
          className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-xl text-white text-sm font-medium shadow-lg animate-fade-in"
          style={{ background: '#16a34a' }}
        >
          {syncMsg}
        </div>
      )}
    </>
  );
}

'use client';
export default function TasksPage() {
  return (
    <div className="flex items-center justify-center h-64 text-center">
      <div>
        <p className="text-2xl mb-2">🔧</p>
        <p className="font-medium">المهام اليومية</p>
        <p className="text-sm mt-1" style={{ color: 'var(--muted-foreground)' }}>قيد الإنشاء</p>
      </div>
    </div>
  );
}

'use client';

import { useState } from 'react';
import { RefreshCw } from 'lucide-react';

export default function RecalculateButton({ fullWidth = false }: { fullWidth?: boolean }) {
  const [loading, setLoading] = useState(false);

  const handleClick = async () => {
    if (!confirm('Вы уверены, что хотите запустить ротацию вручную?')) return;
    setLoading(true);
    try {
      const res = await fetch('/api/admin/recalculate', { method: 'POST' });
      const data = await res.json();
      if (data.ok) {
        alert('Ротация завершена успешно!');
        window.location.reload();
      } else {
        alert('Ошибка: ' + (data.error || 'Неизвестная ошибка'));
      }
    } catch (e: any) {
      alert('Ошибка соединения: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button 
      onClick={handleClick}
      disabled={loading}
      className={`flex items-center justify-center gap-3 py-4 rounded-xl border border-slate-200 bg-white text-slate-800 font-bold hover:bg-slate-50 hover:border-blue-300 hover:text-blue-600 transition-all active:scale-[0.99] group shadow-sm uppercase text-[11px] tracking-[0.2em] disabled:opacity-50 disabled:cursor-not-allowed ${fullWidth ? 'w-full' : 'px-12'}`}
    >
      <RefreshCw className={`w-4 h-4 transition-colors group-hover:text-blue-500 ${loading ? 'animate-spin text-blue-500' : 'text-slate-400'}`} />
      {loading ? 'Синхронизация...' : 'Пересчитать все приложения'}
    </button>
  );
}

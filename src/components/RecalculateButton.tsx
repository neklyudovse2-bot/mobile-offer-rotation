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
      className={`flex items-center justify-center gap-3 py-4 rounded-2xl bg-slate-900 text-white font-bold hover:bg-black transition-all active:scale-[0.99] shadow-xl shadow-slate-200 uppercase text-xs tracking-[0.2em] disabled:opacity-50 disabled:cursor-not-allowed ${fullWidth ? 'w-full' : 'px-12'}`}
    >
      <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
      {loading ? 'Обработка данных...' : 'Запустить полную ротацию'}
    </button>
  );
}

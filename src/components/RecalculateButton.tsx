'use client';

import { useState } from 'react';
import { RefreshCw } from 'lucide-react';

export default function RecalculateButton() {
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
      className={`px-8 py-2.5 rounded-md bg-[#3e60d5] text-white text-xs font-bold hover:bg-[#324ea7] transition-all flex items-center gap-2 uppercase tracking-widest disabled:opacity-50`}
    >
      <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
      {loading ? 'Синхронизация...' : 'Запустить'}
    </button>
  );
}

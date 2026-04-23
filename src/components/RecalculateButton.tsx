'use client';

import { useState } from 'react';

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
      className={`px-8 py-3 bg-black text-white rounded font-bold hover:bg-gray-800 transition-colors uppercase tracking-widest text-xs ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
    >
      {loading ? 'Считаю...' : 'Пересчитать все сейчас'}
    </button>
  );
}

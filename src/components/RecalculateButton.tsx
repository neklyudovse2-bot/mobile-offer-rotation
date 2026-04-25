'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function RecalculateButton() {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleClick = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/rotation/run', { method: 'POST' });
      const data = await res.json();
      if (data.ok) {
        router.refresh();
      } else {
        alert('Ошибка: ' + (data.error || 'неизвестная'));
      }
    } catch (e) {
      alert('Ошибка соединения');
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className="px-4 py-2 rounded-md bg-black text-white text-sm font-medium 
                 hover:bg-[#333] transition-colors disabled:opacity-50 
                 disabled:cursor-not-allowed"
    >
      {loading ? 'Запуск…' : 'Запустить'}
    </button>
  );
}

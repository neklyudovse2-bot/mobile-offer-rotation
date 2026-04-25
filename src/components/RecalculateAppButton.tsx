'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { RefreshCw } from 'lucide-react';

export default function RecalculateAppButton({ appId }: { appId: string }) {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const router = useRouter();

  const handleClick = async () => {
    setLoading(true);
    setSuccess(false);
    try {
      const res = await fetch(`/api/rotation/run?app_id=${appId}`, { method: 'POST' });
      const data = await res.json();
      if (data.ok) {
        setSuccess(true);
        setTimeout(() => setSuccess(false), 2000);
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
      className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-md 
                 border border-[#eaeaea] bg-white text-sm font-medium 
                 text-[#666] hover:text-black hover:bg-[#fafafa] 
                 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
    >
      <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
      {loading ? 'Пересчёт…' : success ? 'Готово ✓' : 'Пересчитать EPC'}
    </button>
  );
}

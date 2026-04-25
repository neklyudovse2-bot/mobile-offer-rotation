'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { RefreshCw } from 'lucide-react';
import { revalidateDashboard } from '@/app/admin/actions';

export default function RefreshButton() {
  const [loading, setLoading] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const handleRefresh = async () => {
    setLoading(true);
    try {
      await revalidateDashboard();
      startTransition(() => {
        router.refresh();
      });
    } catch (e) {
      alert('Ошибка обновления');
    } finally {
      setLoading(false);
    }
  };

  const isLoading = loading || isPending;

  return (
    <button
      onClick={handleRefresh}
      disabled={isLoading}
      className="flex items-center gap-2 px-3 py-2 rounded-md 
                 border border-[#eaeaea] bg-white text-xs font-semibold 
                 text-black hover:bg-[#fafafa] transition-colors 
                 disabled:opacity-50 disabled:cursor-not-allowed"
    >
      <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
      {isLoading ? 'Обновление...' : 'Обновить'}
    </button>
  );
}

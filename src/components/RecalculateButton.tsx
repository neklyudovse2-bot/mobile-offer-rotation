'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { RefreshCw, AlertTriangle } from 'lucide-react';

export default function RecalculateButton() {
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleClick = () => {
    setShowConfirm(true);
  };

  const handleConfirm = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/rotation/run', { method: 'POST' });
      const data = await res.json();
      if (data.ok) {
        setShowConfirm(false);
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

  const handleCancel = () => {
    if (loading) return;
    setShowConfirm(false);
  };

  return (
    <>
      <button
        onClick={handleClick}
        className="px-4 py-2 rounded-md bg-black text-white text-sm font-medium 
                   hover:bg-[#333] transition-colors"
      >
        Запустить
      </button>

      {showConfirm && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 
                     bg-black/40 backdrop-blur-sm"
          onClick={handleCancel}
        >
          <div 
            className="bg-white rounded-md border border-[#eaeaea] max-w-md w-full p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3 mb-4">
              <div className="w-9 h-9 rounded-md bg-[#fafafa] border border-[#eaeaea] 
                              flex items-center justify-center shrink-0">
                <AlertTriangle className="w-4 h-4 text-black" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-black mb-1">
                  Пересчитать все приложения?
                </h3>
                <p className="text-sm text-[#666] leading-relaxed">
                  Будет запущен пересчёт EPC и обновление Firestore для всех 
                  3 приложений. Эта операция перезапишет порядок офферов 
                  на основе свежих данных Keitaro.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 mt-6">
              <button
                onClick={handleCancel}
                disabled={loading}
                className="px-4 py-2 rounded-md border border-[#eaeaea] bg-white 
                           text-sm font-medium text-black hover:bg-[#fafafa] 
                           transition-colors disabled:opacity-50"
              >
                Отменить
              </button>
              <button
                onClick={handleConfirm}
                disabled={loading}
                className="flex items-center gap-2 px-4 py-2 rounded-md bg-black 
                           text-white text-sm font-medium hover:bg-[#333] 
                           transition-colors disabled:opacity-50 
                           disabled:cursor-not-allowed"
              >
                {loading && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                {loading ? 'Запуск…' : 'Да, запустить'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

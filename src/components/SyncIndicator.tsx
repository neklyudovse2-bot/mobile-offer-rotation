'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { RefreshCw, CheckCircle2, AlertCircle, AlertTriangle } from 'lucide-react';

interface Props {
  lastSyncAt: string | null;  // ISO date string from server
  recordCount?: number;
}

type SyncStatus = 'fresh' | 'stale' | 'critical' | 'never';

function getSyncStatus(lastSyncAt: string | null): { status: SyncStatus; ageMs: number } {
  if (!lastSyncAt) return { status: 'never', ageMs: 0 };
  
  const ageMs = Date.now() - new Date(lastSyncAt).getTime();
  const HOUR = 60 * 60 * 1000;
  
  if (ageMs < 12 * HOUR) return { status: 'fresh', ageMs };
  if (ageMs < 36 * HOUR) return { status: 'stale', ageMs };
  return { status: 'critical', ageMs };
}

function formatRelativeTime(ageMs: number): string {
  const minutes = Math.floor(ageMs / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  if (days > 0) return `${days} ${days === 1 ? 'день' : days < 5 ? 'дня' : 'дней'} назад`;
  if (hours > 0) return `${hours} ${hours === 1 ? 'час' : hours < 5 ? 'часа' : 'часов'} назад`;
  if (minutes > 0) return `${minutes} мин назад`;
  return 'только что';
}

function formatExactTime(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function SyncIndicator({ lastSyncAt, recordCount }: Props) {
  const [open, setOpen] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [now, setNow] = useState(Date.now());
  const popoverRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // Update relative time every minute
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(interval);
  }, []);

  // Close popover on outside click
  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  const { status, ageMs } = getSyncStatus(lastSyncAt);

  const statusConfig = {
    fresh: {
      dotColor: 'bg-[#0070f3]',
      label: 'Синхронизировано',
      icon: <CheckCircle2 className="w-4 h-4 text-[#0070f3]" />,
      description: 'Данные актуальны',
    },
    stale: {
      dotColor: 'bg-[#f5a623]',
      label: 'Устаревает',
      icon: <AlertCircle className="w-4 h-4 text-[#f5a623]" />,
      description: 'Данные не обновлялись более 12 часов',
    },
    critical: {
      dotColor: 'bg-[#ee0000]',
      label: 'Устарело',
      icon: <AlertTriangle className="w-4 h-4 text-[#ee0000]" />,
      description: 'Данные не обновлялись более 1.5 дней. Cron возможно не работает.',
    },
    never: {
      dotColor: 'bg-[#999]',
      label: 'Нет данных',
      icon: <AlertCircle className="w-4 h-4 text-[#999]" />,
      description: 'Синхронизация ещё не выполнялась',
    },
  };

  const config = statusConfig[status];

  const handleManualSync = async () => {
    setSyncing(true);
    try {
      const res = await fetch('/api/keitaro/sync', { method: 'POST' });
      const data = await res.json();
      if (data.ok || res.ok) {
        router.refresh();
        setTimeout(() => setOpen(false), 800);
      } else {
        alert('Ошибка синхронизации: ' + (data.error || 'неизвестная'));
      }
    } catch (e) {
      alert('Ошибка соединения');
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="relative" ref={popoverRef}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-2.5 py-1.5 rounded-md 
                   hover:bg-[#fafafa] transition-colors"
      >
        <span className={`w-1.5 h-1.5 rounded-full ${config.dotColor}`} />
        <span className="text-xs text-[#666]">
          {status === 'never' ? 'Нет sync' : `Sync · ${formatRelativeTime(ageMs)}`}
        </span>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-white border 
                        border-[#eaeaea] rounded-md shadow-lg z-50 overflow-hidden">
          {/* Header */}
          <div className="px-4 py-3 border-b border-[#eaeaea]">
            <div className="flex items-start gap-2.5">
              {config.icon}
              <div className="flex-1">
                <div className="text-sm font-semibold text-black">
                  {config.label}
                </div>
                <div className="text-xs text-[#666] mt-0.5">
                  {config.description}
                </div>
              </div>
            </div>
          </div>

          {/* Details */}
          {lastSyncAt && (
            <div className="px-4 py-3 border-b border-[#eaeaea] space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-[#666]">Последний sync</span>
                <span className="text-black font-medium tabular-nums">
                  {formatExactTime(lastSyncAt)}
                </span>
              </div>
              {recordCount !== undefined && (
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[#666]">Записей в базе</span>
                  <span className="text-black font-medium tabular-nums">
                    {recordCount.toLocaleString('ru-RU')}
                  </span>
                </div>
              )}
              <div className="flex items-center justify-between text-xs">
                <span className="text-[#666]">Источник</span>
                <span className="text-black font-medium">Keitaro</span>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="px-4 py-3">
            <button
              onClick={handleManualSync}
              disabled={syncing}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 
                         rounded-md bg-black text-white text-sm font-medium 
                         hover:bg-[#333] transition-colors disabled:opacity-50 
                         disabled:cursor-not-allowed"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
              {syncing ? 'Синхронизация…' : 'Синхронизировать сейчас'}
            </button>
            <p className="text-[10px] text-[#999] mt-2 text-center">
              Загрузит свежую статистику из Keitaro за последние 7 дней
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

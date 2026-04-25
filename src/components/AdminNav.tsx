'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import SyncIndicator from './SyncIndicator';

interface Props {
  lastSyncAt?: string | null;
  recordCount?: number;
}

export default function AdminNav({ lastSyncAt, recordCount }: Props) {
  const pathname = usePathname();

  const isActive = (path: string) => {
    if (path === '/admin') {
      return pathname === '/admin' || pathname.startsWith('/admin/offers');
    }
    if (path === '/admin/stats') {
      return pathname.startsWith('/admin/stats');
    }
    if (path === '/admin/history') {
      return pathname.startsWith('/admin/history');
    }
    return false;
  };

  const tabClass = (active: boolean) => 
    `text-sm transition-colors relative py-4 ${
      active ? 'text-black font-medium' : 'text-[#666] hover:text-black'
    }`;

  return (
    <header className="border-b border-[#eaeaea] bg-white">
      <div className="max-w-[1200px] mx-auto px-6">
        <div className="flex items-center justify-between h-14">
          
          <Link href="/admin" className="flex items-center gap-2">
            <div className="w-6 h-6 bg-black rounded-sm flex items-center justify-center">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M7 1L13 12H1L7 1Z" fill="white"/>
              </svg>
            </div>
            <span className="text-sm font-semibold text-black">
              Rotation
            </span>
          </Link>
          
          <nav className="flex items-center gap-6 absolute left-1/2 -translate-x-1/2">
            <Link href="/admin" className={tabClass(isActive('/admin'))}>
              Приложения
              {isActive('/admin') && (
                <span className="absolute bottom-0 left-0 right-0 h-px bg-black" />
              )}
            </Link>
            <Link href="/admin/stats" className={tabClass(isActive('/admin/stats'))}>
              Статистика
              {isActive('/admin/stats') && (
                <span className="absolute bottom-0 left-0 right-0 h-px bg-black" />
              )}
            </Link>
            <Link href="/admin/history" className={tabClass(isActive('/admin/history'))}>
              История
              {isActive('/admin/history') && (
                <span className="absolute bottom-0 left-0 right-0 h-px bg-black" />
              )}
            </Link>
          </nav>
          
          <SyncIndicator lastSyncAt={lastSyncAt || null} recordCount={recordCount} />
        </div>
      </div>
    </header>
  );
}

'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function AdminNav({ lastSync }: { lastSync?: string }) {
  const pathname = usePathname();

  const isActive = (path: string) => {
    if (path === '/admin') {
      return pathname === '/admin' || pathname.startsWith('/admin/offers');
    }
    if (path === '/admin/stats') {
      return pathname.startsWith('/admin/stats');
    }
    return false;
  };

  return (
    <header className="border-b border-[#eaeaea] bg-white">
      <div className="max-w-[1200px] mx-auto px-6">
        <div className="flex items-center justify-between h-14">
          
          {/* Лого слева */}
          <Link href="/admin" className="flex items-center gap-2 group">
            <div className="w-6 h-6 bg-black rounded-sm flex items-center justify-center">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M7 1L13 12H1L7 1Z" fill="white"/>
              </svg>
            </div>
            <span className="text-sm font-semibold text-black">
              Rotation
            </span>
          </Link>
          
          {/* Табы */}
          <nav className="flex items-center gap-6 absolute left-1/2 -translate-x-1/2">
            <Link 
              href="/admin" 
              className={`text-sm transition-colors relative py-4 ${
                isActive('/admin') 
                  ? 'text-black font-medium' 
                  : 'text-[#666] hover:text-black'
              }`}
            >
              Приложения
              {isActive('/admin') && (
                <span className="absolute bottom-0 left-0 right-0 h-px bg-black" />
              )}
            </Link>
            <Link 
              href="/admin/stats" 
              className={`text-sm transition-colors relative py-4 ${
                isActive('/admin/stats') 
                  ? 'text-black font-medium' 
                  : 'text-[#666] hover:text-black'
              }`}
            >
              Статистика
              {isActive('/admin/stats') && (
                <span className="absolute bottom-0 left-0 right-0 h-px bg-black" />
              )}
            </Link>
          </nav>
          
          {/* Sync */}
          <div className="flex items-center gap-2 text-xs text-[#666]">
            <span className="w-1.5 h-1.5 rounded-full bg-[#0070f3]" />
            <span>Sync · {lastSync || '—'}</span>
          </div>
        </div>
      </div>
    </header>
  );
}

'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, BarChart3, RefreshCw } from 'lucide-react';

export default function AdminNav({ lastSync }: { lastSync?: string }) {
  const pathname = usePathname();

  const isActive = (path: string) => pathname === path || (path !== '/admin' && pathname.startsWith(path));

  const tabClass = (active: boolean) => `
    flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium
    transition-colors
    ${active 
    ? 'bg-[#e8edfa] text-[#3e60d5]' 
    : 'text-[#6c757d] hover:bg-[#f5f6f8] hover:text-[#313a46]'
    }
  `;

  return (
    <header className="bg-white border-b border-[#e9ebec] sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex items-center justify-between h-16">
        
          {/* Лого слева */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-md bg-[#3e60d5] flex items-center justify-center">
              <RefreshCw className="w-5 h-5 text-white" />
            </div>
            <span className="text-base font-semibold text-[#313a46]">
              Rotation Admin
            </span>
          </div>
          
          {/* Табы по центру */}
          <nav className="flex items-center gap-1">
            <Link href="/admin" className={tabClass(isActive('/admin'))}>
              <Home className="w-4 h-4" />
              Главная
            </Link>
            <Link href="/admin/stats" className={tabClass(isActive('/admin/stats'))}>
              <BarChart3 className="w-4 h-4" />
              Статистика
            </Link>
          </nav>
          
          {/* Sync время справа */}
          <div className="flex items-center gap-2 text-xs text-[#6c757d]">
            <RefreshCw className="w-3.5 h-3.5" />
            <span>{lastSync}</span>
          </div>
        </div>
      </div>
    </header>
  );
}

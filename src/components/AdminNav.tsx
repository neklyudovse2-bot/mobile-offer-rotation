'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, BarChart3, RefreshCw } from 'lucide-react';

export default function AdminNav({ lastSync }: { lastSync?: string }) {
  const pathname = usePathname();

  const links = [
    { href: '/admin', label: 'Главная', icon: Home },
    { href: '/admin/stats', label: 'Статистика', icon: BarChart3 },
  ];

  return (
    <nav className="sticky top-0 z-50 w-full bg-white border-b border-[#e9ebec] h-16 shadow-sm">
      <div className="max-w-7xl mx-auto px-6 h-full flex items-center justify-between">
        <div className="flex items-center gap-10 h-full">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 bg-[#3e60d5] rounded flex items-center justify-center">
               <RefreshCw className="w-4 h-4 text-white stroke-[3] rotate-45" />
            </div>
            <span className="font-bold text-[#313a46] tracking-tight text-lg leading-none">Rotation Admin</span>
          </div>
          
          <div className="flex items-center gap-2 h-full pt-1">
            {links.map((link) => {
              const isActive = pathname === link.href || (link.href !== '/admin' && pathname.startsWith(link.href));
              const Icon = link.icon;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`flex items-center gap-2 px-3 h-full border-b-2 text-sm font-medium transition-all duration-200 ${
                    isActive 
                      ? 'border-[#3e60d5] text-[#3e60d5]' 
                      : 'border-transparent text-[#6c757d] hover:text-[#313a46]'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {link.label}
                </Link>
              );
            })}
          </div>
        </div>

        {lastSync && (
          <div className="flex items-center gap-1.5 px-3 py-1 bg-[#f5f6f8] rounded-md border border-[#e9ebec]">
            <RefreshCw className="w-3 h-3 text-[#98a6ad]" />
            <span className="text-[11px] font-semibold text-[#6c757d] uppercase tracking-wider">{lastSync}</span>
          </div>
        )}
      </div>
    </nav>
  );
}

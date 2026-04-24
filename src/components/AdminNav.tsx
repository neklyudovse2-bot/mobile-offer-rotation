'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function AdminNav() {
  const pathname = usePathname();

  const links = [
    { href: '/admin', label: 'Главная' },
    { href: '/admin/stats', label: 'Статистика всех' },
  ];

  return (
    <nav className="flex gap-6 mb-8 border-b border-gray-200 pb-4">
      {links.map((link) => {
        const isActive = pathname === link.href;
        return (
          <Link
            key={link.href}
            href={link.href}
            className={`text-sm font-medium transition-colors hover:text-blue-600 ${
              isActive ? 'text-blue-600 border-b-2 border-blue-600 pb-4 -mb-[17px]' : 'text-gray-500'
            }`}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}

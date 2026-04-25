'use client';

import { useState } from 'react';
import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';

interface Row {
  slug: string;
  clicks: number;
  conversions: number;
  revenue: number;
  epc: number;
}

type SortKey = 'slug' | 'clicks' | 'conversions' | 'revenue' | 'epc';
type SortDir = 'asc' | 'desc';

export default function AggregatedStatsTable({ rows }: { rows: Row[] }) {
  const [sortKey, setSortKey] = useState<SortKey>('revenue');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const sorted = [...rows].sort((a, b) => {
    if (sortKey === 'slug') {
      return sortDir === 'asc' 
        ? a.slug.localeCompare(b.slug) 
        : b.slug.localeCompare(a.slug);
    }
    const av = a[sortKey];
    const bv = b[sortKey];
    return sortDir === 'asc' ? av - bv : bv - av;
  });

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir(key === 'slug' ? 'asc' : 'desc');
    }
  };

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortKey !== col) {
      return <ArrowUpDown className="w-3 h-3 text-[#999] inline-block ml-1" />;
    }
    return sortDir === 'asc' 
      ? <ArrowUp className="w-3 h-3 text-black inline-block ml-1" />
      : <ArrowDown className="w-3 h-3 text-black inline-block ml-1" />;
  };

  return (
    <div className="border border-[#eaeaea] rounded-md bg-white overflow-hidden">
      <table className="w-full">
        <thead>
          <tr className="border-b border-[#eaeaea] bg-[#fafafa]">
            <th 
              onClick={() => toggleSort('slug')}
              className="px-5 py-3 text-left text-[11px] font-medium 
                         text-[#666] uppercase tracking-wider 
                         cursor-pointer hover:text-black select-none"
            >
              Оффер
              <SortIcon col="slug" />
            </th>
            <th 
              onClick={() => toggleSort('clicks')}
              className="px-5 py-3 text-right text-[11px] font-medium 
                         text-[#666] uppercase tracking-wider 
                         cursor-pointer hover:text-black select-none"
            >
              Клики
              <SortIcon col="clicks" />
            </th>
            <th 
              onClick={() => toggleSort('conversions')}
              className="px-5 py-3 text-right text-[11px] font-medium 
                         text-[#666] uppercase tracking-wider 
                         cursor-pointer hover:text-black select-none"
            >
              Конверсии
              <SortIcon col="conversions" />
            </th>
            <th 
              onClick={() => toggleSort('revenue')}
              className="px-5 py-3 text-right text-[11px] font-medium 
                         text-[#666] uppercase tracking-wider 
                         cursor-pointer hover:text-black select-none"
            >
              Revenue
              <SortIcon col="revenue" />
            </th>
            <th 
              onClick={() => toggleSort('epc')}
              className="px-5 py-3 text-right text-[11px] font-medium 
                         text-[#666] uppercase tracking-wider 
                         cursor-pointer hover:text-black select-none"
            >
              EPC
              <SortIcon col="epc" />
            </th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((row, idx) => (
            <tr 
              key={row.slug}
              className={`border-b border-[#eaeaea] last:border-b-0 
                          hover:bg-[#fafafa] transition-colors`}
            >
              <td className="px-5 py-3">
                <span className="text-sm text-black font-medium">
                  {row.slug}
                </span>
              </td>
              <td className="px-5 py-3 text-right text-sm text-black tabular-nums">
                {row.clicks.toLocaleString('ru-RU')}
              </td>
              <td className="px-5 py-3 text-right text-sm text-black tabular-nums">
                {row.conversions}
              </td>
              <td className="px-5 py-3 text-right text-sm text-black tabular-nums">
                {Math.round(row.revenue).toLocaleString('ru-RU')} ₽
              </td>
              <td className="px-5 py-3 text-right text-sm font-medium text-black tabular-nums">
                {row.epc.toFixed(2)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

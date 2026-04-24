'use client';

import { useState } from 'react';

export default function AggregatedStatsTable({ data }: { data: any[] }) {
  const [sortKey, setSortKey] = useState('revenue');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const toggleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  };

  const sortedData = [...data].sort((a, b) => {
    const valA = a[sortKey];
    const valB = b[sortKey];
    const mul = sortDir === 'asc' ? 1 : -1;

    if (typeof valA === 'string') {
        return valA.localeCompare(valB) * mul;
    }
    return (valA - valB) * mul;
  });

  const headers = [
    { key: 'displayName', label: 'Оффер (Slug)' },
    { key: 'clicks', label: 'Клики' },
    { key: 'conversions', label: 'Конв.' },
    { key: 'revenue', label: 'Revenue' },
    { key: 'epc', label: 'EPC' },
  ];

  return (
    <div className="border border-gray-100 rounded-lg shadow-sm overflow-hidden bg-white">
      <table className="w-full text-left text-sm text-black">
        <thead>
          <tr className="bg-gray-50 border-b border-gray-100 text-[10px] font-black uppercase text-gray-400 tracking-widest">
            {headers.map(h => (
              <th 
                key={h.key} 
                onClick={() => toggleSort(h.key)}
                className="px-6 py-4 cursor-pointer hover:text-black transition-colors"
              >
                <div className="flex items-center gap-1">
                  {h.label}
                  {sortKey === h.key && (
                    <span className="text-blue-600">{sortDir === 'asc' ? '↑' : '↓'}</span>
                  )}
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {sortedData.map((o: any) => (
            <tr key={o.slug} className="hover:bg-gray-50 transition-all">
              <td className="px-6 py-4">
                <div className="font-bold text-gray-900 leading-tight">{o.displayName}</div>
                <div className="text-[9px] text-gray-400 font-mono mt-0.5">{o.slug}</div>
              </td>
              <td className="px-6 py-4 font-mono">{o.clicks.toLocaleString('ru-RU')}</td>
              <td className="px-6 py-4 font-mono text-center">{o.conversions.toLocaleString('ru-RU')}</td>
              <td className="px-6 py-4 font-mono text-green-700 font-bold">{o.revenue.toLocaleString('ru-RU')}</td>
              <td className="px-6 py-4 font-mono font-bold text-blue-600">{o.epc.toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

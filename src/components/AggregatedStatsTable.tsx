'use client';

import { useState } from 'react';
import { Package, MousePointerClick, TrendingUp, Wallet, ArrowUp, ArrowDown } from 'lucide-react';

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

  const maxEpc = Math.max(...data.map(r => r.epc), 0);

  const getLetterColor = (char: string) => {
    const code = char.toLowerCase().charCodeAt(0) - 97;
    if (code >= 0 && code <= 4) return 'bg-blue-100 text-blue-700';
    if (code >= 5 && code <= 9) return 'bg-violet-100 text-violet-700';
    if (code >= 10 && code <= 14) return 'bg-emerald-100 text-emerald-700';
    if (code >= 15 && code <= 19) return 'bg-amber-100 text-amber-700';
    return 'bg-rose-100 text-rose-700';
  };

  const headers = [
    { key: 'slug', label: 'Оффер (Slug)', align: 'text-left px-6' },
    { key: 'clicks', label: 'Клики', align: 'text-right px-4' },
    { key: 'conversions', label: 'Конв.', align: 'text-right px-4' },
    { key: 'revenue', label: 'Revenue', align: 'text-right px-4' },
    { key: 'epc', label: 'EPC', align: 'text-right px-6' },
  ];

  const formatNum = (num: number) => Math.round(num).toLocaleString('ru-RU');

  return (
    <div className="space-y-8">
      {/* Metrics Row */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {[
          { label: 'Офферов', val: data.length, icon: Package, color: 'bg-blue-50 text-blue-600' },
          { label: 'Клики', val: data.reduce((acc, curr) => acc + curr.clicks, 0).toLocaleString('ru-RU'), icon: MousePointerClick, color: 'bg-violet-50 text-violet-600' },
          { label: 'Конверсии', val: data.reduce((acc, curr) => acc + curr.conversions, 0).toLocaleString('ru-RU'), icon: TrendingUp, color: 'bg-emerald-50 text-emerald-600' },
          { label: 'Revenue', val: data.reduce((acc, curr) => acc + curr.revenue, 0).toLocaleString('ru-RU') + ' ₽', icon: Wallet, color: 'bg-amber-50 text-amber-600' },
        ].map((m, i) => (
          <div key={i} className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
            <div className={`w-8 h-8 ${m.color} rounded-lg flex items-center justify-center mb-4`}>
              <m.icon className="w-5 h-5" />
            </div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{m.label}</p>
            <p className="text-2xl font-bold text-slate-900 mt-1">{m.val}</p>
          </div>
        ))}
      </div>

      {/* Main Table */}
      <div className="border border-slate-200 rounded-xl shadow-sm overflow-hidden bg-white">
        <table className="w-full text-left text-sm border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 h-12">
              {headers.map(h => (
                <th 
                  key={h.key} 
                  onClick={() => toggleSort(h.key)}
                  className={`${h.align} cursor-pointer hover:bg-slate-100 transition-colors select-none group`}
                >
                  <div className={`flex items-center gap-1 ${h.align.includes('right') ? 'justify-end' : ''}`}>
                    <span className="text-xs font-semibold uppercase text-slate-500 tracking-wider">
                      {h.label}
                    </span>
                    <span className={`transition-opacity ${sortKey === h.key ? 'opacity-100' : 'opacity-0 group-hover:opacity-30'}`}>
                      {sortKey === h.key && sortDir === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-blue-600" /> : <ArrowDown className="w-3.5 h-3.5 text-blue-600" />}
                    </span>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {sortedData.map((o: any) => {
              const epcOpacity = maxEpc > 0 ? (o.epc / maxEpc) : 0;
              return (
                <tr key={o.slug} className="h-14 hover:bg-slate-50/80 transition-colors group">
                  <td className="px-6 py-2">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm uppercase shrink-0 ${getLetterColor(o.slug[0])}`}>
                        {o.slug[0]}
                      </div>
                      <span className="font-semibold text-slate-900 tracking-tight">{o.slug}</span>
                    </div>
                  </td>
                  <td className="px-4 py-2 text-right font-mono tabular-nums text-slate-700">{o.clicks.toLocaleString('ru-RU')}</td>
                  <td className="px-4 py-2 text-right font-mono tabular-nums text-slate-700">{o.conversions.toLocaleString('ru-RU')}</td>
                  <td className="px-4 py-2 text-right font-mono tabular-nums text-emerald-700 font-bold">{formatNum(o.revenue)}</td>
                  <td 
                    className="px-6 py-2 text-right font-mono tabular-nums text-slate-900 font-bold relative"
                    style={{ backgroundColor: `rgba(16, 185, 129, ${epcOpacity * 0.15})` }}
                  >
                    {o.epc.toFixed(2)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

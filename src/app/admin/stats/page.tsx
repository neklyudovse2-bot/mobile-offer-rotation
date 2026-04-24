import { isAdminAuthenticated } from '@/lib/auth';
import Login from '@/components/Login';
import { sql } from '@/lib/db';
import AdminNav from '@/components/AdminNav';
import AggregatedStatsTable from '@/components/AggregatedStatsTable';
import { ChevronDown } from 'lucide-react';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function StatsPage() {
  if (!(await isAdminAuthenticated())) return <Login />;

  const lastSyncRes = await sql`SELECT MAX(synced_at) as last_sync FROM keitaro_stats`;
  const lastSync = lastSyncRes[0]?.last_sync ? new Date(lastSyncRes[0].last_sync).toLocaleString('ru-RU', { hour: '2-digit', minute: '2-digit' }) : '...';

  // 1. Получаем статистику Keitaro
  const stats = await sql`
     SELECT s.* FROM keitaro_stats s 
     WHERE s.synced_at = (SELECT MAX(synced_at) FROM keitaro_stats)
  `;

  // 2. Группируем по офферу (slug)
  const groupedMap = new Map();

  stats.forEach((row: any) => {
    const slug = row.offer_slug || 'n/a';
    if (!groupedMap.has(slug)) {
      groupedMap.set(slug, {
        slug: slug,
        displayName: slug,
        clicks: 0,
        conversions: 0,
        revenue: 0
      });
    }

    const item = groupedMap.get(slug);
    item.clicks += parseInt(row.clicks) || 0;
    item.conversions += parseInt(row.conversions) || 0;
    item.revenue += parseFloat(row.revenue) || 0;
  });

  // Преобразуем в массив и считаем EPC
  const aggregatedData = Array.from(groupedMap.values()).map(item => ({
    ...item,
    epc: item.clicks > 0 ? item.revenue / item.clicks : 0
  }));

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 border-black">
      <AdminNav lastSync={lastSync} />

      <main className="max-w-7xl mx-auto px-6 py-10">
        <header className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-10">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Статистика</h1>
            <p className="text-slate-500 text-sm mt-1 leading-none">Агрегированно по всем приложениям за последние 7 дней</p>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl px-4 py-2 shadow-sm flex items-center gap-4 cursor-default group hover:border-slate-300 transition-all">
             <div className="flex flex-col">
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Период</span>
                <span className="text-sm font-semibold text-slate-700 leading-none">Последние 7 дней</span>
             </div>
             <ChevronDown className="w-4 h-4 text-slate-400 group-hover:text-slate-900 transition-colors" />
          </div>
        </header>
        
        <AggregatedStatsTable data={aggregatedData} />
      </main>
    </div>
  );
}

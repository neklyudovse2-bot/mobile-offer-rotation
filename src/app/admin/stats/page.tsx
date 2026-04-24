import { isAdminAuthenticated } from '@/lib/auth';
import Login from '@/components/Login';
import { sql } from '@/lib/db';
import AdminNav from '@/components/AdminNav';
import AggregatedStatsTable from '@/components/AggregatedStatsTable';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function StatsPage() {
  if (!(await isAdminAuthenticated())) return <Login />;

  // 1. Получаем статистику Keitaro
  const stats = await sql`
     SELECT s.* FROM keitaro_stats s 
     WHERE s.synced_at = (SELECT MAX(synced_at) FROM keitaro_stats)
  `;

  // 2. Группируем по офферу (slug)
  const groupedMap = new Map();

  stats.forEach((row: any) => {
    const slug = row.offer_slug;
    if (!groupedMap.has(slug)) {
      groupedMap.set(slug, {
        slug: slug,
        displayName: slug, // Изначально слаг
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
    <div className="min-h-screen bg-white text-black p-8 font-sans">
      <div className="max-w-6xl mx-auto">
        <AdminNav />
        <div className="mb-8 border-b-2 border-black pb-2 mt-4 inline-block">
          <h1 className="text-3xl font-black uppercase tracking-tighter text-gray-900">Агрегированная статистика</h1>
          <p className="text-gray-400 text-xs font-mono">Группировка по офферу (все приложения) • Сортировка кликом по шапке</p>
        </div>
        
        <AggregatedStatsTable data={aggregatedData} />
      </div>
    </div>
  );
}

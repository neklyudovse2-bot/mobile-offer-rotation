import { isAdminAuthenticated } from '@/lib/auth';
import Login from '@/components/Login';
import { sql } from '@/lib/db';
import AdminNav from '@/components/AdminNav';
import AggregatedStatsTable from '@/components/AggregatedStatsTable';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function StatsPage() {
  let authenticated = false;
  try { authenticated = await isAdminAuthenticated(); } catch (e) {}
  if (!authenticated) return <Login />;

  const lastSyncRes = await sql`
    SELECT MAX(synced_at) as last_sync, COUNT(*)::int as record_count 
    FROM keitaro_stats
  `;
  const lastSyncAt = lastSyncRes[0]?.last_sync 
    ? new Date(lastSyncRes[0].last_sync).toISOString() 
    : null;
  const recordCount = lastSyncRes[0]?.record_count || 0;

  // Aggregated stats from latest sync
  const stats = await sql`
    SELECT 
      offer_slug,
      SUM(clicks)::int as clicks,
      SUM(conversions)::int as conversions,
      SUM(revenue)::numeric as revenue,
      CASE WHEN SUM(clicks) > 0 THEN (SUM(revenue)::numeric / SUM(clicks)::numeric) ELSE 0 END as epc
    FROM keitaro_stats
    WHERE synced_at = (SELECT MAX(synced_at) FROM keitaro_stats)
    GROUP BY offer_slug
    ORDER BY revenue DESC
  `;

  return (
    <div className="min-h-screen bg-white text-black font-sans">
      <AdminNav lastSyncAt={lastSyncAt} recordCount={recordCount} />

      <main className="max-w-[1200px] mx-auto px-6 py-12">
        <div className="mb-10">
          <h1 className="text-3xl font-semibold tracking-tight mb-2 uppercase tracking-tighter">
            Статистика
          </h1>
          <p className="text-sm text-[#666]">
            Агрегировано по всем приложениям · последние данные Keitaro
          </p>
        </div>

        <AggregatedStatsTable rows={stats.map((s: any) => ({
          slug: s.offer_slug,
          clicks: s.clicks,
          conversions: s.conversions,
          revenue: parseFloat(s.revenue),
          epc: parseFloat(s.epc),
        }))} />
      </main>
    </div>
  );
}

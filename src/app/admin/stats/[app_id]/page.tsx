import { isAdminAuthenticated } from '@/lib/auth';
import Login from '@/components/Login';
import { APP_MAPPING } from '@/config/mapping';
import { sql } from '@/lib/db';
import AdminNav from '@/components/AdminNav';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { notFound } from 'next/navigation';
import AggregatedStatsTable from '@/components/AggregatedStatsTable';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function AppStatsPage({ params }: { params: Promise<{ app_id: string }> }) {
  const { app_id } = await params;
  const app = APP_MAPPING.find(a => a.appId === app_id);
  if (!app) notFound();

  let authenticated = false;
  try { authenticated = await isAdminAuthenticated(); } catch (e) {}
  if (!authenticated) return <Login />;

  const lastSyncRes = await sql`SELECT MAX(synced_at) as last_sync FROM keitaro_stats`;
  const lastSync = lastSyncRes[0]?.last_sync 
    ? new Date(lastSyncRes[0].last_sync).toLocaleString('ru-RU', { hour: '2-digit', minute: '2-digit' }) 
    : '—';

  // Stats for this specific app (latest sync)
  const stats = await sql`
    SELECT 
      offer_slug,
      SUM(clicks)::int as clicks,
      SUM(conversions)::int as conversions,
      SUM(revenue)::numeric as revenue,
      CASE WHEN SUM(clicks) > 0 THEN (SUM(revenue)::numeric / SUM(clicks)::numeric) ELSE 0 END as epc
    FROM keitaro_stats
    WHERE synced_at = (SELECT MAX(synced_at) FROM keitaro_stats)
      AND app_name = ${app.name}
    GROUP BY offer_slug
    ORDER BY revenue DESC
  `;

  // Total KPIs for this app
  const totalsRes = await sql`
    SELECT 
      SUM(clicks)::int as total_clicks,
      SUM(conversions)::int as total_conversions,
      SUM(revenue)::numeric as total_revenue,
      COUNT(DISTINCT offer_slug)::int as total_offers
    FROM keitaro_stats
    WHERE synced_at = (SELECT MAX(synced_at) FROM keitaro_stats)
      AND app_name = ${app.name}
  `;
  const totals = totalsRes[0];

  return (
    <div className="min-h-screen bg-white">
      <AdminNav lastSync={lastSync} />

      <main className="max-w-[1200px] mx-auto px-6 py-12">
        {/* Breadcrumbs */}
        <nav className="flex items-center gap-1.5 text-xs text-[#666] mb-4">
          <Link href="/admin/stats" className="hover:text-black transition-colors">
            Статистика
          </Link>
          <ChevronRight className="w-3 h-3" />
          <span className="text-black">{app.name}</span>
        </nav>

        {/* Hero */}
        <div className="mb-10 flex items-end justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-3xl font-semibold text-black tracking-tight">
                {app.name}
              </h1>
              <span className="text-sm text-[#666] tabular-nums">
                {app.appId}
              </span>
            </div>
            <p className="text-sm text-[#666]">
              Статистика за последние 7 дней
            </p>
          </div>
          <Link 
            href={`/admin/offers/${app.appId}`}
            className="text-sm text-[#666] hover:text-black transition-colors"
          >
            Открыть настройки →
          </Link>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
          <KpiCard label="Офферов" value={totals.total_offers || 0} />
          <KpiCard label="Кликов" value={(totals.total_clicks || 0).toLocaleString('ru-RU')} />
          <KpiCard label="Конверсий" value={totals.total_conversions || 0} />
          <KpiCard 
            label="Revenue" 
            value={`${Math.round(totals.total_revenue || 0).toLocaleString('ru-RU')} ₽`} 
          />
        </div>

        {/* Table */}
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

function KpiCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="border border-[#eaeaea] rounded-md p-5 bg-white">
      <p className="text-xs text-[#666] uppercase tracking-wider mb-2">
        {label}
      </p>
      <p className="text-2xl font-semibold text-black tabular-nums tracking-tight">
        {value}
      </p>
    </div>
  );
}

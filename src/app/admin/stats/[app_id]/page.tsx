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

  const lastSyncRes = await sql`
    SELECT MAX(synced_at) as last_sync, COUNT(*)::int as record_count 
    FROM keitaro_stats
  `;
  const lastSyncAt = lastSyncRes[0]?.last_sync 
    ? new Date(lastSyncRes[0].last_sync).toISOString() 
    : null;
  const recordCount = lastSyncRes[0]?.record_count || 0;

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

  return (
    <div className="min-h-screen bg-white font-sans text-black">
      <AdminNav lastSyncAt={lastSyncAt} recordCount={recordCount} />

      <main className="max-w-[1200px] mx-auto px-6 py-12">
        {/* Breadcrumbs */}
        <nav className="flex items-center gap-1.5 text-xs text-[#666] mb-4">
          <Link href="/admin/stats" className="hover:text-black transition-colors">
            Статистика
          </Link>
          <ChevronRight className="w-3 h-3 text-[#eaeaea]" />
          <span className="text-black">{app.name}</span>
        </nav>

        {/* Hero */}
        <div className="mb-10 flex items-end justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-3xl font-semibold tracking-tight uppercase tracking-tighter">
                {app.name}
              </h1>
              <span className="text-sm text-[#666] font-mono">
                {app.appId}
              </span>
            </div>
            <p className="text-sm text-[#666]">
              Детальная статистика из Keitaro
            </p>
          </div>
          <Link 
            href={`/admin/offers/${app.appId}`}
            className="text-sm text-[#666] hover:text-black transition-colors font-medium border-b border-transparent hover:border-black"
          >
            Открыть настройки →
          </Link>
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

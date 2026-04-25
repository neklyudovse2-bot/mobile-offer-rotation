import { isAdminAuthenticated } from '@/lib/auth';
import Login from '@/components/Login';
import { APP_MAPPING } from '@/config/mapping';
import { sql } from '@/lib/db';
import { getFirestore } from '@/lib/firebase';
import Link from 'next/link';
import RecalculateButton from '@/components/RecalculateButton';
import AdminNav from '@/components/AdminNav';
import { ArrowRight, RefreshCw } from 'lucide-react';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function AdminPage() {
  let authenticated = false;
  let errorMsg = '';

  try {
    authenticated = await isAdminAuthenticated();
  } catch (e: any) {
    errorMsg = e.message;
  }

  if (errorMsg) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-6">
        <div className="bg-white p-8 rounded-md border border-[#eaeaea] max-w-md w-full text-center">
          <h1 className="text-base font-semibold text-black mb-2">Configuration error</h1>
          <p className="text-[#666] text-sm">{errorMsg}</p>
        </div>
      </div>
    );
  }

  if (!authenticated) {
    return <Login />;
  }

  const lastSyncRes = await sql`SELECT MAX(synced_at) as last_sync FROM keitaro_stats`;
  const lastSync = lastSyncRes[0]?.last_sync 
    ? new Date(lastSyncRes[0].last_sync).toLocaleString('ru-RU', { hour: '2-digit', minute: '2-digit' }) 
    : '—';

  let firestore;
  try { firestore = getFirestore(); } catch(e) {}

  const appsData = [];

  for (const app of APP_MAPPING) {
    let topOffers: Array<{slug: string, displayName: string, pos: number, epc: number, zone: 'pin' | 'auto' | 'default'}> = [];
    let metrics = { active: 0, hidden: 0, pinned: 0, total: 0 };

    if (firestore) {
      const snapshotAll = await firestore.collection(app.appId).doc('ru').collection('loans').get();
      const overrides = await sql`SELECT offer_slug, manual_pin, auto_priority FROM offer_overrides WHERE app_id = ${app.appId}`;
      const epcStats = await sql`SELECT offer_slug, epc FROM global_epc_7d`;
      const epcMap = new Map(epcStats.map((s: any) => [s.offer_slug, parseFloat(s.epc)]));

      metrics.total = snapshotAll.docs.length;
      snapshotAll.docs.forEach(doc => {
        const data = doc.data();
        let slug = '';
        try { slug = new URL(data.url).searchParams.get('aff_sub3') || ''; } catch(e) {}
        const isAct = data.active !== false;
        if (isAct) metrics.active++; else metrics.hidden++;
        const ov = overrides.find((o: any) => o.offer_slug === (slug || doc.id));
        if (ov?.manual_pin !== null && ov?.manual_pin !== undefined) metrics.pinned++;
      });

      const snapshotTop = await firestore.collection(app.appId).doc('ru').collection('loans').orderBy(app.sortField, 'asc').limit(3).get();
      topOffers = snapshotTop.docs.map(doc => {
        const data = doc.data();
        let slug = '';
        try { slug = new URL(data.url).searchParams.get('aff_sub3') || ''; } catch(e) {}
        const displayName = data.title || slug || doc.id;
        const ov = overrides.find((o: any) => o.offer_slug === (slug || doc.id));
        let zone: 'pin' | 'auto' | 'default' = 'default';
        if (ov?.manual_pin !== null && ov?.manual_pin !== undefined) zone = 'pin';
        else if (ov?.auto_priority !== null && ov?.auto_priority !== undefined) zone = 'auto';
        return { 
          slug: slug || doc.id, 
          displayName,
          pos: data[app.sortField], 
          epc: epcMap.get(slug || doc.id) || 0, 
          zone 
        };
      });
    }

    appsData.push({ ...app, topOffers, metrics });
  }

  return (
    <div className="min-h-screen bg-white">
      <AdminNav lastSync={lastSync} />

      <main className="max-w-[1200px] mx-auto px-6 py-12">
        {/* Hero */}
        <div className="mb-10">
          <h1 className="text-3xl font-semibold text-black tracking-tight mb-2">
            Приложения
          </h1>
          <p className="text-sm text-[#666]">
            Автоматическая ротация офферов по EPC · {APP_MAPPING.length} активных приложения
          </p>
        </div>

        {/* Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-10">
          {appsData.map(app => (
            <div 
              key={app.appId}
              className="border border-[#eaeaea] rounded-md bg-white hover:border-[#999] transition-colors group"
            >
              {/* Header */}
              <div className="p-5 border-b border-[#eaeaea]">
                <div className="flex items-center justify-between mb-1">
                  <h2 className="text-base font-semibold text-black">
                    {app.name}
                  </h2>
                  <span className="text-xs text-[#666] tabular-nums">
                    {app.appId}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-xs text-[#666] tabular-nums">
                  <span>{app.metrics.active} активных</span>
                  <span className="text-[#eaeaea]">·</span>
                  <span>{app.metrics.hidden} скрытых</span>
                  {app.metrics.pinned > 0 && (
                    <>
                      <span className="text-[#eaeaea]">·</span>
                      <span>{app.metrics.pinned} закреплено</span>
                    </>
                  )}
                </div>
              </div>

              {/* Top offers */}
              <div className="p-5">
                <p className="text-[11px] font-medium text-[#999] uppercase tracking-wider mb-3">
                  Top offers
                </p>
                <div className="space-y-2">
                  {app.topOffers.map((offer, i) => (
                    <div key={offer.slug} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="text-xs text-[#999] tabular-nums w-4">
                          {i + 1}
                        </span>
                        <span className="text-black truncate">
                          {offer.displayName}
                        </span>
                        {offer.zone === 'pin' && (
                          <span className="text-[10px] text-[#666] uppercase tracking-wider">
                            pin
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-[#666] tabular-nums shrink-0 ml-2">
                        {offer.epc.toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Footer */}
              <div className="px-5 py-3 border-t border-[#eaeaea] flex items-center justify-between">
                <Link 
                  href={`/admin/stats/${app.appId}`}
                  className="text-xs text-[#666] hover:text-black transition-colors"
                >
                  Статистика
                </Link>
                <Link 
                  href={`/admin/offers/${app.appId}`}
                  className="flex items-center gap-1 text-xs font-medium text-black hover:gap-2 transition-all"
                >
                  Настроить
                  <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
            </div>
          ))}
        </div>

        {/* Recalculate strip */}
        <div className="border border-[#eaeaea] rounded-md bg-white p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <RefreshCw className="w-4 h-4 text-[#666]" />
            <div>
              <p className="text-sm font-medium text-black">
                Пересчитать все приложения
              </p>
              <p className="text-xs text-[#666] mt-0.5">
                Обновит Firestore по последним данным Keitaro
              </p>
            </div>
          </div>
          <RecalculateButton />
        </div>
      </main>
    </div>
  );
}

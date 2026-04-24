import { isAdminAuthenticated } from '@/lib/auth';
import Login from '@/components/Login';
import { APP_MAPPING } from '@/config/mapping';
import { sql } from '@/lib/db';
import { getFirestore } from '@/lib/firebase';
import Link from 'next/link';
import RecalculateButton from '@/components/RecalculateButton';
import AdminNav from '@/components/AdminNav';
import { Settings, BarChart3, RefreshCw, Package } from 'lucide-react';

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
      <div className="min-h-screen bg-[#f5f6f8] flex items-center justify-center p-6">
        <div className="bg-white p-8 rounded-lg border border-[#e9ebec] shadow-lg max-w-md w-full text-center">
          <Settings className="w-12 h-12 text-[#f1556c] mx-auto mb-6" />
          <h1 className="text-xl font-semibold text-[#313a46] mb-2 uppercase tracking-tight">Configuration Error</h1>
          <p className="text-[#6c757d] text-sm mb-6 leading-relaxed">{errorMsg}.</p>
        </div>
      </div>
    );
  }

  if (!authenticated) {
    return <Login />;
  }

  const lastSyncRes = await sql`SELECT MAX(synced_at) as last_sync FROM keitaro_stats`;
  const lastSync = lastSyncRes[0]?.last_sync ? new Date(lastSyncRes[0].last_sync).toLocaleString('ru-RU', { hour: '2-digit', minute: '2-digit' }) : '...';

  let firestore;
  try { firestore = getFirestore(); } catch(e) {}

  const appsData = [];

  for (const app of APP_MAPPING) {
    let topOffers: Array<{slug: string, pos: number, epc: number, zone: 'pin' | 'auto' | 'default'}> = [];
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
        if (ov?.manual_pin) metrics.pinned++;
      });

      const snapshotTop = await firestore.collection(app.appId).doc('ru').collection('loans').orderBy(app.sortField, 'asc').limit(3).get();
      topOffers = snapshotTop.docs.map(doc => {
        const data = doc.data();
        let slug = '';
        try { slug = new URL(data.url).searchParams.get('aff_sub3') || data.title || doc.id; } catch(e) { slug = doc.id; }
        const ov = overrides.find((o: any) => o.offer_slug === slug);
        let zone: 'pin' | 'auto' | 'default' = 'default';
        if (ov?.manual_pin !== null && ov?.manual_pin !== undefined) zone = 'pin';
        else if (ov?.auto_priority !== null && ov?.auto_priority !== undefined) zone = 'auto';
        return { slug, pos: data[app.sortField], epc: epcMap.get(slug) || 0, zone };
      });
    }

    appsData.push({ ...app, topOffers, metrics });
  }

  return (
    <div className="min-h-screen bg-[#f5f6f8] text-[#313a46]">
      <AdminNav lastSync={lastSync} />

      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* БЛОК 1: Заголовок */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-[#313a46] mb-1">Ротация офферов</h1>
          <p className="text-sm text-[#6c757d]">Автоматическая ротация по EPC · {APP_MAPPING.length} приложения</p>
        </div>

        {/* БЛОК 2: KPI-карточки */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-6">
          {appsData.map(app => (
            <div key={app.appId} className="bg-white rounded-lg border border-[#e9ebec] p-5" style={{ boxShadow: '0 0 35px 0 rgba(154,161,171,0.15)' }}>
              <div className="flex items-start justify-between mb-4">
                <div>
                  <p className="text-xs font-semibold text-[#6c757d] uppercase tracking-wider mb-1">{app.name}</p>
                  <p className="text-3xl font-bold text-[#313a46] leading-none tabular-nums">{app.metrics.active}</p>
                </div>
                <div className="w-10 h-10 rounded-full bg-[#e8edfa] flex items-center justify-center">
                  <Package className="w-5 h-5 text-[#3e60d5]" />
                </div>
              </div>
              <div className="text-xs text-[#6c757d]">
                <span className="text-[#f1556c] font-medium">{app.metrics.hidden} скрытых</span>
                <span className="mx-1.5 text-[#e9ebec]">·</span>
                <span className="text-[#6b5eae] font-medium">{app.metrics.pinned} закреплённых</span>
              </div>
            </div>
          ))}
        </div>

        {/* БЛОК 3: Карточки с топ-3 офферами */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-6">
          {appsData.map(app => (
            <div key={app.appId} className="bg-white rounded-lg border border-[#e9ebec]" style={{ boxShadow: '0 0 35px 0 rgba(154,161,171,0.15)' }}>
              <div className="px-5 pt-5 pb-4 border-b border-[#f0f1f2]">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-semibold text-[#313a46] capitalize">{app.name}</h3>
                  <span className="px-2 py-0.5 rounded-full bg-[#f5f6f8] text-[11px] font-medium font-mono text-[#6c757d]">{app.appId}</span>
                </div>
              </div>
              <div className="px-5 py-4">
                <p className="text-[11px] font-semibold text-[#98a6ad] uppercase tracking-wider mb-3">Топ 3 оффера</p>
                <div className="space-y-2.5">
                  {app.topOffers.map((offer, i) => (
                    <div key={offer.slug} className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-semibold ${
                          offer.zone === 'pin' ? 'bg-[#6b5eae] text-white' : 
                          offer.zone === 'auto' ? 'bg-[#3e60d5] text-white' :
                          'bg-[#98a6ad] text-white'
                        }`}>
                          {i+1}
                        </div>
                        <span className="text-sm text-[#313a46] font-medium">{offer.slug}</span>
                      </div>
                      <span className="text-xs text-[#6c757d] tabular-nums">{offer.epc.toFixed(1)} EPC</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="px-5 pb-5 pt-2 flex gap-2">
                <Link href={`/admin/stats/${app.appId}`} className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-md border border-[#e9ebec] text-sm font-medium text-[#313a46] hover:bg-[#f5f6f8] transition-colors">
                  <BarChart3 className="w-4 h-4" />
                  Статистика
                </Link>
                <Link href={`/admin/offers/${app.appId}`} className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-md bg-[#3e60d5] text-sm font-medium text-white hover:bg-[#324ea7] transition-colors">
                  <Settings className="w-4 h-4" />
                  Настройки
                </Link>
              </div>
            </div>
          ))}
        </div>

        {/* БЛОК 4: Пересчитать все */}
        <div className="bg-white rounded-lg border border-[#e9ebec] p-5 flex items-center justify-between" style={{ boxShadow: '0 0 35px 0 rgba(154,161,171,0.15)' }}>
          <div className="flex items-center gap-4">
            <div className="w-11 h-11 rounded-full bg-[#e8edfa] flex items-center justify-center">
              <RefreshCw className="w-5 h-5 text-[#3e60d5]" />
            </div>
            <div>
              <p className="text-sm font-semibold text-[#313a46] uppercase tracking-wide">Пересчитать все приложения</p>
              <p className="text-xs text-[#6c757d] mt-0.5">Обновит Firestore по свежим данным Keitaro</p>
            </div>
          </div>
          <RecalculateButton />
        </div>
      </main>
    </div>
  );
}

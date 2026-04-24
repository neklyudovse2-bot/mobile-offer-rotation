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
    let topOffers: Array<{slug: string, pos: number, epc: number, zone: string}> = [];
    let metrics = { active: 0, hidden: 0, pinned: 0 };

    if (firestore) {
      // Краткая статистика для KPI
      const snapshotAll = await firestore.collection(app.appId).doc('ru').collection('loans').get();
      const overrides = await sql`SELECT offer_slug, manual_pin, auto_priority FROM offer_overrides WHERE app_id = ${app.appId}`;
      const epcStats = await sql`SELECT offer_slug, epc FROM global_epc_7d`;
      const epcMap = new Map(epcStats.map((s: any) => [s.offer_slug, parseFloat(s.epc)]));

      snapshotAll.docs.forEach(doc => {
        const data = doc.data();
        let slug = '';
        try { slug = new URL(data.url).searchParams.get('aff_sub3') || ''; } catch(e) {}
        const isAct = data.active !== false;
        if (isAct) metrics.active++; else metrics.hidden++;
        const ov = overrides.find((o: any) => o.offer_slug === slug);
        if (ov?.manual_pin) metrics.pinned++;
      });

      // Топ-3
      const snapshotTop = await firestore.collection(app.appId).doc('ru').collection('loans').orderBy(app.sortField, 'asc').limit(3).get();
      topOffers = snapshotTop.docs.map(doc => {
        const data = doc.data();
        let slug = '';
        try { slug = new URL(data.url).searchParams.get('aff_sub3') || data.title || doc.id; } catch(e) { slug = doc.id; }
        const ov = overrides.find((o: any) => o.offer_slug === slug);
        let zone = 'DEFAULT';
        if (ov?.manual_pin !== null && ov?.manual_pin !== undefined) zone = 'PIN';
        else if (ov?.auto_priority !== null && ov?.auto_priority !== undefined) zone = 'AUTO';
        return { slug, pos: data[app.sortField], epc: epcMap.get(slug) || 0, zone };
      });
    }

    appsData.push({ ...app, topOffers, metrics });
  }

  return (
    <div className="min-h-screen bg-[#f5f6f8] font-sans text-[#313a46]">
      <AdminNav lastSync={lastSync} />

      <main className="max-w-7xl mx-auto px-6 py-6">
        <div className="mb-6">
           <h1 className="text-2xl font-semibold text-[#313a46]">Ротация офферов</h1>
           <p className="text-[#6c757d] text-sm mt-0.5">Автоматическая ротация по EPC · 3 приложения</p>
        </div>

        {/* KPI ROW */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {appsData.map(app => (
            <div key={app.appId} className="bg-white border border-[#e9ebec] rounded-lg p-5 shadow-[0_0_35px_0_rgba(154,161,171,0.15)] relative">
               <div className="absolute top-5 right-5 w-10 h-10 bg-[#e8edfa] text-[#3e60d5] rounded-full flex items-center justify-center">
                  <Package className="w-5 h-5" />
               </div>
               <p className="text-[11px] font-semibold text-[#6c757d] uppercase tracking-wider mb-1">{app.name} <span className="font-mono text-[9px]">({app.appId})</span></p>
               <h3 className="text-3xl font-bold text-[#313a46] mb-2">{app.metrics.active}</h3>
               <p className="text-xs text-[#98a6ad] font-medium">{app.metrics.hidden} скрытых · {app.metrics.pinned} пиннены</p>
            </div>
          ))}
        </div>

        {/* APP CARDS */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
          {appsData.map(app => (
            <div key={app.appId} className="bg-white border border-[#e9ebec] rounded-lg shadow-[0_0_35px_0_rgba(154,161,171,0.15)] p-6">
              <div className="flex items-center gap-2 mb-6">
                <h2 className="text-lg font-semibold text-[#313a46] leading-none">{app.name}</h2>
                <span className="text-[10px] font-bold text-[#6c757d] bg-[#f1f3f4] px-2 py-0.5 rounded-full font-mono uppercase tracking-tighter">{app.appId}</span>
              </div>
              
              <div className="space-y-4 mb-8">
                <p className="text-[11px] font-semibold text-[#98a6ad] uppercase tracking-wider">Top 3 Offers</p>
                {app.topOffers.length > 0 ? (
                  <div className="space-y-3">
                    {app.topOffers.map((o) => (
                      <div key={o.slug} className="flex items-center justify-between group">
                        <div className="flex items-center gap-3">
                          <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${
                            o.zone === 'PIN' ? 'bg-[#6b5eae] text-white' : 
                            o.zone === 'AUTO' ? 'bg-[#3e60d5] text-white' :
                            'bg-[#98a6ad] text-white'
                          }`}>
                            {o.pos}
                          </div>
                          <span className="text-sm font-medium text-[#313a46] truncate max-w-[140px] uppercase tracking-tighter">{o.slug}</span>
                        </div>
                        <span className="font-mono text-xs font-semibold text-[#6c757d] tracking-tighter">{o.epc.toFixed(1)} EPC</span>
                      </div>
                    ))}
                  </div>
                ) : <p className="text-slate-300 italic text-xs">Нет данных</p>}
              </div>

              <div className="grid grid-cols-2 gap-3 pt-6 border-t border-[#f0f1f2]">
                <Link 
                  href={`/admin/stats/${app.appId}`} 
                  className="flex items-center justify-center gap-2 py-2 rounded-md border border-[#e9ebec] text-[11px] font-bold text-[#313a46] hover:bg-[#f5f6f8] transition-all uppercase tracking-wider"
                >
                  <BarChart3 className="w-4 h-4 text-[#6c757d]" />
                  Статистика
                </Link>
                <Link 
                  href={`/admin/offers/${app.appId}`} 
                  className="flex items-center justify-center gap-2 py-2 rounded-md bg-[#3e60d5] text-white text-[11px] font-bold hover:bg-[#324ea7] transition-all uppercase tracking-wider"
                >
                  <Settings className="w-4 h-4" />
                  Настройки
                </Link>
              </div>
            </div>
          ))}
        </div>

        <div className="bg-white border border-[#e9ebec] rounded-lg p-5 shadow-[0_0_35px_0_rgba(154,161,171,0.15)] flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-4">
             <div className="w-12 h-12 bg-[#e8edfa] text-[#3e60d5] rounded-full flex items-center justify-center shrink-0">
                <RefreshCw className="w-6 h-6" />
             </div>
             <div>
                <h4 className="font-bold text-[#313a46] leading-none mb-1 text-sm uppercase tracking-wide">Пересчитать все приложения</h4>
                <p className="text-[#98a6ad] text-xs">Обновит Firestore во всех приложениях по свежим данным Keitaro</p>
             </div>
          </div>
          <RecalculateButton />
        </div>
      </main>
    </div>
  );
}

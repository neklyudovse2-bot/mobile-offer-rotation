import { isAdminAuthenticated } from '@/lib/auth';
import Login from '@/components/Login';
import { APP_MAPPING } from '@/config/mapping';
import { sql } from '@/lib/db';
import { getFirestore } from '@/lib/firebase';
import Link from 'next/link';
import RecalculateButton from '@/components/RecalculateButton';
import AdminNav from '@/components/AdminNav';
import { Settings, BarChart3, RefreshCw, Layers } from 'lucide-react';

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
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-xl max-w-md w-full text-center text-black">
          <div className="w-16 h-16 bg-rose-50 text-rose-500 rounded-2xl flex items-center justify-center mx-auto mb-6 border-black">
             <Settings className="w-8 h-8 text-black" />
          </div>
          <h1 className="text-xl font-bold text-slate-900 mb-2 uppercase tracking-tight">Configuration Required</h1>
          <p className="text-slate-500 text-sm mb-6 leading-relaxed">{errorMsg}. Please configure the environment variables in your Vercel project settings.</p>
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-xs font-mono text-slate-400 break-all">
             Vercel Dashboard &gt; Settings &gt; Environment Variables
          </div>
        </div>
      </div>
    );
  }

  if (!authenticated) {
    return <Login />;
  }

  const lastSyncRes = await sql`SELECT MAX(synced_at) as last_sync FROM keitaro_stats`;
  const lastSync = lastSyncRes[0]?.last_sync ? new Date(lastSyncRes[0].last_sync).toLocaleString('ru-RU', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : 'Нет данных';

  let firestore;
  try { firestore = getFirestore(); } catch(e) {}

  const appsData = [];

  for (const app of APP_MAPPING) {
    let topOffers: Array<{slug: string, pos: number, epc: number, zone: string}> = [];
    if (firestore) {
      const snapshot = await firestore.collection(app.appId).doc('ru').collection('loans')
        .orderBy(app.sortField, 'asc')
        .limit(3)
        .get();
      
      const overrides = await sql`SELECT offer_slug, manual_pin, auto_priority FROM offer_overrides WHERE app_id = ${app.appId}`;
      const epcStats = await sql`SELECT offer_slug, epc FROM global_epc_7d`;
      const epcMap = new Map(epcStats.map((s: any) => [s.offer_slug, parseFloat(s.epc)]));

      topOffers = snapshot.docs.map(doc => {
        const data = doc.data();
        const url = data.url || '';
        let slug = '';
        try { 
            const urlObj = new URL(url);
            slug = urlObj.searchParams.get('aff_sub3') || data.title || doc.id; 
        } catch(e) {
            slug = data.title || doc.id;
        }
        
        const ov = overrides.find((o: any) => o.offer_slug === slug);
        // Исправленная логика определения зоны
        let zone = 'DEFAULT';
        if (ov?.manual_pin !== null && ov?.manual_pin !== undefined) zone = 'PIN';
        else if (ov?.auto_priority !== null && ov?.auto_priority !== undefined) zone = 'AUTO';
        
        return { 
          slug, 
          pos: data[app.sortField], 
          epc: epcMap.get(slug) || 0,
          zone 
        };
      });

      // Стабильная сортировка по позиции (id/sort)
      topOffers.sort((a, b) => a.pos - b.pos);
    }

    appsData.push({ ...app, topOffers });
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 border-black">
      <AdminNav lastSync={lastSync} />

      <main className="max-w-7xl mx-auto px-6 py-10">
        <div className="mb-10 text-black border-black">
           <h1 className="text-2xl font-bold tracking-tight text-slate-900">Ротация офферов</h1>
           <p className="text-slate-500 text-sm mt-1">Автоматическая ротация по EPC каждые сутки · 3 приложения</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12 text-black border-black">
          {appsData.map(app => (
            <div key={app.appId} className="bg-white border border-slate-200 rounded-2xl shadow-sm hover:border-slate-300 transition-all flex flex-col p-6 overflow-hidden border-black">
              <div className="mb-6 flex items-center gap-2">
                <h2 className="text-lg font-semibold text-slate-900 leading-none">{app.name}</h2>
                <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full font-mono">{app.appId}</span>
              </div>
              
              <div className="flex-1 space-y-3 mb-8">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Top 3 Offers</p>
                {app.topOffers.length > 0 ? app.topOffers.map((o) => (
                  <div key={o.slug} className="flex items-center justify-between group">
                    <div className="flex items-center gap-3">
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black border ${
                        o.zone === 'PIN' ? 'bg-violet-100 text-violet-700 border-violet-200' : 
                        o.zone === 'AUTO' ? 'bg-blue-100 text-blue-700 border-blue-200' :
                        'bg-slate-100 text-slate-500 border-slate-200'
                      }`}>
                        {o.pos}
                      </div>
                      <span className="text-sm font-semibold text-slate-700 truncate max-w-[120px]">{o.slug}</span>
                    </div>
                    <span className="font-mono text-[11px] font-bold text-slate-400 transition-colors">{o.epc.toFixed(1)} <span className="text-[9px]">EPC</span></span>
                  </div>
                )) : <p className="text-slate-300 italic text-sm py-4">Данных пока нет</p>}
              </div>

              <div className="grid grid-cols-2 gap-3 mt-auto pt-6 border-t border-slate-100">
                <Link 
                  href={`/admin/stats/${app.appId}`} 
                  className="flex items-center justify-center gap-2 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-all active:scale-[0.98]"
                >
                  <BarChart3 className="w-4 h-4" />
                  Статистика
                </Link>
                <Link 
                  href={`/admin/offers/${app.appId}`} 
                  className="flex items-center justify-center gap-2 py-2.5 rounded-xl bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 shadow-sm shadow-blue-200 transition-all active:scale-[0.98]"
                >
                  <Settings className="w-4 h-4" />
                  Настройки
                </Link>
              </div>
            </div>
          ))}
        </div>

        <div className="flex flex-col items-center border-black">
          <RecalculateButton fullWidth />
          <p className="text-slate-400 text-[11px] mt-3 font-medium">Обновит Firestore во всех приложениях на основе последних данных Keitaro</p>
        </div>
      </main>
    </div>
  );
}

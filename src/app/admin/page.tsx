import { isAdminAuthenticated } from '@/lib/auth';
import Login from '@/components/Login';
import { APP_MAPPING } from '@/config/mapping';
import { sql } from '@/lib/db';
import { getFirestore } from '@/lib/firebase';
import Link from 'next/link';
import RecalculateButton from '@/components/RecalculateButton';
import AdminNav from '@/components/AdminNav';
import { Settings, BarChart3, RefreshCw } from 'lucide-react';

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
        <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-xl max-w-md w-full text-center">
          <div className="w-16 h-16 bg-rose-50 text-rose-500 rounded-2xl flex items-center justify-center mx-auto mb-6">
             <Settings className="w-8 h-8" />
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
  const lastSync = lastSyncRes[0]?.last_sync ? new Date(lastSyncRes[0].last_sync).toLocaleString('ru-RU') : 'Нет данных';

  let firestore;
  try { firestore = getFirestore(); } catch(e) {}

  const appsData = [];

  for (const app of APP_MAPPING) {
    let topOffers: Array<{slug: string, pos: number, epc: number, zone: string}> = [];
    if (firestore) {
      const snapshot = await firestore.collection(app.appId).doc('ru').collection('loans')
        .orderBy(app.sortField)
        .limit(3)
        .get();
      
      const overrides = await sql`SELECT offer_slug, manual_pin, auto_priority FROM offer_overrides WHERE app_id = ${app.appId}`;
      const epcStats = await sql`SELECT offer_slug, epc FROM global_epc_7d`;
      const epcMap = new Map(epcStats.map((s: any) => [s.offer_slug, parseFloat(s.epc)]));

      topOffers = snapshot.docs.map(doc => {
        const data = doc.data();
        const url = data.url || '';
        let slug = 'n/a';
        try { 
            const urlObj = new URL(url);
            slug = urlObj.searchParams.get('aff_sub3') || data.title || doc.id; 
        } catch(e) {}
        
        const ov = overrides.find((o: any) => o.offer_slug === slug);
        const zone = ov?.manual_pin ? 'PIN' : (ov?.auto_priority ? 'AUTO' : 'DEFAULT');
        
        return { 
          slug, 
          pos: data[app.sortField], 
          epc: epcMap.get(slug) || 0,
          zone 
        };
      });
    }

    appsData.push({ ...app, topOffers });
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900">
      <AdminNav lastSync={lastSync} />

      <main className="max-w-7xl mx-auto px-6 py-12">
        <div className="flex items-center justify-between mb-10">
           <h1 className="text-2xl font-bold tracking-tight text-slate-900">Ротация офферов</h1>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
          {appsData.map(app => (
            <div key={app.appId} className="bg-white border border-slate-200 rounded-2xl shadow-sm hover:shadow-md transition-all flex flex-col p-6 overflow-hidden">
              <div className="mb-6">
                <h2 className="text-lg font-bold text-slate-900 leading-none mb-1.5">{app.name}</h2>
                <code className="text-[10px] font-bold text-slate-400 bg-slate-50 px-2 py-0.5 rounded border border-slate-100 uppercase tracking-widest">{app.appId}</code>
              </div>
              
              <div className="flex-1 space-y-3 mb-8">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.15em] mb-2">Top 3 Offers</p>
                {app.topOffers.length > 0 ? app.topOffers.map((o) => (
                  <div key={o.slug} className="flex items-center justify-between group">
                    <div className="flex items-center gap-3">
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold border ${
                        o.zone === 'PIN' ? 'bg-violet-50 text-violet-600 border-violet-100' : 
                        o.zone === 'AUTO' ? 'bg-blue-50 text-blue-600 border-blue-100' :
                        'bg-slate-50 text-slate-500 border-slate-200'
                      }`}>
                        {o.pos}
                      </div>
                      <span className="text-sm font-semibold text-slate-700 truncate max-w-[120px]">{o.slug}</span>
                    </div>
                    <span className="font-mono text-[11px] font-bold text-slate-400 group-hover:text-slate-900 transition-colors">{o.epc.toFixed(1)} <span className="text-[9px]">EPC</span></span>
                  </div>
                )) : <p className="text-slate-300 italic text-sm py-4">Данных пока нет</p>}
              </div>

              <div className="grid grid-cols-2 gap-3 mt-auto pt-6 border-t border-slate-50">
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

        <div className="bg-white border border-slate-200 rounded-3xl p-10 flex flex-col items-center text-center shadow-lg shadow-slate-100 relative overflow-hidden group">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-600 to-violet-600"></div>
          <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center mb-6 group-hover:rotate-12 transition-transform duration-500">
             <RefreshCw className="w-8 h-8 text-blue-600" />
          </div>
          <h3 className="text-xl font-bold text-slate-900 mb-2 uppercase tracking-tight">Глобальный пересчет</h3>
          <p className="text-slate-500 text-sm mb-10 max-w-sm leading-relaxed">Мгновенное обновление и перестановка всех офферов в Firestore на основе свежих данных Keitaro.</p>
          <div className="w-full max-w-md">
            <RecalculateButton fullWidth />
          </div>
        </div>
      </main>
    </div>
  );
}

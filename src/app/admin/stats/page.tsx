import { isAdminAuthenticated } from '@/lib/auth';
import Login from '@/components/Login';
import { APP_MAPPING } from '@/config/mapping';
import { sql } from '@/lib/db';
import { getFirestore } from '@/lib/firebase';
import Link from 'next/link';
import AdminNav from '@/components/AdminNav';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function StatsPage() {
  if (!(await isAdminAuthenticated())) return <Login />;

  const lastSyncRes = await sql`SELECT MAX(synced_at) as last_sync FROM keitaro_stats`;
  
  const stats = await sql`
     SELECT s.* FROM keitaro_stats s 
     WHERE s.synced_at = (SELECT MAX(synced_at) FROM keitaro_stats)
  `;

  const globalEpc = await sql`SELECT offer_slug, epc FROM global_epc_7d`;
  const perAppEpc = await sql`SELECT app_name, offer_slug, epc FROM per_app_epc_7d`;
  const overrides = await sql`SELECT app_id, offer_slug, manual_pin, auto_priority, epc_mode FROM offer_overrides`;

  let firestore;
  try { firestore = getFirestore(); } catch(e) {}

  const allOffersFlat: any[] = [];

  for (const app of APP_MAPPING) {
    let fsData: any = {};
    if (firestore) {
      const snapshot = await firestore.collection(app.appId).doc('ru').collection('loans').get();
      snapshot.docs.forEach(doc => {
        const data = doc.data();
        let slug = '';
        try { 
            const url = data.url || '';
            const urlObj = new URL(url);
            slug = urlObj.searchParams.get('aff_sub3') || ''; 
        } catch(e) {}
        const key = slug || doc.id;
        fsData[key] = { 
          pos: data[app.sortField], 
          title: data.title || doc.id, 
          slug, 
          active: data.active !== false 
        };
      });
    }

    const appStats = stats.filter((s: any) => s.app_name === app.name);
    const appOverrides = overrides.filter((o: any) => o.app_id === app.appId);
    const appConfig = appOverrides.find((o: any) => o.offer_slug === 'SYSTEM_DEFAULT');

    const allKeys = new Set([...appStats.map((s: any) => s.offer_slug), ...Object.keys(fsData)]);

    allKeys.forEach(key => {
      if (!key) return;
      const row = appStats.find((s: any) => s.offer_slug === key);
      const or = appOverrides.find((o: any) => o.offer_slug === key);
      const gEpc = globalEpc.find((e: any) => e.offer_slug === key)?.epc || 0;
      const pEpc = perAppEpc.find((e: any) => e.app_name === app.name && e.offer_slug === key)?.epc || 0;
      const fs = fsData[key];

      allOffersFlat.push({
        appName: app.name,
        appId: app.appId,
        slug: key,
        displayName: fs?.title || key,
        clicks: row?.clicks || 0,
        conversions: row?.conversions || 0,
        revenue: row ? parseFloat(row.revenue) : 0,
        globalEpc: gEpc,
        perAppEpc: pEpc,
        currentPos: fs?.pos || '?',
        isActive: fs ? fs.active : true,
        pinned: or ? or.manual_pin : null,
        autoPriority: or ? or.auto_priority : null,
        hasSlug: !!(fs?.slug || row?.offer_slug)
      });
    });
  }

  // Сортировка по Revenue DESC
  allOffersFlat.sort((a, b) => b.revenue - a.revenue);

  return (
    <div className="min-h-screen bg-white text-black p-8 font-sans">
      <div className="max-w-7xl mx-auto">
        <AdminNav />
        <h1 className="text-3xl font-bold mb-8 uppercase tracking-tight text-gray-900 border-b-2 border-black inline-block pb-1 mt-4">Единая статистика</h1>
        
        <div className="border border-gray-100 rounded-lg shadow-sm overflow-hidden bg-white">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100 uppercase text-[10px] text-gray-400 font-black tracking-widest leading-none">
                <th className="px-6 py-4 text-black">Приложение</th>
                <th className="px-6 py-4 text-black">Оффер (Slug)</th>
                <th className="px-6 py-4">Клики</th>
                <th className="px-6 py-4 text-center">Конв.</th>
                <th className="px-6 py-4 font-bold">Revenue</th>
                <th className="px-6 py-4">EPC Global</th>
                <th className="px-6 py-4">EPC App</th>
                <th className="px-6 py-4 text-center">Поз.</th>
                <th className="px-6 py-4 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {allOffersFlat.map((o: any, idx) => (
                <tr key={`${o.appId}-${o.slug}`} className={`hover:bg-gray-50 transition-all ${!o.isActive ? 'opacity-40' : ''}`}>
                  <td className="px-6 py-4 font-mono text-[10px] uppercase font-black text-blue-600">{o.appName}</td>
                  <td className="px-6 py-4">
                    <div className="font-bold text-gray-900 leading-tight">{o.displayName}</div>
                    <div className="text-[9px] text-gray-400 font-mono mt-0.5">{o.slug}</div>
                  </td>
                  <td className="px-6 py-4 font-mono">{o.clicks}</td>
                  <td className="px-6 py-4 font-mono text-center">{o.conversions}</td>
                  <td className="px-6 py-4 font-mono text-green-700 font-bold">{o.revenue.toLocaleString('ru-RU')}</td>
                  <td className="px-6 py-4 font-mono text-gray-400 text-xs">{parseFloat(o.globalEpc).toFixed(2)}</td>
                  <td className="px-6 py-4 font-mono font-bold text-gray-900">{parseFloat(o.perAppEpc).toFixed(2)}</td>
                  <td className="px-6 py-4 font-mono text-blue-600 text-center font-bold">#{o.currentPos}</td>
                  <td className="px-6 py-4 text-center">
                    {o.isActive ? (
                      <span className="text-[10px] bg-green-50 text-green-600 px-2 py-0.5 rounded font-black uppercase">Active</span>
                    ) : (
                      <span className="text-[10px] bg-gray-100 text-gray-400 px-2 py-0.5 rounded font-black uppercase">Hidden</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

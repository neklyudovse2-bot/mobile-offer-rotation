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

  const appsStats = [];
  for (const app of APP_MAPPING) {
    const appOffers: any[] = [];
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

      appOffers.push({
        slug: key,
        displayName: fs?.title || key,
        clicks: row?.clicks || 0,
        conversions: row?.conversions || 0,
        revenue: row?.revenue || 0,
        globalEpc: gEpc,
        perAppEpc: pEpc,
        currentPos: fs?.pos || '?',
        isActive: fs ? fs.active : true,
        pinned: or ? or.manual_pin : null,
        autoPriority: or ? or.auto_priority : null,
        epcMode: appConfig ? appConfig.epc_mode : 'global',
        hasSlug: !!(fs?.slug || row?.offer_slug)
      });
    });

    appOffers.sort((a, b) => {
        if (a.pinned && !b.pinned) return -1;
        if (!a.pinned && b.pinned) return 1;
        if (a.pinned && b.pinned) return a.pinned - b.pinned;
        
        if (a.autoPriority && !b.autoPriority) return -1;
        if (!a.autoPriority && b.autoPriority) return 1;
        if (a.autoPriority && b.autoPriority) return a.autoPriority - b.autoPriority;

        if (a.hasSlug && !b.hasSlug) return -1;
        if (!a.hasSlug && b.hasSlug) return 1;

        return a.currentPos - b.currentPos;
    });

    appsStats.push({ ...app, appOffers, epcMode: appConfig ? appConfig.epc_mode : 'global' });
  }

  return (
    <div className="min-h-screen bg-white text-black p-8 font-sans">
      <div className="max-w-7xl mx-auto">
        <AdminNav />
        <h1 className="text-3xl font-bold mb-8 uppercase tracking-tight text-gray-900 border-b-2 border-black inline-block pb-1 mt-4">Статистика систем</h1>
        
        <div className="space-y-12 mt-8">
          {appsStats.map(app => (
            <div key={app.appId} className="border border-gray-100 rounded shadow-sm overflow-hidden">
              <div className="bg-gray-50 px-6 py-4 flex justify-between items-center outline outline-1 outline-gray-100">
                <h2 className="text-xl font-bold uppercase text-gray-900 tracking-tighter">{app.name} <Link href={`/admin/stats/${app.appId}`} className="text-xs text-blue-500 font-normal ml-2 hover:underline tracking-normal">(открыть отдельно)</Link></h2>
                <div className="flex gap-4 font-mono">
                  <span className="text-[10px] bg-blue-600 text-white px-2 py-1 rounded font-bold uppercase tracking-wider">PIN/AUTO ACTIVE</span>
                  <span className="text-[10px] bg-black text-white px-2 py-1 rounded font-bold uppercase tracking-wider">Режим: {app.epcMode}</span>
                </div>
              </div>
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-gray-100 uppercase text-[10px] text-gray-400 font-black tracking-widest leading-none">
                    <th className="px-6 py-4 text-black">Оффер (Slug/Title)</th>
                    <th className="px-6 py-4">Клики</th>
                    <th className="px-6 py-4">Конв.</th>
                    <th className="px-6 py-4">Revenue</th>
                    <th className="px-6 py-4">EPC Global</th>
                    <th className="px-6 py-4">EPC App</th>
                    <th className="px-6 py-4">Поз.</th>
                    <th className="px-6 py-4">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 bg-white">
                  {app.appOffers.map((o: any) => (
                    <tr key={o.slug} className={`hover:bg-gray-50 ${!o.isActive ? 'opacity-40 grayscale' : ''} transition-all`}>
                      <td className="px-6 py-4">
                        <div className="font-bold text-gray-900">{o.displayName}</div>
                        <div className="flex gap-2 mt-0.5">
                           {o.pinned && <span className="text-[8px] bg-blue-100 text-blue-600 px-1 rounded font-bold uppercase">PIN: {o.pinned}</span>}
                           {o.autoPriority && <span className="text-[8px] bg-green-100 text-green-600 px-1 rounded font-bold uppercase">AUTO: {o.autoPriority}</span>}
                        </div>
                      </td>
                      <td className="px-6 py-4 font-mono">{o.clicks}</td>
                      <td className="px-6 py-4 font-mono text-gray-400">{o.conversions}</td>
                      <td className="px-6 py-4 font-mono text-green-700">{o.revenue}</td>
                      <td className="px-6 py-4 font-mono text-gray-400">{parseFloat(o.globalEpc).toFixed(2)}</td>
                      <td className="px-6 py-4 font-mono font-bold text-gray-900">{parseFloat(o.perAppEpc).toFixed(2)}</td>
                      <td className="px-6 py-4 font-mono text-blue-600 font-bold">#{o.currentPos}</td>
                      <td className="px-6 py-4">
                        {o.isActive ? (
                          <span className="text-[10px] border border-green-200 text-green-600 px-2 py-0.5 rounded uppercase font-black">Active</span>
                        ) : (
                          <span className="text-[10px] border border-red-100 text-red-400 px-2 py-0.5 rounded uppercase font-black">Hidden</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

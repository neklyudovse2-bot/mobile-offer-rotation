import { isAdminAuthenticated } from '@/lib/auth';
import Login from '@/components/Login';
import { APP_MAPPING } from '@/config/mapping';
import { sql } from '@/lib/db';
import { getFirestore } from '@/lib/firebase';
import Link from 'next/link';
import AdminNav from '@/components/AdminNav';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type Params = Promise<{ app_id: string }>;

export default async function AppStatsPage({ params }: { params: Params }) {
  if (!(await isAdminAuthenticated())) return <Login />;

  const { app_id } = await params;
  const app = APP_MAPPING.find(a => a.appId === app_id);
  if (!app) return <div>App not found</div>;

  const lastSyncRes = await sql`SELECT MAX(synced_at) as last_sync FROM keitaro_stats`;
  const lastSyncDate = lastSyncRes[0]?.last_sync;

  const stats = await sql`
     SELECT s.* FROM keitaro_stats s 
     WHERE s.app_name = ${app.name} AND s.synced_at = (SELECT MAX(synced_at) FROM keitaro_stats)
  `;

  const globalEpc = await sql`SELECT offer_slug, epc FROM global_epc_7d`;
  const perAppEpc = await sql`SELECT offer_slug, epc FROM per_app_epc_7d WHERE app_name = ${app.name}`;
  const overrides = await sql`SELECT offer_slug, manual_pin, auto_priority, epc_mode FROM offer_overrides WHERE app_id = ${app.appId}`;
  
  const appConfig = overrides.find((o: any) => o.offer_slug === 'SYSTEM_DEFAULT');

  let firestore;
  try { firestore = getFirestore(); } catch(e) {}

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

  const allKeys = new Set([...stats.map((s: any) => s.offer_slug), ...Object.keys(fsData)]);

  allKeys.forEach(key => {
    if (!key) return;
    const row = stats.find((s: any) => s.offer_slug === key);
    const or = overrides.find((o: any) => o.offer_slug === key);
    const gEpc = globalEpc.find((e: any) => e.offer_slug === key)?.epc || 0;
    const pEpc = perAppEpc.find((e: any) => e.offer_slug === key)?.epc || 0;
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

  return (
    <div className="min-h-screen bg-white text-black p-8">
      <div className="max-w-7xl mx-auto">
        <AdminNav />
        <Link href="/admin" className="text-blue-600 text-sm mb-4 inline-block">← Назад</Link>
        <div className="bg-gray-50 px-6 py-4 flex justify-between items-center rounded-t-lg border border-gray-100">
          <h2 className="text-xl font-bold uppercase text-gray-900 tracking-tight">Статистика: {app.name} <span className="text-gray-400 font-normal">({app.appId})</span></h2>
          <span className="text-xs bg-black text-white px-2 py-1 rounded font-bold uppercase tracking-wider">Режим: {appConfig?.epc_mode || 'global'}</span>
        </div>
        <div className="border border-gray-100 rounded-b-lg overflow-hidden shadow-sm">
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
              {appOffers.map((o: any) => (
                <tr key={o.slug} className={`hover:bg-gray-50 ${!o.isActive ? 'opacity-40 grayscale' : ''}`}>
                  <td className="px-6 py-4">
                    <div className="font-bold">{o.displayName}</div>
                    <div className="flex gap-2 mt-0.5">
                       {o.pinned && <span className="text-[8px] bg-blue-100 text-blue-600 px-1 rounded font-bold uppercase">PIN: {o.pinned}</span>}
                       {o.autoPriority && <span className="text-[8px] bg-green-100 text-green-600 px-1 rounded font-bold uppercase">AUTO: {o.autoPriority}</span>}
                    </div>
                  </td>
                  <td className="px-6 py-4 font-mono">{o.clicks}</td>
                  <td className="px-6 py-4 font-mono">{o.conversions}</td>
                  <td className="px-6 py-4 font-mono text-green-700">{o.revenue}</td>
                  <td className="px-6 py-4 font-mono">{parseFloat(o.globalEpc).toFixed(2)}</td>
                  <td className="px-6 py-4 font-mono font-bold">{parseFloat(o.perAppEpc).toFixed(2)}</td>
                  <td className="px-6 py-4 font-mono text-blue-600 font-bold">#{o.currentPos}</td>
                  <td className="px-6 py-4">
                    {o.isActive ? (
                      <span className="text-[10px] bg-green-100 text-green-800 px-2 py-0.5 rounded uppercase font-bold">Active</span>
                    ) : (
                      <span className="text-[10px] bg-red-100 text-red-800 px-2 py-0.5 rounded uppercase font-bold">Hidden</span>
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

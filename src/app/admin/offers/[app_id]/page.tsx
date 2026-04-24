import { isAdminAuthenticated } from '@/lib/auth';
import Login from '@/components/Login';
import { APP_MAPPING } from '@/config/mapping';
import { sql } from '@/lib/db';
import { getFirestore } from '@/lib/firebase';
import Link from 'next/link';
import OfferSettings from '@/components/OfferSettings';
import AdminNav from '@/components/AdminNav';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type Params = Promise<{ app_id: string }>;

export default async function AppSettingsPage({ params }: { params: Params }) {
  if (!(await isAdminAuthenticated())) return <Login />;

  const { app_id } = await params;
  const app = APP_MAPPING.find(a => a.appId === app_id);
  if (!app) return <div>App not found</div>;

  const overrides = await sql`SELECT offer_slug, manual_pin, auto_priority, epc_mode FROM offer_overrides WHERE app_id = ${app.appId}`;
  const appConfig = overrides.find((o: any) => o.offer_slug === 'SYSTEM_DEFAULT');

  let firestore;
  try { firestore = getFirestore(); } catch(e) {}

  let initialOffers: any[] = [];
  if (firestore) {
    const snapshot = await firestore.collection(app.appId).doc('ru').collection('loans').get();
    initialOffers = snapshot.docs.map(doc => {
      const data = doc.data();
      let slug = '';
      try { 
          const url = data.url || '';
          const urlObj = new URL(url);
          slug = urlObj.searchParams.get('aff_sub3') || ''; 
      } catch(e) {}
      
      const key = slug || doc.id;
      const ov = overrides.find((o: any) => o.offer_slug === key);
      
      return {
        slug: key,
        docId: doc.id,
        displayName: data.title || doc.id,
        currentPos: data[app.sortField],
        initialPos: data[app.sortField],
        isActive: data.active !== false,
        manualPin: ov?.manual_pin ?? null,
        autoPriority: ov?.auto_priority ?? null,
        hasSlug: !!slug
      };
    });

    initialOffers.sort((a, b) => a.currentPos - b.currentPos);
  }

  return (
    <div className="min-h-screen bg-white text-black p-8 font-sans">
      <div className="max-w-4xl mx-auto">
        <AdminNav />
        <Link href="/admin" className="text-blue-600 text-sm mb-4 inline-block">← Назад на дашборд</Link>
        <div className="mb-8 border-b-2 border-black pb-4 mt-4">
          <h1 className="text-4xl font-black uppercase tracking-tighter">Настройки: {app.name}</h1>
          <div className="flex gap-4 items-center mt-1">
             <p className="text-gray-400 font-mono text-sm uppercase tracking-widest">{app.appId}</p>
             <Link href={`/admin/stats/${app.appId}`} className="text-[10px] bg-gray-100 px-2 py-0.5 rounded font-black text-gray-500 hover:bg-black hover:text-white uppercase tracking-widest transition-all">Открыть статистику</Link>
          </div>
        </div>

        <OfferSettings 
          app={app} 
          initialOffers={initialOffers} 
          initialEpcMode={appConfig ? appConfig.epc_mode : 'global'} 
        />
      </div>
    </div>
  );
}

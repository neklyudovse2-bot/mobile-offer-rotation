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

  const lastSyncRes = await sql`
    SELECT MAX(synced_at) as last_sync, COUNT(*)::int as record_count 
    FROM keitaro_stats
  `;
  const lastSyncAt = lastSyncRes[0]?.last_sync 
    ? new Date(lastSyncRes[0].last_sync).toISOString() 
    : null;
  const recordCount = lastSyncRes[0]?.record_count || 0;

  const overrides = await sql`SELECT offer_slug, manual_pin, auto_priority, epc_mode FROM offer_overrides WHERE app_id = ${app.appId}`;
  const appConfig = overrides.find((o: any) => o.offer_slug === 'SYSTEM_DEFAULT');
  const epcMode = appConfig?.epc_mode || 'global';

  let firestore;
  try { firestore = getFirestore(); } catch(e) {}

  let epcStats;
  if (epcMode === 'per_app') {
    epcStats = await sql`SELECT offer_slug, epc FROM per_app_epc_7d WHERE app_name = ${app.name}`;
  } else {
    epcStats = await sql`SELECT offer_slug, epc FROM global_epc_7d`;
  }
  const epcMap = new Map(epcStats.map((s: any) => [s.offer_slug, parseFloat(s.epc)]));

  let initialOffers: any[] = [];
  if (firestore) {
    const snapshot = await firestore.collection(app.appId).doc('ru').collection('loans').get();
    initialOffers = snapshot.docs.map(doc => {
      const data = doc.data();
      let slug = '';
      try { 
          const urlField = data.url || '';
          const urlObj = new URL(urlField);
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
        epc: epcMap.get(slug) || 0,
        hasSlug: !!slug,
      };
    });

    initialOffers.sort((a, b) => a.currentPos - b.currentPos);
  }

  return (
    <div className="min-h-screen bg-[#f5f6f8] text-[#313a46]">
      <AdminNav lastSyncAt={lastSyncAt} recordCount={recordCount} />
      
      <main className="max-w-7xl mx-auto px-6 py-8">
        <OfferSettings 
          app={app} 
          initialOffers={initialOffers} 
          initialEpcMode={epcMode} 
        />
      </main>
    </div>
  );
}

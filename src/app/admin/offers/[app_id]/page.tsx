import { isAdminAuthenticated } from '@/lib/auth';
import Login from '@/components/Login';
import { APP_MAPPING } from '@/config/mapping';
import { sql } from '@/lib/db';
import { getFirestore } from '@/lib/firebase';
import AdminNav from '@/components/AdminNav';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { notFound } from 'next/navigation';
import OfferSettings from '@/components/OfferSettings';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function OffersAppPage({ params }: { params: Promise<{ app_id: string }> }) {
  const { app_id } = await params;
  const app = APP_MAPPING.find(a => a.appId === app_id);
  if (!app) notFound();

  let authenticated = false;
  try { authenticated = await isAdminAuthenticated(); } catch (e) {}
  if (!authenticated) return <Login />;

  const lastSyncRes = await sql`SELECT MAX(synced_at) as last_sync FROM keitaro_stats`;
  const lastSync = lastSyncRes[0]?.last_sync 
    ? new Date(lastSyncRes[0].last_sync).toLocaleString('ru-RU', { hour: '2-digit', minute: '2-digit' }) 
    : '—';

  const firestore = getFirestore();
  const snapshot = await firestore.collection(app.appId).doc('ru').collection('loans')
    .orderBy(app.sortField, 'asc').get();
  
  const overrides = await sql`
    SELECT offer_slug, manual_pin, auto_priority, epc_mode 
    FROM offer_overrides 
    WHERE app_id = ${app.appId}
  `;
  
  const epcModeRow = overrides.find((o: any) => o.offer_slug === 'SYSTEM_DEFAULT');
  const epcMode = epcModeRow?.epc_mode || 'global';

  const epcStats = epcMode === 'per_app'
    ? await sql`SELECT offer_slug, epc FROM per_app_epc_7d WHERE app_name = ${app.name}`
    : await sql`SELECT offer_slug, epc FROM global_epc_7d`;
  const epcMap = new Map(epcStats.map((s: any) => [s.offer_slug, parseFloat(s.epc)]));

  const initialOffers = snapshot.docs.map((doc, idx) => {
    const data = doc.data();
    let slug = '';
    let hasSlug = false;
    try { 
      slug = new URL(data.url).searchParams.get('aff_sub3') || ''; 
      hasSlug = !!slug;
    } catch(e) {}
    if (!slug) slug = doc.id;
    
    const ov = overrides.find((o: any) => o.offer_slug === slug);
    
    return {
      slug,
      hasSlug,
      docId: doc.id,
      displayName: data.title || slug,
      isActive: data.active !== false,
      manualPin: ov?.manual_pin ?? null,
      autoPriority: ov?.auto_priority ?? null,
      initialPos: idx + 1,
      currentPos: data[app.sortField] || idx + 1,
      epc: epcMap.get(slug) || 0,
    };
  });

  return (
    <div className="min-h-screen bg-white">
      <AdminNav lastSync={lastSync} />

      <main className="max-w-[1200px] mx-auto px-6 py-12">
        {/* Breadcrumbs */}
        <nav className="flex items-center gap-1.5 text-xs text-[#666] mb-4">
          <Link href="/admin" className="hover:text-black transition-colors">
            Приложения
          </Link>
          <ChevronRight className="w-3 h-3" />
          <span className="text-black">{app.name}</span>
        </nav>

        {/* Hero */}
        <div className="mb-10 flex items-end justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-3xl font-semibold text-black tracking-tight">
                {app.name}
              </h1>
              <span className="text-sm text-[#666] tabular-nums">
                {app.appId}
              </span>
            </div>
            <p className="text-sm text-[#666]">
              Управление офферами и приоритетами
            </p>
          </div>
          <Link 
            href={`/admin/stats/${app.appId}`}
            className="text-sm text-[#666] hover:text-black transition-colors"
          >
            Открыть статистику →
          </Link>
        </div>

        {/* Settings */}
        <OfferSettings 
          app={app}
          initialOffers={initialOffers}
          initialEpcMode={epcMode}
        />
      </main>
    </div>
  );
}

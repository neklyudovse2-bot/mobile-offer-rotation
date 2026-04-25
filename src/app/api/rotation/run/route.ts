import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getFirestore } from '@/lib/firebase';
import { APP_MAPPING } from '@/config/mapping';

export async function GET(request: Request) {
  return handleRequest(request);
}

export async function POST(request: Request) {
  return handleRequest(request);
}

async function handleRequest(request: Request) {
  const startTime = Date.now();
  const url = new URL(request.url);
  const appIdParam = url.searchParams.get('app_id');

  // Определяем источник: cron присылает заголовок или GET-запрос без параметров?
  // Согласно инструкции: GET === cron, POST === user
  const triggeredBy = request.headers.get('x-vercel-cron') || request.method === 'GET' ? 'cron' : 'user';

  try {
    const protocol = request.url.startsWith('https') ? 'https' : 'http';
    const host = request.headers.get('host');
    const syncRes = await fetch(`${protocol}://${host}/api/keitaro/sync`, { cache: 'no-store' });
    
    if (!syncRes.ok) {
      const errorData = await syncRes.json();
      throw new Error(`Keitaro sync failed: ${JSON.stringify(errorData)}`);
    }

    let firestore;
    try { firestore = getFirestore(); } catch (e: any) { 
        throw new Error(e.message);
    }

    const results: any[] = [];
    const appsToProcess = appIdParam ? APP_MAPPING.filter(a => a.appId === appIdParam) : APP_MAPPING;

    for (const app of appsToProcess) {
      const overrideModeRes = await sql`SELECT epc_mode FROM offer_overrides WHERE app_id = ${app.appId} AND offer_slug = 'SYSTEM_DEFAULT' LIMIT 1`;
      const epcMode = overrideModeRes[0]?.epc_mode || 'global';

      let epcStats;
      if (epcMode === 'per_app') {
        epcStats = await sql`SELECT offer_slug, epc FROM per_app_epc_7d WHERE app_name = ${app.name}`;
      } else {
        epcStats = await sql`SELECT offer_slug, epc FROM global_epc_7d`;
      }
      const epcMap = new Map(epcStats.map((s: any) => [s.offer_slug, parseFloat(s.epc)]));

      const loansRef = firestore.collection(app.appId).doc('ru').collection('loans');
      const snapshot = await loansRef.get();
      
      const offers = snapshot.docs.map(doc => {
        const data = doc.data();
        const urlField = data.url || '';
        let slug = '';
        try {
          const urlObj = new URL(urlField);
          slug = urlObj.searchParams.get('aff_sub3') || '';
        } catch (e) {}
        return { id: doc.id, slug, data, currentPos: data[app.sortField] || 999 };
      });

      const appOverrides = await sql`SELECT offer_slug, manual_pin, auto_priority FROM offer_overrides WHERE app_id = ${app.appId}`;
      const overridesMap = new Map(appOverrides.map((o: any) => [o.offer_slug, o]));

      const activeOffers = offers.filter(o => o.data.active !== false);

      const pinZone: any[] = [];
      const autoZone: any[] = [];
      const defaultZone: any[] = [];

      activeOffers.forEach(o => {
        const ov = overridesMap.get(o.slug || o.id);
        const epc = o.slug ? epcMap.get(o.slug) : null;

        if (ov?.manual_pin !== null && ov?.manual_pin !== undefined) {
          pinZone.push({ ...o, manual_pin: ov.manual_pin });
        } else if (o.slug && epc !== undefined && epc !== null) {
          autoZone.push({ ...o, epc });
        } else {
          defaultZone.push(o);
        }
      });

      pinZone.sort((a, b) => a.manual_pin - b.manual_pin);
      autoZone.sort((a, b) => b.epc - a.epc);

      // Сброс старых приоритетов
      await sql`UPDATE offer_overrides SET auto_priority = NULL WHERE app_id = ${app.appId}`;

      // Групповой auto_priority
      let priority = 0;
      let prevEpc: number | null = null;
      let counter = 0;

      for (const offer of autoZone) {
        counter++;
        if (offer.epc !== prevEpc) {
          priority = counter;
          prevEpc = offer.epc;
        }
        offer.auto_priority = priority;
      }

      for (const o of autoZone) {
        await sql`
          INSERT INTO offer_overrides (app_id, offer_slug, auto_priority)
          VALUES (${app.appId}, ${o.slug}, ${o.auto_priority})
          ON CONFLICT (app_id, offer_slug) DO UPDATE SET auto_priority = EXCLUDED.auto_priority
        `;
      }

      defaultZone.sort((a, b) => a.currentPos - b.currentPos);

      const finalList = [...pinZone, ...autoZone, ...defaultZone];
      const batch = firestore.batch();
      const reportOffers: any[] = [];

      finalList.forEach((o, index) => {
        const pos = index + 1;
        batch.update(loansRef.doc(o.id), { [app.sortField]: pos });
        reportOffers.push({ 
           slug: o.slug || o.data.title || o.id, 
           new_position: pos, 
           zone: o.manual_pin ? 'PIN' : (o.auto_priority ? 'AUTO' : 'DEFAULT'),
           epc: o.epc || 0,
           auto_priority: o.auto_priority || null
        });
      });

      await batch.commit();
      results.push({
        app_id: app.appId,
        sort_field: app.sortField,
        epc_mode: epcMode,
        offers: reportOffers
      });
    }

    // ЛОГИРОВАНИЕ УСПЕХА
    const durationMs = Date.now() - startTime;
    const totalOffersAffected = results.reduce((sum, app: any) => sum + (app.offers?.length || 0), 0);
    const epcModeForLog = appIdParam && results[0]?.epc_mode ? results[0].epc_mode : null;

    try {
      await sql`
        INSERT INTO rotation_history 
          (app_id, triggered_by, epc_mode, status, offers_affected, duration_ms)
        VALUES 
          (${appIdParam}, ${triggeredBy}, ${epcModeForLog}, 'success', ${totalOffersAffected}, ${durationMs})
      `;
    } catch (e) {
      console.error('[ROTATION] Failed to log history:', e);
    }

    return NextResponse.json({ ok: true, updated: results });

  } catch (error: any) {
    console.error('Rotation Error:', error);
    // ЛОГИРОВАНИЕ ОШИБКИ
    const durationMs = Date.now() - startTime;
    try {
      await sql`
        INSERT INTO rotation_history 
          (app_id, triggered_by, status, error_message, duration_ms)
        VALUES 
          (${appIdParam}, ${triggeredBy}, 'error', ${error.message}, ${durationMs})
      `;
    } catch (e) {
      console.error('[ROTATION] Failed to log error:', e);
    }
    
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}

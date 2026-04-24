import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getFirestore } from '@/lib/firebase';
import { APP_MAPPING } from '@/config/mapping';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const filterAppId = searchParams.get('app_id');

    const protocol = request.url.startsWith('https') ? 'https' : 'http';
    const host = request.headers.get('host');
    const syncUrl = `${protocol}://${host}/api/keitaro/sync`;
    const syncRes = await fetch(syncUrl, { cache: 'no-store' });
    
    if (!syncRes.ok) {
      const errorData = await syncRes.json();
      return NextResponse.json({ ok: false, error: 'Keitaro sync failed', details: errorData }, { status: 500 });
    }

    let firestore;
    try { firestore = getFirestore(); } catch (e: any) { 
        return NextResponse.json({ ok: false, error: e.message }); 
    }

    const results = [];
    const appsToProcess = filterAppId ? APP_MAPPING.filter(a => a.appId === filterAppId) : APP_MAPPING;

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
        const url = data.url || '';
        let slug = '';
        try {
          const urlObj = new URL(url);
          slug = urlObj.searchParams.get('aff_sub3') || '';
        } catch (e) {}
        return { id: doc.id, slug, data, currentPos: data[app.sortField] || 999 };
      });

      const appOverrides = await sql`SELECT offer_slug, manual_pin, auto_priority FROM offer_overrides WHERE app_id = ${app.appId}`;
      const overridesMap = new Map(appOverrides.map((o: any) => [o.offer_slug, o]));

      console.log('[ROTATION] overridesMap contents:');
      for (const [key, value] of (overridesMap as any).entries()) {
        console.log(` "${key}" -> manual_pin=${value.manual_pin} (type: ${typeof value.manual_pin}), auto_priority=${value.auto_priority}`);
      }

      const activeOffers = offers.filter(o => o.data.active !== false);
      
      console.log('[ROTATION] activeOffers slugs:');
      activeOffers.forEach(o => {
        console.log(` slug="${o.slug}", id="${o.id}"`);
      });

      const pinZone: any[] = [];
      const autoZone: any[] = [];
      const defaultZone: any[] = [];

      activeOffers.forEach(o => {
        const lookupKey = o.slug || o.id;
        const ov = overridesMap.get(lookupKey);
        const epc = o.slug ? epcMap.get(o.slug) : null;

        console.log(`[ZONE] "${o.slug}" lookup="${lookupKey}" override=${JSON.stringify(ov)} epc=${epc}`);

        if (ov?.manual_pin !== null && ov?.manual_pin !== undefined) {
          console.log(` -> PIN zone (pin=${ov.manual_pin})`);
          pinZone.push({ ...o, manual_pin: ov.manual_pin });
        } else if (o.slug && epc !== undefined && epc !== null) {
          console.log(` -> AUTO zone (epc=${epc})`);
          autoZone.push({ ...o, epc });
        } else {
          console.log(` -> DEFAULT zone`);
          defaultZone.push(o);
        }
      });

      pinZone.sort((a, b) => a.manual_pin - b.manual_pin);
      autoZone.sort((a, b) => b.epc - a.epc);
      
      autoZone.forEach((o, i) => {
        o.auto_priority = i + 1;
      });

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
           epc: o.epc || 0
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

    return NextResponse.json({ ok: true, updated: results });
  } catch (error: any) {
    console.error('Rotation Error:', error);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}

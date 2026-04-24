import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getFirestore } from '@/lib/firebase';
import { APP_MAPPING } from '@/config/mapping';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const filterAppId = searchParams.get('app_id');

    // 1. Синхронизация данных Keitaro (всегда для всех, чтобы были актуальные EPC)
    const protocol = request.url.startsWith('https') ? 'https' : 'http';
    const host = request.headers.get('host');
    const syncRes = await fetch(`${protocol}://${host}/api/keitaro/sync`, { cache: 'no-store' });
    
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
      // a. Режим EPC
      const overrideModeRes = await sql`SELECT epc_mode FROM offer_overrides WHERE app_id = ${app.appId} AND offer_slug = 'SYSTEM_DEFAULT' LIMIT 1`;
      const epcMode = overrideModeRes[0]?.epc_mode || 'global';

      // b. Статистика EPC
      let epcStats;
      if (epcMode === 'per_app') {
        epcStats = await sql`SELECT offer_slug, epc FROM per_app_epc_7d WHERE app_name = ${app.name}`;
      } else {
        epcStats = await sql`SELECT offer_slug, epc FROM global_epc_7d`;
      }
      const epcMap = new Map(epcStats.map((s: any) => [s.offer_slug, parseFloat(s.epc)]));

      // c. Firestore docs
      const loansRef = firestore.collection(app.appId).doc('ru').collection('loans');
      const snapshot = await loansRef.get();
      
      const offers = snapshot.docs.map(doc => {
        const data = doc.data();
        const url = data.url || '';
        let slug = '';
        try { slug = new URL(url).searchParams.get('aff_sub3') || ''; } catch (e) {}
        return { id: doc.id, slug, data, currentPos: data[app.sortField] || 999 };
      });

      // d. Overrides
      const appOverrides = await sql`SELECT offer_slug, manual_pin, auto_priority FROM offer_overrides WHERE app_id = ${app.appId}`;
      const overridesMap = new Map(appOverrides.map((o: any) => [o.offer_slug, o]));

      // e. Фильтрация и разделение на зоны
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

      // f. Сортировка и расчет приоритетов
      // 1. PIN-зона: по manual_pin ASC
      pinZone.sort((a, b) => a.manual_pin - b.manual_pin);

      // 2. AUTO-зона: по EPC DESC, затем присваиваем auto_priority
      autoZone.sort((a, b) => b.epc - a.epc);
      
      const autoUpdates = [];
      autoZone.forEach((o, i) => {
        o.auto_priority = i + 1;
        autoUpdates.push({ slug: o.slug, priority: o.auto_priority });
      });

      // Сохраняем auto_priority в БД (одной транзакцией или пачкой)
      if (autoUpdates.length > 0) {
          const queries = autoUpdates.map(u => sql`
            INSERT INTO offer_overrides (app_id, offer_slug, auto_priority)
            VALUES (${app.appId}, ${u.slug}, ${u.priority})
            ON CONFLICT (app_id, offer_slug) DO UPDATE SET auto_priority = EXCLUDED.auto_priority
          `);
          await sql.transaction(queries);
      }

      // 3. DEFAULT-зона: по текущей позиции в Firestore для стабильности
      defaultZone.sort((a, b) => a.currentPos - b.currentPos);

      // g. Склейка и обновление Firestore
      const finalList = [...pinZone, ...autoZone, ...defaultZone];
      const batch = firestore.batch();
      const reportOffers = [];

      finalList.forEach((o, index) => {
        const newPos = index + 1;
        batch.update(loansRef.doc(o.id), { [app.sortField]: newPos });
        reportOffers.push({ 
           slug: o.slug || o.data.title || o.id, 
           new_position: newPos, 
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

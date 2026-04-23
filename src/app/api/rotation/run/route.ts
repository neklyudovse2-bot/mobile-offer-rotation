import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getFirestore } from '@/lib/firebase';
import { APP_MAPPING } from '@/config/mapping';

export async function GET(request: Request) {
  try {
    const protocol = request.url.startsWith('https') ? 'https' : 'http';
    const host = request.headers.get('host');
    const syncRes = await fetch(`${protocol}://${host}/api/keitaro/sync`, { cache: 'no-store' });
    
    if (!syncRes.ok) {
      const errorData = await syncRes.json();
      return NextResponse.json({ ok: false, error: 'Keitaro sync failed', details: errorData }, { status: 500 });
    }

    let firestore;
    try {
      firestore = getFirestore();
    } catch (e: any) {
      return NextResponse.json({ ok: false, error: e.message });
    }

    const results = [];

    for (const app of APP_MAPPING) {
      const overrideModeRes = await sql`
        SELECT epc_mode FROM offer_overrides WHERE app_id = ${app.appId} LIMIT 1
      `;
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

        return { id: doc.id, slug, data };
      });

      const appOverrides = await sql`
        SELECT offer_slug, is_active, pinned_position FROM offer_overrides WHERE app_id = ${app.appId}
      `;
      const overridesMap = new Map(appOverrides.map((o: any) => [o.offer_slug, o]));

      const activeOffers: any[] = [];

      for (const o of offers) {
        const ov = overridesMap.get(o.slug || o.id); // Используем ID если слага нет для проверки оверрайда
        const isActive = ov ? ov.is_active : true;
        const pinnedPos = ov ? ov.pinned_position : null;
        const epc = o.slug ? (epcMap.get(o.slug) || 0) : -1; // -1 для офферов без слага для сортировки

        if (isActive) {
          activeOffers.push({ ...o, pinnedPos, epc });
        }
      }

      const allZeroEpc = activeOffers.length > 0 && activeOffers.every(o => o.epc <= 0);
      if (allZeroEpc) {
        results.push({ app_id: app.appId, skipped: true, reason: "all_epc_zero" });
        continue;
      }

      const pinned = activeOffers.filter(o => o.pinnedPos !== null);
      const sortable = activeOffers.filter(o => o.pinnedPos === null);

      // Сортировка: Сначала EPC (desc), пустые слаги всегда в конец
      sortable.sort((a, b) => {
        if (a.slug && !b.slug) return -1;
        if (!a.slug && b.slug) return 1;
        return b.epc - a.epc;
      });

      const finalOrdered = new Array(activeOffers.length).fill(null);
      
      pinned.forEach(o => {
        const pos = o.pinnedPos - 1;
        if (pos >= 0 && pos < finalOrdered.length) {
          finalOrdered[pos] = o;
        }
      });

      let sIdx = 0;
      for (let i = 0; i < finalOrdered.length; i++) {
        if (finalOrdered[i] === null && sIdx < sortable.length) {
          finalOrdered[i] = sortable[sIdx++];
        }
      }

      const resultList = finalOrdered.filter(o => o !== null);

      const batch = firestore.batch();
      const reportOffers: any[] = [];

      resultList.forEach((o, index) => {
        const pos = index + 1;
        batch.update(loansRef.doc(o.id), { [app.sortField]: pos });
        reportOffers.push({ slug: o.slug || o.data.title || o.id, new_position: pos, epc: o.epc });
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

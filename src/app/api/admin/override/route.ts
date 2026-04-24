import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { sql } from '@/lib/db';
import { getFirestore } from '@/lib/firebase';

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const password = process.env.ADMIN_PASSWORD;
  
  if (!password) {
    return NextResponse.json({ error: 'ADMIN_PASSWORD not configured' }, { status: 500 });
  }

  const session = cookieStore.get('admin_session')?.value;
  if (session !== password) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { app_id, offer_slug, doc_id, is_active, manual_pin, epc_mode } = await request.json();

    if (!app_id) {
       return NextResponse.json({ error: 'app_id is required' }, { status: 400 });
    }

    let firestore;
    try { firestore = getFirestore(); } catch(e) {}

    if (typeof is_active === 'boolean' && doc_id && firestore) {
      const loanRef = firestore.collection(app_id).doc('ru').collection('loans').doc(doc_id);
      await loanRef.update({ active: is_active });
    }

    if (epc_mode) {
      await sql`
        INSERT INTO offer_overrides (app_id, offer_slug, epc_mode)
        VALUES (${app_id}, 'SYSTEM_DEFAULT', ${epc_mode})
        ON CONFLICT (app_id, offer_slug) DO UPDATE SET epc_mode = EXCLUDED.epc_mode
      `;
    }

    if (offer_slug && offer_slug !== 'SYSTEM_DEFAULT' && manual_pin !== undefined) {
      console.log('[OVERRIDE] entering manual_pin block', { app_id, offer_slug, manual_pin, type: typeof manual_pin });

      if (manual_pin !== null) {
        const existing = await sql`
          SELECT offer_slug FROM offer_overrides 
          WHERE app_id = ${app_id} AND manual_pin = ${manual_pin} AND offer_slug != ${offer_slug}
        `;
        console.log('[OVERRIDE] duplicate check result:', existing);
        if (existing.length > 0) {
          return NextResponse.json({ 
            error: `Позиция ${manual_pin} уже занята оффером ${existing[0].offer_slug}` 
          }, { status: 400 });
        }
      }

      console.log('[OVERRIDE] executing INSERT...');
      const insertResult = await sql`
        INSERT INTO offer_overrides (app_id, offer_slug, manual_pin)
        VALUES (${app_id}, ${offer_slug}, ${manual_pin})
        ON CONFLICT (app_id, offer_slug) DO UPDATE SET 
          manual_pin = EXCLUDED.manual_pin
        RETURNING *
      `;
      console.log('[OVERRIDE] INSERT result:', insertResult);

      const verify = await sql`
        SELECT manual_pin FROM offer_overrides 
        WHERE app_id = ${app_id} AND offer_slug = ${offer_slug}
      `;
      console.log('[OVERRIDE] verify after INSERT:', verify);
    }

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

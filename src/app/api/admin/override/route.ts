import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { sql } from '@/lib/db';
import { getLoansCollection } from '@/lib/firebase';

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
    const body = await request.json();
    const { app_id, offer_slug, doc_id, is_active, manual_pin, epc_mode } = body;

    console.log('[OVERRIDE] START', JSON.stringify(body));

    if (!app_id) {
       console.log('[OVERRIDE] ERROR: app_id is missing');
       return NextResponse.json({ error: 'app_id is required' }, { status: 400 });
    }

    // 1. Обработка активности оффера
    if (typeof is_active === 'boolean' && doc_id) {
      console.log('[OVERRIDE] updating Firestore activity:', { doc_id, is_active });
      const loanRef = getLoansCollection(app_id).doc(doc_id);
      await loanRef.update({ active: is_active });
    }

    // 2. Обработка режима EPC
    if (epc_mode) {
      console.log('[OVERRIDE] updating epc_mode in Postgres:', epc_mode);
      const res = await sql`
        INSERT INTO offer_overrides (app_id, offer_slug, epc_mode)
        VALUES (${app_id}, 'SYSTEM_DEFAULT', ${epc_mode})
        ON CONFLICT (app_id, offer_slug) DO UPDATE SET epc_mode = EXCLUDED.epc_mode
        RETURNING *
      `;
      console.log('[OVERRIDE] epc_mode update result:', JSON.stringify(res));
    }

    // 3. Обработка Manual PIN
    if (offer_slug && offer_slug !== 'SYSTEM_DEFAULT' && manual_pin !== undefined) {
      console.log('[OVERRIDE] before manual_pin property check, value:', manual_pin, 'type:', typeof manual_pin);

      if (manual_pin !== null) {
        const existing = await sql`
          SELECT offer_slug FROM offer_overrides 
          WHERE app_id = ${app_id} AND manual_pin = ${manual_pin} AND offer_slug != ${offer_slug}
        `;
        console.log('[OVERRIDE] duplicate check result:', JSON.stringify(existing));
        if (existing.length > 0) {
          console.log('[OVERRIDE] ERROR: manual_pin duplicate found');
          return NextResponse.json({ 
            error: `Позиция ${manual_pin} уже занята оффером ${existing[0].offer_slug}` 
          }, { status: 400 });
        }
      }

      console.log('[OVERRIDE] before manual_pin INSERT, value:', manual_pin);
      const insertResult = await sql`
        INSERT INTO offer_overrides (app_id, offer_slug, manual_pin)
        VALUES (${app_id}, ${offer_slug}, ${manual_pin})
        ON CONFLICT (app_id, offer_slug) DO UPDATE SET 
          manual_pin = EXCLUDED.manual_pin
        RETURNING *
      `;
      console.log('[OVERRIDE] INSERT result:', JSON.stringify(insertResult));

      const verification = await sql`
        SELECT * FROM offer_overrides 
        WHERE app_id = ${app_id} AND offer_slug = ${offer_slug}
      `;
      console.log('[OVERRIDE] verification query result:', JSON.stringify(verification));
    }

    console.log('[OVERRIDE] END');
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error('[OVERRIDE] CRASH:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

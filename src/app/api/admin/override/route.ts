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
    const { app_id, offer_slug, doc_id, is_active, pinned_position, epc_mode } = await request.json();

    if (!app_id) {
       return NextResponse.json({ error: 'app_id is required' }, { status: 400 });
    }

    let firestore;
    try { firestore = getFirestore(); } catch(e) {}

    // 1. Обновляем статус активности напрямую в Firestore (если передан)
    if (typeof is_active === 'boolean' && doc_id && firestore) {
      const loanRef = firestore.collection(app_id).doc('ru').collection('loans').doc(doc_id);
      await loanRef.update({ active: is_active });
    }

    // 2. Обновляем epc_mode в Postgres
    if (epc_mode) {
      await sql`
        INSERT INTO offer_overrides (app_id, offer_slug, epc_mode)
        VALUES (${app_id}, 'SYSTEM_DEFAULT', ${epc_mode})
        ON CONFLICT (app_id, offer_slug) DO UPDATE SET epc_mode = EXCLUDED.epc_mode
      `;
    }

    // 3. Обновляем pinned_position в Postgres
    if (offer_slug && offer_slug !== 'SYSTEM_DEFAULT' && pinned_position !== undefined) {
      await sql`
        INSERT INTO offer_overrides (app_id, offer_slug, pinned_position)
        VALUES (${app_id}, ${offer_slug}, ${pinned_position ?? null})
        ON CONFLICT (app_id, offer_slug) DO UPDATE SET 
          pinned_position = EXCLUDED.pinned_position
      `;
    }

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

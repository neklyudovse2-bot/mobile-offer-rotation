import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { sql } from '@/lib/db';

export async function POST(request: Request) {
  const cookieStore = cookies();
  const password = process.env.ADMIN_PASSWORD;
  
  if (!password) {
    return NextResponse.json({ error: 'ADMIN_PASSWORD not configured' }, { status: 500 });
  }

  const session = cookieStore.get('admin_session')?.value;
  if (session !== password) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { app_id, offer_slug, is_active, pinned_position, epc_mode } = await request.json();

    if (!app_id) {
       return NextResponse.json({ error: 'app_id is required' }, { status: 400 });
    }

    if (epc_mode) {
      await sql`
        INSERT INTO offer_overrides (app_id, offer_slug, epc_mode)
        VALUES (${app_id}, 'SYSTEM_DEFAULT', ${epc_mode})
        ON CONFLICT (app_id, offer_slug) DO UPDATE SET epc_mode = EXCLUDED.epc_mode
      `;
    }

    if (offer_slug && offer_slug !== 'SYSTEM_DEFAULT') {
      await sql`
        INSERT INTO offer_overrides (app_id, offer_slug, is_active, pinned_position)
        VALUES (${app_id}, ${offer_slug}, ${is_active ?? true}, ${pinned_position ?? null})
        ON CONFLICT (app_id, offer_slug) DO UPDATE SET 
          is_active = COALESCE(EXCLUDED.is_active, offer_overrides.is_active),
          pinned_position = EXCLUDED.pinned_position
      `;
    }

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

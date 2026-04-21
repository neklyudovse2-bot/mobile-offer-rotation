import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  
  const app_name = searchParams.get('app_name');
  const offer_slug = searchParams.get('offer_slug');
  const click_id = searchParams.get('click_id');

  if (!app_name || !offer_slug) {
    return NextResponse.json({ error: 'app_name and offer_slug are required' }, { status: 400 });
  }

  try {
    await sql`
      INSERT INTO clicks (app_name, offer_slug, click_id)
      VALUES (${app_name}, ${offer_slug}, ${click_id})
    `;

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error('Click logging error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

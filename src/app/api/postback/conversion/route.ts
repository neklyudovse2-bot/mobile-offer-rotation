import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  
  const app_name = searchParams.get('app_name');
  const offer_slug = searchParams.get('offer_slug');
  const revenue = searchParams.get('revenue');
  const status = searchParams.get('status');
  const click_id = searchParams.get('click_id');

  if (!app_name || !offer_slug) {
    return NextResponse.json({ error: 'app_name and offer_slug are required' }, { status: 400 });
  }

  try {
    const raw_params = Object.fromEntries(searchParams.entries());
    
    await sql`
      INSERT INTO conversions (app_name, offer_slug, revenue, status, click_id, raw_params)
      VALUES (${app_name}, ${offer_slug}, ${revenue ? parseFloat(revenue) : 0}, ${status}, ${click_id}, ${JSON.stringify(raw_params)})
    `;

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error('Conversion logging error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

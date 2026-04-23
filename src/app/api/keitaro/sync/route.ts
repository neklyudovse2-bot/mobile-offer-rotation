import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { APP_MAPPING } from '@/config/mapping';

export async function GET() {
  const apiKey = (process.env.KEITARO_API_KEY || '').trim();
  const baseUrl = (process.env.KEITARO_URL || '').trim();
  const timezone = (process.env.KEITARO_TIMEZONE || 'Asia/Yekaterinburg').trim();

  // Вычисляем даты в timezone Asia/Yekaterinburg (UTC+5) через стандартный JS
  const now = new Date();
  const yektNow = new Date(now.getTime() + 5 * 60 * 60 * 1000); // UTC+5
  const toDate = yektNow.toISOString().slice(0, 10); // YYYY-MM-DD

  const fromDateObj = new Date(yektNow);
  fromDateObj.setDate(fromDateObj.getDate() - 7);
  const fromDate = fromDateObj.toISOString().slice(0, 10);

  const to = toDate;
  const from = fromDate;

  try {
    const timestamp = new Date().toISOString();
    const appsSynced = [];
    const allDataToInsert: any[] = [];

    for (const app of APP_MAPPING) {
      const url = `${baseUrl}/admin_api/v1/report/build`;
      const headers = {
        'Api-Key': apiKey,
        'Content-Type': 'application/json'
      };
      const body = {
        range: { from, to, timezone },
        grouping: ['sub_id_3'],
        metrics: ['clicks', 'conversions', 'revenue'],
        filters: [{ name: 'campaign_id', operator: 'equals', expression: app.campaignId.toString() }]
      };

      const response = await fetch(url, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(body)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Keitaro API error for ${app.name}: ${errorText}`);
      }

      const data = await response.json();
      
      for (const row of data.rows) {
        allDataToInsert.push({
          app_name: app.name,
          offer_slug: row.sub_id_3,
          clicks: parseInt(row.clicks) || 0,
          conversions: parseInt(row.conversions) || 0,
          revenue: parseFloat(row.revenue) || 0
        });
      }

      appsSynced.push({ app_name: app.name, rows_synced: data.rows.length });
    }

    if (allDataToInsert.length > 0) {
      const queries = allDataToInsert.map(row => sql`
        INSERT INTO keitaro_stats (synced_at, app_name, offer_slug, date_from, date_to, clicks, conversions, revenue)
        VALUES (${timestamp}, ${row.app_name}, ${row.offer_slug}, ${from}, ${to}, ${row.clicks}, ${row.conversions}, ${row.revenue})
      `);
      
      await sql.transaction(queries);
    }

    return NextResponse.json({
      ok: true,
      synced_at: timestamp,
      date_range: { from, to },
      apps: appsSynced
    });
  } catch (error: any) {
    console.error('Sync error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { APP_MAPPING } from '@/config/mapping';
import { DateTime } from 'luxon';

export async function GET() {
  const apiKey = process.env.KEITARO_API_KEY;
  const baseUrl = process.env.KEITARO_URL;
  const timezone = process.env.KEITARO_TIMEZONE || 'Asia/Yekaterinburg';

  const to = DateTime.now().setZone(timezone).toFormat('yyyy-MM-dd');
  const from = DateTime.now().setZone(timezone).minus({ days: 7 }).toFormat('yyyy-MM-dd');

  try {
    const timestamp = new Date().toISOString();
    const appsSynced = [];

    // We'll collect all rows and insert them in a single batch/transaction simulated way with neon
    // since we want "one transaction" as per instructions.
    
    const allDataToInsert = [];

    for (const app of APP_MAPPING) {
      const response = await fetch(`${baseUrl}/admin_api/v1/report/build`, {
        method: 'POST',
        headers: {
          'Api-Key': apiKey!,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          range: { from, to, timezone },
          grouping: ['sub_id_3'],
          metrics: ['clicks', 'conversions', 'revenue'],
          filters: [{ name: 'campaign_id', operator: 'equals', expression: app.campaignId.toString() }]
        })
      });

      if (!response.ok) {
        throw new Error(`Keitaro API error for ${app.name}: ${await response.text()}`);
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

    // Single transaction for Neon:
    await sql.transaction(async (tx) => {
      for (const row of allDataToInsert) {
        await tx`
          INSERT INTO keitaro_stats (synced_at, app_name, offer_slug, date_from, date_to, clicks, conversions, revenue)
          VALUES (${timestamp}, ${row.app_name}, ${row.offer_slug}, ${from}, ${to}, ${row.clicks}, ${row.conversions}, ${row.revenue})
        `;
      }
    });

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

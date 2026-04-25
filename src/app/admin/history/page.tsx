import { isAdminAuthenticated } from '@/lib/auth';
import Login from '@/components/Login';
import { sql } from '@/lib/db';
import AdminNav from '@/components/AdminNav';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function HistoryPage() {
  let authenticated = false;
  try { authenticated = await isAdminAuthenticated(); } catch (e) {}
  if (!authenticated) return <Login />;

  const lastSyncRes = await sql`
    SELECT MAX(synced_at) as last_sync, COUNT(*)::int as record_count 
    FROM keitaro_stats
  `;
  const lastSyncAt = lastSyncRes[0]?.last_sync 
    ? new Date(lastSyncRes[0].last_sync).toISOString() 
    : null;
  const recordCount = lastSyncRes[0]?.record_count || 0;

  const history = await sql`
    SELECT * FROM rotation_history 
    ORDER BY created_at DESC 
    LIMIT 20
  `;

  return (
    <div className="min-h-screen bg-white">
      <AdminNav lastSyncAt={lastSyncAt} recordCount={recordCount} />

      <main className="max-w-[1200px] mx-auto px-6 py-12 text-black">
        <div className="mb-10">
          <h1 className="text-3xl font-semibold text-black tracking-tight mb-2">
            История
          </h1>
          <p className="text-sm text-[#666]">
            Лог последних 20 запусков ротации
          </p>
        </div>

        <div className="border border-[#eaeaea] rounded-md overflow-hidden bg-white shadow-sm">
          {history.length > 0 ? (
            <table className="w-full text-left text-sm">
              <thead className="bg-[#fafafa] border-b border-[#eaeaea]">
                <tr className="text-xs text-[#666] uppercase tracking-wider font-medium">
                  <th className="px-6 py-4">Дата</th>
                  <th className="px-6 py-4">Приложение</th>
                  <th className="px-6 py-4">Тип</th>
                  <th className="px-6 py-4">Результат</th>
                  <th className="px-6 py-4 text-right">Время</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#eaeaea]">
                {history.map((h: any) => (
                  <tr key={h.id} className="hover:bg-[#fafafa] transition-colors">
                    <td className="px-6 py-4 tabular-nums">
                      {new Date(h.created_at).toLocaleString('ru-RU')}
                    </td>
                    <td className="px-6 py-4">
                      {h.app_id || 'Все приложения'}
                    </td>
                    <td className="px-6 py-4">
                      <span className="capitalize">{h.triggered_by}</span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${h.status === 'success' ? 'bg-[#0070f3]' : 'bg-[#ee0000]'}`} />
                        {h.status === 'success' ? (
                          <span>Успех ({h.offers_affected} офферов)</span>
                        ) : (
                          <span className="text-[#ee0000]">{h.error_message}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right tabular-nums text-[#666]">
                      {h.duration_ms} мс
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="py-20 text-center text-[#999]">
              История пуста
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

import { isAdminAuthenticated } from '@/lib/auth';
import Login from '@/components/Login';
import { sql } from '@/lib/db';
import AdminNav from '@/components/AdminNav';
import { Clock, User } from 'lucide-react';

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
                <tr className="text-[11px] font-bold text-[#666] uppercase tracking-wider">
                  <th className="px-6 py-4">Дата</th>
                  <th className="px-6 py-4">Приложение</th>
                  <th className="px-6 py-4">Тип</th>
                  <th className="px-6 py-4 text-center">EPC mode</th>
                  <th className="px-6 py-4 text-center">Офферов</th>
                  <th className="px-6 py-4 text-center">Время</th>
                  <th className="px-6 py-4 text-right">Статус</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#eaeaea]">
                {history.map((h: any) => (
                  <tr key={h.id} className="hover:bg-[#fafafa] transition-colors">
                    <td className="px-6 py-4 tabular-nums text-[#666]">
                      {new Date(h.created_at).toLocaleString('ru-RU')}
                    </td>
                    <td className="px-6 py-4 font-medium">
                      {h.app_id || 'Все приложения'}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 text-[#666]">
                        {h.triggered_by === 'cron' ? (
                          <><Clock className="w-3.5 h-3.5" /> Cron</>
                        ) : (
                          <><User className="w-3.5 h-3.5" /> Ручной</>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center text-[#666] text-xs font-mono">
                      {h.epc_mode || '—'}
                    </td>
                    <td className="px-6 py-4 text-center tabular-nums font-medium">
                      {h.offers_affected}
                    </td>
                    <td className="px-6 py-4 text-center tabular-nums text-[#666]">
                      {h.duration_ms} мс
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {h.status === 'success' ? (
                          <span className="text-[#0070f3] font-medium flex items-center gap-1.5">
                            <div className="w-1.5 h-1.5 rounded-full bg-[#0070f3]" />
                            Успех
                          </span>
                        ) : (
                          <span className="text-[#ee0000] font-medium flex items-center gap-1.5">
                            <div className="w-1.5 h-1.5 rounded-full bg-[#ee0000]" />
                            Ошибка
                          </span>
                        )}
                      </div>
                      {h.error_message && (
                        <div className="text-[10px] text-[#ee0000] mt-1 max-w-[200px] truncate">
                          {h.error_message}
                        </div>
                      )}
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

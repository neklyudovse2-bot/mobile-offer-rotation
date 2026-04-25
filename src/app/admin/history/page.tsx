import { isAdminAuthenticated } from '@/lib/auth';
import Login from '@/components/Login';
import { sql } from '@/lib/db';
import AdminNav from '@/components/AdminNav';
import { APP_MAPPING } from '@/config/mapping';
import { CheckCircle2, XCircle, User, Clock } from 'lucide-react';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface HistoryRow {
  id: number;
  app_id: string | null;
  triggered_by: string;
  epc_mode: string | null;
  status: string;
  error_message: string | null;
  offers_affected: number;
  duration_ms: number | null;
  created_at: string;
}

export default async function HistoryPage() {
  let authenticated = false;
  try { authenticated = await isAdminAuthenticated(); } catch (e) {}
  if (!authenticated) return <Login />;

  const lastSyncRes = await sql`SELECT MAX(synced_at) as last_sync FROM keitaro_stats`;
  const lastSync = lastSyncRes[0]?.last_sync 
    ? new Date(lastSyncRes[0].last_sync).toLocaleString('ru-RU', { hour: '2-digit', minute: '2-digit' }) 
    : '—';

  // Last 20 history records
  const history: HistoryRow[] = await sql`
    SELECT id, app_id, triggered_by, epc_mode, status, error_message, 
           offers_affected, duration_ms, created_at
    FROM rotation_history
    ORDER BY created_at DESC
    LIMIT 20
  ` as any;

  const getAppName = (appId: string | null) => {
    if (!appId) return 'Все приложения';
    const app = APP_MAPPING.find(a => a.appId === appId);
    return app ? `${app.name} (${app.appId})` : appId;
  };

  const formatDuration = (ms: number | null) => {
    if (!ms) return '—';
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  return (
    <div className="min-h-screen bg-white">
      <AdminNav lastSync={lastSync} />

      <main className="max-w-[1200px] mx-auto px-6 py-12">
        {/* Hero */}
        <div className="mb-10">
          <h1 className="text-3xl font-semibold text-black tracking-tight mb-2">
            История пересчётов
          </h1>
          <p className="text-sm text-[#666]">
            Последние 20 операций · ручные и автоматические запуски
          </p>
        </div>

        {/* Empty state */}
        {history.length === 0 ? (
          <div className="border border-[#eaeaea] rounded-md bg-white p-12 text-center">
            <Clock className="w-8 h-8 text-[#999] mx-auto mb-3" />
            <h3 className="text-sm font-medium text-black mb-1">
              История пуста
            </h3>
            <p className="text-xs text-[#666]">
              После первого пересчёта здесь появятся записи
            </p>
          </div>
        ) : (
          <div className="border border-[#eaeaea] rounded-md bg-white overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#eaeaea] bg-[#fafafa]">
                  <th className="px-5 py-3 text-left text-[11px] font-medium 
                                 text-[#666] uppercase tracking-wider">
                    Время
                  </th>
                  <th className="px-5 py-3 text-left text-[11px] font-medium 
                                 text-[#666] uppercase tracking-wider">
                    Приложение
                  </th>
                  <th className="px-5 py-3 text-center text-[11px] font-medium 
                                 text-[#666] uppercase tracking-wider w-32">
                    Источник
                  </th>
                  <th className="px-5 py-3 text-center text-[11px] font-medium 
                                 text-[#666] uppercase tracking-wider w-28">
                    EPC mode
                  </th>
                  <th className="px-5 py-3 text-right text-[11px] font-medium 
                                 text-[#666] uppercase tracking-wider w-28">
                    Офферов
                  </th>
                  <th className="px-5 py-3 text-right text-[11px] font-medium 
                                 text-[#666] uppercase tracking-wider w-28">
                    Время
                  </th>
                  <th className="px-5 py-3 text-center text-[11px] font-medium 
                                 text-[#666] uppercase tracking-wider w-32">
                    Статус
                  </th>
                </tr>
              </thead>
              <tbody>
                {history.map((row) => (
                  <tr 
                    key={row.id}
                    className="border-b border-[#eaeaea] last:border-b-0 
                               hover:bg-[#fafafa] transition-colors"
                  >
                    <td className="px-5 py-3 text-sm text-black tabular-nums">
                      {formatDate(row.created_at)}
                    </td>
                    <td className="px-5 py-3 text-sm text-black">
                      {getAppName(row.app_id)}
                    </td>
                    <td className="px-5 py-3 text-center">
                      <span className="inline-flex items-center gap-1.5 text-xs text-[#666]">
                        {row.triggered_by === 'user' ? (
                          <>
                            <User className="w-3 h-3" />
                            Ручной
                          </>
                        ) : (
                          <>
                            <Clock className="w-3 h-3" />
                            Cron
                          </>
                        )}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-center text-xs text-[#666]">
                      {row.epc_mode || '—'}
                    </td>
                    <td className="px-5 py-3 text-right text-sm text-black tabular-nums">
                      {row.offers_affected || '—'}
                    </td>
                    <td className="px-5 py-3 text-right text-sm text-[#666] tabular-nums">
                      {formatDuration(row.duration_ms)}
                    </td>
                    <td className="px-5 py-3 text-center">
                      {row.status === 'success' ? (
                        <span className="inline-flex items-center gap-1.5 text-xs 
                                         text-black font-medium">
                          <CheckCircle2 className="w-3.5 h-3.5 text-[#0070f3]" />
                          Успех
                        </span>
                      ) : (
                        <span 
                          className="inline-flex items-center gap-1.5 text-xs 
                                     text-[#ee0000] font-medium cursor-help"
                          title={row.error_message || 'Неизвестная ошибка'}
                        >
                          <XCircle className="w-3.5 h-3.5" />
                          Ошибка
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Info */}
        <p className="text-xs text-[#999] mt-4">
          Показаны последние 20 пересчётов. Старые записи автоматически архивируются.
        </p>
      </main>
    </div>
  );
}

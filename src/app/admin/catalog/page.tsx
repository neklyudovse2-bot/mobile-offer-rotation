import { isAdminAuthenticated } from '@/lib/auth';
import Login from '@/components/Login';
import { APP_MAPPING } from '@/config/mapping';
import { sql } from '@/lib/db';
import {
  countPlacementsByApps,
  getCatalogOffersCount,
} from '@/lib/catalog/db';
import Link from 'next/link';
import AdminNav from '@/components/AdminNav';
import { ArrowRight } from 'lucide-react';

/**
 * Главная страница каталога.
 *
 * Показывает сетку из 9 карточек приложений (как на /admin),
 * под каждой — счётчик «X из Y добавлено», где X — число
 * активных раскладок этого приложения в catalog_offer_placements,
 * Y — общее число офферов в catalog_offers.
 *
 * Кнопок действий пока нет — это скелет Этапа 4.1.
 */

// Кэш на 60 секунд, как на /admin. После действий в каталоге
// (когда добавим в Этапе 4.3) будем явно вызывать
// revalidatePath('/admin/catalog').
export const revalidate = 60;

export default async function CatalogPage() {
  let authenticated = false;
  try {
    authenticated = await isAdminAuthenticated();
  } catch (e) {}
  if (!authenticated) return <Login />;

  // Для sync-индикатора в шапке — те же данные что на /admin.
  const lastSyncRes = await sql`
    SELECT MAX(synced_at) as last_sync, COUNT(*)::int as record_count
    FROM keitaro_stats
  `;
  const lastSyncAt = lastSyncRes[0]?.last_sync
    ? new Date(lastSyncRes[0].last_sync as string | Date).toISOString()
    : null;
  const recordCount = (lastSyncRes[0]?.record_count as number) || 0;

  // Загрузка данных каталога.
  const [placementCounts, totalOffers] = await Promise.all([
    countPlacementsByApps(),
    getCatalogOffersCount(),
  ]);

  return (
    <div className="min-h-screen bg-white">
      <AdminNav lastSyncAt={lastSyncAt} recordCount={recordCount} />

      <main className="max-w-[1200px] mx-auto px-6 py-10">
        <div className="mb-8">
          <h1 className="text-3xl font-semibold text-black">
            Каталог офферов
          </h1>
          <p className="mt-2 text-sm text-[#666]">
            Управление офферами и их раскладкой по приложениям.
            Всего в каталоге: {totalOffers} офферов.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {APP_MAPPING.map((app) => {
            const placed = placementCounts.get(app.appId) ?? 0;
            return (
              <Link
                key={app.appId}
                href={`/admin/catalog/${app.appId}`}
                className="
                  group block rounded-md border border-[#eaeaea] bg-white
                  p-5 transition-colors hover:border-black
                "
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-base font-medium text-black truncate">
                      {app.name}
                    </div>
                    <div className="mt-1 text-xs text-[#666]">
                      {app.appId}
                    </div>
                  </div>
                  <ArrowRight
                    className="
                      w-4 h-4 text-[#999] shrink-0 mt-1
                      transition-colors group-hover:text-black
                    "
                  />
                </div>

                <div className="mt-5 text-sm text-[#666]">
                  <span className="text-black font-medium">
                    {placed}
                  </span>{' '}
                  из {totalOffers} добавлено
                </div>
              </Link>
            );
          })}
        </div>
      </main>
    </div>
  );
}

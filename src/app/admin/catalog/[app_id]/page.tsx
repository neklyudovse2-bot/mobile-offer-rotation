import { isAdminAuthenticated } from '@/lib/auth';
import Login from '@/components/Login';
import { APP_MAPPING } from '@/config/mapping';
import { sql } from '@/lib/db';
import { getLoansCollection, extractSlug } from '@/lib/firebase';
import {
  listCatalogOffers,
  listPlacementsByApp,
} from '@/lib/catalog/db';
import AdminNav from '@/components/AdminNav';
import AppCatalogTable, {
  type CatalogRow,
  type OutsideCatalogRow,
} from '@/components/catalog/AppCatalogTable';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { notFound } from 'next/navigation';

/**
 * Страница приложения в каталоге.
 *
 * Показывает таблицу всех 28 офферов каталога для конкретного
 * приложения + дополнительный раздел снизу с офферами, которые
 * есть в Firestore этого приложения, но не входят в каталог.
 *
 * На этом этапе (4.2) — ТОЛЬКО ПРОСМОТР. Кнопки действий
 * («Разложить», «Редактировать») — заглушки. Реальная запись
 * в Firestore будет добавлена в Этапе 4.3.
 */

// Динамический рендеринг, без кэша — данные могут меняться часто
// (после Этапа 4.3 правки будут уезжать в Firestore сразу при
// "Применить", и страница должна показывать актуальное состояние).
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function CatalogAppPage({
  params,
}: {
  params: Promise<{ app_id: string }>;
}) {
  const { app_id } = await params;
  const app = APP_MAPPING.find((a) => a.appId === app_id);
  if (!app) notFound();

  let authenticated = false;
  try {
    authenticated = await isAdminAuthenticated();
  } catch (e) {}
  if (!authenticated) return <Login />;

  // sync-индикатор как везде
  const lastSyncRes = await sql`
    SELECT MAX(synced_at) as last_sync, COUNT(*)::int as record_count
    FROM keitaro_stats
  `;
  const lastSyncAt = lastSyncRes[0]?.last_sync
    ? new Date(lastSyncRes[0].last_sync as string | Date).toISOString()
    : null;
  const recordCount = (lastSyncRes[0]?.record_count as number) || 0;

  // Параллельно: офферы каталога, раскладки этого приложения,
  // документы Firestore этого приложения.
  const [catalogOffers, placements, firestoreSnap] = await Promise.all([
    listCatalogOffers(),
    listPlacementsByApp(app.appId),
    getLoansCollection(app.appId).get(),
  ]);

  // Индекс slug -> CatalogOffer
  const offerBySlug = new Map(catalogOffers.map((o) => [o.slug, o]));
  // Индекс slug -> Placement (для этого приложения)
  const placementBySlug = new Map(placements.map((p) => [p.slug, p]));

  // Группируем документы Firestore по slug.
  // У одного slug может быть несколько документов (дубль) —
  // храним массив, чтобы потом пометить флагом `is_duplicate`.
  type FsDoc = {
    doc_id: string;
    slug: string | null;
    title: string | null;
    url_field_name: 'url' | 'site' | null;
    url_value: string | null;
    active: boolean | null;
  };
  const fsAll: FsDoc[] = [];
  firestoreSnap.docs.forEach((doc) => {
    const data = doc.data() as Record<string, unknown>;
    const slug = extractSlug(data) || null;
    const url =
      (typeof data.url === 'string' && data.url) ||
      (typeof data.site === 'string' && data.site) ||
      null;
    const urlFieldName: 'url' | 'site' | null =
      typeof data.url === 'string' && data.url
        ? 'url'
        : typeof data.site === 'string' && data.site
        ? 'site'
        : null;
    fsAll.push({
      doc_id: doc.id,
      slug,
      title: typeof data.title === 'string' ? data.title : null,
      url_field_name: urlFieldName,
      url_value: url,
      active: typeof data.active === 'boolean' ? data.active : null,
    });
  });

  const fsBySlug = new Map<string, FsDoc[]>();
  for (const d of fsAll) {
    if (!d.slug) continue;
    const arr = fsBySlug.get(d.slug) ?? [];
    arr.push(d);
    fsBySlug.set(d.slug, arr);
  }

  // Главные строки таблицы — по каждому офферу каталога.
  const catalogRows: CatalogRow[] = catalogOffers.map((offer) => {
    const placement = placementBySlug.get(offer.slug) || null;
    const fsDocs = fsBySlug.get(offer.slug) || [];
    const isDuplicate = fsDocs.length > 1;

    // Определяем статус
    let status: CatalogRow['status'];
    if (placement && placement.enabled) {
      status = 'placed';
    } else if (placement && !placement.enabled) {
      status = 'hidden_in_catalog';
    } else if (fsDocs.length > 0) {
      // В Firestore есть документ с таким slug, но в каталоге его нет
      // (или есть, но не привязан) — каталог им не управляет.
      status = 'outside_catalog';
    } else {
      status = 'not_placed';
    }

    return {
      slug: offer.slug,
      title: offer.title,
      image_url: offer.image_url,
      status,
      url: placement?.url || null,
      enabled: placement?.enabled ?? null,
      firestore_doc_id: placement?.firestore_doc_id ?? null,
      is_duplicate: isDuplicate,
      duplicate_doc_ids: isDuplicate ? fsDocs.map((d) => d.doc_id) : [],
    };
  });

  // «Вне каталога» — документы Firestore, чей slug НЕ входит в каталог.
  // Сюда же попадают документы без slug вовсе (прямые ссылки на банки и т.п.).
  const outsideRows: OutsideCatalogRow[] = [];
  for (const d of fsAll) {
    if (d.slug && offerBySlug.has(d.slug)) continue; // это оффер каталога — пропускаем
    outsideRows.push({
      doc_id: d.doc_id,
      slug: d.slug,
      title: d.title,
      url_value: d.url_value,
      url_field_name: d.url_field_name,
      active: d.active,
    });
  }

  const placedCount = catalogRows.filter((r) => r.status === 'placed').length;
  const notPlacedCount = catalogRows.filter((r) => r.status === 'not_placed').length;

  return (
    <div className="min-h-screen bg-white">
      <AdminNav lastSyncAt={lastSyncAt} recordCount={recordCount} />

      <main className="max-w-[1200px] mx-auto px-6 py-10 text-black">
        {/* Breadcrumbs */}
        <nav className="flex items-center gap-1.5 text-xs text-[#666] mb-4">
          <Link
            href="/admin/catalog"
            className="hover:text-black transition-colors font-medium"
          >
            Каталог
          </Link>
          <ChevronRight className="w-3 h-3" />
          <span className="text-black">{app.name}</span>
        </nav>

        {/* Заголовок */}
        <div className="mb-8">
          <h1 className="text-3xl font-semibold">
            {app.name}{' '}
            <span className="text-[#999] font-normal text-2xl">
              {app.appId}
            </span>
          </h1>
          <p className="mt-2 text-sm text-[#666]">
            <span className="text-black font-medium">{placedCount}</span>{' '}
            разложено · {notPlacedCount} не разложено
          </p>
        </div>

        {/* Таблица каталога + блок «вне каталога» */}
        <AppCatalogTable
          appId={app.appId}
          appName={app.name}
          rows={catalogRows}
          outside={outsideRows}
        />
      </main>
    </div>
  );
}

/**
 * Изолированное подключение к Neon для каталога.
 *
 * Используется ОТДЕЛЬНОЕ подключение через @neondatabase/serverless,
 * чтобы код каталога не зависел от конкретного API в src/lib/db.ts.
 * Подключение идёт к той же базе — через ту же переменную
 * MOBILE_ROTATION_DB_URL (не DATABASE_URL).
 *
 * Все функции этого модуля работают только с таблицами:
 * catalog_offers
 * catalog_offer_placements
 *
 * Другие таблицы (offers, offer_stats, rotation_runs, и т.д.)
 * этот модуль НЕ ТРОГАЕТ.
 */

import { neon, type NeonQueryFunction } from '@neondatabase/serverless';
import type { CatalogOffer, CatalogPlacement } from './types';

// Сырые строки из БД — до маппинга в доменные типы.
type CatalogOfferRow = {
 slug: string;
 title: string;
 image_url: string | null;
 created_at: string | Date;
 updated_at: string | Date;
};

type CatalogPlacementRow = {
 id: number | string;
 slug: string;
 app_id: string;
 url: string;
 enabled: boolean;
 firestore_doc_id: string | null;
 created_at: string | Date;
 updated_at: string | Date;
};

let _sql: NeonQueryFunction<false, false> | null = null;
function getSql(): NeonQueryFunction<false, false> {
 if (_sql) return _sql;
 const url = process.env.MOBILE_ROTATION_DB_URL;
 if (!url) {
 throw new Error('MOBILE_ROTATION_DB_URL is not set');
 }
 // arrayMode: false, fullResults: false — возвращает массив объектов {col: value}.
 _sql = neon(url, { arrayMode: false, fullResults: false });
 return _sql;
}

// --- Чтение ---

/** Получить все офферы каталога, отсортированные по title. */
export async function listCatalogOffers(): Promise<CatalogOffer[]> {
 const sql = getSql();
 const rows = (await sql`
 SELECT slug, title, image_url, created_at, updated_at
 FROM catalog_offers
 ORDER BY title
 `) as CatalogOfferRow[];
 return rows.map(mapOfferRow);
}

/** Получить один оффер по slug. */
export async function getCatalogOffer(slug: string): Promise<CatalogOffer | null> {
 const sql = getSql();
 const rows = (await sql`
 SELECT slug, title, image_url, created_at, updated_at
 FROM catalog_offers
 WHERE slug = ${slug}
 LIMIT 1
 `) as CatalogOfferRow[];
 return rows.length ? mapOfferRow(rows[0]) : null;
}

/** Получить все раскладки одного приложения. */
export async function listPlacementsByApp(appId: string): Promise<CatalogPlacement[]> {
 const sql = getSql();
 const rows = (await sql`
 SELECT id, slug, app_id, url, enabled, firestore_doc_id, created_at, updated_at
 FROM catalog_offer_placements
 WHERE app_id = ${appId}
 ORDER BY slug
 `) as CatalogPlacementRow[];
 return rows.map(mapPlacementRow);
}

/** Получить все раскладки одного офера (по всем приложениям). */
export async function listPlacementsByOffer(slug: string): Promise<CatalogPlacement[]> {
 const sql = getSql();
 const rows = (await sql`
 SELECT id, slug, app_id, url, enabled, firestore_doc_id, created_at, updated_at
 FROM catalog_offer_placements
 WHERE slug = ${slug}
 ORDER BY app_id
 `) as CatalogPlacementRow[];
 return rows.map(mapPlacementRow);
}

// --- Запись (только UPSERT / UPDATE, никаких DELETE) ---

/**
 * Создать или обновить запись оффера в каталоге.
 * Использует UPSERT по slug.
 */
export async function upsertCatalogOffer(
 slug: string,
 title: string,
 imageUrl: string | null
): Promise<void> {
 const sql = getSql();
 await sql`
 INSERT INTO catalog_offers (slug, title, image_url, created_at, updated_at)
 VALUES (${slug}, ${title}, ${imageUrl}, NOW(), NOW())
 ON CONFLICT (slug) DO UPDATE
 SET title = EXCLUDED.title,
 image_url = EXCLUDED.image_url,
 updated_at = NOW()
 `;
}

/**
 * Создать или обновить раскладку оффера в приложении.
 * Использует UPSERT по уникальной паре (slug, app_id).
 */
export async function upsertPlacement(
 slug: string,
 appId: string,
 url: string,
 enabled: boolean,
 firestoreDocId: string | null
): Promise<void> {
 const sql = getSql();
 await sql`
 INSERT INTO catalog_offer_placements
 (slug, app_id, url, enabled, firestore_doc_id, created_at, updated_at)
 VALUES
 (${slug}, ${appId}, ${url}, ${enabled}, ${firestoreDocId}, NOW(), NOW())
 ON CONFLICT (slug, app_id) DO UPDATE
 SET url = EXCLUDED.url,
 enabled = EXCLUDED.enabled,
 firestore_doc_id = COALESCE(EXCLUDED.firestore_doc_id, catalog_offer_placements.firestore_doc_id),
 updated_at = NOW()
 `;
}

/**
 * Привязать раскладку к существующему документу Firestore.
 * Не меняет URL и enabled — только firestore_doc_id.
 */
export async function linkPlacementToFirestoreDoc(
 slug: string,
 appId: string,
 firestoreDocId: string
): Promise<void> {
 const sql = getSql();
 await sql`
 UPDATE catalog_offer_placements
 SET firestore_doc_id = ${firestoreDocId},
 updated_at = NOW()
 WHERE slug = ${slug} AND app_id = ${appId}
 `;
}

// --- Маппинг строк в типы ---

function mapOfferRow(r: CatalogOfferRow): CatalogOffer {
 return {
 slug: r.slug,
 title: r.title,
 image_url: r.image_url,
 created_at: r.created_at instanceof Date ? r.created_at : new Date(r.created_at),
 updated_at: r.updated_at instanceof Date ? r.updated_at : new Date(r.updated_at),
 };
}

function mapPlacementRow(r: CatalogPlacementRow): CatalogPlacement {
 return {
 id: Number(r.id),
 slug: r.slug,
 app_id: r.app_id,
 url: r.url,
 enabled: Boolean(r.enabled),
 firestore_doc_id: r.firestore_doc_id,
 created_at: r.created_at instanceof Date ? r.created_at : new Date(r.created_at),
 updated_at: r.updated_at instanceof Date ? r.updated_at : new Date(r.updated_at),
 };
}

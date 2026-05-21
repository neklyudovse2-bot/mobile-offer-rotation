/**
 * ВРЕМЕННЫЙ ЭНДПОИНТ инициализации каталога.
 *
 * Назначение: одноразовая инициализация таблиц catalog_offers и
 * catalog_offer_placements. После использования эта папка
 * src/app/api/admin/catalog/init/ будет УДАЛЕНА отдельным коммитом.
 *
 * Что делает:
 *   1) Создаёт 28 записей в catalog_offers (slug + title) по
 *      жёсткому списку CATALOG_SEED ниже.
 *   2) Идёт в Firestore во все 9 приложений (через
 *      getLoansCollection), читает офферы, и для каждого
 *      документа со slug из CATALOG_SEED создаёт строку в
 *      catalog_offer_placements (UPSERT по (slug, app_id)).
 *   3) Переносит картинки в Vercel Blob: для каждого slug берёт
 *      первую найденную иконку в Firestore, скачивает, заливает
 *      в Blob, и пишет URL в catalog_offers.image_url.
 *
 * Что НЕ делает:
 *   - НЕ пишет в Firestore (только читает).
 *   - НЕ удаляет ничего ни в Neon, ни в Firestore.
 *   - НЕ трогает таблицы кроме catalog_offers и
 *     catalog_offer_placements.
 *
 * Идемпотентность: повторный запуск дозапишет недостающее.
 * UPSERT по (slug, app_id) не создаёт дублей.
 *
 * Безопасность:
 *   - GET-метод.
 *   - Доступ только при наличии admin_session cookie ИЛИ
 *     заголовка x-admin-password = ADMIN_PASSWORD.
 *
 * Применение:
 *   GET /api/admin/catalog/init           — выполнить инициализацию
 *   GET /api/admin/catalog/init?dryRun=1  — холостой прогон, без записи
 *
 * dry-run полезен чтобы заранее увидеть отчёт без побочных эффектов.
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getLoansCollection, extractSlug } from '@/lib/firebase';
import {
  upsertCatalogOffer,
  upsertPlacement,
} from '@/lib/catalog/db';
import { uploadOfferImage } from '@/lib/catalog/blob';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300; // до 5 минут — заливка картинок может занять время

// --- Список приложений (тот же что в проекте mapping) ---
const APP_IDS = [
  'ios-9', 'ios-3', 'ios-13', 'ios-12', 'ios-11',
  'ios-8', 'clario', 'ios-16', 'ios-17',
] as const;

// --- ЖЁСТКИЙ СПИСОК 28 ОФФЕРОВ КАТАЛОГА ---
// Источник: список владельца от 21 мая 2026 г.
// slug — как в aff_sub3, title — для UI и для записи в Firestore.
const CATALOG_SEED: { slug: string; title: string }[] = [
  { slug: 'nebus',          title: 'Небус' },
  { slug: 'webzaim',        title: 'Вебзайм' },
  { slug: 'belka',          title: 'Белка кредит' },
  { slug: 'boostra',        title: 'Boostra' },
  { slug: 'ekapusta',       title: 'Екапуста' },
  { slug: 'ocm',            title: 'One click money' },
  { slug: 'srochnodengi',   title: 'Срочно деньги' },
  { slug: 'turbozaim',      title: 'Турбозайм' },
  { slug: 'ukki',           title: 'Юкки' },
  { slug: 'webbankir',      title: 'Веббанкир' },
  { slug: 'zaymer',         title: 'Займер' },
  { slug: 'lime',           title: 'Лайм' },
  { slug: 'credit7',        title: 'Кредит7' },
  { slug: 'dengisrazu',     title: 'Деньги сразу' },
  { slug: 'platiza',        title: 'Платиза' },
  { slug: 'maxcredit',      title: 'MaxCredit' },
  { slug: 'moneyman',       title: 'Moneyman' },
  { slug: 'umnienalichnie', title: 'Умные наличные' },
  { slug: 'vivus',          title: 'Вивус' },
  { slug: 'krediska',       title: 'Krediska' },
  { slug: 'smsfinance',     title: 'Smsfinance' },
  { slug: 'creditplus',     title: 'Кредит плюс' },
  { slug: 'bistrodengi',    title: 'Быстро деньги' },
  { slug: 'nadodeneg',      title: 'Надо денег' },
  { slug: 'creditter',      title: 'Creditter' },
  { slug: 'dozarplaty',     title: 'До зарплаты' },
  { slug: 'finters',        title: 'Finters' },
  { slug: 'eqvazaim',       title: 'Эквазайм' },
];

const KNOWN_SLUGS = new Set(CATALOG_SEED.map((o) => o.slug));

// --- Авторизация (cookie ИЛИ x-admin-password) ---
async function isAuthorized(req: NextRequest): Promise<boolean> {
  const password = process.env.ADMIN_PASSWORD;
  if (!password) return false;
  const headerPwd = req.headers.get('x-admin-password');
  if (headerPwd && headerPwd === password) return true;
  const cookieStore = await cookies();
  const session = cookieStore.get('admin_session')?.value;
  if (session && session === password) return true;
  return false;
}

// --- Скачивание иконки по URL ---
async function fetchImage(url: string): Promise<
  { ok: true; data: ArrayBuffer; contentType: string; size: number }
  | { ok: false; error: string }
> {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 15_000);
    const resp = await fetch(url, { signal: ctrl.signal, redirect: 'follow' });
    clearTimeout(timer);
    if (!resp.ok) return { ok: false, error: `HTTP ${resp.status}` };
    const buf = await resp.arrayBuffer();
    const ct = resp.headers.get('content-type') || '';
    // Приводим content-type к одному из допустимых
    const normalized = normalizeImageContentType(ct, url);
    if (!normalized) return { ok: false, error: `unsupported content-type: ${ct}` };
    return { ok: true, data: buf, contentType: normalized, size: buf.byteLength };
  } catch (e: unknown) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

function normalizeImageContentType(ct: string, url: string): string | null {
  const lower = ct.toLowerCase();
  if (lower.includes('image/png'))  return 'image/png';
  if (lower.includes('image/jpeg')) return 'image/jpeg';
  if (lower.includes('image/jpg'))  return 'image/jpeg';
  if (lower.includes('image/webp')) return 'image/webp';
  if (lower.includes('image/gif'))  return 'image/gif';
  // Если content-type кривой — попробуем по расширению URL.
  const u = url.toLowerCase();
  if (u.endsWith('.png'))  return 'image/png';
  if (u.endsWith('.jpg') || u.endsWith('.jpeg')) return 'image/jpeg';
  if (u.endsWith('.webp')) return 'image/webp';
  if (u.endsWith('.gif'))  return 'image/gif';
  return null;
}

export async function GET(req: NextRequest) {
  if (!(await isAuthorized(req))) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const dryRun = req.nextUrl.searchParams.get('dryRun') === '1';

  type Report = {
    dry_run: boolean;
    started_at: string;
    finished_at?: string;
    catalog_offers: {
      planned: number;
      written: number;
    };
    placements: {
      planned: number;
      written: number;
      skipped_unknown_slug: { app_id: string; doc_id: string; slug: string }[];
      skipped_no_url: { app_id: string; doc_id: string }[];
      skipped_no_slug: { app_id: string; doc_id: string; url: string }[];
    };
    images: {
      mapped_offers: number;     // у скольких офферов нашли хотя бы один URL картинки
      uploaded: number;          // сколько реально залили в Blob
      failed: { slug: string; tried_url: string; reason: string }[];
      no_source: string[];       // slug'и, у которых вообще нет картинки в Firestore
    };
    errors: string[];
  };

  const report: Report = {
    dry_run: dryRun,
    started_at: new Date().toISOString(),
    catalog_offers: { planned: CATALOG_SEED.length, written: 0 },
    placements: {
      planned: 0,
      written: 0,
      skipped_unknown_slug: [],
      skipped_no_url: [],
      skipped_no_slug: [],
    },
    images: { mapped_offers: 0, uploaded: 0, failed: [], no_source: [] },
    errors: [],
  };

  try {
    // ====== ШАГ 1: catalog_offers (slug + title, без иконок пока) ======
    if (!dryRun) {
      for (const o of CATALOG_SEED) {
        try {
          await upsertCatalogOffer(o.slug, o.title, null);
          report.catalog_offers.written += 1;
        } catch (e: unknown) {
          report.errors.push(
            `catalog_offers upsert ${o.slug}: ${e instanceof Error ? e.message : String(e)}`
          );
        }
      }
    } else {
      report.catalog_offers.written = 0; // dry-run: ничего не записано
    }

    // ====== ШАГ 2: подхват placements из Firestore ======
    // Параллельно собираем кандидатов на иконку — slug → первый встреченный image URL.
    const imageCandidates = new Map<string, string>();

    for (const appId of APP_IDS) {
      try {
        const coll = getLoansCollection(appId);
        const snap = await coll.get();

        for (const doc of snap.docs) {
          const data = doc.data() as Record<string, unknown>;
          const docId = doc.id;

          // Извлекаем slug через утилиту проекта (поддерживает url и site, ios-11).
          const slug = extractSlug(data) || '';
          const url = (typeof data.url === 'string' && data.url) ||
                      (typeof data.site === 'string' && data.site) ||
                      '';

          if (!url) {
            report.placements.skipped_no_url.push({ app_id: appId, doc_id: docId });
            continue;
          }
          if (!slug) {
            report.placements.skipped_no_slug.push({ app_id: appId, doc_id: docId, url });
            continue;
          }
          if (!KNOWN_SLUGS.has(slug)) {
            report.placements.skipped_unknown_slug.push({ app_id: appId, doc_id: docId, slug });
            continue;
          }

          // Кандидат — оффер каталога. Запоминаем placement.
          report.placements.planned += 1;
          if (!dryRun) {
            try {
              await upsertPlacement(slug, appId, url, true, docId);
              report.placements.written += 1;
            } catch (e: unknown) {
              report.errors.push(
                `placement upsert ${slug}/${appId}: ${e instanceof Error ? e.message : String(e)}`
              );
            }
          }

          // Кандидат на иконку — первый встреченный image
          if (!imageCandidates.has(slug)) {
            const img = typeof data.image === 'string' ? data.image.trim() : '';
            if (img) imageCandidates.set(slug, img);
          }
        }
      } catch (e: unknown) {
        report.errors.push(
          `firestore read ${appId}: ${e instanceof Error ? e.message : String(e)}`
        );
      }
    }

    report.images.mapped_offers = imageCandidates.size;
    for (const seed of CATALOG_SEED) {
      if (!imageCandidates.has(seed.slug)) {
        report.images.no_source.push(seed.slug);
      }
    }

    // ====== ШАГ 3: миграция картинок в Blob ======
    if (!dryRun) {
      for (const [slug, srcUrl] of imageCandidates) {
        const fetched = await fetchImage(srcUrl);
        if (!fetched.ok) {
          report.images.failed.push({ slug, tried_url: srcUrl, reason: fetched.error });
          continue;
        }
        try {
          const blobUrl = await uploadOfferImage(
            slug,
            fetched.data,
            fetched.contentType,
            fetched.size
          );
          // Обновляем image_url в catalog_offers (title нам уже не нужно менять,
          // но upsertCatalogOffer обновит обе вместе — поэтому передаём текущий title)
          const seed = CATALOG_SEED.find((s) => s.slug === slug);
          if (seed) {
            await upsertCatalogOffer(slug, seed.title, blobUrl);
            report.images.uploaded += 1;
          }
        } catch (e: unknown) {
          report.images.failed.push({
            slug,
            tried_url: srcUrl,
            reason: e instanceof Error ? e.message : String(e),
          });
        }
      }
    }

    report.finished_at = new Date().toISOString();
    return NextResponse.json(report, {
      status: 200,
      headers: { 'cache-control': 'no-store' },
    });
  } catch (e: unknown) {
    report.finished_at = new Date().toISOString();
    report.errors.push('FATAL: ' + (e instanceof Error ? e.stack || e.message : String(e)));
    return NextResponse.json(report, {
      status: 500,
      headers: { 'cache-control': 'no-store' },
    });
  }
}

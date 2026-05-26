/**
 * Эндпоинт применения изменений каталога.
 *
 * POST /api/admin/catalog/apply
 *
 * Принимает JSON со списком действий и применяет их в Firestore
 * этого приложения. Каждое действие логируется в catalog_apply_log.
 *
 * Безопасность:
 * - Защищён ADMIN_PASSWORD (cookie или x-admin-password header).
 * - app_id проверяется по APP_MAPPING (whitelist).
 * - Доступ к Firestore только через getLoansCollection (whitelist).
 * - Запись через set({ merge: true }) — никогда не перетирает
 * документ целиком, только указанные поля.
 * - Никаких delete() — статус управляется полем active.
 * - Для ios-11 поле ссылки = site (а не url).
 *
 * Формат запроса:
 * {
 * "app_id": "ios-17",
 * "actions": [
 * { "type": "add", "slug": "boostra", "url": "https://...", "active": true },
 * { "type": "update", "slug": "lime", "url": "https://...", "active": false },
 * { "type": "hide", "slug": "platiza" }
 * ]
 * }
 *
 * Формат ответа:
 * {
 * "app_id": "ios-17",
 * "applied": 2,
 * "failed": 1,
 * "results": [
 * { "slug": "...", "type": "...", "status": "success" | "error", "error": "..." }
 * ]
 * }
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { neon } from '@neondatabase/serverless';
import {
 getLoansCollection,
 getFirestore,
} from '@/lib/firebase';
import { APP_MAPPING } from '@/config/mapping';
import {
 listCatalogOffers,
 upsertPlacement,
} from '@/lib/catalog/db';
import { revalidatePath } from 'next/cache';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// --- Типы ---

type ActionAdd = {
 type: 'add';
 slug: string;
 url: string;
 active: boolean;
};

type ActionUpdate = {
 type: 'update';
 slug: string;
 url: string;
 active: boolean;
};

type ActionHide = {
 type: 'hide';
 slug: string;
};

type Action = ActionAdd | ActionUpdate | ActionHide;

type ResultRow = {
 slug: string;
 type: Action['type'];
 status: 'success' | 'error';
 error?: string;
};

// --- Авторизация ---

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

// --- Лог ---

function getSql() {
 const url = process.env.MOBILE_ROTATION_DB_URL;
 if (!url) throw new Error('MOBILE_ROTATION_DB_URL is not set');
 return neon(url, { arrayMode: false, fullResults: false });
}

async function writeLog(params: {
 appId: string;
 slug: string;
 actionType: Action['type'];
 oldUrl: string | null;
 newUrl: string | null;
 oldActive: boolean | null;
 newActive: boolean | null;
 firestoreDocId: string | null;
 status: 'success' | 'error';
 errorMessage: string | null;
}): Promise<void> {
 const sql = getSql();
 await sql`
 INSERT INTO catalog_apply_log
 (app_id, slug, action_type, old_url, new_url,
 old_active, new_active, firestore_doc_id,
 status, error_message)
 VALUES
 (${params.appId}, ${params.slug}, ${params.actionType},
 ${params.oldUrl}, ${params.newUrl},
 ${params.oldActive}, ${params.newActive},
 ${params.firestoreDocId},
 ${params.status}, ${params.errorMessage})
 `;
}

// --- Главная функция ---

export async function POST(req: NextRequest) {
 if (!(await isAuthorized(req))) {
 return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
 }

 // Парсим тело запроса
 let body: unknown;
 try {
 body = await req.json();
 } catch {
 return NextResponse.json(
 { error: 'invalid_json' },
 { status: 400 }
 );
 }

 // Валидация формата
 if (!body || typeof body !== 'object') {
 return NextResponse.json(
 { error: 'invalid_body' },
 { status: 400 }
 );
 }
 const b = body as Record<string, unknown>;
 const appId = typeof b.app_id === 'string' ? b.app_id : null;
 const actions = Array.isArray(b.actions) ? (b.actions as unknown[]) : null;

 if (!appId || !actions) {
 return NextResponse.json(
 { error: 'missing_app_id_or_actions' },
 { status: 400 }
 );
 }

 // Whitelist приложения через APP_MAPPING
 const app = APP_MAPPING.find((a) => a.appId === appId);
 if (!app) {
 return NextResponse.json(
 { error: 'unknown_app_id', app_id: appId },
 { status: 400 }
 );
 }

 // Для ios-11 поле ссылки = site, иначе url
 const urlField: 'url' | 'site' = appId === 'ios-11' ? 'site' : 'url';

 // Загружаем каталог — нужен title и image для add
 const catalogOffers = await listCatalogOffers();
 const offerBySlug = new Map(catalogOffers.map((o) => [o.slug, o]));

 // Получаем коллекцию Firestore через whitelist-обёртку
 const coll = getLoansCollection(appId);

 // Подгружаем существующие документы — нужны old_url, old_active для лога
 // и проверки "существует или нет" для add/update/hide.
 const snap = await coll.get();
 type FsDoc = {
 doc_id: string;
 url: string | null;
 active: boolean | null;
 slug: string | null;
 };
 const fsDocs: FsDoc[] = [];
 snap.forEach((doc) => {
 const data = doc.data() as Record<string, unknown>;
 // Slug может лежать в url или site; берём первый непустой
 let slug: string | null = null;
 const u =
 (typeof data.url === 'string' && data.url) ||
 (typeof data.site === 'string' && data.site) ||
 '';
 if (u) {
 try {
 slug = new URL(u).searchParams.get('aff_sub3') || null;
 } catch {
 slug = null;
 }
 }
 fsDocs.push({
 doc_id: doc.id,
 url: u || null,
 active: typeof data.active === 'boolean' ? data.active : null,
 slug,
 });
 });

 // Индекс по slug — может быть несколько (дубль). При операциях берём первый.
 const fsBySlug = new Map<string, FsDoc[]>();
 for (const d of fsDocs) {
 if (!d.slug) continue;
 const arr = fsBySlug.get(d.slug) || [];
 arr.push(d);
 fsBySlug.set(d.slug, arr);
 }

 // Применяем действия по очереди
 const results: ResultRow[] = [];

 for (const rawAction of actions) {
 if (!rawAction || typeof rawAction !== 'object') {
 continue;
 }
 const a = rawAction as Record<string, unknown>;
 const type = a.type as Action['type'];
 const slug = typeof a.slug === 'string' ? a.slug : null;
 if (!slug) {
 results.push({
 slug: 'unknown',
 type: type,
 status: 'error',
 error: 'missing_slug',
 });
 continue;
 }

 const offer = offerBySlug.get(slug);
 if (!offer) {
 // Оффера нет в каталоге — отказываем (это страховка)
 results.push({
 slug,
 type,
 status: 'error',
 error: 'offer_not_in_catalog',
 });
 await writeLog({
 appId,
 slug,
 actionType: type,
 oldUrl: null,
 newUrl: null,
 oldActive: null,
 newActive: null,
 firestoreDocId: null,
 status: 'error',
 errorMessage: 'offer_not_in_catalog',
 });
 continue;
 }

 const existing = fsBySlug.get(slug) || [];
 const firstDoc = existing[0] || null;

 try {
 if (type === 'add') {
 const url = typeof a.url === 'string' ? a.url : '';
 const active = a.active === true;
 if (!url) throw new Error('missing_url');
 if (existing.length > 0) {
 throw new Error('already_exists_use_update');
 }

 // Doc ID = slug (как договорились)
 const docId = slug;
 const docData: Record<string, unknown> = {
 title: offer.title,
 [urlField]: url,
 active,
 image: offer.image_url || '',
 };
 await coll.doc(docId).set(docData, { merge: true });

 // Обновляем placement в Neon
 await upsertPlacement(slug, appId, url, active, docId);

 await writeLog({
 appId,
 slug,
 actionType: 'add',
 oldUrl: null,
 newUrl: url,
 oldActive: null,
 newActive: active,
 firestoreDocId: docId,
 status: 'success',
 errorMessage: null,
 });

 results.push({ slug, type: 'add', status: 'success' });
 } else if (type === 'update') {
 const url = typeof a.url === 'string' ? a.url : '';
 const active = a.active === true;
 if (!url) throw new Error('missing_url');
 if (!firstDoc) {
 throw new Error('not_found_use_add');
 }

 const updateData: Record<string, unknown> = {
 [urlField]: url,
 active,
 };
 await coll.doc(firstDoc.doc_id).set(updateData, { merge: true });

 await upsertPlacement(slug, appId, url, active, firstDoc.doc_id);

 await writeLog({
 appId,
 slug,
 actionType: 'update',
 oldUrl: firstDoc.url,
 newUrl: url,
 oldActive: firstDoc.active,
 newActive: active,
 firestoreDocId: firstDoc.doc_id,
 status: 'success',
 errorMessage: null,
 });

 results.push({ slug, type: 'update', status: 'success' });
 } else if (type === 'hide') {
 if (!firstDoc) {
 throw new Error('not_found_nothing_to_hide');
 }

 await coll.doc(firstDoc.doc_id).set({ active: false }, { merge: true });

 // В placement Neon отмечаем enabled=false (для UI),
 // но url оставляем — это нужно чтобы потом "показать" обратно.
 if (firstDoc.url) {
 await upsertPlacement(slug, appId, firstDoc.url, false, firstDoc.doc_id);
 }

 await writeLog({
 appId,
 slug,
 actionType: 'hide',
 oldUrl: firstDoc.url,
 newUrl: firstDoc.url,
 oldActive: firstDoc.active,
 newActive: false,
 firestoreDocId: firstDoc.doc_id,
 status: 'success',
 errorMessage: null,
 });

 results.push({ slug, type: 'hide', status: 'success' });
 } else {
 results.push({
 slug,
 type,
 status: 'error',
 error: 'unknown_action_type',
 });
 }
 } catch (e: unknown) {
 const msg = e instanceof Error ? e.message : String(e);
 results.push({ slug, type, status: 'error', error: msg });
 // Пишем в лог даже неудачные попытки
 await writeLog({
 appId,
 slug,
 actionType: type,
 oldUrl: firstDoc?.url ?? null,
 newUrl: null,
 oldActive: firstDoc?.active ?? null,
 newActive: null,
 firestoreDocId: firstDoc?.doc_id ?? null,
 status: 'error',
 errorMessage: msg,
 }).catch(() => {
 // Если лог упал — игнорируем, главное вернуть результат пользователю
 });
 }
 }

 // Инвалидируем кэш страниц каталога — чтобы свежие данные сразу отображались
 try {
 revalidatePath(`/admin/catalog/${appId}`);
 revalidatePath(`/admin/catalog`);
 } catch {
 // не критично
 }

 const applied = results.filter((r) => r.status === 'success').length;
 const failed = results.filter((r) => r.status === 'error').length;

 return NextResponse.json(
 {
 app_id: appId,
 applied,
 failed,
 results,
 },
 { status: 200 }
 );
}

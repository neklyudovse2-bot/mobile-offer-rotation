/**
 * READ-ONLY RECON ENDPOINT.
 *
 * Назначение: одноразовая разведка структуры Firestore для
 * проектирования каталога офферов. После использования эта папка
 * /src/app/api/admin/recon-offers/ будет УДАЛЕНА отдельным коммитом.
 *
 * Безопасность:
 *   - GET-метод, только чтение;
 *   - доступ только при наличии admin_session cookie ИЛИ
 *     заголовка x-admin-password = ADMIN_PASSWORD;
 *   - НИКАКИХ операций записи в Firestore.
 *
 * Содержимое запроса повторяет логику скрипта recon_offers.js v5,
 * но запускается на проде Vercel, где переменная окружения
 * FIREBASE_SERVICE_ACCOUNT уже корректно настроена.
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import admin from 'firebase-admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// --- список приложений строго из mapping проекта ---
const APP_IDS = [
  'ios-9', 'ios-3', 'ios-13', 'ios-12', 'ios-11',
  'ios-8', 'clario', 'ios-16', 'ios-17',
] as const;

const URL_FIELD_CANDIDATES = ['url', 'site', 'link', 'href'] as const;

function pickUrlField(data: Record<string, unknown>): { name: string | null; value: string } {
  for (const f of URL_FIELD_CANDIDATES) {
    const v = data[f];
    if (typeof v === 'string' && v) return { name: f, value: v };
  }
  return { name: null, value: '' };
}
function extractSlug(v: string): string {
  if (!v) return '';
  try { return new URL(v).searchParams.get('aff_sub3') || ''; } catch { return ''; }
}
function extractPathHash(v: string): string {
  if (!v) return '';
  try { const s = new URL(v).pathname.split('/').filter(Boolean); return s[0] || ''; } catch { return ''; }
}
function extractDomain(v: string): string {
  if (!v) return '';
  try { return new URL(v).host; } catch { return ''; }
}

// --- ленивая инициализация firebase-admin (как в lib/firebase) ---
function getDb(): admin.firestore.Firestore {
  if (admin.apps.length === 0) {
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
    if (!raw) throw new Error('FIREBASE_SERVICE_ACCOUNT is not set');
    const serviceAccount = JSON.parse(raw) as admin.ServiceAccount;
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: (serviceAccount as { project_id?: string }).project_id,
    });
  }
  return admin.firestore();
}

// --- проверка доступа: cookie ИЛИ header ---
async function isAuthorized(req: NextRequest): Promise<boolean> {
  const password = process.env.ADMIN_PASSWORD;
  if (!password) return false;

  // вариант 1: header
  const headerPwd = req.headers.get('x-admin-password');
  if (headerPwd && headerPwd === password) return true;

  // вариант 2: cookie (как в isAdminAuthenticated)
  const cookieStore = await cookies();
  const session = cookieStore.get('admin_session')?.value;
  if (session && session === password) return true;

  return false;
}

export async function GET(req: NextRequest) {
  if (!(await isAuthorized(req))) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const db = getDb();

  type DocEntry = {
    doc_id: string;
    field_keys: string[];
    title: unknown;
    subtitle: unknown;
    amount: unknown;
    term: unknown;
    rate: unknown;
    psk: unknown;
    image: unknown;
    active: boolean | null;
    url_field_name: string | null;
    url_value: string | null;
    slug: string | null;
    path_hash: string | null;
    domain: string | null;
    raw: Record<string, unknown>;
  };
  type AppEntry = {
    app_id: string;
    error: string | null;
    total_docs: number;
    documents: DocEntry[];
  };

  const report: {
    generated_at: string;
    note: string;
    apps: Record<string, AppEntry>;
    field_matrix: Record<string, Record<string, number>>;
    url_field_by_app: Record<string, Record<string, number>>;
    grouped_by_slug: Record<string, unknown[]>;
  } = {
    generated_at: new Date().toISOString(),
    note: 'READ ONLY recon via endpoint. No writes performed.',
    apps: {},
    field_matrix: {},
    url_field_by_app: {},
    grouped_by_slug: {},
  };

  for (const appId of APP_IDS) {
    const entry: AppEntry = { app_id: appId, error: null, total_docs: 0, documents: [] };
    try {
      const snap = await db.collection(appId).doc('ru').collection('loans').get();
      entry.total_docs = snap.size;

      snap.forEach((doc) => {
        const data = (doc.data() || {}) as Record<string, unknown>;
        const keys = Object.keys(data).sort();
        const urlF = pickUrlField(data);

        for (const k of keys) {
          if (!report.field_matrix[k]) report.field_matrix[k] = {};
          report.field_matrix[k][appId] = (report.field_matrix[k][appId] || 0) + 1;
        }
        if (!report.url_field_by_app[appId]) report.url_field_by_app[appId] = {};
        const ufKey = urlF.name || '(none)';
        report.url_field_by_app[appId][ufKey] = (report.url_field_by_app[appId][ufKey] || 0) + 1;

        entry.documents.push({
          doc_id: doc.id,
          field_keys: keys,
          title: data.title ?? null,
          subtitle: data.subtitle ?? null,
          amount: data.amount ?? null,
          term: data.term ?? null,
          rate: data.rate ?? null,
          psk: data.psk ?? null,
          image: data.image ?? null,
          active: typeof data.active === 'boolean' ? data.active : null,
          url_field_name: urlF.name,
          url_value: urlF.value || null,
          slug: extractSlug(urlF.value) || null,
          path_hash: extractPathHash(urlF.value) || null,
          domain: extractDomain(urlF.value) || null,
          raw: data,
        });
      });
    } catch (e: unknown) {
      entry.error = e instanceof Error ? e.message : String(e);
    }
    report.apps[appId] = entry;
  }

  // группировка по slug
  const bySlug: Record<string, unknown[]> = {};
  for (const appId of APP_IDS) {
    const e = report.apps[appId];
    if (!e || e.error) continue;
    for (const d of e.documents) {
      const key = d.slug || '(no-slug)';
      if (!bySlug[key]) bySlug[key] = [];
      bySlug[key].push({
        app_id: appId,
        title: d.title,
        url_field_name: d.url_field_name,
        url_value: d.url_value,
        domain: d.domain,
        path_hash: d.path_hash,
        field_keys: d.field_keys,
      });
    }
  }
  report.grouped_by_slug = bySlug;

  return NextResponse.json(report, {
    status: 200,
    headers: { 'cache-control': 'no-store' },
  });
}

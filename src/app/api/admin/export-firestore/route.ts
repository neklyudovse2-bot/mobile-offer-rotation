import { NextRequest, NextResponse } from 'next/server';
import { isAdminAuthenticated } from '@/lib/auth';
import { APP_MAPPING } from '@/config/mapping';
import { getFirestore } from '@/lib/firebase';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/export-firestore
 * 
 * Скачивает полный snapshot всех документов из Firestore во всех коллекциях.
 * Возвращает JSON файл который можно скачать и сохранить локально.
 * 
 * Использование: открой в браузере (после авторизации в админке) — браузер 
 * сам предложит скачать файл с именем firestore-snapshot-YYYY-MM-DD.json.
 */
export async function GET(request: NextRequest) {
  try {
    const authenticated = await isAdminAuthenticated();
    if (!authenticated) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const firestore = getFirestore();
    const snapshot: any = {
      exported_at: new Date().toISOString(),
      apps: {},
    };

    for (const app of APP_MAPPING) {
      const docs = await firestore
        .collection(app.appId)
        .doc('ru')
        .collection('loans')
        .get();

      snapshot.apps[app.appId] = {
        name: app.name,
        sortField: app.sortField,
        documents: docs.docs.map((doc) => ({
          id: doc.id,
          data: doc.data(),
        })),
      };
    }

    const dateStr = new Date().toISOString().split('T')[0];
    const filename = `firestore-snapshot-${dateStr}.json`;

    return new NextResponse(JSON.stringify(snapshot, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (e: any) {
    console.error('[EXPORT FIRESTORE] error:', e);
    return NextResponse.json(
      { error: e.message || 'Export failed' },
      { status: 500 }
    );
  }
}

import { isAdminAuthenticated } from '@/lib/auth';
import Login from '@/components/Login';
import { APP_MAPPING } from '@/config/mapping';
import { sql } from '@/lib/db';
import { getFirestore } from '@/lib/firebase';
import Link from 'next/link';
import RecalculateButton from '@/components/RecalculateButton';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function AdminPage() {
  let authenticated = false;
  let errorMsg = '';

  try {
    authenticated = await isAdminAuthenticated();
  } catch (e: any) {
    errorMsg = e.message;
  }

  if (errorMsg) {
    return (
      <div className="p-10 text-red-600 font-mono text-center">
        <h1 className="text-2xl font-bold mb-4">CRITICAL ERROR</h1>
        <p className="bg-red-50 p-4 border border-red-200 rounded">{errorMsg}</p>
        <p className="mt-4 text-gray-600">Please configure the variable in Vercel Dashboard.</p>
      </div>
    );
  }

  if (!authenticated) {
    return <Login />;
  }

  // Данные для дашборда
  const lastSyncRes = await sql`SELECT MAX(synced_at) as last_sync FROM keitaro_stats`;
  const lastSync = lastSyncRes[0]?.last_sync ? new Date(lastSyncRes[0].last_sync).toLocaleString('ru-RU') : 'Нет данных';

  // Инициализируем Firestore для получения текущих позиций
  let firestore;
  try { firestore = getFirestore(); } catch(e) {}

  const appsData = [];

  for (const app of APP_MAPPING) {
    let topOffers: Array<{slug: string, pos: number}> = [];
    if (firestore) {
      const snapshot = await firestore.collection(app.appId).doc('ru').collection('loans')
        .orderBy(app.sortField)
        .limit(3)
        .get();
      
      topOffers = snapshot.docs.map(doc => {
        const data = doc.data();
        const url = data.url || '';
        let slug = 'n/a';
        try { slug = new URL(url).searchParams.get('aff_sub3') || 'n/a'; } catch(e) {}
        return { slug, pos: data[app.sortField] };
      });
    }

    appsData.push({ ...app, topOffers });
  }

  return (
    <div className="min-h-screen bg-white text-black p-8 font-sans">
      <header className="flex justify-between items-center mb-12 pb-6 border-b border-gray-100">
        <div>
          <h1 className="text-3xl font-bold uppercase tracking-tight">Marcus Vitruvius 🏛️</h1>
          <p className="text-gray-500 mt-1">Systems Architect: Rotation Admin</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-gray-400 uppercase">Последняя синхронизация Keitaro</p>
          <p className="font-mono font-medium">{lastSync}</p>
        </div>
      </header>

      <div className="grid md:grid-cols-3 gap-8 mb-12">
        {appsData.map(app => (
          <div key={app.appId} className="border border-gray-200 rounded-lg p-6 shadow-sm hover:border-blue-200 transition-colors">
            <h2 className="text-xl font-bold mb-4 border-b border-gray-50 pb-2">{app.name} <span className="text-xs text-gray-400">({app.appId})</span></h2>
            
            <div className="mb-6 space-y-2">
              <p className="text-[10px] uppercase text-gray-400 font-bold">Top 3 Оффера</p>
              {app.topOffers.length > 0 ? app.topOffers.map((o) => (
                <div key={o.slug} className="flex justify-between text-sm py-1">
                  <span className="font-medium">{o.slug}</span>
                  <span className="text-blue-600 font-mono">#{o.pos}</span>
                </div>
              )) : <p className="text-gray-400 italic text-sm">Нет данных Firestore</p>}
            </div>

            <div className="flex gap-2 mt-4">
              <Link href={`/admin/stats`} className="flex-1 text-center py-2 border border-gray-200 rounded text-sm font-medium hover:bg-gray-50 active:bg-gray-100 transition-colors">Статистика</Link>
              <Link href={`/admin/offers/${app.appId}`} className="flex-1 text-center py-2 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-700 transition-colors">Настройки</Link>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-gray-50 border border-gray-100 rounded-lg p-8 text-center">
        <h3 className="text-lg font-bold mb-2">Общая ротация</h3>
        <p className="text-gray-500 text-sm mb-6 max-w-md mx-auto">Запуск этого процесса немедленно обновит Firestore для всех приложений на основе последних данных Keitaro.</p>
        <RecalculateButton />
      </div>
    </div>
  );
}

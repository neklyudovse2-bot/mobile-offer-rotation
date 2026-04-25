import admin from 'firebase-admin';
import { APP_MAPPING } from '@/config/mapping';

export type AppId = typeof APP_MAPPING[number]['appId'];

const ALLOWED_APP_IDS = new Set<string>(APP_MAPPING.map((a) => a.appId));

export const getFirestore = () => {
  if (!process.env.FIREBASE_SERVICE_ACCOUNT) {
    throw new Error('FIREBASE_SERVICE_ACCOUNT not configured');
  }

  if (!admin.apps.length) {
    try {
      const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
    } catch (e) {
      throw new Error('Failed to parse FIREBASE_SERVICE_ACCOUNT');
    }
  }

  return admin.firestore();
};

/**
 * Защищённый доступ к коллекции офферов конкретного приложения.
 * 
 * Использовать ВЕЗДЕ вместо прямого firestore.collection(appId).doc('ru').collection('loans').
 * 
 * Эта функция проверяет что app_id входит в whitelist (APP_MAPPING) и кидает 
 * ошибку для любого другого значения. Это защита от случайных опечаток или 
 * правок которые могут затронуть чужие коллекции в Firestore.
 * 
 * Пример использования:
 *   const loans = getLoansCollection('ios-9');
 *   const snapshot = await loans.get();
 *   await loans.doc(docId).update({ id: 1 });
 */
export function getLoansCollection(appId: string) {
  if (!ALLOWED_APP_IDS.has(appId)) {
    throw new Error(
      `[SECURITY] Попытка доступа к Firestore с app_id="${appId}" — ` +
      `этого app_id нет в APP_MAPPING. Разрешены только: ${Array.from(ALLOWED_APP_IDS).join(', ')}`
    );
  }

  return getFirestore()
    .collection(appId)
    .doc('ru')
    .collection('loans');
}

/**
 * Список разрешённых app_id для проверок в коде.
 */
export function isAllowedAppId(appId: string): boolean {
  return ALLOWED_APP_IDS.has(appId);
}

/**
 * Извлекает slug из данных Firestore документа.
 * 
 * Документы могут хранить URL в одном из двух полей:
 * - `url` (новая структура, большинство приложений)
 * - `site` (старая структура, например ios-11)
 * 
 * Slug извлекается из query параметра `aff_sub3` в URL.
 * Если URL не парсится или параметра нет — возвращается пустая строка.
 * 
 * Возвращает: slug (строка) или '' если извлечь не удалось
 */
export function extractSlug(data: Record<string, any>): string {
  const urlField = data?.url || data?.site || '';
  if (!urlField) return '';
  
  try {
    const urlObj = new URL(urlField);
    return urlObj.searchParams.get('aff_sub3') || '';
  } catch (e) {
    return '';
  }
}

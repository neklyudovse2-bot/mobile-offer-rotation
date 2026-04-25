import { sql } from './db';
import { Firestore, DocumentReference } from 'firebase-admin/firestore';

/**
 * Безопасно обновляет документ в Firestore И логирует изменение в Neon.
 * 
 * Перед update делает get() чтобы получить старые значения.
 * Затем делает update().
 * Затем для каждого изменённого поля пишет запись в firestore_changes_log.
 * 
 * Если логирование падает — не падает сам update (мы не хотим чтобы 
 * проблемы с логом ломали ротацию).
 */
export async function loggedUpdate(
  docRef: DocumentReference,
  updates: Record<string, any>,
  context: {
    app_id: string;
    offer_slug?: string | null;
    triggered_by: 'rotation' | 'admin_ui' | 'manual';
    rotation_history_id?: number | null;
  }
): Promise<void> {
  // 1. Получаем старые значения
  let oldData: Record<string, any> = {};
  try {
    const snapshot = await docRef.get();
    if (snapshot.exists) {
      oldData = snapshot.data() || {};
    }
  } catch (e) {
    console.error('[loggedUpdate] failed to read old data:', e);
    // Продолжаем без старых значений — это не критично
  }

  // 2. Делаем сам update
  await docRef.update(updates);

  // 3. Логируем каждое изменённое поле
  try {
    for (const [fieldName, newValue] of Object.entries(updates)) {
      const oldValue = oldData[fieldName] ?? null;
      
      // Пропускаем если значение не поменялось
      if (JSON.stringify(oldValue) === JSON.stringify(newValue)) {
        continue;
      }

      await sql`
        INSERT INTO firestore_changes_log 
          (app_id, doc_id, offer_slug, field_name, old_value, new_value, 
           triggered_by, rotation_history_id)
        VALUES 
          (${context.app_id}, ${docRef.id}, ${context.offer_slug || null}, 
           ${fieldName}, ${JSON.stringify(oldValue)}::jsonb, 
           ${JSON.stringify(newValue)}::jsonb, ${context.triggered_by}, 
           ${context.rotation_history_id || null})
      `;
    }
  } catch (e) {
    // Не падаем если лог не записался — основной update уже прошёл
    console.error('[loggedUpdate] failed to write log:', e);
  }
}

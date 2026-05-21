/**
 * Утилиты для работы с Vercel Blob.
 *
 * Используется для хранения иконок офферов каталога.
 * Все картинки публичные (access: 'public') — приложениям нужно
 * получать их по прямой ссылке без авторизации.
 *
 * Размер до 1 МБ, типы PNG/JPEG/WebP/GIF.
 *
 * Аутентификация:
 * - На Vercel runtime SDK сам подтянет BLOB_READ_WRITE_TOKEN,
 * который автоматически добавлен в env при создании стора.
 */

import { put } from '@vercel/blob';

export const ALLOWED_IMAGE_TYPES = [
 'image/png',
 'image/jpeg',
 'image/webp',
 'image/gif',
] as const;

export const MAX_IMAGE_BYTES = 1 * 1024 * 1024; // 1 MB

export class BlobValidationError extends Error {
 constructor(message: string) {
 super(message);
 this.name = 'BlobValidationError';
 }
}

/**
 * Загрузить иконку оффера в Vercel Blob.
 *
 * @param slug — slug оффера (используется в имени файла для опознаваемости).
 * @param data — содержимое файла (Buffer, ArrayBuffer, Blob или Uint8Array).
 * @param contentType — MIME-тип файла (должен быть из ALLOWED_IMAGE_TYPES).
 * @param sizeBytes — размер файла в байтах (для валидации до загрузки).
 * @returns публичный URL загруженной иконки.
 */
export async function uploadOfferImage(
 slug: string,
 data: ArrayBuffer | Blob | Buffer | Uint8Array,
 contentType: string,
 sizeBytes: number
): Promise<string> {
 // Валидация типа
 if (!(ALLOWED_IMAGE_TYPES as readonly string[]).includes(contentType)) {
 throw new BlobValidationError(
 `Unsupported image type: ${contentType}. Allowed: ${ALLOWED_IMAGE_TYPES.join(', ')}`
 );
 }
 // Валидация размера
 if (sizeBytes > MAX_IMAGE_BYTES) {
 throw new BlobValidationError(
 `Image too large: ${sizeBytes} bytes. Max ${MAX_IMAGE_BYTES} bytes.`
 );
 }
 // Валидация slug — только безопасные символы для имени файла
 if (!/^[a-z0-9_-]{1,64}$/.test(slug)) {
 throw new BlobValidationError(
 `Invalid slug for filename: ${slug}. Allowed: a-z, 0-9, _, -, 1..64 chars.`
 );
 }

 const ext = mimeToExt(contentType);
 // Имя файла: catalog/<slug>-<timestamp>.<ext>
 // timestamp нужен, чтобы при перезаливке (новая иконка для того же оффера)
 // CDN не отдавал старую кэшированную картинку.
 const pathname = `catalog/${slug}-${Date.now()}.${ext}`;

 const blob = await put(pathname, data as Blob, {
 access: 'public',
 contentType,
 // Кешировать у клиента/CDN надолго — иконки редко меняются,
 // а при замене мы получаем новый pathname (с новым timestamp).
 cacheControlMaxAge: 60 * 60 * 24 * 30, // 30 дней
 addRandomSuffix: false,
 });

 return blob.url;
}

function mimeToExt(mime: string): string {
 switch (mime) {
 case 'image/png': return 'png';
 case 'image/jpeg': return 'jpg';
 case 'image/webp': return 'webp';
 case 'image/gif': return 'gif';
 default: return 'bin';
 }
}

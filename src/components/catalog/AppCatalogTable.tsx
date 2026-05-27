'use client';

import { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Таблица каталога для одного приложения.
 *
 * Этап 4.3.b — реальные действия:
 * - Модалки "Добавить" / "Редактировать".
 * - Черновик правок в React state (теряется при перезагрузке).
 * - Кнопка "Применить изменения" с модалкой подтверждения.
 * - Гибридный UX после применения: refresh + плашка "Применено".
 *
 * Порядок строк определяется на серверной стороне (page.tsx).
 */

export type CatalogRow = {
 slug: string;
 title: string;
 image_url: string | null;
 status:
 | 'placed'
 | 'not_placed'
 | 'hidden_in_catalog'
 | 'outside_catalog';
 url: string | null;
 enabled: boolean | null;
 firestore_doc_id: string | null;
 is_duplicate: boolean;
 duplicate_doc_ids: string[];
};

export type OutsideCatalogRow = {
 doc_id: string;
 slug: string | null;
 title: string | null;
 url_value: string | null;
 url_field_name: 'url' | 'site' | null;
 active: boolean | null;
};

type Props = {
 appId: string;
 appName: string;
 rows: CatalogRow[];
 outside: OutsideCatalogRow[];
};

// --- Типы черновика ---

type DraftAction =
 | { type: 'add'; slug: string; url: string; active: boolean }
 | { type: 'update'; slug: string; url: string; active: boolean }
 | { type: 'hide'; slug: string };

type DraftMap = Map<string, DraftAction>;

// --- Главный компонент ---

export default function AppCatalogTable({ appId, appName, rows, outside }: Props) {
 const router = useRouter();

 // Черновик правок: slug → действие.
 const [drafts, setDrafts] = useState<DraftMap>(new Map());

 // Модалка редактирования/добавления: null = закрыто.
 const [editingSlug, setEditingSlug] = useState<string | null>(null);

 // Модалка подтверждения применения.
 const [confirmOpen, setConfirmOpen] = useState(false);

 // Состояние процесса применения.
 const [applying, setApplying] = useState(false);
 const [applyResult, setApplyResult] = useState<{
 appliedCount: number;
 failed: { slug: string; error: string }[];
 } | null>(null);

 // Плашка "Применено" — true на ~3 секунды после успеха.
 const [showAppliedBanner, setShowAppliedBanner] = useState(false);

 useEffect(() => {
 if (!showAppliedBanner) return;
 const t = setTimeout(() => setShowAppliedBanner(false), 3000);
 return () => clearTimeout(t);
 }, [showAppliedBanner]);

 // --- Действия с черновиком ---

 const setDraft = (slug: string, action: DraftAction | null) => {
 setDrafts((prev) => {
 const next = new Map(prev);
 if (action === null) {
 next.delete(slug);
 } else {
 next.set(slug, action);
 }
 return next;
 });
 };

 const clearAllDrafts = () => setDrafts(new Map());

 // Индекс строк по slug — для быстрого доступа из модалки.
 const rowBySlug = useMemo(() => {
 const m = new Map<string, CatalogRow>();
 rows.forEach((r) => m.set(r.slug, r));
 return m;
 }, [rows]);

 const editingRow = editingSlug ? rowBySlug.get(editingSlug) || null : null;
 const editingDraft = editingSlug ? drafts.get(editingSlug) || null : null;

 // --- Применение черновика ---

 const handleApply = async () => {
 if (drafts.size === 0) return;
 setApplying(true);
 setApplyResult(null);

 const actions: DraftAction[] = Array.from(drafts.values());

 try {
 const resp = await fetch('/api/admin/catalog/apply', {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({ app_id: appId, actions }),
 });
 const data = (await resp.json()) as {
 applied?: number;
 failed?: number;
 results?: { slug: string; status: string; error?: string }[];
 };

 const failed = (data.results || [])
 .filter((r) => r.status === 'error')
 .map((r) => ({ slug: r.slug, error: r.error || 'unknown' }));

 setApplyResult({
 appliedCount: data.applied || 0,
 failed,
 });

 // Очищаем драфты, которые УСПЕШНО применились.
 // Неудачные оставляем — пользователь увидит ошибку и решит что делать.
 const failedSlugs = new Set(failed.map((f) => f.slug));
 setDrafts((prev) => {
 const next = new Map<string, DraftAction>();
 for (const [slug, action] of prev) {
 if (failedSlugs.has(slug)) {
 next.set(slug, action);
 }
 }
 return next;
 });

 if (failed.length === 0) {
 setShowAppliedBanner(true);
 setConfirmOpen(false);
 }
 // Обновляем данные страницы (Firestore теперь обновлён)
 router.refresh();
 } catch (e: unknown) {
 const msg = e instanceof Error ? e.message : String(e);
 setApplyResult({
 appliedCount: 0,
 failed: actions.map((a) => ({ slug: a.slug, error: `network: ${msg}` })),
 });
 } finally {
 setApplying(false);
 }
 };

 return (
 <div className="space-y-12">
 {/* Плашка "Применено" */}
 {showAppliedBanner && (
 <div
 className="
 fixed top-20 left-1/2 -translate-x-1/2 z-50
 px-4 py-2 rounded-md
 bg-black text-white text-sm
 shadow-lg
 "
 >
 Изменения применены
 </div>
 )}

 {/* Панель управления черновиком */}
 <DraftPanel
 draftsCount={drafts.size}
 onApply={() => setConfirmOpen(true)}
 onCancel={clearAllDrafts}
 />

 <CatalogSection
 rows={rows}
 drafts={drafts}
 onEdit={(slug) => setEditingSlug(slug)}
 />
 {outside.length > 0 && (
 <OutsideSection rows={outside} />
 )}

 {/* Модалка редактирования / добавления */}
 {editingRow && (
 <EditModal
 row={editingRow}
 draft={editingDraft}
 appName={appName}
 onClose={() => setEditingSlug(null)}
 onSave={(action) => {
 setDraft(editingRow.slug, action);
 setEditingSlug(null);
 }}
 onRemoveDraft={() => {
 setDraft(editingRow.slug, null);
 setEditingSlug(null);
 }}
 />
 )}

 {/* Модалка подтверждения применения */}
 {confirmOpen && (
 <ConfirmApplyModal
 drafts={drafts}
 rows={rows}
 appName={appName}
 applying={applying}
 applyResult={applyResult}
 onClose={() => {
 setConfirmOpen(false);
 setApplyResult(null);
 }}
 onConfirm={handleApply}
 />
 )}
 </div>
 );
}

// -------- Панель управления черновиком (фиксированная сверху) --------

function DraftPanel({
 draftsCount,
 onApply,
 onCancel,
}: {
 draftsCount: number;
 onApply: () => void;
 onCancel: () => void;
}) {
 const hasDrafts = draftsCount > 0;
 return (
 <div className="flex items-center justify-end gap-3 mb-4">
 {hasDrafts && (
 <span className="text-sm text-[#666]">
 Изменений: <span className="text-black font-medium">{draftsCount}</span>
 </span>
 )}
 <button
 type="button"
 onClick={onCancel}
 disabled={!hasDrafts}
 className={`
 inline-flex items-center justify-center
 px-3 py-1.5 text-xs font-medium
 border rounded-md
 transition-colors
 ${hasDrafts
 ? 'border-[#eaeaea] text-black bg-white hover:border-black hover:bg-[#fafafa]'
 : 'border-[#eaeaea] text-[#bbb] bg-white cursor-not-allowed'}
 `}
 >
 Отменить изменения
 </button>
 <button
 type="button"
 onClick={onApply}
 disabled={!hasDrafts}
 className={`
 inline-flex items-center justify-center
 px-4 py-1.5 text-xs font-medium
 rounded-md transition-colors
 ${hasDrafts
 ? 'bg-black text-white hover:bg-[#333]'
 : 'bg-[#eaeaea] text-[#999] cursor-not-allowed'}
 `}
 >
 Применить изменения
 </button>
 </div>
 );
}

// -------- Секция каталога --------

function CatalogSection({
 rows,
 drafts,
 onEdit,
}: {
 rows: CatalogRow[];
 drafts: DraftMap;
 onEdit: (slug: string) => void;
}) {
 return (
 <section>
 <div className="rounded-md border border-[#eaeaea] overflow-hidden">
 <table className="w-full text-sm">
 <thead>
 <tr className="bg-[#fafafa] border-b border-[#eaeaea]">
 <th className="text-left py-3 px-4 text-xs font-medium text-[#666] w-12"></th>
 <th className="text-left py-3 px-4 text-xs font-medium text-[#666]">
 Оффер
 </th>
 <th className="text-left py-3 px-4 text-xs font-medium text-[#666] w-40">
 Статус
 </th>
 <th className="text-left py-3 px-4 text-xs font-medium text-[#666]">
 URL
 </th>
 <th className="text-right py-3 px-4 text-xs font-medium text-[#666] w-36">
 Действия
 </th>
 </tr>
 </thead>
 <tbody>
 {rows.map((r) => (
 <CatalogTableRow
 key={r.slug}
 row={r}
 draft={drafts.get(r.slug) || null}
 onEdit={() => onEdit(r.slug)}
 />
 ))}
 </tbody>
 </table>
 </div>
 </section>
 );
}

function CatalogTableRow({
 row,
 draft,
 onEdit,
}: {
 row: CatalogRow;
 draft: DraftAction | null;
 onEdit: () => void;
}) {
 // Эффективные значения с учётом черновика
 const effective = useMemo(() => {
 if (!draft) {
 return {
 status: row.status,
 url: row.url,
 };
 }
 if (draft.type === 'hide') {
 return { status: 'hidden_in_catalog' as CatalogRow['status'], url: row.url };
 }
 if (draft.type === 'add' || draft.type === 'update') {
 return {
 status: draft.active
 ? ('placed' as CatalogRow['status'])
 : ('hidden_in_catalog' as CatalogRow['status']),
 url: draft.url,
 };
 }
 return { status: row.status, url: row.url };
 }, [row, draft]);

 return (
 <tr
 className={`
 border-b border-[#f0f0f0] last:border-b-0 hover:bg-[#fafafa]
 transition-colors
 ${draft ? 'bg-[#fffbea]' : ''}
 `}
 >
 <td className="py-3 px-4 align-middle">
 <OfferIcon imageUrl={row.image_url} title={row.title} />
 </td>
 <td className="py-3 px-4 align-middle">
 <div className="font-medium text-black">
 {row.title}
 {draft && (
 <span className="ml-2 text-[10px] text-[#a06000] uppercase tracking-wide">
 изменено
 </span>
 )}
 </div>
 <div className="text-xs text-[#999] mt-0.5">{row.slug}</div>
 </td>
 <td className="py-3 px-4 align-middle">
 <StatusBadge
 status={effective.status}
 isDuplicate={row.is_duplicate}
 duplicateDocIds={row.duplicate_doc_ids}
 />
 </td>
 <td className="py-3 px-4 align-middle">
 <UrlCell url={effective.url} />
 </td>
 <td className="py-3 px-4 align-middle text-right">
 <ActionButton row={row} draft={draft} onEdit={onEdit} />
 </td>
 </tr>
 );
}

// -------- Иконка оффера --------

function OfferIcon({
 imageUrl,
 title,
}: {
 imageUrl: string | null;
 title: string;
}) {
 const [errored, setErrored] = useState(false);
 const firstLetter = (title || '?').trim().charAt(0).toUpperCase();

 if (!imageUrl || errored) {
 return (
 <div
 className="
 w-8 h-8 rounded-sm bg-[#f0f0f0] text-[#666]
 flex items-center justify-center
 text-sm font-medium
 "
 aria-label={`Иконка оффера ${title}`}
 >
 {firstLetter}
 </div>
 );
 }

 return (
 // eslint-disable-next-line @next/next/no-img-element
 <img
 src={imageUrl}
 alt={`Иконка ${title}`}
 width={32}
 height={32}
 className="w-8 h-8 rounded-sm object-cover bg-[#f0f0f0]"
 onError={() => setErrored(true)}
 loading="lazy"
 />
 );
}

// -------- Бейдж статуса --------

function StatusBadge({
 status,
 isDuplicate,
 duplicateDocIds,
}: {
 status: CatalogRow['status'];
 isDuplicate: boolean;
 duplicateDocIds: string[];
}) {
 const baseClass = 'inline-flex items-center gap-1.5 text-xs';

 if (status === 'placed') {
 return (
 <span className={`${baseClass} text-black`}>
 <span className="w-1.5 h-1.5 rounded-full bg-black" />
 Добавлен
 {isDuplicate && (
 <span
 className="ml-1 text-[#a06000]"
 title={`Дубль: документы ${duplicateDocIds.join(', ')}`}
 >
 (дубль)
 </span>
 )}
 </span>
 );
 }
 if (status === 'not_placed') {
 return (
 <span className={`${baseClass} text-[#999]`}>
 <span className="w-1.5 h-1.5 rounded-full bg-[#ccc]" />
 Не добавлен
 </span>
 );
 }
 if (status === 'hidden_in_catalog') {
 return (
 <span className={`${baseClass} text-[#a06000]`}>
 <span className="w-1.5 h-1.5 rounded-full bg-[#cc9900]" />
 Скрыт
 </span>
 );
 }
 return (
 <span className={`${baseClass} text-[#666]`}>
 <span className="w-1.5 h-1.5 rounded-full bg-[#999]" />
 Вне каталога
 </span>
 );
}

// -------- Ячейка с URL --------

function UrlCell({ url }: { url: string | null }) {
 if (!url) {
 return <span className="text-xs text-[#bbb]">—</span>;
 }
 let display = url;
 try {
 const u = new URL(url);
 const segs = u.pathname.split('/').filter(Boolean);
 const hash = segs[0] || '';
 const base = hash ? `${u.host}/${hash}` : u.host;
 const slugParam = u.searchParams.get('aff_sub3');
 display = slugParam ? `${base} · ${slugParam}` : base;
 } catch {
 // ignore
 }
 return (
 <span
 className="text-xs text-[#666] font-mono truncate inline-block max-w-[280px] align-middle"
 title={url}
 >
 {display}
 </span>
 );
}

// -------- Кнопка действия --------

function ActionButton({
 row,
 draft,
 onEdit,
}: {
 row: CatalogRow;
 draft: DraftAction | null;
 onEdit: () => void;
}) {
 // Определяем что показывать на кнопке
 let label: string;
 if (draft) {
 // Есть черновик — кнопка всегда "Изменить"
 label = 'Изменить';
 } else if (row.status === 'placed' || row.status === 'hidden_in_catalog') {
 label = 'Редактировать';
 } else if (row.status === 'outside_catalog') {
 label = 'Связать';
 } else {
 label = 'Добавить';
 }

 // "Связать" пока без логики — заглушка на будущее.
 if (row.status === 'outside_catalog' && !draft) {
 return (
 <button
 type="button"
 onClick={() => alert('«Связать» — отдельная функция, появится позже.')}
 className="
 inline-flex items-center justify-center
 px-3 py-1.5 text-xs font-medium
 border border-[#eaeaea] rounded-md
 text-black bg-white
 hover:border-black hover:bg-[#fafafa]
 transition-colors
 "
 >
 {label}
 </button>
 );
 }

 return (
 <button
 type="button"
 onClick={onEdit}
 className="
 inline-flex items-center justify-center
 px-3 py-1.5 text-xs font-medium
 border border-[#eaeaea] rounded-md
 text-black bg-white
 hover:border-black hover:bg-[#fafafa]
 transition-colors
 "
 >
 {label}
 </button>
 );
}

// -------- Модалка редактирования / добавления --------

function EditModal({
 row,
 draft,
 appName,
 onClose,
 onSave,
 onRemoveDraft,
}: {
 row: CatalogRow;
 draft: DraftAction | null;
 appName: string;
 onClose: () => void;
 onSave: (action: DraftAction) => void;
 onRemoveDraft: () => void;
}) {
 // Режим: добавление (нет в Firestore) или редактирование
 const isAddMode =
 row.status === 'not_placed' &&
 (draft === null || draft.type === 'add');

 // Начальные значения для формы
 const initialUrl =
 (draft && draft.type !== 'hide' && draft.url) ||
 row.url ||
 '';
 const initialActive =
 (draft && draft.type !== 'hide' && draft.active) ??
 (row.enabled ?? true);

 const [url, setUrl] = useState(initialUrl);
 const [active, setActive] = useState(initialActive);

 const canSave = url.trim().length > 0;

 const handleSave = () => {
 if (!canSave) return;
 const action: DraftAction = isAddMode
 ? { type: 'add', slug: row.slug, url: url.trim(), active }
 : { type: 'update', slug: row.slug, url: url.trim(), active };
 onSave(action);
 };

 const handleHide = () => {
 onSave({ type: 'hide', slug: row.slug });
 };

 return (
 <ModalShell onClose={onClose}>
 <div className="text-sm text-[#666] mb-1">
 {appName}
 </div>
 <h3 className="text-lg font-semibold text-black mb-1">
 {isAddMode ? 'Добавить' : 'Редактировать'}: {row.title}
 </h3>
 <p className="text-xs text-[#999] mb-6">{row.slug}</p>

 <div className="space-y-5">
 <div>
 <label className="block text-xs font-medium text-black mb-1.5">
 Ссылка трекинга
 </label>
 <input
 type="url"
 value={url}
 onChange={(e) => setUrl(e.target.value)}
 placeholder="https://imperionex.online/..."
 className="
 w-full px-3 py-2 text-sm
 border border-[#eaeaea] rounded-md
 focus:outline-none focus:border-black
 font-mono
 "
 autoFocus
 />
 <p className="mt-1.5 text-xs text-[#999]">
 Ссылка из Keitaro для этого приложения. Должна содержать
 параметры aff_sub1, aff_sub3.
 </p>
 </div>

 <label className="flex items-center gap-2 text-sm text-black cursor-pointer">
 <input
 type="checkbox"
 checked={active}
 onChange={(e) => setActive(e.target.checked)}
 className="w-4 h-4 accent-black"
 />
 Активен
 </label>
 </div>

 <div className="mt-8 flex items-center justify-between gap-3">
 <div>
 {!isAddMode && (
 <button
 type="button"
 onClick={handleHide}
 className="
 text-xs text-[#c00000] hover:underline
 "
 title="Оффер будет помечен как скрытый в этом приложении"
 >
 Убрать из приложения
 </button>
 )}
 {draft && (
 <button
 type="button"
 onClick={onRemoveDraft}
 className="
 text-xs text-[#666] hover:text-black hover:underline ml-4
 "
 >
 Удалить черновик
 </button>
 )}
 </div>
 <div className="flex items-center gap-2">
 <button
 type="button"
 onClick={onClose}
 className="
 inline-flex items-center justify-center
 px-4 py-2 text-xs font-medium
 border border-[#eaeaea] rounded-md
 text-black bg-white
 hover:border-black hover:bg-[#fafafa]
 transition-colors
 "
 >
 Отмена
 </button>
 <button
 type="button"
 onClick={handleSave}
 disabled={!canSave}
 className={`
 inline-flex items-center justify-center
 px-4 py-2 text-xs font-medium
 rounded-md transition-colors
 ${canSave
 ? 'bg-black text-white hover:bg-[#333]'
 : 'bg-[#eaeaea] text-[#999] cursor-not-allowed'}
 `}
 >
 {isAddMode ? 'Добавить' : 'Сохранить'}
 </button>
 </div>
 </div>
 </ModalShell>
 );
}

// -------- Модалка подтверждения применения --------

function ConfirmApplyModal({
 drafts,
 rows,
 appName,
 applying,
 applyResult,
 onClose,
 onConfirm,
}: {
 drafts: DraftMap;
 rows: CatalogRow[];
 appName: string;
 applying: boolean;
 applyResult: { appliedCount: number; failed: { slug: string; error: string }[] } | null;
 onClose: () => void;
 onConfirm: () => void;
}) {
 const rowBySlug = useMemo(() => {
 const m = new Map<string, CatalogRow>();
 rows.forEach((r) => m.set(r.slug, r));
 return m;
 }, [rows]);

 const failedSlugs = useMemo(
 () => new Set((applyResult?.failed || []).map((f) => f.slug)),
 [applyResult]
 );
 const failedErrorBySlug = useMemo(() => {
 const m = new Map<string, string>();
 (applyResult?.failed || []).forEach((f) => m.set(f.slug, f.error));
 return m;
 }, [applyResult]);

 const actions = Array.from(drafts.values());

 // Если все правки применились без ошибок — модалку показываем
 // долю секунды (родительский компонент сам её закроет через setConfirmOpen(false)).
 // Если есть failed — оставляем модалку с детализацией.

 return (
 <ModalShell onClose={applying ? () => {} : onClose} wide>
 <div className="text-sm text-[#666] mb-1">{appName}</div>
 <h3 className="text-lg font-semibold text-black mb-4">
 Применить {drafts.size} {pluralChanges(drafts.size)}
 </h3>

 <div className="rounded-md border border-[#eaeaea] divide-y divide-[#f0f0f0] max-h-[40vh] overflow-y-auto">
 {actions.map((action) => {
 const row = rowBySlug.get(action.slug);
 if (!row) return null;
 const hasError = failedSlugs.has(action.slug);
 return (
 <div
 key={action.slug}
 className={`px-4 py-3 text-sm ${hasError ? 'bg-[#fff5f5]' : ''}`}
 >
 <div className="flex items-start justify-between gap-3">
 <div className="min-w-0">
 <div className="font-medium text-black">
 {labelForActionType(action.type)}: {row.title}
 </div>
 <div className="text-xs text-[#999] mt-0.5">{row.slug}</div>
 </div>
 {applyResult && (
 <span className="text-xs shrink-0">
 {hasError ? (
 <span className="text-[#c00000]">ошибка</span>
 ) : (
 <span className="text-[#0a7500]">применено</span>
 )}
 </span>
 )}
 </div>

 {/* Подробности правки */}
 {action.type !== 'hide' && (
 <div className="mt-2 text-xs space-y-1">
 {row.url && row.url !== action.url && (
 <div className="text-[#666]">
 URL: <span className="font-mono text-[#999] line-through">{shortenUrl(row.url)}</span>{' '}
 → <span className="font-mono text-black">{shortenUrl(action.url)}</span>
 </div>
 )}
 {!row.url && (
 <div className="text-[#666]">
 URL: <span className="font-mono text-black">{shortenUrl(action.url)}</span>
 </div>
 )}
 {(row.enabled !== null && row.enabled !== action.active) && (
 <div className="text-[#666]">
 Активен: {row.enabled ? 'да' : 'нет'} → {action.active ? 'да' : 'нет'}
 </div>
 )}
 </div>
 )}

 {action.type === 'hide' && (
 <div className="mt-2 text-xs text-[#666]">
 Документ останется в Firestore, но будет скрыт на витрине.
 </div>
 )}

 {hasError && (
 <div className="mt-2 text-xs text-[#c00000]">
 {failedErrorBySlug.get(action.slug)}
 </div>
 )}
 </div>
 );
 })}
 </div>

 {applyResult && applyResult.failed.length > 0 && (
 <div className="mt-4 text-xs text-[#666]">
 Успешно применено: {applyResult.appliedCount}, ошибок: {applyResult.failed.length}.
 Неудачные правки остались в черновике — закрой это окно, исправь и попробуй снова.
 </div>
 )}

 <div className="mt-6 flex items-center justify-end gap-2">
 <button
 type="button"
 onClick={onClose}
 disabled={applying}
 className={`
 inline-flex items-center justify-center
 px-4 py-2 text-xs font-medium
 border border-[#eaeaea] rounded-md
 text-black bg-white transition-colors
 ${applying ? 'opacity-50 cursor-not-allowed' : 'hover:border-black hover:bg-[#fafafa]'}
 `}
 >
 {applyResult ? 'Закрыть' : 'Отмена'}
 </button>
 {!applyResult && (
 <button
 type="button"
 onClick={onConfirm}
 disabled={applying}
 className={`
 inline-flex items-center justify-center
 px-4 py-2 text-xs font-medium
 rounded-md transition-colors
 ${applying
 ? 'bg-[#eaeaea] text-[#999] cursor-not-allowed'
 : 'bg-black text-white hover:bg-[#333]'}
 `}
 >
 {applying ? 'Применяю...' : 'Применить'}
 </button>
 )}
 </div>
 </ModalShell>
 );
}

// -------- Каркас модалки --------

function ModalShell({
 children,
 onClose,
 wide,
}: {
 children: React.ReactNode;
 onClose: () => void;
 wide?: boolean;
}) {
 // Закрытие по Escape
 useEffect(() => {
 const handler = (e: KeyboardEvent) => {
 if (e.key === 'Escape') onClose();
 };
 window.addEventListener('keydown', handler);
 return () => window.removeEventListener('keydown', handler);
 }, [onClose]);

 return (
 <div
 className="
 fixed inset-0 z-40
 bg-black/40 backdrop-blur-sm
 flex items-center justify-center
 p-4
 "
 onClick={onClose}
 >
 <div
 className={`
 bg-white rounded-md border border-[#eaeaea]
 shadow-xl p-6
 ${wide ? 'w-full max-w-[640px]' : 'w-full max-w-[480px]'}
 `}
 onClick={(e) => e.stopPropagation()}
 >
 {children}
 </div>
 </div>
 );
}

// -------- Секция «Вне каталога» --------

function OutsideSection({ rows }: { rows: OutsideCatalogRow[] }) {
 return (
 <section>
 <div className="mb-4">
 <h2 className="text-base font-semibold text-black">
 Офферы вне каталога
 </h2>
 <p className="mt-1 text-xs text-[#666]">
 {rows.length} офферов в Firestore этого приложения не входят в каталог.
 Управляются вручную через Firebase.
 </p>
 </div>
 <div className="rounded-md border border-[#eaeaea] overflow-hidden">
 <table className="w-full text-sm">
 <thead>
 <tr className="bg-[#fafafa] border-b border-[#eaeaea]">
 <th className="text-left py-3 px-4 text-xs font-medium text-[#666]">
 Документ
 </th>
 <th className="text-left py-3 px-4 text-xs font-medium text-[#666] w-32">
 Slug
 </th>
 <th className="text-left py-3 px-4 text-xs font-medium text-[#666]">
 URL
 </th>
 <th className="text-left py-3 px-4 text-xs font-medium text-[#666] w-24">
 Active
 </th>
 </tr>
 </thead>
 <tbody>
 {rows.map((r) => (
 <tr
 key={r.doc_id}
 className="border-b border-[#f0f0f0] last:border-b-0 hover:bg-[#fafafa] transition-colors"
 >
 <td className="py-3 px-4 align-middle">
 <div className="font-medium text-black truncate">
 {r.title || <span className="text-[#999]">—</span>}
 </div>
 <div className="text-xs text-[#999] mt-0.5 font-mono truncate max-w-[260px]">
 {r.doc_id}
 </div>
 </td>
 <td className="py-3 px-4 align-middle">
 {r.slug ? (
 <span className="text-xs text-[#666] font-mono">{r.slug}</span>
 ) : (
 <span className="text-xs text-[#bbb]">—</span>
 )}
 </td>
 <td className="py-3 px-4 align-middle">
 <UrlCell url={r.url_value} />
 </td>
 <td className="py-3 px-4 align-middle">
 {r.active === null ? (
 <span className="text-xs text-[#bbb]">—</span>
 ) : r.active ? (
 <span className="text-xs text-black">да</span>
 ) : (
 <span className="text-xs text-[#999]">нет</span>
 )}
 </td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>
 </section>
 );
}

// -------- Утилиты --------

function labelForActionType(t: DraftAction['type']): string {
 if (t === 'add') return 'Добавить';
 if (t === 'update') return 'Изменить';
 return 'Скрыть';
}

function shortenUrl(url: string): string {
 try {
 const u = new URL(url);
 const segs = u.pathname.split('/').filter(Boolean);
 const hash = segs[0] || '';
 const base = hash ? `${u.host}/${hash}` : u.host;
 const slugParam = u.searchParams.get('aff_sub3');
 return slugParam ? `${base} · ${slugParam}` : base;
 } catch {
 return url;
 }
}

function pluralChanges(n: number): string {
 // 1 изменение, 2 изменения, 5 изменений
 const m10 = n % 10;
 const m100 = n % 100;
 if (m100 >= 11 && m100 <= 14) return 'изменений';
 if (m10 === 1) return 'изменение';
 if (m10 >= 2 && m10 <= 4) return 'изменения';
 return 'изменений';
}

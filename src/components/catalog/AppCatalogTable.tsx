'use client';

import { useState } from 'react';

/**
 * Таблица каталога для одного приложения.
 *
 * На Этапе 4.2 — только просмотр + заглушки на кнопках.
 * На Этапе 4.3 будут добавлены модалки "Разложить"/"Редактировать",
 * черновик изменений и кнопка "Применить".
 */

export type CatalogRow = {
  slug: string;
  title: string;
  image_url: string | null;
  status:
    | 'placed'           // Разложен через каталог, активен в Firestore
    | 'not_placed'       // Не разложен (в каталоге нет связки с этим приложением)
    | 'hidden_in_catalog' // В каталоге enabled=false (на будущее, сейчас не используется)
    | 'outside_catalog'; // Документ в Firestore есть, но каталог им не управляет
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

export default function AppCatalogTable({ appId, appName, rows, outside }: Props) {
  return (
    <div className="space-y-12">
      <CatalogSection rows={rows} appId={appId} appName={appName} />
      {outside.length > 0 && (
        <OutsideSection rows={outside} appName={appName} />
      )}
    </div>
  );
}

// -------- Основная секция — 28 офферов каталога --------

function CatalogSection({
  rows,
  appId,
  appName,
}: {
  rows: CatalogRow[];
  appId: string;
  appName: string;
}) {
  return (
    <section>
      <div className="rounded-md border border-[#eaeaea] overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-[#fafafa] border-b border-[#eaeaea]">
              <th className="text-left py-3 px-4 text-xs font-medium text-[#666] w-12">
                {/* иконка */}
              </th>
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
                appId={appId}
                appName={appName}
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
  appId,
  appName,
}: {
  row: CatalogRow;
  appId: string;
  appName: string;
}) {
  return (
    <tr className="border-b border-[#f0f0f0] last:border-b-0 hover:bg-[#fafafa] transition-colors">
      <td className="py-3 px-4 align-middle">
        <OfferIcon imageUrl={row.image_url} title={row.title} />
      </td>
      <td className="py-3 px-4 align-middle">
        <div className="font-medium text-black">{row.title}</div>
        <div className="text-xs text-[#999] mt-0.5">{row.slug}</div>
      </td>
      <td className="py-3 px-4 align-middle">
        <StatusBadge row={row} />
      </td>
      <td className="py-3 px-4 align-middle">
        <UrlCell url={row.url} />
      </td>
      <td className="py-3 px-4 align-middle text-right">
        <ActionButton row={row} appId={appId} appName={appName} />
      </td>
    </tr>
  );
}

// -------- Иконка оффера (с фолбэком на первую букву) --------

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

  // Используем обычный <img>, а не next/image, потому что URL'ы
  // могут быть с разных хостингов (allwebs.ru, vercel-storage, и др.),
  // и настраивать domains для каждого хостинга в next.config — лишнее.
  // Для иконок 32x32 это нормальная практика.
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

function StatusBadge({ row }: { row: CatalogRow }) {
  const baseClass = 'inline-flex items-center gap-1.5 text-xs';

  if (row.status === 'placed') {
    return (
      <span className={`${baseClass} text-black`}>
        <span className="w-1.5 h-1.5 rounded-full bg-black" />
        Разложен
        {row.is_duplicate && (
          <span
            className="ml-1 text-[#a06000]"
            title={`Дубль: документы ${row.duplicate_doc_ids.join(', ')}`}
          >
            (дубль)
          </span>
        )}
      </span>
    );
  }
  if (row.status === 'not_placed') {
    return (
      <span className={`${baseClass} text-[#999]`}>
        <span className="w-1.5 h-1.5 rounded-full bg-[#ccc]" />
        Не разложен
      </span>
    );
  }
  if (row.status === 'hidden_in_catalog') {
    return (
      <span className={`${baseClass} text-[#a06000]`}>
        <span className="w-1.5 h-1.5 rounded-full bg-[#cc9900]" />
        Скрыт
      </span>
    );
  }
  // outside_catalog
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
  // Показываем "домен/хеш" — это первый сегмент пути.
  let display = url;
  try {
    const u = new URL(url);
    const segs = u.pathname.split('/').filter(Boolean);
    const hash = segs[0] || '';
    display = hash ? `${u.host}/${hash}` : u.host;
  } catch {
    // оставим url как есть
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

// -------- Кнопка действия (заглушка для Этапа 4.2) --------

function ActionButton({
  row,
  appId,
  appName,
}: {
  row: CatalogRow;
  appId: string;
  appName: string;
}) {
  const handleClick = () => {
    const verb =
      row.status === 'placed' || row.status === 'hidden_in_catalog'
        ? 'Редактировать'
        : row.status === 'outside_catalog'
        ? 'Связать'
        : 'Разложить';
    alert(
      `Скоро будет: «${verb}» для ${row.title} в ${appName}.\n` +
        `Этап 4.3 — действия каталога.`
    );
  };

  let label: string;
  if (row.status === 'placed' || row.status === 'hidden_in_catalog') {
    label = 'Редактировать';
  } else if (row.status === 'outside_catalog') {
    label = 'Связать';
  } else {
    label = 'Разложить';
  }

  return (
    <button
      type="button"
      onClick={handleClick}
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

// -------- Секция «Вне каталога» --------

function OutsideSection({
  rows,
  appName,
}: {
  rows: OutsideCatalogRow[];
  appName: string;
}) {
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

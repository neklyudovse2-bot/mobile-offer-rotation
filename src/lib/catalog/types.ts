/**
 * Типы данных каталога офферов.
 * Эти типы соответствуют структуре таблиц в Neon:
 * catalog_offers
 * catalog_offer_placements
 */

export type CatalogOffer = {
 /** Уникальный slug оффера (= aff_sub3 в URL). PK. */
 slug: string;
 /** Человекочитаемое название оффера для админки и для title в Firestore. */
 title: string;
 /** URL иконки. Может быть из Vercel Blob или внешний (на старте). null = иконка не задана. */
 image_url: string | null;
 /** Когда запись создана в каталоге. */
 created_at: Date;
 /** Когда запись последний раз обновлена. */
 updated_at: Date;
};

export type CatalogPlacement = {
 /** Внутренний ID строки (BIGSERIAL). */
 id: number;
 /** Slug оффера. FK на catalog_offers.slug. */
 slug: string;
 /** ID приложения. Например 'ios-9', 'ios-3', 'clario'. */
 app_id: string;
 /** Трекинговая ссылка для этой пары (оффер × приложение). */
 url: string;
 /** Активна ли раскладка. false = оффер числится в каталоге, но в приложение не льётся. */
 enabled: boolean;
 /** ID документа в Firestore (если оффер уже в Firestore). null = ещё не разложен. */
 firestore_doc_id: string | null;
 created_at: Date;
 updated_at: Date;
};

/** Состояние оффера в конкретном приложении (как видит каталог). */
export type PlacementStatus =
 | 'placed' // Разложен через каталог: есть в catalog_offer_placements + есть в Firestore.
 | 'not_placed' // Не разложен: нет в catalog_offer_placements (или enabled=false).
 | 'outside_catalog' // Документ в Firestore есть, но каталог им не управляет (firestore_doc_id не привязан).
 | 'duplicate'; // В Firestore два документа с одним slug в одном приложении.

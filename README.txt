=== РЕДИЗАЙН ROTATION ADMIN — VERCEL STYLE ===

Структура архива повторяет структуру проекта.
Распакуй и скопируй файлы в проект, перезаписывая существующие.

После распаковки структура будет такая:

src/
├── app/
│   ├── globals.css                               <- заменить
│   ├── layout.tsx                                <- заменить
│   └── admin/
│       ├── page.tsx                              <- заменить
│       ├── offers/
│       │   └── [app_id]/
│       │       └── page.tsx                      <- заменить
│       └── stats/
│           ├── page.tsx                          <- заменить
│           └── [app_id]/
│               └── page.tsx                      <- заменить
└── components/
    ├── AdminNav.tsx                              <- заменить
    ├── AggregatedStatsTable.tsx                  <- заменить
    ├── OfferSettings.tsx                         <- заменить
    └── RecalculateButton.tsx                     <- заменить

ВАЖНО: 
- Заменить ЦЕЛИКОМ, не править построчно.
- НЕ ТРОГАТЬ файлы в src/lib/, src/config/, src/app/api/.
- Если build ругается на TypeScript — исправь только типы, JSX и className не трогай.
- Деплой через push в main.
- После деплоя — 4 скрина (admin, stats, stats/ios-9, offers/ios-9).

Подробности в INSTRUCTIONS.txt

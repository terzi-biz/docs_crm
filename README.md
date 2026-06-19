# Terzi Docs CRM

Внутрішнє веб-застосування для автоматизації підготовки документів
(договір, кошторис, рахунок) для будівельної компанії.

## Стек

- Backend: Node.js + Express + SQLite (better-sqlite3)
- Frontend: React + TypeScript + Tailwind CSS (Vite)
- Генерація документів: docxtemplater (DOCX) + LibreOffice headless (DOCX → PDF)

## Запуск (розробка)

```bash
npm install --workspaces
npm run dev:server   # http://localhost:4000
npm run dev:client   # http://localhost:5173 (проксує /api на 4000)
```

DOCX-шаблони (`server/src/templates/*.docx`) згенеровані з
`server/scripts/build_templates.py` (потребує `python-docx`) — їх можна
відредагувати безпосередньо в Word, зберігаючи теги `{tag}` для
docxtemplater.

## Тестові облікові записи

Створюються автоматично при першому запуску (`server/src/db/index.js`):

| Email | Пароль | Роль |
|---|---|---|
| admin@terzi.biz | changeme123 | administrator |
| manager1@terzi.biz | changeme123 | manager |
| manager2@terzi.biz | changeme123 | manager |
| manager3@terzi.biz | changeme123 | manager |

**Змініть ці паролі перед використанням у production.**

## Примітка щодо PDF

Конвертація DOCX → PDF використовує `soffice --headless`. Якщо LibreOffice
у середовищі розгортання не може виконати рендеринг (відсутні
залежності/шрифти), система продовжує зберігати DOCX, а PDF-посилання
просто не з'являється для цього документа — це не блокує генерацію
пакету документів.

## Подальші кроки (версія 2)

Архітектура передбачає підключення інтеграції KeyCRM (пошук угоди за
`keycrm_deal_number`, завантаження PDF/DOCX, коментар в угоді) —
додається окремим модулем `server/src/services/keycrm.js` без зміни
існуючої моделі даних.

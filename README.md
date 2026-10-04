# TimeTracker SaaS v2 ⏱️📍

Production-grade GPS-enabled field worker time tracking SaaS platform built on modern TypeScript monorepo architecture.

## 🚀 Стек технологий

- **Фронтенд:** React 18, Vite 5, TypeScript 5, Tailwind CSS, Vite PWA (`registerType: 'autoUpdate'`), Leaflet (интерактивные геозоны), Lucide Icons, `i18next` + `react-i18next` (RTL поддержка для иврита и арабского), `idb` (офлайн-очередь в IndexedDB).
- **База данных:** Serverless PostgreSQL на **Neon**, Prisma ORM 5 с адаптером `@prisma/adapter-neon`.
- **Бэкенд:** Express 5 / Vercel Serverless Functions на TypeScript, cookie-сессии (`httpOnly; Secure; SameSite=Lax`), `bcryptjs`, серверная генерация PDF через `pdf-lib` и CSV.
- **Монорепозиторий:** npm workspaces (`apps/web`, `packages/api`, `packages/db`, `packages/shared`).

---

## 📁 Структура монорепозитория

```
.
├── apps/
│   └── web/                     # React 18 SPA + Worker PWA
│       ├── public/              # Иконки, favicon.svg, манифест
│       └── src/
│           ├── components/      # MapPicker (Leaflet), Modal, Badge
│           ├── lib/             # api.ts, geo.ts, i18n.ts, offlineQueue.ts (IndexedDB)
│           ├── routes/
│           │   ├── marketing/   # "/" — Лендинг с калькулятором ROI и лид-формой
│           │   ├── auth/        # "/login" — Единый вход для всех ролей
│           │   ├── owner/       # "/owner/*" — Панель владельца SaaS
│           │   ├── client/      # "/app/*" — Панель клиента и бригадира
│           │   └── worker/      # "/w/:empId" — Мобильное PWA работника
│           └── stores/          # Zustand authStore
├── packages/
│   ├── api/                     # Модульный REST API (auth, owner, client, worker, cron)
│   ├── db/                      # Prisma схема, миграции и клиент Neon
│   └── shared/                  # Бизнес-логика: Jerusalem tz, Haversine, ночные, субботы, овертайм, ланч
├── scripts/
│   └── migrate-legacy-data.ts   # Скрипт безопасной миграции данных из старой БД
├── vercel.json                  # Конфигурация деплоя на Vercel + ежемесячный Cron
└── package.json                 # Корневой npm workspaces
```

---

## 👥 Роли и маршруты доступа

| Роль | Маршрут | Способ входа | Описание |
|---|---|---|---|
| **Гость** | `/` | Без авторизации | Маркетинговый лендинг, калькулятор ROI, форма лидов, 14-дневный триал |
| **Worker** | `/w/:empId` | Без пароля (по ссылке или QR) | Крупные кнопки Вход/Выход, GPS-геозона, офлайн-режим, таймер смены, табель в PDF, 4 языка |
| **Client** | `/app/*` | Логин + пароль | Дашборд, сотрудники, карта Leaflet, бригадиры, расписание, табели, отчеты PDF/CSV, настройки |
| **Foreman** | `/app/*` | Логин + пароль | Ограниченный доступ: видит только сотрудников своего отдела/объекта |
| **Owner** | `/owner/*` | Логин + пароль | Суперадмин: клиенты, тарифы, биллинг, инвойсы, CRM заявок с лендинга, настройки платформы |

---

## ⚙️ Установка и запуск

### 1. Установка зависимостей
```bash
npm install
```

### 2. Настройка переменных окружения
Скопируйте `.env.example` в `.env`:
```bash
cp .env.example .env
```
Заполните обязательные переменные:
- `DATABASE_URL` — ссылка на пул соединений Neon PostgreSQL (`postgres://...@ep-...-pooler...neon.tech/neondb?sslmode=require`)
- `DIRECT_URL` — прямая ссылка Neon (для миграций Prisma)
- `JWT_SECRET` — длинная случайная строка для подписи сессий
- `CRON_SECRET` — секрет для вызова `/api/cron/billing`

### 3. Синхронизация базы данных
```bash
npm run db:generate
npm run db:migrate
```

### 4. Запуск тестов
```bash
npm test
```
*Все 25 юнит- и интеграционных тестов проверяют расчеты времени, геозоны, аутентификацию, cron и офлайн-синхронизацию.*

### 5. Запуск для разработки
```bash
npm run dev
```

---

## 📱 Офлайн-режим и синхронизация Worker PWA

1. При отсутствии интернет-соединения отметка о начале/завершении смены сохраняется в локальную базу данных браузера **IndexedDB (`idb`)** с точным временем наступления события.
2. При восстановлении сети (`window.addEventListener('online')`) или по нажатию кнопки «Синхронизировать», пакет накопленных логов отправляется на сервер через эндпоинт **`POST /api/worker/sync`** и сохраняется в БД с историческими таймстемпами.

---

## 📦 Деплой на Vercel

1. Подключите репозиторий `https://github.com/ils-web/worktime.git` в панели Vercel.
2. Установите переменные окружения в настройках проекта Vercel:
   - `DATABASE_URL`
   - `DIRECT_URL`
   - `JWT_SECRET`
   - `CRON_SECRET`
3. Нажмите **Deploy**. Конфигурация `vercel.json` автоматически настроит сборку React SPA, маршрутизацию API serverless-функций и ежемесячный Cron биллинга на 1-е число каждого месяца (`0 0 1 * *`).

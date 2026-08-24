# Sarvarbek Jakhongirov — Portfolio

Cyberpunk-портфолио HTML single-file игр: загрузка через админку, авто-превью и постоянная ссылка на каждую игру.

## Возможности

- Каталог с карточками и thumbnail
- Страница игры с ориентациями: **Auto, 16:9, 9:16, 3:4, 4:3, 1:1**
- Админка: имя + HTML-файл, кадр снимается автоматически из файла
- Ссылка вида `/play/pulse-orbit` — можно шарить превью

## Локальный запуск

```bash
npm install
cp .env.example .env
npm start
```

Откройте [http://localhost:3000](http://localhost:3000). Админка: `/admin`. Пароль по умолчанию: `admin` (смените `ADMIN_PASSWORD`).

## Деплой на Railway через GitHub

1. Railway: **New Project → Deploy from GitHub repo** → `foteam/sarvarplays`.
2. В **Settings** сервиса ветка должна быть **`master`** (не `main`), Autodeploy включён.
3. Переменная: `ADMIN_PASSWORD`.
4. Volume, чтобы игры и профиль не стирались:
   - Mount path: `/app/data`
   - Variable: `DATA_DIR=/app/data`
5. После пуша откройте **Deployments**. Если новый коммит не стартовал: `Cmd+K` → **Deploy Latest Commit**.

Сайт: `https://your-app.up.railway.app`. Игры: `/play/<id>`.

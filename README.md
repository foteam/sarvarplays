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

1. Создайте репозиторий и запушьте этот проект.
2. В Railway: **New Project → Deploy from GitHub repo**.
3. Добавьте переменную `ADMIN_PASSWORD` — пароль админки.
4. Для сохранения игр между редеплоями добавьте **Volume**:
   - Mount path: `/app/data`
   - Variable: `DATA_DIR=/app/data`

После деплоя сайт будет на `https://your-app.up.railway.app`. Игры открываются как `https://your-app.up.railway.app/play/<id>`.

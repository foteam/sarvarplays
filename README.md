# Sarvarbek Jakhongirov — Portfolio

Cyberpunk-портфолио HTML single-file игр: загрузка через админку, авто-превью и постоянная ссылка на каждую игру.

## Возможности

- Каталог с карточками и thumbnail
- Страница игры с ориентациями: **Auto, 16:9, 9:16, 3:4, 4:3, 1:1**
- Админка: игры (имя + HTML-файл, кадр снимается автоматически), профиль, стек, соцсети
- Ссылка вида `/play/pulse-orbit` — можно шарить превью

## Как устроено

- `public/` — статические страницы
- `public/games/<игра>/<сборка>.html` и `public/thumbs/<игра>.jpg` — встроенные игры портфолио
- `netlify/functions/featured.mjs` — список встроенных игр и их сборок (версии в плеере, ссылка `?v=<сборка>`)
- `netlify/functions/api.mjs` — API, `/raw/<id>` и `/media/<id>/…`
- Игры, загруженные через админку, превью и профиль хранятся в **Netlify Blobs** — без базы и volume

Встроенные игры не удаляются из админки — меняются через репозиторий. У них нет лимита в 5 МБ.

## Локальный запуск

```bash
npm install
npx netlify-cli dev
```

Откройте адрес, который покажет CLI (обычно [http://localhost:8888](http://localhost:8888)). Админка: `/admin`, пароль по умолчанию `admin`.

## Деплой на Netlify через GitHub

1. [app.netlify.com](https://app.netlify.com) → **Add new site → Import an existing project** → GitHub → `foteam/sarvarplays`.
2. Branch: `master`. Build command — пусто, publish directory и functions подхватятся из `netlify.toml`.
3. **Site configuration → Environment variables**:
   - `ADMIN_PASSWORD` — пароль админки
   - `SESSION_SECRET` — длинная случайная строка
4. **Deploy**. Дальше каждый `git push` в `master` деплоит сайт сам.

Ограничение: HTML-файл игры — до 5 МБ (лимит тела запроса Netlify Functions).

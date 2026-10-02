import crypto from "node:crypto";
import { getStore } from "@netlify/blobs";
import { FEATURED } from "./featured.mjs";

const ASSET_VERSION = "20261003";
const MAX_HTML_BYTES = 5 * 1024 * 1024;
const MAX_THUMB_BYTES = 2 * 1024 * 1024;
const SESSION_MS = 14 * 24 * 60 * 60 * 1000;
const COOKIE = "sp_admin";

const DEFAULT_PROFILE = {
  name: "Sarvarbek Jakhongirov",
  role: "Game developer · HTML runtime",
  lead:
    "Портфолио играбельных HTML-систем. Каждая сборка — один файл с постоянной ссылкой на превью и фреймом под 16:9, 9:16, 3:4, 4:3, 1:1 или авто-ориентацию.",
  about:
    "Собираю компактные игровые механики с высокой плотностью ощущений. Этот сайт — публичная витрина: загружаю сырой HTML-файл, снимаю превью с первого кадра и получаю ссылку, которую можно открыть с любого устройства.",
  stack: ["Canvas 2D", "WebGL", "JavaScript", "Game feel", "UI systems"],
  telegram: "@hphpteam",
  instagram: "@sarvarplays",
};

const store = () => getStore({ name: "sarvarplays", consistency: "strong" });

function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      ...headers,
    },
  });
}

function adminPassword() {
  return process.env.ADMIN_PASSWORD || "admin";
}

function sign(value) {
  const secret = process.env.SESSION_SECRET || `sarvarplays:${adminPassword()}`;
  return crypto.createHmac("sha256", secret).update(value).digest("hex");
}

function safeEqual(a, b) {
  const ha = crypto.createHash("sha256").update(String(a)).digest();
  const hb = crypto.createHash("sha256").update(String(b)).digest();
  return crypto.timingSafeEqual(ha, hb);
}

function readCookie(req, name) {
  const match = (req.headers.get("cookie") || "").match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
  return match ? decodeURIComponent(match[1]) : null;
}

function isAdmin(req) {
  const token = readCookie(req, COOKIE);
  if (!token) return false;
  const [exp, mac] = token.split(".");
  if (!exp || !mac || Number(exp) < Date.now()) return false;
  return safeEqual(mac, sign(exp));
}

function sessionCookie(value, maxAgeSeconds) {
  return `${COOKIE}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAgeSeconds}`;
}

function text(value, fallback, max) {
  const clean = String(value ?? "").trim().slice(0, max);
  return clean || fallback;
}

function handle(value, fallback) {
  const clean = String(value ?? "")
    .trim()
    .replace(/^https?:\/\/(t\.me|telegram\.me|www\.instagram\.com|instagram\.com)\//i, "")
    .replace(/^@/, "")
    .replace(/[^a-zA-Z0-9_.]/g, "")
    .slice(0, 40);
  return clean ? `@${clean}` : fallback;
}

function sanitizeProfile(input) {
  const stack = Array.isArray(input?.stack) ? input.stack : String(input?.stack || "").split(",");
  return {
    name: text(input?.name, DEFAULT_PROFILE.name, 80),
    role: text(input?.role, DEFAULT_PROFILE.role, 120),
    lead: text(input?.lead, DEFAULT_PROFILE.lead, 600),
    about: text(input?.about, DEFAULT_PROFILE.about, 1200),
    stack: stack
      .map((item) => String(item).trim().slice(0, 40))
      .filter(Boolean)
      .slice(0, 16),
    telegram: handle(input?.telegram, ""),
    instagram: handle(input?.instagram, ""),
  };
}

function slugify(name) {
  const slug = String(name || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return slug || "game";
}

function publicGame(game) {
  if (game.featured) {
    return {
      id: game.id,
      name: game.name,
      featured: true,
      playUrl: `/play/${game.id}`,
      thumbUrl: game.thumb,
      versions: game.versions,
    };
  }
  return {
    id: game.id,
    name: game.name,
    createdAt: game.createdAt,
    updatedAt: game.updatedAt,
    hasThumb: Boolean(game.hasThumb),
    playUrl: `/play/${game.id}`,
    thumbUrl: game.hasThumb
      ? `/media/${game.id}/thumb.png?v=${game.updatedAt}`
      : `/media/${game.id}/thumb.svg`,
    versions: [{ id: "main", label: "Main", url: `/raw/${game.id}` }],
  };
}

const featuredGames = () => FEATURED.map((game) => ({ ...game, featured: true }));
const isFeaturedId = (id) => FEATURED.some((game) => game.id === id);

async function readProfile(s) {
  const saved = await s.get("profile.json", { type: "json" });
  if (!saved) return { ...DEFAULT_PROFILE, stack: [...DEFAULT_PROFILE.stack] };
  const stack = Array.isArray(saved.stack) ? saved.stack : DEFAULT_PROFILE.stack;
  return { ...DEFAULT_PROFILE, ...saved, stack };
}

async function readCatalog(s) {
  const games = await s.get("catalog.json", { type: "json" });
  return Array.isArray(games) ? games : [];
}

function placeholderSvg(name) {
  const label = String(name || "Game").replace(/[<>&"]/g, "");
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 720">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#04060c"/>
      <stop offset="1" stop-color="#0b1622"/>
    </linearGradient>
  </defs>
  <rect width="1280" height="720" fill="url(#g)"/>
  <circle cx="980" cy="160" r="220" fill="#ff3ea5" opacity=".18"/>
  <circle cx="240" cy="560" r="260" fill="#4df3ff" opacity=".14"/>
  <rect x="40" y="40" width="1200" height="640" fill="none" stroke="#4df3ff" stroke-opacity=".3"/>
  <text x="640" y="378" text-anchor="middle" font-family="Orbitron, Arial, sans-serif" font-size="56" fill="#4df3ff" font-weight="700">${label}</text>
</svg>`;
}

async function looksLikeHtml(file) {
  const name = (file.name || "").toLowerCase();
  if (name.endsWith(".html") || name.endsWith(".htm")) return true;
  if (String(file.type || "").includes("html")) return true;
  const head = await file.slice(0, 200).text();
  return head.toLowerCase().includes("<html");
}

export default async (req) => {
  const url = new URL(req.url);
  const parts = url.pathname.split("/").filter(Boolean);
  const method = req.method;
  const s = store();

  try {
    if (parts[0] === "raw" && parts[1] && method === "GET") {
      const html = await s.get(`games/${parts[1]}.html`);
      if (html == null) return new Response("Game not found", { status: 404 });
      return new Response(html, {
        headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
      });
    }

    if (parts[0] === "media" && parts[1] && method === "GET") {
      const id = parts[1];
      if (parts[2] === "thumb.png") {
        const png = await s.get(`thumbs/${id}.png`, { type: "arrayBuffer" });
        if (!png) return new Response(null, { status: 404 });
        return new Response(png, {
          headers: { "content-type": "image/png", "cache-control": "public, max-age=86400" },
        });
      }
      if (parts[2] === "thumb.svg") {
        const game = (await readCatalog(s)).find((g) => g.id === id);
        return new Response(placeholderSvg(game?.name), {
          headers: { "content-type": "image/svg+xml", "cache-control": "no-store" },
        });
      }
      return new Response(null, { status: 404 });
    }

    if (parts[0] !== "api") return json({ error: "Not found" }, 404);
    const route = parts.slice(1);

    if (route[0] === "health") return json({ ok: true, version: ASSET_VERSION });

    if (route[0] === "profile" && method === "GET") {
      return json({ profile: await readProfile(s) });
    }

    if (route[0] === "games" && method === "GET") {
      const uploaded = (await readCatalog(s)).slice().sort((a, b) => b.createdAt - a.createdAt);
      const games = [...featuredGames(), ...uploaded];
      if (route[1]) {
        const game = games.find((g) => g.id === route[1]);
        return game ? json({ game: publicGame(game) }) : json({ error: "Game not found" }, 404);
      }
      return json({ games: games.map(publicGame) });
    }

    if (route[0] !== "admin") return json({ error: "Not found" }, 404);

    if (route[1] === "login" && method === "POST") {
      const body = await req.json().catch(() => ({}));
      if (!body.password || !safeEqual(body.password, adminPassword())) {
        return json({ error: "Wrong password" }, 401);
      }
      const exp = String(Date.now() + SESSION_MS);
      return json({ ok: true }, 200, {
        "set-cookie": sessionCookie(`${exp}.${sign(exp)}`, SESSION_MS / 1000),
      });
    }

    if (route[1] === "logout" && method === "POST") {
      return json({ ok: true }, 200, { "set-cookie": sessionCookie("", 0) });
    }

    if (!isAdmin(req)) return json({ error: "Unauthorized" }, 401);

    if (route[1] === "me") return json({ ok: true });

    if (route[1] === "profile" && method === "PUT") {
      const body = await req.json().catch(() => ({}));
      const profile = sanitizeProfile({ ...(await readProfile(s)), ...body });
      await s.setJSON("profile.json", profile);
      return json({ profile });
    }

    if (route[1] === "games" && !route[2] && method === "POST") {
      const form = await req.formData();
      const file = form.get("file");
      if (!file || typeof file === "string") return json({ error: "HTML file is required" }, 400);
      if (file.size > MAX_HTML_BYTES) return json({ error: "Файл больше 5 МБ" }, 413);
      if (!(await looksLikeHtml(file))) return json({ error: "Only .html games are allowed" }, 400);

      const name = text(form.get("name"), (file.name || "game").replace(/\.html?$/i, ""), 80);
      const games = await readCatalog(s);
      let id = slugify(name);
      if (isFeaturedId(id) || games.some((g) => g.id === id)) {
        id = `${id}-${crypto.randomBytes(3).toString("hex")}`;
      }

      await s.set(`games/${id}.html`, await file.text());

      let hasThumb = false;
      const thumb = form.get("thumbnail");
      if (thumb && typeof thumb !== "string" && thumb.size <= MAX_THUMB_BYTES) {
        await s.set(`thumbs/${id}.png`, await thumb.arrayBuffer());
        hasThumb = true;
      }

      const now = Date.now();
      const game = { id, name, createdAt: now, updatedAt: now, hasThumb };
      games.push(game);
      await s.setJSON("catalog.json", games);
      return json({ game: publicGame(game) });
    }

    if (route[1] === "games" && route[2] && isFeaturedId(route[2]) && method !== "GET") {
      return json({ error: "Встроенные игры меняются через репозиторий" }, 403);
    }

    if (route[1] === "games" && route[2] && route[3] === "thumbnail" && method === "POST") {
      const games = await readCatalog(s);
      const game = games.find((g) => g.id === route[2]);
      if (!game) return json({ error: "Game not found" }, 404);
      const thumb = (await req.formData()).get("thumbnail");
      if (!thumb || typeof thumb === "string") return json({ error: "Thumbnail is required" }, 400);
      if (thumb.size > MAX_THUMB_BYTES) return json({ error: "Thumbnail too large" }, 413);
      await s.set(`thumbs/${game.id}.png`, await thumb.arrayBuffer());
      game.hasThumb = true;
      game.updatedAt = Date.now();
      await s.setJSON("catalog.json", games);
      return json({ game: publicGame(game) });
    }

    if (route[1] === "games" && route[2] && method === "DELETE") {
      const games = await readCatalog(s);
      const idx = games.findIndex((g) => g.id === route[2]);
      if (idx === -1) return json({ error: "Game not found" }, 404);
      const [game] = games.splice(idx, 1);
      await s.setJSON("catalog.json", games);
      await Promise.all([s.delete(`games/${game.id}.html`), s.delete(`thumbs/${game.id}.png`)]);
      return json({ ok: true });
    }

    return json({ error: "Not found" }, 404);
  } catch (err) {
    console.error(err);
    return json({ error: "Server error" }, 500);
  }
};

export const config = {
  path: ["/api/*", "/raw/*", "/media/*"],
};

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const express = require("express");
const cookieParser = require("cookie-parser");
const multer = require("multer");

const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin";
const ASSET_VERSION = "20260824";

function resolveDataDir() {
  const preferred = path.resolve(process.env.DATA_DIR || path.join(__dirname, "data"));
  try {
    fs.mkdirSync(path.join(preferred, "games"), { recursive: true });
    fs.mkdirSync(path.join(preferred, "thumbs"), { recursive: true });
    return preferred;
  } catch (err) {
    const fallback = path.join(__dirname, "data");
    console.error(`DATA_DIR ${preferred} is not writable, using ${fallback}`, err.message);
    fs.mkdirSync(path.join(fallback, "games"), { recursive: true });
    fs.mkdirSync(path.join(fallback, "thumbs"), { recursive: true });
    return fallback;
  }
}

const DATA_DIR = resolveDataDir();
const GAMES_DIR = path.join(DATA_DIR, "games");
const THUMBS_DIR = path.join(DATA_DIR, "thumbs");
const CATALOG_PATH = path.join(DATA_DIR, "games.json");
const PROFILE_PATH = path.join(DATA_DIR, "profile.json");
const SAMPLE_PATH = path.join(__dirname, "samples", "pulse-orbit.html");

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

const MAX_HTML_BYTES = 25 * 1024 * 1024;
const sessions = new Map();

function readProfile() {
  try {
    const saved = JSON.parse(fs.readFileSync(PROFILE_PATH, "utf8"));
    const stack = Array.isArray(saved.stack) ? saved.stack : DEFAULT_PROFILE.stack;
    return { ...DEFAULT_PROFILE, ...saved, stack };
  } catch {
    return { ...DEFAULT_PROFILE, stack: [...DEFAULT_PROFILE.stack] };
  }
}

function readCatalog() {
  try {
    return JSON.parse(fs.readFileSync(CATALOG_PATH, "utf8"));
  } catch {
    return [];
  }
}

function writeCatalog(games) {
  fs.writeFileSync(CATALOG_PATH, JSON.stringify(games, null, 2));
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
  const stack = Array.isArray(input?.stack)
    ? input.stack
    : String(input?.stack || "").split(",");
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
  };
}

function seedDemoIfEmpty() {
  if (readCatalog().length) return;
  if (!fs.existsSync(SAMPLE_PATH)) return;
  const id = "pulse-orbit";
  fs.copyFileSync(SAMPLE_PATH, path.join(GAMES_DIR, `${id}.html`));
  writeCatalog([
    {
      id,
      name: "Pulse Orbit",
      createdAt: Date.now(),
      updatedAt: Date.now(),
      hasThumb: false,
    },
  ]);
}

seedDemoIfEmpty();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_HTML_BYTES, files: 2 },
});

const app = express();
app.disable("x-powered-by");
app.set("trust proxy", 1);
app.use(express.json({ limit: "8mb" }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, "public"), { maxAge: 0, etag: true }));

function requireAdmin(req, res, next) {
  const token = req.cookies.sp_admin;
  if (!token || !sessions.has(token)) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  sessions.set(token, Date.now());
  next();
}

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, version: ASSET_VERSION });
});

app.get("/api/profile", (_req, res) => {
  res.json({ profile: readProfile() });
});

app.put("/api/admin/profile", requireAdmin, (req, res) => {
  const profile = sanitizeProfile({ ...readProfile(), ...req.body });
  fs.writeFileSync(PROFILE_PATH, JSON.stringify(profile, null, 2));
  res.json({ profile });
});

app.get("/api/games", (_req, res) => {
  const games = readCatalog()
    .slice()
    .sort((a, b) => b.createdAt - a.createdAt)
    .map(publicGame);
  res.json({ games });
});

app.get("/api/games/:id", (req, res) => {
  const game = readCatalog().find((g) => g.id === req.params.id);
  if (!game) return res.status(404).json({ error: "Game not found" });
  res.json({ game: publicGame(game) });
});

app.post("/api/admin/login", (req, res) => {
  const password = String(req.body?.password || "");
  if (!password || password !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: "Wrong password" });
  }
  const token = crypto.randomBytes(24).toString("hex");
  sessions.set(token, Date.now());
  res.cookie("sp_admin", token, {
    httpOnly: true,
    sameSite: "lax",
    secure: req.secure || req.headers["x-forwarded-proto"] === "https",
    maxAge: 14 * 24 * 60 * 60 * 1000,
    signed: false,
  });
  res.json({ ok: true });
});

app.post("/api/admin/logout", (req, res) => {
  const token = req.cookies.sp_admin;
  if (token) sessions.delete(token);
  res.clearCookie("sp_admin");
  res.json({ ok: true });
});

app.get("/api/admin/me", requireAdmin, (_req, res) => {
  res.json({ ok: true });
});

app.post(
  "/api/admin/games",
  requireAdmin,
  upload.fields([
    { name: "file", maxCount: 1 },
    { name: "thumbnail", maxCount: 1 },
  ]),
  (req, res) => {
    const file = req.files?.file?.[0];
    if (!file) return res.status(400).json({ error: "HTML file is required" });

    const original = (file.originalname || "").toLowerCase();
    const looksHtml =
      original.endsWith(".html") ||
      original.endsWith(".htm") ||
      String(file.mimetype || "").includes("html") ||
      String(file.buffer.slice(0, 200)).toLowerCase().includes("<html");
    if (!looksHtml) {
      return res.status(400).json({ error: "Only .html games are allowed" });
    }

    const name = String(req.body?.name || "").trim() || path.parse(file.originalname || "game").name;
    const games = readCatalog();
    let id = slugify(name);
    if (games.some((g) => g.id === id)) {
      id = `${id}-${crypto.randomBytes(3).toString("hex")}`;
    }

    fs.writeFileSync(path.join(GAMES_DIR, `${id}.html`), file.buffer);

    const thumb = req.files?.thumbnail?.[0];
    let hasThumb = false;
    if (thumb) {
      fs.writeFileSync(path.join(THUMBS_DIR, `${id}.png`), thumb.buffer);
      hasThumb = true;
    }

    const now = Date.now();
    const game = { id, name, createdAt: now, updatedAt: now, hasThumb };
    games.push(game);
    writeCatalog(games);
    res.json({ game: publicGame(game) });
  }
);

app.post(
  "/api/admin/games/:id/thumbnail",
  requireAdmin,
  upload.single("thumbnail"),
  (req, res) => {
    const games = readCatalog();
    const game = games.find((g) => g.id === req.params.id);
    if (!game) return res.status(404).json({ error: "Game not found" });
    if (!req.file) return res.status(400).json({ error: "Thumbnail is required" });
    fs.writeFileSync(path.join(THUMBS_DIR, `${game.id}.png`), req.file.buffer);
    game.hasThumb = true;
    game.updatedAt = Date.now();
    writeCatalog(games);
    res.json({ game: publicGame(game) });
  }
);

app.delete("/api/admin/games/:id", requireAdmin, (req, res) => {
  const games = readCatalog();
  const idx = games.findIndex((g) => g.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: "Game not found" });
  const [game] = games.splice(idx, 1);
  writeCatalog(games);
  for (const file of [
    path.join(GAMES_DIR, `${game.id}.html`),
    path.join(THUMBS_DIR, `${game.id}.png`),
  ]) {
    try {
      fs.unlinkSync(file);
    } catch {}
  }
  res.json({ ok: true });
});

function sendHtml(res, file) {
  res.setHeader("Cache-Control", "no-store");
  res.sendFile(file);
}

app.get("/play/:id", (req, res) => {
  sendHtml(res, path.join(__dirname, "public", "play.html"));
});

app.get("/admin", (_req, res) => {
  sendHtml(res, path.join(__dirname, "public", "admin.html"));
});

app.get("/raw/:id", (req, res) => {
  const file = path.join(GAMES_DIR, `${req.params.id}.html`);
  if (!fs.existsSync(file)) return res.status(404).send("Game not found");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.sendFile(file);
});

app.get("/media/:id/thumb.png", (req, res) => {
  const file = path.join(THUMBS_DIR, `${req.params.id}.png`);
  if (!fs.existsSync(file)) return res.status(404).end();
  res.setHeader("Cache-Control", "public, max-age=86400");
  res.type("png").sendFile(file);
});

app.get("/media/:id/thumb.svg", (req, res) => {
  const game = readCatalog().find((g) => g.id === req.params.id);
  const label = (game?.name || "Game").replace(/[<>&]/g, "");
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
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
  res.setHeader("Cache-Control", "no-store");
  res.type("svg").send(svg);
});

app.get("*", (req, res, next) => {
  if (req.path.startsWith("/api/")) return next();
  sendHtml(res, path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Sarvar Plays running on :${PORT}`);
  console.log(`DATA_DIR=${DATA_DIR}`);
});

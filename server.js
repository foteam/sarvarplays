const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const express = require("express");
const cookieParser = require("cookie-parser");
const multer = require("multer");

const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin";
const DATA_DIR = path.resolve(process.env.DATA_DIR || path.join(__dirname, "data"));
const GAMES_DIR = path.join(DATA_DIR, "games");
const THUMBS_DIR = path.join(DATA_DIR, "thumbs");
const CATALOG_PATH = path.join(DATA_DIR, "games.json");
const SAMPLE_PATH = path.join(__dirname, "samples", "pulse-orbit.html");

const MAX_HTML_BYTES = 25 * 1024 * 1024;
const sessions = new Map();

fs.mkdirSync(GAMES_DIR, { recursive: true });
fs.mkdirSync(THUMBS_DIR, { recursive: true });

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
app.use(express.static(path.join(__dirname, "public"), { maxAge: "1h" }));

function requireAdmin(req, res, next) {
  const token = req.cookies.sp_admin;
  if (!token || !sessions.has(token)) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  sessions.set(token, Date.now());
  next();
}

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
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

app.get("/play/:id", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "play.html"));
});

app.get("/admin", (_req, res) => {
  res.sendFile(path.join(__dirname, "public", "admin.html"));
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
      <stop offset="0" stop-color="#12061f"/>
      <stop offset="1" stop-color="#06141f"/>
    </linearGradient>
  </defs>
  <rect width="1280" height="720" fill="url(#g)"/>
  <circle cx="980" cy="160" r="220" fill="#7c5cff" opacity=".18"/>
  <circle cx="240" cy="560" r="260" fill="#22d3ee" opacity=".12"/>
  <text x="640" y="370" text-anchor="middle" font-family="Arial, sans-serif" font-size="64" fill="#f8fafc" font-weight="700">${label}</text>
</svg>`;
  res.setHeader("Cache-Control", "no-store");
  res.type("svg").send(svg);
});

app.get("*", (req, res, next) => {
  if (req.path.startsWith("/api/")) return next();
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Sarvar Plays running on http://localhost:${PORT}`);
});

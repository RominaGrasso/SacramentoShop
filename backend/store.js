import fs from "node:fs";
import path from "node:path";

const DATA_DIR = path.resolve("backend", "data");
const DB_FILE = path.join(DATA_DIR, "payment-links.json");

function ensureStore() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DB_FILE)) fs.writeFileSync(DB_FILE, "[]", "utf8");
}

function readAll() {
  ensureStore();
  const raw = fs.readFileSync(DB_FILE, "utf8");
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeAll(items) {
  ensureStore();
  fs.writeFileSync(DB_FILE, JSON.stringify(items, null, 2), "utf8");
}

export function findReusableLink(fingerprint, nowIso) {
  const now = new Date(nowIso).getTime();
  const items = readAll();
  return (
    items.find((x) => {
      if (x.fingerprint !== fingerprint) return false;
      if (x.status !== "active") return false;
      if (!x.expiresAt) return true;
      const expiresAt = new Date(x.expiresAt).getTime();
      return Number.isFinite(expiresAt) ? expiresAt > now : false;
    }) || null
  );
}

export function upsertLink(entry) {
  const items = readAll();
  const idx = items.findIndex((x) => x.fingerprint === entry.fingerprint && x.status === "active");
  if (idx >= 0) {
    items[idx] = { ...items[idx], ...entry };
  } else {
    items.push(entry);
  }
  writeAll(items);
  return entry;
}

export function updateStatusBySessionId(sessionId, status) {
  if (!sessionId) return false;
  const items = readAll();
  const idx = items.findIndex((x) => x.sessionId === sessionId);
  if (idx < 0) return false;
  items[idx].status = status;
  items[idx].updatedAt = new Date().toISOString();
  writeAll(items);
  return true;
}


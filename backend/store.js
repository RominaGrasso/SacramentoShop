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

/**
 * Lista pagos desde el JSON local con filtros y orden por fecha (V1 admin).
 * @param {object} filters
 * @param {string} [filters.status] — coincidencia exacta
 * @param {string} [filters.experience] — subcadena (case-insensitive)
 * @param {string} [filters.q] — busca en sessionId y fingerprint
 * @param {string} [filters.from] — ISO: updatedAt >= from
 * @param {string} [filters.to] — ISO: updatedAt <= end of day si solo fecha
 * @param {number} [filters.limit=100] — máx 500
 * @param {number} [filters.offset=0]
 * @param {'updatedAt'|'createdAt'} [filters.sort='updatedAt']
 * @param {'asc'|'desc'} [filters.order='desc']
 */
export function listPayments(filters = {}) {
  const {
    status,
    experience,
    q,
    from,
    to,
    limit: limitRaw,
    offset: offsetRaw,
    sort = "updatedAt",
    order = "desc"
  } = filters;

  let items = readAll();

  if (status && String(status).trim()) {
    const st = String(status).trim();
    items = items.filter((x) => String(x.status || "") === st);
  }

  if (experience && String(experience).trim()) {
    const ex = String(experience).trim().toLowerCase();
    items = items.filter((x) => String(x.experience || "").toLowerCase().includes(ex));
  }

  if (q && String(q).trim()) {
    const qq = String(q).trim().toLowerCase();
    items = items.filter(
      (x) =>
        String(x.sessionId || "")
          .toLowerCase()
          .includes(qq) ||
        String(x.fingerprint || "")
          .toLowerCase()
          .includes(qq)
    );
  }

  const fromMs = from ? new Date(from).getTime() : NaN;
  if (Number.isFinite(fromMs)) {
    items = items.filter((x) => {
      const t = new Date(x.updatedAt || x.createdAt || 0).getTime();
      return t >= fromMs;
    });
  }

  let toMs = to ? new Date(to).getTime() : NaN;
  if (Number.isFinite(toMs)) {
    /** Si `to` es solo fecha (sin hora), incluir todo el día */
    const toStr = String(to).trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(toStr)) {
      toMs = new Date(`${toStr}T23:59:59.999Z`).getTime();
    }
    items = items.filter((x) => {
      const t = new Date(x.updatedAt || x.createdAt || 0).getTime();
      return t <= toMs;
    });
  }

  const sortKey = sort === "createdAt" ? "createdAt" : "updatedAt";
  const dir = order === "asc" ? 1 : -1;
  items.sort((a, b) => {
    const ta = new Date(a[sortKey] || a.createdAt || 0).getTime();
    const tb = new Date(b[sortKey] || b.createdAt || 0).getTime();
    if (ta < tb) return -1 * dir;
    if (ta > tb) return 1 * dir;
    return 0;
  });

  const total = items.length;
  const limit = Math.min(Math.max(Number(limitRaw) || 100, 1), 500);
  const offset = Math.max(Number(offsetRaw) || 0, 0);
  const slice = items.slice(offset, offset + limit);

  return { items: slice, total, limit, offset };
}


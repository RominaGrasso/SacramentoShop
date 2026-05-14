import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(MODULE_DIR, "data");
const DB_FILE = path.join(DATA_DIR, "payment-links.json");
/** Compatibilidad con una ruta legacy que dependía del cwd (backend/backend/data). */
const LEGACY_DB_FILE = path.resolve("backend", "data", "payment-links.json");

function ensureStore() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DB_FILE)) {
    if (fs.existsSync(LEGACY_DB_FILE)) {
      fs.copyFileSync(LEGACY_DB_FILE, DB_FILE);
    } else {
      fs.writeFileSync(DB_FILE, "[]", "utf8");
    }
  }
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

function normalizePaymentStatus(status) {
  return String(status || "").trim().toLowerCase();
}

/** Terminal outcomes: must not be downgraded to pending/processing by secondary callbacks. */
export function isFinalPaymentStatus(status) {
  const s = normalizePaymentStatus(status);
  return s === "approved" || s === "failed";
}

/**
 * approved/failed > pending (and other non-final states).
 * @returns {boolean} false when `nextStatus` would downgrade a final state.
 */
export function canApplyPaymentStatusTransition(currentStatus, nextStatus) {
  const cur = normalizePaymentStatus(currentStatus);
  const next = normalizePaymentStatus(nextStatus);
  if (!next || next === cur) return true;
  if (
    isFinalPaymentStatus(cur) &&
    (next === "pending" || next === "processing" || next === "awaiting_payment")
  ) {
    return false;
  }
  return true;
}

function stripBlockedPaymentStatusPatch(existingStatus, patch) {
  if (!patch || typeof patch !== "object" || patch.paymentStatus == null) return patch;
  if (!canApplyPaymentStatusTransition(existingStatus, patch.paymentStatus)) {
    const { paymentStatus, ...rest } = patch;
    return rest;
  }
  return patch;
}

function hasTerminalPaymentAttempt(link) {
  const attempts = Array.isArray(link?.paymentAttempts) ? link.paymentAttempts : [];
  return attempts.some((a) => isFinalPaymentStatus(a?.status));
}

/** Plexo checkout links must not be reused after a terminal payment outcome. */
function markLinkConsumedIfTerminal(existing, patch) {
  if (!patch || typeof patch !== "object") return patch;
  const nextPaymentStatus = normalizePaymentStatus(
    patch.paymentStatus ?? existing?.paymentStatus ?? "awaiting_payment"
  );
  if (isFinalPaymentStatus(nextPaymentStatus)) {
    return { ...patch, status: "consumed" };
  }
  return patch;
}

export function findReusableLink(fingerprint, nowIso) {
  const now = new Date(nowIso).getTime();
  const items = readAll();
  return (
    items.find((x) => {
      if (x.fingerprint !== fingerprint) return false;
      if (x.status !== "active") return false;
      if (normalizePaymentStatus(x.paymentStatus || "awaiting_payment") !== "awaiting_payment") return false;
      if (hasTerminalPaymentAttempt(x)) return false;
      if (x.expiresAt) {
        const expiresAt = new Date(x.expiresAt).getTime();
        if (Number.isFinite(expiresAt) && expiresAt <= now) return false;
      }
      return true;
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

export function getPaymentBySessionId(sessionId) {
  if (!sessionId) return null;
  const items = readAll();
  const item = items.find((x) => String(x.sessionId || "") === String(sessionId));
  if (!item) return null;
  return { ...item };
}

export function findPaymentByFingerprint(fingerprint) {
  const ref = String(fingerprint || "").trim();
  if (!ref) return null;
  const matches = readAll().filter((x) => String(x.fingerprint || "") === ref);
  if (!matches.length) return null;
  matches.sort((a, b) => {
    const ta = new Date(a.updatedAt || a.createdAt || 0).getTime();
    const tb = new Date(b.updatedAt || b.createdAt || 0).getTime();
    return tb - ta;
  });
  return { ...matches[0] };
}

/**
 * @param {string} fingerprint
 * @param {object} patch — e.g. paymentStatus, plexoResultCode, plexoTransactionId
 * @param {object|null} attempt — paymentAttempts entry metadata
 */
export function updatePaymentByFingerprint(fingerprint, patch = {}, attempt = null) {
  const ref = String(fingerprint || "").trim();
  if (!ref) return false;
  const items = readAll();
  let idx = -1;
  let bestTime = -1;
  items.forEach((x, i) => {
    if (String(x.fingerprint || "") !== ref) return;
    const t = new Date(x.updatedAt || x.createdAt || 0).getTime();
    if (t >= bestTime) {
      bestTime = t;
      idx = i;
    }
  });
  if (idx < 0) return false;
  const nowIso = new Date().toISOString();
  const safePatch = markLinkConsumedIfTerminal(
    items[idx],
    stripBlockedPaymentStatusPatch(items[idx].paymentStatus, patch)
  );
  items[idx] = { ...items[idx], ...safePatch, updatedAt: nowIso };
  if (!Array.isArray(items[idx].paymentAttempts)) {
    items[idx].paymentAttempts = [];
  }
  if (attempt && typeof attempt === "object") {
    items[idx].paymentAttempts.push({
      at: nowIso,
      status: safePatch.paymentStatus || items[idx].paymentStatus || "unknown",
      source: attempt.source || "webhook",
      gateway: attempt.gateway || undefined,
      card: attempt.card || undefined,
      payer: attempt.payer || undefined,
      issuer: attempt.issuer || undefined,
      reference: attempt.reference || undefined,
      note: attempt.note || undefined,
      raw: attempt.raw || undefined
    });
    if (items[idx].paymentAttempts.length > 100) {
      items[idx].paymentAttempts = items[idx].paymentAttempts.slice(-100);
    }
  }
  writeAll(items);
  return true;
}

export function updatePaymentBySessionId(sessionId, patchOrStatus, attempt = null) {
  if (!sessionId) return false;
  const items = readAll();
  const idx = items.findIndex((x) => x.sessionId === sessionId);
  if (idx < 0) return false;
  const nowIso = new Date().toISOString();
  const patch =
    typeof patchOrStatus === "object" && patchOrStatus !== null
      ? patchOrStatus
      : { paymentStatus: String(patchOrStatus), status: String(patchOrStatus) };
  const safePatch = markLinkConsumedIfTerminal(
    items[idx],
    stripBlockedPaymentStatusPatch(items[idx].paymentStatus, patch)
  );
  items[idx] = { ...items[idx], ...safePatch, updatedAt: nowIso };
  if (!Array.isArray(items[idx].paymentAttempts)) {
    items[idx].paymentAttempts = [];
  }
  items[idx].paymentAttempts.push(
    attempt && typeof attempt === "object"
      ? {
          at: nowIso,
          status: safePatch.paymentStatus || safePatch.status || items[idx].paymentStatus || "unknown",
          source: attempt.source || "status_update",
          gateway: attempt.gateway || undefined,
          card: attempt.card || undefined,
          payer: attempt.payer || undefined,
          issuer: attempt.issuer || undefined,
          reference: attempt.reference || undefined,
          note: attempt.note || undefined,
          raw: attempt.raw || undefined
        }
      : {
          at: nowIso,
          status: safePatch.paymentStatus || safePatch.status || "status_update",
          source: "status_update"
        }
  );
  writeAll(items);
  return true;
}

/** @deprecated alias — use updatePaymentBySessionId with patch object */
export function updateStatusBySessionId(sessionId, status, attempt = null) {
  return updatePaymentBySessionId(sessionId, { paymentStatus: status, status }, attempt);
}

export function appendPaymentAttemptBySessionId(sessionId, attempt = {}) {
  if (!sessionId) return false;
  const items = readAll();
  const idx = items.findIndex((x) => x.sessionId === sessionId);
  if (idx < 0) return false;
  const nowIso = new Date().toISOString();
  if (!Array.isArray(items[idx].paymentAttempts)) {
    items[idx].paymentAttempts = [];
  }
  const entry = {
    at: nowIso,
    status: attempt.status || items[idx].paymentStatus || items[idx].status || "unknown",
    source: attempt.source || "webhook",
    gateway: attempt.gateway || undefined,
    card: attempt.card || undefined,
    payer: attempt.payer || undefined,
    issuer: attempt.issuer || undefined,
    reference: attempt.reference || undefined,
    note: attempt.note || undefined,
    raw: attempt.raw || undefined
  };
  items[idx].paymentAttempts.push(entry);
  if (items[idx].paymentAttempts.length > 100) {
    items[idx].paymentAttempts = items[idx].paymentAttempts.slice(-100);
  }
  items[idx].updatedAt = nowIso;
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
  const slice = items.slice(offset, offset + limit).map((x) => {
    const attempts = Array.isArray(x.paymentAttempts) ? x.paymentAttempts : [];
    return {
      ...x,
      attemptsCount: attempts.length,
      lastAttemptAt: attempts.length ? attempts[attempts.length - 1].at : null
    };
  });

  return { items: slice, total, limit, offset };
}


import crypto from "node:crypto";
import fs from "node:fs";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import dotenv from "dotenv";
import forge from "node-forge";
import { findReusableLink, upsertLink, updateStatusBySessionId, updatePaymentByFingerprint, updatePaymentBySessionId, findPaymentByFingerprint, listPayments, getPaymentBySessionId, canApplyPaymentStatusTransition, listActiveFingerprints } from "./store.js";

dotenv.config({ path: "backend/.env" });

const PORT = Number(process.env.PORT || 8787);
const LINK_TTL_MINUTES = Number(process.env.LINK_TTL_MINUTES || 1440);
const PAYMENT_MODE = process.env.PAYMENT_MODE || "mock";
const HANDY_CREATE_URL = process.env.HANDY_CREATE_URL || "";
const HANDY_TOKEN = process.env.HANDY_TOKEN || "";
const DEFAULT_ALLOWED_ORIGINS = [
  "https://sacraadventures.com",
  "https://www.sacraadventures.com",
  "https://rominagrasso.github.io"
];

function parseAllowedOrigins() {
  const fromList = (process.env.ALLOWED_ORIGINS || "")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);
  if (fromList.length > 0) return fromList;
  const legacy = String(process.env.ALLOWED_ORIGIN || "").trim();
  if (legacy && legacy !== "*") return [legacy];
  return DEFAULT_ALLOWED_ORIGINS;
}

const ALLOWED_ORIGINS = parseAllowedOrigins();

const CORS_LOG_REJECTED =
  process.env.CORS_LOG_REJECTED !== "0" && !/^false$/i.test(String(process.env.CORS_LOG_REJECTED || ""));

function isLocalDevCorsOrigin(origin) {
  try {
    const u = new URL(origin);
    return u.protocol === "http:" && (u.hostname === "localhost" || u.hostname === "127.0.0.1");
  } catch {
    return false;
  }
}

function isAllowedCorsOrigin(origin) {
  if (!origin) return true;
  if (ALLOWED_ORIGINS.includes(origin)) return true;
  if (isLocalDevCorsOrigin(origin)) return true;
  return false;
}

function logRejectedCorsOrigin(origin, req) {
  if (!CORS_LOG_REJECTED) return;
  const method = req?.method || "?";
  const path = req?.originalUrl || req?.url || "?";
  // eslint-disable-next-line no-console
  console.warn(`[cors] rejected origin: ${origin || "(none)"} ${method} ${path}`);
}

const PLEXO_GATEWAY_URL = process.env.PLEXO_GATEWAY_URL || "";
const PLEXO_CLIENT_NAME = process.env.PLEXO_CLIENT_NAME || "";
const PLEXO_CERT_PASSWORD = process.env.PLEXO_CERT_PASSWORD || "";
const PLEXO_CERT_FINGERPRINT = (process.env.PLEXO_CERT_FINGERPRINT || "").toUpperCase().replace(/[^A-F0-9]/g, "");
const PLEXO_PFX_PATH = process.env.PLEXO_PFX_PATH || "";
const PLEXO_PFX_BASE64 = process.env.PLEXO_PFX_BASE64 || "";
/** Static site root (GitHub Pages or local static server) for post-checkout result pages. */
const PLEXO_FRONTEND_BASE_URL = (
  process.env.PLEXO_FRONTEND_BASE_URL || "https://rominagrasso.github.io/SacramentoShop"
).replace(/\/+$/, "");
const PLEXO_REDIRECT_URL = process.env.PLEXO_REDIRECT_URL || "";
/**
 * CommerceId de Plexo (ej. comercio Handy / facilitador). Va en rutas tipo /Commerce/Issuer y body AddIssuerCommerce.
 * Handy/Plexo: suele ser el id "de negocio" (ej. 65264).
 */
const PLEXO_COMMERCE_ID = Number(process.env.PLEXO_COMMERCE_ID || 0);
/**
 * OptionalCommerceId en ExpressCheckout (AuthorizationData + PaymentData). Multicomercio / contexto de checkout.
 * Si no se define, se usa PLEXO_COMMERCE_ID (compat instalaciones con un solo id).
 * Handy/Plexo: ej. 66059 mientras PLEXO_COMMERCE_ID sea 65264.
 */
const PLEXO_OPTIONAL_COMMERCE_ID = Number(process.env.PLEXO_OPTIONAL_COMMERCE_ID || 0);

function plexoOptionalCommerceIdForExpressCheckout() {
  if (Number.isFinite(PLEXO_OPTIONAL_COMMERCE_ID) && PLEXO_OPTIONAL_COMMERCE_ID > 0) {
    return PLEXO_OPTIONAL_COMMERCE_ID;
  }
  if (Number.isFinite(PLEXO_COMMERCE_ID) && PLEXO_COMMERCE_ID > 0) {
    return PLEXO_COMMERCE_ID;
  }
  return 0;
}

/** Comma-separated issuer ids (manual ejemplo: 4,11,15,30,32). Env vacío "" = no enviar LimitIssuers. Sin definir = default 4,11,15. */
function computePlexoLimitIssuers() {
  const raw = process.env.PLEXO_LIMIT_ISSUERS;
  if (raw !== undefined && raw !== null && String(raw).trim() === "") {
    return [];
  }
  const csv =
    raw === undefined || raw === null ? "4,11,15" : String(raw).trim() || "4,11,15";
  const parts = csv
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const droppedOne = parts.includes("1");
  const withoutUnsupportedOne = parts.filter((id) => id !== "1");
  if (droppedOne) {
    // Issuer 1 is often confused with facilitador ids; Plexo rejects if commerce has no issuer 1.
    console.warn(
      "[plexo] Removed issuer id 1 from PLEXO_LIMIT_ISSUERS (not configured for this commerce). Use 4,11,15 or omit."
    );
  }
  return withoutUnsupportedOne;
}
const PLEXO_LIMIT_ISSUERS = computePlexoLimitIssuers();
/** Si es true, ExpressCheckout no envía LimitIssuers (prueba diagnóstica; reinicio requerido). */
function isPlexoExpressOmitLimitIssuers() {
  return /^(1|true|yes)$/i.test(String(process.env.PLEXO_EXPRESS_OMIT_LIMIT_ISSUERS || "").trim());
}

function effectiveLimitIssuersForExpressCheckout() {
  if (isPlexoExpressOmitLimitIssuers()) return [];
  return PLEXO_LIMIT_ISSUERS;
}

/**
 * PaymentData.Installments en ExpressCheckout: Plexo lo documenta como cantidad de cuotas.
 * Enviar 1 permite que el comercio (config en Handy) ofrezca cuotas seleccionables en el checkout.
 * Valores > 1 pueden forzar un número fijo de cuotas en la UI. Default 1.
 * Override: PLEXO_EXPRESS_MAX_INSTALLMENTS
 */
function effectivePlexoExpressMaxInstallments() {
  const raw = process.env.PLEXO_EXPRESS_MAX_INSTALLMENTS;
  if (raw === undefined || raw === null || String(raw).trim() === "") return 1;
  const n = parseInt(String(raw).trim(), 10);
  if (!Number.isFinite(n) || n < 1) return 1;
  if (n > 24) return 24;
  return Math.floor(n);
}

/** Plexo + Totalnet (Visa): manual pide script CyberSource y el mismo id en CybersourceDeviceFingerprint. */
const PLEXO_CYBERSOURCE_ORG_ID = (process.env.PLEXO_CYBERSOURCE_ORG_ID || "45ssiuz3").trim();
/** Prefijo IdComercio para session_id del script (ej. visanetuy_px_1234 u oca_plexo) — lo da Plexo por comercio. */
const PLEXO_CYBERSOURCE_SESSION_PREFIX = (process.env.PLEXO_CYBERSOURCE_SESSION_PREFIX || "").trim();
const PLEXO_CHECKOUT_EMAIL = process.env.PLEXO_CHECKOUT_EMAIL || "";
/** Empty by default: Plexo checkout must not autofill payer name (no "Sacramento Guest"). */
const PLEXO_CHECKOUT_NAME = String(process.env.PLEXO_CHECKOUT_NAME || "").trim();
const PLEXO_CHECKOUT_DOC = process.env.PLEXO_CHECKOUT_DOC || "12345678";
const PLEXO_ADMIN_TOKEN = process.env.PLEXO_ADMIN_TOKEN || "";
const PAYMENT_DEBUG_LOG =
  process.env.PAYMENT_DEBUG_LOG === "1" || /^true$/i.test(String(process.env.PAYMENT_DEBUG_LOG || ""));

const ADMIN_USERNAME = process.env.ADMIN_USERNAME || "";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "";
const ADMIN_JWT_SECRET = process.env.ADMIN_JWT_SECRET || "";
const ADMIN_JWT_TTL_SEC = Number(process.env.ADMIN_JWT_TTL_SEC || 8 * 60 * 60);

const app = express();
app.disable("x-powered-by");

app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" }
  })
);

app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && !isAllowedCorsOrigin(origin)) {
    logRejectedCorsOrigin(origin, req);
  }
  next();
});

app.use(
  cors({
    origin(origin, callback) {
      if (isAllowedCorsOrigin(origin)) return callback(null, true);
      return callback(new Error("Not allowed by CORS"));
    },
    /** Necesario para admin desde GitHub Pages → Render (Bearer en preflight). */
    allowedHeaders: ["Content-Type", "Authorization"],
    methods: ["GET", "POST", "OPTIONS"]
  })
);

app.use((err, req, res, next) => {
  if (err && err.message === "Not allowed by CORS") {
    return res.status(403).json({ error: "Not allowed by CORS" });
  }
  return next(err);
});

app.use(express.json({ limit: "1mb" }));

/** Keep-alive for Render cold-start prewarm; no Plexo, no store, no auth. */
app.get("/health", (_req, res) => {
  res.status(200).json({ ok: true });
});

// Render logs only show stdout; the app had no request logging before, so POSTs looked "invisible".
app.use((req, res, next) => {
  if (req.path === "/health") return next();
  const start = Date.now();
  res.on("finish", () => {
    // eslint-disable-next-line no-console
    console.log(`${req.method} ${req.originalUrl} ${res.statusCode} ${Date.now() - start}ms`);
  });
  next();
});

function stableStringify(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((v) => stableStringify(v)).join(",")}]`;
  const keys = Object.keys(value).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`).join(",")}}`;
}

function hashPayload(payload) {
  const normalized = stableStringify(payload);
  return crypto.createHash("sha256").update(normalized).digest("hex");
}

function buildMockPaymentLink({ fingerprint, amount, currency }) {
  const sessionId = `mock_${fingerprint.slice(0, 16)}`;
  const url = `https://pago.handy.uy/details/?sessionId=${sessionId}&amount=${amount}&currency=${currency}`;
  return { sessionId, paymentUrl: url };
}

/** Plexo guía: montos tipo decimal deben ir como 300.0 en el JSON firmado (no 300), o la verificación falla (InvalidSignature / 13). */
const PLEXO_DECIMAL_FIELD_NAMES = new Set([
  "Amount",
  "BilledAmount",
  "TaxedAmount",
  "TipAmount"
]);

function normalizePlexoValue(value, fieldName = "") {
  if (value === null || value === undefined) return undefined;
  if (Array.isArray(value)) {
    const items = value.map((item) => {
      const normalized = normalizePlexoValue(item, fieldName);
      return normalized === undefined ? null : normalized;
    });
    return `[${items.map((item) => (item === null ? "null" : item)).join(",")}]`;
  }
  if (typeof value === "object") {
    const keys = Object.keys(value).sort();
    const parts = [];
    keys.forEach((k) => {
      const normalized = normalizePlexoValue(value[k], k);
      if (normalized !== undefined) {
        parts.push(`${JSON.stringify(k)}:${normalized}`);
      }
    });
    return `{${parts.join(",")}}`;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    if (PLEXO_DECIMAL_FIELD_NAMES.has(fieldName) && Number.isInteger(value)) {
      return `${value}.0`;
    }
    return JSON.stringify(value);
  }
  return JSON.stringify(value);
}

function plexoStateLabel(value) {
  const map = new Map([
    [0, "started"],
    [1, "paid"],
    [2, "cancelled"],
    [3, "refunded"],
    [10, "denied"],
    [20, "expired"],
    [21, "not_processed"],
    [22, "unable_to_cancel"],
    [23, "issuer_operation_not_supported"],
    [998, "bad_argument"],
    [999, "system_error"]
  ]);
  const n = Number(value);
  if (!Number.isFinite(n)) return String(value || "unknown");
  return map.get(n) || String(n);
}

function mapPaymentStatusToOutcome(paymentStatus) {
  const s = String(paymentStatus || "").toLowerCase();
  if (s === "approved") return "success";
  if (s === "failed") return "failed";
  if (s === "pending" || s === "awaiting_payment") return "pending";
  return "processing";
}

/** `Object.Object.Transactions.Purchase` from Plexo webhook/notification payloads. */
function extractPlexoPurchaseTransaction(node) {
  if (!node || typeof node !== "object") return null;
  const transactions = node.Transactions;
  if (!transactions || typeof transactions !== "object") return null;
  const purchase = transactions.Purchase;
  if (purchase == null) return null;
  if (Array.isArray(purchase)) {
    const last = purchase[purchase.length - 1];
    return last && typeof last === "object" ? last : null;
  }
  return typeof purchase === "object" ? purchase : null;
}

function hasPlexoPurchaseTransaction(node) {
  return extractPlexoPurchaseTransaction(node) != null;
}

/**
 * Authoritative payment outcome from `Transactions.Purchase.Status` + `TransactionCode`.
 * - Status 0 + TransactionCode 0 => approved
 * - e.g. Status 10 + TransactionCode 51 => failed (issuer rejection, "Sin Disponible")
 * - missing/invalid Purchase => pending (no confirmation yet)
 */
function resolvePlexoPaymentStatusFromPurchase(node) {
  const purchase = extractPlexoPurchaseTransaction(node);
  if (!purchase) {
    return {
      paymentStatus: "pending",
      purchaseStatus: null,
      transactionCode: null,
      resolved: false,
      message: null
    };
  }

  const purchaseStatus = Number(purchase.Status ?? purchase.status);
  const transactionCode = Number(purchase.TransactionCode ?? purchase.transactionCode);
  const message =
    pickFirstNonEmpty(
      purchase.TransactionResultText,
      purchase.TransactionMessage,
      purchase.Message,
      purchase.ErrorMessage,
      purchase.IssuerMessage
    ) || null;

  if (!Number.isFinite(purchaseStatus) || !Number.isFinite(transactionCode)) {
    return {
      paymentStatus: "pending",
      purchaseStatus: Number.isFinite(purchaseStatus) ? purchaseStatus : null,
      transactionCode: Number.isFinite(transactionCode) ? transactionCode : null,
      resolved: false,
      message
    };
  }

  if (purchaseStatus === 0 && transactionCode === 0) {
    return {
      paymentStatus: "approved",
      purchaseStatus,
      transactionCode,
      resolved: true,
      message
    };
  }

  return {
    paymentStatus: "failed",
    purchaseStatus,
    transactionCode,
    resolved: true,
    message
  };
}

function extractPlexoPurchaseClientReference(node) {
  const purchase = extractPlexoPurchaseTransaction(node);
  if (!purchase) return "";
  return String(pickFirstNonEmpty(purchase.ClientReferenceId, purchase.clientReferenceId) || "").trim();
}

function extractPlexoClientReference(node) {
  if (!node || typeof node !== "object") return "";
  const fromPurchase = extractPlexoPurchaseClientReference(node);
  if (fromPurchase) return fromPurchase;
  return String(
    pickFirstNonEmpty(
      pickFirstByPaths(node, [
        ["ClientReferenceId"],
        ["PaymentData", "ClientReferenceId"],
        ["Request", "PaymentData", "ClientReferenceId"],
        ["Response", "ClientReferenceId"]
      ])
    ) || ""
  ).trim();
}

function correlatePaymentFromPlexoWebhook(body) {
  const node = body?.Object?.Object || {};
  const clientReferenceId = extractPlexoClientReference(node);
  if (clientReferenceId) {
    const byRef = findPaymentByFingerprint(clientReferenceId);
    return {
      payment: byRef,
      lookupKey: clientReferenceId,
      lookupSource: "clientReferenceId",
      fingerprint: clientReferenceId
    };
  }
  const txId = pickFirstNonEmpty(
    node.TransactionId,
    node.SessionId,
    node.Id,
    body?.Object?.Object?.Response?.Id
  );
  if (txId) {
    const bySession = getPaymentBySessionId(String(txId));
    if (bySession) {
      return {
        payment: bySession,
        lookupKey: String(txId),
        lookupSource: "sessionId",
        fingerprint: bySession.fingerprint || null
      };
    }
  }
  return {
    payment: null,
    lookupKey: clientReferenceId || (txId ? String(txId) : null),
    lookupSource: clientReferenceId ? "clientReferenceId" : txId ? "sessionId" : null,
    fingerprint: clientReferenceId || null
  };
}

function effectivePlexoRedirectUri(fingerprint) {
  const explicit = String(PLEXO_REDIRECT_URL || "").trim();
  const base = explicit || `${PLEXO_FRONTEND_BASE_URL}/Home/payment-return.html`;
  const ref = String(fingerprint || "").trim();
  if (!ref) return base;
  try {
    const url = new URL(base);
    url.searchParams.set("ref", ref);
    return url.toString();
  } catch {
    const sep = base.includes("?") ? "&" : "?";
    return `${base}${sep}ref=${encodeURIComponent(ref)}`;
  }
}

function paymentResultPageUrl(outcome, ref) {
  const page =
    outcome === "success"
      ? "payment-success.html"
      : outcome === "pending"
        ? "payment-pending.html"
        : "payment-failed.html";
  const refTrimmed = String(ref || "").trim();
  const refParam =
    (outcome === "failed" || outcome === "pending") && refTrimmed
      ? `?ref=${encodeURIComponent(refTrimmed)}`
      : "";
  return `${PLEXO_FRONTEND_BASE_URL}/Home/${page}${refParam}`;
}

function readPfxBytes() {
  if (PLEXO_PFX_BASE64) return Buffer.from(PLEXO_PFX_BASE64, "base64");
  if (PLEXO_PFX_PATH) {
    const raw = fs.readFileSync(PLEXO_PFX_PATH);
    /**
     * Render Secret Files often store text. Accept both:
     * - binary .pfx bytes
     * - base64 string content of a .pfx
     */
    const asText = raw.toString("utf8").trim();
    if (asText && /^[A-Za-z0-9+/=\r\n]+$/.test(asText)) {
      try {
        const decoded = Buffer.from(asText.replace(/\s+/g, ""), "base64");
        if (decoded.length > 0 && decoded[0] === 0x30) {
          return decoded;
        }
      } catch {
        // Keep raw bytes fallback below.
      }
    }
    return raw;
  }
  return null;
}

function loadPlexoMaterial() {
  if (PAYMENT_MODE !== "plexo") return null;
  if (!PLEXO_GATEWAY_URL || !PLEXO_CLIENT_NAME || !PLEXO_CERT_PASSWORD) {
    throw new Error("PLEXO_CONFIG_INCOMPLETE");
  }
  const pfxBytes = readPfxBytes();
  if (!pfxBytes) {
    throw new Error("PLEXO_PFX_MISSING");
  }

  const p12Der = forge.util.createBuffer(pfxBytes.toString("binary"));
  const p12Asn1 = forge.asn1.fromDer(p12Der);
  const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, false, PLEXO_CERT_PASSWORD);
  const keyBagType = forge.pki.oids.pkcs8ShroudedKeyBag;
  const certBagType = forge.pki.oids.certBag;
  const keyBags = p12.getBags({ bagType: keyBagType })?.[keyBagType] || [];
  const certBags = p12.getBags({ bagType: certBagType })?.[certBagType] || [];

  if (!keyBags.length || !certBags.length) {
    throw new Error("PLEXO_PFX_INVALID");
  }

  const privateKeyPem = forge.pki.privateKeyToPem(keyBags[0].key);
  const cert = certBags[0].cert;
  const certDer = forge.asn1.toDer(forge.pki.certificateToAsn1(cert)).getBytes();
  const fingerprint = forge.md.sha1.create().update(certDer).digest().toHex().toUpperCase();

  return {
    privateKeyPem,
    fingerprint: PLEXO_CERT_FINGERPRINT || fingerprint
  };
}

const plexoMaterial = (() => {
  try {
    return loadPlexoMaterial();
  } catch (error) {
    // eslint-disable-next-line no-console
    console.warn("Plexo initialization warning:", error instanceof Error ? error.message : String(error));
    return null;
  }
})();

function signPlexoPayload(requestObject) {
  if (!plexoMaterial) {
    throw new Error("PLEXO_NOT_READY");
  }
  const signedArea = {
    Fingerprint: plexoMaterial.fingerprint,
    Object: requestObject,
    UTCUnixTimeExpiration: Date.now() + 5 * 60 * 1000
  };
  const canonical = normalizePlexoValue(signedArea);
  const signature = crypto.sign(
    "RSA-SHA512",
    Buffer.from(canonical, "utf8"),
    {
      key: plexoMaterial.privateKeyPem,
      padding: crypto.constants.RSA_PKCS1_PADDING
    }
  );
  return {
    Object: signedArea,
    Signature: signature.toString("base64")
  };
}

/** Plexo CurrencyId: 1-Uruguayo, 2-Dolar, ... (manual v4.2) */
function mapCurrencyToPlexoId(currency) {
  const c = String(currency || "USD").toUpperCase();
  if (c === "USD" || c === "DOLAR" || c === "DOLLAR") return 2;
  if (c === "UYU" || c === "UY") return 1;
  return 2;
}

/**
 * ExpressCheckout: POST JSON firmado a .../ExpressCheckout (REST; manual v4.2 también lista /Operation/ExpressCheckout en doc antigua).
 * Ejemplo manual incluye ClientInformation + LimitIssuers en AuthorizationData.
 */
function buildPlexoExpressCheckoutRequest(payload) {
  const amount = Number(payload.amount);
  if (!Number.isFinite(amount) || amount <= 0) throw new Error("INVALID_AMOUNT");
  const traceId = String(payload.fingerprint || `${Date.now()}`).slice(0, 64);
  const invoiceNumber = Math.abs(parseInt(String(traceId).replace(/\D/g, "").slice(-9), 10) || Date.now() % 2147483647);
  const contactEmail =
    (PLEXO_CHECKOUT_EMAIL && PLEXO_CHECKOUT_EMAIL.includes("@") && PLEXO_CHECKOUT_EMAIL) ||
    "sacramento.booking@example.com";
  /** Manual: MetaReference suele ser un correo cuando Type=ClientReference; ayuda a homologación. */
  const metaReference =
    (PLEXO_CHECKOUT_EMAIL && PLEXO_CHECKOUT_EMAIL.includes("@") && PLEXO_CHECKOUT_EMAIL) || contactEmail;

  const authorizationData = {
    Action: 64, // ExpressCheckout
    Type: 0,
    MetaReference: metaReference.slice(0, 128),
    RedirectUri: effectivePlexoRedirectUri(traceId),
    DoNotUseCallback: false,
    ClientInformation: {
      ...(PLEXO_CHECKOUT_NAME ? { Name: PLEXO_CHECKOUT_NAME } : {}),
      Address: "Montevideo",
      ...(contactEmail && !/\@example\.com$/i.test(contactEmail) ? { Email: contactEmail } : {}),
      Identification: PLEXO_CHECKOUT_DOC,
      IdentificationType: "0"
    },
    OptionalMetadata: JSON.stringify({
      experience: payload.experience || "booking",
      amount,
      currency: payload.currency || "USD",
      people: payload.people || null
    })
  };

  const limitIssuers = effectiveLimitIssuersForExpressCheckout();
  if (limitIssuers.length > 0) {
    authorizationData.LimitIssuers = limitIssuers;
  }

  const optionalCommerceExpress = plexoOptionalCommerceIdForExpressCheckout();
  if (Number.isFinite(optionalCommerceExpress) && optionalCommerceExpress > 0) {
    authorizationData.OptionalCommerceId = optionalCommerceExpress;
  }

  const paymentData = {
    ClientReferenceId: traceId,
    CurrencyId: mapCurrencyToPlexoId(payload.currency),
    FinancialInclusion: {
      Type: 0, // no aplica (manual)
      BilledAmount: amount,
      TaxedAmount: amount,
      InvoiceNumber: invoiceNumber
    },
    Installments: effectivePlexoExpressMaxInstallments(),
    Items: [
      {
        Amount: amount,
        /** Avoid "…-1" suffix — some gateways mis-parse trailing digits as issuer ids. */
        ClientItemReferenceId: "SacramentoExpressItem",
        Description: String(payload.experience || "Booking"),
        Name: String(payload.experience || "Booking"),
        Quantity: 1
      }
    ],
    PaymentInstrumentInput: {
      UseExtendedClientCreditIfAvailable: false
    }
  };

  if (Number.isFinite(optionalCommerceExpress) && optionalCommerceExpress > 0) {
    paymentData.OptionalCommerceId = optionalCommerceExpress;
  }

  const dfRaw =
    typeof payload.cybersourceDeviceFingerprint === "string"
      ? payload.cybersourceDeviceFingerprint.trim()
      : "";
  if (dfRaw) {
    paymentData.CybersourceDeviceFingerprint = dfRaw.slice(0, 128);
  }

  return {
    Client: PLEXO_CLIENT_NAME,
    Request: {
      AuthorizationData: authorizationData,
      PaymentData: paymentData
    }
  };
}

/** Plexo.Models ResultCodes (gateway); 13 = InvalidSignature */
const PLEXO_GATEWAY_RESULT_HINT = {
  13: "InvalidSignature (revisar firma, fingerprint del .pfx y formato decimal de montos 80.0)"
};

function extractPlexoErrorMessage(rawData) {
  const candidates = [
    rawData?.Object?.Object?.ErrorMessage,
    rawData?.Object?.ErrorMessage,
    rawData?.ErrorMessage
  ];
  for (const c of candidates) {
    if (typeof c === "string" && c.trim()) return c.trim();
  }
  return "";
}

/** Plexo suele enviar I18NErrorMessages (array u objeto) además de ErrorMessage. */
function extractPlexoI18nMessages(rawData) {
  const node = rawData?.Object?.Object ?? rawData?.Object ?? rawData;
  const i18n = node?.I18NErrorMessages;
  if (i18n == null) return "";
  if (typeof i18n === "string") return i18n.trim();
  if (Array.isArray(i18n)) {
    const parts = i18n.map((x) => {
      if (typeof x === "string") return x.trim();
      if (x && typeof x === "object") {
        return String(
          x.Message ?? x.message ?? x.Text ?? x.text ?? x.Description ?? x.description ?? ""
        ).trim();
      }
      return "";
    });
    return parts.filter(Boolean).join(" | ");
  }
  if (typeof i18n === "object") {
    try {
      return JSON.stringify(i18n);
    } catch {
      return "";
    }
  }
  return "";
}

function collectPlexoErrorDetail(rawData) {
  return [extractPlexoErrorMessage(rawData), extractPlexoI18nMessages(rawData)]
    .filter(Boolean)
    .join(" — ");
}

/** URLs de checkout en ambientes Plexo (host varía: web.testing…, testing…:4043, pagos…). */
function isPlexoCheckoutUrlString(s) {
  if (typeof s !== "string" || !/^https:\/\//i.test(s)) return false;
  try {
    const host = new URL(s).hostname.toLowerCase();
    if (host.includes("plexo")) return true;
    if (host.endsWith("handy.uy") || host.includes(".handy.uy")) return true;
  } catch {
    return false;
  }
  return false;
}

/** Busca Uri de checkout en cualquier nivel (REST anida distinto; strings sueltas no solo bajo "Uri"). */
function findPlexoCheckoutUrlDeep(node, depth = 0) {
  if (depth > 14 || node == null) return "";
  if (typeof node === "string") {
    return isPlexoCheckoutUrlString(node) ? node : "";
  }
  if (typeof node !== "object") return "";
  if (Array.isArray(node)) {
    for (const item of node) {
      const u = findPlexoCheckoutUrlDeep(item, depth + 1);
      if (u) return u;
    }
    return "";
  }
  const direct =
    node.Uri ||
    node.uri ||
    node.URL ||
    node.url ||
    node.checkoutUrl ||
    node.CheckoutUri ||
    node.checkoutURI ||
    node.RedirectUrl ||
    node.redirectUrl ||
    node.PaymentUrl ||
    node.paymentUrl ||
    node.Link ||
    node.link ||
    node.Href ||
    node.href ||
    "";
  if (typeof direct === "string" && /^https:\/\//i.test(direct)) return direct;
  for (const k of Object.keys(node)) {
    const u = findPlexoCheckoutUrlDeep(node[k], depth + 1);
    if (u) return u;
  }
  return "";
}

function pickPlexoResponse(rawData) {
  const resultCode =
    rawData?.Object?.Object?.ResultCode ??
    rawData?.Object?.ResultCode ??
    rawData?.ResultCode ??
    0;
  const resultCodeNumber = Number(resultCode);
  const errDetail = collectPlexoErrorDetail(rawData);
  const hint = PLEXO_GATEWAY_RESULT_HINT[resultCodeNumber];

  const responseNode =
    rawData?.Object?.Object?.Response ||
    rawData?.Object?.Object?.Object?.Response ||
    rawData?.Object?.Response ||
    rawData?.Response ||
    null;
  const hasResponse =
    responseNode != null && typeof responseNode === "object" && !Array.isArray(responseNode);

  if (![0, 1, 2].includes(resultCodeNumber)) {
    const extra = [hint, errDetail].filter(Boolean).join(" — ");
    throw new Error(extra ? `PLEXO_RESULT_${resultCode} ${extra}` : `PLEXO_RESULT_${resultCode}`);
  }

  // ExpressCheckout exitoso trae Response.{ Uri, Id, ... }. Sin Response pero con mensajes = rechazo Plexo (no "falta Uri").
  if (!hasResponse) {
    const deepUrl = findPlexoCheckoutUrlDeep(rawData);
    if (deepUrl) {
      const sessionId =
        deepUrl.split("/").filter(Boolean).pop() || `plexo_${Date.now()}`;
      return { paymentUrl: deepUrl, sessionId };
    }
    if (errDetail) {
      throw new Error(`PLEXO_CHECKOUT_ERROR_${resultCodeNumber} ${errDetail}`);
    }
    if (PAYMENT_DEBUG_LOG) {
      let snippet = "";
      try {
        snippet = JSON.stringify(rawData).slice(0, 3500);
      } catch {
        snippet = "[unserializable]";
      }
      // eslint-disable-next-line no-console
      console.log("[plexo-auth] missing-response raw snapshot (truncated)", snippet);
    }
    throw new Error(`PLEXO_RESPONSE_MISSING_RESPONSE_RESULT_${resultCodeNumber}`);
  }

  let paymentUrl =
    responseNode.Uri ||
    responseNode.uri ||
    responseNode.URL ||
    responseNode.url ||
    responseNode.checkoutUrl ||
    responseNode.CheckoutUri ||
    responseNode.RedirectUrl ||
    responseNode.redirectUrl ||
    "";
  if (!paymentUrl) {
    paymentUrl = findPlexoCheckoutUrlDeep(rawData);
  }
  const sessionId =
    responseNode.Id ||
    responseNode.SessionId ||
    responseNode.id ||
    (paymentUrl ? paymentUrl.split("/").filter(Boolean).pop() : "") ||
    `plexo_${Date.now()}`;
  if (!paymentUrl) {
    if (errDetail) {
      throw new Error(`PLEXO_CHECKOUT_ERROR_${resultCodeNumber} ${errDetail}`);
    }
    if (PAYMENT_DEBUG_LOG) {
      let snippet = "";
      try {
        snippet = JSON.stringify(rawData).slice(0, 3500);
      } catch {
        snippet = "[unserializable]";
      }
      // eslint-disable-next-line no-console
      console.log("[plexo-auth] missing-uri raw snapshot (truncated)", snippet);
    }
    throw new Error(`PLEXO_RESPONSE_MISSING_URI_RESULT_${resultCode}`);
  }
  return { paymentUrl, sessionId };
}

function logPlexoAuthResponseShape(label, rawData) {
  if (!PAYMENT_DEBUG_LOG) return;
  try {
    const resultCode =
      rawData?.Object?.Object?.ResultCode ??
      rawData?.Object?.ResultCode ??
      rawData?.ResultCode ??
      null;
    const inner = rawData?.Object?.Object ?? rawData?.Object ?? rawData;
    const responseNode =
      rawData?.Object?.Object?.Response ||
      rawData?.Object?.Object?.Object?.Response ||
      rawData?.Object?.Response ||
      rawData?.Response;
    const innerKeys = inner && typeof inner === "object" ? Object.keys(inner) : [];
    const responseKeys =
      responseNode && typeof responseNode === "object" ? Object.keys(responseNode) : [];
    const errPreview = collectPlexoErrorDetail(rawData).slice(0, 800);
    // eslint-disable-next-line no-console
    console.log(
      `[plexo-auth] ${label}`,
      JSON.stringify({
        resultCode,
        innerKeys,
        responseKeys,
        hasResponse: Boolean(responseNode && typeof responseNode === "object"),
        hasUriField: Boolean(
          responseNode?.Uri ||
            responseNode?.uri ||
            responseNode?.URL ||
            responseNode?.url ||
            responseNode?.checkoutUrl
        ),
        errorPreview: errPreview || undefined
      })
    );
  } catch (e) {
    // eslint-disable-next-line no-console
    console.log("[plexo-auth] log shape failed", e instanceof Error ? e.message : String(e));
  }
}

async function createPlexoPaymentLink(payload) {
  if (!PLEXO_GATEWAY_URL) {
    throw new Error("PLEXO_GATEWAY_URL_MISSING");
  }
  const base = PLEXO_GATEWAY_URL.replace(/\/+$/, "");
  // Plexo exposes ExpressCheckout at /ExpressCheckout (not /Operation/ExpressCheckout — that path 404s).
  const endpoint = `${base}/ExpressCheckout`;
  const requestBody = signPlexoPayload(buildPlexoExpressCheckoutRequest(payload));
  const reqInner = requestBody?.Object?.Object?.Request;
  // eslint-disable-next-line no-console
  console.log(
    "[plexo-express-out]",
    JSON.stringify({
      envCommerceId: PLEXO_COMMERCE_ID,
      envOptionalCommerceId: PLEXO_OPTIONAL_COMMERCE_ID,
      limitIssuers: reqInner?.AuthorizationData?.LimitIssuers ?? null,
      optionalCommerceAuth: reqInner?.AuthorizationData?.OptionalCommerceId ?? null,
      optionalCommercePay: reqInner?.PaymentData?.OptionalCommerceId ?? null,
      currencyId: reqInner?.PaymentData?.CurrencyId ?? null,
      installments: reqInner?.PaymentData?.Installments ?? null,
      omitLimitIssuersFlag: isPlexoExpressOmitLimitIssuers()
    })
  );
  if (PAYMENT_DEBUG_LOG) {
    // eslint-disable-next-line no-console
    console.log(
      "[plexo-req] OptionalCommerceId",
      JSON.stringify({
        envCommerceId: PLEXO_COMMERCE_ID,
        envOptionalCommerceId: PLEXO_OPTIONAL_COMMERCE_ID,
        sentInAuth: reqInner?.AuthorizationData?.OptionalCommerceId ?? null,
        sentInPayment: reqInner?.PaymentData?.OptionalCommerceId ?? null,
        limitIssuers: reqInner?.AuthorizationData?.LimitIssuers ?? null
      })
    );
  }
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(requestBody)
  });
  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`PLEXO_EXPRESS_CHECKOUT_FAILED ${response.status} ${errorBody}`);
  }
  const data = await response.json();
  logPlexoAuthResponseShape("express-checkout", data);
  return pickPlexoResponse(data);
}

async function callPlexoSigned(pathSuffix, requestObject) {
  if (!PLEXO_GATEWAY_URL) throw new Error("PLEXO_GATEWAY_URL_MISSING");
  const base = PLEXO_GATEWAY_URL.replace(/\/+$/, "");
  const endpoint = `${base}${pathSuffix}`;
  const body = signPlexoPayload({
    Client: PLEXO_CLIENT_NAME,
    ...(requestObject ? { Request: requestObject } : {})
  });
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`PLEXO_${pathSuffix.replace(/\//g, "_").toUpperCase()}_FAILED ${response.status} ${text}`);
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`PLEXO_${pathSuffix.replace(/\//g, "_").toUpperCase()}_INVALID_JSON`);
  }
}

function ensurePlexoAdminAccess(req, res) {
  if (PAYMENT_MODE !== "plexo") {
    res.status(400).json({ error: "Plexo admin endpoints require PAYMENT_MODE=plexo." });
    return false;
  }
  if (!PLEXO_ADMIN_TOKEN) {
    res.status(400).json({ error: "PLEXO_ADMIN_TOKEN is required for admin endpoints." });
    return false;
  }
  const sent = req.get("x-plexo-admin-token") || "";
  if (sent !== PLEXO_ADMIN_TOKEN) {
    res.status(401).json({ error: "Invalid admin token." });
    return false;
  }
  return true;
}

async function createPaymentLink(payload) {
  if (PAYMENT_MODE === "mock") {
    return buildMockPaymentLink(payload);
  }

  if (PAYMENT_MODE === "plexo") {
    return createPlexoPaymentLink(payload);
  }

  if (!HANDY_CREATE_URL || !HANDY_TOKEN) {
    throw new Error("HANDY_CONFIG_INCOMPLETE");
  }

  const response = await fetch(HANDY_CREATE_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${HANDY_TOKEN}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      amount: payload.amount,
      currency: payload.currency,
      description: payload.experience,
      metadata: {
        fingerprint: payload.fingerprint,
        people: payload.people,
        experience: payload.experience
      }
    })
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`HANDY_CREATE_FAILED ${response.status} ${errorBody}`);
  }

  const data = await response.json();
  const paymentUrl =
    data.paymentUrl || data.url || data.checkoutUrl || data.link || data.payment_link || "";
  const sessionId =
    data.sessionId || data.session_id || data.id || data.reference || `handy_${Date.now()}`;

  if (!paymentUrl) {
    throw new Error("HANDY_RESPONSE_MISSING_PAYMENT_URL");
  }

  return { sessionId, paymentUrl };
}

/** --- Admin auth (JWT HS256, sin dependencias extra) --- */

function b64urlFromBuffer(buf) {
  return Buffer.from(buf).toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function b64urlJson(obj) {
  return b64urlFromBuffer(Buffer.from(JSON.stringify(obj), "utf8"));
}

function signAdminToken() {
  const iat = Math.floor(Date.now() / 1000);
  const exp = iat + (Number.isFinite(ADMIN_JWT_TTL_SEC) && ADMIN_JWT_TTL_SEC > 0 ? ADMIN_JWT_TTL_SEC : 3600);
  const payload = { sub: "sacramento-admin", iat, exp };
  const header = { alg: "HS256", typ: "JWT" };
  const h = b64urlJson(header);
  const p = b64urlJson(payload);
  const data = `${h}.${p}`;
  const sig = crypto.createHmac("sha256", ADMIN_JWT_SECRET).update(data).digest();
  return `${data}.${b64urlFromBuffer(sig)}`;
}

function parseB64urlToBuffer(s) {
  let str = String(s).replace(/-/g, "+").replace(/_/g, "/");
  while (str.length % 4) str += "=";
  return Buffer.from(str, "base64");
}

function verifyAdminToken(token) {
  if (!token || !ADMIN_JWT_SECRET) return null;
  const parts = String(token).split(".");
  if (parts.length !== 3) return null;
  const [h, p, s] = parts;
  const data = `${h}.${p}`;
  const expected = crypto.createHmac("sha256", ADMIN_JWT_SECRET).update(data).digest();
  let got;
  try {
    got = parseB64urlToBuffer(s);
  } catch {
    return null;
  }
  if (got.length !== expected.length || !crypto.timingSafeEqual(got, expected)) return null;
  let payload;
  try {
    payload = JSON.parse(parseB64urlToBuffer(p).toString("utf8"));
  } catch {
    return null;
  }
  const now = Math.floor(Date.now() / 1000);
  if (payload.exp != null && now >= Number(payload.exp)) return null;
  if (payload.sub !== "sacramento-admin") return null;
  return payload;
}

function requireAdminAuth(req, res, next) {
  const auth = req.headers.authorization || "";
  const m = /^Bearer\s+(\S+)/i.exec(auth);
  if (!m) {
    return res.status(401).json({ error: "Missing or invalid Authorization header." });
  }
  const payload = verifyAdminToken(m[1]);
  if (!payload) {
    return res.status(401).json({ error: "Invalid or expired admin token." });
  }
  req.admin = payload;
  return next();
}

function pickFirstNonEmpty(...values) {
  for (const v of values) {
    if (v === undefined || v === null) continue;
    const s = String(v).trim();
    if (s) return s;
  }
  return "";
}

function getByPath(obj, pathArray) {
  let cur = obj;
  for (const p of pathArray) {
    if (!cur || typeof cur !== "object") return undefined;
    cur = cur[p];
  }
  return cur;
}

function pickFirstByPaths(obj, paths) {
  for (const pathArr of paths) {
    const v = getByPath(obj, pathArr);
    if (v === undefined || v === null) continue;
    const s = String(v).trim();
    if (s) return s;
  }
  return "";
}

function extractMaskedCardInfo(...sources) {
  const nonNullSources = sources.filter((x) => x && typeof x === "object");
  const masked = pickFirstNonEmpty(
    ...nonNullSources.map((s) =>
      pickFirstByPaths(s, [
        ["CardNumberMasked"],
        ["MaskedCardNumber"],
        ["PanMasked"],
        ["CardMasked"],
        ["Card", "MaskedNumber"],
        ["PaymentInstrument", "MaskedPan"],
        ["PaymentInstrument", "MaskedCardNumber"],
        ["Instrument", "MaskedPan"]
      ])
    )
  );
  const brand = pickFirstNonEmpty(
    ...nonNullSources.map((s) =>
      pickFirstByPaths(s, [
        ["CardBrand"],
        ["Brand"],
        ["CardType"],
        ["PaymentInstrument", "Brand"],
        ["Card", "Brand"]
      ])
    )
  );
  const holder = pickFirstNonEmpty(
    ...nonNullSources.map((s) =>
      pickFirstByPaths(s, [
        ["CardHolder"],
        ["Cardholder"],
        ["HolderName"],
        ["Card", "HolderName"],
        ["PaymentInstrument", "HolderName"],
        ["ClientInformation", "Name"]
      ])
    )
  );
  const last4Match = masked.match(/(\d{4})\D*$/);
  return {
    maskedNumber: masked || undefined,
    last4: last4Match ? last4Match[1] : undefined,
    brand: brand || undefined,
    holderName: holder || undefined
  };
}

function buildAttemptMetaFromPlexoWebhook(payload) {
  const plexoPayload = payload?.Object?.Object || {};
  const responseObj = payload?.Object?.Object?.Response || {};
  const purchase = extractPlexoPurchaseTransaction(plexoPayload);
  const purchaseOutcome = resolvePlexoPaymentStatusFromPurchase(plexoPayload);
  const paymentStatus = purchaseOutcome.resolved ? purchaseOutcome.paymentStatus : undefined;
  const card = extractMaskedCardInfo(plexoPayload, responseObj, payload);
  const transactionResultText =
    pickFirstNonEmpty(purchase?.TransactionResultText, purchase?.transactionResultText) || undefined;
  const authorization =
    pickFirstNonEmpty(
      purchase?.Authorization,
      purchase?.authorization,
      plexoPayload?.Authorization,
      plexoPayload?.authorization
    ) || undefined;
  const cardIssuer =
    pickFirstNonEmpty(
      purchase?.CardIssuer,
      purchase?.cardIssuer,
      purchase?.IssuerName,
      plexoPayload?.CardIssuer,
      plexoPayload?.cardIssuer
    ) || undefined;
  const cardType =
    pickFirstNonEmpty(
      purchase?.CardType,
      purchase?.cardType,
      plexoPayload?.CardType,
      plexoPayload?.cardType,
      card.brand
    ) || undefined;
  const payerName = pickFirstNonEmpty(
    pickFirstByPaths(plexoPayload, [["ClientInformation", "Name"], ["BuyerName"], ["PayerName"]]),
    pickFirstByPaths(responseObj, [["ClientInformation", "Name"], ["BuyerName"], ["PayerName"]]),
    card.holderName
  );
  const payerEmail = pickFirstNonEmpty(
    pickFirstByPaths(plexoPayload, [["ClientInformation", "Email"], ["Email"], ["PayerEmail"]]),
    pickFirstByPaths(responseObj, [["ClientInformation", "Email"], ["Email"], ["PayerEmail"]])
  );
  const issuerName = pickFirstNonEmpty(
    pickFirstByPaths(plexoPayload, [["IssuerName"]]),
    pickFirstByPaths(responseObj, [["IssuerName"]])
  );
  const issuerId = pickFirstNonEmpty(
    pickFirstByPaths(plexoPayload, [["IssuerId"]]),
    pickFirstByPaths(responseObj, [["IssuerId"]])
  );

  return {
    status: paymentStatus || "ignored",
    source: "webhook_plexo",
    gateway: "plexo",
    card,
    payer: {
      name: payerName || undefined,
      email: payerEmail || undefined
    },
    issuer: {
      id: issuerId || undefined,
      name: issuerName || undefined
    },
    reference: pickFirstNonEmpty(plexoPayload?.TransactionId, plexoPayload?.SessionId, plexoPayload?.Id),
    raw: {
      purchaseStatus: purchaseOutcome.purchaseStatus,
      transactionCode: purchaseOutcome.transactionCode,
      transactionMessage: purchaseOutcome.message,
      transactionResultText,
      authorization,
      cardIssuer,
      cardType,
      resolved: purchaseOutcome.resolved,
      currentState: plexoPayload?.CurrentState,
      statusCode: plexoPayload?.Status
    }
  };
}

function buildAttemptMetaFromGenericWebhook(body, status) {
  const card = extractMaskedCardInfo(body);
  return {
    status: String(status || "unknown"),
    source: "webhook_generic",
    gateway: PAYMENT_MODE,
    card,
    payer: {
      name: pickFirstByPaths(body, [["payerName"], ["cardHolder"], ["holderName"], ["customer", "name"]]) || undefined,
      email: pickFirstByPaths(body, [["payerEmail"], ["customer", "email"]]) || undefined
    },
    issuer: {
      id: pickFirstByPaths(body, [["issuerId"]]) || undefined,
      name: pickFirstByPaths(body, [["issuerName"]]) || undefined
    },
    reference: pickFirstByPaths(body, [["authorizationCode"], ["authCode"], ["reference"]]) || undefined
  };
}

app.post("/api/payments/admin/login", (req, res) => {
  const username = req.body?.username;
  const password = req.body?.password;
  if (!ADMIN_USERNAME || !ADMIN_PASSWORD || !ADMIN_JWT_SECRET) {
    return res.status(503).json({
      error: "Admin login is not configured (set ADMIN_USERNAME, ADMIN_PASSWORD, ADMIN_JWT_SECRET)."
    });
  }
  if (String(username) !== ADMIN_USERNAME || String(password) !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: "Invalid username or password." });
  }
  try {
    const token = signAdminToken();
    return res.json({
      ok: true,
      token,
      tokenType: "Bearer",
      expiresIn: Number.isFinite(ADMIN_JWT_TTL_SEC) && ADMIN_JWT_TTL_SEC > 0 ? ADMIN_JWT_TTL_SEC : 3600
    });
  } catch {
    return res.status(500).json({ error: "Could not issue admin token." });
  }
});

app.get("/api/payments/admin/payments", requireAdminAuth, (req, res) => {
  const status = req.query.status != null && String(req.query.status).trim() ? String(req.query.status).trim() : "";
  const experience =
    req.query.experience != null && String(req.query.experience).trim()
      ? String(req.query.experience).trim()
      : "";
  const q = req.query.q != null && String(req.query.q).trim() ? String(req.query.q).trim() : "";
  const from = req.query.from != null && String(req.query.from).trim() ? String(req.query.from).trim() : "";
  const to = req.query.to != null && String(req.query.to).trim() ? String(req.query.to).trim() : "";
  const sort = req.query.sort === "createdAt" ? "createdAt" : "updatedAt";
  const order = /^asc$/i.test(String(req.query.order || "")) ? "asc" : "desc";
  const includeMock = /^true$/i.test(String(req.query.includeMock || ""));

  const result = listPayments({
    status: status || undefined,
    experience: experience || undefined,
    q: q || undefined,
    from: from || undefined,
    to: to || undefined,
    limit: req.query.limit,
    offset: req.query.offset,
    sort,
    order,
    includeMock
  });

  return res.json({ ok: true, ...result });
});

app.get("/api/payments/admin/payments/:sessionId", requireAdminAuth, (req, res) => {
  const sessionId = decodeURIComponent(String(req.params.sessionId || ""));
  if (!sessionId) {
    return res.status(400).json({ error: "sessionId is required." });
  }
  const payment = getPaymentBySessionId(sessionId);
  if (!payment) {
    return res.status(404).json({ error: "Payment not found." });
  }
  const attempts = Array.isArray(payment.paymentAttempts) ? payment.paymentAttempts : [];
  return res.json({
    ok: true,
    item: {
      ...payment,
      attemptsCount: attempts.length,
      lastAttemptAt: attempts.length ? attempts[attempts.length - 1].at : null
    }
  });
});

app.get("/api/payments/plexo-client-hints", (_req, res) => {
  res.json({
    paymentMode: PAYMENT_MODE,
    cybersourceOrgId: PAYMENT_MODE === "plexo" ? PLEXO_CYBERSOURCE_ORG_ID : "",
    cybersourceSessionPrefix: PAYMENT_MODE === "plexo" ? PLEXO_CYBERSOURCE_SESSION_PREFIX : ""
  });
});

function buildPaymentsHealthDetail() {
  return {
    ok: true,
    mode: PAYMENT_MODE,
    ttlMinutes: LINK_TTL_MINUTES,
    plexoReady: PAYMENT_MODE !== "plexo" ? undefined : Boolean(plexoMaterial),
    plexoFrontendBaseUrl: PAYMENT_MODE === "plexo" ? PLEXO_FRONTEND_BASE_URL : undefined,
    plexoRedirectUriEffective: PAYMENT_MODE === "plexo" ? effectivePlexoRedirectUri() : undefined,
    plexoCommerceIdEnv: PAYMENT_MODE === "plexo" ? PLEXO_COMMERCE_ID : undefined,
    plexoOptionalCommerceIdEnv: PAYMENT_MODE === "plexo" ? PLEXO_OPTIONAL_COMMERCE_ID : undefined,
    plexoExpressOptionalCommerceIdEffective:
      PAYMENT_MODE === "plexo" ? plexoOptionalCommerceIdForExpressCheckout() : undefined,
    plexoLimitIssuersEffective: PAYMENT_MODE === "plexo" ? PLEXO_LIMIT_ISSUERS : undefined,
    plexoExpressLimitIssuersEffective: PAYMENT_MODE === "plexo" ? effectiveLimitIssuersForExpressCheckout() : undefined,
    plexoExpressOmitLimitIssuers: PAYMENT_MODE === "plexo" ? isPlexoExpressOmitLimitIssuers() : undefined,
    plexoLimitIssuersEnvRaw: PAYMENT_MODE === "plexo" ? process.env.PLEXO_LIMIT_ISSUERS ?? null : undefined,
    plexoExpressMaxInstallmentsEffective:
      PAYMENT_MODE === "plexo" ? effectivePlexoExpressMaxInstallments() : undefined,
    plexoExpressMaxInstallmentsEnvRaw:
      PAYMENT_MODE === "plexo" ? process.env.PLEXO_EXPRESS_MAX_INSTALLMENTS ?? null : undefined,
    plexoClientConfigured: PAYMENT_MODE === "plexo" ? Boolean(PLEXO_CLIENT_NAME) : undefined,
    plexoAdminTokenConfigured: PAYMENT_MODE === "plexo" ? Boolean(PLEXO_ADMIN_TOKEN) : undefined
  };
}

app.get("/api/payments/health", (_req, res) => {
  res.json({ ok: true });
});

app.get("/api/payments/health/detail", requireAdminAuth, (_req, res) => {
  res.json(buildPaymentsHealthDetail());
});

/** Public read: post-checkout outcome by order fingerprint (`ref` in RedirectUri). */
app.get("/api/payments/result", (req, res) => {
  const ref = String(req.query.ref || "").trim();
  if (!ref) {
    return res.status(400).json({ error: "ref is required" });
  }
  const payment = findPaymentByFingerprint(ref);
  if (!payment) {
    return res.json({
      ref,
      found: false,
      paymentStatus: null,
      outcome: "pending",
      updatedAt: null,
      plexoResultCode: null
    });
  }
  const paymentStatus = String(payment.paymentStatus || "awaiting_payment");
  return res.json({
    ref,
    found: true,
    paymentStatus,
    outcome: mapPaymentStatusToOutcome(paymentStatus),
    updatedAt: payment.updatedAt || payment.createdAt || null,
    plexoResultCode: payment.plexoResultCode ?? null,
    experience: payment.experience || null,
    amount: payment.amount ?? null,
    currency: payment.currency || null,
    people: payment.people ?? null,
    orderPayload: payment.orderPayload ?? null
  });
});

/** Browser return after Plexo Express Checkout (optional RedirectUri target on the API host). */
app.get("/payment/return", (req, res) => {
  const ref = String(req.query.ref || "").trim();
  if (ref) {
    const payment = findPaymentByFingerprint(ref);
    const paymentStatus = payment?.paymentStatus || "awaiting_payment";
    const outcome = mapPaymentStatusToOutcome(paymentStatus);
    if (outcome === "processing") {
      return res.redirect(
        302,
        `${PLEXO_FRONTEND_BASE_URL}/Home/payment-return.html?ref=${encodeURIComponent(ref)}`
      );
    }
    return res.redirect(302, paymentResultPageUrl(outcome, ref));
  }
  return res.redirect(302, `${PLEXO_FRONTEND_BASE_URL}/Home/payment-return.html`);
});

app.get("/api/payments/plexo/commerces", async (req, res) => {
  if (!ensurePlexoAdminAccess(req, res)) return;
  try {
    const data = await callPlexoSigned("/Commerce");
    const resultCode = data?.Object?.Object?.ResultCode ?? data?.Object?.ResultCode ?? data?.ResultCode ?? null;
    const response = data?.Object?.Object?.Response ?? data?.Object?.Response ?? data?.Response ?? [];
    return res.json({ ok: true, resultCode, commerces: response, raw: PAYMENT_DEBUG_LOG ? data : undefined });
  } catch (error) {
    return res.status(502).json({
      error: "Failed to get commerces",
      detail: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

app.post("/api/payments/plexo/commerces", async (req, res) => {
  if (!ensurePlexoAdminAccess(req, res)) return;
  const name = String(req.body?.name || "").trim();
  if (!name) {
    return res.status(400).json({ error: "name is required." });
  }
  try {
    const data = await callPlexoSigned("/Commerce/Add", { Name: name });
    const resultCode = data?.Object?.Object?.ResultCode ?? data?.Object?.ResultCode ?? data?.ResultCode ?? null;
    const response = data?.Object?.Object?.Response ?? data?.Object?.Response ?? data?.Response ?? null;
    return res.json({ ok: true, resultCode, commerce: response, raw: PAYMENT_DEBUG_LOG ? data : undefined });
  } catch (error) {
    return res.status(502).json({
      error: "Failed to add commerce",
      detail: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

app.get("/api/payments/plexo/issuers/supported", async (req, res) => {
  if (!ensurePlexoAdminAccess(req, res)) return;
  try {
    const data = await callPlexoSigned("/Issuer");
    const resultCode = data?.Object?.Object?.ResultCode ?? data?.Object?.ResultCode ?? data?.ResultCode ?? null;
    const response = data?.Object?.Object?.Response ?? data?.Object?.Response ?? data?.Response ?? [];
    return res.json({ ok: true, resultCode, issuers: response, raw: PAYMENT_DEBUG_LOG ? data : undefined });
  } catch (error) {
    return res.status(502).json({
      error: "Failed to get supported issuers",
      detail: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

app.get("/api/payments/plexo/commerces/:commerceId/issuers", async (req, res) => {
  if (!ensurePlexoAdminAccess(req, res)) return;
  const commerceId = Number(req.params.commerceId);
  if (!Number.isFinite(commerceId) || commerceId <= 0) {
    return res.status(400).json({ error: "commerceId must be a positive number." });
  }
  try {
    const data = await callPlexoSigned("/Commerce/Issuer", { CommerceId: commerceId });
    const resultCode = data?.Object?.Object?.ResultCode ?? data?.Object?.ResultCode ?? data?.ResultCode ?? null;
    const response = data?.Object?.Object?.Response ?? data?.Object?.Response ?? data?.Response ?? [];
    return res.json({ ok: true, resultCode, issuers: response, raw: PAYMENT_DEBUG_LOG ? data : undefined });
  } catch (error) {
    return res.status(502).json({
      error: "Failed to get commerce issuers",
      detail: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

app.post("/api/payments/plexo/commerces/:commerceId/issuers", async (req, res) => {
  if (!ensurePlexoAdminAccess(req, res)) return;
  const commerceId = Number(req.params.commerceId);
  const issuerId = Number(req.body?.issuerId);
  const metadataInput = req.body?.metadata;
  if (!Number.isFinite(commerceId) || commerceId <= 0) {
    return res.status(400).json({ error: "commerceId must be a positive number." });
  }
  if (!Number.isFinite(issuerId) || issuerId <= 0) {
    return res.status(400).json({ error: "issuerId must be a positive number." });
  }
  if (!metadataInput || typeof metadataInput !== "object" || Array.isArray(metadataInput)) {
    return res.status(400).json({ error: "metadata object is required." });
  }
  const metadata = {};
  for (const [k, v] of Object.entries(metadataInput)) {
    if (v === undefined || v === null) continue;
    metadata[String(k)] = String(v);
  }
  try {
    const data = await callPlexoSigned("/Commerce/Issuer/Add", {
      CommerceId: commerceId,
      IssuerId: issuerId,
      Metadata: metadata
    });
    const resultCode = data?.Object?.Object?.ResultCode ?? data?.Object?.ResultCode ?? data?.ResultCode ?? null;
    const response = data?.Object?.Object?.Response ?? data?.Object?.Response ?? data?.Response ?? null;
    return res.json({ ok: true, resultCode, issuerConfig: response, raw: PAYMENT_DEBUG_LOG ? data : undefined });
  } catch (error) {
    return res.status(502).json({
      error: "Failed to add commerce issuer",
      detail: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

app.post("/api/payments/resolve", async (req, res) => {
  const {
    experience,
    amount,
    currency = "USD",
    people,
    orderPayload,
    cybersourceDeviceFingerprint,
    forceNewAttempt
  } = req.body || {};
  if (!experience || !Number.isFinite(Number(amount)) || Number(amount) <= 0) {
    return res.status(400).json({ error: "Invalid payload: experience/amount required." });
  }

  const dfIn =
    typeof cybersourceDeviceFingerprint === "string" ? cybersourceDeviceFingerprint.trim().slice(0, 128) : "";

  const normalizedPayload = {
    experience: String(experience),
    amount: Number(amount),
    currency: String(currency),
    people: Number.isFinite(Number(people)) ? Number(people) : null,
    orderPayload: orderPayload || null,
    paymentMode: PAYMENT_MODE,
    ...(dfIn ? { cybersourceDeviceFingerprint: dfIn } : {})
  };

  const nowIso = new Date().toISOString();
  const fingerprint = hashPayload(normalizedPayload);
  const forceNewAttemptRequested = forceNewAttempt === true;
  const resolveRetryReason =
    forceNewAttemptRequested &&
    (() => {
      const raw = String(req.body?.retryReason || req.body?.reason || "user_retry").trim();
      return raw === "user_retry_pending" || raw === "user_retry" ? raw : "user_retry";
    })();
  const existingPayment = findPaymentByFingerprint(fingerprint);
  const previousSessionId = existingPayment?.sessionId ? String(existingPayment.sessionId) : null;

  if (forceNewAttemptRequested) {
    const existingPaymentStatus = String(existingPayment?.paymentStatus || "")
      .trim()
      .toLowerCase();
    if (existingPaymentStatus === "approved") {
      // eslint-disable-next-line no-console
      console.log("[payments-resolve] user_retry skipped: order already approved", {
        fingerprint,
        forceNewAttempt: true,
        reason: resolveRetryReason,
        previousSessionId,
        paymentStatus: "approved"
      });
      return res.json({
        alreadyApproved: true,
        paymentStatus: "approved",
        fingerprint,
        sessionId: previousSessionId,
        previousSessionId,
        forceNewAttempt: true,
        reason: resolveRetryReason,
        reused: false
      });
    }
  }

  const reusable = forceNewAttemptRequested ? null : findReusableLink(fingerprint, nowIso);

  const reusableIsMock =
    reusable &&
    (String(reusable.sessionId || "").startsWith("mock_") || String(reusable.paymentUrl || "").includes("sessionId=mock_"));
  if (reusable && !(PAYMENT_MODE !== "mock" && reusableIsMock)) {
    // eslint-disable-next-line no-console
    console.log("[payments-resolve] reused existing link", {
      fingerprint,
      sessionId: reusable.sessionId,
      upsertLink: false,
      paymentStatus: reusable.paymentStatus || "awaiting_payment"
    });
    return res.json({
      reused: true,
      paymentUrl: reusable.paymentUrl,
      sessionId: reusable.sessionId,
      fingerprint
    });
  }

  try {
    const created = await createPaymentLink({
      ...normalizedPayload,
      fingerprint
    });

    const expiresAt = new Date(Date.now() + LINK_TTL_MINUTES * 60 * 1000).toISOString();
    upsertLink({
      fingerprint,
      experience: normalizedPayload.experience,
      amount: normalizedPayload.amount,
      currency: normalizedPayload.currency,
      people: normalizedPayload.people,
      orderPayload: normalizedPayload.orderPayload,
      paymentUrl: created.paymentUrl,
      sessionId: created.sessionId,
      status: "active",
      paymentStatus: "awaiting_payment",
      createdAt: nowIso,
      updatedAt: nowIso,
      expiresAt
    });

    const stored = getPaymentBySessionId(created.sessionId);
    const storedPaymentStatus = String(stored?.paymentStatus || "awaiting_payment")
      .trim()
      .toLowerCase();
    const storeConfirmed =
      Boolean(stored) &&
      stored.fingerprint === fingerprint &&
      stored.status === "active" &&
      storedPaymentStatus === "awaiting_payment";
    // eslint-disable-next-line no-console
    console.log("[payments-resolve] new link stored", {
      fingerprint,
      sessionId: created.sessionId,
      upsertLink: true,
      storeConfirmed,
      experience: normalizedPayload.experience,
      amount: normalizedPayload.amount,
      currency: normalizedPayload.currency
    });
    if (!storeConfirmed) {
      // eslint-disable-next-line no-console
      console.warn("[payments-resolve] upsertLink verification failed", {
        fingerprint,
        sessionId: created.sessionId,
        storedFingerprint: stored?.fingerprint || null,
        storedStatus: stored?.status || null,
        storedPaymentStatus: stored?.paymentStatus || null
      });
    }

    if (forceNewAttemptRequested) {
      // eslint-disable-next-line no-console
      console.log("[payments-resolve] user_retry new express checkout", {
        fingerprint,
        forceNewAttempt: true,
        reason: resolveRetryReason,
        previousSessionId,
        newSessionId: created.sessionId,
        experience: normalizedPayload.experience,
        amount: normalizedPayload.amount,
        currency: normalizedPayload.currency
      });
    }

    return res.json({
      reused: false,
      paymentUrl: created.paymentUrl,
      sessionId: created.sessionId,
      fingerprint,
      ...(forceNewAttemptRequested
        ? { forceNewAttempt: true, reason: resolveRetryReason, previousSessionId }
        : {})
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Unknown error";
    /** Errores de validación / negocio devueltos por Plexo (sin Response). */
    const plexoClientError =
      /^PLEXO_CHECKOUT_ERROR_\d+/.test(detail) || /^PLEXO_RESULT_\d+/.test(detail);
    const status = plexoClientError ? 400 : 502;
    return res.status(status).json({
      error: "Failed to create payment link",
      detail
    });
  }
});

app.post("/api/payments/webhook", (req, res) => {
  const plexoPayload = req.body?.Object?.Object;
  if (plexoPayload && req.body?.Signature) {
    const respondPlexoAck = () => {
      if (PAYMENT_MODE === "plexo" && plexoMaterial) {
        const ack = signPlexoPayload({
          ResultCode: 0,
          ErrorMessage: ""
        });
        return res.json(ack);
      }
      return res.json({ ok: true, received: true });
    };

    if (!hasPlexoPurchaseTransaction(plexoPayload)) {
      // eslint-disable-next-line no-console
      console.warn("[plexo-webhook] ignored: no Object.Object.Transactions.Purchase", {
        action: plexoPayload?.Action ?? null,
        paymentInstrumentStatus: plexoPayload?.PaymentInstrument?.Status ?? null
      });
      return respondPlexoAck();
    }

    const { payment, fingerprint, lookupKey, lookupSource } = correlatePaymentFromPlexoWebhook(req.body);
    const purchaseClientReferenceId = extractPlexoPurchaseClientReference(plexoPayload);
    const purchaseOutcome = resolvePlexoPaymentStatusFromPurchase(plexoPayload);
    const plexoTransactionId =
      pickFirstNonEmpty(plexoPayload?.TransactionId, plexoPayload?.SessionId, plexoPayload?.Id) ||
      undefined;

    if (!purchaseOutcome.resolved) {
      // eslint-disable-next-line no-console
      console.warn("[plexo-webhook] purchase present but outcome unresolved, skipping status update", {
        lookupKey,
        lookupSource,
        fingerprint,
        plexoTransactionId,
        purchaseStatus: purchaseOutcome.purchaseStatus,
        transactionCode: purchaseOutcome.transactionCode
      });
      return respondPlexoAck();
    }

    const currentStatus = payment?.paymentStatus || payment?.status || "awaiting_payment";
    if (!canApplyPaymentStatusTransition(currentStatus, purchaseOutcome.paymentStatus)) {
      // eslint-disable-next-line no-console
      console.warn("[plexo-webhook] skipped status downgrade (final state protected)", {
        lookupKey,
        lookupSource,
        fingerprint,
        plexoTransactionId,
        currentStatus,
        incomingStatus: purchaseOutcome.paymentStatus,
        purchaseStatus: purchaseOutcome.purchaseStatus,
        transactionCode: purchaseOutcome.transactionCode
      });
      return respondPlexoAck();
    }

    const attempt = buildAttemptMetaFromPlexoWebhook(req.body);
    const patch = {
      paymentStatus: purchaseOutcome.paymentStatus,
      plexoResultCode: purchaseOutcome.transactionCode,
      plexoTransactionId
    };
    const updateKey = fingerprint || purchaseClientReferenceId || lookupKey;
    let updated = false;
    if (updateKey) {
      updated = updatePaymentByFingerprint(updateKey, patch, attempt);
    }
    if (!updated && payment?.sessionId) {
      updated = updatePaymentBySessionId(payment.sessionId, patch, attempt);
    }
    if (!updated) {
      const activeFingerprints = listActiveFingerprints();
      // eslint-disable-next-line no-console
      console.warn("[plexo-webhook] payment not found", {
        fingerprint: fingerprint || purchaseClientReferenceId || null,
        lookupKey: updateKey,
        lookupSource,
        purchaseClientReferenceId,
        plexoCertFingerprint: plexoPayload?.Fingerprint ?? null,
        plexoTransactionId,
        purchaseStatus: purchaseOutcome.purchaseStatus,
        transactionCode: purchaseOutcome.transactionCode,
        incomingPaymentStatus: patch.paymentStatus,
        activeFingerprintCount: activeFingerprints.length,
        activeFingerprints
      });
    }

    return respondPlexoAck();
  }

  const sessionId = req.body?.sessionId || req.body?.session_id || req.body?.id;
  const status = req.body?.status || req.body?.payment_status;
  if (!sessionId || !status) {
    return res.status(400).json({ error: "sessionId and status are required." });
  }
  const updated = updateStatusBySessionId(
    String(sessionId),
    String(status),
    buildAttemptMetaFromGenericWebhook(req.body || {}, status)
  );
  return res.json({ ok: true, updated });
});

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Payments backend listening on http://localhost:${PORT}`);
  if (PAYMENT_MODE === "plexo") {
    // eslint-disable-next-line no-console
    console.log(
      `[plexo] Ready: CommerceId=${PLEXO_COMMERCE_ID} OptionalCommerceId(express)=${plexoOptionalCommerceIdForExpressCheckout()} Installments(max)=${effectivePlexoExpressMaxInstallments()} LimitIssuers=${JSON.stringify(PLEXO_LIMIT_ISSUERS)} (empty = field omitted)`
    );
  }
});


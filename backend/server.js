import crypto from "node:crypto";
import fs from "node:fs";
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import forge from "node-forge";
import { findReusableLink, upsertLink, updateStatusBySessionId } from "./store.js";

dotenv.config({ path: "backend/.env" });

const PORT = Number(process.env.PORT || 8787);
const LINK_TTL_MINUTES = Number(process.env.LINK_TTL_MINUTES || 1440);
const PAYMENT_MODE = process.env.PAYMENT_MODE || "mock";
const HANDY_CREATE_URL = process.env.HANDY_CREATE_URL || "";
const HANDY_TOKEN = process.env.HANDY_TOKEN || "";
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || "*";
const PLEXO_GATEWAY_URL = process.env.PLEXO_GATEWAY_URL || "";
const PLEXO_CLIENT_NAME = process.env.PLEXO_CLIENT_NAME || "";
const PLEXO_CERT_PASSWORD = process.env.PLEXO_CERT_PASSWORD || "";
const PLEXO_CERT_FINGERPRINT = (process.env.PLEXO_CERT_FINGERPRINT || "").toUpperCase().replace(/[^A-F0-9]/g, "");
const PLEXO_PFX_PATH = process.env.PLEXO_PFX_PATH || "";
const PLEXO_PFX_BASE64 = process.env.PLEXO_PFX_BASE64 || "";
const PLEXO_REDIRECT_URL = process.env.PLEXO_REDIRECT_URL || "https://rominagrasso.github.io/SacramentoShop/Home/index.html";
const PLEXO_COMMERCE_ID = Number(process.env.PLEXO_COMMERCE_ID || 0);
/** Comma-separated issuer ids (manual ejemplo: 4,11,15,30,32). Vacío = no enviar. */
const PLEXO_LIMIT_ISSUERS = String(process.env.PLEXO_LIMIT_ISSUERS || "4,11,15")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
const PLEXO_CHECKOUT_EMAIL = process.env.PLEXO_CHECKOUT_EMAIL || "";
const PLEXO_CHECKOUT_NAME = process.env.PLEXO_CHECKOUT_NAME || "Sacramento Guest";
const PLEXO_CHECKOUT_DOC = process.env.PLEXO_CHECKOUT_DOC || "12345678";
const PAYMENT_DEBUG_LOG =
  process.env.PAYMENT_DEBUG_LOG === "1" || /^true$/i.test(String(process.env.PAYMENT_DEBUG_LOG || ""));

const app = express();
app.use(cors({ origin: ALLOWED_ORIGIN === "*" ? true : ALLOWED_ORIGIN }));
app.use(express.json({ limit: "1mb" }));

// Render logs only show stdout; the app had no request logging before, so POSTs looked "invisible".
app.use((req, res, next) => {
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

function readPfxBytes() {
  if (PLEXO_PFX_BASE64) return Buffer.from(PLEXO_PFX_BASE64, "base64");
  if (PLEXO_PFX_PATH) return fs.readFileSync(PLEXO_PFX_PATH);
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
    RedirectUri: PLEXO_REDIRECT_URL,
    DoNotUseCallback: false,
    ClientInformation: {
      Name: PLEXO_CHECKOUT_NAME,
      Address: "Montevideo",
      Email: contactEmail,
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

  if (PLEXO_LIMIT_ISSUERS.length > 0) {
    authorizationData.LimitIssuers = PLEXO_LIMIT_ISSUERS;
  }

  if (Number.isFinite(PLEXO_COMMERCE_ID) && PLEXO_COMMERCE_ID > 0) {
    authorizationData.OptionalCommerceId = PLEXO_COMMERCE_ID;
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
    Installments: 1,
    Items: [
      {
        Amount: amount,
        ClientItemReferenceId: "Item-1",
        Description: String(payload.experience || "Booking"),
        Name: String(payload.experience || "Booking"),
        Quantity: 1
      }
    ],
    PaymentInstrumentInput: {
      UseExtendedClientCreditIfAvailable: false
    }
  };

  if (Number.isFinite(PLEXO_COMMERCE_ID) && PLEXO_COMMERCE_ID > 0) {
    paymentData.OptionalCommerceId = PLEXO_COMMERCE_ID;
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
  if (PAYMENT_DEBUG_LOG) {
    const reqInner = requestBody?.Object?.Object?.Request;
    // eslint-disable-next-line no-console
    console.log(
      "[plexo-req] OptionalCommerceId",
      JSON.stringify({
        envPlexoCommerceId: PLEXO_COMMERCE_ID,
        sentInAuth: reqInner?.AuthorizationData?.OptionalCommerceId ?? null,
        sentInPayment: reqInner?.PaymentData?.OptionalCommerceId ?? null
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

app.get("/api/payments/health", (_req, res) => {
  res.json({
    ok: true,
    mode: PAYMENT_MODE,
    ttlMinutes: LINK_TTL_MINUTES,
    plexoReady: PAYMENT_MODE !== "plexo" ? undefined : Boolean(plexoMaterial),
    /** Valor efectivo en runtime (0 = no se envía OptionalCommerceId al gateway). */
    plexoCommerceIdEnv: PAYMENT_MODE === "plexo" ? PLEXO_COMMERCE_ID : undefined,
    plexoClientConfigured: PAYMENT_MODE === "plexo" ? Boolean(PLEXO_CLIENT_NAME) : undefined
  });
});

app.post("/api/payments/resolve", async (req, res) => {
  const { experience, amount, currency = "USD", people, orderPayload } = req.body || {};
  if (!experience || !Number.isFinite(Number(amount)) || Number(amount) <= 0) {
    return res.status(400).json({ error: "Invalid payload: experience/amount required." });
  }

  const normalizedPayload = {
    experience: String(experience),
    amount: Number(amount),
    currency: String(currency),
    people: Number.isFinite(Number(people)) ? Number(people) : null,
    orderPayload: orderPayload || null,
    paymentMode: PAYMENT_MODE
  };

  const nowIso = new Date().toISOString();
  const fingerprint = hashPayload(normalizedPayload);
  const reusable = findReusableLink(fingerprint, nowIso);

  const reusableIsMock =
    reusable &&
    (String(reusable.sessionId || "").startsWith("mock_") || String(reusable.paymentUrl || "").includes("sessionId=mock_"));
  if (reusable && !(PAYMENT_MODE !== "mock" && reusableIsMock)) {
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
      createdAt: nowIso,
      updatedAt: nowIso,
      expiresAt
    });

    return res.json({
      reused: false,
      paymentUrl: created.paymentUrl,
      sessionId: created.sessionId,
      fingerprint
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
    const txId =
      plexoPayload?.TransactionId ||
      plexoPayload?.SessionId ||
      plexoPayload?.Id ||
      req.body?.Object?.Object?.Response?.Id;
    const status = plexoStateLabel(plexoPayload?.CurrentState || plexoPayload?.Status || 1);
    if (txId) {
      updateStatusBySessionId(String(txId), status);
    }
    if (PAYMENT_MODE === "plexo" && plexoMaterial) {
      const ack = signPlexoPayload({
        ResultCode: 0,
        ErrorMessage: ""
      });
      return res.json(ack);
    }
    return res.json({ ok: true, received: true });
  }

  const sessionId = req.body?.sessionId || req.body?.session_id || req.body?.id;
  const status = req.body?.status || req.body?.payment_status;
  if (!sessionId || !status) {
    return res.status(400).json({ error: "sessionId and status are required." });
  }
  const updated = updateStatusBySessionId(String(sessionId), String(status));
  return res.json({ ok: true, updated });
});

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Payments backend listening on http://localhost:${PORT}`);
});


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

const app = express();
app.use(cors({ origin: ALLOWED_ORIGIN === "*" ? true : ALLOWED_ORIGIN }));
app.use(express.json({ limit: "1mb" }));

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

function normalizePlexoValue(value) {
  if (value === null || value === undefined) return undefined;
  if (Array.isArray(value)) {
    const items = value.map((item) => {
      const normalized = normalizePlexoValue(item);
      return normalized === undefined ? null : normalized;
    });
    return `[${items.map((item) => (item === null ? "null" : item)).join(",")}]`;
  }
  if (typeof value === "object") {
    const keys = Object.keys(value).sort();
    const parts = [];
    keys.forEach((k) => {
      const normalized = normalizePlexoValue(value[k]);
      if (normalized !== undefined) {
        parts.push(`${JSON.stringify(k)}:${normalized}`);
      }
    });
    return `{${parts.join(",")}}`;
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

function buildPlexoAuthRequest(payload) {
  const amount = Number(payload.amount);
  if (!Number.isFinite(amount) || amount <= 0) throw new Error("INVALID_AMOUNT");
  const traceId = String(payload.fingerprint || `${Date.now()}`);
  const request = {
    Action: 64, // ExpressCheckout through Auth + Uri flow.
    Type: 0,
    MetaReference: traceId,
    RedirectUri: PLEXO_REDIRECT_URL,
    DoNotUseCallback: false,
    OptionalMetadata: JSON.stringify({
      experience: payload.experience || "booking",
      amount: Number(payload.amount),
      currency: payload.currency || "USD",
      people: payload.people || null
    })
  };

  if (Number.isFinite(PLEXO_COMMERCE_ID) && PLEXO_COMMERCE_ID > 0) {
    request.OptionalCommerceId = PLEXO_COMMERCE_ID;
  }

  return {
    Client: PLEXO_CLIENT_NAME,
    Request: request
  };
}

function pickPlexoResponse(rawData) {
  const responseNode =
    rawData?.Object?.Object?.Response ||
    rawData?.Object?.Response ||
    rawData?.Response ||
    rawData;
  const resultCode =
    rawData?.Object?.Object?.ResultCode ??
    rawData?.Object?.ResultCode ??
    rawData?.ResultCode ??
    0;
  if (Number(resultCode) !== 0) {
    throw new Error(`PLEXO_RESULT_${resultCode}`);
  }
  const paymentUrl =
    responseNode?.Uri || responseNode?.URL || responseNode?.url || responseNode?.checkoutUrl || "";
  const sessionId = responseNode?.Id || responseNode?.SessionId || responseNode?.id || `plexo_${Date.now()}`;
  if (!paymentUrl) {
    throw new Error("PLEXO_RESPONSE_MISSING_URI");
  }
  return { paymentUrl, sessionId };
}

async function createPlexoPaymentLink(payload) {
  if (!PLEXO_GATEWAY_URL) {
    throw new Error("PLEXO_GATEWAY_URL_MISSING");
  }
  const base = PLEXO_GATEWAY_URL.replace(/\/+$/, "");
  const endpoint = `${base}/Auth`;
  const requestBody = signPlexoPayload(buildPlexoAuthRequest(payload));
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(requestBody)
  });
  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`PLEXO_AUTH_FAILED ${response.status} ${errorBody}`);
  }
  const data = await response.json();
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
    return buildMockPaymentLink(payload);
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
    plexoReady: PAYMENT_MODE !== "plexo" ? undefined : Boolean(plexoMaterial)
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
  if (reusable && !(PAYMENT_MODE === "plexo" && reusableIsMock)) {
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
    return res.status(502).json({
      error: "Failed to create payment link",
      detail: error instanceof Error ? error.message : "Unknown error"
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


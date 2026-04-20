import crypto from "node:crypto";
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { findReusableLink, upsertLink, updateStatusBySessionId } from "./store.js";

dotenv.config({ path: "backend/.env" });

const PORT = Number(process.env.PORT || 8787);
const LINK_TTL_MINUTES = Number(process.env.LINK_TTL_MINUTES || 1440);
const PAYMENT_MODE = process.env.PAYMENT_MODE || "mock";
const HANDY_CREATE_URL = process.env.HANDY_CREATE_URL || "";
const HANDY_TOKEN = process.env.HANDY_TOKEN || "";
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || "*";

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

async function createHandyPaymentLink(payload) {
  if (PAYMENT_MODE === "mock" || !HANDY_CREATE_URL || !HANDY_TOKEN) {
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
  res.json({ ok: true, mode: PAYMENT_MODE, ttlMinutes: LINK_TTL_MINUTES });
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
    orderPayload: orderPayload || null
  };

  const nowIso = new Date().toISOString();
  const fingerprint = hashPayload(normalizedPayload);
  const reusable = findReusableLink(fingerprint, nowIso);

  if (reusable) {
    return res.json({
      reused: true,
      paymentUrl: reusable.paymentUrl,
      sessionId: reusable.sessionId,
      fingerprint
    });
  }

  try {
    const created = await createHandyPaymentLink({
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


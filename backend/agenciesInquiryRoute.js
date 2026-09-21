import {
  sendAgenciesInquiryNotification,
  sendAgenciesInquiryConfirmationToApplicant
} from "./sendAgenciesInquiryNotification.js";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const COMPANY_TYPES = new Set(["travel_agency", "tour_operator", "dmc", "other"]);
const INTEREST_VALUES = new Set([
  "tours",
  "transfers",
  "wineries",
  "gastro",
  "horseback",
  "boat",
  "experiences",
  "itineraries"
]);
const PASSENGER_VALUES = new Set(["individual", "couples_families", "groups", "corporate"]);

const LIMITS = {
  name: 120,
  company: 160,
  country: 80,
  city: 80,
  email: 254,
  phone: 40,
  website: 500,
  message: 4000
};

const RATE_WINDOW_MS = 15 * 60 * 1000;
const RATE_MAX = 8;
const rateByIp = new Map();

function clientIp(req) {
  const xf = req.headers["x-forwarded-for"];
  if (typeof xf === "string" && xf.trim()) {
    return xf.split(",")[0].trim();
  }
  return req.socket?.remoteAddress || "unknown";
}

function checkRateLimit(ip) {
  const now = Date.now();
  let entry = rateByIp.get(ip);
  if (!entry || now > entry.resetAt) {
    entry = { count: 0, resetAt: now + RATE_WINDOW_MS };
    rateByIp.set(ip, entry);
  }
  entry.count += 1;
  if (entry.count > RATE_MAX) {
    return false;
  }
  return true;
}

function trimStr(value, max) {
  if (value == null) return "";
  return String(value).trim().slice(0, max);
}

function normalizeStringArray(raw, allowed, maxItems = 12) {
  if (!Array.isArray(raw)) return [];
  const out = [];
  for (const item of raw) {
    const v = String(item || "").trim();
    if (!v || !allowed.has(v)) continue;
    if (!out.includes(v)) out.push(v);
    if (out.length >= maxItems) break;
  }
  return out;
}

export function validateAgenciesInquiryBody(body) {
  const errors = [];
  if (!body || typeof body !== "object") {
    return { ok: false, errors: ["invalid_body"] };
  }

  const name = trimStr(body.name, LIMITS.name);
  const company = trimStr(body.company, LIMITS.company);
  const country = trimStr(body.country, LIMITS.country);
  const city = trimStr(body.city, LIMITS.city);
  const email = trimStr(body.email, LIMITS.email);
  const phone = trimStr(body.phone, LIMITS.phone);
  const website = trimStr(body.website, LIMITS.website);
  const companyType = trimStr(body.companyType, 32);
  const message = trimStr(body.message, LIMITS.message);
  const language = trimStr(body.language, 8).toLowerCase() || "en";
  const privacyAccepted = body.privacyAccepted === true;
  const interests = normalizeStringArray(body.interests, INTEREST_VALUES);
  const passengerTypes = normalizeStringArray(body.passengerTypes, PASSENGER_VALUES);

  if (!name) errors.push("name");
  if (!company) errors.push("company");
  if (!country) errors.push("country");
  if (!email || !EMAIL_RE.test(email)) errors.push("email");
  if (!companyType || !COMPANY_TYPES.has(companyType)) errors.push("companyType");
  if (!privacyAccepted) errors.push("privacyAccepted");

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    data: {
      name,
      company,
      country,
      city,
      email,
      phone,
      website,
      companyType,
      interests,
      passengerTypes,
      message,
      language: ["en", "es", "pt"].includes(language) ? language : "en",
      privacyAccepted: true,
      source: "agencies.html"
    }
  };
}

export function createAgenciesInquiryHandler() {
  return async function agenciesInquiryHandler(req, res) {
    const hp = trimStr(req.body?.hp_field, 200);
    if (hp) {
      // eslint-disable-next-line no-console
      console.log("[agencies-inquiry] honeypot triggered, skipping send");
      return res.status(200).json({ ok: true, accepted: true });
    }

    const ip = clientIp(req);
    if (!checkRateLimit(ip)) {
      return res.status(429).json({ error: "Too many requests. Please try again later." });
    }

    const validated = validateAgenciesInquiryBody(req.body);
    if (!validated.ok) {
      return res.status(400).json({
        error: "Validation failed",
        fields: validated.errors
      });
    }

    // eslint-disable-next-line no-console
    console.log("[agencies-inquiry] sending notification", {
      company: validated.data.company,
      language: validated.data.language
    });

    const emailResult = await sendAgenciesInquiryNotification(validated.data);
    if (!emailResult.sent) {
      const status = emailResult.omitted ? 503 : 502;
      // eslint-disable-next-line no-console
      console.warn("[agencies-inquiry] notification failed", {
        omitted: Boolean(emailResult.omitted),
        error: emailResult.error || "unknown"
      });
      return res.status(status).json({
        error: emailResult.omitted ? "Email service not configured" : "Failed to send inquiry email"
      });
    }

    // eslint-disable-next-line no-console
    console.log("[agencies-inquiry] notification sent", {
      company: validated.data.company,
      resendId: emailResult.resendId || null
    });

    await sendAgenciesInquiryConfirmationToApplicant(validated.data);

    return res.status(200).json({ ok: true });
  };
}

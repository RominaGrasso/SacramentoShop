function getSiteLanguage() {
  if (typeof window !== "undefined") {
    const active = window.__SACRAMENTO_ACTIVE_LANG__;
    if (active === "en" || active === "es" || active === "pt") return active;

    try {
      const stored = localStorage.getItem("selectedLanguage");
      if (stored === "en" || stored === "es" || stored === "pt") return stored;
    } catch (_) {
      /* ignore */
    }

    if (typeof document !== "undefined") {
      const activeBtn = document.querySelector(".lang-btn.active");
      const btnLang = activeBtn?.dataset?.lang;
      if (btnLang === "en" || btnLang === "es" || btnLang === "pt") return btnLang;

      const docLang = document.documentElement.lang;
      if (docLang === "en" || docLang === "es" || docLang === "pt") return docLang;
    }

    if (typeof window.getInitialLanguage === "function") {
      return window.getInitialLanguage();
    }
  }
  return "en";
}

function sacramentoResolvePaymentsApiBase() {
  if (typeof window !== "undefined" && window.SacramentoPaymentsApi?.resolvePaymentsApiBase) {
    return window.SacramentoPaymentsApi.resolvePaymentsApiBase();
  }
  if (typeof window !== "undefined" && window.SACRAMENTO_PAYMENTS_API_BASE) {
    return String(window.SACRAMENTO_PAYMENTS_API_BASE).replace(/\/+$/, "");
  }
  const host = typeof window !== "undefined" ? window.location?.hostname || "" : "";
  if (host === "localhost" || host === "127.0.0.1") return "http://localhost:8787";
  return "https://sacramento-payments-test.onrender.com";
}

function sacramentoIsLocalDevHost() {
  if (typeof window !== "undefined" && window.SacramentoPaymentsApi?.isLocalDevHost) {
    return window.SacramentoPaymentsApi.isLocalDevHost();
  }
  const host = typeof window !== "undefined" ? window.location?.hostname || "" : "";
  return host === "localhost" || host === "127.0.0.1";
}

function sacramentoBuildResolveEndpointCandidates(endpointRaw) {
  if (typeof window !== "undefined" && window.SacramentoPaymentsApi?.buildResolveEndpointCandidates) {
    return window.SacramentoPaymentsApi.buildResolveEndpointCandidates(endpointRaw);
  }
  const endpoint = String(endpointRaw || "/api/payments/resolve").trim();
  const isAbsolute = /^https?:\/\//i.test(endpoint);
  const candidates = [];
  const local = sacramentoIsLocalDevHost();
  const productionBase = "https://sacramento-payments-test.onrender.com";
  const localBase = "http://localhost:8787";

  if (isAbsolute) {
    candidates.push(endpoint);
  } else if (endpoint.startsWith("/")) {
    if (local) {
      candidates.push(`${localBase}${endpoint}`, `${productionBase}${endpoint}`);
    }
    if (typeof window !== "undefined" && window.location?.origin && window.location.protocol !== "file:") {
      candidates.push(endpoint);
    }
    if (!local) candidates.push(`${productionBase}${endpoint}`);
  } else {
    const path = `/${endpoint.replace(/^\.?\//, "")}`;
    if (local) candidates.push(`${localBase}${path}`, `${productionBase}${path}`);
    candidates.push(endpoint);
    if (!local) candidates.push(`${productionBase}${path}`);
  }
  if (typeof window !== "undefined" && window.location?.protocol === "file:") {
    const path = endpoint.startsWith("/") ? endpoint : `/${endpoint.replace(/^\/+/, "")}`;
    candidates.unshift(`${localBase}${path}`, `http://127.0.0.1:8787${path}`);
  }
  return [...new Set(candidates.filter(Boolean))];
}

const DEFAULT_DYNAMIC_PAYMENT_ENDPOINT =
  typeof window !== "undefined" && window.location?.protocol === "file:"
    ? "http://localhost:8787/api/payments/resolve"
    : "/api/payments/resolve";

/** `*Label*: value` line for WhatsApp (bold before the colon). */
function waLine(label, value) {
  const lbl = String(label == null ? "" : label).replace(/\*/g, "");
  const val = String(value == null ? "" : value);
  return `*${lbl}*: ${val}`;
}

/** Smooth scroll to the order summary block after saving a popup selection. */
function scrollToOrderSummary(orderSummaryId, options) {
  const id = String(orderSummaryId || "orderSummary").trim();
  const offset = options && typeof options.offset === "number" ? options.offset : 72;
  const run = () => {
    const target =
      (id && document.getElementById(id)) || document.querySelector(".order-summary");
    if (!target) return;
    const prevMargin = target.style.scrollMarginTop;
    target.style.scrollMarginTop = `${offset}px`;
    const restoreMargin = () => {
      target.style.scrollMarginTop = prevMargin;
    };
    try {
      target.scrollIntoView({ behavior: "smooth", block: "start" });
      setTimeout(restoreMargin, 600);
    } catch {
      restoreMargin();
      const top = window.scrollY + target.getBoundingClientRect().top - offset;
      window.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
    }
  };
  if (typeof window.requestAnimationFrame === "function") {
    requestAnimationFrame(() => requestAnimationFrame(run));
  } else {
    setTimeout(run, 50);
  }
}

if (typeof window !== "undefined") {
  window.scrollToOrderSummary = scrollToOrderSummary;
}

function paymentApiOriginFromResolveUrl(endpoint) {
  const e = String(endpoint || "");
  if (/^https?:\/\//i.test(e)) {
    try {
      return new URL(e).origin;
    } catch {
      return "";
    }
  }
  if (typeof window !== "undefined" && window.location?.origin) {
    return window.location.origin;
  }
  return "";
}

async function fetchPlexoCybersourceHints(origins) {
  let orgId = "";
  let prefix = "";
  for (const origin of origins) {
    try {
      const r = await fetch(`${origin}/api/payments/plexo-client-hints`);
      if (!r.ok) continue;
      const h = await r.json();
      if (h.paymentMode !== "plexo") continue;
      if (h.cybersourceOrgId) orgId = String(h.cybersourceOrgId);
      if (h.cybersourceSessionPrefix) prefix = String(h.cybersourceSessionPrefix);
      if (orgId && prefix) break;
    } catch {
      /* next origin */
    }
  }
  return { orgId, prefix };
}

/** Mismo session_id en script CyberSource y en PaymentData.CybersourceDeviceFingerprint (manual Plexo / Totalnet). */
async function sacramentoCollectCybersourceSessionId(orgId, prefix) {
  const inv =
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID().replace(/-/g, "")
      : `${Date.now()}_${Math.random().toString(36).slice(2, 14)}`;
  const sessionId = `${prefix}${inv}`.slice(0, 128);
  await new Promise((resolve) => {
    const s = document.createElement("script");
    s.async = true;
    s.src = `https://h.online-metrix.net/fp/tags.js?org_id=${encodeURIComponent(orgId)}&session_id=${encodeURIComponent(sessionId)}`;
    const done = () => resolve();
    s.onload = done;
    s.onerror = done;
    document.head.appendChild(s);
  });
  await new Promise((r) => setTimeout(r, 1200));
  return sessionId;
}

/** i18n table from index.js or `window.__SACRAMENTO_TRANSLATIONS` if script scope differs. */
function sacramentoI18nTable() {
  if (typeof translations !== "undefined" && translations) return translations;
  if (typeof window !== "undefined" && window.__SACRAMENTO_TRANSLATIONS) return window.__SACRAMENTO_TRANSLATIONS;
  return {};
}

function sacramentoGetI18nText(key, fallback) {
  const lang = getSiteLanguage();
  const tr = sacramentoI18nTable();
  return tr?.[lang]?.[key] ?? tr?.en?.[key] ?? fallback ?? key;
}

function sacramentoInitWhatsAppFloatLinks(root) {
  const scope = root && root.querySelectorAll ? root : document;
  if (!scope.querySelectorAll) return;
  const text = sacramentoGetI18nText(
    "wa_float_text",
    "Hello! I'm interested in your experiences in Colonia."
  );
  const href = sacramentoBuildWhatsAppUrl(SACRAMENTO_DEFAULT_WHATSAPP_NUMBER, text);
  if (!href) return;
  scope.querySelectorAll("a.whatsapp-float").forEach((anchor) => {
    anchor.setAttribute("href", href);
    if (anchor.getAttribute("target") === "_blank") anchor.removeAttribute("target");
  });
}

function stableStringify(value) {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }
  const keys = Object.keys(value).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`).join(",")}}`;
}

const SACRAMENTO_DEFAULT_WHATSAPP_NUMBER = "59898945542";
/** e-TAXI flotante (sin +, código país incluido). */
const SACRAMENTO_TAXI_WHATSAPP_NUMBER = "59895262626";
const SACRAMENTO_TAXI_WHATSAPP_DEFAULT_TEXT =
  "Hola, quiero pedir un taxi en Colonia. Prioridad: Cliente Sacramento Adventures";

function sacramentoNormalizeWhatsAppPhone(phone) {
  return String(phone || SACRAMENTO_DEFAULT_WHATSAPP_NUMBER).replace(/\D/g, "");
}

function sacramentoBuildWhatsAppUrl(phone, text) {
  const digits = sacramentoNormalizeWhatsAppPhone(phone);
  if (!digits) return "";
  const base = `https://wa.me/${digits}`;
  if (text == null || String(text) === "") return base;
  return `${base}?text=${encodeURIComponent(String(text))}`;
}

function sacramentoIsOfficialWhatsAppUrl(url) {
  try {
    const u = new URL(String(url || ""));
    const host = u.hostname.replace(/^www\./i, "").toLowerCase();
    if (host === "wa.me") return true;
    if (host === "api.whatsapp.com" && u.pathname.replace(/\/+$/, "") === "/send") return true;
    return false;
  } catch {
    return false;
  }
}

function sacramentoIsMobileWhatsAppClient() {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  if (/Android|webOS|iPhone|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua)) return true;
  // iPadOS 13+ often reports "Macintosh" — must not use blank-tab + wa.me interstitial.
  if (/Macintosh|Mac OS X/i.test(ua) && Number(navigator.maxTouchPoints) > 1) return true;
  return false;
}

const SACRAMENTO_RESERVE_LOADING_SECONDARY_MS = 5000;
const RESOLVE_FETCH_TIMEOUT_MS = 4000;
const RESOLVE_MAX_ATTEMPTS = 2;
const RESOLVE_RETRY_DELAY_MS = 400;
const RESOLVE_FLOW_TIMEOUT_MS = 12000;

let sacramentoReserveLoadingPaymentLinkMode = false;
let sacramentoPaymentRetryInProgress = false;

function isRetryableResolveHttpStatus(status) {
  return status === 502 || status === 503 || status === 504;
}

function resolveFetchAbortSignal(timeoutMs) {
  if (typeof AbortSignal !== "undefined" && typeof AbortSignal.timeout === "function") {
    return AbortSignal.timeout(timeoutMs);
  }
  const controller = new AbortController();
  window.setTimeout(() => controller.abort(), timeoutMs);
  return controller.signal;
}

function delayMs(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function resolveFlowTimedOutError() {
  const err = new Error("resolve_flow_timeout");
  err.name = "ResolveFlowTimeoutError";
  return err;
}

async function withResolveFlowTimeout(asyncFn, timeoutMs = RESOLVE_FLOW_TIMEOUT_MS) {
  let timerId = null;
  const timeoutPromise = new Promise((_, reject) => {
    timerId = window.setTimeout(() => reject(resolveFlowTimedOutError()), timeoutMs);
  });
  try {
    return await Promise.race([asyncFn(), timeoutPromise]);
  } finally {
    if (timerId != null) window.clearTimeout(timerId);
  }
}

function sacramentoResolveFailureReason(err) {
  if (err && err.name === "ResolveFlowTimeoutError") return "global_timeout";
  return "unexpected_error";
}

function sacramentoOfferPaymentRetryAfterFailure({
  dynamicPayment,
  bodyPayload,
  pendingTab,
  uniqueCandidates,
  whatsappMessage,
  whatsappPhone,
  reason = "exhausted"
}) {
  // eslint-disable-next-line no-console
  console.error("[payments-resolve] offering retry", { reason });
  sacramentoStorePaymentRetryContext({
    dynamicPayment,
    bodyPayload: bodyPayload && typeof bodyPayload === "object" ? bodyPayload : {},
    pendingTab,
    uniqueCandidates,
    whatsappPhone: whatsappPhone || SACRAMENTO_DEFAULT_WHATSAPP_NUMBER,
    whatsappMessage: String(whatsappMessage || ""),
    lastPaymentUrl: ""
  });
  if (pendingTab && !pendingTab.closed) {
    sacramentoPaintPendingTabPaymentRetryOffer(pendingTab);
  } else {
    sacramentoShowOverlayPaymentRetryOffer();
  }
}

function sacramentoSetOverlayRetryButtonsBusy(busy) {
  const overlay = sacramentoReserveLoadingOverlayEl || document.getElementById("sacramentoReserveLoading");
  if (!overlay) return;
  const retryBtn = overlay.querySelector("#sacPaymentOverlayRetryBtn");
  if (retryBtn) {
    retryBtn.disabled = Boolean(busy);
    retryBtn.setAttribute("aria-busy", busy ? "true" : "false");
  }
}

function sacramentoSetReserveLoadingPaymentLinkMode(on) {
  sacramentoReserveLoadingPaymentLinkMode = Boolean(on);
  if (sacramentoReserveLoadingDepth > 0) {
    sacramentoRefreshReserveLoadingCopy();
    const overlay = sacramentoReserveLoadingOverlayEl;
    const secondary = overlay?.querySelector(".sacramento-reserve-loading__secondary");
    if (secondary && sacramentoReserveLoadingPaymentLinkMode) secondary.hidden = false;
  }
}

function sacramentoPendingTabResolveFailed(tab) {
  if (!tab || tab.closed) return false;
  try {
    return (
      tab.document?.body?.dataset?.sacPaymentResolveError === "1" ||
      tab.document?.body?.dataset?.sacPaymentRetryOffer === "1"
    );
  } catch {
    return false;
  }
}

function sacramentoPendingTabHasRetryOffer(tab) {
  if (!tab || tab.closed) return false;
  try {
    return tab.document?.body?.dataset?.sacPaymentRetryOffer === "1";
  } catch {
    return false;
  }
}

function sacramentoStorePaymentRetryContext(ctx) {
  if (typeof window === "undefined") return;
  window.__SACRAMENTO_PAYMENT_RETRY_CTX = ctx;
}

function sacramentoGetPaymentRetryContext() {
  if (typeof window === "undefined") return null;
  return window.__SACRAMENTO_PAYMENT_RETRY_CTX || null;
}

function sacramentoBuildWhatsappMessageWithPaymentLink(baseMessage, paymentUrl) {
  const base = String(baseMessage || "").trim();
  const url = String(paymentUrl || "").trim();
  if (!url) return base;
  if (base.includes(url)) return base;
  const prompt = sacramentoReserveLoadingText(
    "wa_payment_prompt",
    "To confirm the reservation, please complete the payment here:"
  );
  return base ? `${base}\n\n${prompt}\n${url}` : `${prompt}\n${url}`;
}

function sacramentoEscapeHtml(text) {
  return String(text || "").replace(/</g, "&lt;");
}

function sacramentoBuildReservePendingTabAssets() {
  const fontsHref =
    "https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700&family=Playfair+Display:wght@600;700&display=swap";
  if (typeof window === "undefined") {
    return {
      stylesHref: "/Styles/styles.css",
      logoSrc: "/Assets/images/sacramento-logo-new.svg",
      fontsHref
    };
  }
  let stylesHref = "/Styles/styles.css";
  let logoSrc = "/Assets/images/sacramento-logo-new.svg";
  try {
    stylesHref = new URL("../Styles/styles.css", window.location.href).href;
  } catch {
    /* keep fallback */
  }
  try {
    logoSrc = new URL("../Assets/images/sacramento-logo-new.svg", window.location.href).href;
  } catch {
    /* keep fallback */
  }
  return { stylesHref, logoSrc, fontsHref };
}

function sacramentoBuildReservePendingTabShell(title, bodyAttrs, cardInnerHtml, cardClass) {
  const { stylesHref, logoSrc, fontsHref } = sacramentoBuildReservePendingTabAssets();
  const safeTitle = sacramentoEscapeHtml(title);
  const cardCls = cardClass || "payment-result__card payment-result__card--neutral";
  const bodyAttrStr = bodyAttrs ? ` ${bodyAttrs}` : "";
  return (
    '<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">' +
    `<title>${safeTitle}</title>` +
    `<link rel="stylesheet" href="${sacramentoEscapeHtml(stylesHref)}">` +
    `<link rel="stylesheet" href="${sacramentoEscapeHtml(fontsHref)}">` +
    `</head><body class="page-payment-result page-sac-reserve-pending"${bodyAttrStr}>` +
    '<header class="payment-result-header">' +
    '<span class="payment-result-header__logo">' +
    `<img alt="Sacramento Adventures" decoding="async" src="${sacramentoEscapeHtml(logoSrc)}">` +
    "</span></header>" +
    `<main class="payment-result"><div class="${cardCls}">` +
    cardInnerHtml +
    "</div></main></body></html>"
  );
}

function sacramentoBuildReserveOverlayLogoHtml() {
  const { logoSrc } = sacramentoBuildReservePendingTabAssets();
  return (
    '<header class="payment-result-header">' +
    '<span class="payment-result-header__logo">' +
    `<img alt="Sacramento Adventures" decoding="async" src="${sacramentoEscapeHtml(logoSrc)}">` +
    "</span></header>"
  );
}

function sacramentoBuildReserveLoadingCardHtml(title, subtitle) {
  const safeTitle = sacramentoEscapeHtml(title);
  const safeSubtitle = sacramentoEscapeHtml(subtitle);
  return (
    '<div class="payment-result__spinner" aria-hidden="true"></div>' +
    `<h1 class="payment-result__title">${safeTitle}</h1>` +
    `<p class="payment-result__lead">${safeSubtitle}</p>`
  );
}

function sacramentoWritePendingTabDocument(pendingTab, title, bodyAttrs, cardInnerHtml) {
  if (!pendingTab || pendingTab.closed) return;
  try {
    pendingTab.document.open();
    pendingTab.document.write(sacramentoBuildReservePendingTabShell(title, bodyAttrs, cardInnerHtml));
    pendingTab.document.close();
  } catch {
    /* popup blocked or cross-origin */
  }
}

function sacramentoPaintPendingTabLoading(pendingTab) {
  const title = sacramentoReserveLoadingText("reserve_loading_primary", "Preparing your booking…");
  const subtitle = sacramentoReserveLoadingText("reserve_loading_secondary", "Opening WhatsApp…");
  sacramentoWritePendingTabDocument(
    pendingTab,
    title,
    "",
    sacramentoBuildReserveLoadingCardHtml(title, subtitle)
  );
}

function sacramentoPaintPendingTabPaymentPreparing(pendingTab) {
  const title = sacramentoReserveLoadingText(
    "reserve_payment_link_preparing",
    "We are preparing your secure payment link."
  );
  const subtitle = sacramentoReserveLoadingText(
    "reserve_payment_link_preparing_subtitle",
    "This may take a few seconds."
  );
  sacramentoWritePendingTabDocument(
    pendingTab,
    title,
    'data-sac-payment-resolve-error="0"',
    sacramentoBuildReserveLoadingCardHtml(title, subtitle)
  );
}

function sacramentoGetPaymentRetryOfferCopy() {
  return {
    title: sacramentoReserveLoadingText(
      "reserve_payment_link_delayed",
      "We are experiencing a delay generating your secure payment link."
    ),
    body: sacramentoReserveLoadingText(
      "reserve_payment_link_delayed_body",
      "This is usually resolved in a few seconds."
    ),
    retryLabel: sacramentoReserveLoadingText("reserve_payment_retry_btn", "Retry"),
    waLabel: sacramentoReserveLoadingText("reserve_payment_whatsapp_btn", "Contact us on WhatsApp")
  };
}

function sacramentoPaintPendingTabPaymentRetryOffer(pendingTab) {
  if (!pendingTab || pendingTab.closed) return;
  const { title, body, retryLabel, waLabel } = sacramentoGetPaymentRetryOfferCopy();
  const safeTitle = sacramentoEscapeHtml(title);
  const safeBody = sacramentoEscapeHtml(body);
  const safeRetry = sacramentoEscapeHtml(retryLabel);
  const safeWa = sacramentoEscapeHtml(waLabel);
  const cardInner =
    '<div class="payment-result__icon payment-result__icon--neutral" aria-hidden="true">!</div>' +
    `<h1 class="payment-result__title">${safeTitle}</h1>` +
    `<p class="payment-result__body">${safeBody}</p>` +
    '<div class="payment-result__actions">' +
    `<button type="button" class="payment-result__btn" id="sacPaymentRetryBtn">${safeRetry}</button>` +
    `<button type="button" class="payment-result__btn secondary" id="sacPaymentWaBtn">${safeWa}</button>` +
    "</div>";
  try {
    pendingTab.document.open();
    pendingTab.document.write(
      sacramentoBuildReservePendingTabShell(
        title,
        'data-sac-payment-resolve-error="1" data-sac-payment-retry-offer="1"',
        cardInner
      )
    );
    pendingTab.document.close();
    const retryBtn = pendingTab.document.getElementById("sacPaymentRetryBtn");
    const waBtn = pendingTab.document.getElementById("sacPaymentWaBtn");
    if (retryBtn) {
      retryBtn.addEventListener("click", () => {
        if (retryBtn.disabled) return;
        retryBtn.disabled = true;
        retryBtn.setAttribute("aria-busy", "true");
        try {
          if (window.opener && typeof window.opener.sacramentoRetryPaymentLinkFromPendingTab === "function") {
            void window.opener.sacramentoRetryPaymentLinkFromPendingTab();
          }
        } catch {
          /* ignore */
        }
      });
    }
    if (waBtn) {
      waBtn.addEventListener("click", () => {
        try {
          if (window.opener && typeof window.opener.sacramentoOpenReserveWhatsAppFromPendingTab === "function") {
            window.opener.sacramentoOpenReserveWhatsAppFromPendingTab();
          }
        } catch {
          /* ignore */
        }
      });
    }
  } catch {
    /* popup blocked or cross-origin */
  }
}

const SACRAMENTO_RESERVE_TRIGGER_SELECTOR = [
  "#bookWithOrder",
  "#bookNowBottom",
  "#bookNowBottomWalkingAsado",
  "#bookNowBottomHistoricLiebres",
  "#bookNowBottomJosefina",
  "#bookNowBottomLiebresDining",
  "#bookNowBottomRomantic",
  "#bookRomanticWithOrder",
  "#mateBookBtn",
  "#mateExperienceSummary a.total-btn",
  "#cabalFooterReserve",
  "#cabalBookingSummary a.total-btn",
  "#rentBookNowBtn",
  "#barbotReserveBtn",
  '[data-action="book-now"]',
  ".total-btn#bookWithOrder"
].join(",");

let sacramentoReserveLoadingDepth = 0;
let sacramentoReserveLoadingSecondaryTimer = null;

function sacramentoReserveLoadingText(key, fallback) {
  const lang = typeof getSiteLanguage === "function" ? getSiteLanguage() : "en";
  const table = sacramentoI18nTable();
  const dict = table[lang] || table.en || {};
  return dict[key] || table.en?.[key] || fallback;
}

let sacramentoReserveLoadingOverlayEl = null;
let sacramentoPaymentRetryOverlayActive = false;

function sacramentoEnsureReserveLoadingOverlay() {
  if (sacramentoReserveLoadingOverlayEl) return sacramentoReserveLoadingOverlayEl;
  const overlay = document.createElement("div");
  overlay.id = "sacramentoReserveLoading";
  overlay.className = "sacramento-reserve-loading page-payment-result";
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "true");
  overlay.setAttribute("aria-live", "polite");
  overlay.setAttribute("aria-busy", "true");
  overlay.hidden = true;
  overlay.innerHTML =
    sacramentoBuildReserveOverlayLogoHtml() +
    '<main class="payment-result sacramento-reserve-loading__main">' +
    '<div class="payment-result__card payment-result__card--neutral sacramento-reserve-loading__card">' +
    '<div class="sacramento-reserve-loading__loading">' +
    '<div class="payment-result__spinner" aria-hidden="true"></div>' +
    '<h1 class="payment-result__title sacramento-reserve-loading__title"></h1>' +
    '<p class="payment-result__lead sacramento-reserve-loading__secondary" hidden></p>' +
    "</div>" +
    '<div class="sacramento-reserve-loading__retry" hidden>' +
    '<div class="payment-result__icon payment-result__icon--neutral" aria-hidden="true">!</div>' +
    '<h1 class="payment-result__title sacramento-reserve-loading__retry-title"></h1>' +
    '<p class="payment-result__body sacramento-reserve-loading__retry-body"></p>' +
    '<div class="payment-result__actions">' +
    '<button type="button" class="payment-result__btn" id="sacPaymentOverlayRetryBtn"></button>' +
    '<button type="button" class="payment-result__btn secondary" id="sacPaymentOverlayWaBtn"></button>' +
    "</div></div></div></main>";
  document.body.appendChild(overlay);
  const retryBtn = overlay.querySelector("#sacPaymentOverlayRetryBtn");
  const waBtn = overlay.querySelector("#sacPaymentOverlayWaBtn");
  if (retryBtn) {
    retryBtn.addEventListener("click", () => {
      if (retryBtn.disabled || sacramentoPaymentRetryInProgress) return;
      void sacramentoRetryPaymentLinkFromPendingTab();
    });
  }
  if (waBtn) {
    waBtn.addEventListener("click", () => {
      sacramentoOpenReserveWhatsAppFromPendingTab();
    });
  }
  sacramentoReserveLoadingOverlayEl = overlay;
  return overlay;
}

function sacramentoRefreshOverlayPaymentRetryCopy() {
  const overlay = sacramentoEnsureReserveLoadingOverlay();
  const { title, body, retryLabel, waLabel } = sacramentoGetPaymentRetryOfferCopy();
  const titleEl = overlay.querySelector(".sacramento-reserve-loading__retry-title");
  const bodyEl = overlay.querySelector(".sacramento-reserve-loading__retry-body");
  const retryBtn = overlay.querySelector("#sacPaymentOverlayRetryBtn");
  const waBtn = overlay.querySelector("#sacPaymentOverlayWaBtn");
  if (titleEl) titleEl.textContent = title;
  if (bodyEl) bodyEl.textContent = body;
  if (retryBtn) {
    retryBtn.textContent = retryLabel;
    if (!sacramentoPaymentRetryInProgress) {
      retryBtn.disabled = false;
      retryBtn.setAttribute("aria-busy", "false");
    }
  }
  if (waBtn) waBtn.textContent = waLabel;
}

function sacramentoShowOverlayLoadingState() {
  const overlay = sacramentoEnsureReserveLoadingOverlay();
  const loading = overlay.querySelector(".sacramento-reserve-loading__loading");
  const retry = overlay.querySelector(".sacramento-reserve-loading__retry");
  if (loading) loading.hidden = false;
  if (retry) retry.hidden = true;
  overlay.setAttribute("aria-busy", "true");
  sacramentoPaymentRetryOverlayActive = false;
  sacramentoRefreshReserveLoadingCopy();
}

function sacramentoShowOverlayPaymentRetryOffer() {
  const overlay = sacramentoEnsureReserveLoadingOverlay();
  const loading = overlay.querySelector(".sacramento-reserve-loading__loading");
  const retry = overlay.querySelector(".sacramento-reserve-loading__retry");
  sacramentoRefreshOverlayPaymentRetryCopy();
  if (loading) loading.hidden = true;
  if (retry) retry.hidden = false;
  overlay.hidden = false;
  overlay.setAttribute("aria-busy", "false");
  document.body.classList.add("sacramento-reserve-loading-active");
  sacramentoPaymentRetryOverlayActive = true;
  if (!sacramentoPaymentRetryInProgress) sacramentoSetOverlayRetryButtonsBusy(false);
}

function sacramentoRefreshReserveLoadingCopy() {
  const overlay = sacramentoEnsureReserveLoadingOverlay();
  const titleEl = overlay.querySelector(".sacramento-reserve-loading__title");
  const secondary = overlay.querySelector(".sacramento-reserve-loading__secondary");
  if (titleEl) {
    titleEl.textContent = sacramentoReserveLoadingPaymentLinkMode
      ? sacramentoReserveLoadingText(
          "reserve_payment_link_preparing",
          "We are preparing your secure payment link."
        )
      : sacramentoReserveLoadingText("reserve_loading_primary", "Preparing your booking…");
  }
  if (secondary) {
    secondary.textContent = sacramentoReserveLoadingPaymentLinkMode
      ? sacramentoReserveLoadingText(
          "reserve_payment_link_preparing_subtitle",
          "This may take a few seconds."
        )
      : sacramentoReserveLoadingText("reserve_loading_secondary", "Opening WhatsApp…");
  }
}

function sacramentoDisableReserveTriggers() {
  if (typeof document === "undefined") return;
  document.querySelectorAll(SACRAMENTO_RESERVE_TRIGGER_SELECTOR).forEach((el) => {
    if (el.dataset.sacReserveDisabled === "1") return;
    el.dataset.sacReserveDisabled = "1";
    el.dataset.sacReserveWasDisabled = el.disabled ? "1" : "0";
    if ("disabled" in el) el.disabled = true;
    el.setAttribute("aria-busy", "true");
    el.classList.add("sac-reserve-busy");
    if (el.tagName === "A") {
      el.dataset.sacReservePointerEvents = el.style.pointerEvents || "";
      el.style.pointerEvents = "none";
    }
  });
}

function sacramentoEnableReserveTriggers() {
  if (typeof document === "undefined") return;
  document.querySelectorAll("[data-sac-reserve-disabled='1']").forEach((el) => {
    if (el.dataset.sacReserveWasDisabled !== "1" && "disabled" in el) el.disabled = false;
    el.removeAttribute("aria-busy");
    el.classList.remove("sac-reserve-busy");
    if (el.tagName === "A" && "sacReservePointerEvents" in el.dataset) {
      el.style.pointerEvents = el.dataset.sacReservePointerEvents;
      delete el.dataset.sacReservePointerEvents;
    }
    delete el.dataset.sacReserveWasDisabled;
    delete el.dataset.sacReserveDisabled;
  });
}

function sacramentoShowReserveLoading() {
  if (typeof document === "undefined") return;
  sacramentoReserveLoadingDepth += 1;
  if (sacramentoReserveLoadingDepth > 1) return;
  sacramentoShowOverlayLoadingState();
  sacramentoDisableReserveTriggers();
  const overlay = sacramentoEnsureReserveLoadingOverlay();
  const secondary = overlay.querySelector(".sacramento-reserve-loading__secondary");
  if (secondary) secondary.hidden = true;
  overlay.hidden = false;
  document.body.classList.add("sacramento-reserve-loading-active");
  if (sacramentoReserveLoadingSecondaryTimer) clearTimeout(sacramentoReserveLoadingSecondaryTimer);
  sacramentoReserveLoadingSecondaryTimer = window.setTimeout(() => {
    sacramentoRefreshReserveLoadingCopy();
    const sec = overlay.querySelector(".sacramento-reserve-loading__secondary");
    if (sec && sacramentoReserveLoadingDepth > 0) sec.hidden = false;
  }, SACRAMENTO_RESERVE_LOADING_SECONDARY_MS);
}

function sacramentoHideReserveLoading() {
  if (typeof document === "undefined") return;
  sacramentoReserveLoadingDepth = Math.max(0, sacramentoReserveLoadingDepth - 1);
  if (sacramentoReserveLoadingDepth > 0) return;
  if (sacramentoPaymentRetryOverlayActive) return;
  if (sacramentoReserveLoadingSecondaryTimer) {
    clearTimeout(sacramentoReserveLoadingSecondaryTimer);
    sacramentoReserveLoadingSecondaryTimer = null;
  }
  sacramentoEnableReserveTriggers();
  if (sacramentoReserveLoadingOverlayEl) {
    sacramentoReserveLoadingOverlayEl.hidden = true;
    const secondary = sacramentoReserveLoadingOverlayEl.querySelector(
      ".sacramento-reserve-loading__secondary"
    );
    if (secondary) secondary.hidden = true;
  }
  document.body.classList.remove("sacramento-reserve-loading-active");
}

async function sacramentoRunReserveWhatsAppFlow(workFn) {
  sacramentoShowReserveLoading();
  try {
    return await workFn();
  } finally {
    sacramentoHideReserveLoading();
    try {
      delete window.__SACRAMENTO_RESOLVE_PENDING_TAB;
    } catch {
      /* ignore */
    }
  }
}

if (typeof document !== "undefined") {
  document.addEventListener("sacramento:setLanguage", () => {
    if (sacramentoPaymentRetryOverlayActive) sacramentoRefreshOverlayPaymentRetryCopy();
    else if (sacramentoReserveLoadingDepth > 0) sacramentoRefreshReserveLoadingCopy();
    if (typeof window.renderOrders === "function") {
      try {
        window.renderOrders();
      } catch (_) {
        /* ignore */
      }
    }
  });
}

function sacramentoOpenWhatsAppBlankTabForGesture() {
  if (sacramentoIsMobileWhatsAppClient()) return null;
  try {
    const tab = window.open("about:blank", "_blank");
    sacramentoPaintPendingTabLoading(tab);
    try {
      window.__SACRAMENTO_RESOLVE_PENDING_TAB = tab;
    } catch {
      /* ignore */
    }
    return tab;
  } catch {
    return null;
  }
}

function sacramentoOpenWhatsApp(phone, text, pendingTab) {
  const waUrl = sacramentoBuildWhatsAppUrl(phone, text);
  if (!waUrl || !sacramentoIsOfficialWhatsAppUrl(waUrl)) return;

  if (pendingTab && sacramentoPendingTabHasRetryOffer(pendingTab)) {
    const ctx = sacramentoGetPaymentRetryContext();
    if (ctx) {
      ctx.whatsappPhone = phone;
      ctx.whatsappMessage = String(text || ctx.whatsappMessage || "");
    }
    return;
  }

  if (sacramentoPaymentRetryOverlayActive) {
    const ctx = sacramentoGetPaymentRetryContext();
    if (ctx) {
      ctx.whatsappPhone = phone;
      ctx.whatsappMessage = String(text || ctx.whatsappMessage || "");
    }
    return;
  }

  if (sacramentoIsMobileWhatsAppClient()) {
    if (pendingTab) {
      try {
        pendingTab.close();
      } catch {
        /* ignore */
      }
    }
    window.location.href = waUrl;
    return;
  }

  sacramentoNavigatePendingTabToWhatsApp(pendingTab, waUrl);
}

function sacramentoNavigatePendingTabToWhatsApp(pendingTab, waUrl) {
  const url = String(waUrl || "");
  if (!url || !sacramentoIsOfficialWhatsAppUrl(url)) return;

  if (sacramentoIsMobileWhatsAppClient()) {
    if (pendingTab) {
      try {
        pendingTab.close();
      } catch {
        /* ignore */
      }
    }
    window.location.href = url;
    return;
  }

  const tab =
    pendingTab && typeof pendingTab === "object" && typeof pendingTab.closed === "boolean" && !pendingTab.closed
      ? pendingTab
      : null;

  if (tab) {
    if (sacramentoPendingTabHasRetryOffer(tab)) return;
    try {
      tab.opener = null;
    } catch {
      /* ignore */
    }
    try {
      tab.location.replace(url);
      return;
    } catch {
      /* ignore */
    }
    try {
      tab.location.href = url;
      return;
    } catch {
      /* ignore */
    }
    try {
      tab.close();
    } catch {
      /* ignore */
    }
  }

  window.location.href = url;
}

function sacramentoFixWhatsAppAnchorTargets(root = document) {
  if (!root || !root.querySelectorAll) return;
  root.querySelectorAll('a[href*="wa.me"], a[href*="api.whatsapp.com"]').forEach((anchor) => {
    const href = anchor.getAttribute("href") || "";
    if (!sacramentoIsOfficialWhatsAppUrl(href)) return;
    if (anchor.getAttribute("target") === "_blank") anchor.removeAttribute("target");
  });
}

function sacramentoInitTaxiFloatLinks(root = document) {
  if (!root || !root.querySelectorAll) return;
  const href = sacramentoBuildWhatsAppUrl(
    SACRAMENTO_TAXI_WHATSAPP_NUMBER,
    SACRAMENTO_TAXI_WHATSAPP_DEFAULT_TEXT
  );
  if (!href) return;
  root.querySelectorAll("a.taxi-float").forEach((anchor) => {
    anchor.setAttribute("href", href);
    if (anchor.getAttribute("target") === "_blank") anchor.removeAttribute("target");
  });
}

function withWhatsAppInOrderPayload(orderPayload, whatsappMessage) {
  const text = String(whatsappMessage || "").trim();
  if (!text) return orderPayload || {};
  return { ...(orderPayload || {}), whatsappMessage: text };
}

async function executeResolvePaymentAttempts(uniqueCandidates, bodyPayload) {
  const emptyResult = { paymentUrl: "", alreadyApproved: false, fingerprint: "" };
  const isMockPaymentUrl = (url) => {
    const value = String(url || "");
    return value.includes("sessionId=mock_") || /\/mock_[a-z0-9]+/i.test(value);
  };

  for (const endpoint of uniqueCandidates) {
    for (let attempt = 1; attempt <= RESOLVE_MAX_ATTEMPTS; attempt += 1) {
      let failureKind = "unknown";
      try {
        const response = await fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify(bodyPayload),
          signal: resolveFetchAbortSignal(RESOLVE_FETCH_TIMEOUT_MS)
        });
        if (!response.ok) {
          failureKind = isRetryableResolveHttpStatus(response.status) ? "http_retryable" : "http_non_retryable";
          // eslint-disable-next-line no-console
          console.warn("[payments-resolve] HTTP error", {
            endpoint,
            attempt,
            status: response.status,
            retryable: failureKind === "http_retryable"
          });
          if (failureKind === "http_retryable" && attempt < RESOLVE_MAX_ATTEMPTS) {
            await delayMs(RESOLVE_RETRY_DELAY_MS);
            continue;
          }
          break;
        }
        const data = await response.json();
        if (data.alreadyApproved === true) {
          // eslint-disable-next-line no-console
          console.log("[payments-resolve] order already approved", {
            endpoint,
            attempt,
            fingerprint: data.fingerprint || null
          });
          return {
            paymentUrl: "",
            alreadyApproved: true,
            fingerprint: String(data.fingerprint || ""),
            paymentStatus: String(data.paymentStatus || "approved")
          };
        }
        const url = data.paymentUrl || data.url || "";
        if (!url) {
          failureKind = "missing_payment_url";
          // eslint-disable-next-line no-console
          console.warn("[payments-resolve] missing paymentUrl in response", { endpoint, attempt });
          break;
        }
        if (isMockPaymentUrl(url)) {
          failureKind = "mock_payment_url";
          // eslint-disable-next-line no-console
          console.warn("[payments-resolve] mock paymentUrl rejected", { endpoint, attempt });
          break;
        }
        // eslint-disable-next-line no-console
        console.log("[payments-resolve] success", {
          endpoint,
          attempt,
          forceNewAttempt: bodyPayload?.forceNewAttempt === true
        });
        return { paymentUrl: url, alreadyApproved: false, fingerprint: String(data.fingerprint || "") };
      } catch (err) {
        const isTimeout =
          err instanceof Error &&
          (err.name === "TimeoutError" || err.name === "AbortError" || /timeout/i.test(err.message));
        failureKind = isTimeout ? "timeout" : "network";
        // eslint-disable-next-line no-console
        console.warn("[payments-resolve] fetch failed", {
          endpoint,
          attempt,
          kind: failureKind,
          message: err instanceof Error ? err.message : String(err)
        });
        if (attempt < RESOLVE_MAX_ATTEMPTS) {
          await delayMs(RESOLVE_RETRY_DELAY_MS);
          continue;
        }
      }
      if (failureKind === "http_non_retryable") break;
    }
  }
  return emptyResult;
}

async function buildResolveBodyPayload(dynamicPayment, payload, uniqueCandidates, preparedBodyPayload) {
  if (preparedBodyPayload && typeof preparedBodyPayload === "object") {
    return { ...preparedBodyPayload };
  }
  const origins = [...new Set(uniqueCandidates.map(paymentApiOriginFromResolveUrl).filter(Boolean))];
  let bodyPayload = { ...payload };
  const existingDf =
    typeof payload.cybersourceDeviceFingerprint === "string"
      ? payload.cybersourceDeviceFingerprint.trim()
      : "";
  if (!existingDf && typeof window !== "undefined") {
    let orgId = dynamicPayment.cybersourceOrgId ? String(dynamicPayment.cybersourceOrgId).trim() : "";
    let prefix = dynamicPayment.cybersourceSessionPrefix
      ? String(dynamicPayment.cybersourceSessionPrefix).trim()
      : "";
    if (!orgId || !prefix) {
      const hints = await fetchPlexoCybersourceHints(origins);
      if (!orgId) orgId = hints.orgId;
      if (!prefix) prefix = hints.prefix;
    }
    if (orgId && prefix) {
      try {
        const df = await sacramentoCollectCybersourceSessionId(orgId, prefix);
        if (df) bodyPayload = { ...bodyPayload, cybersourceDeviceFingerprint: df };
      } catch {
        /* sin fingerprint: Plexo puede seguir fallando 3DS en Visa */
      }
    }
  }
  return bodyPayload;
}

async function resolveDynamicPaymentLink(dynamicPayment, payload, options = {}) {
  if (!dynamicPayment || !dynamicPayment.enabled) return "";
  const endpointRaw = dynamicPayment.endpoint || DEFAULT_DYNAMIC_PAYMENT_ENDPOINT;
  const uniqueCandidates = sacramentoBuildResolveEndpointCandidates(endpointRaw);
  const pendingTab =
    options?.pendingTab ??
    (typeof window !== "undefined" ? window.__SACRAMENTO_RESOLVE_PENDING_TAB : null);
  const whatsappPhone = options?.contactMeta?.phone || SACRAMENTO_DEFAULT_WHATSAPP_NUMBER;
  const whatsappMessageFallback =
    options?.contactMeta?.message || payload?.orderPayload?.whatsappMessage || "";

  sacramentoSetReserveLoadingPaymentLinkMode(true);
  if (pendingTab) sacramentoPaintPendingTabPaymentPreparing(pendingTab);

  let bodyPayload = null;
  try {
    const resolveResult = await withResolveFlowTimeout(async () => {
      bodyPayload = await buildResolveBodyPayload(
        dynamicPayment,
        payload,
        uniqueCandidates,
        options?.preparedBodyPayload
      );
      const paymentUrl = await executeResolvePaymentAttempts(uniqueCandidates, bodyPayload);
      return { bodyPayload, paymentUrl: paymentUrl.paymentUrl, alreadyApproved: paymentUrl.alreadyApproved };
    });

    if (resolveResult.alreadyApproved) {
      return "";
    }

    if (resolveResult.paymentUrl) {
      const ctx = sacramentoGetPaymentRetryContext();
      if (ctx) ctx.lastPaymentUrl = resolveResult.paymentUrl;
      return resolveResult.paymentUrl;
    }

    // eslint-disable-next-line no-console
    console.error("[payments-resolve] exhausted attempts without paymentUrl", {
      candidates: uniqueCandidates,
      attempts: RESOLVE_MAX_ATTEMPTS
    });

    const whatsappMessage =
      whatsappMessageFallback || resolveResult.bodyPayload?.orderPayload?.whatsappMessage || "";
    sacramentoOfferPaymentRetryAfterFailure({
      dynamicPayment,
      bodyPayload: resolveResult.bodyPayload || bodyPayload || payload,
      pendingTab,
      uniqueCandidates,
      whatsappPhone,
      whatsappMessage,
      reason: "exhausted"
    });
    return "";
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[payments-resolve] resolve flow failed", {
      reason: sacramentoResolveFailureReason(err),
      message: err instanceof Error ? err.message : String(err)
    });
    const whatsappMessage = whatsappMessageFallback || bodyPayload?.orderPayload?.whatsappMessage || "";
    sacramentoOfferPaymentRetryAfterFailure({
      dynamicPayment,
      bodyPayload: bodyPayload || payload,
      pendingTab,
      uniqueCandidates,
      whatsappPhone,
      whatsappMessage,
      reason: sacramentoResolveFailureReason(err)
    });
    return "";
  } finally {
    sacramentoSetReserveLoadingPaymentLinkMode(false);
  }
}

function sacramentoPaymentSuccessPageUrl() {
  try {
    return new URL("payment-success.html", window.location.href).href;
  } catch {
    return "payment-success.html";
  }
}

async function sacramentoRetryPaymentLinkFromPendingTab() {
  if (sacramentoPaymentRetryInProgress) return;
  const ctx = sacramentoGetPaymentRetryContext();
  if (!ctx?.dynamicPayment || !ctx?.bodyPayload) return;

  sacramentoPaymentRetryInProgress = true;
  sacramentoSetOverlayRetryButtonsBusy(true);
  const pendingTab = ctx.pendingTab;
  sacramentoShowReserveLoading();
  sacramentoSetReserveLoadingPaymentLinkMode(true);
  if (pendingTab && !pendingTab.closed) {
    sacramentoPaintPendingTabPaymentPreparing(pendingTab);
  } else {
    sacramentoShowOverlayLoadingState();
  }

  let paymentUrl = "";
  try {
    const uniqueCandidates =
      ctx.uniqueCandidates ||
      sacramentoBuildResolveEndpointCandidates(ctx.dynamicPayment.endpoint || DEFAULT_DYNAMIC_PAYMENT_ENDPOINT);
    const retryBodyPayload = { ...ctx.bodyPayload, forceNewAttempt: true, retryReason: "user_retry" };
    try {
      const resolveResult = await withResolveFlowTimeout(
        () => executeResolvePaymentAttempts(uniqueCandidates, retryBodyPayload),
        RESOLVE_FLOW_TIMEOUT_MS
      );
      if (resolveResult.alreadyApproved) {
        const successUrl = sacramentoPaymentSuccessPageUrl();
        if (pendingTab && !pendingTab.closed) {
          try {
            pendingTab.location.href = successUrl;
          } catch {
            window.location.href = successUrl;
          }
        } else {
          window.location.href = successUrl;
        }
        return;
      }
      paymentUrl = resolveResult.paymentUrl || "";
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("[payments-resolve] manual retry failed", {
        reason: sacramentoResolveFailureReason(err),
        message: err instanceof Error ? err.message : String(err)
      });
      paymentUrl = "";
    }

    if (paymentUrl) {
      ctx.lastPaymentUrl = paymentUrl;
      if (pendingTab && !pendingTab.closed) {
        try {
          pendingTab.location.href = paymentUrl;
        } catch {
          window.open(paymentUrl, "_blank", "noopener,noreferrer");
        }
      } else {
        window.location.href = paymentUrl;
      }
      return;
    }
    if (pendingTab && !pendingTab.closed) {
      sacramentoPaintPendingTabPaymentRetryOffer(pendingTab);
    } else {
      sacramentoShowOverlayPaymentRetryOffer();
    }
  } finally {
    sacramentoPaymentRetryInProgress = false;
    sacramentoSetOverlayRetryButtonsBusy(false);
    sacramentoSetReserveLoadingPaymentLinkMode(false);
    sacramentoHideReserveLoading();
  }
}

function sacramentoOpenReserveWhatsAppFromPendingTab() {
  const ctx = sacramentoGetPaymentRetryContext();
  if (!ctx) return;
  const phone = ctx.whatsappPhone || SACRAMENTO_DEFAULT_WHATSAPP_NUMBER;
  const message = sacramentoBuildWhatsappMessageWithPaymentLink(ctx.whatsappMessage, ctx.lastPaymentUrl);
  sacramentoPaymentRetryOverlayActive = false;
  sacramentoOpenWhatsApp(phone, message, null);
}

const SACRAMENTO_I18N_PREF = "__i18n__:";

function sacramentoNormalizePrefText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Map free-text / legacy checkbox values to i18n keys (for labels + emoji). */
function sacramentoLegacyPrefKey(value) {
  const v = sacramentoNormalizePrefText(value);
  if (!v) return "";
  if (
    v.includes("red wine") ||
    v.includes("vino tinto") ||
    (v.includes("tinto") && (v.includes("prefer") || v.includes("preferencia")))
  ) {
    return "liebres_pref_red";
  }
  if (
    v.includes("white wine") ||
    v.includes("vino blanco") ||
    (v.includes("blanco") && (v.includes("prefer") || v.includes("preferencia")))
  ) {
    return "liebres_pref_white";
  }
  if (
    v.includes("no alcohol") ||
    v.includes("sin alcohol") ||
    v.includes("sem alcool")
  ) {
    return "liebres_pref_no_alcohol";
  }
  if ((v.includes("0") && v.includes("alcohol")) || v.includes("zero alcohol")) {
    return "bruma_pref_alcohol";
  }
  if (
    v.includes("vegetarian menu") ||
    v.includes("menu vegetariano") ||
    v.includes("menú vegetariano")
  ) {
    return "legado_pref_vegetarian_menu";
  }
  if (v.includes("vegetarian") || v.includes("vegetariano") || v.includes("vegetariana")) {
    return "bruma_pref_veg";
  }
  if (
    v.includes("low salt") ||
    v.includes("salt free") ||
    v.includes("bajo en sal") ||
    v.includes("sin sal") ||
    v.includes("baixo em sal") ||
    v.includes("baixo teor de sal")
  ) {
    return "bruma_pref_salt";
  }
  if (
    v.includes("no spicy") ||
    v.includes("spicy") ||
    v.includes("sin picante") ||
    v.includes("picante") ||
    v.includes("sem comida picante")
  ) {
    return "bruma_pref_spicy";
  }
  return "";
}

function sacramentoPrefEmojiKey(key) {
  if (!key) return "";
  const m = {
    bruma_pref_alcohol: "🍺",
    bruma_pref_salt: "🧂",
    bruma_pref_veg: "🌱",
    bruma_pref_spicy: "🌶",
    legado_pref_vegetarian_menu: "🌱",
    liebres_pref_red: "🍷",
    liebres_pref_white: "🥂",
    liebres_pref_vegetarian: "🌱",
    liebres_pref_no_alcohol: "🚫",
    liebres_dining_pref_no_alcohol: "🚫",
  };
  return m[key] || "";
}

function sacramentoDecodePrefLabel(raw, getI18nText, prefix = SACRAMENTO_I18N_PREF) {
  const r = String(raw || "").trim();
  if (!r) return "";
  if (r.startsWith(prefix)) {
    const k = r.slice(prefix.length);
    return getI18nText(k, k);
  }
  const k = sacramentoLegacyPrefKey(r);
  return k ? getI18nText(k, r) : r;
}

function sacramentoDecoratePref(raw, getI18nText, prefix = SACRAMENTO_I18N_PREF) {
  const r = String(raw || "").trim();
  if (!r) return "";
  const key = r.startsWith(prefix) ? r.slice(prefix.length) : sacramentoLegacyPrefKey(r);
  const label = r.startsWith(prefix) ? getI18nText(key, key) : key ? getI18nText(key, r) : r;
  const emoji = sacramentoPrefEmojiKey(key);
  return emoji ? `${emoji} ${label}` : label;
}

/** Sum guests across room rows `{ guests: n }[]` (0 if invalid). */
function sacramentoCalculateGuestsFromRooms(roomRows) {
  if (!Array.isArray(roomRows)) return 0;
  return roomRows.reduce((s, r) => s + Math.max(0, Math.floor(Number(r && r.guests) || 0)), 0);
}

/** Total room cost using `priceByOccupancy` keyed by guest count per room (e.g. `"2"` → 75). */
function sacramentoCalculateRoomRowsCost(roomRows, priceByOccupancy) {
  if (!Array.isArray(roomRows) || !priceByOccupancy || typeof priceByOccupancy !== "object") return 0;
  return roomRows.reduce((sum, row) => {
    const g = Math.max(0, Math.floor(Number(row && row.guests) || 0));
    if (g <= 0) return sum;
    const p = Number(priceByOccupancy[String(g)]);
    return sum + (Number.isFinite(p) ? p : 0);
  }, 0);
}

/** Guests from rooms when >0, otherwise `fallbackCount` (e.g. menu orders count). */
function sacramentoCalculateTotalGuestsFromState(roomRows, fallbackCount) {
  const fromRooms = sacramentoCalculateGuestsFromRooms(roomRows);
  if (fromRooms > 0) return fromRooms;
  return Math.max(0, Math.floor(Number(fallbackCount) || 0));
}

function initExperience(config) {
  const {
    pricePerPerson,
    guideFeePerPerson = 0,
    transportPerVehicle = 0,
    dynamicPayment = null,
    paymentLinks = {},
    experienceName = "experience",
    /** Optional i18n key for experienceName (uses global translations). */
    experienceNameKey = null,
    /** Optional { starter, main, drink } translation keys for order summary / WhatsApp labels. */
    choiceSectionLabelKeys = null,
    /** Optional `(order) => void` after popup fields are filled when editing an order. */
    afterFillPopupForEdit = null,
    /** Optional `() => void` after popup is opened for a new order (radios may be cleared). */
    afterOpenPopupForNewOrder = null,
    popupId = "popupBruma",
    closeBtnId = "closeBruma",
    saveBtnId = "saveMenu",
    createBtnId = "createMenuBtn",
    orderSummaryId = "orderSummary",
    bookNowBottomId,
    whatsappNumber = "59898945542",
    selectedDateKey = "selectedDate",
    storageKey = "orders",
    starterName = "starter",
    mainName = "main",
    drinkName = "drink",
    /** Optional 4th course radio group (e.g. beverage after dessert). */
    beverageName = null,
    /** Optional labels for order summary / WhatsApp (defaults: Starter / Main / Drink). */
    choiceSectionLabels = null,
    /** If true, guide fee applies only when order.includeGuide is true (checkbox in popup). */
    guideOptional = false,
    /** Required when guideOptional: checkbox id (e.g. liebresIncludeGuide). */
    optionalGuideCheckboxId = null,
    /** If true, one flat guide fee for the whole group (see groupGuideFlatFee + groupGuideCheckboxId). */
    groupGuideOptional = false,
    /** Flat USD for the whole group when the group-guide checkbox is on (e.g. 40). */
    groupGuideFlatFee = 0,
    /** Checkbox id on the page (outside popup), e.g. liebresGroupGuide. */
    groupGuideCheckboxId = null,
    /** Optional wrapper id to show only when there is at least one guest order. */
    groupGuideWrapId = null,
    /** Optional second price tier (e.g. Bruma premium menu USD 45). */
    menuUpgradePrice = null,
    /** Radio group name for standard vs premium, e.g. brumaMenuTier. */
    menuTierRadioName = null,
    /** When premium tier: field names for plate / dessert / drink, e.g. prm_starter, prm_main, prm_drink. */
    premiumChoiceFieldNames = null,
    /** Panel ids for standard vs premium menus: { standard: "id", premium: "id" }. */
    menuTierPanelIds = null,
    /** If true, order summary / WhatsApp use the same starter/main labels for premium as for standard (not Plate/Dessert). */
    uniformTierChoiceLabels = false,
    /** Currency label before amounts in this experience's subtotal/total (default USD). E.g. UYU for pesos. */
    totalCurrencyLabel = "USD",
    /** Optional override for the standard tier line in the order card (else Bruma i18n). */
    tierSummaryStandard = null,
    /** Optional override for the premium tier line in the order card. */
    tierSummaryPremium = null,
    /** Optional override for standard tier in WhatsApp. */
    tierWhatsappStandard = null,
    /** Optional override for premium tier in WhatsApp. */
    tierWhatsappPremium = null,
    /** If set, order card tier line uses `getI18nText(key, tierSummaryStandard || …)` instead of `tierSummaryStandard` alone. */
    tierSummaryStandardKey = null,
    tierSummaryPremiumKey = null,
    tierWhatsappStandardKey = null,
    tierWhatsappPremiumKey = null,
    /**
     * Optional `{ standard: "i18nKey", premium: "i18nKey" }` for a short serving-size line under the menu tier in the order card (when `menuUpgradePrice` is set).
     */
    tierServingNotesI18n = null,
    /**
     * If true (with menuUpgradePrice set): experience subtotal is one flat amount for the whole group —
     * menuUpgradePrice if any guest order is premium, else pricePerPerson. Ignores party size for pricing.
     */
    experienceMenuFlatTotal = false,
    /**
     * When true with menu tiers: saving a Standard order does not require `mainName` radios;
     * `standardMainPlaceholder` is stored as `order.main` instead.
     */
    standardSkipsMainField = false,
    /** Stored as order.main when standardSkipsMainField and tier is Standard. */
    standardMainPlaceholder = "—",
    /** When true with premium tier: starter and main choices must differ (two side dishes). */
    premiumRequireDistinctSides = false,
    /** Checkbox `name` for Standard sides (max 1 checked). If set, replaces starter radios for Standard. */
    standardSideCheckboxName = null,
    /** Checkbox `name` for Premium sides (max 2 checked). If set, replaces premium starter/main radios. */
    premiumSideCheckboxName = null,
    /** When true: no drink/beverage radios required; `order.drink` is stored empty and hidden in summary / WhatsApp. */
    experienceSkipsDrinkField = false,
    /** When true: preferences are not shown in order cards or WhatsApp (checkboxes may still exist elsewhere). */
    experienceSkipsPreferencesField = false,
    /** When true: no starter radios required; starter row hidden in summary / WhatsApp. */
    experienceSkipsStarterField = false,
    /**
     * Optional fixed lines in order card / WhatsApp: `{ labelKey, valueKey?, placement?: "top"|"bottom" }`.
     * When `valueKey` is omitted, only the label is shown.
     */
    experienceFixedSummaryRows = null,
    /**
     * Optional package picker before menu: `{ radioName, stepPackageId, stepMenuId, nextBtnId, backBtnId, popupTitleId, popupTitlePackageKey, popupTitleMenuKey, menuHeadingId, defaultMenuPackageId, packages: { id: { price, requiresMenu, labelKey, tourAddon?: { checkboxId, price, labelKey } } } }`.
     */
    experiencePackageOptions = null,
    /** Optional i18n key for each order card / WhatsApp heading (default: order_word → "Order" / "Pedido"). */
    orderCardTitleKey = "order_word",
    /**
     * Optional boat add-on priced per passenger (e.g. 25). Stored separately in localStorage as `{storageKey}_boatPassengers`.
     * Counter appears in the order summary when there is at least one menu order.
     */
    boatPerPersonPrice = 0,
    boatPassengersMax = 50,
    /** Minimum total boat passengers required to reserve (e.g. 10 for group boat tours). */
    boatPassengersMin = 0,
    /** Minimum menu orders required to reserve (one order per person, e.g. 2 for Quintón). */
    minOrders = 0,
    /** Optional list of boat departure time labels (e.g. `["11:00am", …]`). Shown when `boatPerPersonPrice` > 0; stored in localStorage. */
    boatTimeSlots = null,
    /**
     * When true: no starter/main/drink (or sides) validation in the popup — only preferences (+ optional per-guest guide).
     * Use for boat-only or similar: each save adds one guest at `pricePerPerson`.
     */
    experienceSkipsMenuChoices = false,
    /**
     * When true with `boatTimeSlots`: show departure time pickers when there are orders, without a separate boat $ line
     * (`boatPerPersonPrice` should be 0; total = guests × `pricePerPerson`).
     */
    boatScheduleOnly = false,
    boatTimePerOrder = false,
    boatTimePopupRadioName = null,
    /**
     * Optional radio `name` for per-order extra field (e.g. walking tour guide language).
     * When set, saving requires a checked option; stored as `order.walkingLanguage`.
     */
    orderLanguageRadioName = null,
    /** Optional i18n key for order-card / WhatsApp label before language value (default: walking_label_language). */
    orderLanguageSummaryLabelKey = null,
    /**
     * When > 0 with `orderLanguageRadioName`: each order stores `walkingPartyCount` (1..max);
     * `guideFeePerPerson` is multiplied by that count (walking tour guests per menu order).
     */
    orderWalkingPartyMax = 0,
    /**
     * When true with `walkingTourTimeSlots` and walking party + language: each order stores
     * `walkingTourDepartureTime`; sum of `walkingPartyCount` per same time ≤ `walkingTourSlotMax`.
     */
    walkingTourTimePerOrder = false,
    walkingTourTimeSlots = null,
    walkingTourSlotMax = 15,
    walkingTourTimePopupRadioName = null,
    /**
     * Optional `{ radioName, summaryLabelKey?, summaryDisplayValueKey? }` — popup radios for cabalgata / horseback slot;
     * stored per order as `horsebackDepartureTime` (chosen radio `value`).
     */
    horsebackDepartureInPopup = null,
    /** When true: omit the "People" count line in WhatsApp (e.g. when boat passengers differ from menu orders). */
    whatsappSkipsPeopleLine = false,
    /** When true: hide USD amounts in order summary and WhatsApp (rates coordinated separately). */
    experienceSkipsPricing = false,
    /** Optional i18n key for full WhatsApp intro line (replaces orders_wa_intro template). */
    whatsappIntroKey = null,
    /**
     * Optional room-first booking for hotel + dinner packages.
     * `{ hostElementId, priceByOccupancy, occupancyOptions?, maxRooms?, minRooms?, defaultOccupancy? }`
     * — persists `${storageKey}_roomBooking`, requires one menu order per derived guest.
     */
    roomBooking = null,
    /**
     * Optional visit time for date-keyed experiences: `{ globalApi: "windowObjectName", summaryLabelKey? }`.
     */
    visitTimeBooking = null
  } = config || {};

  if (!pricePerPerson) {
    console.error("initExperience: config incompleta (pricePerPerson)");
    return;
  }

  const bootExperience = () => {
    let editingIndex = null;
    const curLabel = totalCurrencyLabel || "USD";
    const rbCfg = roomBooking && typeof roomBooking === "object" && roomBooking.hostElementId ? roomBooking : null;
    const rbHost = rbCfg ? document.getElementById(String(rbCfg.hostElementId)) : null;
    const rb = rbCfg && rbHost ? rbCfg : null;
    const roomsStorageKey = rb ? `${storageKey}_roomBooking` : null;
    const visitTimeApi =
      visitTimeBooking &&
      typeof visitTimeBooking === "object" &&
      visitTimeBooking.globalApi &&
      typeof window[visitTimeBooking.globalApi] === "object"
        ? window[visitTimeBooking.globalApi]
        : null;

    const renumberRoomGuestIds = (list) => {
      if (!rb || !Array.isArray(list)) return list;
      list.forEach((o, i) => {
        if (o && typeof o === "object") o.guestId = String(i + 1);
      });
      return list;
    };

    const getRoomRows = () => {
      if (!roomsStorageKey) return [];
      try {
        const raw = JSON.parse(localStorage.getItem(roomsStorageKey) || "{}");
        const rooms = Array.isArray(raw.rooms) ? raw.rooms : [];
        return rooms
          .map((r) => ({ guests: Math.max(0, Math.floor(Number(r && r.guests) || 0)) }))
          .filter((r) => r.guests > 0);
      } catch {
        return [];
      }
    };

    const setRoomRows = (rows) => {
      if (!roomsStorageKey) return;
      const clean = (Array.isArray(rows) ? rows : [])
        .map((r) => ({ guests: Math.max(0, Math.floor(Number(r && r.guests) || 0)) }))
        .filter((r) => r.guests > 0);
      localStorage.setItem(roomsStorageKey, JSON.stringify({ rooms: clean }));
    };

    const occupancyOptsResolved = () => {
      const def = [1, 2, 3];
      if (!rb || !Array.isArray(rb.occupancyOptions) || rb.occupancyOptions.length === 0) return def;
      return rb.occupancyOptions
        .map((n) => Math.max(1, Math.min(20, Math.floor(Number(n) || 1))))
        .filter((n, i, a) => a.indexOf(n) === i)
        .sort((a, b) => a - b);
    };

    const defaultOccResolved = () => {
      const opts = occupancyOptsResolved();
      const want = Math.max(1, Math.floor(Number(rb && rb.defaultOccupancy) || 2));
      return opts.includes(want) ? want : opts[0];
    };

    const ensureDefaultRooms = () => {
      if (!rb) return;
      if (getRoomRows().length === 0) {
        setRoomRows([{ guests: defaultOccResolved() }]);
      }
    };

    const calculateGuestsFromRooms = () => sacramentoCalculateGuestsFromRooms(getRoomRows());
    const calculateTotalRoomCost = () => sacramentoCalculateRoomRowsCost(getRoomRows(), rb ? rb.priceByOccupancy : {});

    const boatRate = Math.max(0, Number(boatPerPersonPrice) || 0);
    const boatMax = Math.max(1, Math.min(200, Number(boatPassengersMax) || 50));
    const boatMin = Math.max(0, Math.min(boatMax, Math.floor(Number(boatPassengersMin) || 0)));
    const minOrdersNum = Math.max(0, Math.floor(Number(minOrders) || 0));
    const expPkg =
      experiencePackageOptions &&
      typeof experiencePackageOptions === "object" &&
      experiencePackageOptions.radioName &&
      experiencePackageOptions.packages &&
      typeof experiencePackageOptions.packages === "object"
        ? experiencePackageOptions
        : null;

    const getPackageDef = (id) => {
      if (!expPkg || !id) return null;
      return expPkg.packages[id] || null;
    };

    const readSelectedPackageId = () => {
      if (!expPkg) return null;
      const popupEl = document.getElementById(popupId);
      if (!popupEl) return null;
      const sel = popupEl.querySelector(`input[name="${expPkg.radioName}"]:checked`);
      return sel ? String(sel.value || "").trim() : null;
    };

    const packageLabelForOrder = (order) => {
      const pid = order && order.packageId;
      const pkg = getPackageDef(pid);
      if (!pkg) return "";
      let label = getI18nText(pkg.labelKey, pid);
      if (order.includeTour && pkg.tourAddon) {
        label += ` · ${getI18nText(pkg.tourAddon.labelKey, "Guided tour")}`;
      }
      return label;
    };

    const formatPkgMoney = (n) => {
      const x = Number(n);
      if (!Number.isFinite(x)) return "0";
      const v = Math.round(x * 100) / 100;
      return Number.isInteger(v) ? String(v) : v.toFixed(2);
    };

    const packageInvestmentForOrder = (order) => {
      const pkg = getPackageDef(order && order.packageId);
      if (!pkg) return "";
      const tpl = getI18nText(
        "quinton_order_investment_value",
        "{currency} {price} per person"
      );
      return tpl
        .replace(/\{currency\}/g, curLabel)
        .replace(/\{price\}/g, formatPkgMoney(pkg.price));
    };

    const resetPackageTourCheckboxes = () => {
      if (!expPkg) return;
      Object.values(expPkg.packages).forEach((pkg) => {
        if (pkg && pkg.tourAddon && pkg.tourAddon.checkboxId) {
          const cb = document.getElementById(pkg.tourAddon.checkboxId);
          if (cb) cb.checked = false;
        }
      });
    };

    const readPackageIncludeTour = (pkg) => {
      if (!pkg || !pkg.tourAddon || !pkg.tourAddon.checkboxId) return false;
      const cb = document.getElementById(pkg.tourAddon.checkboxId);
      return Boolean(cb && cb.checked);
    };

    const inferPackageIdFromOrder = (order) => {
      if (!expPkg || !order) return null;
      if (order.packageId) return String(order.packageId);
      if (String(order.starter || order.main || order.drink || "").trim()) {
        return expPkg.defaultMenuPackageId || "opt3";
      }
      return null;
    };
    let expPkgActiveStep = "packages";

    const packageSaveBtnEl = () => (saveBtnId ? document.getElementById(saveBtnId) : null);

    const syncPackageActionButtons = () => {
      if (!expPkg) return;
      const pid = readSelectedPackageId();
      const pkg = getPackageDef(pid);
      const nextBtn = expPkg.nextBtnId ? document.getElementById(expPkg.nextBtnId) : null;
      const saveEl = packageSaveBtnEl();
      const requiresMenu = Boolean(pkg && pkg.requiresMenu);
      if (nextBtn) nextBtn.hidden = !requiresMenu;
      if (saveEl) saveEl.hidden = requiresMenu;
    };

    const showPackagePopupStep = (which) => {
      if (!expPkg) return;
      expPkgActiveStep = which === "menu" ? "menu" : "packages";
      const stepPkg = expPkg.stepPackageId ? document.getElementById(expPkg.stepPackageId) : null;
      const stepMenu = expPkg.stepMenuId ? document.getElementById(expPkg.stepMenuId) : null;
      const nextBtn = expPkg.nextBtnId ? document.getElementById(expPkg.nextBtnId) : null;
      const backBtn = expPkg.backBtnId ? document.getElementById(expPkg.backBtnId) : null;
      const titleEl = expPkg.popupTitleId ? document.getElementById(expPkg.popupTitleId) : null;
      const menuHeading = expPkg.menuHeadingId ? document.getElementById(expPkg.menuHeadingId) : null;
      const saveEl = packageSaveBtnEl();
      const onMenu = expPkgActiveStep === "menu";
      if (stepPkg) stepPkg.hidden = onMenu;
      if (stepMenu) stepMenu.hidden = !onMenu;
      if (menuHeading) menuHeading.hidden = !onMenu;
      if (backBtn) backBtn.hidden = !onMenu;
      if (onMenu) {
        if (nextBtn) nextBtn.hidden = true;
        if (saveEl) saveEl.hidden = false;
        ensureDefaultMenuRadios();
        if (titleEl && expPkg.popupTitleMenuKey) {
          titleEl.textContent = getI18nText(expPkg.popupTitleMenuKey, titleEl.textContent);
          titleEl.dataset.translate = expPkg.popupTitleMenuKey;
        }
      } else {
        syncPackageActionButtons();
        if (titleEl && expPkg.popupTitlePackageKey) {
          titleEl.textContent = getI18nText(expPkg.popupTitlePackageKey, titleEl.textContent);
          titleEl.dataset.translate = expPkg.popupTitlePackageKey;
        }
      }
    };

    const saveFixedPackageOrder = (orders, pid, pkg) => {
      const includeTour = readPackageIncludeTour(pkg);
      const order = {
        starter: "",
        main: "",
        drink: "",
        preferences: [],
        packageId: pid,
        ...(includeTour ? { includeTour: true } : {}),
        ...(rb
          ? {
              guestId:
                editingIndex !== null
                  ? String(
                      (orders[editingIndex] && orders[editingIndex].guestId) ||
                        String(editingIndex + 1)
                    )
                  : String(orders.length + 1)
            }
          : {})
      };
      if (editingIndex !== null) {
        orders[editingIndex] = order;
        editingIndex = null;
      } else {
        orders.push(order);
      }
      setOrders(renumberRoomGuestIds(orders));
      document.getElementById(popupId)?.classList.remove("active");
      if (typeof window.renderOrders === "function") {
        window.renderOrders();
      }
      scrollToOrderSummary(orderSummaryId);
    };

    const boatTimePerOrderFlag =
      Boolean(boatTimePerOrder) && Array.isArray(boatTimeSlots) && boatTimeSlots.length > 0;
    const menuWithPerOrderBoat =
      boatTimePerOrderFlag && boatRate > 0 && !experienceSkipsMenuChoices;
    const orderBoatTime = (o) => String(o && o.boatDepartureTime ? o.boatDepartureTime : "").trim();
    const orderBoatPax = (o) => {
      if (!o) return 0;
      if (experienceSkipsMenuChoices && boatTimePerOrderFlag) {
        return Math.max(1, Math.min(boatMax, Math.floor(Number(o.passengers) || 1)));
      }
      if (menuWithPerOrderBoat) {
        return Math.max(0, Math.min(boatMax, Math.floor(Number(o.boatPassengers) || 0)));
      }
      return 0;
    };
    const boatLSKey = boatRate > 0 && !boatTimePerOrderFlag ? `${storageKey}_boatPassengers` : null;
    const getBoatPassengers = () => {
      if (!boatLSKey) return 0;
      const n = parseInt(localStorage.getItem(boatLSKey), 10);
      return Math.min(boatMax, Math.max(0, Number.isFinite(n) ? n : 0));
    };
    const setBoatPassengers = (n) => {
      if (!boatLSKey) return;
      localStorage.setItem(boatLSKey, String(Math.min(boatMax, Math.max(0, Math.floor(Number(n) || 0)))));
    };
    const boatTimePopupRadioNameResolved = boatTimePerOrderFlag
      ? String(
          boatTimePopupRadioName ||
            `boatTimePopup_${String(storageKey).replace(/[^a-zA-Z0-9_-]/g, "_")}`
        ).slice(0, 120)
      : "";
    const boatScheduleOnlyFlag = Boolean(boatScheduleOnly) && !boatTimePerOrderFlag;
    const boatTimeLSKey =
      !boatTimePerOrderFlag &&
      Array.isArray(boatTimeSlots) &&
      boatTimeSlots.length > 0 &&
      (boatRate > 0 || boatScheduleOnlyFlag)
        ? `${storageKey}_boatTime`
        : null;
    const boatTimeRadioName = boatTimeLSKey ? `boatTimeSlot_${storageKey.replace(/[^a-zA-Z0-9_-]/g, "_")}` : "";
    const getBoatTimeSlot = () => {
      if (!boatTimeLSKey) return "";
      return String(localStorage.getItem(boatTimeLSKey) || "").trim();
    };
    const setBoatTimeSlot = (v) => {
      if (!boatTimeLSKey) return;
      const s = String(v || "").trim();
      if (s) localStorage.setItem(boatTimeLSKey, s);
      else localStorage.removeItem(boatTimeLSKey);
    };
    const guideFee = Math.max(0, Number(guideFeePerPerson) || 0);
    const orderWalkingPartyMaxNum = Math.max(0, Math.min(200, Number(orderWalkingPartyMax) || 0));
    const walkingTourSlotMaxNum = Math.max(1, Math.min(200, Number(walkingTourSlotMax) || 15));
    const walkingTourTimePerOrderFlag =
      Boolean(walkingTourTimePerOrder) &&
      Array.isArray(walkingTourTimeSlots) &&
      walkingTourTimeSlots.length > 0 &&
      orderWalkingPartyMaxNum > 0 &&
      Boolean(orderLanguageRadioName);
    const walkingTourTimePopupRadioNameResolved = walkingTourTimePerOrderFlag
      ? String(
          walkingTourTimePopupRadioName ||
            `walkingTourTimePopup_${String(storageKey).replace(/[^a-zA-Z0-9_-]/g, "_")}`
        ).slice(0, 120)
      : "";
    const horseCfg =
      horsebackDepartureInPopup &&
      typeof horsebackDepartureInPopup === "object" &&
      String(horsebackDepartureInPopup.radioName || "").trim()
        ? {
            radioName: String(horsebackDepartureInPopup.radioName).trim().slice(0, 120),
            summaryLabelKey: String(
              horsebackDepartureInPopup.summaryLabelKey || "liebres_horseback_time_label"
            ).trim(),
            summaryDisplayValueKey: String(horsebackDepartureInPopup.summaryDisplayValueKey || "").trim()
          }
        : null;
    const horseSummaryDisplay = (storedTime) => {
      const raw = String(storedTime || "").trim();
      if (!raw) return "";
      if (horseCfg?.summaryDisplayValueKey) {
        return getI18nText(horseCfg.summaryDisplayValueKey, raw);
      }
      return raw;
    };
    const fixedSummaryRowsHtml = (placement) => {
      if (!Array.isArray(experienceFixedSummaryRows)) return "";
      return experienceFixedSummaryRows
        .filter((row) => (row.placement || "top") === placement)
        .map((row) => {
          const label = escapeHtml(getI18nText(row.labelKey, ""));
          if (row.valueKey) {
            return `<p><strong>${label}:</strong> ${escapeHtml(getI18nText(row.valueKey, ""))}</p>`;
          }
          return `<p><strong>${label}</strong></p>`;
        })
        .join("");
    };
    const fixedSummaryRowsWa = (placement) => {
      if (!Array.isArray(experienceFixedSummaryRows)) return "";
      return experienceFixedSummaryRows
        .filter((row) => (row.placement || "top") === placement)
        .map((row) => {
          const label = getI18nText(row.labelKey, "");
          if (row.valueKey) {
            return `\n${waLine(label, getI18nText(row.valueKey, ""))}`;
          }
          return `\n${label}`;
        })
        .join("");
    };
    const orderWalkingTourTime = (o) => String(o && o.walkingTourDepartureTime ? o.walkingTourDepartureTime : "").trim();
    const walkingPartyForOrder = (o) => {
      if (!orderWalkingPartyMaxNum || !orderLanguageRadioName) return 1;
      return Math.max(1, Math.min(orderWalkingPartyMaxNum, Math.floor(Number(o?.walkingPartyCount) || 1)));
    };
    const walkingPartySameTimeExcluding = (time, excludeIndex) => {
      if (!walkingTourTimePerOrderFlag) return 0;
      const ord = getOrders();
      let sum = 0;
      ord.forEach((o, j) => {
        if (excludeIndex != null && j === excludeIndex) return;
        if (!sameBoatDepartureTime(orderWalkingTourTime(o), time)) return;
        sum += walkingPartyForOrder(o);
      });
      return sum;
    };
    const maxWalkingPartyForOrderIndex = (index) => {
      if (!walkingTourTimePerOrderFlag) return orderWalkingPartyMaxNum;
      const ord = getOrders();
      const o = ord[index];
      if (!o) return orderWalkingPartyMaxNum;
      const tim = orderWalkingTourTime(o);
      if (!tim) return orderWalkingPartyMaxNum;
      const others = walkingPartySameTimeExcluding(tim, index);
      return Math.max(0, Math.min(orderWalkingPartyMaxNum, walkingTourSlotMaxNum - others));
    };
    const walkingTourSlotHasRoom = (time, walkingPartyCount, excludeIndex) => {
      if (!walkingTourTimePerOrderFlag) return true;
      const t = String(time || "").trim();
      if (!t) return true;
      const p = Math.max(1, Math.min(orderWalkingPartyMaxNum, Math.floor(Number(walkingPartyCount) || 1)));
      return walkingPartySameTimeExcluding(t, excludeIndex) + p <= walkingTourSlotMaxNum;
    };
    const vehicleTransportRate = Math.max(0, Number(transportPerVehicle) || 0);
    const getI18nText = (key, fallback) => {
      const lang = getSiteLanguage();
      const tr = sacramentoI18nTable();
      try {
        if (tr?.[lang]?.[key]) return tr[lang][key];
        if (tr?.en?.[key]) return tr.en[key];
      } catch {}
      return fallback;
    };
    const boatBookReady = () => {
      if (walkingTourTimePerOrderFlag) {
        const ordWt = getOrders();
        if (ordWt.length === 0) return true;
        for (let i = 0; i < ordWt.length; i++) {
          if (!String(ordWt[i]?.walkingTourDepartureTime || "").trim()) {
            alert(
              getI18nText(
                "walking_tour_time_each_required",
                "Each order needs a walking tour departure time. Edit the order to choose a time."
              )
            );
            return false;
          }
        }
        const totalsWalk = new Map();
        for (let i = 0; i < ordWt.length; i++) {
          const t = String(ordWt[i]?.walkingTourDepartureTime || "").trim();
          const p = walkingPartyForOrder(ordWt[i]);
          totalsWalk.set(t, (totalsWalk.get(t) || 0) + p);
        }
        for (const [, total] of totalsWalk) {
          if (total > walkingTourSlotMaxNum) {
            alert(
              getI18nText(
                "orders_boat_slot_over_capacity",
                "One departure time has more passengers than allowed. Please adjust bookings before continuing."
              )
            );
            return false;
          }
        }
      }
      if (horseCfg) {
        const ordH = getOrders();
        if (ordH.length === 0) return true;
        for (let i = 0; i < ordH.length; i++) {
          if (!String(ordH[i]?.horsebackDepartureTime || "").trim()) {
            alert(
              getI18nText(
                "liebres_horseback_time_each_required",
                "Each order needs a horseback departure time. Edit the order to choose a time."
              )
            );
            return false;
          }
        }
      }
      if (boatTimePerOrderFlag) {
        const ord = getOrders();
        if (ord.length === 0) return true;
        if (menuWithPerOrderBoat) {
          for (let i = 0; i < ord.length; i++) {
            const p = orderBoatPax(ord[i]);
            if (p > 0 && !String(ord[i]?.boatDepartureTime || "").trim()) {
              alert(
                getI18nText(
                  "orders_boat_menu_time_required",
                  "Each order with boat passengers needs a departure time. Edit that order to choose a time."
                )
              );
              return false;
            }
          }
          const totalsByTime = new Map();
          for (let i = 0; i < ord.length; i++) {
            const p = orderBoatPax(ord[i]);
            if (p <= 0) continue;
            const t = String(ord[i]?.boatDepartureTime || "").trim();
            totalsByTime.set(t, (totalsByTime.get(t) || 0) + p);
          }
          for (const [, total] of totalsByTime) {
            if (total > boatMax) {
              alert(
                getI18nText(
                  "orders_boat_slot_over_capacity",
                  "One departure time has more passengers than allowed. Please adjust bookings before continuing."
                )
              );
              return false;
            }
          }
          return true;
        }
        for (let i = 0; i < ord.length; i++) {
          if (!String(ord[i]?.boatDepartureTime || "").trim()) {
            alert(
              getI18nText(
                "orders_boat_time_each_required",
                "Each booking must have a boat departure time. Please edit the booking missing a time."
              )
            );
            return false;
          }
        }
        const totalsByTime = new Map();
        for (let i = 0; i < ord.length; i++) {
          const t = String(ord[i]?.boatDepartureTime || "").trim();
          const p = Math.max(1, Math.min(boatMax, Math.floor(Number(ord[i]?.passengers) || 1)));
          totalsByTime.set(t, (totalsByTime.get(t) || 0) + p);
        }
        for (const [, total] of totalsByTime) {
          if (total > boatMax) {
            alert(
              getI18nText(
                "orders_boat_slot_over_capacity",
                "One departure time has more passengers than allowed. Please adjust bookings before continuing."
              )
            );
            return false;
          }
        }
        return true;
      }
      if (!boatTimeLSKey) return true;
      if (boatScheduleOnlyFlag) {
        if (getOrders().length === 0) return true;
        if (!getBoatTimeSlot()) {
          alert(
            getI18nText(
              "orders_boat_time_required",
              "Please choose a boat departure time."
            )
          );
          return false;
        }
        return true;
      }
      if (getBoatPassengers() <= 0) return true;
      if (!getBoatTimeSlot()) {
        alert(
          getI18nText(
            "orders_boat_time_required",
            "Please choose a boat departure time."
          )
        );
        return false;
      }
      return true;
    };
    const I18N_PREF_PREFIX = SACRAMENTO_I18N_PREF;
    const encodePref = (keyOrLabel) => {
      const raw = String(keyOrLabel || "").trim();
      if (!raw) return "";
      return raw.startsWith(I18N_PREF_PREFIX) ? raw : `${I18N_PREF_PREFIX}${raw}`;
    };
    const decodePref = (storedPref) => sacramentoDecodePrefLabel(storedPref, getI18nText, I18N_PREF_PREFIX);
    const decoratePref = (storedPref) => sacramentoDecoratePref(storedPref, getI18nText, I18N_PREF_PREFIX);

    const escapeHtml = (str) =>
      String(str).replace(/[&<>"']/g, (m) => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
      }[m]));

    const getOrders = () => {
      try {
        const parsed = JSON.parse(localStorage.getItem(storageKey)) || [];
        if (!Array.isArray(parsed)) return [];
        let mutated = false;
        const migrated = parsed.map((order) => {
          if (!order || !Array.isArray(order.preferences)) return order;
          const nextPrefs = order.preferences.map((pref) => {
            const raw = String(pref || "").trim();
            if (!raw) return raw;
            if (raw.startsWith(I18N_PREF_PREFIX)) return raw;
            const legacyKey = sacramentoLegacyPrefKey(raw);
            if (!legacyKey) return raw;
            mutated = true;
            return encodePref(legacyKey);
          });
          return { ...order, preferences: nextPrefs };
        });
        if (mutated) {
          localStorage.setItem(storageKey, JSON.stringify(migrated));
        }
        return migrated;
      } catch {
        return [];
      }
    };

    const setOrders = (orders) => {
      localStorage.setItem(storageKey, JSON.stringify(orders));
    };

    const getTotalBoatPassengersPaid = () => {
      if (!boatRate) return 0;
      if (boatTimePerOrderFlag) {
        return getOrders().reduce((s, o) => s + orderBoatPax(o), 0);
      }
      return getBoatPassengers();
    };

    const getTotalBoatPassengersForMin = () => {
      if (boatTimePerOrderFlag) {
        return getOrders().reduce((s, o) => s + orderBoatPax(o), 0);
      }
      if (boatLSKey) return getBoatPassengers();
      return 0;
    };

    const totalBoatPaxWithChange = (orderIndex, newPax) =>
      getOrders().reduce((s, o, j) => s + (j === orderIndex ? newPax : orderBoatPax(o)), 0);

    const minusWouldViolateBoatMin = (orderIndex, newPax) =>
      boatMin > 0 && totalBoatPaxWithChange(orderIndex, newPax) < boatMin;

    const alertBoatMinPassengers = () => {
      alert(
        getI18nText(
          "orders_boat_min_passengers",
          "This experience requires at least {min} passengers on the boat."
        ).replace(/\{min\}/g, String(boatMin))
      );
    };

    const assertBoatMinimumPassengers = () => {
      if (boatMin <= 0) return true;
      if (getOrders().length === 0) return true;
      if (getTotalBoatPassengersForMin() < boatMin) {
        alertBoatMinPassengers();
        return false;
      }
      return true;
    };

    const alertMinOrders = () => {
      alert(
        getI18nText(
          "orders_min_orders_alert",
          "This experience requires at least {min} people — add one menu per person before reserving."
        ).replace(/\{min\}/g, String(minOrdersNum))
      );
    };

    const assertMinOrders = () => {
      if (minOrdersNum <= 0) return true;
      if (getOrders().length < minOrdersNum) {
        alertMinOrders();
        return false;
      }
      return true;
    };

    const peopleCountForPayment = (ordersArr) => {
      if (boatTimePerOrderFlag && experienceSkipsMenuChoices) {
        return ordersArr.reduce((s, o) => s + orderBoatPax(o), 0);
      }
      if (orderWalkingPartyMaxNum > 0 && orderLanguageRadioName) {
        return ordersArr.reduce((s, o) => s + walkingPartyForOrder(o), 0);
      }
      if (rb) {
        const g = calculateGuestsFromRooms();
        if (g > 0) return g;
      }
      return ordersArr.length;
    };

    const buildBoatTimesPayload = (ordersArr) => {
      if (!boatTimePerOrderFlag) return getBoatTimeSlot();
      if (menuWithPerOrderBoat) {
        return ordersArr.map((o) => ({
          time: orderBoatTime(o),
          passengers: orderBoatPax(o),
          menuTier: o && o.menuTier ? o.menuTier : null
        }));
      }
      return ordersArr.map((o) => ({
        time: o && o.boatDepartureTime,
        passengers: Math.max(1, Math.min(boatMax, Math.floor(Number(o && o.passengers) || 1)))
      }));
    };

    const sameBoatDepartureTime = (a, b) => {
      const ta = String(a || "").trim();
      const tb = String(b || "").trim();
      return Boolean(ta) && ta === tb;
    };

    /** Passengers on other orders with the same departure time (`excludeIndex` skips that row, e.g. while editing). */
    const passengersSameTimeExcluding = (time, excludeIndex) => {
      if (!boatTimePerOrderFlag) return 0;
      const ord = getOrders();
      let sum = 0;
      ord.forEach((o, j) => {
        if (excludeIndex != null && j === excludeIndex) return;
        if (!sameBoatDepartureTime(o?.boatDepartureTime, time)) return;
        sum += orderBoatPax(o);
      });
      return sum;
    };

    /** Remaining seats this booking can use for that time (0 = full for new passengers). */
    const maxPassengersForOrderIndex = (index) => {
      if (!boatTimePerOrderFlag) return boatMax;
      const ord = getOrders();
      const o = ord[index];
      if (!o) return boatMax;
      const t = orderBoatTime(o);
      if (!t) return boatMax;
      return Math.max(0, boatMax - passengersSameTimeExcluding(t, index));
    };

    const boatTimeSlotHasRoom = (time, passengers, excludeIndex) => {
      if (!boatTimePerOrderFlag) return true;
      const t = String(time || "").trim();
      if (!t) return true;
      const raw = Math.floor(Number(passengers) || 0);
      const p = experienceSkipsMenuChoices
        ? Math.max(1, Math.min(boatMax, raw || 1))
        : Math.max(0, Math.min(boatMax, raw));
      if (!experienceSkipsMenuChoices && p === 0) return true;
      return passengersSameTimeExcluding(t, excludeIndex) + p <= boatMax;
    };

    /** One-time: migrate global boat time / passenger counter into per-order fields. */
    (() => {
      if (!Boolean(config?.boatTimePerOrder) || !Array.isArray(boatTimeSlots) || boatTimeSlots.length === 0) return;
      const legacyTimeKey = `${storageKey}_boatTime`;
      const legacyPaxKey = `${storageKey}_boatPassengers`;
      const legacyT = String(localStorage.getItem(legacyTimeKey) || "").trim();
      const legacyRn = parseInt(localStorage.getItem(legacyPaxKey), 10);
      const legacyBn = Number.isFinite(legacyRn) ? Math.max(0, Math.min(boatMax, legacyRn)) : 0;
      if (!legacyT && !legacyBn) return;
      let ord;
      try {
        ord = JSON.parse(localStorage.getItem(storageKey)) || [];
      } catch {
        return;
      }
      if (!Array.isArray(ord) || ord.length === 0) return;

      if (Boolean(config?.experienceSkipsMenuChoices)) {
        if (!legacyT) return;
        let changed = false;
        const next = ord.map((o) => {
          if (o && !String(o.boatDepartureTime || "").trim()) {
            changed = true;
            return {
              ...o,
              boatDepartureTime: legacyT,
              passengers: Math.max(1, Math.min(boatMax, Math.floor(Number(o.passengers) || 1)))
            };
          }
          return o;
        });
        if (changed) {
          localStorage.setItem(storageKey, JSON.stringify(next));
          localStorage.removeItem(legacyTimeKey);
          localStorage.removeItem(legacyPaxKey);
        }
        return;
      }

      if (boatRate > 0) {
        let changed = false;
        const next = ord.map((o, i) => {
          if (!o || i !== 0) return o;
          const hasBoat =
            Boolean(String(o.boatDepartureTime || "").trim()) || Math.floor(Number(o.boatPassengers) || 0) > 0;
          if (hasBoat) return o;
          changed = true;
          const t = legacyT || "";
          const bp = legacyBn > 0 ? legacyBn : legacyT ? 1 : 0;
          return {
            ...o,
            boatDepartureTime: t,
            boatPassengers: Math.min(boatMax, bp)
          };
        });
        if (changed) {
          localStorage.setItem(storageKey, JSON.stringify(next));
          localStorage.removeItem(legacyTimeKey);
          localStorage.removeItem(legacyPaxKey);
        }
      }
    })();

    const formatDate = (d) =>
      d.toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric"
      });

    const getDateForBooking = () => {
      const stored = selectedDateKey ? localStorage.getItem(selectedDateKey) : null;
      if (stored && /^\d{4}-\d{2}-\d{2}$/.test(stored)) {
        const [y, m, d] = stored.split("-").map(Number);
        const parsed = new Date(y, m - 1, d);
        if (!Number.isNaN(parsed.getTime())) return formatDate(parsed);
      }
      if (stored) return stored;
      return formatDate(new Date());
    };
    const buildChoiceLookup = (fieldName) => {
      const map = new Map();
      const radios = popup.querySelectorAll(`input[name="${fieldName}"]`);
      radios.forEach((input) => {
        const value = input.value || "";
        const span = input.nextElementSibling;
        const labelText = span?.textContent?.trim() || value;
        const key = span?.dataset?.translate;
        const translated = key ? getI18nText(key, labelText) : labelText;
        if (value) map.set(value, translated);
        if (labelText) map.set(labelText, translated);
        const legacyRaw = input.dataset?.legacyValues;
        if (legacyRaw) {
          legacyRaw.split("|").forEach((legacy) => {
            const t = String(legacy).trim();
            if (t) map.set(t, translated);
          });
        }
      });
      if (fieldName === "josefina_main" && popup) {
        [
          "josefina_chivito_protein",
          "josefina_sorrentino_sauce",
          "josefina_fish_garnish"
        ].forEach((subName) => {
          popup.querySelectorAll(`input[name="${subName}"]`).forEach((input) => {
            const value = String(input.dataset.josefinaMainValue || "").trim();
            const sumKey = input.dataset.translateSummaryKey;
            if (!value || !sumKey) return;
            map.set(value, getI18nText(sumKey, value));
          });
        });
      }
      return map;
    };
    const getSecondaryFieldName = (fieldName) => {
      if (!premiumChoiceFieldNames) return null;
      if (fieldName === starterName) return premiumChoiceFieldNames.starter;
      if (fieldName === mainName) return premiumChoiceFieldNames.main;
      if (fieldName === drinkName) return premiumChoiceFieldNames.drink;
      return null;
    };
    const beverageFieldNameForTier = (tierPremium) => {
      if (tierPremium && premiumChoiceFieldNames?.beverage) return premiumChoiceFieldNames.beverage;
      return beverageName || null;
    };

    const getLocalizedChoice = (fieldName, storedValue) => {
      const text = String(storedValue || "").trim();
      if (!text) return "-";
      const primary = buildChoiceLookup(fieldName);
      if (primary.has(text)) return primary.get(text);
      const secondary = getSecondaryFieldName(fieldName);
      if (secondary) {
        const alt = buildChoiceLookup(secondary);
        if (alt.has(text)) return alt.get(text);
      }
      if (standardSideCheckboxName) {
        const sideMap = buildChoiceLookup(standardSideCheckboxName);
        if (sideMap.has(text)) return sideMap.get(text);
      }
      if (premiumSideCheckboxName) {
        const sideMapPrm = buildChoiceLookup(premiumSideCheckboxName);
        if (sideMapPrm.has(text)) return sideMapPrm.get(text);
      }
      return text;
    };

    const optionalGuideEl = () =>
      optionalGuideCheckboxId ? document.getElementById(optionalGuideCheckboxId) : null;

    const groupGuideEl = () =>
      groupGuideCheckboxId ? document.getElementById(groupGuideCheckboxId) : null;

    const groupGuideStorageKey = `${storageKey}_groupGuide`;

    const getGroupGuideStored = () => localStorage.getItem(groupGuideStorageKey) === "1";

    const setGroupGuideStored = (on) => {
      if (on) localStorage.setItem(groupGuideStorageKey, "1");
      else localStorage.removeItem(groupGuideStorageKey);
    };

    const groupGuideFlat = Math.max(0, Number(groupGuideFlatFee) || 0);

    /** One flat fee for the entire group when checkbox is checked and there is at least one order. */
    const groupGuideAmount = () => {
      if (!groupGuideOptional || groupGuideFlat <= 0) return 0;
      const orders = getOrders();
      if (orders.length === 0) return 0;
      const el = groupGuideEl();
      return el && el.checked ? groupGuideFlat : 0;
    };

    const syncGroupGuideWrap = () => {
      const wrapId = groupGuideWrapId || (groupGuideCheckboxId ? `${groupGuideCheckboxId}Wrap` : null);
      const wrap = wrapId ? document.getElementById(wrapId) : null;
      if (wrap) {
        wrap.style.display = getOrders().length > 0 ? "" : "none";
      }
    };

    const guestExperienceTotal = (o) => {
      let unit = Number(pricePerPerson) || 0;
      if (expPkg && o && o.packageId) {
        const pkg = getPackageDef(o.packageId);
        if (pkg) {
          unit = Number(pkg.price) || 0;
          if (o.includeTour && pkg.tourAddon) {
            unit += Number(pkg.tourAddon.price) || 0;
          }
        }
      } else if (menuUpgradePrice != null && o && o.menuTier === "premium") {
        unit = Number(menuUpgradePrice) || unit;
      }
      let mult = 1;
      if (boatTimePerOrderFlag && experienceSkipsMenuChoices && o) {
        mult = Math.max(1, Math.min(boatMax, Math.floor(Number(o.passengers) || 1)));
      }
      let base = unit * mult;
      if (groupGuideOptional) {
        return base;
      }
      if (guideOptional) {
        return base + (o && o.includeGuide ? guideFee : 0);
      }
      if (guideFee > 0 && orderWalkingPartyMaxNum > 0 && orderLanguageRadioName) {
        return base + guideFee * walkingPartyForOrder(o);
      }
      return base + guideFee;
    };

    const groupExperienceSubtotal = (orders) => {
      if (!experienceMenuFlatTotal || menuUpgradePrice == null) {
        return orders.reduce((s, o) => s + guestExperienceTotal(o), 0);
      }
      if (!orders.length) return 0;
      const std = Number(pricePerPerson) || 0;
      const prem = Number(menuUpgradePrice) || std;
      const anyPremium = orders.some((o) => o && o.menuTier === "premium");
      return anyPremium ? prem : std;
    };

    const calculateTotalGuests = () => {
      if (rb) return calculateGuestsFromRooms();
      return peopleCountForPayment(getOrders());
    };

    const calculateFinalPrice = (ordersArg) => {
      const list = Array.isArray(ordersArg) ? ordersArg : getOrders();
      const menuSub = groupExperienceSubtotal(list);
      const ggAmt = groupGuideAmount();
      const pc = peopleCountForPayment(list);
      const transportTot =
        vehicleTransportRate > 0 ? groupPrivateTransportTotal(pc, vehicleTransportRate) : 0;
      const boatTot = boatRate > 0 ? getTotalBoatPassengersPaid() * boatRate : 0;
      const roomsTot = calculateTotalRoomCost();
      return menuSub + ggAmt + transportTot + boatTot + roomsTot;
    };

    const canOpenAnotherMenu = () => {
      if (!rb) return true;
      const need = calculateGuestsFromRooms();
      if (need <= 0) {
        alert(getI18nText("orders_room_configure_first", "Configure your rooms first."));
        return false;
      }
      if (getOrders().length >= need) {
        alert(
          getI18nText(
            "orders_room_all_menus",
            "You already have one menu per guest. Edit or remove an order to change selections."
          )
        );
        return false;
      }
      return true;
    };

    const experienceBookReady = () => {
      if (!boatBookReady()) return false;
      if (!assertBoatMinimumPassengers()) return false;
      if (!assertMinOrders()) return false;
      if (
        visitTimeApi &&
        typeof visitTimeApi.assertReady === "function" &&
        !visitTimeApi.assertReady()
      ) {
        return false;
      }
      if (!rb) return true;
      const need = calculateGuestsFromRooms();
      if (need <= 0) {
        alert(getI18nText("orders_room_configure_first", "Configure your rooms first."));
        return false;
      }
      if (getOrders().length !== need) {
        alert(
          getI18nText(
            "orders_room_one_menu_each",
            "Add exactly one menu per guest before reserving (see Your order)."
          )
        );
        return false;
      }
      return true;
    };

    const popup = document.getElementById(popupId);
    const closeBtn = document.getElementById(closeBtnId);
    const saveBtn = document.getElementById(saveBtnId);
    const createBtn = document.getElementById(createBtnId);
    const container = document.getElementById(orderSummaryId);

    if (!popup || !closeBtn || !saveBtn || !createBtn || !container) return;

    const renderRoomBookingPanel = () => {
      if (!rb || !rbHost) return;
      ensureDefaultRooms();
      const rows = getRoomRows();
      const opts = occupancyOptsResolved();
      const maxRooms = Math.max(1, Math.min(20, Math.floor(Number(rb.maxRooms) || 8)));
      const minRooms = Math.max(1, Math.min(maxRooms, Math.floor(Number(rb.minRooms) || 1)));
      const defOcc = defaultOccResolved();

      let inner = `<h3>${escapeHtml(getI18nText("orders_room_block_title", "Rooms"))}</h3>`;
      if (rb.availabilityNoticeKey) {
        inner += `<p class="mision-room-availability-notice">${escapeHtml(
          getI18nText(
            rb.availabilityNoticeKey,
            "Please check availability with us on WhatsApp before completing your reservation."
          )
        )}</p>`;
      }
      inner += `<div class="room-booking-rows">`;
      rows.forEach((row, idx) => {
        const g = Math.max(1, row.guests || defOcc);
        const price = Number(rb.priceByOccupancy[String(g)]);
        const priceShow = Number.isFinite(price) ? price : 0;
        inner += `<div class="booking-visit-date-row room-booking-row" data-room-idx="${idx}">`;
        const roomWord = escapeHtml(getI18nText("orders_room_label", "Room"));
        inner += `<span class="room-booking-room-label"><span class="room-booking-room-word">${roomWord}</span><span class="room-booking-room-num">${idx + 1}</span></span>`;
        inner += `<label class="room-booking-guests-label">${escapeHtml(
          getI18nText("orders_room_guests_label", "Guests")
        )} <select class="room-booking-select" data-room-guests="${idx}" aria-label="${escapeHtml(
          getI18nText("orders_room_guests_label", "Guests")
        )}">`;
        opts.forEach((o) => {
          inner += `<option value="${o}"${o === g ? " selected" : ""}>${o}</option>`;
        });
        inner += `</select></label>`;
        inner += `<span class="room-row-price">${escapeHtml(curLabel)} ${priceShow}</span>`;
        if (rows.length > minRooms) {
          inner += `<button type="button" class="btn secondary room-remove-btn" data-room-remove="${idx}" aria-label="${escapeHtml(
            getI18nText("orders_room_remove", "Remove room")
          )}">×</button>`;
        }
        inner += `</div>`;
      });
      inner += `</div>`;
      if (rows.length < maxRooms) {
        inner += `<button type="button" class="btn primary-btn room-add-btn">+ ${escapeHtml(
          getI18nText("orders_room_add", "Add room")
        )}</button>`;
      }
      const tg = calculateGuestsFromRooms();
      const totalRoom = calculateTotalRoomCost();
      inner += `<p class="room-booking-foot">${escapeHtml(
        getI18nText("orders_room_guests_total", "Total guests")
      )}: <strong>${tg}</strong> · ${escapeHtml(getI18nText("orders_rooms_subtotal", "Rooms subtotal"))}: ${escapeHtml(
        curLabel
      )} <strong>${totalRoom}</strong></p>`;
      inner += `<p class="booking-visit-date-hint room-booking-hint">${escapeHtml(
        getI18nText("orders_room_summary_hint", "Create one menu per guest in the order summary below.")
      )}</p>`;
      rbHost.innerHTML = inner;
    };

    let roomBookingEventsBound = false;
    const bindRoomBookingEventsOnce = () => {
      if (!rb || !rbHost || roomBookingEventsBound) return;
      roomBookingEventsBound = true;
      rbHost.addEventListener("change", (e) => {
        const sel = e.target && e.target.closest && e.target.closest("select[data-room-guests]");
        if (!sel) return;
        const idx = Number(sel.getAttribute("data-room-guests"));
        const val = Math.max(1, Math.floor(Number(sel.value) || 1));
        const rows = getRoomRows().map((r) => ({ ...r }));
        if (!rows[idx]) return;
        rows[idx] = { guests: val };
        const nextG = sacramentoCalculateGuestsFromRooms(rows);
        if (nextG < getOrders().length) {
          alert(
            getI18nText(
              "orders_room_reduce_blocked",
              "Remove or edit menu orders first before lowering the guest count."
            )
          );
          renderRoomBookingPanel();
          return;
        }
        setRoomRows(rows);
        renderRoomBookingPanel();
        renderOrders();
      });
      rbHost.addEventListener("click", (e) => {
        const add = e.target.closest && e.target.closest(".room-add-btn");
        if (add) {
          e.preventDefault();
          const maxR = Math.max(1, Math.min(20, Math.floor(Number(rb.maxRooms) || 8)));
          const rows = [...getRoomRows(), { guests: defaultOccResolved() }];
          if (rows.length > maxR) return;
          setRoomRows(rows);
          renderRoomBookingPanel();
          renderOrders();
          return;
        }
        const rm = e.target.closest && e.target.closest("[data-room-remove]");
        if (rm) {
          e.preventDefault();
          const idx = Number(rm.getAttribute("data-room-remove"));
          const rows = getRoomRows().filter((_, j) => j !== idx);
          const minR = Math.max(1, Math.min(20, Math.floor(Number(rb.minRooms) || 1)));
          if (rows.length < minR) return;
          const nextG = sacramentoCalculateGuestsFromRooms(rows);
          if (nextG < getOrders().length) {
            alert(
              getI18nText(
                "orders_room_reduce_blocked",
                "Remove or edit menu orders first before removing capacity."
              )
            );
            return;
          }
          setRoomRows(rows);
          renderRoomBookingPanel();
          renderOrders();
        }
      });
    };

    if (rb && rbHost) {
      bindRoomBookingEventsOnce();
      renderRoomBookingPanel();
      const storedOrders = getOrders();
      if (storedOrders.length) {
        renumberRoomGuestIds(storedOrders);
        setOrders(storedOrders);
      }
    }

    const syncMenuTierPanels = (standardSelected) => {
      if (!menuTierPanelIds?.standard || !menuTierPanelIds?.premium) return;
      const stdEl = document.getElementById(menuTierPanelIds.standard);
      const prmEl = document.getElementById(menuTierPanelIds.premium);
      if (!stdEl || !prmEl) return;
      stdEl.hidden = !standardSelected;
      prmEl.hidden = standardSelected;
      stdEl.querySelectorAll("input").forEach((i) => {
        i.disabled = !standardSelected;
      });
      prmEl.querySelectorAll("input").forEach((i) => {
        i.disabled = standardSelected;
      });
    };

    /** Si un grupo (starter/main/drink) tiene una sola opción, queda marcada tras limpiar el popup. */
    const recheckLoneRadios = () => {
      const check = (name) => {
        const radios = popup.querySelectorAll(`input[name="${name}"]`);
        if (radios.length === 1) radios[0].checked = true;
      };
      [starterName, mainName, drinkName].forEach(check);
      if (beverageName) check(beverageName);
      if (premiumChoiceFieldNames) {
        [premiumChoiceFieldNames.starter, premiumChoiceFieldNames.main, premiumChoiceFieldNames.drink].forEach(
          check
        );
        if (premiumChoiceFieldNames.beverage) check(premiumChoiceFieldNames.beverage);
      }
      if (boatTimePopupRadioNameResolved) check(boatTimePopupRadioNameResolved);
      if (walkingTourTimePopupRadioNameResolved) check(walkingTourTimePopupRadioNameResolved);
      if (horseCfg) check(horseCfg.radioName);
    };

    const ensureDefaultMenuRadios = () => {
      if (!popup) return;
      const pickFirst = (name) => {
        if (!name) return;
        const radios = popup.querySelectorAll(`input[name="${name}"]`);
        if (!radios.length) return;
        if (!Array.from(radios).some((r) => r.checked)) radios[0].checked = true;
      };
      pickFirst(starterName);
      pickFirst(mainName);
      pickFirst(drinkName);
      if (beverageName) pickFirst(beverageName);
    };

    function openPopupForNewOrder() {
      popup.classList.add("active");
      popup.querySelectorAll('input[type="radio"]').forEach((i) => {
        if (menuTierRadioName && i.name === menuTierRadioName) return;
        if (expPkg && i.name === expPkg.radioName) return;
        i.checked = false;
      });
      if (orderLanguageRadioName) {
        popup.querySelectorAll(`input[name="${orderLanguageRadioName}"]`).forEach((r) => {
          r.checked = false;
        });
        const defLang =
          popup.querySelector(`input[name="${orderLanguageRadioName}"][value="English guide"]`) ||
          popup.querySelector(`input[name="${orderLanguageRadioName}"]`);
        if (defLang) defLang.checked = true;
      }
      if (standardSideCheckboxName) {
        popup.querySelectorAll(`input[name="${standardSideCheckboxName}"]`).forEach((i) => (i.checked = false));
      }
      if (premiumSideCheckboxName) {
        popup.querySelectorAll(`input[name="${premiumSideCheckboxName}"]`).forEach((i) => (i.checked = false));
      }
      if (menuUpgradePrice && menuTierRadioName) {
        const std = popup.querySelector(`input[name="${menuTierRadioName}"][value="standard"]`);
        if (std) std.checked = true;
        syncMenuTierPanels(true);
      }
      popup.querySelectorAll('.preferences-inside input[type="checkbox"]').forEach((i) => (i.checked = false));
      const og = optionalGuideEl();
      if (og && !groupGuideOptional) og.checked = false;
      editingIndex = null;
      saveBtn.textContent = getI18nText("save_selection", "Save selection");
      recheckLoneRadios();
      if (horseCfg) {
        popup.querySelectorAll(`input[name="${horseCfg.radioName}"]`).forEach((r) => {
          r.checked = false;
        });
        const defHorse =
          popup.querySelector(`input[name="${horseCfg.radioName}"][value="13:30"]`) ||
          popup.querySelector(`input[name="${horseCfg.radioName}"][value="11:00"]`) ||
          popup.querySelector(`input[name="${horseCfg.radioName}"]`);
        if (defHorse) defHorse.checked = true;
      }
      if (typeof afterOpenPopupForNewOrder === "function") {
        try {
          afterOpenPopupForNewOrder();
        } catch (err) {
          console.error(err);
        }
      }
      if (expPkg) {
        const firstRadio = popup.querySelector(`input[name="${expPkg.radioName}"]`);
        if (firstRadio) firstRadio.checked = true;
        resetPackageTourCheckboxes();
        showPackagePopupStep("packages");
      }
    }

    if (createBtn && popup && saveBtn) {
      createBtn.addEventListener("click", () => {
        if (!canOpenAnotherMenu()) return;
        openPopupForNewOrder();
      });
    }

    if (menuUpgradePrice && menuTierRadioName && popup) {
      popup.addEventListener("change", (e) => {
        const t = e.target;
        if (t && t.name === menuTierRadioName) {
          syncMenuTierPanels(t.value === "standard");
        }
      });
    }

    if (popup && standardSideCheckboxName) {
      popup.addEventListener("change", (e) => {
        const t = e.target;
        if (!t || t.name !== standardSideCheckboxName || !t.checked) return;
        popup.querySelectorAll(`input[name="${standardSideCheckboxName}"]`).forEach((c) => {
          if (c !== t) c.checked = false;
        });
      });
    }

    if (popup && premiumSideCheckboxName) {
      popup.addEventListener("change", (e) => {
        const t = e.target;
        if (!t || t.name !== premiumSideCheckboxName || !t.checked) return;
        const checked = popup.querySelectorAll(`input[name="${premiumSideCheckboxName}"]:checked`);
        if (checked.length > 2) t.checked = false;
      });
    }

    if (closeBtn) {
      closeBtn.addEventListener("click", () => popup.classList.remove("active"));
    }

    if (expPkg) {
      const nextBtn = expPkg.nextBtnId ? document.getElementById(expPkg.nextBtnId) : null;
      const backBtn = expPkg.backBtnId ? document.getElementById(expPkg.backBtnId) : null;
      if (nextBtn) {
        nextBtn.addEventListener("click", () => {
          const pkg = getPackageDef(readSelectedPackageId());
          if (!pkg || !pkg.requiresMenu) return;
          showPackagePopupStep("menu");
        });
      }
      if (backBtn) {
        backBtn.addEventListener("click", () => showPackagePopupStep("packages"));
      }
      popup.addEventListener("change", (e) => {
        const t = e.target;
        if (t && t.name === expPkg.radioName) {
          syncPackageActionButtons();
        }
      });
    }

    if (saveBtn) {
      saveBtn.addEventListener("click", () => {
        const orders = getOrders();

        if (expPkg) {
          const pid = readSelectedPackageId();
          const pkg = getPackageDef(pid);
          if (!pid || !pkg) {
            alert(
              getI18nText(
                "orders_alert_select_package",
                "Please choose an experience option."
              )
            );
            return;
          }
          if (pkg.requiresMenu && expPkgActiveStep !== "menu") {
            alert(
              getI18nText(
                "quinton_alert_use_next",
                "Tap Next to build your paired lunch menu."
              )
            );
            return;
          }
          if (!pkg.requiresMenu) {
            saveFixedPackageOrder(orders, pid, pkg);
            return;
          }
        }

        if (experienceSkipsMenuChoices) {
          const preferences = Array.from(
            popup.querySelectorAll('.preferences-inside input[type="checkbox"]:checked')
          ).map((el) => (el.value || el.parentElement.textContent.trim()));
          const og = optionalGuideEl();
          const includeGuide = guideOptional && !groupGuideOptional && og ? Boolean(og.checked) : false;
          let boatDepartureTime = "";
          if (boatTimePerOrderFlag && boatTimePopupRadioNameResolved) {
            const sel = popup.querySelector(`input[name="${boatTimePopupRadioNameResolved}"]:checked`);
            boatDepartureTime = sel ? String(sel.value || "").trim() : "";
            if (!boatDepartureTime) {
              alert(
                getI18nText(
                  "orders_boat_time_popup_required",
                  "Please choose a boat departure time."
                )
              );
              return;
            }
          }
          const existingPassengers =
            editingIndex !== null && orders[editingIndex]
              ? Math.max(1, Math.min(boatMax, Math.floor(Number(orders[editingIndex].passengers) || 1)))
              : orders.length === 0 && boatMin > 0
                ? Math.min(boatMax, boatMin)
                : 1;
          const order = {
            starter: "",
            main: "",
            drink: "",
            preferences,
            ...(boatTimePerOrderFlag
              ? { boatDepartureTime, passengers: existingPassengers }
              : {}),
            ...(guideOptional && !groupGuideOptional ? { includeGuide } : {}),
            ...(rb
              ? {
                  guestId:
                    editingIndex !== null
                      ? String((orders[editingIndex] && orders[editingIndex].guestId) || String(editingIndex + 1))
                      : String(orders.length + 1)
                }
              : {})
          };
          if (
            boatTimePerOrderFlag &&
            boatDepartureTime &&
            !boatTimeSlotHasRoom(boatDepartureTime, existingPassengers, editingIndex)
          ) {
            alert(
              getI18nText(
                "orders_boat_slot_full",
                "This departure time already has the maximum number of passengers. Choose another time or reduce passengers in another booking."
              )
            );
            return;
          }
          if (editingIndex !== null) {
            orders[editingIndex] = order;
            editingIndex = null;
          } else {
            orders.push(order);
          }
          setOrders(renumberRoomGuestIds(orders));
          document.getElementById(popupId)?.classList.remove("active");
          if (typeof window.renderOrders === "function") {
            window.renderOrders();
          }
          scrollToOrderSummary(orderSummaryId);
          return;
        }

        const tierPremium =
          menuUpgradePrice &&
          menuTierRadioName &&
          popup.querySelector(`input[name="${menuTierRadioName}"]:checked`)?.value === "premium";

        const skipMainStandard =
          Boolean(standardSkipsMainField && menuUpgradePrice && !tierPremium);

        const useStdSidesCb =
          Boolean(standardSideCheckboxName && menuUpgradePrice && !tierPremium);
        const usePrmSidesCb =
          Boolean(premiumSideCheckboxName && menuUpgradePrice && tierPremium);

        let starterText = "";
        let mainText = "";
        let drinkText = "";
        let beverageText = "";

        if (usePrmSidesCb) {
          const sides = Array.from(
            popup.querySelectorAll(`input[name="${premiumSideCheckboxName}"]:checked`)
          );
          if (sides.length < 1 || sides.length > 2) {
            alert(
              getI18nText(
                "orders_alert_sides_premium_range",
                "Premium: choose 1 or 2 side dishes."
              )
            );
            return;
          }
          starterText =
            sides[0].value || sides[0].nextElementSibling?.textContent?.trim() || "";
          mainText =
            sides.length === 2
              ? sides[1].value || sides[1].nextElementSibling?.textContent?.trim() || ""
              : "";
          if (
            premiumRequireDistinctSides &&
            sides.length === 2 &&
            String(starterText).trim() === String(mainText).trim()
          ) {
            alert(
              getI18nText(
                "orders_alert_distinct_sides",
                "Please choose two different side dishes for Premium."
              )
            );
            return;
          }
          drinkText = "";
        } else if (useStdSidesCb) {
          const sides = Array.from(
            popup.querySelectorAll(`input[name="${standardSideCheckboxName}"]:checked`)
          );
          if (sides.length !== 1) {
            alert(
              getI18nText(
                "orders_alert_sides_standard_one",
                "Standard: choose exactly 1 side dish."
              )
            );
            return;
          }
          starterText =
            sides[0].value || sides[0].nextElementSibling?.textContent?.trim() || "";
          mainText =
            standardMainPlaceholder === undefined || standardMainPlaceholder === null
              ? ""
              : String(standardMainPlaceholder);
          drinkText = "";
        } else {
          let starter;
          let main;
          let drink;

          if (tierPremium && premiumChoiceFieldNames) {
            starter = popup.querySelector(`input[name="${premiumChoiceFieldNames.starter}"]:checked`);
            main = popup.querySelector(`input[name="${premiumChoiceFieldNames.main}"]:checked`);
            drink = popup.querySelector(`input[name="${premiumChoiceFieldNames.drink}"]:checked`);
          } else {
            starter = popup.querySelector(`input[name="${starterName}"]:checked`);
            main = popup.querySelector(`input[name="${mainName}"]:checked`);
            drink = popup.querySelector(`input[name="${drinkName}"]:checked`);
          }

          if (
            (!experienceSkipsStarterField && !starter) ||
            (!experienceSkipsDrinkField && !drink) ||
            (!skipMainStandard && !main)
          ) {
            alert(getI18nText("orders_alert_select_each", "Please select one option from each category"));
            return;
          }

          starterText = experienceSkipsStarterField
            ? ""
            : starter.value || starter.nextElementSibling?.textContent?.trim();
          mainText = main
            ? main.value || main.nextElementSibling?.textContent?.trim()
            : "";
          if (skipMainStandard) {
            mainText =
              standardMainPlaceholder === undefined || standardMainPlaceholder === null
                ? ""
                : String(standardMainPlaceholder);
          }
          drinkText = experienceSkipsDrinkField
            ? ""
            : drink.value || drink.nextElementSibling?.textContent?.trim();

          const bevField = beverageFieldNameForTier(tierPremium);
          if (bevField) {
            const beverage = popup.querySelector(`input[name="${bevField}"]:checked`);
            if (!beverage) {
              alert(getI18nText("orders_alert_select_each", "Please select one option from each category"));
              return;
            }
            beverageText = beverage.value || beverage.nextElementSibling?.textContent?.trim();
          }

          if (
            tierPremium &&
            premiumRequireDistinctSides &&
            String(starterText).trim() === String(mainText).trim()
          ) {
            alert(
              getI18nText(
                "orders_alert_distinct_sides",
                "Please choose two different side dishes for Premium."
              )
            );
            return;
          }
        }

        const preferences = Array.from(
          popup.querySelectorAll('.preferences-inside input[type="checkbox"]:checked')
        ).map((el) => (el.value || el.parentElement.textContent.trim()));

        let horsebackDepartureTimeMenu = "";
        if (horseCfg) {
          const selH = popup.querySelector(`input[name="${horseCfg.radioName}"]:checked`);
          horsebackDepartureTimeMenu = selH ? String(selH.value || "").trim() : "";
          if (!horsebackDepartureTimeMenu) {
            alert(
              getI18nText(
                "liebres_horseback_time_required",
                "Please choose a horseback departure time."
              )
            );
            return;
          }
        }

        let walkingLanguage = "";
        if (orderLanguageRadioName) {
          const lr = popup.querySelector(`input[name="${orderLanguageRadioName}"]:checked`);
          walkingLanguage = lr
            ? String(lr.value || lr.nextElementSibling?.textContent?.trim() || "").trim()
            : "";
          if (!walkingLanguage) {
            alert(getI18nText("walking_alert_select_language", "Please select a language"));
            return;
          }
        }

        const og = optionalGuideEl();
        const includeGuide = guideOptional && !groupGuideOptional && og ? Boolean(og.checked) : false;

        let boatDepartureTimeMenu = "";
        let boatPassengersMenu = 0;
        if (menuWithPerOrderBoat && boatTimePopupRadioNameResolved) {
          const selBoat = popup.querySelector(`input[name="${boatTimePopupRadioNameResolved}"]:checked`);
          boatDepartureTimeMenu = selBoat ? String(selBoat.value || "").trim() : "";
          boatPassengersMenu =
            editingIndex !== null && orders[editingIndex]
              ? Math.max(0, Math.min(boatMax, Math.floor(Number(orders[editingIndex].boatPassengers) || 0)))
              : boatMin > 0
                ? Math.min(boatMax, boatMin)
                : 0;
          if (
            boatDepartureTimeMenu &&
            boatPassengersMenu > 0 &&
            !boatTimeSlotHasRoom(boatDepartureTimeMenu, boatPassengersMenu, editingIndex)
          ) {
            alert(
              getI18nText(
                "orders_boat_slot_full",
                "This departure time already has the maximum number of passengers. Choose another time or reduce passengers in another booking."
              )
            );
            return;
          }
        }

        let walkingTourDepartureTimeMenu = "";
        if (walkingTourTimePerOrderFlag && walkingTourTimePopupRadioNameResolved) {
          const selWt = popup.querySelector(`input[name="${walkingTourTimePopupRadioNameResolved}"]:checked`);
          walkingTourDepartureTimeMenu = selWt ? String(selWt.value || "").trim() : "";
          if (!walkingTourDepartureTimeMenu) {
            alert(
              getI18nText(
                "walking_tour_time_popup_required",
                "Please choose a walking tour departure time."
              )
            );
            return;
          }
          const partyForWalkSlot =
            editingIndex !== null && orders[editingIndex]
              ? walkingPartyForOrder(orders[editingIndex])
              : 1;
          if (!walkingTourSlotHasRoom(walkingTourDepartureTimeMenu, partyForWalkSlot, editingIndex)) {
            alert(
              getI18nText(
                "orders_boat_slot_full",
                "This departure time already has the maximum number of passengers. Choose another time or reduce passengers in another booking."
              )
            );
            return;
          }
        }

        const order = {
          starter: starterText,
          main: mainText,
          drink: drinkText,
          ...(beverageText ? { beverage: beverageText } : {}),
          preferences,
          ...(guideOptional && !groupGuideOptional ? { includeGuide } : {}),
          ...(menuUpgradePrice ? { menuTier: tierPremium ? "premium" : "standard" } : {}),
          ...(expPkg && readSelectedPackageId()
            ? { packageId: readSelectedPackageId() }
            : {}),
          ...(rb
            ? {
                guestId:
                  editingIndex !== null
                    ? String((orders[editingIndex] && orders[editingIndex].guestId) || String(editingIndex + 1))
                    : String(orders.length + 1)
              }
            : {}),
          ...(menuWithPerOrderBoat
            ? { boatDepartureTime: boatDepartureTimeMenu, boatPassengers: boatPassengersMenu }
            : {}),
          ...(walkingTourTimePerOrderFlag && walkingTourDepartureTimeMenu
            ? { walkingTourDepartureTime: walkingTourDepartureTimeMenu }
            : {}),
          ...(horseCfg && horsebackDepartureTimeMenu
            ? { horsebackDepartureTime: horsebackDepartureTimeMenu }
            : {}),
          ...(orderLanguageRadioName && walkingLanguage ? { walkingLanguage } : {}),
          ...(orderWalkingPartyMaxNum > 0 && orderLanguageRadioName
            ? {
                walkingPartyCount:
                  editingIndex !== null && orders[editingIndex]
                    ? walkingPartyForOrder(orders[editingIndex])
                    : 1
              }
            : {})
        };

        if (editingIndex !== null) {
          orders[editingIndex] = order;
          editingIndex = null;
        } else {
          orders.push(order);
        }

        setOrders(renumberRoomGuestIds(orders));

        document.getElementById(popupId)?.classList.remove("active");
        if (typeof window.renderOrders === "function") {
          window.renderOrders();
        }
        scrollToOrderSummary(orderSummaryId);
      });
    }

    const buildWhatsAppMessage = (orders, dateStr, paymentLinkOverride = "") => {
      const people = orders.length;
      const peopleCount = peopleCountForPayment(orders);
      const dynamicEnabled = Boolean(dynamicPayment && dynamicPayment.enabled);
      const paymentLink =
        paymentLinkOverride ||
        (!dynamicEnabled ? paymentLinks[peopleCount] || paymentLinks[people] || "" : "");
      const experienceSubtotal = groupExperienceSubtotal(orders);
      const gg = groupGuideAmount();
      const transportTotal =
        vehicleTransportRate > 0 ? groupPrivateTransportTotal(peopleCount, vehicleTransportRate) : 0;
      const formatTransportShareWa = (n) => {
        const v = Math.round(Number(n) * 100) / 100;
        return v % 1 === 0 ? String(v) : v.toFixed(2);
      };
      const transportSharePerGuestWa =
        transportTotal > 0 && peopleCount > 0 ? transportTotal / peopleCount : 0;
      const transportShareWaLine =
        transportSharePerGuestWa > 0
          ? waLine(
              getI18nText("orders_order_transport_share", "Private transport (your share)"),
              `${curLabel} ${formatTransportShareWa(transportSharePerGuestWa)}`
            )
          : "";
      const boatPassengersWa = boatRate > 0 ? getTotalBoatPassengersPaid() : 0;
      const boatTotalWa = boatPassengersWa * boatRate;
      const roomCostWa = rb ? calculateTotalRoomCost() : 0;
      const total = experienceSubtotal + gg + transportTotal + boatTotalWa + roomCostWa;

      const Ls = choiceSectionLabels || {};
      const Lk = choiceSectionLabelKeys || {};
      const labS = Lk.starter
        ? getI18nText(Lk.starter, Ls.starter || "Starter")
        : Ls.starter || "Starter";
      const labM = Lk.main
        ? getI18nText(Lk.main, Ls.main || "Main")
        : Ls.main || "Main";
      const labD = Lk.drink
        ? getI18nText(Lk.drink, Ls.drink || "Drink")
        : Ls.drink || "Drink";
      const labB = Lk.beverage
        ? getI18nText(Lk.beverage, Ls.beverage || "Beverage")
        : Ls.beverage || "Beverage";
      const labGuide = getI18nText("guide_accompany_short", "Guide");
      const guestLbl = getI18nText("guest_order_label", "Guest");
      const tierWaPremLine =
        tierWhatsappPremiumKey
          ? getI18nText(tierWhatsappPremiumKey, tierWhatsappPremium || "")
          : tierWhatsappPremium ||
            (menuUpgradePrice != null
              ? `${getI18nText("tier_word_premium", "Premium")} (${curLabel} ${Number(menuUpgradePrice) || 0})`
              : getI18nText("bruma_whatsapp_premium", "Premium (USD 50)"));
      const tierWaStdLine =
        tierWhatsappStandardKey
          ? getI18nText(tierWhatsappStandardKey, tierWhatsappStandard || "")
          : tierWhatsappStandard ||
            (menuUpgradePrice != null
              ? `${getI18nText("tier_word_standard", "Standard")} (${curLabel} ${Number(pricePerPerson) || 0})`
              : getI18nText("bruma_whatsapp_standard", "Standard (USD 40)"));
      const ordersText = orders
        .map((o, i) => {
          const prefs = (Array.isArray(o.preferences) ? o.preferences : [])
            .map((p) => decoratePref(p))
            .filter((p) => p && p.trim() && p !== "-");
          const gLine =
            guideOptional && !groupGuideOptional && guideFee > 0
              ? `\n${waLine(labGuide, o && o.includeGuide ? `Yes (+USD ${guideFee})` : "No")}`
              : "";
          if (experienceSkipsMenuChoices) {
            const cardLbl = boatTimePerOrderFlag
              ? getI18nText("booking_order_label", "Booking")
              : guestLbl;
            const pax = boatTimePerOrderFlag
              ? Math.max(1, Math.min(boatMax, Math.floor(Number(o.passengers) || 1)))
              : 1;
            const timeLine =
              boatTimePerOrderFlag && String(o.boatDepartureTime || "").trim()
                ? `\n${waLine(getI18nText("orders_wa_boat_time", "Boat departure time"), String(o.boatDepartureTime).trim())} · ${waLine(getI18nText("passengers_label", "Passengers"), pax)}`
                : "";
            const prefPart =
              (prefs.join(", ") || "").trim() !== ""
                ? `\n${waLine(getI18nText("preferences_label", "Preferences"), prefs.join(", "))}`
                : "";
            const transportPart =
              transportShareWaLine ? `\n${transportShareWaLine}` : "";
            return `*${cardLbl} ${i + 1}*${timeLine}${transportPart}${gLine}${prefPart}`;
          }
          const prem = menuUpgradePrice && o.menuTier === "premium";
          const ls =
            prem && !uniformTierChoiceLabels
              ? getI18nText("bruma_premium_label_plate", "Plate")
              : labS;
          const lm =
            prem && !uniformTierChoiceLabels
              ? getI18nText("bruma_premium_label_dessert", "Dessert")
              : labM;
          const tierLine = menuUpgradePrice
            ? `\n${waLine(getI18nText("bruma_whatsapp_tier", "Menu tier"), prem ? tierWaPremLine : tierWaStdLine)}`
            : "";
          const stdSkipsMain =
            Boolean(standardSkipsMainField && menuUpgradePrice && !prem);
          const premOmitsSecondSide = prem && !String(o.main || "").trim();
          const pkgIdWa = inferPackageIdFromOrder(o);
          const pkgDefWa = getPackageDef(pkgIdWa);
          const isFixedPackageWa = Boolean(pkgDefWa && !pkgDefWa.requiresMenu);
          const packagePart = pkgDefWa
            ? `\n${waLine(getI18nText("quinton_wa_option_label", "Option"), packageLabelForOrder(o))}\n${waLine(
                getI18nText("quinton_order_investment_label", "Investment"),
                packageInvestmentForOrder(o)
              )}`
            : "";
          const mainPart =
            isFixedPackageWa || stdSkipsMain || premOmitsSecondSide
              ? ""
              : `\n${waLine(lm, getLocalizedChoice(mainName, o.main))}`;
          const drinkPart =
            experienceSkipsDrinkField || isFixedPackageWa
              ? ""
              : `\n${waLine(labD, getLocalizedChoice(drinkName, o.drink))}`;
          const bevFieldWa =
            prem && premiumChoiceFieldNames?.beverage ? premiumChoiceFieldNames.beverage : beverageName;
          const beveragePart =
            bevFieldWa && o.beverage
              ? `\n${waLine(labB, getLocalizedChoice(bevFieldWa, o.beverage))}`
              : "";
          const menuBoatWa =
            menuWithPerOrderBoat && boatRate > 0
              ? (() => {
                  const bp = orderBoatPax(o);
                  const bt = orderBoatTime(o);
                  if (bp <= 0 && !bt) return "";
                  return `\n${waLine(getI18nText("orders_wa_boat_time", "Boat departure time"), bt || "-")} · ${waLine(getI18nText("passengers_label", "Passengers"), bp)}`;
                })()
              : "";
          const walkLangLabelKey = orderLanguageSummaryLabelKey || "walking_label_language";
          const walkLangLabelFb = orderLanguageSummaryLabelKey ? "Guided tour" : "Language";
          const walkLangWa =
            orderLanguageRadioName && String(o.walkingLanguage || "").trim()
              ? `\n${waLine(
                  getI18nText(walkLangLabelKey, walkLangLabelFb),
                  getLocalizedChoice(orderLanguageRadioName, o.walkingLanguage)
                )}`
              : "";
          const walkTourTimeWa =
            walkingTourTimePerOrderFlag && orderWalkingTourTime(o)
              ? `\n${waLine(getI18nText("orders_wa_walking_tour_time", "Walking tour time"), orderWalkingTourTime(o))}`
              : "";
          const walkPartyWa =
            orderWalkingPartyMaxNum > 0 && orderLanguageRadioName
              ? `\n${waLine(getI18nText("walking_asado_wa_tour_quantity", "Walking tour guests"), walkingPartyForOrder(o))}`
              : "";
          const horseTimeWa =
            horseCfg && String(o && o.horsebackDepartureTime ? o.horsebackDepartureTime : "").trim()
              ? `\n${waLine(
                  getI18nText(horseCfg.summaryLabelKey || "liebres_horseback_time_label", "Horseback departure time"),
                  horseSummaryDisplay(o.horsebackDepartureTime)
                )}`
              : "";
          const orderHead = rb
            ? `*${getI18nText("orders_wa_guest_slot", "Guest")} ${i + 1}*`
            : `*${getI18nText(orderCardTitleKey, "Order")} ${i + 1}*`;
          const starterPart =
            experienceSkipsStarterField || isFixedPackageWa
              ? ""
              : `\n${waLine(ls, getLocalizedChoice(starterName, o.starter))}`;
          const transportShareWa =
            transportShareWaLine ? `\n${transportShareWaLine}` : "";
          return `${orderHead}${fixedSummaryRowsWa("top")}${packagePart}${tierLine}${starterPart}${mainPart}${horseTimeWa}${transportShareWa}${drinkPart}${beveragePart}${menuBoatWa}${gLine}${
            experienceSkipsPreferencesField
              ? ""
              : `\n${waLine(getI18nText("preferences_label", "Preferences"), prefs.join(", ") || "-")}`
          }${walkLangWa}${walkTourTimeWa}${walkPartyWa}${fixedSummaryRowsWa("bottom")}`;
        })
        .join("\n\n");

      const expName = experienceNameKey
        ? getI18nText(experienceNameKey, experienceName)
        : experienceName;
      const waIntro = whatsappIntroKey
        ? getI18nText(whatsappIntroKey, `Hello! I'd like to book ${expName}:`)
        : getI18nText(
            "orders_wa_intro",
            "Hello! I'd like to book the {experience} experience:"
          ).replace(/\{experience\}/g, expName);
      let message = `${waIntro}\n\n${waLine(getI18nText("orders_wa_date_label", "Date"), dateStr)}`;
      if (visitTimeApi && typeof visitTimeApi.getSelectedTimeLabel === "function") {
        const visitTime = visitTimeApi.getSelectedTimeLabel();
        if (visitTime) {
          const timeKey =
            (visitTimeBooking && visitTimeBooking.summaryLabelKey) || "orders_visit_time_label";
          message += `\n${waLine(getI18nText(timeKey, "Visit time"), visitTime)}`;
        }
      }
      if (!whatsappSkipsPeopleLine) {
        message += `\n${waLine(getI18nText("orders_wa_people_line", "People"), peopleCount)}`;
      }
      if (rb && getRoomRows().length > 0) {
        const rows = getRoomRows();
        const roomLines = rows
          .map((r, i) => {
            const g = r.guests;
            const pr = Number(rb.priceByOccupancy[String(g)]);
            const pshow = Number.isFinite(pr) ? pr : 0;
            return `*${getI18nText("orders_room_label", "Room")} ${i + 1}*: ${g} ${getI18nText("orders_wa_room_guests_suffix", "guest(s)")} — ${curLabel} ${pshow}`;
          })
          .join("\n");
        message += `\n${roomLines}\n${waLine(getI18nText("orders_wa_rooms_subtotal_label", "Rooms subtotal"), `${curLabel} ${roomCostWa}`)}`;
        message += `\n${getI18nText(
          "orders_wa_rooms_breakfast_note",
          "Rooms include breakfast."
        )}`;
      }
      if (boatTotalWa > 0) {
        message += `\n${waLine(getI18nText("orders_wa_boat_passengers", "Boat passengers"), boatPassengersWa)}`;
        if (!menuWithPerOrderBoat) {
          const bTime = getBoatTimeSlot();
          if (bTime) {
            message += `\n${waLine(getI18nText("orders_wa_boat_time", "Boat departure time"), bTime)}`;
          }
        }
      } else if (boatScheduleOnlyFlag && boatTimeLSKey && people > 0 && !boatTimePerOrderFlag) {
        const bTimeOnly = getBoatTimeSlot();
        if (bTimeOnly) {
          message += `\n${waLine(getI18nText("orders_wa_boat_time", "Boat departure time"), bTimeOnly)}`;
        }
      }
      message += `\n\n${ordersText}\n\n`;
      if (!experienceSkipsPricing) {
        message += `${waLine(
          getI18nText(rb ? "orders_wa_menu_subtotal" : "orders_wa_experience_subtotal", rb ? "Menus subtotal" : "Experience subtotal"),
          `${curLabel} ${experienceSubtotal}`
        )}`;
      }
      if (guideFee > 0 && !guideOptional && !groupGuideOptional) {
        if (orderWalkingPartyMaxNum > 0 && orderLanguageRadioName) {
          message += ` (${getI18nText(
            "walking_asado_wa_guide_in_subtotal",
            "walking tour guide USD 15 × quantity per order is included in the subtotal"
          )})`;
        } else {
          message += ` (includes USD ${guideFee} guide fee per guest)`;
        }
      } else if (guideOptional && !groupGuideOptional && guideFee > 0) {
        const gt = orders.reduce((s, o) => s + (o && o.includeGuide ? guideFee : 0), 0);
        if (gt > 0) message += ` (includes USD ${gt} in optional guide fees)`;
      }
      message += `\n`;
      if (groupGuideOptional && groupGuideFlat > 0) {
        const groupGuideLabel = getI18nText(
          "orders_wa_group_guide_optional",
          "Group guide (optional, USD {amount} total for the group)"
        ).replace(/\{amount\}/g, String(groupGuideFlat));
        const groupGuideValue = gg > 0
          ? getI18nText("orders_wa_group_guide_yes", "Yes — USD {amount}").replace(/\{amount\}/g, String(gg))
          : getI18nText("guide_no", "No");
        message += `${waLine(groupGuideLabel, groupGuideValue)}\n`;
      }
      if (transportTotal > 0) {
        const vehicles = Math.ceil(peopleCount / 4);
        const vehicleWord =
          vehicles === 1
            ? getI18nText("orders_wa_vehicle_singular", "vehicle")
            : getI18nText("orders_wa_vehicle_plural", "vehicles");
        const transportLabel = getI18nText(
          "orders_wa_private_transport_line",
          "Private transport ({vehicles} {vehicleWord} × USD {rate})"
        )
          .replace(/\{vehicles\}/g, String(vehicles))
          .replace(/\{vehicleWord\}/g, vehicleWord)
          .replace(/\{rate\}/g, String(vehicleTransportRate));
        message += `${waLine(transportLabel, `USD ${transportTotal}`)}\n`;
      }
      if (boatTotalWa > 0) {
        message += `${waLine(`${getI18nText("orders_wa_boat_subtotal", "Boat")} (${boatPassengersWa} × ${curLabel} ${boatRate})`, `${curLabel} ${boatTotalWa}`)}\n`;
      }
      if (roomCostWa > 0) {
        message += `${waLine(getI18nText("orders_wa_rooms_line", "Overnight rooms"), `${curLabel} ${roomCostWa}`)}\n`;
      }
      if (!experienceSkipsPricing) {
        message += `${waLine(getI18nText("orders_wa_total_label", "Total"), `${curLabel} ${total}`)}`;
      } else {
        message += getI18nText(
          "quinton_wa_rates_note",
          "Please confirm availability and menu rates with us."
        );
      }

      if (paymentLink) {
        message += `\n\n${getI18nText(
          "orders_wa_pay_confirm",
          "To confirm the reservation, please complete the payment here:"
        )}\n${paymentLink}`;
      } else if (peopleCount > 5) {
        message += `\n\n${getI18nText(
          "orders_wa_group_coordinate",
          "We are a group of more than 5 people and would like to coordinate the reservation."
        )}`;
      } else if (dynamicEnabled) {
        message += `\n\n${getI18nText(
          "orders_wa_payment_pending",
          "Payment link could not be generated automatically yet. Please confirm and we will send it right away."
        )}`;
      }

      return message;
    };

    const storedMatchesRadio = (input, stored) => {
      const s = String(stored || "").trim();
      if (!s) return false;
      if (input.value === s) return true;
      const leg = input.dataset?.legacyValues;
      if (!leg) return false;
      return leg.split("|").some((v) => v.trim() === s);
    };

    const fillPopupForEdit = (order) => {
      popup.querySelectorAll('input[type="radio"]').forEach((i) => {
        if (menuTierRadioName && i.name === menuTierRadioName) return;
        if (expPkg && i.name === expPkg.radioName) return;
        i.checked = false;
      });
      if (standardSideCheckboxName) {
        popup.querySelectorAll(`input[name="${standardSideCheckboxName}"]`).forEach((i) => (i.checked = false));
      }
      if (premiumSideCheckboxName) {
        popup.querySelectorAll(`input[name="${premiumSideCheckboxName}"]`).forEach((i) => (i.checked = false));
      }
      popup.querySelectorAll('.preferences-inside input[type="checkbox"]').forEach((i) => (i.checked = false));

      if (!experienceSkipsMenuChoices) {
      const isPrem = menuUpgradePrice && order.menuTier === "premium";
      if (menuUpgradePrice && menuTierRadioName) {
        const tr = popup.querySelector(
          `input[name="${menuTierRadioName}"][value="${isPrem ? "premium" : "standard"}"]`
        );
        if (tr) tr.checked = true;
        syncMenuTierPanels(!isPrem);
      }

      if (isPrem && premiumSideCheckboxName) {
        const want = [order.starter, order.main].filter((v) => String(v || "").trim());
        popup.querySelectorAll(`input[name="${premiumSideCheckboxName}"]`).forEach((input) => {
          const labelText = input.nextElementSibling?.textContent?.trim();
          const match = (val) =>
            val &&
            (labelText === val || input.value === val || storedMatchesRadio(input, val));
          input.checked = want.some((val) => match(val));
        });
        if (premiumChoiceFieldNames && !experienceSkipsDrinkField) {
          popup.querySelectorAll(`input[name="${premiumChoiceFieldNames.drink}"]`).forEach((input) => {
            const labelText = input.nextElementSibling?.textContent?.trim();
            input.checked =
              labelText === order.drink || input.value === order.drink || storedMatchesRadio(input, order.drink);
          });
        }
      } else if (isPrem && premiumChoiceFieldNames) {
        popup.querySelectorAll(`input[name="${premiumChoiceFieldNames.starter}"]`).forEach((input) => {
          const labelText = input.nextElementSibling?.textContent?.trim();
          input.checked =
            labelText === order.starter ||
            input.value === order.starter ||
            storedMatchesRadio(input, order.starter);
        });
        popup.querySelectorAll(`input[name="${premiumChoiceFieldNames.main}"]`).forEach((input) => {
          const labelText = input.nextElementSibling?.textContent?.trim();
          input.checked =
            labelText === order.main || input.value === order.main || storedMatchesRadio(input, order.main);
        });
        if (!experienceSkipsDrinkField) {
          popup.querySelectorAll(`input[name="${premiumChoiceFieldNames.drink}"]`).forEach((input) => {
            const labelText = input.nextElementSibling?.textContent?.trim();
            input.checked =
              labelText === order.drink || input.value === order.drink || storedMatchesRadio(input, order.drink);
          });
        }
      } else if (!isPrem && standardSideCheckboxName) {
        popup.querySelectorAll(`input[name="${standardSideCheckboxName}"]`).forEach((input) => {
          const labelText = input.nextElementSibling?.textContent?.trim();
          input.checked =
            labelText === order.starter ||
            input.value === order.starter ||
            storedMatchesRadio(input, order.starter);
        });
        if (!experienceSkipsDrinkField) {
          popup.querySelectorAll(`input[name="${drinkName}"]`).forEach((input) => {
            const labelText = input.nextElementSibling?.textContent?.trim();
            input.checked =
              labelText === order.drink || input.value === order.drink || storedMatchesRadio(input, order.drink);
          });
        }
      } else {
        popup.querySelectorAll(`input[name="${starterName}"]`).forEach((input) => {
          const labelText = input.nextElementSibling?.textContent?.trim();
          input.checked =
            labelText === order.starter ||
            input.value === order.starter ||
            storedMatchesRadio(input, order.starter);
        });

        if (!(standardSkipsMainField && menuUpgradePrice && !isPrem)) {
          popup.querySelectorAll(`input[name="${mainName}"]`).forEach((input) => {
            const labelText = input.nextElementSibling?.textContent?.trim();
            input.checked =
              labelText === order.main || input.value === order.main || storedMatchesRadio(input, order.main);
          });
        }

        if (!experienceSkipsDrinkField) {
          popup.querySelectorAll(`input[name="${drinkName}"]`).forEach((input) => {
            const labelText = input.nextElementSibling?.textContent?.trim();
            input.checked =
              labelText === order.drink || input.value === order.drink || storedMatchesRadio(input, order.drink);
          });
        }
        }
      }

      const fillBeverageRadios = (fieldName, stored) => {
        if (!fieldName || !stored) return;
        popup.querySelectorAll(`input[name="${fieldName}"]`).forEach((input) => {
          const labelText = input.nextElementSibling?.textContent?.trim();
          input.checked =
            labelText === stored || input.value === stored || storedMatchesRadio(input, stored);
        });
      };
      if (!experienceSkipsMenuChoices) {
        const isPremFill = menuUpgradePrice && order.menuTier === "premium";
        const bevFieldFill = beverageFieldNameForTier(isPremFill);
        if (bevFieldFill) fillBeverageRadios(bevFieldFill, order.beverage);
      }

      if (menuWithPerOrderBoat && boatTimePopupRadioNameResolved) {
        popup.querySelectorAll(`input[name="${boatTimePopupRadioNameResolved}"]`).forEach((input) => {
          input.checked = String(input.value).trim() === orderBoatTime(order);
        });
      }

      if (experienceSkipsMenuChoices && boatTimePerOrderFlag && boatTimePopupRadioNameResolved) {
        popup.querySelectorAll(`input[name="${boatTimePopupRadioNameResolved}"]`).forEach((input) => {
          input.checked = String(input.value).trim() === String(order.boatDepartureTime || "").trim();
        });
      }

      if (walkingTourTimePerOrderFlag && walkingTourTimePopupRadioNameResolved) {
        popup.querySelectorAll(`input[name="${walkingTourTimePopupRadioNameResolved}"]`).forEach((input) => {
          input.checked = String(input.value).trim() === orderWalkingTourTime(order);
        });
      }

      if (horseCfg) {
        const h = String(order.horsebackDepartureTime || "").trim();
        popup.querySelectorAll(`input[name="${horseCfg.radioName}"]`).forEach((input) => {
          input.checked = storedMatchesRadio(input, h);
        });
        if (!h) {
          const def =
            popup.querySelector(`input[name="${horseCfg.radioName}"][value="13:30"]`) ||
            popup.querySelector(`input[name="${horseCfg.radioName}"][value="11:00"]`) ||
            popup.querySelector(`input[name="${horseCfg.radioName}"]`);
          if (def) def.checked = true;
        }
      }

      if (orderLanguageRadioName && String(order.walkingLanguage || "").trim()) {
        const w = String(order.walkingLanguage).trim();
        popup.querySelectorAll(`input[name="${orderLanguageRadioName}"]`).forEach((input) => {
          const labelText = input.nextElementSibling?.textContent?.trim();
          input.checked =
            String(input.value).trim() === w ||
            (labelText && labelText === w) ||
            storedMatchesRadio(input, w);
        });
      }

      const prefsSet = new Set(Array.isArray(order.preferences) ? order.preferences : []);
      popup.querySelectorAll('.preferences-inside input[type="checkbox"]').forEach((input) => {
        const span = input.parentElement?.querySelector("span[data-translate]");
        const trKey = span?.dataset?.translate;
        const encoded = trKey ? encodePref(trKey) : "";
        const labelText = input.parentElement?.textContent?.trim();
        input.checked =
          prefsSet.has(input.value) ||
          Boolean(labelText && prefsSet.has(labelText)) ||
          Boolean(encoded && prefsSet.has(encoded));
      });

      const og = optionalGuideEl();
      if (og && !groupGuideOptional) og.checked = Boolean(order.includeGuide);

      if (expPkg) {
        resetPackageTourCheckboxes();
        const pid = inferPackageIdFromOrder(order);
        if (pid) {
          const radio = popup.querySelector(`input[name="${expPkg.radioName}"][value="${pid}"]`);
          if (radio) radio.checked = true;
          const pkg = getPackageDef(pid);
          if (order.includeTour && pkg && pkg.tourAddon && pkg.tourAddon.checkboxId) {
            const cb = document.getElementById(pkg.tourAddon.checkboxId);
            if (cb) cb.checked = true;
          }
          showPackagePopupStep(pkg && pkg.requiresMenu ? "menu" : "packages");
        } else {
          showPackagePopupStep("packages");
        }
      }

      if (typeof afterFillPopupForEdit === "function") {
        try {
          afterFillPopupForEdit(order);
        } catch (err) {
          console.error(err);
        }
      }
    };

    const renderOrders = () => {
      const orders = getOrders();
      if (boatLSKey && orders.length === 0 && getBoatPassengers() > 0) {
        setBoatPassengers(0);
      }
      if (menuWithPerOrderBoat && orders.length === 0) {
        localStorage.removeItem(`${storageKey}_boatPassengers`);
        localStorage.removeItem(`${storageKey}_boatTime`);
      }
      if (boatTimeLSKey && orders.length === 0) {
        setBoatTimeSlot("");
      }
      const people = orders.length;
      const headcount =
        boatTimePerOrderFlag && experienceSkipsMenuChoices
          ? orders.reduce((s, o) => s + orderBoatPax(o), 0)
          : people;
      const transportParty =
        rb && calculateGuestsFromRooms() > 0
          ? calculateGuestsFromRooms()
          : boatTimePerOrderFlag && experienceSkipsMenuChoices
            ? headcount
            : people;
      const transportTotal =
        vehicleTransportRate > 0
          ? groupPrivateTransportTotal(transportParty, vehicleTransportRate)
          : 0;
      const transportSharePerGuest =
        transportTotal > 0 && transportParty > 0 ? transportTotal / transportParty : 0;
      const formatTransportShare = (n) => {
        const v = Math.round(Number(n) * 100) / 100;
        return v % 1 === 0 ? String(v) : v.toFixed(2);
      };
      const t = (key, fallback) => getI18nText(key, fallback);

      let html = `<h3>${escapeHtml(t("your_order", "Your order"))}</h3>`;

      if (orders.length > 0) {
        const addLabel = experienceSkipsMenuChoices
          ? t("add_passenger", "Add passenger or group")
          : t("add_order", "Add Order");
        const atCapacity =
          rb && calculateGuestsFromRooms() > 0 && orders.length >= calculateGuestsFromRooms();
        html = `
          <button id="addGuestBtn" class="add-guest-btn"${atCapacity ? " disabled" : ""}>
            + ${escapeHtml(addLabel)}
          </button>
          <h3>${escapeHtml(t("your_order", "Your order"))}</h3>
        `;
      }

      if (selectedDateKey) {
        html += `<p class="order-summary-visit-date"><strong>${escapeHtml(
          t("orders_visit_date_label", "Visit date")
        )}:</strong> ${escapeHtml(getDateForBooking())}</p>`;
      }

      if (visitTimeApi && typeof visitTimeApi.getSelectedTimeLabel === "function") {
        const visitTime = visitTimeApi.getSelectedTimeLabel();
        if (visitTime) {
          const timeKey =
            (visitTimeBooking && visitTimeBooking.summaryLabelKey) || "orders_visit_time_label";
          html += `<p class="order-summary-visit-date"><strong>${escapeHtml(
            t(timeKey, "Visit time")
          )}:</strong> ${escapeHtml(visitTime)}</p>`;
        }
      }

      if (rb) {
        const need = calculateGuestsFromRooms();
        const cov =
          need <= 0
            ? t("orders_room_configure_first", "Configure your rooms above.")
            : `${t("orders_menus_progress", "Menus")}: ${orders.length}/${need} — ${
                orders.length === need
                  ? t("orders_coverage_complete", "Complete")
                  : t("orders_coverage_incomplete", "Incomplete")
              }`;
        html += `<p class="orders-menu-coverage">${escapeHtml(cov)}</p>`;
      }

      if (boatTimePerOrderFlag) {
        const slotHintRaw = t(
          "sunset_boat_passengers_per_slot",
          "Up to {max} passengers allowed per departure time."
        ).replace(/\{max\}/g, String(boatMax));
        html += `<p class="sunset-boat-passengers-slot-hint">${escapeHtml(slotHintRaw)}</p>`;
        if (boatMin > 0) {
          const minHintRaw = t(
            "orders_boat_min_notice",
            "Minimum {min} passengers on the boat for this experience."
          ).replace(/\{min\}/g, String(boatMin));
          html += `<p class="sunset-boat-passengers-slot-hint">${escapeHtml(minHintRaw)}</p>`;
        }
      }

      if (minOrdersNum > 0) {
        const minOrdersHintRaw = t(
          "orders_min_orders_notice",
          "Minimum {min} people — add one menu per person."
        ).replace(/\{min\}/g, String(minOrdersNum));
        html += `<p class="sunset-boat-passengers-slot-hint">${escapeHtml(minOrdersHintRaw)}</p>`;
      }

      if (walkingTourTimePerOrderFlag) {
        const slotHintWalk = t(
          "walking_asado_passengers_per_slot",
          "Up to {max} people per walking tour departure time."
        ).replace(/\{max\}/g, String(walkingTourSlotMaxNum));
        html += `<p class="sunset-boat-passengers-slot-hint">${escapeHtml(slotHintWalk)}</p>`;
      }

      const Ls = choiceSectionLabels || {};
      const Lk = choiceSectionLabelKeys || {};
      const defLabS = escapeHtml(
        Lk.starter ? t(Lk.starter, Ls.starter || "Starter") : Ls.starter || t("starter_label", "Starter")
      );
      const defLabM = escapeHtml(
        Lk.main ? t(Lk.main, Ls.main || "Main") : Ls.main || t("main_label", "Main")
      );
      const defLabD = escapeHtml(
        Lk.drink ? t(Lk.drink, Ls.drink || "Drink") : Ls.drink || t("drink_label", "Drink")
      );
      const defLabB = escapeHtml(
        Lk.beverage ? t(Lk.beverage, Ls.beverage || "Beverage") : Ls.beverage || "Beverage"
      );
      orders.forEach((order, index) => {
        const prefs = (Array.isArray(order.preferences) ? order.preferences : [])
          .map((p) => decoratePref(p))
          .filter((p) => p && p.trim() && p !== "-");
        const guideLine =
          guideOptional && !groupGuideOptional && guideFee > 0
            ? `<p><strong>${escapeHtml(t("guide_accompany_label", "Guide to accompany"))}:</strong> ${order.includeGuide ? escapeHtml(`${getI18nText("yes_word", "Yes")} (+USD ${guideFee})`) : escapeHtml(t("guide_no", "No"))}</p>`
            : "";
        if (experienceSkipsMenuChoices) {
          const cardTitleKey = boatTimePerOrderFlag ? "booking_order_label" : "guest_order_label";
          const cardTitleFb = boatTimePerOrderFlag ? "Booking" : "Guest";
          const pax = boatTimePerOrderFlag
            ? Math.max(1, Math.min(boatMax, Math.floor(Number(order.passengers) || 1)))
            : 1;
          const timeLine =
            boatTimePerOrderFlag && String(order.boatDepartureTime || "").trim()
              ? `<p><strong>${escapeHtml(t("orders_boat_time_label", "Boat departure time"))}:</strong> ${escapeHtml(String(order.boatDepartureTime).trim())}</p>`
              : boatTimePerOrderFlag
                ? `<p><strong>${escapeHtml(t("orders_boat_time_label", "Boat departure time"))}:</strong> <em>${escapeHtml(t("orders_boat_time_not_set", "Choose a time (edit)"))}</em></p>`
                : "";
          const slotPaxCap = boatTimePerOrderFlag ? maxPassengersForOrderIndex(index) : boatMax;
          const paxMinusDisabled =
            pax <= 1 || minusWouldViolateBoatMin(index, Math.max(1, pax - 1));
          const paxRow = boatTimePerOrderFlag
            ? `<p class="order-passengers-controls"><strong>${escapeHtml(t("passengers_label", "Passengers"))}:</strong> <button type="button" class="add-guest-btn"${
                paxMinusDisabled ? " disabled" : ""
              } data-order-passengers-action="minus" data-index="${index}">−</button> <span class="order-pax-count">${pax}</span> <button type="button" class="add-guest-btn"${
                pax >= slotPaxCap ? " disabled" : ""
              } data-order-passengers-action="plus" data-index="${index}">+</button></p>`
            : "";
          html += `
          <div class="order-card">
            <div class="order-header">
              <strong class="order-card-title">${escapeHtml(t(cardTitleKey, cardTitleFb))} ${index + 1}</strong>
              <div class="order-actions">
                <span class="edit-order" data-index="${index}">✏️</span>
                <span class="delete-order" data-index="${index}">🗑️</span>
              </div>
            </div>
            ${timeLine}
            ${guideLine}
            ${paxRow}
            ${
              prefs.length > 0
                ? `<p><strong>${escapeHtml(t("preferences_label", "Preferences"))}:</strong> ${escapeHtml(prefs.join(", "))}</p>`
                : ""
            }
          </div>
        `;
          return;
        }
        const prem = menuUpgradePrice && order.menuTier === "premium";
        const labS =
          prem && !uniformTierChoiceLabels
            ? escapeHtml(t("bruma_premium_label_plate", "Plate"))
            : defLabS;
        const labM =
          prem && !uniformTierChoiceLabels
            ? escapeHtml(t("bruma_premium_label_dessert", "Dessert"))
            : defLabM;
        const labD = defLabD;
        const tierCardPrem =
          tierSummaryPremiumKey
            ? t(tierSummaryPremiumKey, tierSummaryPremium || "")
            : tierSummaryPremium ||
              (menuUpgradePrice != null
                ? `${t("tier_word_premium", "Premium")} · ${curLabel} ${Number(menuUpgradePrice) || 0}`
                : t("bruma_order_tier_premium", "Premium · USD 50"));
        const tierCardStd =
          tierSummaryStandardKey
            ? t(tierSummaryStandardKey, tierSummaryStandard || "")
            : tierSummaryStandard ||
              (menuUpgradePrice != null
                ? `${t("tier_word_standard", "Standard")} · ${curLabel} ${Number(pricePerPerson) || 0}`
                : t("bruma_order_tier_standard", "Standard · USD 40"));
        const tierRow =
          menuUpgradePrice
            ? `<p class="order-menu-tier"><strong>${escapeHtml(t("bruma_order_tier_label", "Menu"))}:</strong> ${escapeHtml(
                prem ? tierCardPrem : tierCardStd
              )}</p>`
            : "";
        const servingNoteRow =
          menuUpgradePrice && tierServingNotesI18n
            ? `<p class="order-tier-serving-note">${escapeHtml(
                t(
                  prem ? tierServingNotesI18n.premium : tierServingNotesI18n.standard,
                  prem
                    ? "Generally enough for about 4 people."
                    : "Generally enough for about 2–3 people."
                )
              )}</p>`
            : "";
        const walkLangLabelKey = orderLanguageSummaryLabelKey || "walking_label_language";
        const walkLangLabelFb = orderLanguageSummaryLabelKey ? "Guided tour" : "Language";
        const walkLangRow =
          orderLanguageRadioName && String(order.walkingLanguage || "").trim()
            ? `<p><strong>${escapeHtml(t(walkLangLabelKey, walkLangLabelFb))}:</strong> ${escapeHtml(
                getLocalizedChoice(orderLanguageRadioName, order.walkingLanguage)
              )}</p>`
            : "";
        const walkTourT = orderWalkingTourTime(order);
        const slotsWt = Array.isArray(walkingTourTimeSlots) ? walkingTourTimeSlots : [];
        const horseTimeCard = String(order.horsebackDepartureTime || "").trim();
        const horseRow =
          horseCfg && horseTimeCard
            ? `<p><strong>${escapeHtml(
                t(horseCfg.summaryLabelKey || "liebres_horseback_time_label", "Horseback departure time")
              )}:</strong> ${escapeHtml(horseSummaryDisplay(horseTimeCard))}</p>`
            : "";
        const walkTourRadioName = `orderWalkingTourTime_${String(storageKey).replace(/[^a-zA-Z0-9_-]/g, "_")}_${index}`;
        const walkTourTimeBlock =
          walkingTourTimePerOrderFlag && slotsWt.length
            ? `<div class="order-card-walking-tour-times">
            <p class="orders-boat-time-heading"><strong>${escapeHtml(
              t("walking_asado_orders_tour_time_label", "Walking tour time")
            )}</strong></p>
            <div class="orders-boat-times" role="radiogroup" aria-label="${escapeHtml(
              t("walking_asado_orders_tour_time_label", "Walking tour time")
            )}">${slotsWt
              .map((slot) => {
                const esc = escapeHtml(slot);
                const checked = walkTourT === slot ? " checked" : "";
                return `<label class="orders-boat-time-option"><input type="radio" class="order-walking-tour-time-input" name="${escapeHtml(
                  walkTourRadioName
                )}" value="${esc}" data-order-walking-tour-index="${index}"${checked}/> ${esc}</label>`;
              })
              .join("")}</div></div>`
            : "";
        const wParty =
          orderWalkingPartyMaxNum > 0 && orderLanguageRadioName ? walkingPartyForOrder(order) : 1;
        const walkingSlotCap =
          walkingTourTimePerOrderFlag && walkTourT ? maxWalkingPartyForOrderIndex(index) : orderWalkingPartyMaxNum;
        const walkingPartyRow =
          orderWalkingPartyMaxNum > 0 && orderLanguageRadioName
            ? `<p class="order-passengers-controls"><strong>${escapeHtml(
                t("walking_asado_quantity_label", "Quantity")
              )}:</strong> <button type="button" class="add-guest-btn"${
                wParty <= 1 ? " disabled" : ""
              } data-walking-party-action="minus" data-index="${index}">−</button> <span class="order-pax-count">${wParty}</span> <button type="button" class="add-guest-btn"${
                wParty >= walkingSlotCap ? " disabled" : ""
              } data-walking-party-action="plus" data-index="${index}">+</button></p>`
            : "";
        const pkgId = inferPackageIdFromOrder(order);
        const pkgDef = getPackageDef(pkgId);
        const isFixedPackage = Boolean(pkgDef && !pkgDef.requiresMenu);
        const packageRow = pkgDef
          ? `<p><strong>${escapeHtml(t("quinton_wa_option_label", "Option"))}:</strong> ${escapeHtml(
              packageLabelForOrder(order)
            )}</p>`
          : "";
        const packageInvestmentRow = pkgDef
          ? `<p><strong>${escapeHtml(t("quinton_order_investment_label", "Investment"))}:</strong> ${escapeHtml(
              packageInvestmentForOrder(order)
            )}</p>`
          : "";
        const stdSkipsMainRow =
          Boolean(standardSkipsMainField && menuUpgradePrice && !prem);
        const premOmitsSecondSide = prem && !String(order.main || "").trim();
        const mainRow =
          isFixedPackage || stdSkipsMainRow || premOmitsSecondSide
            ? ""
            : `<p><strong>${labM}:</strong> ${escapeHtml(getLocalizedChoice(mainName, order.main))}</p>`;
        const drinkRow =
          experienceSkipsDrinkField || isFixedPackage
            ? ""
            : `<p><strong>${labD}:</strong> ${escapeHtml(getLocalizedChoice(drinkName, order.drink))}</p>`;
        const bevFieldCard =
          prem && premiumChoiceFieldNames?.beverage ? premiumChoiceFieldNames.beverage : beverageName;
        const beverageRow =
          bevFieldCard && order.beverage
            ? `<p><strong>${defLabB}:</strong> ${escapeHtml(getLocalizedChoice(bevFieldCard, order.beverage))}</p>`
            : "";
        const boatHintMenu = t("orders_boat_each_hint", "USD {price} per person").replace(
          /\{price\}/g,
          String(boatRate)
        );
        const menuBoatPax = orderBoatPax(order);
        const menuBoatT = orderBoatTime(order);
        const slotCapMenu = maxPassengersForOrderIndex(index);
        const slotsMenu = Array.isArray(boatTimeSlots) ? boatTimeSlots : [];
        const boatMenuRadioName = `orderBoatMenuTime_${String(storageKey).replace(/[^a-zA-Z0-9_-]/g, "_")}_${index}`;
        const lunchAfterPrefsRow =
          menuWithPerOrderBoat && boatRate > 0
            ? `<p class="order-asado-lunch-note">${escapeHtml(
                t(
                  "asado_boat_lunch_after_boat",
                  "Lunch is served at 12:30 after the first boat trip (11:00am departure)."
                )
              )}</p>`
            : "";
        const menuBoatBlock =
          menuWithPerOrderBoat && boatRate > 0
            ? `<div class="order-card-menu-boat">
            <p class="orders-boat-time-heading"><strong>${escapeHtml(t("orders_boat_section_title", "Boat passengers"))}</strong></p>
            <p class="orders-boat-hint">${escapeHtml(boatHintMenu)}</p>
            <div class="orders-boat-times" role="radiogroup" aria-label="${escapeHtml(t("orders_boat_time_label", "Boat departure time"))}">${slotsMenu
              .map((slot) => {
                const esc = escapeHtml(slot);
                const checked = menuBoatT === slot ? " checked" : "";
                return `<label class="orders-boat-time-option"><input type="radio" class="order-boat-menu-time-input" name="${escapeHtml(
                  boatMenuRadioName
                )}" value="${esc}" data-order-boat-menu-index="${index}"${checked}/> ${esc}</label>`;
              })
              .join("")}</div>
            <p class="order-passengers-controls"><strong>${escapeHtml(t("passengers_label", "Passengers"))}:</strong>
              <button type="button" class="add-guest-btn"${
                menuBoatPax <= 0 || minusWouldViolateBoatMin(index, Math.max(0, menuBoatPax - 1))
                  ? " disabled"
                  : ""
              } data-menu-boat-pax-action="minus" data-index="${index}">−</button>
              <span class="order-pax-count">${menuBoatPax}</span>
              <button type="button" class="add-guest-btn"${
                menuBoatPax >= slotCapMenu ? " disabled" : ""
              } data-menu-boat-pax-action="plus" data-index="${index}">+</button>
            </p>
            <p><strong>${escapeHtml(t("orders_boat_line_total", "Boat subtotal"))}:</strong> ${escapeHtml(curLabel)} ${menuBoatPax * boatRate}</p>
          </div>`
            : "";
        const cardTitleTxt = rb
          ? `${escapeHtml(t("orders_wa_guest_slot", "Guest"))} ${index + 1}`
          : `${escapeHtml(t(orderCardTitleKey, "Order"))} ${index + 1}`;
        const starterRow = experienceSkipsStarterField || isFixedPackage
          ? ""
          : `<p><strong>${labS}:</strong> ${escapeHtml(getLocalizedChoice(starterName, order.starter))}</p>`;
        const transportShareRow =
          transportSharePerGuest > 0
            ? `<p><strong>${escapeHtml(t("orders_order_transport_share", "Private transport (your share)"))}:</strong> ${escapeHtml(curLabel)} ${escapeHtml(formatTransportShare(transportSharePerGuest))}</p>`
            : "";
        html += `
          <div class="order-card">
            <div class="order-header">
              <strong class="order-card-title">${cardTitleTxt}</strong>
              <div class="order-actions">
                <span class="edit-order" data-index="${index}">✏️</span>
                <span class="delete-order" data-index="${index}">🗑️</span>
              </div>
            </div>
            ${tierRow}${servingNoteRow}
            ${fixedSummaryRowsHtml("top")}
            ${packageRow}
            ${packageInvestmentRow}
            ${mainRow}
            ${horseRow}
            ${transportShareRow}
            ${starterRow}
            ${drinkRow}
            ${beverageRow}
            ${guideLine}
            ${
              experienceSkipsPreferencesField
                ? ""
                : `<p><strong>${escapeHtml(t("preferences_label", "Preferences"))}:</strong> ${escapeHtml(prefs.join(", ") || "-")}</p>`
            }
            ${fixedSummaryRowsHtml("bottom")}
            ${walkLangRow}
            ${walkTourTimeBlock}
            ${walkingPartyRow}
            ${lunchAfterPrefsRow}
            ${menuBoatBlock}
          </div>
        `;
      });

      if (orders.length > 0) {
        if (boatRate > 0 && !menuWithPerOrderBoat) {
          const bn = getBoatPassengers();
          const boatSub = bn * boatRate;
          const boatHint = t("orders_boat_each_hint", "USD {price} per person").replace(/\{price\}/g, String(boatRate));
          const minusDisabled = bn <= 0 ? " disabled" : "";
          const plusDisabled = bn >= boatMax ? " disabled" : "";
          const bSlot = getBoatTimeSlot();
          const slots = Array.isArray(boatTimeSlots) ? boatTimeSlots : [];
          const timeField =
            boatTimeLSKey && slots.length
              ? `<p class="orders-boat-time-heading"><strong>${escapeHtml(
                  t("orders_boat_time_label", "Boat departure time")
                )}</strong></p><div class="orders-boat-times" role="radiogroup" aria-label="${escapeHtml(
                  t("orders_boat_time_label", "Boat departure time")
                )}">${slots
                  .map((slot) => {
                    const esc = escapeHtml(slot);
                    const checked = bSlot === slot ? " checked" : "";
                    return `<label class="orders-boat-time-option"><input type="radio" name="${escapeHtml(
                      boatTimeRadioName
                    )}" value="${esc}"${checked}/> ${esc}</label>`;
                  })
                  .join("")}</div>`
              : "";
          html += `
          <div class="order-card orders-boat-card">
            <div class="order-header">
              <strong class="order-card-title">${escapeHtml(t("orders_boat_section_title", "Boat passengers"))}</strong>
              <div class="order-actions">
                <button type="button" class="add-guest-btn"${minusDisabled} data-boat-action="minus">${escapeHtml(
            t("walking_minus_person", "- Person")
          )}</button>
                <button type="button" class="add-guest-btn"${plusDisabled} data-boat-action="plus">${escapeHtml(
            t("walking_plus_person", "+ Person")
          )}</button>
              </div>
            </div>
            <p class="orders-boat-hint">${escapeHtml(boatHint)}</p>
            ${timeField}
            <p><strong>${escapeHtml(t("walking_label_people", "People"))}:</strong> ${bn}</p>
            <p><strong>${escapeHtml(t("orders_boat_line_total", "Boat subtotal"))}:</strong> ${escapeHtml(curLabel)} ${boatSub}</p>
          </div>
        `;
        } else if (boatScheduleOnlyFlag && boatTimeLSKey && !boatTimePerOrderFlag) {
          const bSlotSo = getBoatTimeSlot();
          const slotsSo = Array.isArray(boatTimeSlots) ? boatTimeSlots : [];
          const timeFieldSo =
            slotsSo.length > 0
              ? `<p class="orders-boat-time-heading"><strong>${escapeHtml(
                  t("orders_boat_time_label", "Boat departure time")
                )}</strong></p><div class="orders-boat-times" role="radiogroup" aria-label="${escapeHtml(
                  t("orders_boat_time_label", "Boat departure time")
                )}">${slotsSo
                  .map((slot) => {
                    const esc = escapeHtml(slot);
                    const checked = bSlotSo === slot ? " checked" : "";
                    return `<label class="orders-boat-time-option"><input type="radio" name="${escapeHtml(
                      boatTimeRadioName
                    )}" value="${esc}"${checked}/> ${esc}</label>`;
                  })
                  .join("")}</div>`
              : "";
          html += `
          <div class="order-card orders-boat-card orders-boat-card--schedule-only">
            ${timeFieldSo}
          </div>
        `;
        }

        const ggAmt = groupGuideAmount();
        const experienceSubtotal = groupExperienceSubtotal(orders);
        const roomCostUi = calculateTotalRoomCost();
        const total = calculateFinalPrice(orders);
        const orderCountLabel =
          boatTimePerOrderFlag && experienceSkipsMenuChoices
            ? orders.length === 1
              ? t("booking_singular", "booking")
              : t("booking_plural", "bookings")
            : people === 1
              ? t("guest_order_singular", "guest order")
              : t("guest_order_plural", "guest orders");
        const tourPartySum =
          orderWalkingPartyMaxNum > 0 && orderLanguageRadioName
            ? orders.reduce((s, o) => s + walkingPartyForOrder(o), 0)
            : people;
        const needGuestsUi = rb ? calculateGuestsFromRooms() : 0;
        const summaryBookings =
          rb && needGuestsUi > 0
            ? `${needGuestsUi} ${t("orders_summary_guests_word", "guests")} · ${orders.length}/${needGuestsUi} ${t(
                "orders_summary_menus_word",
                "menus"
              )}`
            : boatTimePerOrderFlag && experienceSkipsMenuChoices
              ? `${headcount} ${t("passengers_label", "passengers")} · ${orders.length} ${orderCountLabel}`
              : orderWalkingPartyMaxNum > 0 && orderLanguageRadioName
                ? `${tourPartySum} ${t("walking_label_people", "People")} · ${orders.length} ${orderCountLabel}`
                : `${orders.length} ${orderCountLabel}`;
        const experienceDetailMid = experienceMenuFlatTotal
          ? t("orders_menu_package_group_total", "menu package (group total)")
          : t("experiences_word", "experiences");
        const guideTotalOptional = guideOptional && !groupGuideOptional
          ? orders.reduce((s, o) => s + (o && o.includeGuide ? guideFee : 0), 0)
          : 0;
        let guideDetail = "";
        if (groupGuideOptional && groupGuideFlat > 0) {
          if (ggAmt > 0) guideDetail = ` · ${t("guide_short", "guide")} USD ${ggAmt}`;
        } else if (guideOptional && guideFee > 0) {
          guideDetail =
            guideTotalOptional > 0
              ? ` · ${t("guide_short", "guide")} USD ${guideTotalOptional}`
              : "";
        } else if (guideFee > 0 && !(orderWalkingPartyMaxNum > 0 && orderLanguageRadioName)) {
          guideDetail = ` · ${t("guide_short", "guide")} USD ${guideFee}/${t("guest_short", "guest")} ${t("included_short", "incl.")}`;
        }
        const transportDetail =
          transportSharePerGuest > 0
            ? ` · ${escapeHtml(
                t("orders_summary_transport_per_guest", "transport USD {amount} per guest").replace(
                  "{amount}",
                  formatTransportShare(transportSharePerGuest)
                )
              )}`
            : "";
        const boatPassengersUi = boatRate > 0 ? getTotalBoatPassengersPaid() : 0;
        const boatTotalUi = boatPassengersUi * boatRate;
        const boatDetail =
          boatTotalUi > 0
            ? ` · ${t("orders_boat_short", "boat")} ${curLabel} ${boatTotalUi} (${boatPassengersUi}×${boatRate})`
            : "";
        const roomDetail =
          roomCostUi > 0 ? ` · ${t("orders_rooms_short", "rooms")} ${curLabel} ${roomCostUi}` : "";
        if (experienceSkipsPricing) {
          html += `
          <div class="total-box total-box--no-pricing">
            <div class="total-left">
              <span class="total-detail">${escapeHtml(summaryBookings)}</span>
            </div>
            <a href="#" id="bookWithOrder" class="btn total-btn">
              ${escapeHtml(t("book_btn", "Reserve"))}
            </a>
          </div>
        `;
        } else {
          html += `
          <div class="total-box">
            <div class="total-left">
              <span class="total-label">${escapeHtml(t("total_label", "Total"))}</span>
              <span class="total-detail">${escapeHtml(summaryBookings)} · ${escapeHtml(experienceDetailMid)} ${escapeHtml(curLabel)} ${experienceSubtotal}${roomDetail}${boatDetail}${guideDetail}${transportDetail}</span>
            </div>
            <div class="total-right">
              ${escapeHtml(curLabel)} ${total}
            </div>
            <a href="#" id="bookWithOrder" class="btn total-btn">
              ${escapeHtml(t("book_btn", "Reserve"))}
            </a>
          </div>
        `;
        }
      }

      container.innerHTML = html;
      syncGroupGuideWrap();
    };

    container.addEventListener("change", (e) => {
      const t = e.target;
      if (t && t.classList && t.classList.contains("order-boat-menu-time-input") && t.checked && menuWithPerOrderBoat) {
        const idx = Number(t.dataset.orderBoatMenuIndex);
        const slot = String(t.value || "").trim();
        const list = getOrders();
        const o = list[idx];
        if (!o) return;
        let pax = orderBoatPax(o);
        if (pax <= 0 && boatMin > 0) {
          pax = Math.min(boatMax, boatMin);
        }
        if (pax > 0 && !boatTimeSlotHasRoom(slot, pax, idx)) {
          alert(
            getI18nText(
              "orders_boat_slot_full",
              "This departure time already has the maximum number of passengers. Choose another time or reduce passengers in another booking."
            )
          );
          renderOrders();
          return;
        }
        list[idx] = { ...o, boatDepartureTime: slot, boatPassengers: pax };
        setOrders(list);
        renderOrders();
        return;
      }
      const wtWalk = e.target;
      if (
        wtWalk &&
        wtWalk.classList &&
        wtWalk.classList.contains("order-walking-tour-time-input") &&
        wtWalk.checked &&
        walkingTourTimePerOrderFlag
      ) {
        const idx = Number(wtWalk.dataset.orderWalkingTourIndex);
        const slotW = String(wtWalk.value || "").trim();
        const listW = getOrders();
        const ow = listW[idx];
        if (!ow) return;
        const partyW = walkingPartyForOrder(ow);
        if (!walkingTourSlotHasRoom(slotW, partyW, idx)) {
          alert(
            getI18nText(
              "orders_boat_slot_full",
              "This departure time already has the maximum number of passengers. Choose another time or reduce passengers in another booking."
            )
          );
          renderOrders();
          return;
        }
        listW[idx] = { ...ow, walkingTourDepartureTime: slotW };
        setOrders(listW);
        renderOrders();
        return;
      }
      if (!boatTimeRadioName || !boatTimeLSKey) return;
      if (t && t.name === boatTimeRadioName && t.type === "radio" && t.checked) {
        setBoatTimeSlot(t.value);
        renderOrders();
      }
    });

    // Event delegation (una sola vez)
    container.addEventListener("click", (e) => {
      const target = e.target;

      const addBtn = target.closest && target.closest("#addGuestBtn");
      if (addBtn) {
        e.preventDefault();
        if (!canOpenAnotherMenu()) return;
        openPopupForNewOrder();
        return;
      }

      const boatActEl = target.closest && target.closest("[data-boat-action]");
      if (boatActEl && boatLSKey) {
        e.preventDefault();
        if (boatActEl.disabled) return;
        const act = boatActEl.getAttribute("data-boat-action");
        const curBn = getBoatPassengers();
        if (act === "minus") {
          setBoatPassengers(curBn - 1);
          if (getBoatPassengers() <= 0 && boatTimeLSKey) setBoatTimeSlot("");
        } else if (act === "plus") {
          setBoatPassengers(curBn + 1);
        }
        renderOrders();
        return;
      }

      const walkingPartyEl = target.closest && target.closest("[data-walking-party-action]");
      if (walkingPartyEl && orderWalkingPartyMaxNum > 0 && orderLanguageRadioName) {
        e.preventDefault();
        if (walkingPartyEl.disabled) return;
        const idx = Number(walkingPartyEl.dataset.index);
        const ordList = getOrders();
        const o = ordList[idx];
        if (!o) return;
        let p = walkingPartyForOrder(o);
        const act = walkingPartyEl.getAttribute("data-walking-party-action");
        const walkCap =
          walkingTourTimePerOrderFlag && orderWalkingTourTime(o)
            ? maxWalkingPartyForOrderIndex(idx)
            : orderWalkingPartyMaxNum;
        if (act === "minus") p = Math.max(1, p - 1);
        else if (act === "plus") {
          if (p >= walkCap) {
            alert(
              getI18nText(
                "orders_boat_slot_full_short",
                "No more seats for this departure time. Add another booking with a different time or reduce passengers elsewhere."
              )
            );
            return;
          }
          p = Math.min(walkCap, p + 1);
        }
        ordList[idx] = { ...o, walkingPartyCount: p };
        setOrders(ordList);
        renderOrders();
        return;
      }

      const menuBoatPaxEl = target.closest && target.closest("[data-menu-boat-pax-action]");
      if (menuBoatPaxEl && menuWithPerOrderBoat) {
        e.preventDefault();
        if (menuBoatPaxEl.disabled) return;
        const idx = Number(menuBoatPaxEl.dataset.index);
        const ordList = getOrders();
        const o = ordList[idx];
        if (!o) return;
        let p = orderBoatPax(o);
        const act = menuBoatPaxEl.getAttribute("data-menu-boat-pax-action");
        const t = orderBoatTime(o);
        const slotCap = t ? maxPassengersForOrderIndex(idx) : boatMax;
        if (act === "minus") {
          const nextP = Math.max(0, p - 1);
          if (minusWouldViolateBoatMin(idx, nextP)) {
            alertBoatMinPassengers();
            return;
          }
          p = nextP;
        } else if (act === "plus") {
          if (p >= slotCap) {
            alert(
              getI18nText(
                "orders_boat_slot_full_short",
                "No more seats for this departure time. Add another booking with a different time or reduce passengers elsewhere."
              )
            );
            return;
          }
          p = p === 0 && boatMin > 0 ? Math.min(slotCap, boatMin) : Math.min(slotCap, p + 1);
        }
        const next = { ...o, boatPassengers: p };
        if (p === 0) next.boatDepartureTime = "";
        ordList[idx] = next;
        setOrders(ordList);
        renderOrders();
        return;
      }

      const paxActEl = target.closest && target.closest("[data-order-passengers-action]");
      if (paxActEl && boatTimePerOrderFlag && experienceSkipsMenuChoices) {
        e.preventDefault();
        if (paxActEl.disabled) return;
        const idx = Number(paxActEl.dataset.index);
        const ordList = getOrders();
        const o = ordList[idx];
        if (!o) return;
        let p = Math.max(1, Math.min(boatMax, Math.floor(Number(o.passengers) || 1)));
        const act = paxActEl.getAttribute("data-order-passengers-action");
        const slotCap = maxPassengersForOrderIndex(idx);
        if (act === "minus") {
          const nextP = Math.max(1, p - 1);
          if (minusWouldViolateBoatMin(idx, nextP)) {
            alertBoatMinPassengers();
            return;
          }
          p = nextP;
        } else if (act === "plus") {
          if (p >= slotCap) {
            alert(
              getI18nText(
                "orders_boat_slot_full_short",
                "No more seats for this departure time. Add another booking with a different time or reduce passengers elsewhere."
              )
            );
            return;
          }
          p = Math.min(slotCap, p + 1);
        }
        ordList[idx] = { ...o, passengers: p };
        setOrders(ordList);
        renderOrders();
        return;
      }

      const delEl = target.closest && target.closest(".delete-order");
      if (delEl) {
        const idx = Number(delEl.dataset.index);
        const orders = getOrders();
        orders.splice(idx, 1);
        if (rb) renumberRoomGuestIds(orders);
        setOrders(orders);
        renderOrders();
        return;
      }

      const editEl = target.closest && target.closest(".edit-order");
      if (editEl) {
        const idx = Number(editEl.dataset.index);
        const orders = getOrders();
        const order = orders[idx];
        if (!order) return;

        editingIndex = idx;
        fillPopupForEdit(order);
        popup.classList.add("active");
        saveBtn.textContent = getI18nText("update_order", "Update order");
        return;
      }

      const bookEl = target.closest && target.closest("#bookWithOrder");
      if (bookEl) {
        e.preventDefault();
        const orders = getOrders();
        if (orders.length === 0) return;
        if (!experienceBookReady()) return;
        sacramentoRunReserveWhatsAppFlow(async () => {
          const pendingTab = sacramentoOpenWhatsAppBlankTabForGesture();
          const peopleCount = peopleCountForPayment(orders);
          const transportTotal =
            vehicleTransportRate > 0 ? groupPrivateTransportTotal(peopleCount, vehicleTransportRate) : 0;
          const experienceSubtotal = groupExperienceSubtotal(orders);
          const ggAmt = groupGuideAmount();
          const boatPassengersPay = boatRate > 0 ? getTotalBoatPassengersPaid() : 0;
          const boatTotalPay = boatPassengersPay * boatRate;
          const total = calculateFinalPrice(orders);
          const boatTimesPayload = buildBoatTimesPayload(orders);
          const visitDate = getDateForBooking();
          const waSummary = buildWhatsAppMessage(orders, visitDate, "");
          let paymentUrl = "";
          try {
            paymentUrl = await resolveDynamicPaymentLink(dynamicPayment, {
              experience: dynamicPayment?.experienceId || experienceName,
              amount: total,
              currency: dynamicPayment?.currency || "USD",
              people: peopleCount,
              orderFingerprint: stableStringify({
                orders,
                total,
                people: peopleCount,
                groupGuide: ggAmt,
                boatPassengers: boatPassengersPay,
                boatPerPerson: boatRate,
                boatDepartureTime: boatTimesPayload,
                rooms: rb ? getRoomRows() : null,
                roomSubtotal: rb ? calculateTotalRoomCost() : 0
              }),
              orderPayload: withWhatsAppInOrderPayload(
                {
                  orders,
                  total,
                  people: peopleCount,
                  experienceName,
                  visitDate,
                  groupGuideFlat: ggAmt,
                  boatPassengers: boatPassengersPay,
                  boatPerPerson: boatRate,
                  boatSubtotal: boatTotalPay,
                  boatDepartureTime: boatTimesPayload,
                  rooms: rb ? getRoomRows() : null,
                  roomSubtotal: rb ? calculateTotalRoomCost() : 0
                },
                waSummary
              )
            });
          } catch {}
          const message = buildWhatsAppMessage(orders, visitDate, paymentUrl);
          sacramentoOpenWhatsApp(whatsappNumber, message, pendingTab);
        });
      }
    });

    if (groupGuideOptional && groupGuideCheckboxId) {
      const gel = groupGuideEl();
      if (gel) {
        gel.checked = getGroupGuideStored();
        gel.addEventListener("change", () => {
          setGroupGuideStored(gel.checked);
          renderOrders();
        });
      }
    }

    document.addEventListener("sacramento:setLanguage", () => {
      renderOrders();
      if (rb && rbHost) renderRoomBookingPanel();
    });

    document.addEventListener("sacramento:visitDateChanged", (e) => {
      if (!selectedDateKey) return;
      if (e.detail && e.detail.key && e.detail.key !== selectedDateKey) return;
      renderOrders();
    });

    document.addEventListener("sacramento:visitTimeChanged", () => {
      if (!visitTimeApi) return;
      renderOrders();
    });

    if (menuUpgradePrice && menuTierPanelIds) {
      syncMenuTierPanels(true);
    }

    window.__SACRAMENTO_BOOKING__ = {
      calculateGuestsFromRooms,
      calculateTotalGuests,
      calculateFinalPrice,
      calculateTotalRoomCost,
      getRoomRows,
      sacramentoCalculateGuestsFromRooms,
      sacramentoCalculateRoomRowsCost,
      sacramentoCalculateTotalGuestsFromState
    };

    window.renderOrders = renderOrders;

    renderOrders();

    if (bookNowBottomId) {
      const bottomBtn = document.getElementById(bookNowBottomId);
      if (bottomBtn) {
        bottomBtn.addEventListener("click", (e) => {
          e.preventDefault();
          const orders = getOrders();
          if (orders.length === 0) {
            alert(getI18nText("orders_alert_create_first", "Please create your order first."));
            return;
          }
          if (!experienceBookReady()) return;
          sacramentoRunReserveWhatsAppFlow(async () => {
            const pendingTab = sacramentoOpenWhatsAppBlankTabForGesture();
            const peopleCount = peopleCountForPayment(orders);
            const transportTotal =
              vehicleTransportRate > 0 ? groupPrivateTransportTotal(peopleCount, vehicleTransportRate) : 0;
            const experienceSubtotal = groupExperienceSubtotal(orders);
            const ggAmt = groupGuideAmount();
            const boatPassengersPay = boatRate > 0 ? getTotalBoatPassengersPaid() : 0;
            const boatTotalPay = boatPassengersPay * boatRate;
            const total = calculateFinalPrice(orders);
            const boatTimesPayload = buildBoatTimesPayload(orders);
            const visitDate = getDateForBooking();
            const waSummary = buildWhatsAppMessage(orders, visitDate, "");
            let paymentUrl = "";
            try {
              paymentUrl = await resolveDynamicPaymentLink(dynamicPayment, {
                experience: dynamicPayment?.experienceId || experienceName,
                amount: total,
                currency: dynamicPayment?.currency || "USD",
                people: peopleCount,
                orderFingerprint: stableStringify({
                  orders,
                  total,
                  people: peopleCount,
                  groupGuide: ggAmt,
                  boatPassengers: boatPassengersPay,
                  boatPerPerson: boatRate,
                  boatDepartureTime: boatTimesPayload,
                  rooms: rb ? getRoomRows() : null,
                  roomSubtotal: rb ? calculateTotalRoomCost() : 0
                }),
                orderPayload: withWhatsAppInOrderPayload(
                  {
                    orders,
                    total,
                    people: peopleCount,
                    experienceName,
                    visitDate,
                    groupGuideFlat: ggAmt,
                    boatPassengers: boatPassengersPay,
                    boatPerPerson: boatRate,
                    boatSubtotal: boatTotalPay,
                    boatDepartureTime: boatTimesPayload,
                    rooms: rb ? getRoomRows() : null,
                    roomSubtotal: rb ? calculateTotalRoomCost() : 0
                  },
                  waSummary
                )
              });
            } catch {}
            const message = buildWhatsAppMessage(orders, visitDate, paymentUrl);
            sacramentoOpenWhatsApp(whatsappNumber, message, pendingTab);
          });
        });
      }
    }

    // Re-render texts when language buttons are clicked.
    document.querySelectorAll(".lang-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        renderOrders();
        if (rb && rbHost) renderRoomBookingPanel();
        if (popup.classList.contains("active")) {
          saveBtn.textContent =
            editingIndex !== null
              ? getI18nText("update_order", "Update order")
              : getI18nText("save_selection", "Save selection");
        }
      });
    });
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bootExperience, { once: true });
  } else {
    bootExperience();
  }
}

/**
 * Init para la página "Food" donde hay un menú principal y, si eliges "tourist",
 * aparecen opciones extra (starter + touristMain) dentro de #touristOptions.
 */
function initFoodExperience(config) {
  const {
    pricePerPerson,
    experienceName = "Food",
    experienceNameKey = null,
    whatsappNumber = "59898945542",
    popupId = "popupBruma",
    closeBtnId = "closeBruma",
    createBtnId = "createMenuBtn",
    saveBtnId = "saveMenu",
    orderSummaryId = "orderSummary",
    touristOptionsId = "touristOptions",
    bookNowBottomId,
    storageKey = "orders",
    dynamicPayment = null,
    whatsappIncludesTitleKey = null,
    whatsappIncludesKeys = [],
    mainName = "main",
    starterName = "starter",
    touristMainName = "touristMain",
    defaultMainValue = "",
    selectedDateKey = null
  } = config || {};

  if (!pricePerPerson) {
    console.error("initFoodExperience: config incompleta (pricePerPerson)");
    return;
  }

  document.addEventListener("DOMContentLoaded", () => {
    let editingIndex = null;
    const getI18nText = (key, fallback) => {
      const lang = getSiteLanguage();
      const tr = sacramentoI18nTable();
      try {
        if (tr?.[lang]?.[key]) return tr[lang][key];
        if (tr?.en?.[key]) return tr.en[key];
      } catch {}
      return fallback;
    };
    const I18N_PREF_PREFIX = SACRAMENTO_I18N_PREF;
    const normalizePrefText = sacramentoNormalizePrefText;
    const encodePref = (keyOrLabel) => {
      const raw = String(keyOrLabel || "").trim();
      if (!raw) return "";
      return raw.startsWith(I18N_PREF_PREFIX) ? raw : `${I18N_PREF_PREFIX}${raw}`;
    };
    const decodePref = (storedPref) => sacramentoDecodePrefLabel(storedPref, getI18nText, I18N_PREF_PREFIX);
    const decoratePref = (storedPref) => sacramentoDecoratePref(storedPref, getI18nText, I18N_PREF_PREFIX);
    const getDateForBooking = () => {
      if (!selectedDateKey) return "-";
      const stored = localStorage.getItem(selectedDateKey);
      return stored && /^\d{4}-\d{2}-\d{2}$/.test(stored) ? stored : "-";
    };

    const FOOD_MEAL_I18N_KEYS = [
      "food_popup_main_1",
      "food_popup_main_2",
      "food_popup_main_3",
      "chivito_popup_main_pan",
      "chivito_popup_main_plato",
      "food_tourist_starter_1",
      "food_tourist_starter_2",
      "food_tourist_starter_3",
      "food_tourist_main_1",
      "food_tourist_main_2",
      "food_tourist_main_3"
    ];
    const mealLabelMap = (() => {
      const map = Object.create(null);
      try {
        ["en", "es", "pt"].forEach((lang) => {
          FOOD_MEAL_I18N_KEYS.forEach((key) => {
            const t = sacramentoI18nTable()?.[lang]?.[key];
            if (t) map[normalizePrefText(t)] = key;
          });
        });
      } catch {}
      return map;
    })();
    const mainRadioValueToKey = {
      chivito: "food_popup_main_1",
      chivito_pan: "chivito_popup_main_pan",
      chivito_plato: "chivito_popup_main_plato",
      milanesa: "food_popup_main_2",
      tourist: "food_popup_main_3"
    };

    const escapeHtml = (str) =>
      String(str).replace(/[&<>"']/g, (m) => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
      }[m]));

    const getOrders = () => {
      try {
        const parsed = JSON.parse(localStorage.getItem(storageKey)) || [];
        if (!Array.isArray(parsed)) return [];
        let mutated = false;
        const migrated = parsed.map((order) => {
          if (!order) return order;
          let next = { ...order };
          if (!Array.isArray(next.preferences)) next.preferences = [];

          const nextPrefs = next.preferences.map((pref) => {
            const raw = String(pref || "").trim();
            if (!raw) return raw;
            if (raw.startsWith(I18N_PREF_PREFIX)) return raw;
            const legacyKey = sacramentoLegacyPrefKey(raw);
            if (!legacyKey) return raw;
            mutated = true;
            return encodePref(legacyKey);
          });
          next.preferences = nextPrefs;

          ["main", "starter", "touristMain"].forEach((field) => {
            const v = next[field];
            if (v == null || v === "") return;
            const str = String(v).trim();
            if (!str || str.startsWith(I18N_PREF_PREFIX)) return;
            if (field === "main") {
              const aliasKey = mainRadioValueToKey[str.toLowerCase()];
              if (aliasKey) {
                next[field] = encodePref(aliasKey);
                mutated = true;
                return;
              }
            }
            const mapped = mealLabelMap[normalizePrefText(str)];
            if (mapped) {
              next[field] = encodePref(mapped);
              mutated = true;
            }
          });

          return next;
        });
        if (mutated) {
          localStorage.setItem(storageKey, JSON.stringify(migrated));
        }
        return migrated;
      } catch {
        return [];
      }
    };

    const setOrders = (orders) => {
      localStorage.setItem(storageKey, JSON.stringify(orders));
    };

    const popup = document.getElementById(popupId);
    const closeBtn = document.getElementById(closeBtnId);
    const createBtn = document.getElementById(createBtnId);
    const saveBtn = document.getElementById(saveBtnId);
    const container = document.getElementById(orderSummaryId);
    const touristBlock = document.getElementById(touristOptionsId);

    if (!popup || !closeBtn || !createBtn || !saveBtn || !container) return;

    const setTouristBlockVisible = (visible) => {
      if (touristBlock) touristBlock.style.display = visible ? "block" : "none";
    };

    const resetPopup = () => {
      popup.querySelectorAll('input[type="radio"]').forEach((i) => (i.checked = false));
      popup.querySelectorAll('.preferences-inside input[type="checkbox"]').forEach((i) => (i.checked = false));
      setTouristBlockVisible(false);
      if (defaultMainValue) {
        const defaultMain = popup.querySelector(`input[name="${mainName}"][value="${defaultMainValue}"]`);
        if (defaultMain) {
          defaultMain.checked = true;
          setTouristBlockVisible(defaultMainValue === "tourist");
        }
      }
    };

    // Mostrar/ocultar opciones "tourist"
    if (touristBlock) {
      popup.querySelectorAll(`input[name="${mainName}"]`).forEach((opt) => {
        opt.addEventListener("change", () => {
          if (opt.checked && opt.value === "tourist") {
            setTouristBlockVisible(true);
          } else {
            setTouristBlockVisible(false);
          }
        });
      });
    }

    createBtn.addEventListener("click", (e) => {
      e.preventDefault();
      editingIndex = null;
      saveBtn.textContent = getI18nText("save_selection", "Save selection");
      resetPopup();
      popup.classList.add("active");
    });

    closeBtn.addEventListener("click", (e) => {
      e.preventDefault();
      popup.classList.remove("active");
    });

    saveBtn.addEventListener("click", (e) => {
      e.preventDefault();

      const orders = getOrders();

      const main = popup.querySelector(`input[name="${mainName}"]:checked`);
      if (!main) {
        alert(getI18nText("food_alert_select_meal", "Select a meal"));
        return;
      }

      const mainSpan =
        main.parentElement?.querySelector("span[data-translate]") ||
        (main.nextElementSibling?.matches?.("[data-translate]") ? main.nextElementSibling : null);
      const mainI18nKey = mainSpan?.dataset?.translate;
      const mainVal = String(main.value || "").trim();
      const mainStored = mainI18nKey
        ? encodePref(mainI18nKey)
        : mainRadioValueToKey[mainVal.toLowerCase()]
          ? encodePref(mainRadioValueToKey[mainVal.toLowerCase()])
          : mainVal;

      const preferences = Array.from(
        popup.querySelectorAll('.preferences-inside input[type="checkbox"]:checked')
      ).map((el) => {
        const trSpan = el.parentElement?.querySelector("span[data-translate]");
        const trKey = trSpan?.dataset?.translate;
        if (trKey) return encodePref(trKey);
        return el.parentElement.textContent.trim();
      });

      let starter = null;
      let touristMain = null;

      if (main.value === "tourist") {
        if (!touristBlock) {
          alert(getI18nText("food_alert_select_meal", "Select a meal"));
          return;
        }
        const starterSelected = touristBlock.querySelector(`input[name="${starterName}"]:checked`);
        const touristMainSelected = touristBlock.querySelector(`input[name="${touristMainName}"]:checked`);

        if (!starterSelected || !touristMainSelected) {
          alert(
            getI18nText(
              "food_alert_complete_tourist",
              "Please choose starter and main for the tourist menu"
            )
          );
          return;
        }

        const stSpan = starterSelected.parentElement?.querySelector("span[data-translate]");
        const stKey = stSpan?.dataset?.translate;
        starter = stKey ? encodePref(stKey) : starterSelected.parentElement.textContent.trim();

        const tmSpan = touristMainSelected.parentElement?.querySelector("span[data-translate]");
        const tmKey = tmSpan?.dataset?.translate;
        touristMain = tmKey
          ? encodePref(tmKey)
          : touristMainSelected.parentElement.textContent.trim();
      }

      const order = {
        main: mainStored,
        starter,
        touristMain,
        preferences
      };

      if (editingIndex !== null) {
        orders[editingIndex] = order;
        editingIndex = null;
      } else {
        orders.push(order);
      }

      setOrders(orders);
      popup.classList.remove("active");
      renderOrders();
      scrollToOrderSummary(orderSummaryId);
    });

    const renderOrders = () => {
      const orders = getOrders();

      let html = `
        <div class="order-container">
          <h2>${escapeHtml(getI18nText("your_order", "Your order"))}</h2>
      `;

      if (orders.length > 0) {
        html += `
          <button id="addGuestBtn" class="add-guest-btn">
            + ${escapeHtml(getI18nText("add_order", "Add Order"))}
          </button>
        `;
      }

      if (selectedDateKey) {
        html += `<p class="order-summary-visit-date"><strong>${escapeHtml(
          getI18nText("orders_visit_date_label", "Visit date")
        )}:</strong> ${escapeHtml(getDateForBooking())}</p>`;
      }

      orders.forEach((order, i) => {
        const mainDisplay = order.touristMain ? decodePref(order.touristMain) : decodePref(order.main);
        const prefs = Array.isArray(order.preferences) ? order.preferences : [];
        const prefsLocalized = prefs.map((p) => decoratePref(p)).filter(Boolean);

        html += `
          <div class="order-card">
            <div class="order-header">
              <h3 class="order-card-title">${escapeHtml(getI18nText("order_word", "Order"))} ${i + 1}</h3>
              <div class="order-actions">
                <span class="edit-order" data-index="${i}">✏️</span>
                <span class="delete-order" data-index="${i}">🗑️</span>
              </div>
            </div>
            <p><strong>${escapeHtml(getI18nText("bruma_popup_main", "Main Course"))}:</strong> ${escapeHtml(mainDisplay || "-")}</p>
            ${order.starter ? `<p><strong>${escapeHtml(getI18nText("bruma_popup_starter", "Starter"))}:</strong> ${escapeHtml(decodePref(order.starter))}</p>` : ""}
            ${order.touristMain ? `<p><strong>${escapeHtml(getI18nText("dessert_word", "Dessert"))}:</strong> ${escapeHtml(getI18nText("food_tourist_dessert_1", "Traditional Uruguayan Chajá"))}</p>` : ""}
            <p><strong>${escapeHtml(getI18nText("preferences_word", "Preferences"))}:</strong> ${escapeHtml(prefsLocalized.join(", ") || "-")}</p>
          </div>
        `;
      });

      if (orders.length > 0) {
        const total = orders.length * pricePerPerson;
        html += `
          <div class="total-box">
            <div class="total-left">
              <span class="total-label">Total</span>
              <span class="total-detail">(${orders.length} x USD ${pricePerPerson})</span>
            </div>
            <div class="total-right">
              USD ${total}
            </div>
            <a href="#" id="bookWithOrder" class="btn total-btn">
              ${escapeHtml(getI18nText("book_btn", "Reserve"))}
            </a>
          </div>
        `;
      }

      html += `</div>`;
      container.innerHTML = html;
    };

    const buildFoodWhatsAppMessage = (orders, paymentLinkOverride = "") => {
      const waIntro = getI18nText(
        "wa_booking_intro",
        "Hello! I’d like to book the"
      );
      const waExperienceWord = getI18nText("wa_experience_word", "experience");
      const waOrderWord = getI18nText("order_word", "Order");
      const waTotalLabel = getI18nText("wa_total_label", "Total");
      const waMainLabel = getI18nText("bruma_popup_main", "Main Course");
      const waStarterLabel = getI18nText("bruma_popup_starter", "Starter");
      const waDessertLabel = getI18nText("dessert_word", "Dessert");
      const waPreferencesLabel = getI18nText("preferences_word", "Preferences");
      const localizedExperienceName = experienceNameKey
        ? getI18nText(experienceNameKey, experienceName)
        : experienceName;
      const normalizedExpName = String(localizedExperienceName || "").trim().toLowerCase();
      const normalizedExpWord = String(waExperienceWord || "").trim().toLowerCase();
      const includeExpWord =
        normalizedExpWord &&
        !normalizedExpName.endsWith(normalizedExpWord);
      const waLine = [waIntro, localizedExperienceName, includeExpWord ? waExperienceWord : ""]
        .filter(Boolean)
        .join(" ");
      let message = `${waLine}:\n\n`;
      if (selectedDateKey) {
        const visitDate = getDateForBooking();
        if (visitDate && visitDate !== "-") {
          message += `*${getI18nText("orders_visit_date_label", "Visit date")}:* ${visitDate}\n\n`;
        }
      }
      if (Array.isArray(whatsappIncludesKeys) && whatsappIncludesKeys.length > 0) {
        const includesTitle = whatsappIncludesTitleKey
          ? getI18nText(whatsappIncludesTitleKey, "What's included")
          : getI18nText("wa_includes_label", "What's included");
        message += `*${includesTitle}:*\n`;
        whatsappIncludesKeys.forEach((key) => {
          const line = getI18nText(key, key);
          message += `• ${line}\n`;
        });
        message += `\n`;
      }
      orders.forEach((o, i) => {
        const mainDisplay = o.touristMain ? decodePref(o.touristMain) : decodePref(o.main);
        const prefs = Array.isArray(o.preferences) ? o.preferences : [];
        const prefsLocalized = prefs.map((p) => decoratePref(p)).filter(Boolean);
        message += `*${waOrderWord} ${i + 1}*\n`;
        message += `${waMainLabel}: ${mainDisplay || "-"}\n`;
        if (o.starter) {
          message += `${waStarterLabel}: ${decodePref(o.starter)}\n`;
        }
        if (o.touristMain) {
          message += `${waDessertLabel}: ${getI18nText("food_tourist_dessert_1", "Traditional Uruguayan Chajá")}\n`;
        }
        message += `${waPreferencesLabel}: ${prefsLocalized.join(", ") || "-"}\n\n`;
      });
      const total = orders.length * pricePerPerson;
      message += `*${waTotalLabel}:* USD ${total}`;
      if (paymentLinkOverride) {
        message += `\n\n${getI18nText("wa_payment_cta", "To confirm the reservation, please complete the payment here:")}\n${paymentLinkOverride}`;
        message += `\n\n${getI18nText(
          "food_post_payment_note",
          "After payment, we will send your reservation details and instructions."
        )}`;
      }
      return { message, total };
    };

    container.addEventListener("click", (e) => {
      const target = e.target;

      const addBtn = target.closest && target.closest("#addGuestBtn");
      if (addBtn) {
        e.preventDefault();
        editingIndex = null;
        saveBtn.textContent = getI18nText("save_selection", "Save selection");
        resetPopup();
        popup.classList.add("active");
        return;
      }

      const delEl = target.closest && target.closest(".delete-order");
      if (delEl) {
        const idx = Number(delEl.dataset.index);
        const orders = getOrders();
        orders.splice(idx, 1);
        setOrders(orders);
        renderOrders();
        return;
      }

      const editEl = target.closest && target.closest(".edit-order");
      if (editEl) {
        const idx = Number(editEl.dataset.index);
        const orders = getOrders();
        const order = orders[idx];
        if (!order) return;

        editingIndex = idx;
        resetPopup();

        if (order.touristMain) {
          const touristRadio = popup.querySelector(`input[name="${mainName}"][value="tourist"]`);
          if (touristRadio) touristRadio.checked = true;
          setTouristBlockVisible(true);

          popup.querySelectorAll(`input[name="${starterName}"]`).forEach((r) => {
            const span = r.parentElement?.querySelector("span[data-translate]");
            const k = span?.dataset?.translate;
            const enc = k ? encodePref(k) : "";
            const legacyText = r.parentElement?.textContent?.trim();
            if (
              (enc && enc === order.starter) ||
              (legacyText && (legacyText === order.starter || legacyText === decodePref(order.starter)))
            ) {
              r.checked = true;
            }
          });

          if (touristBlock) {
            touristBlock.querySelectorAll(`input[name="${touristMainName}"]`).forEach((r) => {
              const span = r.parentElement?.querySelector("span[data-translate]");
              const k = span?.dataset?.translate;
              const enc = k ? encodePref(k) : "";
              const legacyText = r.parentElement?.textContent?.trim();
              if (
                (enc && enc === order.touristMain) ||
                (legacyText &&
                  (legacyText === order.touristMain || legacyText === decodePref(order.touristMain)))
              ) {
                r.checked = true;
              }
            });
          }
        } else {
          popup.querySelectorAll(`input[name="${mainName}"]`).forEach((r) => {
            const span =
              r.parentElement?.querySelector("span[data-translate]") ||
              (r.nextElementSibling?.matches?.("[data-translate]") ? r.nextElementSibling : null);
            const k = span?.dataset?.translate;
            const enc = k ? encodePref(k) : "";
            const labelText = span?.textContent?.trim();
            if (
              (enc && enc === order.main) ||
              (labelText &&
                (labelText === order.main || labelText === decodePref(order.main)))
            ) {
              r.checked = true;
            }
          });
          setTouristBlockVisible(false);
        }

        const prefSet = new Set(Array.isArray(order.preferences) ? order.preferences : []);
        popup.querySelectorAll('.preferences-inside input[type="checkbox"]').forEach((cb) => {
          const trSpan = cb.parentElement?.querySelector("span[data-translate]");
          const trKey = trSpan?.dataset?.translate;
          const labelText = cb.parentElement?.textContent?.trim();
          const encoded = trKey ? encodePref(trKey) : "";
          cb.checked = (encoded && prefSet.has(encoded)) || prefSet.has(labelText);
        });

        saveBtn.textContent = getI18nText("update_order", "Update order");
        popup.classList.add("active");
        return;
      }

      const bookEl = target.closest && target.closest("#bookWithOrder");
      if (bookEl) {
        e.preventDefault();
        const orders = getOrders();
        if (orders.length === 0) return;
        sacramentoRunReserveWhatsAppFlow(async () => {
          const pendingTab = sacramentoOpenWhatsAppBlankTabForGesture();
          const base = buildFoodWhatsAppMessage(orders);
          let finalMessage = base.message;
          try {
            const paymentUrl = await resolveDynamicPaymentLink(dynamicPayment, {
              experience: dynamicPayment?.experienceId || experienceName,
              amount: base.total,
              currency: dynamicPayment?.currency || "USD",
              people: orders.length,
              orderFingerprint: stableStringify({ orders, total: base.total }),
              orderPayload: withWhatsAppInOrderPayload(
                { orders, total: base.total, experienceName, visitDate: getDateForBooking() },
                base.message
              )
            });
            if (paymentUrl) {
              finalMessage = buildFoodWhatsAppMessage(orders, paymentUrl).message;
            }
          } catch {}
          sacramentoOpenWhatsApp(whatsappNumber, finalMessage, pendingTab);
        });
      }
    });

    if (bookNowBottomId) {
      const bottomBtn = document.getElementById(bookNowBottomId);
      if (bottomBtn) {
        bottomBtn.addEventListener("click", (e) => {
          e.preventDefault();
          const orders = getOrders();
          if (orders.length === 0) {
            alert(getI18nText("orders_alert_create_first", "Please create your order first."));
            return;
          }
          sacramentoRunReserveWhatsAppFlow(async () => {
            const pendingTab = sacramentoOpenWhatsAppBlankTabForGesture();
            const base = buildFoodWhatsAppMessage(orders);
            let finalMessage = base.message;
            try {
              const paymentUrl = await resolveDynamicPaymentLink(dynamicPayment, {
                experience: dynamicPayment?.experienceId || experienceName,
                amount: base.total,
                currency: dynamicPayment?.currency || "USD",
                people: orders.length,
                orderFingerprint: stableStringify({ orders, total: base.total }),
                orderPayload: withWhatsAppInOrderPayload(
                  { orders, total: base.total, experienceName, visitDate: getDateForBooking() },
                  base.message
                )
              });
              if (paymentUrl) {
                finalMessage = buildFoodWhatsAppMessage(orders, paymentUrl).message;
              }
            } catch {}
            sacramentoOpenWhatsApp(whatsappNumber, finalMessage, pendingTab);
          });
        });
      }
    }

    document.addEventListener("sacramento:setLanguage", () => {
      renderOrders();
      if (popup.classList.contains("active")) {
        saveBtn.textContent =
          editingIndex !== null
            ? getI18nText("update_order", "Update order")
            : getI18nText("save_selection", "Save selection");
      }
    });

    document.addEventListener("sacramento:visitDateChanged", (e) => {
      if (!selectedDateKey) return;
      if (e.detail && e.detail.key && e.detail.key !== selectedDateKey) return;
      renderOrders();
    });

    renderOrders();
  });
}

/**
 * Init para experiencias donde el "menú" se define solo por preferencias (checkboxes) dentro de un popup.
 * Guarda en localStorage una lista de "orders" con la forma: { preferences: string[] }.
 */
function initPreferencesOrderExperience(config) {
  const {
    pricePerPerson,
    paymentLinks = {},
    dynamicPayment = null,
    experienceName = "experience",
    popupId,
    createBtnId,
    closeBtnId,
    saveBtnId,
    orderSummaryId = "orderSummary",
    whatsappNumber = "59898945542",
    storageKey = "orders",
    bookNowBottomId
  } = config || {};

  if (!popupId || !createBtnId || !closeBtnId || !saveBtnId || !orderSummaryId) {
    console.error("initPreferencesOrderExperience: config incompleta");
    return;
  }

  document.addEventListener("DOMContentLoaded", () => {
    let editingIndex = null;

    const popup = document.getElementById(popupId);
    const createBtn = document.getElementById(createBtnId);
    const closeBtn = document.getElementById(closeBtnId);
    const saveBtn = document.getElementById(saveBtnId);
    const container = document.getElementById(orderSummaryId);

    if (!popup || !createBtn || !closeBtn || !saveBtn || !container) return;

    const escapeHtml = (str) =>
      String(str).replace(/[&<>"']/g, (m) => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
      }[m]));

    const getOrders = () => {
      try {
        return JSON.parse(localStorage.getItem(storageKey)) || [];
      } catch {
        return [];
      }
    };

    const setOrders = (orders) => {
      localStorage.setItem(storageKey, JSON.stringify(orders));
    };

    const preferenceCheckboxes = () =>
      popup.querySelectorAll(".preferences-inside input[type='checkbox']");

    const readSelectedPreferences = () =>
      Array.from(preferenceCheckboxes())
        .filter((i) => i.checked)
        .map((i) => i.value)
        .filter(Boolean);

    const resetPopup = () => {
      preferenceCheckboxes().forEach((i) => {
        i.checked = false;
      });
      editingIndex = null;
      saveBtn.textContent = "Save selection";
    };

    const openPopup = () => {
      resetPopup();
      popup.classList.add("active");
      popup.setAttribute("aria-hidden", "false");
    };

    const closePopup = () => {
      popup.classList.remove("active");
      popup.setAttribute("aria-hidden", "true");
    };

    const formatDate = () =>
      new Date().toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric"
      });

    const buildWhatsAppMessage = (orders, paymentLinkOverride = "") => {
      const people = orders.length;
      const date = formatDate();

      let ordersText = "";
      orders.forEach((o, i) => {
        const prefs = Array.isArray(o.preferences) ? o.preferences : [];
        ordersText += `*Order ${i + 1}*\nPreferences: ${prefs.join(", ") || "-"}\n\n`;
      });

      const dynamicEnabled = Boolean(dynamicPayment && dynamicPayment.enabled);
      const paymentLink = paymentLinkOverride || (!dynamicEnabled ? paymentLinks[people] || "" : "");
      let message = `Hello! I’d like to book the ${experienceName} experience:\n\nDate: ${date}\nPeople: ${people}\n\n${ordersText}Total: USD ${people * pricePerPerson}\n`;

      if (paymentLink) {
        message += `\nTo confirm the reservation, please complete the payment here:\n${paymentLink}`;
      } else if (people > 0) {
        if (dynamicEnabled) {
          message += `\nPayment link could not be generated automatically yet. Please confirm and we will send it right away.`;
          return message;
        }
        message += `\nWe are a group of more than 5 people and would like to coordinate the reservation.`;
      }

      return message;
    };

    const renderOrders = () => {
      const orders = getOrders();

      container.innerHTML = "";

      const title = document.createElement("h3");
      title.textContent = "Your order";
      container.appendChild(title);

      if (orders.length === 0) return;

      const addBtn = document.createElement("button");
      addBtn.id = "addGuestBtn";
      addBtn.type = "button";
      addBtn.className = "add-guest-btn";
      addBtn.textContent = "+ Add Order";
      container.appendChild(addBtn);

      orders.forEach((order, index) => {
        const card = document.createElement("div");
        card.className = "order-card";

        const header = document.createElement("div");
        header.className = "order-header";

        const orderTitle = document.createElement("strong");
        orderTitle.textContent = `Order ${index + 1}`;

        const actions = document.createElement("div");
        actions.className = "order-actions";

        const edit = document.createElement("span");
        edit.className = "edit-order";
        edit.dataset.index = String(index);
        edit.textContent = "✏️";

        const del = document.createElement("span");
        del.className = "delete-order";
        del.dataset.index = String(index);
        del.textContent = "🗑️";

        actions.appendChild(edit);
        actions.appendChild(del);

        header.appendChild(orderTitle);
        header.appendChild(actions);
        card.appendChild(header);

        const prefs = Array.isArray(order.preferences) ? order.preferences : [];
        const prefsP = document.createElement("p");
        prefsP.innerHTML = `<strong>Preferences:</strong> ${escapeHtml(prefs.join(", ") || "-")}`;
        card.appendChild(prefsP);

        container.appendChild(card);
      });

      const people = orders.length;
      const total = people * pricePerPerson;

      const totalBox = document.createElement("div");
      totalBox.className = "total-box";
      totalBox.innerHTML = `
        <div class="total-left">
          <span class="total-label">Total</span>
          <span class="total-detail">(${people} x USD ${pricePerPerson})</span>
        </div>
        <div class="total-right">USD ${total}</div>
      `;

      const book = document.createElement("a");
      book.href = "#";
      book.id = "bookWithOrder";
      book.className = "btn total-btn";
      book.textContent = "Reserve";
      totalBox.appendChild(book);

      container.appendChild(totalBox);
    };

    // Event delegation: evita re-enganchar listeners en cada render.
    container.addEventListener("click", (e) => {
      const target = e.target;

      const addBtn = target.closest && target.closest("#addGuestBtn");
      if (addBtn) {
        openPopup();
        return;
      }

      const editEl = target.closest && target.closest(".edit-order");
      if (editEl) {
        const orders = getOrders();
        const idx = Number(editEl.dataset.index);
        const order = orders[idx];
        if (!order) return;

        editingIndex = idx;

        const selected = new Set(Array.isArray(order.preferences) ? order.preferences : []);
        preferenceCheckboxes().forEach((i) => {
          i.checked = selected.has(i.value);
        });

        saveBtn.textContent = "Update order";
        popup.classList.add("active");
        popup.setAttribute("aria-hidden", "false");
        return;
      }

      const delEl = target.closest && target.closest(".delete-order");
      if (delEl) {
        const orders = getOrders();
        const idx = Number(delEl.dataset.index);
        orders.splice(idx, 1);
        setOrders(orders);
        renderOrders();
        return;
      }

      const bookEl = target.closest && target.closest("#bookWithOrder");
      if (bookEl) {
        e.preventDefault();

        const orders = getOrders();
        if (orders.length === 0) return;

        sacramentoRunReserveWhatsAppFlow(async () => {
          const pendingTab = sacramentoOpenWhatsAppBlankTabForGesture();
          const people = orders.length;
          const total = people * pricePerPerson;
          const waSummary = buildWhatsAppMessage(orders, "");
          let paymentUrl = "";
          try {
            paymentUrl = await resolveDynamicPaymentLink(dynamicPayment, {
              experience: dynamicPayment?.experienceId || experienceName,
              amount: total,
              currency: dynamicPayment?.currency || "USD",
              people,
              orderFingerprint: stableStringify({ orders, total, people }),
              orderPayload: withWhatsAppInOrderPayload(
                { orders, total, people, experienceName },
                waSummary
              )
            });
          } catch {}
          const message = buildWhatsAppMessage(orders, paymentUrl);
          sacramentoOpenWhatsApp(whatsappNumber, message, pendingTab);
        });
      }
    });

    // Popup buttons
    createBtn.addEventListener("click", (e) => {
      e.preventDefault();
      openPopup();
    });

    closeBtn.addEventListener("click", (e) => {
      e.preventDefault();
      closePopup();
    });

    saveBtn.addEventListener("click", (e) => {
      e.preventDefault();

      const orders = getOrders();
      const preferences = readSelectedPreferences();

      if (preferences.length === 0) {
        alert("Please select at least one preference");
        return;
      }

      const order = { preferences };

      if (editingIndex !== null) {
        orders[editingIndex] = order;
      } else {
        orders.push(order);
      }

      setOrders(orders);
      closePopup();
      renderOrders();
      scrollToOrderSummary(orderSummaryId);
    });

    // Botón "Book Now" inferior (opcional)
    if (bookNowBottomId) {
      const bottomBtn = document.getElementById(bookNowBottomId);
      if (bottomBtn) {
        bottomBtn.addEventListener("click", (e) => {
          e.preventDefault();
          const orders = getOrders();
          if (orders.length === 0) {
            alert(getI18nText("orders_alert_create_first", "Please create your order first."));
            return;
          }

          sacramentoRunReserveWhatsAppFlow(async () => {
            const pendingTab = sacramentoOpenWhatsAppBlankTabForGesture();
            const people = orders.length;
            const total = people * pricePerPerson;
            const waSummary = buildWhatsAppMessage(orders, "");
            let paymentUrl = "";
            try {
              paymentUrl = await resolveDynamicPaymentLink(dynamicPayment, {
                experience: dynamicPayment?.experienceId || experienceName,
                amount: total,
                currency: dynamicPayment?.currency || "USD",
                people,
                orderFingerprint: stableStringify({ orders, total, people }),
                orderPayload: withWhatsAppInOrderPayload(
                  { orders, total, people, experienceName },
                  waSummary
                )
              });
            } catch {}
            const message = buildWhatsAppMessage(orders, paymentUrl);
            sacramentoOpenWhatsApp(whatsappNumber, message, pendingTab);
          });
        });
      }
    }

    renderOrders();
  });
}

/**
 * Transporte privado por vehículo (hasta 4 personas por taxi, asientos incluidos).
 * @param {number} guestCount — huéspedes / comensales
 * @param {number} ratePerVehicle — USD por vehículo
 * @param {number} [extraSeats=0] — asientos extra (ej. 1 guía por grupo en Full Day)
 */
function groupPrivateTransportTotal(guestCount, ratePerVehicle, extraSeats = 0) {
  const rate = Number(ratePerVehicle) || 0;
  const n = Math.max(0, Math.floor(Number(guestCount) || 0));
  const extra = Math.max(0, Math.floor(Number(extraSeats) || 0));
  if (n === 0 || rate <= 0) return 0;
  const vehicles = Math.ceil((n + extra) / 4);
  return vehicles * rate;
}

function groupPrivateTransportVehicleCount(guestCount, extraSeats = 0) {
  const n = Math.max(0, Math.floor(Number(guestCount) || 0));
  const extra = Math.max(0, Math.floor(Number(extraSeats) || 0));
  if (n === 0) return 0;
  return Math.ceil((n + extra) / 4);
}

/**
 * Experiencias con paquetes por persona (ej. viñedo USD 65, ceibo USD 80).
 * Cada order: { packageId, packageLabel, packagePrice, preferences: string[] }
 * Con transportPerVehicle (o transportPerPerson como alias) > 0 el transporte es por vehículo de hasta 4 pax (ver groupPrivateTransportTotal).
 * Con transportPerGuest > 0 se suma ese monto fijo a cada pedido por huésped (ej. Legado USD 25).
 * Órdenes antiguas pueden tener { packagePeople, packagePrice, preferences } o transportPrice.
 */
function initPackageOrderExperience(config) {
  const {
    experienceName = "experience",
    experienceNameKey = null,
    whatsappIntroKey = null,
    whatsappNumber = "59898945542",
    popupId,
    createBtnId,
    closeBtnId,
    saveBtnId,
    orderSummaryId = "orderSummary",
    bookNowBottomId,
    storageKey = "orders",
    packages,
    packageRadioName = "packageId",
    transportPerVehicle,
    transportPerPerson = 0,
    transportPerGuest = 0,
    guideFeePerPerson = 0,
    guideOptional = false,
    optionalGuideCheckboxId = null,
    groupGuideOptional = false,
    groupGuideFlatFee = 0,
    groupGuideCheckboxId = null,
    groupGuideWrapId = null,
    dynamicPayment = null,
    paymentLinksByPackage = {},
    /**
     * Optional two-step package UI: menu radios + meal radios sync to hidden `packageRadioName` values
     * (e.g. lunch_vinedo). `{ menuRadioName, mealRadioName, parsePackageId?, packageIdFromParts? }`
     */
    packageComposite = null,
    /** Optional i18n key for each order card / WhatsApp heading (default: order_word). */
    orderCardTitleKey = "order_word",
    experienceSkipsPreferencesField = false,
    /** Flat USD for the whole group when optional transport radio is "yes" (e.g. S34 USD 30). */
    optionalGroupTransportFlat = 0,
    /** Radio name in popup: value "yes" | "no". */
    optionalTransportRadioName = "groupTransport",
    /** When true, all guest orders in one booking must share the same packageId. */
    singlePackagePerBooking = false,
    /**
     * In-popup guest stepper (like cabalgata): `{ valueId, minusId, plusId, min?, max?, hintKey? }`.
     * Save replaces the whole booking with N identical guest orders.
     */
    packageGuestCounter = null
  } = config || {};

  const vehicleTransportRate =
    transportPerVehicle != null && transportPerVehicle !== ""
      ? Math.max(0, Number(transportPerVehicle) || 0)
      : Math.max(0, Number(transportPerPerson) || 0);
  const flatGuestTransportRate = Math.max(0, Number(transportPerGuest) || 0);
  const optionalTransportFlat = Math.max(0, Number(optionalGroupTransportFlat) || 0);
  const optionalTransportRadio = String(optionalTransportRadioName || "groupTransport");

  if (!popupId || !createBtnId || !closeBtnId || !saveBtnId || !orderSummaryId) {
    console.error("initPackageOrderExperience: config incompleta (ids)");
    return;
  }

  if (!packages || typeof packages !== "object" || Object.keys(packages).length === 0) {
    console.error("initPackageOrderExperience: config incompleta (packages)");
    return;
  }

  const getI18nText = (key, fallback) => {
    const lang = getSiteLanguage();
    const tr = sacramentoI18nTable();
    try {
      if (tr?.[lang]?.[key]) return tr[lang][key];
      if (tr?.en?.[key]) return tr.en[key];
    } catch {}
    return fallback;
  };

  const trTpl = (key, fallback, vars) => {
    let s = getI18nText(key, fallback);
    if (!vars || typeof vars !== "object") return s;
    return Object.keys(vars).reduce((acc, k) => acc.split(`{${k}}`).join(String(vars[k])), s);
  };

  const resolvePackageSpec = (id) => {
    const raw = packages[id];
    if (raw == null) return null;
    if (typeof raw === "number") {
      return { price: raw, label: String(id), minGuests: 1 };
    }
    if (typeof raw === "object" && typeof raw.price === "number") {
      const fallbackLabel =
        typeof raw.label === "string" && raw.label.trim() ? raw.label.trim() : String(id);
      const label =
        typeof raw.labelKey === "string" && raw.labelKey.trim()
          ? getI18nText(raw.labelKey.trim(), fallbackLabel)
          : fallbackLabel;
      const minGuests = Math.max(1, Math.floor(Number(raw.minGuests) || 1));
      return { price: raw.price, label, minGuests };
    }
    return null;
  };

  let renderOrdersRef = null;
  let pkgLangPopup = null;
  let pkgLangSaveBtn = null;
  let pkgLangEditingIndex = null;

  const refreshPackageOrderLanguage = () => {
    if (typeof renderOrdersRef === "function") renderOrdersRef();
    if (pkgLangPopup && pkgLangSaveBtn && pkgLangPopup.classList.contains("active")) {
      pkgLangSaveBtn.textContent =
        pkgLangEditingIndex !== null
          ? getI18nText("update_order", "Update order")
          : getI18nText("save_selection", "Save selection");
    }
  };

  document.addEventListener("sacramento:setLanguage", refreshPackageOrderLanguage);
  document.addEventListener("sacramento:languageChosen", refreshPackageOrderLanguage);

  const bootPackageOrderDom = () => {
    let editingIndex = null;
    pkgLangEditingIndex = null;

    const popup = document.getElementById(popupId);
    const createBtn = document.getElementById(createBtnId);
    const closeBtn = document.getElementById(closeBtnId);
    const saveBtn = document.getElementById(saveBtnId);
    const container = document.getElementById(orderSummaryId);
    pkgLangPopup = popup;
    pkgLangSaveBtn = saveBtn;

    if (!popup || !createBtn || !closeBtn || !saveBtn || !container) return;

    const pgcRaw =
      packageGuestCounter && typeof packageGuestCounter === "object" ? packageGuestCounter : null;
    const pgc =
      pgcRaw && pgcRaw.valueId && pgcRaw.minusId && pgcRaw.plusId
        ? {
            valueId: String(pgcRaw.valueId),
            minusId: String(pgcRaw.minusId),
            plusId: String(pgcRaw.plusId),
            min: Math.max(1, Math.floor(Number(pgcRaw.min) || 1)),
            max: Math.max(1, Math.floor(Number(pgcRaw.max) || 15)),
            hintKey:
              typeof pgcRaw.hintKey === "string" && pgcRaw.hintKey.trim()
                ? pgcRaw.hintKey.trim()
                : null
          }
        : null;
    let popupGuestCount = pgc ? pgc.min : 1;

    const pgcValueEl = () =>
      pgc ? popup.querySelector(`#${pgc.valueId}`) || document.getElementById(pgc.valueId) : null;
    const pgcMinusBtn = () =>
      pgc ? popup.querySelector(`#${pgc.minusId}`) || document.getElementById(pgc.minusId) : null;
    const pgcPlusBtn = () =>
      pgc ? popup.querySelector(`#${pgc.plusId}`) || document.getElementById(pgc.plusId) : null;

    const syncPopupGuestCountDisplay = () => {
      const el = pgcValueEl();
      if (el) el.textContent = String(popupGuestCount);
    };

    const setPopupGuestCount = (n) => {
      if (!pgc) return;
      popupGuestCount = Math.min(pgc.max, Math.max(pgc.min, Math.floor(Number(n) || pgc.min)));
      syncPopupGuestCountDisplay();
    };

    const readSelectedPackageMinGuests = () => {
      const r = popup.querySelector(`input[name="${packageRadioName}"]:checked`);
      return r ? getMinGuestsForPackageId(r.value) : 1;
    };

    const enforcePopupGuestCountForPackage = () => {
      if (!pgc) return;
      const minPkg = readSelectedPackageMinGuests();
      if (popupGuestCount < minPkg) setPopupGuestCount(minPkg);
    };

    const syncPopupGuestCountFromOrders = (orders) => {
      if (!pgc) return;
      const n = Array.isArray(orders) && orders.length > 0 ? orders.length : pgc.min;
      setPopupGuestCount(n);
    };

    const pcRaw = packageComposite && typeof packageComposite === "object" ? packageComposite : null;
    const pc =
      pcRaw && pcRaw.menuRadioName && pcRaw.mealRadioName
        ? {
            menuRadioName: String(pcRaw.menuRadioName),
            mealRadioName: String(pcRaw.mealRadioName),
            parsePackageId:
              typeof pcRaw.parsePackageId === "function"
                ? pcRaw.parsePackageId
                : (id) => {
                    const s = String(id || "");
                    const m = s.match(/^(lunch|dinner)_(vinedo|ceibo)$/);
                    return m ? { meal: m[1], menu: m[2] } : null;
                  },
            packageIdFromParts:
              typeof pcRaw.packageIdFromParts === "function"
                ? pcRaw.packageIdFromParts
                : (meal, menu) => `${meal}_${menu}`
          }
        : null;
    const syncCompositePickerToHidden = () => {
      if (!pc || !popup) return;
      const menu = popup.querySelector(`input[name="${pc.menuRadioName}"]:checked`);
      popup.querySelectorAll(`input[name="${packageRadioName}"]`).forEach((r) => {
        r.checked = false;
      });
      if (!menu) {
        return;
      }
      let meal = popup.querySelector(`input[name="${pc.mealRadioName}"]:checked`);
      if (!meal) {
        const lunch = popup.querySelector(`input[name="${pc.mealRadioName}"][value="lunch"]`);
        if (lunch) {
          lunch.checked = true;
          meal = lunch;
        }
      }
      if (!meal) return;
      const pid = pc.packageIdFromParts(meal.value, menu.value);
      const target = popup.querySelector(`input[name="${packageRadioName}"][value="${pid}"]`);
      if (target) target.checked = true;
    };

    const applyOrderPackageIdToComposite = (packageId) => {
      if (!pc || !popup) return;
      const parsed = pc.parsePackageId(packageId);
      popup.querySelectorAll(`input[name="${pc.menuRadioName}"]`).forEach((r) => {
        r.checked = false;
      });
      popup.querySelectorAll(`input[name="${pc.mealRadioName}"]`).forEach((r) => {
        r.checked = false;
      });
      if (!parsed) {
        syncCompositePickerToHidden();
        return;
      }
      const mEl = popup.querySelector(`input[name="${pc.menuRadioName}"][value="${parsed.menu}"]`);
      const mealEl = popup.querySelector(`input[name="${pc.mealRadioName}"][value="${parsed.meal}"]`);
      if (mEl) mEl.checked = true;
      if (mealEl) mealEl.checked = true;
      syncCompositePickerToHidden();
    };

    if (pc) {
      popup.addEventListener("change", (e) => {
        const t = e.target;
        if (!(t instanceof HTMLInputElement) || t.type !== "radio") return;
        if (t.name !== pc.menuRadioName && t.name !== pc.mealRadioName) return;
        if (t.name === pc.menuRadioName) {
          if (!popup.querySelector(`input[name="${pc.mealRadioName}"]:checked`)) {
            const lunch = popup.querySelector(`input[name="${pc.mealRadioName}"][value="lunch"]`);
            if (lunch) lunch.checked = true;
          }
        }
        syncCompositePickerToHidden();
      });
    }

    const guideFee = Math.max(0, Number(guideFeePerPerson) || 0);
    const optionalGuideEl = () =>
      optionalGuideCheckboxId ? document.getElementById(optionalGuideCheckboxId) : null;
    const groupGuideEl = () =>
      groupGuideCheckboxId ? document.getElementById(groupGuideCheckboxId) : null;
    const groupGuideStorageKey = `${storageKey}_groupGuide`;
    const getGroupGuideStored = () => localStorage.getItem(groupGuideStorageKey) === "1";
    const setGroupGuideStored = (on) => {
      if (on) localStorage.setItem(groupGuideStorageKey, "1");
      else localStorage.removeItem(groupGuideStorageKey);
    };
    const groupGuideFlat = Math.max(0, Number(groupGuideFlatFee) || 0);
    const groupGuideEnabled = (groupGuideOptional || Boolean(groupGuideCheckboxId)) && groupGuideFlat > 0;
    const groupGuideAmount = () => {
      if (!groupGuideEnabled) return 0;
      const orders = getOrders();
      if (orders.length === 0) return 0;
      const el = groupGuideEl();
      const onEl = Boolean(el && el.checked);
      const onStored = getGroupGuideStored();
      return onEl || onStored ? groupGuideFlat : 0;
    };
    const syncGroupGuideWrap = () => {
      const wrapId = groupGuideWrapId || (groupGuideCheckboxId ? `${groupGuideCheckboxId}Wrap` : null);
      const wrap = wrapId ? document.getElementById(wrapId) : null;
      if (wrap) {
        wrap.style.display = getOrders().length > 0 ? "" : "none";
      }
    };

    /** Precio y etiqueta siempre desde el catálogo actual (evita órdenes viejas con packagePrice desactualizado). */
    const getEffectivePackagePricing = (o) => {
      if (!o) return { label: "—", price: 0 };
      if (o.packageId != null) {
        const spec = resolvePackageSpec(o.packageId);
        if (spec) {
          const gf = guideOptional ? (o && o.includeGuide ? guideFee : 0) : guideFee;
          return { label: spec.label, price: spec.price + gf };
        }
      }
      return {
        label: o.packageLabel || "—",
        price: Number(o.packagePrice) || 0
      };
    };

    const usesFlatGuestTransport = (orders) =>
      flatGuestTransportRate > 0 &&
      Array.isArray(orders) &&
      orders.some((x) => x && x.packageId != null);

    const usesGroupTransport = (orders) =>
      !flatGuestTransportRate &&
      vehicleTransportRate > 0 &&
      Array.isArray(orders) &&
      orders.some((x) => x && x.packageId != null);

    const transportSharePerGuest = (orders) => {
      const n = Array.isArray(orders) ? orders.length : 0;
      if (!usesGroupTransport(orders) || n === 0) return 0;
      return groupPrivateTransportTotal(n, vehicleTransportRate) / n;
    };

    const totalGroupTransport = (orders) => {
      const n = Array.isArray(orders) ? orders.length : 0;
      if (!usesGroupTransport(orders) || n === 0) return 0;
      return groupPrivateTransportTotal(n, vehicleTransportRate);
    };

    const transportMetaKey = `${storageKey}_booking_meta`;
    const getBookingMeta = () => {
      try {
        const raw = localStorage.getItem(transportMetaKey);
        if (!raw) return { includeTransport: false };
        const o = JSON.parse(raw);
        return { includeTransport: Boolean(o && o.includeTransport) };
      } catch {
        return { includeTransport: false };
      }
    };
    const setBookingMeta = (meta) => {
      localStorage.setItem(transportMetaKey, JSON.stringify(meta || { includeTransport: false }));
    };
    const usesOptionalGroupTransport = () => optionalTransportFlat > 0;
    const optionalGroupTransportTotal = (orders) => {
      if (!usesOptionalGroupTransport() || !Array.isArray(orders) || orders.length === 0) return 0;
      return getBookingMeta().includeTransport ? optionalTransportFlat : 0;
    };
    const syncTransportRadioFromMeta = () => {
      if (!usesOptionalGroupTransport() || !popup) return;
      const val = getBookingMeta().includeTransport ? "yes" : "no";
      const r = popup.querySelector(`input[name="${optionalTransportRadio}"][value="${val}"]`);
      if (r) r.checked = true;
      else {
        const noR = popup.querySelector(`input[name="${optionalTransportRadio}"][value="no"]`);
        if (noR) noR.checked = true;
      }
    };
    const readTransportFromPopup = () => {
      if (!usesOptionalGroupTransport() || !popup) return false;
      const r = popup.querySelector(`input[name="${optionalTransportRadio}"]:checked`);
      return r?.value === "yes";
    };
    const persistTransportFromPopup = () => {
      if (!usesOptionalGroupTransport()) return;
      setBookingMeta({ includeTransport: readTransportFromPopup() });
    };

    /** Legacy: transporte fijo por línea (órdenes antiguas sin packageId). */
    const transportForLegacyOrder = (o) => {
      if (o.transportPrice != null) return Number(o.transportPrice) || 0;
      if (o.packagePeople != null && vehicleTransportRate > 0) return vehicleTransportRate;
      return 0;
    };

    const transportAmountForOrder = (o, orders) => {
      if (usesFlatGuestTransport(orders)) return flatGuestTransportRate;
      if (usesGroupTransport(orders)) return transportSharePerGuest(orders);
      return transportForLegacyOrder(o);
    };

    const totalTransportForOrders = (orders) => {
      if (!Array.isArray(orders) || orders.length === 0) return 0;
      let sum = optionalGroupTransportTotal(orders);
      if (usesFlatGuestTransport(orders)) return sum + orders.length * flatGuestTransportRate;
      if (usesGroupTransport(orders)) return sum + totalGroupTransport(orders);
      return sum + orders.reduce((s, o) => s + transportForLegacyOrder(o), 0);
    };

    const lineTotalForOrder = (o, orders) => {
      return getEffectivePackagePricing(o).price + transportAmountForOrder(o, orders);
    };

    const escapeHtml = (str) =>
      String(str).replace(/[&<>"']/g, (m) => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
      }[m]));

    const pkgI18nPrefPrefix = "__i18n__:";
    const buildPreferenceLookup = () => {
      const map = new Map();
      popup.querySelectorAll('.preferences-inside input[type="checkbox"]').forEach((input) => {
        const value = input.value || "";
        const span = input.parentElement?.querySelector("span[data-translate]");
        const rawLabel = span?.textContent?.trim() || input.parentElement?.textContent?.trim() || value;
        const key = span?.dataset?.translate;
        const translated = key ? getI18nText(key, rawLabel) : rawLabel;
        if (value) map.set(value, translated);
        if (rawLabel) map.set(rawLabel, translated);
        if (key) map.set(`${pkgI18nPrefPrefix}${key}`, translated);
      });
      return map;
    };

    const getLocalizedPreference = (storedValue) => {
      const raw = String(storedValue || "").trim();
      if (!raw) return "-";
      if (raw.startsWith(pkgI18nPrefPrefix)) {
        const key = raw.slice(pkgI18nPrefPrefix.length);
        return getI18nText(key, key);
      }
      const text = raw
        .replace(/^🍺\s*/, "")
        .replace(/^🧂\s*/, "")
        .replace(/^🌱\s*/, "")
        .replace(/^🚫\s*/, "")
        .replace(/^🌶\s*/, "")
        .trim();
      if (!text) return "-";
      const lookup = buildPreferenceLookup();
      return lookup.get(text) || lookup.get(raw) || text;
    };

    const decoratePkgPref = (storedValue) => {
      const raw = String(storedValue || "").trim();
      if (!raw) return "-";
      const decorated = sacramentoDecoratePref(raw, getI18nText, pkgI18nPrefPrefix);
      if (decorated && decorated.trim()) return decorated;
      return getLocalizedPreference(storedValue);
    };

    const getOrders = () => {
      try {
        return JSON.parse(localStorage.getItem(storageKey)) || [];
      } catch {
        return [];
      }
    };

    const setOrders = (orders) => {
      localStorage.setItem(storageKey, JSON.stringify(orders));
    };

    const getMinGuestsForPackageId = (packageId) => {
      const spec = resolvePackageSpec(packageId);
      return spec?.minGuests ?? 1;
    };

    const getLockedPackageId = (orders, editingIdx = null) => {
      if (!singlePackagePerBooking || !Array.isArray(orders) || orders.length === 0) return null;
      if (editingIdx !== null && editingIdx >= 0) {
        const others = orders.filter((_, i) => i !== editingIdx);
        if (others.length > 0) return others[0]?.packageId ?? null;
        return null;
      }
      return orders[0]?.packageId ?? null;
    };

    const applySinglePackageLock = (orders, editingIdx = null) => {
      if (pgc || !singlePackagePerBooking || !popup) return;
      const lockedId = getLockedPackageId(orders, editingIdx);
      popup.querySelectorAll(`input[name="${packageRadioName}"]`).forEach((r) => {
        const li = r.closest(".food-menu-option");
        if (!lockedId) {
          r.disabled = false;
          if (li) li.classList.remove("food-menu-option--locked");
          return;
        }
        const isLocked = r.value === String(lockedId);
        r.checked = isLocked;
        r.disabled = !isLocked;
        if (li) li.classList.toggle("food-menu-option--locked", !isLocked);
      });
      if (pc && lockedId) {
        applyOrderPackageIdToComposite(lockedId);
      }
    };

    const minGuestsRequiredForOrders = (orders) => {
      if (!Array.isArray(orders) || orders.length === 0) return 1;
      return getMinGuestsForPackageId(orders[0]?.packageId);
    };

    const canReserveOrders = (orders) => {
      if (!Array.isArray(orders) || orders.length === 0) return false;
      return orders.length >= minGuestsRequiredForOrders(orders);
    };

    const alertMinGuestsForPackage = (orders) => {
      const minG = minGuestsRequiredForOrders(orders);
      const spec = resolvePackageSpec(orders[0]?.packageId);
      alert(
        trTpl(
          "orders_pkg_alert_min_guests",
          "This experience requires at least {min} people. Add {remaining} more guest order(s) before reserving.",
          {
            min: String(minG),
            remaining: String(Math.max(0, minG - orders.length))
          }
        ).replace(/\{label\}/g, spec?.label || "")
      );
    };

    const assertCanReserve = (orders) => {
      if (!canReserveOrders(orders)) {
        alertMinGuestsForPackage(orders);
        return false;
      }
      return true;
    };

    const clearPopupForm = () => {
      popup.querySelectorAll('input[type="radio"]').forEach((i) => {
        if (usesOptionalGroupTransport() && i.name === optionalTransportRadio) return;
        i.checked = false;
      });
      popup.querySelectorAll('.preferences-inside input[type="checkbox"]').forEach((i) => {
        i.checked = false;
      });
      const og = optionalGuideEl();
      if (og) og.checked = false;
      saveBtn.textContent = getI18nText("save_selection", "Save selection");
      if (pc) {
        const lunch = popup.querySelector(`input[name="${pc.mealRadioName}"][value="lunch"]`);
        if (lunch) lunch.checked = true;
        syncCompositePickerToHidden();
      }
      syncTransportRadioFromMeta();
      if (pgc) {
        setPopupGuestCount(pgc.min);
        syncPopupGuestCountDisplay();
      }
    };

    const resetPopup = () => {
      clearPopupForm();
      editingIndex = null;
    };

    const openPopup = () => {
      resetPopup();
      const orders = getOrders();
      applySinglePackageLock(orders, null);
      if (pgc) {
        syncPopupGuestCountFromOrders(orders);
        if (orders.length === 0) {
          const firstPkg = popup.querySelector(`input[name="${packageRadioName}"]`);
          if (firstPkg) firstPkg.checked = true;
        }
        enforcePopupGuestCountForPackage();
      } else if (!popup.querySelector(`input[name="${packageRadioName}"]:checked`)) {
        const firstPkg = popup.querySelector(`input[name="${packageRadioName}"]`);
        if (firstPkg) firstPkg.checked = true;
      }
      popup.classList.add("active");
      popup.setAttribute("aria-hidden", "false");
    };

    const closePopup = () => {
      popup.classList.remove("active");
      popup.setAttribute("aria-hidden", "true");
    };

    const formatMoney = (n) => {
      const x = Number(n);
      if (!Number.isFinite(x)) return "0";
      const v = Math.round(x * 100) / 100;
      return Number.isInteger(v) ? String(v) : v.toFixed(2);
    };

    const packageLineForOrder = (o, orders) => {
      const eff = getEffectivePackagePricing(o);
      const pkgPrice = eff.price;
      const share = transportAmountForOrder(o, orders);
      const total = lineTotalForOrder(o, orders);
      if (o.packageId != null && eff.label) {
        if (usesFlatGuestTransport(orders)) {
          const pkgLine = trTpl("orders_pkg_line_per_person", "{label} (USD {pkg} per person)", {
            label: eff.label,
            pkg: formatMoney(pkgPrice)
          });
          const transportLine = trTpl(
            "orders_pkg_transport_flat_amount",
            "Transport: USD {transport}",
            { transport: formatMoney(flatGuestTransportRate) }
          );
          return `${pkgLine}\n${transportLine}`;
        }
        if (share > 0) {
          return trTpl(
            "orders_pkg_line_with_transport",
            "{label} — USD {pkg} experience + USD {share} group transport share = USD {total} per guest",
            {
              label: eff.label,
              pkg: pkgPrice,
              share: formatMoney(share),
              total: formatMoney(total)
            }
          );
        }
        return trTpl("orders_pkg_line_per_person", "{label} (USD {pkg} per person)", {
          label: eff.label,
          pkg: pkgPrice
        });
      }
      const n = Number(o.packagePeople);
      if (n > 0) {
        const key = n === 1 ? "orders_pkg_line_people_one" : "orders_pkg_line_people_many";
        const fb = n === 1 ? "{n} person (USD {pkg})" : "{n} people (USD {pkg})";
        return trTpl(key, fb, { n, pkg: pkgPrice });
      }
      return trTpl("orders_pkg_line_fallback", "Package (USD {pkg})", { pkg: pkgPrice });
    };

    const buildWhatsAppMessage = (orders, paymentLinkOverride = "") => {
      const dynamicEnabled = Boolean(dynamicPayment && dynamicPayment.enabled);
      const lang = getSiteLanguage();
      const dateLocale = lang === "es" ? "es-UY" : lang === "pt" ? "pt-BR" : "en-GB";
      const date = new Date().toLocaleDateString(dateLocale, {
        day: "2-digit",
        month: "short",
        year: "numeric"
      });

      const pkgLabel = getI18nText("orders_pkg_package_lbl", "Package:").replace(/:?\s*$/, "");

      let ordersText = "";
      let experienceSubtotal = 0;

      orders.forEach((o, i) => {
        const prefs = Array.isArray(o.preferences) ? o.preferences : [];
        experienceSubtotal += getEffectivePackagePricing(o).price;
        const prefsWa =
          prefs.length === 0
            ? "-"
            : prefs.map(decoratePkgPref).filter((p) => p && p !== "-").join(", ") || "-";

        ordersText += `*${getI18nText(orderCardTitleKey, "Order")} ${i + 1}*\n${waLine(
          pkgLabel,
          packageLineForOrder(o, orders)
        )}${
          experienceSkipsPreferencesField
            ? "\n\n"
            : `\n${waLine(getI18nText("preferences_label", "Preferences"), prefsWa)}\n\n`
        }`;
      });

      const transportTotal = totalTransportForOrders(orders);
      const gg = groupGuideAmount();
      const total = experienceSubtotal + transportTotal + gg;

      const expName = experienceNameKey
        ? getI18nText(experienceNameKey, experienceName)
        : experienceName;
      const waIntro = whatsappIntroKey
        ? getI18nText(whatsappIntroKey, `Hello! I'd like to book the ${experienceName} experience:`)
        : getI18nText(
            "orders_wa_intro",
            "Hello! I'd like to book the {experience} experience:"
          ).replace(/\{experience\}/g, expName);
      let message = `${waIntro}\n\n${waLine(getI18nText("orders_wa_date_label", "Date"), date)}\n\n${ordersText}`;

      const subtotalLabel = getI18nText("orders_wa_experience_subtotal", "Experience subtotal");
      const formatSubtotal = (amount, guideNote = "") =>
        `${waLine(subtotalLabel, `USD ${formatMoney(amount)}`)}${guideNote ? ` ${guideNote}` : ""}\n`;

      if (usesFlatGuestTransport(orders) && orders.length > 0) {
        message += formatSubtotal(experienceSubtotal);
        message += `${waLine(
          trTpl("orders_wa_pkg_transport_flat", "Transport (USD {rate} per guest × {count})", {
            rate: formatMoney(flatGuestTransportRate),
            count: orders.length
          }),
          `USD ${formatMoney(transportTotal)}`
        )}\n`;
      } else if (usesGroupTransport(orders) && orders.length > 0) {
        const vehicles = Math.ceil(orders.length / 4);
        const guideTotalOptional =
          guideOptional && guideFee > 0
            ? orders.reduce((s, o) => s + (o && o.includeGuide ? guideFee : 0), 0)
            : 0;
        let guideNote = "";
        if (guideFee > 0) {
          if (guideOptional) {
            if (guideTotalOptional > 0) {
              guideNote = trTpl(
                "orders_wa_pkg_guide_opt_note",
                "(includes USD {amount} in optional guide fees)",
                { amount: formatMoney(guideTotalOptional) }
              );
            }
          } else {
            guideNote = trTpl(
              "orders_wa_pkg_guide_incl_note",
              "(includes USD {amount} guide fee per guest)",
              { amount: formatMoney(guideFee) }
            );
          }
        }
        message += formatSubtotal(experienceSubtotal, guideNote);
        const vehicleWord =
          vehicles === 1
            ? getI18nText("orders_wa_vehicle_singular", "vehicle")
            : getI18nText("orders_wa_vehicle_plural", "vehicles");
        const transportLabel = getI18nText(
          "orders_wa_private_transport_line",
          "Private transport ({vehicles} {vehicleWord} × USD {rate})"
        )
          .replace(/\{vehicles\}/g, String(vehicles))
          .replace(/\{vehicleWord\}/g, vehicleWord)
          .replace(/\{rate\}/g, formatMoney(vehicleTransportRate));
        message += `${waLine(transportLabel, `USD ${formatMoney(transportTotal)}`)}\n`;
      } else if (guideFee > 0 && orders.length > 0) {
        if (guideOptional) {
          const guideTotalOptional = orders.reduce((s, o) => s + (o && o.includeGuide ? guideFee : 0), 0);
          if (guideTotalOptional > 0) {
            message += formatSubtotal(
              experienceSubtotal,
              trTpl(
                "orders_wa_pkg_guide_opt_note",
                "(includes USD {amount} in optional guide fees)",
                { amount: formatMoney(guideTotalOptional) }
              )
            );
          } else {
            message += formatSubtotal(experienceSubtotal);
          }
        } else {
          message += formatSubtotal(
            experienceSubtotal,
            trTpl(
              "orders_wa_pkg_guide_incl_note",
              "(includes USD {amount} guide fee per guest)",
              { amount: formatMoney(guideFee) }
            )
          );
        }
      } else if (orders.length > 0) {
        message += formatSubtotal(experienceSubtotal);
      }

      const optionalTransportAmt = optionalGroupTransportTotal(orders);
      if (usesOptionalGroupTransport() && orders.length > 0) {
        const transportYes = getBookingMeta().includeTransport;
        const transportStatus = transportYes
          ? trTpl(
              "orders_wa_optional_transport_yes",
              "Yes (+USD {amount} total · up to 4 guests)",
              { amount: formatMoney(optionalTransportFlat) }
            )
          : getI18nText("orders_wa_optional_transport_no", "No");
        message += `${waLine(
          getI18nText("orders_wa_round_trip_transport", "Round-trip transport"),
          transportStatus
        )}\n`;
        if (optionalTransportAmt > 0) {
          message += `${waLine(
            trTpl("orders_wa_optional_transport_charge", "Transport (group, USD {amount})", {
              amount: formatMoney(optionalTransportFlat)
            }),
            `USD ${formatMoney(optionalTransportAmt)}`
          )}\n`;
        }
      }

      if (groupGuideEnabled) {
        const groupGuideLabel = getI18nText(
          "orders_wa_group_guide_optional",
          "Group guide (optional, USD {amount} total for the group)"
        ).replace(/\{amount\}/g, formatMoney(groupGuideFlat));
        const groupGuideValue =
          gg > 0
            ? getI18nText("orders_wa_group_guide_yes", "Yes — USD {amount}").replace(
                /\{amount\}/g,
                formatMoney(gg)
              )
            : getI18nText("guide_no", "No");
        message += `${waLine(groupGuideLabel, groupGuideValue)}\n`;
      }
      message += `${waLine(getI18nText("orders_wa_total_label", "Total"), `USD ${formatMoney(total)}`)}\n`;

      if (paymentLinkOverride) {
        message += `\n\n${getI18nText(
          "orders_wa_pay_confirm",
          "To confirm the reservation, please complete the payment here:"
        )}\n${paymentLinkOverride}`;
      } else if (!dynamicEnabled && orders.length === 1) {
        const o0 = orders[0];
        const pkgKey = o0.packageId != null ? String(o0.packageId) : String(o0.packagePeople);
        const link =
          paymentLinksByPackage[pkgKey] ||
          (o0.packagePeople != null ? paymentLinksByPackage[o0.packagePeople] : "") ||
          "";
        if (link) {
          message += `\n\n${getI18nText(
            "orders_wa_pay_confirm",
            "To confirm the reservation, please complete the payment here:"
          )}\n${link}`;
        }
      } else if (!paymentLinkOverride) {
        message += `\n\n${getI18nText(
          "orders_wa_payment_pending",
          "Payment link could not be generated automatically yet. Please confirm and we will send it right away."
        )}`;
      }

      return message;
    };

    const renderOrders = () => {
      pkgLangEditingIndex = editingIndex;
      const orders = getOrders();
      const gelSync = groupGuideEl();
      if (groupGuideEnabled && gelSync) {
        setGroupGuideStored(Boolean(gelSync.checked));
      }

      let html = `<h3>${escapeHtml(getI18nText("your_order", "Your order"))}</h3>`;

      if (orders.length > 0 && !pgc) {
        html = `
          <button id="addGuestBtn" class="add-guest-btn">
            + ${escapeHtml(getI18nText("add_order", "Add Order"))}
          </button>
          <h3>${escapeHtml(getI18nText("your_order", "Your order"))}</h3>
        `;
      }

      if (pgc && orders.length > 0) {
        const effPkg = getEffectivePackagePricing(orders[0]);
        const peopleLabel =
          orders.length === 1
            ? trTpl("orders_pkg_summary_one_person", "1 person", {})
            : trTpl("orders_pkg_summary_n_people", "{n} people", { n: String(orders.length) });
        const transportOn = getBookingMeta().includeTransport;
        const transportLine = usesOptionalGroupTransport()
          ? `<p><strong>${escapeHtml(
              getI18nText("orders_wa_round_trip_transport", "Round-trip transport")
            )}:</strong> ${escapeHtml(
              transportOn
                ? trTpl(
                    "orders_wa_optional_transport_yes",
                    "Yes (+USD {amount} total · up to 4 guests)",
                    { amount: formatMoney(optionalTransportFlat) }
                  )
                : getI18nText("orders_wa_optional_transport_no", "No")
            )}</p>`
          : "";
        html = `<h3>${escapeHtml(getI18nText("your_order", "Your order"))}</h3>`;
        html += `
          <div class="order-card">
            <div class="order-header">
              <strong class="order-card-title">${escapeHtml(getI18nText("your_order", "Your order"))}</strong>
              <div class="order-actions">
                <span class="edit-order" data-index="0">✏️</span>
                <span class="delete-order" data-index="0">🗑️</span>
              </div>
            </div>
            <p><strong>${escapeHtml(getI18nText("orders_pkg_package_lbl", "Package:"))}</strong> ${escapeHtml(
          effPkg.label
        )} — USD ${escapeHtml(formatMoney(effPkg.price))} ${escapeHtml(
          getI18nText("orders_pkg_paren_experience", "experience")
        )}</p>
            <p><strong>${escapeHtml(getI18nText("wa_people_label", "People"))}:</strong> ${escapeHtml(
          peopleLabel
        )}</p>
            ${transportLine}
          </div>
        `;
      } else if (!pgc) {
      orders.forEach((order, index) => {
        const prefsRaw = Array.isArray(order.preferences) ? order.preferences : [];
        const prefsLine =
          prefsRaw.length === 0
            ? "-"
            : prefsRaw.map(decoratePkgPref).filter((p) => p && p !== "-").join(", ") || "-";
        const lineTotal = lineTotalForOrder(order, orders);

        const effPkg = getEffectivePackagePricing(order);
        const pkgPrice = effPkg.price;
        const share = transportAmountForOrder(order, orders);
        const expLabel = (() => {
          if (guideFee <= 0) return getI18nText("orders_pkg_paren_experience", "experience");
          if (guideOptional) {
            return order.includeGuide
              ? trTpl(
                  "orders_pkg_paren_exp_opt_guide",
                  "experience, incl. optional guide USD {n}",
                  { n: formatMoney(guideFee) }
                )
              : getI18nText("orders_pkg_paren_experience", "experience");
          }
          return trTpl(
            "orders_pkg_paren_exp_incl_guide",
            "experience, incl. USD {n} guide",
            { n: formatMoney(guideFee) }
          );
        })();
        const pkgLbl = escapeHtml(getI18nText("orders_pkg_package_lbl", "Package:"));
        let packageHtml = `<strong>${pkgLbl}</strong> ${escapeHtml(effPkg.label)} — USD ${escapeHtml(
          String(pkgPrice)
        )} (${escapeHtml(expLabel)})`;
        if (share > 0 && usesGroupTransport(orders)) {
          packageHtml += `<br><strong>${escapeHtml(
            getI18nText("orders_pkg_transport_share", "Transport (your share of the group):")
          )}</strong> USD ${escapeHtml(formatMoney(share))}`;
          packageHtml += `<br><strong>${escapeHtml(
            getI18nText("orders_pkg_guest_total", "Guest total:")
          )}</strong> USD ${escapeHtml(formatMoney(lineTotal))}`;
        } else if (share > 0 && usesFlatGuestTransport(orders)) {
          packageHtml += `<br><strong>${escapeHtml(
            getI18nText("orders_pkg_transport_flat", "Transport:")
          )}</strong> USD ${escapeHtml(formatMoney(share))}`;
        } else {
          packageHtml = `<strong>${pkgLbl}</strong> ${escapeHtml(packageLineForOrder(order, orders))}`;
        }

        html += `
          <div class="order-card">
            <div class="order-header">
              <strong class="order-card-title">${escapeHtml(getI18nText(orderCardTitleKey, "Order"))} ${index + 1}</strong>
              <div class="order-actions">
                <span class="edit-order" data-index="${index}">✏️</span>
                <span class="delete-order" data-index="${index}">🗑️</span>
              </div>
            </div>
            <p>${packageHtml}</p>
            ${
              experienceSkipsPreferencesField
                ? ""
                : `<p><strong>${escapeHtml(getI18nText("preferences_word", "Preferences"))}:</strong> ${escapeHtml(
                    prefsLine
                  )}</p>`
            }
          </div>
        `;
      });
      }

      if (orders.length > 0) {
        const expSum = orders.reduce((s, o) => s + getEffectivePackagePricing(o).price, 0);
        const ggAmt = groupGuideAmount();
        const transportSum = totalTransportForOrders(orders);
        const total = expSum + transportSum + ggAmt;
        const guestUnit =
          orders.length === 1
            ? getI18nText("guest_order_singular", "guest order")
            : getI18nText("guest_order_plural", "guest orders");
        const transportSharePkg =
          usesFlatGuestTransport(orders) && orders.length > 0
            ? flatGuestTransportRate
            : usesGroupTransport(orders) && orders.length > 0
              ? transportSharePerGuest(orders)
              : 0;
        const optionalTransportAmt = optionalGroupTransportTotal(orders);
        let detailExtra =
          transportSharePkg > 0
            ? ` · ${escapeHtml(
                getI18nText("orders_summary_transport_per_guest", "transport USD {amount} per guest").replace(
                  "{amount}",
                  formatMoney(transportSharePkg)
                )
              )}`
            : "";
        if (optionalTransportAmt > 0) {
          detailExtra += ` · ${escapeHtml(
            trTpl("orders_summary_optional_transport_group", "transport USD {amount} for the group", {
              amount: formatMoney(optionalTransportAmt)
            })
          )}`;
        }
        let guideDetail = "";
        if (guideFee > 0) {
          if (guideOptional) {
            const guideTotalOptional = orders.reduce((s, o) => s + (o && o.includeGuide ? guideFee : 0), 0);
            if (guideTotalOptional > 0) {
              guideDetail = ` · ${escapeHtml(getI18nText("orders_summary_optional_guide", "optional guide"))} USD ${escapeHtml(
                formatMoney(guideTotalOptional)
              )}`;
            }
          } else {
            guideDetail = ` · ${escapeHtml(
              trTpl("orders_summary_guide_guest_incl", "guide USD {n}/guest incl.", {
                n: formatMoney(guideFee)
              })
            )}`;
          }
        }
        if (groupGuideEnabled && ggAmt > 0) {
          guideDetail += ` · ${escapeHtml(getI18nText("orders_summary_group_guide", "group guide"))} USD ${escapeHtml(
            formatMoney(ggAmt)
          )}`;
        }
        const minGuestsReq = minGuestsRequiredForOrders(orders);
        const reserveReady = canReserveOrders(orders);
        const minGuestsHint =
          minGuestsReq > 1 && !reserveReady
            ? `<p class="sunset-boat-passengers-slot-hint">${escapeHtml(
                trTpl(
                  pgc ? "orders_pkg_min_guests_hint_edit" : "orders_pkg_min_guests_hint",
                  pgc
                    ? "This package requires at least {min} people — edit your selection and increase the guest count."
                    : "This package requires at least {min} people — add {remaining} more guest order(s) to reserve.",
                  {
                    min: String(minGuestsReq),
                    remaining: String(Math.max(0, minGuestsReq - orders.length))
                  }
                )
              )}</p>`
            : "";
        html += `
          <div class="total-box">
            <div class="total-left">
              <span class="total-label">${escapeHtml(getI18nText("total_label", "Total"))}</span>
              <span class="total-detail">${orders.length} ${escapeHtml(guestUnit)} · ${escapeHtml(
          getI18nText("orders_summary_experiences", "experiences")
        )} USD ${escapeHtml(formatMoney(expSum))}${guideDetail}${detailExtra}</span>
            </div>
            <div class="total-right">
              USD ${escapeHtml(formatMoney(total))}
            </div>
            ${minGuestsHint}
            <a href="#" id="bookWithOrder" class="btn total-btn${reserveReady ? "" : " total-btn--disabled"}"${
          reserveReady ? "" : ' aria-disabled="true"'
        }>
              ${escapeHtml(getI18nText("book_btn", "Reserve"))}
            </a>
          </div>
        `;
      }

      container.innerHTML = html;
      syncGroupGuideWrap();
      if (bookNowBottomId) {
        const bottomBtn = document.getElementById(bookNowBottomId);
        if (bottomBtn) {
          const ready = canReserveOrders(orders);
          bottomBtn.classList.toggle("total-btn--disabled", orders.length > 0 && !ready);
          if (orders.length > 0 && !ready) {
            bottomBtn.setAttribute("aria-disabled", "true");
          } else {
            bottomBtn.removeAttribute("aria-disabled");
          }
        }
      }
    };

    container.addEventListener("click", (e) => {
      const target = e.target;

      const addBtn = target.closest && target.closest("#addGuestBtn");
      if (addBtn) {
        e.preventDefault();
        openPopup();
        return;
      }

      const delEl = target.closest && target.closest(".delete-order");
      if (delEl) {
        const idx = Number(delEl.dataset.index);
        const orders = getOrders();
        if (pgc) {
          setOrders([]);
          if (usesOptionalGroupTransport()) {
            setBookingMeta({ includeTransport: false });
          }
        } else {
          orders.splice(idx, 1);
          setOrders(orders);
          if (orders.length === 0 && usesOptionalGroupTransport()) {
            setBookingMeta({ includeTransport: false });
          }
        }
        renderOrders();
        return;
      }

      const editEl = target.closest && target.closest(".edit-order");
      if (editEl) {
        const idx = Number(editEl.dataset.index);
        const orders = getOrders();
        const order = orders[idx];
        if (!order) return;

        editingIndex = pgc ? null : idx;
        clearPopupForm();

        if (pc) {
          applyOrderPackageIdToComposite(order.packageId);
        } else {
          popup.querySelectorAll(`input[name="${packageRadioName}"]`).forEach((r) => {
            if (order.packageId != null) {
              r.checked = r.value === String(order.packageId);
            } else {
              r.checked = false;
            }
          });
        }

        const prefsSet = new Set(Array.isArray(order.preferences) ? order.preferences : []);
        popup.querySelectorAll('.preferences-inside input[type="checkbox"]').forEach((cb) => {
          const span = cb.parentElement?.querySelector("span[data-translate]");
          const trKey = span?.dataset?.translate;
          const encoded = trKey ? `${pkgI18nPrefPrefix}${trKey}` : "";
          const labelText = cb.parentElement?.textContent?.trim();
          cb.checked =
            prefsSet.has(cb.value) ||
            Boolean(labelText && prefsSet.has(labelText)) ||
            Boolean(encoded && prefsSet.has(encoded));
        });
        const og = optionalGuideEl();
        if (og) og.checked = Boolean(order.includeGuide);

        applySinglePackageLock(orders, pgc ? null : idx);
        if (pgc) {
          syncPopupGuestCountFromOrders(orders);
          enforcePopupGuestCountForPackage();
        }
        saveBtn.textContent = getI18nText("update_order", "Update order");
        syncTransportRadioFromMeta();
        popup.classList.add("active");
        popup.setAttribute("aria-hidden", "false");
        return;
      }

      const bookEl = target.closest && target.closest("#bookWithOrder");
      if (bookEl) {
        e.preventDefault();
        const orders = getOrders();
        if (orders.length === 0) return;
        if (!assertCanReserve(orders)) return;
        sacramentoRunReserveWhatsAppFlow(async () => {
          const pendingTab = sacramentoOpenWhatsAppBlankTabForGesture();
          const expTotal = orders.reduce((s, o) => s + getEffectivePackagePricing(o).price, 0);
          const transportTotal = totalTransportForOrders(orders);
          const total = expTotal + transportTotal + groupGuideAmount();
          const waSummary = buildWhatsAppMessage(orders, "");
          let paymentUrl = "";
          try {
            paymentUrl = await resolveDynamicPaymentLink(dynamicPayment, {
              experience: dynamicPayment?.experienceId || experienceName,
              amount: total,
              currency: dynamicPayment?.currency || "USD",
              people: orders.length,
              orderFingerprint: stableStringify({
                orders: orders.map((o) => ({
                  ...o,
                  packagePrice: getEffectivePackagePricing(o).price,
                  packageLabel: getEffectivePackagePricing(o).label
                })),
                includeTransport: getBookingMeta().includeTransport,
                total
              }),
              orderPayload: withWhatsAppInOrderPayload(
                { orders, total, experienceName, bookingMeta: getBookingMeta() },
                waSummary
              )
            });
          } catch {}
          const message = buildWhatsAppMessage(orders, paymentUrl);
          sacramentoOpenWhatsApp(whatsappNumber, message, pendingTab);
        });
      }
    });

    createBtn.addEventListener("click", (e) => {
      e.preventDefault();
      openPopup();
    });

    closeBtn.addEventListener("click", (e) => {
      e.preventDefault();
      editingIndex = null;
      closePopup();
    });

    saveBtn.addEventListener("click", (e) => {
      e.preventDefault();

      const selectedPackage = popup.querySelector(`input[name="${packageRadioName}"]:checked`);
      if (!selectedPackage) {
        alert(getI18nText("orders_pkg_alert_select", "Please select a package"));
        return;
      }

      const packageId = selectedPackage.value;
      const spec = resolvePackageSpec(packageId);

      if (!spec || !spec.price) {
        alert(getI18nText("orders_pkg_alert_invalid", "Invalid package"));
        return;
      }

      const ordersBeforeSave = getOrders();
      const lockedId = pgc ? null : getLockedPackageId(ordersBeforeSave, editingIndex);
      if (lockedId != null && packageId !== String(lockedId)) {
        alert(
          getI18nText(
            "orders_pkg_alert_same_package",
            "All guests must book the same experience. To choose a different package, remove the current guest orders first."
          )
        );
        return;
      }

      const preferences = Array.from(
        popup.querySelectorAll('.preferences-inside input[type="checkbox"]:checked')
      ).map((cb) => {
        const span = cb.parentElement?.querySelector("span[data-translate]");
        const trKey = span?.dataset?.translate;
        if (trKey) return `${pkgI18nPrefPrefix}${trKey}`;
        return cb.value;
      });
      const og = optionalGuideEl();
      const includeGuide = og ? Boolean(og.checked) : false;

      const guestCount = pgc ? popupGuestCount : 1;
      const minG = getMinGuestsForPackageId(packageId);
      if (pgc && guestCount < minG) {
        alert(
          trTpl(
            "orders_pkg_alert_min_guests_save",
            "This package requires at least {min} people. Increase the number of guests to continue.",
            { min: String(minG) }
          )
        );
        return;
      }

      const orderTemplate = {
        packageId,
        packageLabel: spec.label,
        packagePrice: spec.price + (guideOptional ? (includeGuide ? guideFee : 0) : guideFee),
        preferences,
        ...(guideOptional ? { includeGuide } : {})
      };

      persistTransportFromPopup();

      let orders;
      if (pgc) {
        orders = Array.from({ length: guestCount }, () => ({ ...orderTemplate }));
        editingIndex = null;
      } else {
        orders = ordersBeforeSave;
        const order = { ...orderTemplate };
        if (editingIndex !== null) {
          orders[editingIndex] = order;
          editingIndex = null;
        } else {
          orders.push(order);
        }
      }

      setOrders(orders);
      closePopup();
      renderOrders();
      scrollToOrderSummary(orderSummaryId);
    });

    if (pgc) {
      const minusEl = pgcMinusBtn();
      const plusEl = pgcPlusBtn();
      if (minusEl) {
        minusEl.addEventListener("click", (e) => {
          e.preventDefault();
          setPopupGuestCount(popupGuestCount - 1);
        });
      }
      if (plusEl) {
        plusEl.addEventListener("click", (e) => {
          e.preventDefault();
          setPopupGuestCount(popupGuestCount + 1);
        });
      }
      popup.addEventListener("change", (e) => {
        const t = e.target;
        if (!(t instanceof HTMLInputElement) || t.type !== "radio") return;
        if (t.name !== packageRadioName) return;
        enforcePopupGuestCountForPackage();
      });
    }

    if (bookNowBottomId) {
      const bottomBtn = document.getElementById(bookNowBottomId);
      if (bottomBtn) {
        bottomBtn.addEventListener("click", (e) => {
          e.preventDefault();
          const orders = getOrders();
          if (orders.length === 0) {
            alert(getI18nText("orders_alert_create_first", "Please create your order first."));
            return;
          }
          if (!assertCanReserve(orders)) return;
          sacramentoRunReserveWhatsAppFlow(async () => {
            const pendingTab = sacramentoOpenWhatsAppBlankTabForGesture();
            const expTotal = orders.reduce((s, o) => s + getEffectivePackagePricing(o).price, 0);
            const transportTotal = totalTransportForOrders(orders);
            const total = expTotal + transportTotal + groupGuideAmount();
            const waSummary = buildWhatsAppMessage(orders, "");
            let paymentUrl = "";
            try {
              paymentUrl = await resolveDynamicPaymentLink(dynamicPayment, {
                experience: dynamicPayment?.experienceId || experienceName,
                amount: total,
                currency: dynamicPayment?.currency || "USD",
                people: orders.length,
                orderFingerprint: stableStringify({
                  orders: orders.map((o) => ({
                    ...o,
                    packagePrice: getEffectivePackagePricing(o).price,
                    packageLabel: getEffectivePackagePricing(o).label
                  })),
                  includeTransport: getBookingMeta().includeTransport,
                  total
                }),
                orderPayload: withWhatsAppInOrderPayload(
                  { orders, total, experienceName, bookingMeta: getBookingMeta() },
                  waSummary
                )
              });
            } catch {}
            const message = buildWhatsAppMessage(orders, paymentUrl);
            sacramentoOpenWhatsApp(whatsappNumber, message, pendingTab);
          });
        });
      }
    }

    if (groupGuideEnabled && groupGuideCheckboxId) {
      const gel = groupGuideEl();
      if (gel) {
        gel.checked = getGroupGuideStored();
        gel.addEventListener("change", () => {
          setGroupGuideStored(Boolean(gel.checked));
          renderOrders();
        });
      }
    }

    renderOrdersRef = renderOrders;
    window.renderOrders = renderOrders;
    renderOrders();
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bootPackageOrderDom, { once: true });
  } else {
    bootPackageOrderDom();
  }
}

/**
 * SIO Special Night — Especial Trufado popup (drink choice) + Bruma-style order summary (localStorage + Add order + WhatsApp).
 */
function initSioSpecialNightOrders(userConfig) {
  const config = {
    storageKey: "orders_sio_special",
    selectedDateKey: "selectedDateSio",
    orderSummaryId: "sioOrderSummary",
    popupId: "popupSioSpecial",
    openBtnId: "openSioSpecialMenuBtn",
    closeBtnId: "closeSioSpecial",
    formId: "sioSpecialMenuForm",
    formErrorId: "sioSpecialMenuFormError",
    saveBtnId: "saveSioSpecialMenu",
    drinkRadioName: "sioSpecialDrink",
    whatsappNumber: "59898945542",
    experienceNameKey: "sio_hero_h1",
    experienceNameFallback: "SIO Sushi Experience",
    bookNowBottomId: null,
    /** USD per Special Night menu order (same package × headcount / orders). */
    unitPriceUsd: 70,
    /** Same pattern as Bruma / food1: POST `/api/payments/resolve` → Plexo checkout URL in WhatsApp. */
    dynamicPayment: null,
    /** Optional La Misión-style room booking (same shape as `initExperience` `roomBooking`). */
    roomBooking: null,
    /** i18n key for WhatsApp intro (default: `sio_wa_intro`). */
    waIntroKey: null,
    ...userConfig
  };

  const run = () => {
    const rbCfg =
      config.roomBooking && typeof config.roomBooking === "object" && config.roomBooking.hostElementId
        ? config.roomBooking
        : null;
    const rbHost = rbCfg ? document.getElementById(String(rbCfg.hostElementId)) : null;
    const rb = rbCfg && rbHost ? rbCfg : null;
    const roomsStorageKey = rb ? `${config.storageKey}_roomBooking` : null;
    const curLabel = "USD";

    const summaryEl = document.getElementById(config.orderSummaryId);
    const overlay = document.getElementById(config.popupId);
    const openBtn = document.getElementById(config.openBtnId);
    const closeBtn = document.getElementById(config.closeBtnId);
    const form = document.getElementById(config.formId);
    const formError = document.getElementById(config.formErrorId);
    const saveBtn = document.getElementById(config.saveBtnId);
    if (!summaryEl || !overlay || !openBtn || !closeBtn || !form || !formError || !saveBtn) return;

    const getRoomRows = () => {
      if (!roomsStorageKey) return [];
      try {
        const raw = JSON.parse(localStorage.getItem(roomsStorageKey) || "{}");
        const rooms = Array.isArray(raw.rooms) ? raw.rooms : [];
        return rooms.map((r) => ({ guests: Math.max(0, Math.floor(Number(r && r.guests) || 0)) })).filter((r) => r.guests > 0);
      } catch {
        return [];
      }
    };

    const setRoomRows = (rows) => {
      if (!roomsStorageKey) return;
      const clean = (Array.isArray(rows) ? rows : [])
        .map((r) => ({ guests: Math.max(0, Math.floor(Number(r && r.guests) || 0)) }))
        .filter((r) => r.guests > 0);
      localStorage.setItem(roomsStorageKey, JSON.stringify({ rooms: clean }));
    };

    const occupancyOptsResolved = () => {
      const def = [1, 2, 3];
      if (!rb || !Array.isArray(rb.occupancyOptions) || rb.occupancyOptions.length === 0) return def;
      return rb.occupancyOptions
        .map((n) => Math.max(1, Math.min(20, Math.floor(Number(n) || 1))))
        .filter((n, i, a) => a.indexOf(n) === i)
        .sort((a, b) => a - b);
    };

    const defaultOccResolved = () => {
      const opts = occupancyOptsResolved();
      const want = Math.max(1, Math.floor(Number(rb && rb.defaultOccupancy) || 2));
      return opts.includes(want) ? want : opts[0];
    };

    const ensureDefaultRooms = () => {
      if (!rb) return;
      if (getRoomRows().length === 0) {
        setRoomRows([{ guests: defaultOccResolved() }]);
      }
    };

    const calculateGuestsFromRooms = () => sacramentoCalculateGuestsFromRooms(getRoomRows());
    const calculateTotalRoomCost = () => sacramentoCalculateRoomRowsCost(getRoomRows(), rb ? rb.priceByOccupancy : {});

    let editingIndex = null;

    const escapeHtml = (str) =>
      String(str ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");

    const getI18nText = (key, fallback) => {
      const lang = getSiteLanguage();
      const tr = sacramentoI18nTable();
      try {
        if (tr?.[lang]?.[key]) return tr[lang][key];
        if (tr?.en?.[key]) return tr.en[key];
      } catch {
        /* ignore */
      }
      return fallback;
    };

    const getOrders = () => {
      try {
        const raw = localStorage.getItem(config.storageKey);
        const arr = JSON.parse(raw || "[]");
        return Array.isArray(arr) ? arr : [];
      } catch {
        return [];
      }
    };

    const setOrders = (arr) => {
      localStorage.setItem(config.storageKey, JSON.stringify(arr));
    };

    const formatDate = (d) =>
      d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });

    const getDateForBooking = () => {
      const stored = config.selectedDateKey ? localStorage.getItem(config.selectedDateKey) : null;
      if (stored && /^\d{4}-\d{2}-\d{2}$/.test(stored)) {
        const [y, m, d] = stored.split("-").map(Number);
        const parsed = new Date(y, m - 1, d);
        if (!Number.isNaN(parsed.getTime())) return formatDate(parsed);
      }
      if (stored) return stored;
      return formatDate(new Date());
    };

    const drinkDisplay = (choice) => {
      const c = String(choice || "").trim();
      if (c === "juice") return getI18nText("sio_special_menu_drink_juice", "Juice");
      if (c === "wine") return getI18nText("sio_special_menu_drink_wine", "Glass of Deicas wine");
      return "—";
    };

    const canOpenAnotherMenuSio = () => {
      if (!rb) return true;
      const need = calculateGuestsFromRooms();
      if (need <= 0) {
        alert(getI18nText("orders_room_configure_first", "Configure your rooms first."));
        return false;
      }
      if (getOrders().length >= need) {
        alert(
          getI18nText(
            "orders_room_all_menus",
            "You already have one menu per guest. Edit or remove an order to change selections."
          )
        );
        return false;
      }
      return true;
    };

    const experienceBookReadySio = () => {
      if (!rb) return true;
      const need = calculateGuestsFromRooms();
      if (need <= 0) {
        alert(getI18nText("orders_room_configure_first", "Configure your rooms first."));
        return false;
      }
      if (getOrders().length !== need) {
        alert(
          getI18nText(
            "orders_room_one_menu_each",
            "Add exactly one menu per guest before reserving (see Your order)."
          )
        );
        return false;
      }
      return true;
    };

    const renderRoomBookingPanel = () => {
      if (!rb || !rbHost) return;
      ensureDefaultRooms();
      const rows = getRoomRows();
      const opts = occupancyOptsResolved();
      const maxRooms = Math.max(1, Math.min(20, Math.floor(Number(rb.maxRooms) || 8)));
      const minRooms = Math.max(1, Math.min(maxRooms, Math.floor(Number(rb.minRooms) || 1)));
      const defOcc = defaultOccResolved();

      let inner = `<h3>${escapeHtml(getI18nText("orders_room_block_title", "Rooms"))}</h3>`;
      if (rb.availabilityNoticeKey) {
        inner += `<p class="mision-room-availability-notice">${escapeHtml(
          getI18nText(
            rb.availabilityNoticeKey,
            "Please check availability with us on WhatsApp before completing your reservation."
          )
        )}</p>`;
      }
      inner += `<div class="room-booking-rows">`;
      rows.forEach((row, idx) => {
        const g = Math.max(1, row.guests || defOcc);
        const price = Number(rb.priceByOccupancy[String(g)]);
        const priceShow = Number.isFinite(price) ? price : 0;
        inner += `<div class="booking-visit-date-row room-booking-row" data-room-idx="${idx}">`;
        const roomWord = escapeHtml(getI18nText("orders_room_label", "Room"));
        inner += `<span class="room-booking-room-label"><span class="room-booking-room-word">${roomWord}</span><span class="room-booking-room-num">${idx + 1}</span></span>`;
        inner += `<label class="room-booking-guests-label">${escapeHtml(
          getI18nText("orders_room_guests_label", "Guests")
        )} <select class="room-booking-select" data-room-guests="${idx}" aria-label="${escapeHtml(
          getI18nText("orders_room_guests_label", "Guests")
        )}">`;
        opts.forEach((o) => {
          inner += `<option value="${o}"${o === g ? " selected" : ""}>${o}</option>`;
        });
        inner += `</select></label>`;
        inner += `<span class="room-row-price">${escapeHtml(curLabel)} ${priceShow}</span>`;
        if (rows.length > minRooms) {
          inner += `<button type="button" class="btn secondary room-remove-btn" data-room-remove="${idx}" aria-label="${escapeHtml(
            getI18nText("orders_room_remove", "Remove room")
          )}">×</button>`;
        }
        inner += `</div>`;
      });
      inner += `</div>`;
      if (rows.length < maxRooms) {
        inner += `<button type="button" class="btn primary-btn room-add-btn">+ ${escapeHtml(
          getI18nText("orders_room_add", "Add room")
        )}</button>`;
      }
      const tg = calculateGuestsFromRooms();
      const totalRoom = calculateTotalRoomCost();
      inner += `<p class="room-booking-foot">${escapeHtml(
        getI18nText("orders_room_guests_total", "Total guests")
      )}: <strong>${tg}</strong> · ${escapeHtml(getI18nText("orders_rooms_subtotal", "Rooms subtotal"))}: ${escapeHtml(
        curLabel
      )} <strong>${totalRoom}</strong></p>`;
      inner += `<p class="booking-visit-date-hint room-booking-hint">${escapeHtml(
        getI18nText("orders_room_summary_hint", "Create one menu per guest in the order summary below.")
      )}</p>`;
      rbHost.innerHTML = inner;
    };

    const fillPopupForEdit = (order) => {
      const c = String(order?.drinkChoice || "").trim();
      form.querySelectorAll(`input[name="${config.drinkRadioName}"]`).forEach((r) => {
        r.checked = c && r.value === c;
      });
    };

    const closePopup = () => {
      overlay.classList.remove("active");
      overlay.setAttribute("aria-hidden", "true");
      openBtn.focus();
    };

    const syncSaveBtnLabel = () => {
      saveBtn.textContent =
        editingIndex !== null
          ? getI18nText("update_order", "Update order")
          : getI18nText("save_selection", "Save selection");
    };

    const openPopup = () => {
      overlay.classList.add("active");
      overlay.setAttribute("aria-hidden", "false");
      formError.hidden = true;
      if (editingIndex === null) {
        form.querySelectorAll(`input[name="${config.drinkRadioName}"]`).forEach((r) => {
          r.checked = false;
        });
      } else {
        const orders = getOrders();
        fillPopupForEdit(orders[editingIndex]);
      }
      syncSaveBtnLabel();
      closeBtn.focus();
    };

    const openPopupForNewOrder = () => {
      if (rb && !canOpenAnotherMenuSio()) return;
      editingIndex = null;
      openPopup();
    };

    const buildWhatsAppMessage = (paymentLinkOverride = "") => {
      const orders = getOrders();
      const intro = getI18nText(
        config.waIntroKey || "sio_wa_intro",
        "Hello! I'd like to book the SIO Special Night menu:"
      );
      const visit = getI18nText("orders_visit_date_label", "Visit date");
      const guestWord = getI18nText("orders_wa_guest_slot", "Guest");
      const orderWord = getI18nText("order_word", "Order");
      const slotLabel = rb ? guestWord : orderWord;
      const expName = getI18nText(config.experienceNameKey, config.experienceNameFallback);
      const labMenu = getI18nText("sio_order_summary_menu_label", "Menu");
      const labRoll = getI18nText("sio_order_summary_roll_label", "Roll");
      const labDrink = getI18nText("drink_label", "Drink");
      const labDessert = getI18nText("dessert_word", "Dessert");
      const menuLine = getI18nText("sio_special_menu_line_trufa", "Truffle special (2 pieces)");
      const rollLine = getI18nText("sio_special_menu_item_roll", "Roll x 10 (your choice)");
      const dessertLine = getI18nText("sio_special_menu_item_dessert", "Dessert");
      const unitUsd = Math.max(0, Number(config.unitPriceUsd) || 0);
      const menuSubtotal = orders.length * unitUsd;
      const roomSubtotal = rb ? calculateTotalRoomCost() : 0;
      const grandTotal = menuSubtotal + roomSubtotal;
      const waTotalLabel = getI18nText("wa_total_label", "Total");

      let msg = `${intro}\n*${expName}*\n\n*${visit}:* ${getDateForBooking()}\n\n`;
      if (rb && getRoomRows().length > 0) {
        const rows = getRoomRows();
        const roomLines = rows
          .map((r, i) => {
            const g = r.guests;
            const pr = Number(rb.priceByOccupancy[String(g)]);
            const pshow = Number.isFinite(pr) ? pr : 0;
            return `*${getI18nText("orders_room_label", "Room")} ${i + 1}*: ${g} ${getI18nText(
              "orders_wa_room_guests_suffix",
              "guest(s)"
            )} — USD ${pshow}`;
          })
          .join("\n");
        msg += `${roomLines}\n${getI18nText("orders_wa_rooms_subtotal_label", "Rooms subtotal")}: USD ${roomSubtotal}\n`;
        msg += `${getI18nText("orders_wa_rooms_breakfast_note", "Rooms include breakfast.")}\n\n`;
      }
      orders.forEach((o, i) => {
        msg += `*${slotLabel} ${i + 1}*\n`;
        msg += `${labMenu}: ${menuLine}\n`;
        msg += `${labRoll}: ${rollLine}\n`;
        msg += `${labDrink}: ${drinkDisplay(o.drinkChoice)}\n`;
        msg += `${labDessert}: ${dessertLine}\n\n`;
      });
      if (orders.length > 0 && unitUsd > 0) {
        msg += `*${getI18nText("orders_wa_menu_subtotal", "Menus subtotal")}:* USD ${menuSubtotal} (${orders.length} × USD ${unitUsd})\n`;
      }
      if (rb && roomSubtotal > 0) {
        msg += `*${getI18nText("orders_wa_rooms_line", "Overnight rooms")}:* USD ${roomSubtotal}\n`;
      }
      if (orders.length > 0 || roomSubtotal > 0) {
        msg += `*${waTotalLabel}:* USD ${grandTotal}\n`;
      }
      if (paymentLinkOverride) {
        const cta =
          getI18nText("wa_payment_cta", "") ||
          getI18nText(
            "wa_payment_prompt",
            "To confirm the reservation, please complete the payment here:"
          );
        msg += `\n${cta}\n${paymentLinkOverride}`;
        msg += `\n\n${getI18nText(
          "food_post_payment_note",
          "After payment, we will send your reservation details and instructions."
        )}`;
      }
      return msg;
    };

    const openWhatsAppWithPlexoLink = () => {
      const orders = getOrders();
      if (orders.length === 0) return;
      if (rb && !experienceBookReadySio()) return;
      const unitUsd = Math.max(0, Number(config.unitPriceUsd) || 0);
      const menuTotal = orders.length * unitUsd;
      const roomTotal = rb ? calculateTotalRoomCost() : 0;
      const totalUsd = menuTotal + roomTotal;
      const peopleCount = rb ? calculateGuestsFromRooms() : orders.length;
      const dp = config.dynamicPayment;
      sacramentoRunReserveWhatsAppFlow(async () => {
        const pendingTab = sacramentoOpenWhatsAppBlankTabForGesture();
        let finalMessage = buildWhatsAppMessage("");
        const waSummary = buildWhatsAppMessage("");
        try {
          if (dp && dp.enabled && totalUsd > 0) {
            const paymentUrl = await resolveDynamicPaymentLink(dp, {
              experience: dp.experienceId || "sio_special_night",
              amount: totalUsd,
              currency: dp.currency || "USD",
              people: peopleCount,
              orderFingerprint: stableStringify({
                storageKey: config.storageKey,
                orders,
                rooms: rb ? getRoomRows() : null,
                total: totalUsd,
                people: peopleCount
              }),
              orderPayload: withWhatsAppInOrderPayload(
                {
                  kind: rb ? "mision_sio_night" : "sio_special_night",
                  orders,
                  totalUsd: menuTotal,
                  roomSubtotal: rb ? roomTotal : undefined,
                  rooms: rb ? getRoomRows() : undefined,
                  visitDate: getDateForBooking()
                },
                waSummary
              )
            });
            if (paymentUrl) {
              finalMessage = buildWhatsAppMessage(paymentUrl);
            }
          }
        } catch {
          /* WhatsApp sin enlace si el backend / Plexo no responde */
        }
        sacramentoOpenWhatsApp(config.whatsappNumber, finalMessage, pendingTab);
      });
    };

    const renderOrders = () => {
      const orders = getOrders();
      const t = (k, f) => getI18nText(k, f);

      let html = "";
      const needGuests = rb ? calculateGuestsFromRooms() : 0;
      if (orders.length > 0 && (!rb || orders.length < needGuests)) {
        html += `<button type="button" id="addGuestBtn" class="add-guest-btn">+ ${escapeHtml(
          t("add_order", "Add Order")
        )}</button>`;
      }
      html += `<h3>${escapeHtml(t("your_order", "Your order"))}</h3>`;

      if (config.selectedDateKey) {
        html += `<p class="order-summary-visit-date"><strong>${escapeHtml(
          t("orders_visit_date_label", "Visit date")
        )}:</strong> ${escapeHtml(getDateForBooking())}</p>`;
      }

      const labMenu = t("sio_order_summary_menu_label", "Menu");
      const labRoll = t("sio_order_summary_roll_label", "Roll");
      const labDrink = t("drink_label", "Drink");
      const labDessert = t("dessert_word", "Dessert");
      const menuLine = t("sio_special_menu_line_trufa", "Truffle special (2 pieces)");
      const rollLine = t("sio_special_menu_item_roll", "Roll x 10 (your choice)");
      const dessertLine = t("sio_special_menu_item_dessert", "Dessert");
      const guestTitle = t("orders_wa_guest_slot", "Guest");
      const orderTitle = t("order_word", "Order");

      orders.forEach((o, i) => {
        html += `
          <div class="order-card">
            <div class="order-header">
              <h3 class="order-card-title">${escapeHtml(rb ? guestTitle : orderTitle)} ${i + 1}</h3>
              <div class="order-actions">
                <span class="edit-order" data-index="${i}">✏️</span>
                <span class="delete-order" data-index="${i}">🗑️</span>
              </div>
            </div>
            <p><strong>${escapeHtml(labMenu)}:</strong> ${escapeHtml(menuLine)}</p>
            <p><strong>${escapeHtml(labRoll)}:</strong> ${escapeHtml(rollLine)}</p>
            <p><strong>${escapeHtml(labDrink)}:</strong> ${escapeHtml(drinkDisplay(o.drinkChoice))}</p>
            <p><strong>${escapeHtml(labDessert)}:</strong> ${escapeHtml(dessertLine)}</p>
          </div>`;
      });

      if (orders.length > 0) {
        const unitUsd = Math.max(0, Number(config.unitPriceUsd) || 0);
        const menuSubtotal = orders.length * unitUsd;
        const roomCostUi = rb ? calculateTotalRoomCost() : 0;
        const grandTotal = menuSubtotal + roomCostUi;
        const sub = t("orders_sio_ready_sub", "Tap Reserve to send your choices by WhatsApp.");
        const totalLabel = t("total_label", "Total");
        const multHint = unitUsd > 0 ? `(${orders.length} × USD ${unitUsd})` : "";
        const summaryBookings =
          rb && needGuests > 0
            ? `${needGuests} ${t("orders_summary_guests_word", "guests")} · ${orders.length}/${needGuests} ${t(
                "orders_summary_menus_word",
                "menus"
              )}`
            : `${orders.length} ${t("order_word", "Order")}`;
        const roomDetail = roomCostUi > 0 ? ` · ${t("orders_rooms_short", "rooms")} USD ${roomCostUi}` : "";
        html += `
          <div class="total-box">
            <div class="total-left">
              <span class="total-label">${escapeHtml(totalLabel)}</span>
              ${multHint ? `<span class="total-detail">${escapeHtml(multHint)}</span>` : ""}
              <span class="total-detail">${escapeHtml(summaryBookings)}${escapeHtml(roomDetail)}</span>
              <span class="total-detail">${escapeHtml(sub)}</span>
            </div>
            ${
              grandTotal > 0
                ? `<div class="total-right">USD ${grandTotal}</div>`
                : ""
            }
            <a href="#" id="bookWithOrder" class="btn total-btn">${escapeHtml(t("book_btn", "Reserve"))}</a>
          </div>`;
      }

      summaryEl.innerHTML = html;
    };

    let roomBookingEventsBound = false;
    const bindRoomBookingEventsOnce = () => {
      if (!rb || !rbHost || roomBookingEventsBound) return;
      roomBookingEventsBound = true;
      rbHost.addEventListener("change", (e) => {
        const sel = e.target && e.target.closest && e.target.closest("select[data-room-guests]");
        if (!sel) return;
        const idx = Number(sel.getAttribute("data-room-guests"));
        const val = Math.max(1, Math.floor(Number(sel.value) || 1));
        const rows = getRoomRows().map((r) => ({ ...r }));
        if (!rows[idx]) return;
        rows[idx] = { guests: val };
        const nextG = sacramentoCalculateGuestsFromRooms(rows);
        if (nextG < getOrders().length) {
          alert(
            getI18nText(
              "orders_room_reduce_blocked",
              "Remove or edit menu orders first before lowering the guest count."
            )
          );
          renderRoomBookingPanel();
          return;
        }
        setRoomRows(rows);
        renderRoomBookingPanel();
        renderOrders();
      });
      rbHost.addEventListener("click", (e) => {
        const add = e.target.closest && e.target.closest(".room-add-btn");
        if (add) {
          e.preventDefault();
          const maxR = Math.max(1, Math.min(20, Math.floor(Number(rb.maxRooms) || 8)));
          const rows = [...getRoomRows(), { guests: defaultOccResolved() }];
          if (rows.length > maxR) return;
          setRoomRows(rows);
          renderRoomBookingPanel();
          renderOrders();
          return;
        }
        const rm = e.target.closest && e.target.closest("[data-room-remove]");
        if (rm) {
          e.preventDefault();
          const idx = Number(rm.getAttribute("data-room-remove"));
          const rows = getRoomRows().filter((_, j) => j !== idx);
          const minR = Math.max(1, Math.min(20, Math.floor(Number(rb.minRooms) || 1)));
          if (rows.length < minR) return;
          const nextG = sacramentoCalculateGuestsFromRooms(rows);
          if (nextG < getOrders().length) {
            alert(
              getI18nText(
                "orders_room_reduce_blocked",
                "Remove or edit menu orders first before removing capacity."
              )
            );
            return;
          }
          setRoomRows(rows);
          renderRoomBookingPanel();
          renderOrders();
        }
      });
    };

    summaryEl.addEventListener("click", (e) => {
      const addBtn = e.target.closest("#addGuestBtn");
      if (addBtn) {
        e.preventDefault();
        openPopupForNewOrder();
        return;
      }

      const delEl = e.target.closest(".delete-order");
      if (delEl) {
        e.preventDefault();
        const idx = Number(delEl.dataset.index);
        const orders = getOrders();
        if (!Number.isFinite(idx) || idx < 0 || idx >= orders.length) return;
        orders.splice(idx, 1);
        setOrders(orders);
        if (editingIndex !== null) {
          if (editingIndex === idx) {
            editingIndex = null;
            closePopup();
          } else if (editingIndex > idx) {
            editingIndex -= 1;
          }
        }
        renderOrders();
        if (rb) renderRoomBookingPanel();
        return;
      }

      const editEl = e.target.closest(".edit-order");
      if (editEl) {
        e.preventDefault();
        const idx = Number(editEl.dataset.index);
        const orders = getOrders();
        const order = orders[idx];
        if (!order) return;
        editingIndex = idx;
        openPopup();
        return;
      }

      const bookEl = e.target.closest("#bookWithOrder");
      if (bookEl) {
        e.preventDefault();
        openWhatsAppWithPlexoLink();
      }
    });

    openBtn.addEventListener("click", (e) => {
      e.preventDefault();
      openPopupForNewOrder();
    });

    closeBtn.addEventListener("click", (e) => {
      e.preventDefault();
      editingIndex = null;
      closePopup();
    });

    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) {
        editingIndex = null;
        closePopup();
      }
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && overlay.classList.contains("active")) {
        editingIndex = null;
        closePopup();
      }
    });

    form.querySelectorAll(`input[name="${config.drinkRadioName}"]`).forEach((radio) => {
      radio.addEventListener("change", () => {
        formError.hidden = true;
      });
    });

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const sel = form.querySelector(`input[name="${config.drinkRadioName}"]:checked`);
      if (!sel) {
        formError.hidden = false;
        return;
      }
      formError.hidden = true;
      const orders = getOrders();
      if (rb && editingIndex === null && orders.length >= calculateGuestsFromRooms()) {
        alert(
          getI18nText(
            "orders_room_all_menus",
            "You already have one menu per guest. Edit or remove an order to change selections."
          )
        );
        return;
      }
      const order = { drinkChoice: sel.value };
      if (editingIndex !== null) {
        orders[editingIndex] = order;
        editingIndex = null;
      } else {
        orders.push(order);
      }
      setOrders(orders);
      closePopup();
      renderOrders();
      scrollToOrderSummary(config.orderSummaryId);
    });

    if (config.bookNowBottomId) {
      const footerBook = document.getElementById(config.bookNowBottomId);
      if (footerBook) {
        footerBook.addEventListener("click", (e) => {
          e.preventDefault();
          if (getOrders().length === 0) {
            alert(getI18nText("orders_alert_create_first", "Please create your order first."));
            return;
          }
          openWhatsAppWithPlexoLink();
        });
      }
    }

    document.addEventListener("sacramento:setLanguage", () => {
      renderOrders();
      if (rb) renderRoomBookingPanel();
      if (overlay.classList.contains("active")) syncSaveBtnLabel();
    });

    document.addEventListener("sacramento:visitDateChanged", (e) => {
      if (!config.selectedDateKey) return;
      if (e.detail && e.detail.key && e.detail.key !== config.selectedDateKey) return;
      renderOrders();
      if (rb) renderRoomBookingPanel();
    });

    document.querySelectorAll(".lang-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        window.requestAnimationFrame(() => {
          renderOrders();
          if (rb) renderRoomBookingPanel();
          if (overlay.classList.contains("active")) syncSaveBtnLabel();
        });
      });
    });

    if (rb && rbHost) {
      bindRoomBookingEventsOnce();
      ensureDefaultRooms();
      renderRoomBookingPanel();
    }

    renderOrders();
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", run);
  } else {
    run();
  }
}

/** Hash from home / category cards: #reservar → scroll to “create experience” control. */
const SACRAMENTO_RESERVE_HASH = "reservar";

function findCreateButtonInOrderStart(block) {
  if (!block) return null;
  const byId = block.querySelector(
    '[id*="Create"], [id*="create"], #openSioSpecialMenuBtn'
  );
  if (byId) return byId;
  return (
    block.querySelector("button.primary-btn, .btn.primary-btn") ||
    block.querySelector('button.btn[type="button"], button.btn')
  );
}

function findExperienceCreateTarget() {
  const blocks = Array.from(document.querySelectorAll(".order-start")).filter((el) => {
    if (el.id && /RoomBooking$/i.test(el.id)) return false;
    if (el.classList.contains("room-booking-host")) return false;
    if (el.classList.contains("mision-room-booking-host")) return false;
    return true;
  });

  for (const block of blocks) {
    const btn = findCreateButtonInOrderStart(block);
    if (btn) return btn;
  }

  return document.querySelector(
    '[id*="CreateBtn"], [id*="createMenuBtn"], #openSioSpecialMenuBtn, #createMenuBtn'
  );
}

function scrollToExperienceCreateFromHash() {
  const hash = (location.hash || "").replace(/^#/, "").toLowerCase();
  if (hash !== SACRAMENTO_RESERVE_HASH) return;

  const run = () => {
    const target = findExperienceCreateTarget();
    if (!target) return;
    target.scrollIntoView({ behavior: "smooth", block: "center" });
    target.classList.add("reserve-scroll-highlight");
    window.setTimeout(() => target.classList.remove("reserve-scroll-highlight"), 2200);
  };

  const schedule = () => window.setTimeout(run, 320);
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", schedule, { once: true });
  } else {
    schedule();
  }
  window.addEventListener("load", () => window.setTimeout(run, 80), { once: true });
}

scrollToExperienceCreateFromHash();
window.sacramentoScrollToExperienceCreate = scrollToExperienceCreateFromHash;
window.sacramentoBuildWhatsAppUrl = sacramentoBuildWhatsAppUrl;
window.sacramentoOpenWhatsApp = sacramentoOpenWhatsApp;
window.sacramentoOpenWhatsAppBlankTabForGesture = sacramentoOpenWhatsAppBlankTabForGesture;
window.sacramentoNavigatePendingTabToWhatsApp = sacramentoNavigatePendingTabToWhatsApp;
window.sacramentoShowReserveLoading = sacramentoShowReserveLoading;
window.sacramentoHideReserveLoading = sacramentoHideReserveLoading;
window.sacramentoRunReserveWhatsAppFlow = sacramentoRunReserveWhatsAppFlow;
window.sacramentoRetryPaymentLinkFromPendingTab = sacramentoRetryPaymentLinkFromPendingTab;
window.sacramentoOpenReserveWhatsAppFromPendingTab = sacramentoOpenReserveWhatsAppFromPendingTab;
window.SACRAMENTO_TAXI_WHATSAPP_NUMBER = SACRAMENTO_TAXI_WHATSAPP_NUMBER;
window.sacramentoFixWhatsAppAnchorTargets = sacramentoFixWhatsAppAnchorTargets;
window.sacramentoInitTaxiFloatLinks = sacramentoInitTaxiFloatLinks;
window.sacramentoInitWhatsAppFloatLinks = sacramentoInitWhatsAppFloatLinks;
window.sacramentoGetI18nText = sacramentoGetI18nText;
window.getSiteLanguage = getSiteLanguage;

if (typeof document !== "undefined") {
  const runWaAnchorFix = () => {
    sacramentoInitTaxiFloatLinks(document);
    sacramentoInitWhatsAppFloatLinks(document);
    sacramentoFixWhatsAppAnchorTargets(document);
  };
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", runWaAnchorFix);
  } else {
    runWaAnchorFix();
  }
  document.addEventListener("sacramento:setLanguage", () => {
    sacramentoInitWhatsAppFloatLinks(document);
  });
}

/** Activity pages load orders.js without payments-api-config.js — same Render prewarm once per session. */
(function sacramentoPrewarmPaymentsBackendFromOrders() {
  if (typeof window === "undefined") return;
  const api = window.SacramentoPaymentsApi;
  if (api && typeof api.prewarmPaymentsBackend === "function") {
    api.prewarmPaymentsBackend();
    return;
  }
  const PREWARM_SESSION_KEY = "sacramento_payments_prewarm_v1";
  const PREWARM_TIMEOUT_MS = 6000;
  if (typeof fetch !== "function" || window.location?.protocol === "file:") return;
  try {
    if (sessionStorage.getItem(PREWARM_SESSION_KEY)) return;
    sessionStorage.setItem(PREWARM_SESSION_KEY, "1");
  } catch (_) {
    return;
  }
  const base = sacramentoResolvePaymentsApiBase();
  const url = `${base}/health`;
  const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
  const timer =
    controller && typeof window.setTimeout === "function"
      ? window.setTimeout(() => controller.abort(), PREWARM_TIMEOUT_MS)
      : null;
  fetch(url, {
    method: "GET",
    mode: "cors",
    credentials: "omit",
    signal: controller ? controller.signal : undefined
  })
    .catch(function () {})
    .finally(function () {
      if (timer != null) window.clearTimeout(timer);
    });
})();

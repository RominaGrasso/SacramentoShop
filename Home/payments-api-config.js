/**
 * Single source of truth for Sacramento payments API (Render production + local dev).
 * Load before admin.js, orders.js, payment-pages.js, or index.js rent/payment helpers.
 *
 * Optional override (staging): window.SACRAMENTO_PAYMENTS_API_BASE = "https://...";
 */
(function (global) {
  "use strict";

  /** Live Plexo backend on Render (service name includes "test", but this is production). */
  const PRODUCTION_BASE = "https://sacramento-payments-test.onrender.com";
  const LOCAL_BASE = "http://localhost:8787";

  function isLocalDevHost() {
    if (typeof window === "undefined") return false;
    const host = String(window.location?.hostname || "").toLowerCase();
    return host === "localhost" || host === "127.0.0.1";
  }

  function resolvePaymentsApiBase() {
    if (typeof window !== "undefined" && window.SACRAMENTO_PAYMENTS_API_BASE) {
      return String(window.SACRAMENTO_PAYMENTS_API_BASE).replace(/\/+$/, "");
    }
    if (isLocalDevHost()) return LOCAL_BASE;
    return PRODUCTION_BASE;
  }

  /** Candidate URLs for POST /api/payments/resolve (and similar). */
  function buildResolveEndpointCandidates(endpointRaw) {
    const endpoint = String(endpointRaw || "/api/payments/resolve").trim();
    const isAbsolute = /^https?:\/\//i.test(endpoint);
    const candidates = [];
    const local = isLocalDevHost();
    const productionBase = PRODUCTION_BASE;
    const localBase = LOCAL_BASE;

    if (isAbsolute) {
      candidates.push(endpoint);
    } else if (endpoint.startsWith("/")) {
      if (local) {
        candidates.push(`${localBase}${endpoint}`);
        candidates.push(`${productionBase}${endpoint}`);
      }
      if (typeof window !== "undefined" && window.location?.origin && window.location.protocol !== "file:") {
        candidates.push(endpoint);
      }
      if (!local) {
        candidates.push(`${productionBase}${endpoint}`);
      }
    } else {
      const path = `/${endpoint.replace(/^\.?\//, "")}`;
      if (local) {
        candidates.push(`${localBase}${path}`);
        candidates.push(`${productionBase}${path}`);
      }
      candidates.push(endpoint);
      if (!local) {
        candidates.push(`${productionBase}${path}`);
      }
    }

    if (typeof window !== "undefined" && window.location?.protocol === "file:") {
      const path = endpoint.startsWith("/")
        ? endpoint
        : `/${endpoint.replace(/^\/+/, "")}`;
      candidates.unshift(`${localBase}${path}`, `http://127.0.0.1:8787${path}`);
    }

    return [...new Set(candidates.filter(Boolean))];
  }

  const PREWARM_SESSION_KEY = "sacramento_payments_prewarm_v1";
  const PREWARM_TIMEOUT_MS = 6000;

  /**
   * Silent one-shot prewarm per browser session so Render wakes before "Reservar".
   * Does not block UI or change reserve/WhatsApp flow.
   */
  function prewarmPaymentsBackend() {
    if (typeof window === "undefined" || typeof fetch !== "function") return;
    if (window.location?.protocol === "file:") return;
    try {
      if (sessionStorage.getItem(PREWARM_SESSION_KEY)) return;
      sessionStorage.setItem(PREWARM_SESSION_KEY, "1");
    } catch (_) {
      return;
    }

    const base = resolvePaymentsApiBase();
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
  }

  const api = {
    PRODUCTION_BASE,
    LOCAL_BASE,
    isLocalDevHost,
    resolvePaymentsApiBase,
    buildResolveEndpointCandidates,
    prewarmPaymentsBackend
  };

  if (typeof window !== "undefined") {
    window.SacramentoPaymentsApi = api;
    prewarmPaymentsBackend();
  }
  if (typeof global !== "undefined") {
    global.SacramentoPaymentsApi = api;
  }
})(typeof window !== "undefined" ? window : globalThis);

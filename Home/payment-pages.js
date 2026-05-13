(function () {
  "use strict";

  const POLL_INTERVAL_MS = 1500;
  const POLL_MAX_MS = 50000;

  function sacramentoI18nTable() {
    if (typeof translations !== "undefined" && translations) return translations;
    if (typeof window !== "undefined" && window.__SACRAMENTO_TRANSLATIONS) return window.__SACRAMENTO_TRANSLATIONS;
    return {};
  }

  function sacramentoLanguage() {
    const lang = String(localStorage.getItem("selectedLanguage") || "en").toLowerCase();
    const table = sacramentoI18nTable();
    return table[lang] ? lang : "en";
  }

  function getI18nText(key, fallback) {
    const lang = sacramentoLanguage();
    const tr = sacramentoI18nTable();
    if (tr?.[lang]?.[key]) return tr[lang][key];
    if (tr?.en?.[key]) return tr.en[key];
    return fallback;
  }

  function paymentsApiBase() {
    if (typeof window === "undefined") return "";
    if (window.SACRAMENTO_PAYMENTS_API_BASE) {
      return String(window.SACRAMENTO_PAYMENTS_API_BASE).replace(/\/+$/, "");
    }
    const host = window.location?.hostname || "";
    if (host === "localhost" || host === "127.0.0.1") {
      return "http://localhost:8787";
    }
    return "https://sacramento-payments-test.onrender.com";
  }

  function resultApiCandidates(ref) {
    const path = `/api/payments/result?ref=${encodeURIComponent(ref)}`;
    const base = paymentsApiBase();
    const host = window.location?.hostname || "";
    const list = [`${base}${path}`];
    if ((host === "localhost" || host === "127.0.0.1") && window.location?.protocol !== "file:") {
      list.unshift(path);
    }
    return [...new Set(list)];
  }

  async function fetchPaymentResult(ref) {
    const candidates = resultApiCandidates(ref);
    let lastError = null;
    for (const url of candidates) {
      try {
        const res = await fetch(url, { method: "GET", headers: { Accept: "application/json" } });
        if (!res.ok) {
          lastError = new Error(`HTTP ${res.status}`);
          continue;
        }
        return await res.json();
      } catch (err) {
        lastError = err;
      }
    }
    throw lastError || new Error("result_fetch_failed");
  }

  function pageForOutcome(outcome) {
    if (outcome === "success") return "payment-success.html";
    if (outcome === "pending") return "payment-pending.html";
    return "payment-failed.html";
  }

  function applyWhatsAppLink() {
    const waBtn = document.getElementById("paymentWaBtn");
    if (!waBtn) return;
    const text = getI18nText(
      "payment_wa_prefill",
      "Hello! I have a question about my Sacramento Adventures payment."
    );
    waBtn.href = "https://wa.me/598091642195?text=" + encodeURIComponent(text);
  }

  function readRefFromLocation() {
    const params = new URLSearchParams(window.location.search);
    const hash = window.location.hash.replace(/^\?/, "").replace(/^#/, "");
    if (hash) {
      new URLSearchParams(hash).forEach((v, k) => {
        if (!params.has(k)) params.set(k, v);
      });
    }
    return String(params.get("ref") || "").trim();
  }

  async function pollPaymentResult(ref) {
    const started = Date.now();
    while (Date.now() - started < POLL_MAX_MS) {
      const data = await fetchPaymentResult(ref);
      const outcome = String(data?.outcome || "processing");
      if (outcome !== "processing") {
        window.location.replace(pageForOutcome(outcome));
        return;
      }
      await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
    }
    window.location.replace("payment-pending.html");
  }

  async function runReturnRouter() {
    const ref = readRefFromLocation();
    if (!ref) {
      window.location.replace("payment-failed.html");
      return;
    }
    try {
      await pollPaymentResult(ref);
    } catch {
      window.location.replace("payment-pending.html");
    }
  }

  function bindRetry() {
    const retry = document.getElementById("paymentRetryBtn");
    if (!retry) return;
    retry.addEventListener("click", (e) => {
      e.preventDefault();
      if (window.history.length > 1) {
        window.history.back();
        return;
      }
      window.location.href = "index.html";
    });
  }

  window.SacramentoPaymentPages = { getI18nText, runReturnRouter, bindRetry, applyWhatsAppLink };

  document.addEventListener("DOMContentLoaded", () => {
    applyWhatsAppLink();
    bindRetry();
    if (document.body.classList.contains("page-payment-return")) {
      runReturnRouter();
    }
  });
})();

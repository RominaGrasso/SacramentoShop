(function () {
  "use strict";

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

  function applyWhatsAppLink() {
    const waBtn = document.getElementById("paymentWaBtn");
    if (!waBtn) return;
    const text = getI18nText(
      "payment_wa_prefill",
      "Hello! I have a question about my Sacramento Adventures payment."
    );
    waBtn.href = "https://wa.me/598091642195?text=" + encodeURIComponent(text);
  }

  function classifyPlexoReturnOutcome(params) {
    const state = params.get("CurrentState") || params.get("currentState") || params.get("Status") || params.get("status");
    const stateNum = Number(state);
    if (Number.isFinite(stateNum)) {
      if (stateNum === 1) return "success";
      if ([2, 10, 20, 21, 22, 23, 998, 999].includes(stateNum)) return "failed";
    }
    const resultCode = Number(params.get("ResultCode") || params.get("resultCode"));
    if (Number.isFinite(resultCode) && ![0, 1, 2].includes(resultCode)) return "failed";
    const cancelled = String(params.get("cancelled") || params.get("canceled") || params.get("cancel") || "").toLowerCase();
    if (cancelled === "1" || cancelled === "true" || cancelled === "yes") return "failed";
    const denied = String(params.get("denied") || params.get("error") || params.get("failed") || "").toLowerCase();
    if (denied === "1" || denied === "true" || denied === "yes") return "failed";
    const successFlag = String(params.get("success") || params.get("paid") || "").toLowerCase();
    if (successFlag === "1" || successFlag === "true" || successFlag === "yes") return "success";
    return "success";
  }

  function runReturnRouter() {
    const params = new URLSearchParams(window.location.search);
    const hash = window.location.hash.replace(/^\?/, "").replace(/^#/, "");
    if (hash) {
      new URLSearchParams(hash).forEach((v, k) => {
        if (!params.has(k)) params.set(k, v);
      });
    }
    const outcome = classifyPlexoReturnOutcome(params);
    const target = outcome === "success" ? "payment-success.html" : "payment-failed.html";
    const tail = params.toString() ? `?${params.toString()}` : "";
    window.location.replace(`${target}${tail}`);
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

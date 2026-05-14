(function () {
  "use strict";

  const POLL_INTERVAL_MS = 1500;
  const POLL_MAX_MS = 45000;
  const WATCHDOG_MS = 45000;
  const FETCH_TIMEOUT_MS = 8000;

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

  function readLocationParams() {
    const params = new URLSearchParams(window.location.search);
    const hash = window.location.hash.replace(/^\?/, "").replace(/^#/, "");
    if (hash) {
      new URLSearchParams(hash).forEach((v, k) => {
        if (!params.has(k)) params.set(k, v);
      });
    }
    return params;
  }

  function readRefFromLocation() {
    const params = readLocationParams();
    return String(
      params.get("ref") || params.get("ClientReferenceId") || params.get("clientReferenceId") || ""
    ).trim();
  }

  function hasExplicitCancelOrError() {
    const params = readLocationParams();
    const truthy = (v) => {
      const s = String(v || "")
        .trim()
        .toLowerCase();
      return s && s !== "0" && s !== "false" && s !== "no";
    };
    for (const key of ["cancel", "cancelled", "canceled", "aborted", "abort"]) {
      if (truthy(params.get(key))) return true;
    }
    if (truthy(params.get("error")) || truthy(params.get("ErrorMessage")) || truthy(params.get("errorMessage"))) {
      return true;
    }
    const resultCode = Number(params.get("ResultCode") ?? params.get("resultCode"));
    if (Number.isFinite(resultCode) && resultCode === 2) return true;
    const status = String(params.get("status") || params.get("payment_status") || "")
      .trim()
      .toLowerCase();
    if (["cancelled", "canceled", "failed", "error", "rejected", "declined"].includes(status)) return true;
    return false;
  }

  function deriveOutcomeFromPaymentStatus(paymentStatus) {
    const s = String(paymentStatus || "").toLowerCase();
    if (s === "approved") return "success";
    if (s === "failed") return "failed";
    if (s === "pending" || s === "awaiting_payment") return "pending";
    return "processing";
  }

  function resolveOutcome(data) {
    if (data?.outcome != null && String(data.outcome).trim() !== "") {
      return String(data.outcome);
    }
    if (data?.paymentStatus != null) {
      return deriveOutcomeFromPaymentStatus(data.paymentStatus);
    }
    return "processing";
  }

  async function fetchPaymentResult(ref) {
    const candidates = resultApiCandidates(ref);
    let lastError = null;
    for (const url of candidates) {
      try {
        const res = await fetch(url, {
          method: "GET",
          headers: { Accept: "application/json" },
          signal: AbortSignal.timeout(FETCH_TIMEOUT_MS)
        });
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

  function pageForOutcome(outcome, ref) {
    if (outcome === "success") return "payment-success.html";
    if (outcome === "pending") return "payment-pending.html";
    const refParam = ref ? `?ref=${encodeURIComponent(ref)}` : "";
    return `payment-failed.html${refParam}`;
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

  async function pollPaymentResult(ref) {
    const started = Date.now();
    while (Date.now() - started < POLL_MAX_MS) {
      const data = await fetchPaymentResult(ref);
      const outcome = resolveOutcome(data);
      if (outcome !== "processing") {
        window.location.replace(pageForOutcome(outcome, ref));
        return;
      }
      await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
    }
    window.location.replace("payment-pending.html");
  }

  async function runReturnRouter() {
    if (hasExplicitCancelOrError()) {
      window.location.replace(pageForOutcome("failed", readRefFromLocation()));
      return;
    }

    const ref = readRefFromLocation();
    if (!ref) {
      window.location.replace("payment-failed.html");
      return;
    }

    const watchdog = window.setTimeout(() => {
      if (document.body?.classList.contains("page-payment-return")) {
        window.location.replace("payment-pending.html");
      }
    }, WATCHDOG_MS);

    try {
      await pollPaymentResult(ref);
    } catch {
      window.location.replace("payment-pending.html");
    } finally {
      window.clearTimeout(watchdog);
    }
  }

  function resolveApiCandidates() {
    const path = "/api/payments/resolve";
    const base = paymentsApiBase();
    const host = window.location?.hostname || "";
    const list = [`${base}${path}`];
    if ((host === "localhost" || host === "127.0.0.1") && window.location?.protocol !== "file:") {
      list.unshift(path);
    }
    return [...new Set(list)];
  }

  async function requestNewPaymentCheckout(ref) {
    const data = await fetchPaymentResult(ref);
    if (!data?.found || !data.experience || !Number.isFinite(Number(data.amount)) || Number(data.amount) <= 0) {
      throw new Error("retry_context_missing");
    }
    const body = {
      experience: data.experience,
      amount: Number(data.amount),
      currency: data.currency || "USD",
      people: Number.isFinite(Number(data.people)) ? Number(data.people) : null,
      orderPayload: data.orderPayload ?? null
    };
    const candidates = resolveApiCandidates();
    let lastError = null;
    for (const url of candidates) {
      try {
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
          body: JSON.stringify(body)
        });
        if (!res.ok) {
          lastError = new Error(`HTTP ${res.status}`);
          continue;
        }
        const created = await res.json();
        const paymentUrl = String(created.paymentUrl || created.url || "").trim();
        if (!paymentUrl) {
          lastError = new Error("missing_payment_url");
          continue;
        }
        return paymentUrl;
      } catch (err) {
        lastError = err;
      }
    }
    throw lastError || new Error("resolve_failed");
  }

  function bindRetry() {
    const retry = document.getElementById("paymentRetryBtn");
    if (!retry) return;
    retry.addEventListener("click", (e) => {
      e.preventDefault();
      const ref = readRefFromLocation();
      if (!ref) {
        window.location.href = "index.html";
        return;
      }
      retry.disabled = true;
      requestNewPaymentCheckout(ref)
        .then((paymentUrl) => {
          window.location.replace(paymentUrl);
        })
        .catch(() => {
          window.location.href = "index.html";
        })
        .finally(() => {
          retry.disabled = false;
        });
    });
  }

  function boot() {
    applyWhatsAppLink();
    bindRetry();
    if (document.body.classList.contains("page-payment-return")) {
      runReturnRouter();
    }
  }

  window.SacramentoPaymentPages = { getI18nText, runReturnRouter, bindRetry, applyWhatsAppLink };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();

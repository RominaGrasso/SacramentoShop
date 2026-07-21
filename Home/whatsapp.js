/**
 * WhatsApp deep links (wa.me). Mobile: same-tab navigation to open the app.
 * Desktop: optional blank tab from user gesture before async payment resolve.
 */
(function () {
  if (typeof window.sacramentoRunReserveWhatsAppFlow !== "function") {
    const SACRAMENTO_RESERVE_LOADING_SECONDARY_MS = 5000;
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
    let sacramentoReserveLoadingOverlayEl = null;

    function sacramentoReserveLoadingText(key, fallback) {
      const lang = typeof getSiteLanguage === "function" ? getSiteLanguage() : "en";
      const table =
        typeof sacramentoI18nTable === "function" ? sacramentoI18nTable() : { en: {} };
      const dict = table[lang] || table.en || {};
      return dict[key] || table.en?.[key] || fallback;
    }

    function sacramentoEnsureReserveLoadingOverlay() {
      if (sacramentoReserveLoadingOverlayEl) return sacramentoReserveLoadingOverlayEl;
      const overlay = document.createElement("div");
      overlay.id = "sacramentoReserveLoading";
      overlay.className = "sacramento-reserve-loading";
      overlay.setAttribute("role", "dialog");
      overlay.setAttribute("aria-modal", "true");
      overlay.setAttribute("aria-live", "polite");
      overlay.setAttribute("aria-busy", "true");
      overlay.hidden = true;
      overlay.innerHTML =
        '<div class="sacramento-reserve-loading__panel">' +
        '<div class="sacramento-reserve-loading__spinner" aria-hidden="true"></div>' +
        '<p class="sacramento-reserve-loading__primary"></p>' +
        '<p class="sacramento-reserve-loading__secondary" hidden></p>' +
        "</div>";
      document.body.appendChild(overlay);
      sacramentoReserveLoadingOverlayEl = overlay;
      return overlay;
    }

    function sacramentoRefreshReserveLoadingCopy() {
      const overlay = sacramentoEnsureReserveLoadingOverlay();
      const primary = overlay.querySelector(".sacramento-reserve-loading__primary");
      const secondary = overlay.querySelector(".sacramento-reserve-loading__secondary");
      if (primary) {
        primary.textContent = sacramentoReserveLoadingText(
          "reserve_loading_primary",
          "Preparing your booking…"
        );
      }
      if (secondary) {
        secondary.textContent = sacramentoReserveLoadingText(
          "reserve_loading_secondary",
          "Opening WhatsApp…"
        );
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
      sacramentoRefreshReserveLoadingCopy();
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
      }
    }

    window.sacramentoShowReserveLoading = sacramentoShowReserveLoading;
    window.sacramentoHideReserveLoading = sacramentoHideReserveLoading;
    window.sacramentoRunReserveWhatsAppFlow = sacramentoRunReserveWhatsAppFlow;

    if (typeof document !== "undefined") {
      document.addEventListener("sacramento:setLanguage", () => {
        if (sacramentoReserveLoadingDepth > 0) sacramentoRefreshReserveLoadingCopy();
      });
    }
  }

  if (typeof window.sacramentoOpenWhatsApp === "function") return;

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

  function sacramentoPaintPendingTabLoading(pendingTab) {
    if (!pendingTab || pendingTab.closed) return;
    try {
      const primary =
        typeof window.sacramentoShowReserveLoading === "function"
          ? (() => {
              const lang = typeof getSiteLanguage === "function" ? getSiteLanguage() : "en";
              const table =
                typeof sacramentoI18nTable === "function" ? sacramentoI18nTable() : { en: {} };
              const dict = table[lang] || table.en || {};
              return (
                dict.reserve_loading_primary ||
                table.en?.reserve_loading_primary ||
                "Preparing your booking…"
              );
            })()
          : "Preparing your booking…";
      const secondary = (() => {
        const lang = typeof getSiteLanguage === "function" ? getSiteLanguage() : "en";
        const table = typeof sacramentoI18nTable === "function" ? sacramentoI18nTable() : { en: {} };
        const dict = table[lang] || table.en || {};
        return dict.reserve_loading_secondary || table.en?.reserve_loading_secondary || "Opening WhatsApp…";
      })();
      const safePrimary = String(primary).replace(/</g, "&lt;");
      const safeSecondary = String(secondary).replace(/</g, "&lt;");
      pendingTab.document.open();
      pendingTab.document.write(
        "<!DOCTYPE html><html lang=\"en\"><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><title>" +
          safePrimary +
          "</title><style>*{box-sizing:border-box}body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;background:linear-gradient(160deg,#f0f6fc 0%,#e8f2fa 100%);color:#1e3a5f}.wrap{text-align:center;padding:24px;max-width:320px}.spin{width:44px;height:44px;margin:0 auto 20px;border:3px solid rgba(102,166,230,.25);border-top-color:#66a6e6;border-radius:50%;animation:sacspin .85s linear infinite}@keyframes sacspin{to{transform:rotate(360deg)}}h1{font-size:1.05rem;font-weight:600;margin:0 0 8px;line-height:1.35}p{font-size:.9rem;margin:0;color:#4a6a8a}</style></head><body><div class=\"wrap\"><div class=\"spin\" aria-hidden=\"true\"></div><h1>" +
          safePrimary +
          "</h1><p>" +
          safeSecondary +
          "</p></div></body></html>"
      );
      pendingTab.document.close();
    } catch {
      /* ignore */
    }
  }

  function sacramentoOpenWhatsAppBlankTabForGesture() {
    if (sacramentoIsMobileWhatsAppClient()) return null;
    try {
      const tab = window.open("about:blank", "_blank");
      sacramentoPaintPendingTabLoading(tab);
      return tab;
    } catch {
      return null;
    }
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

  function sacramentoOpenWhatsApp(phone, text, pendingTab) {
    const waUrl = sacramentoBuildWhatsAppUrl(phone, text);
    if (!waUrl || !sacramentoIsOfficialWhatsAppUrl(waUrl)) return;

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

  function sacramentoFixWhatsAppAnchorTargets(root) {
    const scope = root && root.querySelectorAll ? root : document;
    if (!scope.querySelectorAll) return;
    scope.querySelectorAll('a[href*="wa.me"], a[href*="api.whatsapp.com"]').forEach((anchor) => {
      const href = anchor.getAttribute("href") || "";
      if (!sacramentoIsOfficialWhatsAppUrl(href)) return;
      if (anchor.classList.contains("home-site-footer__wa-link")) return;
      if (anchor.getAttribute("target") === "_blank") anchor.removeAttribute("target");
    });
  }

  function sacramentoInitTaxiFloatLinks(root) {
    const scope = root && root.querySelectorAll ? root : document;
    if (!scope.querySelectorAll) return;
    const href = sacramentoBuildWhatsAppUrl(
      SACRAMENTO_TAXI_WHATSAPP_NUMBER,
      SACRAMENTO_TAXI_WHATSAPP_DEFAULT_TEXT
    );
    if (!href) return;
    scope.querySelectorAll("a.taxi-float").forEach((anchor) => {
      anchor.setAttribute("href", href);
      if (anchor.getAttribute("target") === "_blank") anchor.removeAttribute("target");
    });
  }

  function sacramentoGetLangForWaFloat() {
    const active = window.__SACRAMENTO_ACTIVE_LANG__;
    if (active === "en" || active === "es" || active === "pt") return active;
    if (typeof window.getSiteLanguage === "function") return window.getSiteLanguage();
    if (typeof window.getInitialLanguage === "function") return window.getInitialLanguage();
    return "en";
  }

  function sacramentoInitWhatsAppFloatLinks(root) {
    const scope = root && root.querySelectorAll ? root : document;
    if (!scope.querySelectorAll) return;
    const lang = sacramentoGetLangForWaFloat();
    const tr = window.__SACRAMENTO_TRANSLATIONS?.[lang] || window.__SACRAMENTO_TRANSLATIONS?.en || {};
    const text = tr.wa_float_text || "Hello! I'm interested in your experiences in Colonia.";
    const href = sacramentoBuildWhatsAppUrl(SACRAMENTO_DEFAULT_WHATSAPP_NUMBER, text);
    if (!href) return;
    scope.querySelectorAll("a.whatsapp-float").forEach((anchor) => {
      anchor.setAttribute("href", href);
      if (anchor.getAttribute("target") === "_blank") anchor.removeAttribute("target");
    });
    scope.querySelectorAll("a.home-site-footer__wa-link").forEach((anchor) => {
      anchor.setAttribute("href", href);
      anchor.setAttribute("target", "_blank");
      anchor.setAttribute("rel", "noopener noreferrer");
    });
  }

  window.SACRAMENTO_TAXI_WHATSAPP_NUMBER = SACRAMENTO_TAXI_WHATSAPP_NUMBER;
  window.sacramentoBuildWhatsAppUrl = sacramentoBuildWhatsAppUrl;
  window.sacramentoOpenWhatsApp = sacramentoOpenWhatsApp;
  window.sacramentoOpenWhatsAppBlankTabForGesture = sacramentoOpenWhatsAppBlankTabForGesture;
  window.sacramentoNavigatePendingTabToWhatsApp = sacramentoNavigatePendingTabToWhatsApp;
  window.sacramentoFixWhatsAppAnchorTargets = sacramentoFixWhatsAppAnchorTargets;
  window.sacramentoInitTaxiFloatLinks = sacramentoInitTaxiFloatLinks;
  window.sacramentoInitWhatsAppFloatLinks = sacramentoInitWhatsAppFloatLinks;

  if (typeof document !== "undefined") {
    const run = () => {
      sacramentoInitTaxiFloatLinks(document);
      sacramentoInitWhatsAppFloatLinks(document);
      sacramentoFixWhatsAppAnchorTargets(document);
      if (typeof window.sacramentoEnhanceWhatsAppFloatButtons === "function") {
        window.sacramentoEnhanceWhatsAppFloatButtons(document);
      }
    };
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", run);
    } else {
      run();
    }
    document.addEventListener("sacramento:setLanguage", () => {
      sacramentoInitWhatsAppFloatLinks(document);
      if (typeof window.sacramentoEnhanceWhatsAppFloatButtons === "function") {
        window.sacramentoEnhanceWhatsAppFloatButtons(document);
      }
    });
  }
})();

/**
 * WhatsApp deep links (wa.me). Mobile: same-tab navigation to open the app.
 * Desktop: optional blank tab from user gesture before async payment resolve.
 */
(function () {
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
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent || "");
  }

  function sacramentoOpenWhatsAppBlankTabForGesture() {
    if (sacramentoIsMobileWhatsAppClient()) return null;
    try {
      return window.open("about:blank", "_blank");
    } catch {
      return null;
    }
  }

  function sacramentoNavigatePendingTabToWhatsApp(pendingTab, waUrl) {
    const url = String(waUrl || "");
    if (!url || !sacramentoIsOfficialWhatsAppUrl(url)) return;

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

    window.location.assign(url);
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
      window.location.assign(waUrl);
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

  window.SACRAMENTO_TAXI_WHATSAPP_NUMBER = SACRAMENTO_TAXI_WHATSAPP_NUMBER;
  window.sacramentoBuildWhatsAppUrl = sacramentoBuildWhatsAppUrl;
  window.sacramentoOpenWhatsApp = sacramentoOpenWhatsApp;
  window.sacramentoOpenWhatsAppBlankTabForGesture = sacramentoOpenWhatsAppBlankTabForGesture;
  window.sacramentoNavigatePendingTabToWhatsApp = sacramentoNavigatePendingTabToWhatsApp;
  window.sacramentoFixWhatsAppAnchorTargets = sacramentoFixWhatsAppAnchorTargets;
  window.sacramentoInitTaxiFloatLinks = sacramentoInitTaxiFloatLinks;

  if (typeof document !== "undefined") {
    const run = () => {
      sacramentoInitTaxiFloatLinks(document);
      sacramentoFixWhatsAppAnchorTargets(document);
    };
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", run);
    } else {
      run();
    }
  }
})();

(function () {
  "use strict";

  var STORAGE_KEY = "sacramentoCookieConsent";
  var DELAY_MS = 8000;
  var SCROLL_THRESHOLD = 0.25;

  var FALLBACK = {
    en: {
      cookie_consent_title: "Cookies",
      cookie_consent_text: "We use cookies to improve your browsing experience.",
      cookie_consent_accept: "Accept",
      cookie_consent_reject: "Reject",
      cookie_consent_aria_label: "Cookie notice",
    },
    es: {
      cookie_consent_title: "Cookies",
      cookie_consent_text: "Utilizamos cookies para mejorar tu experiencia de navegación.",
      cookie_consent_accept: "Aceptar",
      cookie_consent_reject: "Rechazar",
      cookie_consent_aria_label: "Aviso de cookies",
    },
    pt: {
      cookie_consent_title: "Cookies",
      cookie_consent_text: "Utilizamos cookies para melhorar sua experiência de navegação.",
      cookie_consent_accept: "Aceitar",
      cookie_consent_reject: "Recusar",
      cookie_consent_aria_label: "Aviso de cookies",
    },
  };

  var bannerEl = null;
  var triggersActive = false;
  var revealScheduled = false;
  var forceReveal = false;
  var scrollHandler = null;
  var delayTimer = null;

  function getLang() {
    if (typeof window.getInitialLanguage === "function") {
      return window.getInitialLanguage();
    }
    try {
      var stored = localStorage.getItem("selectedLanguage");
      if (stored === "es" || stored === "pt") return stored;
    } catch (_) {
      /* ignore */
    }
    return "en";
  }

  function getDict(lang) {
    var translations = window.__SACRAMENTO_TRANSLATIONS || {};
    return translations[lang] || translations.en || FALLBACK[lang] || FALLBACK.en;
  }

  function getPreference() {
    try {
      var value = localStorage.getItem(STORAGE_KEY);
      if (value === "accepted" || value === "rejected") return value;
    } catch (_) {
      /* ignore */
    }
    return null;
  }

  function applyTrackingConsent(preference) {
    if (typeof window.gtag !== "function") return;
    if (preference === "accepted") {
      window.gtag("consent", "update", {
        analytics_storage: "granted",
        ad_storage: "granted",
      });
    } else if (preference === "rejected") {
      window.gtag("consent", "update", {
        analytics_storage: "denied",
        ad_storage: "denied",
      });
    }
  }

  function savePreference(preference) {
    try {
      localStorage.setItem(STORAGE_KEY, preference);
    } catch (_) {
      /* ignore */
    }
    applyTrackingConsent(preference);
    forceReveal = false;
    hideBanner();
    stopTriggers();
  }

  function translateBanner() {
    if (!bannerEl) return;
    var lang = getLang();
    var dict = getDict(lang);
    bannerEl.querySelectorAll("[data-translate]").forEach(function (el) {
      var key = el.getAttribute("data-translate");
      if (dict && Object.prototype.hasOwnProperty.call(dict, key)) {
        el.textContent = dict[key];
      }
    });
    if (dict.cookie_consent_aria_label) {
      bannerEl.setAttribute("aria-label", dict.cookie_consent_aria_label);
    }
  }

  function buildBanner() {
    if (bannerEl) return bannerEl;

    bannerEl = document.createElement("aside");
    bannerEl.id = "cookie-consent";
    bannerEl.className = "cookie-consent";
    bannerEl.setAttribute("role", "region");
    bannerEl.setAttribute("aria-live", "polite");
    bannerEl.hidden = true;
    bannerEl.innerHTML =
      '<div class="cookie-consent__inner">' +
      '<div class="cookie-consent__content">' +
      '<p class="cookie-consent__title" data-translate="cookie_consent_title">Cookies</p>' +
      '<p class="cookie-consent__text" data-translate="cookie_consent_text">We use cookies to improve your browsing experience.</p>' +
      "</div>" +
      '<div class="cookie-consent__actions">' +
      '<button type="button" class="cookie-consent__btn cookie-consent__btn--accept" data-translate="cookie_consent_accept">Accept</button>' +
      '<button type="button" class="cookie-consent__btn cookie-consent__btn--reject" data-translate="cookie_consent_reject">Reject</button>' +
      "</div>" +
      "</div>";

    bannerEl.querySelector(".cookie-consent__btn--accept").addEventListener("click", function () {
      savePreference("accepted");
    });
    bannerEl.querySelector(".cookie-consent__btn--reject").addEventListener("click", function () {
      savePreference("rejected");
    });

    document.body.appendChild(bannerEl);
    translateBanner();
    return bannerEl;
  }

  function showBanner() {
    buildBanner();
    if (!bannerEl) return;
    bannerEl.hidden = false;
    requestAnimationFrame(function () {
      bannerEl.classList.add("cookie-consent--visible");
    });
  }

  function hideBanner() {
    if (!bannerEl) return;
    bannerEl.classList.remove("cookie-consent--visible");
    window.setTimeout(function () {
      if (bannerEl && !bannerEl.classList.contains("cookie-consent--visible")) {
        bannerEl.hidden = true;
      }
    }, 320);
  }

  function stopTriggers() {
    if (delayTimer) {
      window.clearTimeout(delayTimer);
      delayTimer = null;
    }
    if (scrollHandler) {
      window.removeEventListener("scroll", scrollHandler);
      scrollHandler = null;
    }
    triggersActive = false;
    revealScheduled = false;
  }

  function shouldAutoShow() {
    if (forceReveal) return true;
    return !getPreference();
  }

  function tryReveal() {
    if (revealScheduled || !shouldAutoShow()) return;
    revealScheduled = true;
    showBanner();
    stopTriggers();
  }

  function onScrollCheck() {
    var doc = document.documentElement;
    var scrollHeight = Math.max(0, doc.scrollHeight - window.innerHeight);
    if (scrollHeight <= 0) return;
    if (window.scrollY / scrollHeight >= SCROLL_THRESHOLD) {
      tryReveal();
    }
  }

  function startTriggers() {
    if (triggersActive || !shouldAutoShow()) return;
    triggersActive = true;
    delayTimer = window.setTimeout(tryReveal, DELAY_MS);
    scrollHandler = onScrollCheck;
    window.addEventListener("scroll", scrollHandler, { passive: true });
    onScrollCheck();
  }

  function openCookiePreferences() {
    forceReveal = true;
    revealScheduled = false;
    showBanner();
  }

  function bindFooterPreferencesLink() {
    document.querySelectorAll(".home-site-footer__cookie-prefs-link").forEach(function (btn) {
      if (btn.dataset.cookiePrefsBound === "1") return;
      btn.dataset.cookiePrefsBound = "1";
      btn.addEventListener("click", function (e) {
        e.preventDefault();
        openCookiePreferences();
      });
    });
  }

  function initCookieConsent() {
    if (document.body.dataset.sacramentoCookieConsentInit === "1") return;
    document.body.dataset.sacramentoCookieConsentInit = "1";

    var existing = getPreference();
    if (existing) {
      applyTrackingConsent(existing);
    } else {
      startTriggers();
    }

    bindFooterPreferencesLink();
  }

  window.sacramentoOpenCookiePreferences = openCookiePreferences;
  window.sacramentoGetCookiePreference = getPreference;

  document.addEventListener("sacramento:footerMounted", bindFooterPreferencesLink);
  document.addEventListener("sacramento:setLanguage", translateBanner);

  if (document.body) {
    initCookieConsent();
  } else {
    document.addEventListener("DOMContentLoaded", initCookieConsent, { once: true });
  }
})();

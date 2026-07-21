/**
 * Compact floating WhatsApp button: unified pill + overlapping icon.
 * Enhances existing a.whatsapp-float anchors without changing wa.me behavior.
 */
(function () {
  "use strict";

  function getLang() {
    const active = window.__SACRAMENTO_ACTIVE_LANG__;
    if (active === "en" || active === "es" || active === "pt") return active;
    if (typeof window.getSiteLanguage === "function") return window.getSiteLanguage();
    if (typeof window.getInitialLanguage === "function") return window.getInitialLanguage();
    return "en";
  }

  function getCtaText() {
    if (typeof window.sacramentoGetI18nText === "function") {
      return window.sacramentoGetI18nText("wa_float_cta", "¡Contáctanos!");
    }
    const lang = getLang();
    const tr = window.__SACRAMENTO_TRANSLATIONS?.[lang] || window.__SACRAMENTO_TRANSLATIONS?.en || {};
    return tr.wa_float_cta || "¡Contáctanos!";
  }

  function getAriaLabel() {
    if (typeof window.sacramentoGetI18nText === "function") {
      const cta = window.sacramentoGetI18nText("wa_float_cta", "¡Contáctanos!");
      const wa = window.sacramentoGetI18nText("wa_float_aria", "WhatsApp");
      return `${cta} — ${wa}`;
    }
    const lang = getLang();
    const tr = window.__SACRAMENTO_TRANSLATIONS?.[lang] || window.__SACRAMENTO_TRANSLATIONS?.en || {};
    const cta = tr.wa_float_cta || "¡Contáctanos!";
    const wa = tr.wa_float_aria || "WhatsApp";
    return `${cta} — ${wa}`;
  }

  function refreshLabel(anchor) {
    const label = anchor.querySelector(".whatsapp-float__label");
    if (label) label.textContent = getCtaText();
    anchor.setAttribute("aria-label", getAriaLabel());
  }

  function enhanceAnchor(anchor) {
    if (!anchor || anchor.dataset.waUiEnhanced === "1") return;
    anchor.dataset.waUiEnhanced = "1";
    anchor.classList.add("whatsapp-float--enhanced");

    const svg = anchor.querySelector("svg");
    const pill = document.createElement("span");
    pill.className = "whatsapp-float__pill";
    pill.setAttribute("aria-hidden", "true");

    const label = document.createElement("span");
    label.className = "whatsapp-float__label";
    label.setAttribute("data-translate", "wa_float_cta");
    label.textContent = getCtaText();
    pill.appendChild(label);

    const icon = document.createElement("span");
    icon.className = "whatsapp-float__icon";
    icon.setAttribute("aria-hidden", "true");
    if (svg) icon.appendChild(svg);

    anchor.textContent = "";
    anchor.appendChild(pill);
    anchor.appendChild(icon);

    anchor.setAttribute("aria-label", getAriaLabel());

    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        anchor.classList.add("whatsapp-float--ready");
      });
    });
  }

  function sacramentoEnhanceWhatsAppFloatButtons(root) {
    const scope = root && root.querySelectorAll ? root : document;
    if (!scope.querySelectorAll) return;
    scope.querySelectorAll("a.whatsapp-float").forEach((anchor) => {
      if (anchor.dataset.waUiEnhanced !== "1") {
        enhanceAnchor(anchor);
      } else {
        refreshLabel(anchor);
      }
    });
  }

  window.sacramentoEnhanceWhatsAppFloatButtons = sacramentoEnhanceWhatsAppFloatButtons;

  function boot() {
    sacramentoEnhanceWhatsAppFloatButtons(document);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }

  document.addEventListener("sacramento:setLanguage", () => {
    sacramentoEnhanceWhatsAppFloatButtons(document);
  });
})();

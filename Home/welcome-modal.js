/**
 * One-time welcome message after the first language selection.
 * Requires language-init.js; loaded by language-prompt.js.
 */
(function () {
  "use strict";

  const WELCOME_KEY = "sacramentoWelcomeSeen";
  const VALID = new Set(["en", "es", "pt"]);

  const COPY = {
    es: {
      title: "💙 Tu reserva genera impacto local",
      item1: "🌎 Apoya a guías locales",
      item2: "🤝 Apoya a emprendedores locales",
      item3: "🐾 Ayuda a financiar iniciativas de bienestar animal",
      cta: "Explorar experiencias",
    },
    en: {
      title: "💙 Your booking creates local impact",
      item1: "🌎 Supports local guides",
      item2: "🤝 Supports local entrepreneurs",
      item3: "🐾 Helps fund animal welfare initiatives",
      cta: "Explore experiences",
    },
    pt: {
      title: "💙 Sua reserva gera impacto local",
      item1: "🌎 Apoia guias locais",
      item2: "🤝 Apoia empreendedores locais",
      item3: "🐾 Ajuda a financiar iniciativas de bem-estar animal",
      cta: "Explorar experiências",
    },
  };

  function welcomeSeen() {
    try {
      return localStorage.getItem(WELCOME_KEY) === "1";
    } catch (_) {
      return false;
    }
  }

  function markWelcomeSeen() {
    try {
      localStorage.setItem(WELCOME_KEY, "1");
    } catch (_) {
      /* ignore */
    }
  }

  function copyFor(lang) {
    const safe = VALID.has(lang) ? lang : "en";
    return COPY[safe] || COPY.en;
  }

  function closeWelcome(overlay) {
    markWelcomeSeen();
    overlay.classList.remove("active");
    overlay.setAttribute("aria-hidden", "true");
    document.body.classList.remove("sacramento-welcome-modal-open");
    window.setTimeout(() => overlay.remove(), 280);
  }

  function mountWelcome(lang) {
    if (welcomeSeen() || document.getElementById("sacramentoWelcomeModal")) return;

    const c = copyFor(lang);
    const overlay = document.createElement("div");
    overlay.id = "sacramentoWelcomeModal";
    overlay.className = "sacramento-welcome-modal active";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.setAttribute("aria-labelledby", "sacramentoWelcomeModalTitle");
    overlay.setAttribute("aria-hidden", "false");

    overlay.innerHTML = `
      <div class="sacramento-welcome-modal__box">
        <p class="sacramento-welcome-modal__brand">Sacramento Adventures</p>
        <h2 id="sacramentoWelcomeModalTitle">${c.title}</h2>
        <ul class="sacramento-welcome-modal__list">
          <li>${c.item1}</li>
          <li>${c.item2}</li>
          <li>${c.item3}</li>
        </ul>
        <button type="button" class="sacramento-welcome-modal__cta" data-welcome-dismiss>
          ${c.cta}
        </button>
      </div>
    `;

    overlay.querySelector("[data-welcome-dismiss]").addEventListener("click", () => {
      closeWelcome(overlay);
    });

    document.body.appendChild(overlay);
    document.body.classList.add("sacramento-welcome-modal-open");
    overlay.querySelector(".sacramento-welcome-modal__cta").focus();
  }

  function maybeShowWelcome(lang, delay) {
    if (welcomeSeen()) return;
    const safe = VALID.has(lang) ? lang : "en";
    const wait = typeof delay === "number" ? delay : 320;
    window.setTimeout(() => mountWelcome(safe), wait);
  }

  window.sacramentoMaybeShowWelcome = maybeShowWelcome;

  if (window.__SACRAMENTO_PENDING_WELCOME_LANG__) {
    maybeShowWelcome(window.__SACRAMENTO_PENDING_WELCOME_LANG__);
    delete window.__SACRAMENTO_PENDING_WELCOME_LANG__;
  }

  function initPendingWelcome() {
    if (welcomeSeen()) return;
    if (typeof window.hasUserChosenLanguage === "function" && !window.hasUserChosenLanguage()) {
      return;
    }
    const stored =
      typeof window.getStoredLanguage === "function"
        ? window.getStoredLanguage()
        : (() => {
            try {
              return localStorage.getItem("selectedLanguage");
            } catch (_) {
              return null;
            }
          })();
    if (VALID.has(stored)) {
      maybeShowWelcome(stored, 0);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initPendingWelcome, { once: true });
  } else {
    initPendingWelcome();
  }
})();

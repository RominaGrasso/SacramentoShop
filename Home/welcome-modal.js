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
      title: "Bienvenido a Sacramento Adventures",
      item1:
        "🌎 Experiencias auténticas creadas junto a emprendedores y guías locales.",
      item2:
        "🐾 Gracias a nuestros viajeros, ya pudimos donar 50 capas para perros callejeros de Colonia y seguimos trabajando en nuevos proyectos de bienestar animal.",
      item3:
        "🏢 ¿Organizás una actividad para tu empresa? También ofrecemos experiencias corporativas y team buildings.",
      cta: "Explorar experiencias",
    },
    en: {
      title: "Welcome to Sacramento Adventures",
      item1:
        "🌎 Authentic experiences created together with local guides and entrepreneurs.",
      item2:
        "🐾 Thanks to our travelers, we have already donated 50 coats for stray dogs in Colonia and continue working on new animal welfare projects.",
      item3:
        "🏢 Planning an activity for your company? We also offer corporate experiences and team-building activities.",
      cta: "Explore experiences",
    },
    pt: {
      title: "Bem-vindo à Sacramento Adventures",
      item1:
        "🌎 Experiências autênticas criadas junto com guias e empreendedores locais.",
      item2:
        "🐾 Graças aos nossos viajantes, já doamos 50 capas para cães de rua em Colonia e continuamos trabalhando em novos projetos de bem-estar animal.",
      item3:
        "🏢 Está organizando uma atividade para sua empresa? Também oferecemos experiências corporativas e atividades de team building.",
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

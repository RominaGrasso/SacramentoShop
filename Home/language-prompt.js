/**
 * First-visit language picker. Requires language-init.js first.
 */
(function () {
  "use strict";

  const VALID = new Set(["en", "es", "pt"]);

  const PROMPT_COPY = {
    en: {
      title: "Choose your language",
      subtitle: "Select how you want to browse Sacramento Adventures.",
      en: "English",
      es: "Spanish",
      pt: "Portuguese"
    },
    es: {
      title: "Elegí tu idioma",
      subtitle: "Seleccioná cómo querés ver Sacramento Adventures.",
      en: "Inglés",
      es: "Español",
      pt: "Portugués"
    },
    pt: {
      title: "Escolha seu idioma",
      subtitle: "Selecione como deseja ver o Sacramento Adventures.",
      en: "Inglês",
      es: "Espanhol",
      pt: "Português"
    }
  };

  function detectUiLanguage() {
    if (typeof window.detectLanguageFromNavigator === "function") {
      return window.detectLanguageFromNavigator();
    }
    return "en";
  }

  function hasChosen() {
    if (typeof window.hasUserChosenLanguage === "function") {
      return window.hasUserChosenLanguage();
    }
    try {
      const stored = localStorage.getItem("selectedLanguage");
      return VALID.has(stored);
    } catch (_) {
      return false;
    }
  }

  function copyForUi() {
    const ui = detectUiLanguage();
    return PROMPT_COPY[ui] || PROMPT_COPY.en;
  }

  function chooseLanguage(lang) {
    const safe = VALID.has(lang) ? lang : "en";
    try {
      localStorage.setItem("selectedLanguage", safe);
    } catch (_) {
      /* ignore */
    }

    document.documentElement.lang = safe;
    document.documentElement.classList.remove("sacramento-awaiting-lang");
    document.documentElement.classList.add("sacramento-lang-ready");

    const overlay = document.getElementById("sacramentoLanguagePrompt");
    if (overlay) {
      overlay.classList.remove("active");
      overlay.setAttribute("aria-hidden", "true");
      window.setTimeout(() => overlay.remove(), 280);
    }

    document.body.classList.remove("sacramento-language-prompt-open");

    if (typeof window.sacramentoSetLanguage === "function") {
      window.sacramentoSetLanguage(safe);
    } else {
      window.__SACRAMENTO_PENDING_LANG__ = safe;
    }

    document.dispatchEvent(
      new CustomEvent("sacramento:languageChosen", { detail: { language: safe } })
    );
  }

  function mountPrompt() {
    if (hasChosen() || document.getElementById("sacramentoLanguagePrompt")) return;

    const c = copyForUi();
    const overlay = document.createElement("div");
    overlay.id = "sacramentoLanguagePrompt";
    overlay.className = "sacramento-language-prompt active";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.setAttribute("aria-labelledby", "sacramentoLanguagePromptTitle");
    overlay.setAttribute("aria-hidden", "false");

    overlay.innerHTML = `
      <div class="sacramento-language-prompt__box">
        <p class="sacramento-language-prompt__brand">Sacramento Adventures</p>
        <h2 id="sacramentoLanguagePromptTitle">${c.title}</h2>
        <p class="sacramento-language-prompt__subtitle">${c.subtitle}</p>
        <div class="sacramento-language-prompt__options">
          <button type="button" class="sacramento-language-prompt__option" data-lang="en">
            <svg aria-hidden="true" class="lang-flag-icon" focusable="false" height="13" width="18"><use href="/Assets/icons/nav-header.svg#flag-us"></use></svg>
            <span>${c.en}</span>
          </button>
          <button type="button" class="sacramento-language-prompt__option" data-lang="es">
            <svg aria-hidden="true" class="lang-flag-icon" focusable="false" height="13" width="18"><use href="/Assets/icons/nav-header.svg#flag-uy"></use></svg>
            <span>${c.es}</span>
          </button>
          <button type="button" class="sacramento-language-prompt__option" data-lang="pt">
            <svg aria-hidden="true" class="lang-flag-icon" focusable="false" height="13" width="18"><use href="/Assets/icons/nav-header.svg#flag-br"></use></svg>
            <span>${c.pt}</span>
          </button>
        </div>
      </div>
    `;

    overlay.querySelectorAll("[data-lang]").forEach((btn) => {
      btn.addEventListener("click", () => chooseLanguage(btn.getAttribute("data-lang")));
    });

    document.body.appendChild(overlay);
    document.body.classList.add("sacramento-language-prompt-open");
  }

  function applyStoredLanguage() {
    if (!hasChosen()) return;
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
    if (!VALID.has(stored)) return;

    document.documentElement.lang = stored;
    if (typeof window.sacramentoSetLanguage === "function") {
      window.sacramentoSetLanguage(stored);
    } else {
      window.__SACRAMENTO_PENDING_LANG__ = stored;
    }
  }

  function init() {
    if (hasChosen()) {
      document.documentElement.classList.add("sacramento-lang-ready");
      if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", applyStoredLanguage, { once: true });
      } else {
        applyStoredLanguage();
      }
      return;
    }

    document.documentElement.classList.add("sacramento-awaiting-lang");

    if (document.body) {
      mountPrompt();
    } else {
      document.addEventListener("DOMContentLoaded", mountPrompt, { once: true });
    }
  }

  init();
})();

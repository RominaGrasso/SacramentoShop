/**
 * Site-wide language bootstrap: persisted preference after explicit choice (popup or header).
 * Load before language-prompt.js and index.js on pages that use translations.
 */
(function (global) {
  "use strict";

  const STORAGE_KEY = "selectedLanguage";
  const VALID = new Set(["en", "es", "pt"]);

  function detectLanguageFromNavigator() {
    if (typeof navigator === "undefined") return "en";

    const tags = [];
    if (Array.isArray(navigator.languages)) tags.push(...navigator.languages);
    if (navigator.language) tags.push(navigator.language);

    for (const tag of tags) {
      const lower = String(tag || "").trim().toLowerCase();
      if (!lower) continue;
      if (lower.startsWith("es")) return "es";
      if (lower.startsWith("pt")) return "pt";
    }
    return "en";
  }

  function getStoredLanguage() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored && VALID.has(stored)) return stored;
    } catch (_) {
      /* ignore */
    }
    return null;
  }

  function hasUserChosenLanguage() {
    return getStoredLanguage() !== null;
  }

  function getInitialLanguage() {
    const stored = getStoredLanguage();
    if (stored) return stored;
    return detectLanguageFromNavigator();
  }

  global.detectLanguageFromNavigator = detectLanguageFromNavigator;
  global.getStoredLanguage = getStoredLanguage;
  global.hasUserChosenLanguage = hasUserChosenLanguage;
  global.sacramentoHasUserChosenLanguage = hasUserChosenLanguage;
  global.getInitialLanguage = getInitialLanguage;
  global.sacramentoGetInitialLanguage = getInitialLanguage;

  if (typeof document !== "undefined" && !hasUserChosenLanguage()) {
    document.documentElement.classList.add("sacramento-awaiting-lang");
  }
})(typeof window !== "undefined" ? window : globalThis);

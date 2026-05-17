/**
 * Site-wide language bootstrap: persisted preference or first-visit browser detection.
 * Load before index.js / orders.js on any page that uses translations.
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

  function getInitialLanguage() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored && VALID.has(stored)) return stored;
    } catch (_) {
      /* ignore */
    }

    const detected = detectLanguageFromNavigator();
    try {
      localStorage.setItem(STORAGE_KEY, detected);
    } catch (_) {
      /* ignore */
    }
    return detected;
  }

  global.getInitialLanguage = getInitialLanguage;
  global.sacramentoGetInitialLanguage = getInitialLanguage;
})(typeof window !== "undefined" ? window : globalThis);

/**
 * Packages page (/paquetes): header menu, WhatsApp CTAs, footer stubs, document title.
 */
(function () {
  if (!document.body.classList.contains("page-paquetes")) return;

  const WHATSAPP_NUMBER = "59898945542";

  const PACKAGE_NAME_KEYS = {
    essential: "pkg_essential_name",
    adventure: "pkg_adventure_name",
    flavors: "pkg_flavors_name",
    complete: "pkg_complete_name",
    romantic: "pkg_romantic_name",
    custom: "pkg_custom_name",
  };

  function getActiveLanguage() {
    if (typeof window.getSiteLanguage === "function") return window.getSiteLanguage();
    if (window.__SACRAMENTO_ACTIVE_LANG__) return window.__SACRAMENTO_ACTIVE_LANG__;
    if (typeof window.getInitialLanguage === "function") return window.getInitialLanguage();
    return "es";
  }

  function translateKey(key) {
    const lang = getActiveLanguage();
    const table = window.__SACRAMENTO_TRANSLATIONS || {};
    return table[lang]?.[key] || table.en?.[key] || table.es?.[key] || "";
  }

  function buildPackageWhatsAppMessage(packageId) {
    const prefix = translateKey("packages_wa_prefix");
    const nameKey = PACKAGE_NAME_KEYS[packageId];
    const name = nameKey ? translateKey(nameKey) : "";
    return name ? `${prefix} ${name}` : prefix;
  }

  function buildPackagePriceWhatsAppMessage(packageId) {
    const prefix = translateKey("packages_wa_price_prefix");
    const nameKey = PACKAGE_NAME_KEYS[packageId];
    const name = nameKey ? translateKey(nameKey) : "";
    return name ? `${prefix} ${name}` : prefix;
  }

  function openPackageWhatsApp(packageId, messageBuilder) {
    const buildMessage = messageBuilder || buildPackageWhatsAppMessage;
    const message = buildMessage(packageId);
    if (typeof window.sacramentoOpenWhatsApp === "function") {
      window.sacramentoOpenWhatsApp(WHATSAPP_NUMBER, message);
      return;
    }
    const url = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  }

  function syncDocumentTitle() {
    const titleEl = document.querySelector("title[data-translate='packages_page_title']");
    if (titleEl && titleEl.textContent) {
      document.title = titleEl.textContent;
    }
  }

  function initHamburgerMenu() {
    const toggle = document.querySelector(".menu-toggle");
    const menu = document.querySelector(".hamburger-menu");
    if (!toggle || !menu) return;

    toggle.addEventListener("click", (event) => {
      event.stopPropagation();
      menu.style.display = menu.style.display === "block" ? "none" : "block";
    });

    document.addEventListener("click", (event) => {
      if (!menu.contains(event.target) && !toggle.contains(event.target)) {
        menu.style.display = "none";
      }
    });
  }

  function initNavFilters() {
    document.querySelectorAll(".hamburger-menu li[data-filter]").forEach((item) => {
      item.addEventListener("click", () => {
        window.location.href = "../Home/index.html#experiences";
      });
    });
  }

  function initPackageWhatsAppLinks() {
    document.querySelectorAll(".pkg-itinerary__wa[data-package-id]").forEach((link) => {
      if (link.dataset.pkgWaBound === "1") return;
      link.dataset.pkgWaBound = "1";
      link.addEventListener("click", (event) => {
        event.preventDefault();
        openPackageWhatsApp(link.dataset.packageId || "custom");
      });
    });
  }

  function initPackagePriceWhatsAppLinks() {
    document.querySelectorAll(".pkg-itinerary__price-wa[data-package-id]").forEach((link) => {
      if (link.dataset.pkgPriceWaBound === "1") return;
      link.dataset.pkgPriceWaBound = "1";
      link.addEventListener("click", (event) => {
        event.preventDefault();
        openPackageWhatsApp(link.dataset.packageId, buildPackagePriceWhatsAppMessage);
      });
    });
  }

  function bootPackagesPage() {
    initHamburgerMenu();
    initNavFilters();
    initPackageWhatsAppLinks();
    initPackagePriceWhatsAppLinks();
    syncDocumentTitle();
  }

  document.addEventListener("sacramento:setLanguage", () => {
    syncDocumentTitle();
  });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bootPackagesPage, { once: true });
  } else {
    bootPackagesPage();
  }
})();

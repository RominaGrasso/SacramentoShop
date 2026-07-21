(function initHomeExperiencesMore() {
  const INITIAL_VISIBLE = 8;
  const PANEL_ID = "homeExperiencesMorePanel";
  const BTN_ID = "homeExperiencesMoreBtn";

  let section = null;
  let panel = null;
  let actions = null;
  let toggleBtn = null;
  let expanded = false;
  let initialized = false;

  function siteLanguage() {
    if (typeof window.getInitialLanguage === "function") return window.getInitialLanguage();
    return localStorage.getItem("selectedLanguage") || "en";
  }

  function dict() {
    const lang = siteLanguage();
    return (
      window.__SACRAMENTO_TRANSLATIONS?.[lang] ||
      window.__SACRAMENTO_TRANSLATIONS?.en ||
      {}
    );
  }

  function t(key, fallback) {
    return dict()[key] || fallback || key;
  }

  function getListedCards() {
    if (typeof window.sacramentoGetHomeExperienceCards === "function") {
      return window.sacramentoGetHomeExperienceCards();
    }
    if (!section) return [];
    return Array.from(section.querySelectorAll(".card")).filter((card) => {
      if (card.hidden) return false;
      if (card.getAttribute("data-temporarily-hidden") === "true") return false;
      if (card.classList.contains("card--hidden-until-boat-returns")) return false;
      if (card.classList.contains("card--hidden-sunset-boat")) return false;
      return true;
    });
  }

  function prefersReducedMotion() {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  function isForceExpandedMode() {
    if (!section) return false;
    if (section.classList.contains("card-search-active")) return true;
    if (section.classList.contains("card-filter-active")) return true;
    return isHamburgerFiltered();
  }

  function isHamburgerFiltered() {
    if (!section) return false;
    if (
      section.classList.contains("card-search-active") ||
      section.classList.contains("card-filter-active")
    ) {
      return false;
    }
    const cards = getListedCards();
    if (cards.length <= 1) return false;
    const hiddenCount = cards.filter((card) => card.style.display === "none").length;
    return hiddenCount > 0;
  }

  function updateToggleLabel() {
    if (!toggleBtn) return;
    const key = expanded ? "home_experiences_less_btn" : "home_experiences_more_btn";
    toggleBtn.dataset.translate = key;
    toggleBtn.textContent = t(
      key,
      expanded ? "Show fewer activities" : "See more activities"
    );
  }

  function setPanelHeight(height) {
    if (!panel) return;
    panel.style.maxHeight = height;
  }

  function refreshPanelHeight() {
    if (!panel || !section) return;
    if (section.classList.contains("home-experiences--collapsed")) {
      setPanelHeight("0px");
      return;
    }
    setPanelHeight(`${panel.scrollHeight}px`);
  }

  function expandPanel(options = {}) {
    const { animate = true, userExpanded = false } = options;
    if (!section || !panel) return;

    if (userExpanded) expanded = true;

    section.classList.remove("home-experiences--collapsed");
    section.classList.add("home-experiences--expanded");
    panel.setAttribute("aria-hidden", "false");

    const targetHeight = panel.scrollHeight;
    if (!animate || prefersReducedMotion()) {
      panel.style.transition = "none";
      setPanelHeight(`${targetHeight}px`);
      panel.offsetHeight;
      panel.style.maxHeight = "none";
      panel.style.transition = "";
    } else {
      if (panel.style.maxHeight === "none") {
        setPanelHeight(`${targetHeight}px`);
      } else {
        setPanelHeight(`${targetHeight}px`);
      }
    }

    if (toggleBtn) {
      toggleBtn.setAttribute("aria-expanded", "true");
      updateToggleLabel();
    }
  }

  function collapsePanel(options = {}) {
    const { animate = true } = options;
    if (!section || !panel) return;

    expanded = false;
    section.classList.add("home-experiences--collapsed");
    section.classList.remove("home-experiences--expanded");
    panel.setAttribute("aria-hidden", "true");

    const currentHeight = panel.scrollHeight;
    if (!animate || prefersReducedMotion()) {
      panel.style.transition = "none";
      setPanelHeight("0px");
      panel.offsetHeight;
      panel.style.transition = "";
    } else {
      setPanelHeight(`${currentHeight}px`);
      panel.offsetHeight;
      setPanelHeight("0px");
    }

    if (toggleBtn) {
      toggleBtn.setAttribute("aria-expanded", "false");
      updateToggleLabel();
    }
  }

  function scrollToCollapseAnchor() {
    if (!section) return;
    const header = document.querySelector("header");
    const offset = header ? header.offsetHeight + 12 : 72;
    const anchor = actions || section;
    const top = anchor.getBoundingClientRect().top + window.scrollY - offset;
    window.scrollTo({ top: Math.max(0, top), behavior: prefersReducedMotion() ? "auto" : "smooth" });
  }

  function updateActionsVisibility(listedCount, forceExpanded) {
    if (!actions || !toggleBtn) return;
    const shouldHide = listedCount <= INITIAL_VISIBLE || forceExpanded;
    actions.hidden = shouldHide;
    toggleBtn.hidden = shouldHide;
  }

  function syncHomeExperiencesMore() {
    if (!initialized || !section || !panel) return;

    const listed = getListedCards();
    const forceExpanded = isForceExpandedMode();

    updateActionsVisibility(listed.length, forceExpanded);

    if (listed.length <= INITIAL_VISIBLE) {
      expandPanel({ animate: false, userExpanded: false });
      if (toggleBtn) toggleBtn.setAttribute("aria-expanded", "true");
      return;
    }

    if (forceExpanded) {
      expanded = false;
      expandPanel({ animate: false, userExpanded: false });
      if (toggleBtn) toggleBtn.setAttribute("aria-expanded", "true");
      updateToggleLabel();
      return;
    }

    if (expanded) {
      expandPanel({ animate: false, userExpanded: true });
    } else {
      collapsePanel({ animate: false });
    }
  }

  function onToggleClick() {
    if (!section || !panel) return;
    if (isForceExpandedMode()) return;

    if (expanded) {
      collapsePanel({ animate: true });
      window.setTimeout(scrollToCollapseAnchor, prefersReducedMotion() ? 0 : 120);
      return;
    }

    expandPanel({ animate: true, userExpanded: true });
  }

  function buildUi(listed) {
    if (listed.length <= INITIAL_VISIBLE) return;

    const anchorCard = listed[INITIAL_VISIBLE - 1];
    const extraCards = listed.slice(INITIAL_VISIBLE);
    if (!anchorCard || !extraCards.length) return;

    actions = document.createElement("div");
    actions.className = "home-experiences-more";

    toggleBtn = document.createElement("button");
    toggleBtn.type = "button";
    toggleBtn.className = "btn home-experiences-more__btn";
    toggleBtn.id = BTN_ID;
    toggleBtn.setAttribute("aria-controls", PANEL_ID);
    toggleBtn.setAttribute("aria-expanded", "false");
    toggleBtn.dataset.translate = "home_experiences_more_btn";
    toggleBtn.textContent = t("home_experiences_more_btn", "See more activities");
    toggleBtn.addEventListener("click", onToggleClick);
    actions.appendChild(toggleBtn);

    panel = document.createElement("div");
    panel.className = "home-experiences-more-panel";
    panel.id = PANEL_ID;
    panel.setAttribute("aria-hidden", "true");

    extraCards.forEach((card) => {
      panel.appendChild(card);
    });

    anchorCard.insertAdjacentElement("afterend", actions);
    actions.insertAdjacentElement("afterend", panel);

    section.classList.add("home-experiences--collapsed");
    setPanelHeight("0px");

    panel.addEventListener("transitionend", (event) => {
      if (event.propertyName !== "max-height") return;
      if (section.classList.contains("home-experiences--expanded")) {
        panel.style.maxHeight = "none";
      }
    });

    window.addEventListener("resize", () => {
      if (section.classList.contains("home-experiences--expanded")) {
        refreshPanelHeight();
      }
    });
  }

  function init() {
    section = document.getElementById("experiences");
    if (!section || initialized) return;

    const listed = getListedCards();
    buildUi(listed);
    initialized = true;
    syncHomeExperiencesMore();
  }

  window.sacramentoSyncHomeExperiencesMore = syncHomeExperiencesMore;

  document.addEventListener("sacramento:setLanguage", () => {
    updateToggleLabel();
  });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();

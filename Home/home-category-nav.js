/**
 * Home: premium category navigation between About and experience cards.
 */
(function () {
  const NAV_KEYS = [
    "tours",
    "fullday",
    "gastronomy",
    "bodega",
    "horseback",
    "craft-beer",
    "boat",
    "lodging",
    "dining",
  ];

  const NAV_LABEL_KEYS = {
    tours: "home_cat_nav_tours",
    fullday: "home_cat_nav_fullday",
    gastronomy: "home_cat_nav_gastronomy",
    bodega: "home_cat_nav_bodega",
    horseback: "home_cat_nav_horseback",
    "craft-beer": "home_cat_nav_craft_beer",
    boat: "home_cat_nav_boat",
    lodging: "home_cat_nav_lodging",
    dining: "home_cat_nav_dining",
  };

  /** Explore link slug → nav groups (a card may appear in multiple categories). */
  const SLUG_NAV = {
    "walkingtour.html": ["tours"],
    "bike.html": ["tours"],
    "walking-asado.html": ["tours"],
    "chivito.html": ["gastronomy", "dining"],
    "vinos.html": ["bodega", "gastronomy", "dining"],
    "food1.html": ["tours", "gastronomy", "dining"],
    "plaza1.html": ["tours", "gastronomy"],
    "historic-lasliebres.html": ["tours", "bodega"],
    "fullday-colonia.html": ["fullday"],
    "traslado-plaza-letras.html": ["fullday", "day"],
    "bruma.html": ["dining", "gastronomy"],
    "asado-boat.html": ["boat", "gastronomy"],
    "lasliebres-dining.html": ["dining", "gastronomy", "bodega"],
    "lasliebres.html": ["horseback", "fullday", "bodega"],
    "sio.html": ["dining", "gastronomy"],
    "romantic.html": ["dining", "gastronomy"],
    "mision-night.html": ["lodging", "gastronomy"],
    "sio-night.html": ["lodging", "gastronomy"],
    "mate.html": ["gastronomy"],
    "barbot.html": ["craft-beer"],
    "barbot-brewpub.html": ["craft-beer", "dining", "gastronomy"],
    "fullday1.html": ["fullday"],
    "fullday2.html": ["fullday", "bodega"],
    "fullday3.html": ["fullday"],
    "fullday4.html": ["fullday", "horseback", "bodega"],
    "sunset-boat.html": ["boat"],
    "cabal.html": ["horseback"],
    "legado.html": ["bodega", "fullday"],
  };

  /** Card ids listed first in category modals (remaining cards keep DOM order). */
  const NAV_CARD_ORDER = {
    fullday: ["home-fullday-colonia-card", "home-traslado-plaza-letras-card"],
    bodega: [
      "home-vinos-card",
      "home-legado-card",
      "home-historic-lasliebres-card",
      "home-cabalgata-liebres-card",
    ],
    boat: [],
    lodging: ["home-card-mision-bruma"],
    dining: ["home-chivito-card", "home-vinos-card"],
    gastronomy: ["home-chivito-card", "home-vinos-card"],
    day: ["home-fullday-colonia-card", "home-traslado-plaza-letras-card"],
  };

  const CARD_ID_NAV = {
    "home-walking-tour-card": ["tours"],
    "home-fullday-colonia-card": ["fullday"],
    "home-traslado-plaza-letras-card": ["fullday", "day"],
    "home-card-mision-bruma": ["lodging", "gastronomy"],
    "home-cabalgata-liebres-card": ["horseback", "fullday", "bodega"],
    "home-cabal-card": ["horseback"],
    "home-barbot-tour-card": ["craft-beer"],
    "home-barbot-brewpub-card": ["craft-beer", "dining"],
    "home-legado-card": ["bodega", "fullday"],
    "home-chivito-card": ["gastronomy", "dining"],
    "home-vinos-card": ["bodega", "gastronomy", "dining"],
    "home-food-tour-card": ["tours", "gastronomy"],
    "home-plaza-anita-card": ["tours", "gastronomy"],
    "home-historic-lasliebres-card": ["tours", "bodega"],
  };

  const SOON_EXPLORE_IDS = new Set([
    "homeLupajackExploreBtn",
    "homeMateAsadoExploreBtn",
  ]);

  let activeNav = null;
  let modalCarouselSeq = 0;

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

  function isListedCard(card) {
    if (!card || !card.classList.contains("card")) return false;
    if (card.hidden) return false;
    if (card.getAttribute("data-temporarily-hidden") === "true") return false;
    if (card.classList.contains("card--hidden-until-boat-returns")) return false;
    if (card.classList.contains("card--hidden-sunset-boat")) return false;
    return true;
  }

  /** Coming-soon cards stay on the home list but are hidden from category popups. */
  function isExcludedSoonFromCategoryPopups(card) {
    if (card.querySelector(".discount-badge--coming-soon")) return true;
    if (card.querySelector("#homeLupajackExploreBtn, #homeMateAsadoExploreBtn")) {
      return true;
    }
    const slug = cardExploreSlug(card);
    return Boolean(slug && slug.startsWith("__soon_"));
  }

  const SOON_SLUG_NAV = {
    __soon_lupajack__: ["tours"],
    __soon_mate_asado__: ["gastronomy"],
  };

  const SLUG_NAV_LC = Object.fromEntries(
    Object.entries(SLUG_NAV).map(([slug, groups]) => [slug.toLowerCase(), groups])
  );

  function normalizeExploreSlug(filename) {
    const base = String(filename || "").trim().toLowerCase();
    if (!base) return "";
    return base.endsWith(".html") ? base : `${base}.html`;
  }

  function navGroupsFromDataset(card) {
    const raw = card.getAttribute("data-home-nav-groups");
    if (!raw) return [];
    return raw
      .trim()
      .split(/\s+/)
      .filter((g) => NAV_KEYS.includes(g));
  }

  function cardExploreSlug(card) {
    const links = card.querySelectorAll(".card-buttons a[href]");
    for (const link of links) {
      const href = String(link.getAttribute("href") || "").trim();
      if (!href || href === "#") continue;
      const match =
        href.match(/(?:^|[/\\])actividades[/\\]([^/?#]+)/i) ||
        href.match(/([^/?#]+\.html)(?:[?#]|$)/i);
      if (match?.[1]) {
        const slug = normalizeExploreSlug(match[1]);
        if (slug) return slug;
      }
    }
    for (const id of SOON_EXPLORE_IDS) {
      if (card.querySelector(`#${id}`)) {
        if (id === "homeLupajackExploreBtn") return "__soon_lupajack__";
        if (id === "homeMateAsadoExploreBtn") return "__soon_mate_asado__";
      }
    }
    return "";
  }

  /** Same tokens as hamburger filter (index.js uses data-filter ↔ data-category). */
  function navGroupsFromCategory(card) {
    const tokens = (card.dataset.category || "").trim().split(/\s+/).filter(Boolean);
    const groups = [];
    if (tokens.includes("tour")) groups.push("tours");
    if (tokens.includes("fullday")) groups.push("fullday");
    if (tokens.includes("gastronomy")) groups.push("gastronomy");
    return groups;
  }

  function getCardNavGroups(card) {
    const groups = new Set();

    navGroupsFromDataset(card).forEach((g) => groups.add(g));

    if (card.id && CARD_ID_NAV[card.id]) {
      CARD_ID_NAV[card.id].forEach((g) => groups.add(g));
    }

    const slug = cardExploreSlug(card);
    if (slug && SOON_SLUG_NAV[slug]) {
      SOON_SLUG_NAV[slug].forEach((g) => groups.add(g));
    } else if (slug && SLUG_NAV_LC[slug]) {
      SLUG_NAV_LC[slug].forEach((g) => groups.add(g));
    }

    navGroupsFromCategory(card).forEach((g) => groups.add(g));

    return [...groups];
  }

  function getExperienceCards() {
    const section = document.getElementById("experiences");
    if (!section) return [];
    return Array.from(section.querySelectorAll(".card")).filter(isListedCard);
  }

  function orderCardsForNav(navKey, cards) {
    const priority = NAV_CARD_ORDER[navKey];
    if (!priority?.length) return cards;
    const prioritySet = new Set(priority);
    const first = priority
      .map((id) => cards.find((card) => card.id === id))
      .filter(Boolean);
    const rest = cards.filter((card) => !card.id || !prioritySet.has(card.id));
    return [...first, ...rest];
  }

  function cardsForNav(navKey) {
    const matches = getExperienceCards().filter((card) => {
      if (isExcludedSoonFromCategoryPopups(card)) return false;
      const groups = getCardNavGroups(card);
      if (!groups.includes(navKey)) return false;
      const slug = cardExploreSlug(card);
      if (navKey === "tours" && (slug === "barbot.html" || slug === "barbot-brewpub.html")) return false;
      if (navKey === "gastronomy" && groups.includes("tours")) return false;
      return true;
    });
    return orderCardsForNav(navKey, matches);
  }

  function sanitizeClone(card) {
    const clone = card.cloneNode(true);
    clone.removeAttribute("id");
    clone.querySelectorAll("[id]").forEach((el) => {
      if (el.closest(".card") === clone) el.removeAttribute("id");
    });
    clone.classList.remove("card--nav-highlight");
    return prepareModalCard(clone);
  }

  function prepareModalCard(card) {
    card.classList.add("card--category-modal");
    card.style.removeProperty("height");
    card.style.removeProperty("max-height");
    card.style.removeProperty("min-height");
    card.style.removeProperty("display");

    card.querySelectorAll(".carousel-track").forEach((track) => {
      track.style.transform = "translateX(0%)";
    });

    card.querySelectorAll(".carousel-track img, .carousel-track video").forEach((slide) => {
      slide.style.removeProperty("width");
      slide.style.removeProperty("height");
      slide.style.removeProperty("max-height");
    });

    card.querySelectorAll(".card-description").forEach((desc) => {
      desc.classList.remove("expanded");
    });

    card.querySelectorAll(".see-more").forEach((btn) => {
      btn.style.display = "none";
    });

    card.querySelectorAll(".card-video").forEach((video) => {
      video.pause();
      video.currentTime = 0;
    });

    return card;
  }

  function refreshModalCardChrome(root) {
    if (typeof window.sacramentoApplyPageIcons === "function") {
      window.sacramentoApplyPageIcons(root);
      return;
    }
    if (typeof window.sacramentoMountCardMetaIcons === "function") {
      window.sacramentoMountCardMetaIcons(root);
    }
    if (typeof window.sacramentoDecorateActivityEmojiIcons === "function") {
      window.sacramentoDecorateActivityEmojiIcons(root);
    }
  }

  function initCarousel(carousel) {
    const track = carousel.querySelector(".carousel-track");
    if (!track) return;
    const slides = track.querySelectorAll("img, video");
    const prevBtn = carousel.querySelector(".prev");
    const nextBtn = carousel.querySelector(".next");
    if (!prevBtn || !nextBtn || !slides.length) return;

    slides.forEach((slide) => {
      slide.style.flex = "0 0 100%";
      slide.style.minWidth = "100%";
      slide.style.maxWidth = "100%";
    });

    const uid = `hc${++modalCarouselSeq}`;
    prevBtn.setAttribute("data-carousel-prev", uid);
    nextBtn.setAttribute("data-carousel-next", uid);
    track.dataset.carouselTrack = uid;

    let slideIndex = 0;
    track.style.transform = "translateX(0%)";
    const update = () => {
      track.style.transform = `translateX(-${slideIndex * 100}%)`;
    };

    prevBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      slideIndex = (slideIndex - 1 + slides.length) % slides.length;
      update();
    });
    nextBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      slideIndex = (slideIndex + 1) % slides.length;
      update();
    });
  }

  function openSoonPopup() {
    const overlay = document.getElementById("popupLupajackSoon");
    if (!overlay) return;
    overlay.classList.add("active");
    overlay.setAttribute("aria-hidden", "false");
  }

  function bindModalCardInteractions(root) {
    root.querySelectorAll(".carousel").forEach(initCarousel);

    root.addEventListener("click", (e) => {
      if (e.target.closest(".carousel-btn")) return;
      if (e.target.closest(".discount-badge")) return;
      if (e.target.closest("a, button")) return;

      const card = e.target.closest(".card");
      if (!card) return;
      const soonBtn = card.querySelector(".card-buttons button.btn:not(.secondary)");
      if (soonBtn && soonBtn.tagName === "BUTTON") {
        e.preventDefault();
        openSoonPopup();
      }
    });

    root.querySelectorAll(".card-buttons button.btn:not(.secondary)").forEach((btn) => {
      if (btn.tagName !== "BUTTON") return;
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        openSoonPopup();
      });
    });
  }

  function applyMainListFilter(navKey) {
    const section = document.getElementById("experiences");
    if (!section) return;

    const matched = new Set(cardsForNav(navKey).map((c) => c));

    section.classList.add("card-filter-active");
    getExperienceCards().forEach((card) => {
      if (matched.has(card)) {
        card.classList.add("card--nav-highlight");
        card.style.removeProperty("display");
      } else {
        card.classList.remove("card--nav-highlight");
        card.style.display = "none";
      }
    });
  }

  function clearMainListFilter() {
    const section = document.getElementById("experiences");
    if (!section) return;
    section.classList.remove("card-filter-active");
    getExperienceCards().forEach((card) => {
      card.classList.remove("card--nav-highlight");
      card.style.removeProperty("display");
    });
  }

  function setActiveChip(navKey) {
    document.querySelectorAll(".home-category-chip").forEach((chip) => {
      chip.classList.toggle("is-active", chip.dataset.homeNav === navKey);
    });
  }

  function clearActiveChip() {
    document.querySelectorAll(".home-category-chip").forEach((chip) => {
      chip.classList.remove("is-active");
    });
  }

  const modal = document.getElementById("homeCategoryModal");
  const modalTitle = document.getElementById("homeCategoryModalTitle");
  const modalCount = document.getElementById("homeCategoryModalCount");
  const modalCards = document.getElementById("homeCategoryModalCards");

  function resetModalScroll() {
    if (!modalCards) return;
    modalCards.scrollTop = 0;
    if (typeof modalCards.scrollTo === "function") {
      try {
        modalCards.scrollTo({ top: 0, left: 0, behavior: "instant" });
      } catch {
        modalCards.scrollTo(0, 0);
      }
    }
  }

  function openModal(navKey) {
    if (!modal || !modalCards) return;

    const matches = cardsForNav(navKey);
    const labelKey = NAV_LABEL_KEYS[navKey];
    const title = t(labelKey, navKey);

    activeNav = navKey;
    setActiveChip(navKey);

    if (modalTitle) modalTitle.textContent = title;
    if (modalCount) {
      modalCount.textContent =
        matches.length > 0
          ? t("home_category_modal_count", "{count} experiences").replace(
              "{count}",
              String(matches.length)
            )
          : t("home_category_modal_empty", "No experiences in this category right now.");
    }

    modalCards.innerHTML = "";
    resetModalScroll();
    matches.forEach((card) => {
      modalCards.appendChild(sanitizeClone(card));
    });
    resetModalScroll();

    bindModalCardInteractions(modalCards);
    refreshModalCardChrome(modalCards);

    if (typeof window.sacramentoSetLanguage === "function") {
      window.sacramentoSetLanguage(siteLanguage());
      refreshModalCardChrome(modalCards);
    }

    modal.classList.add("is-open");
    modal.setAttribute("aria-hidden", "false");
    document.body.classList.add("home-category-modal-open");

    const closeBtn = modal.querySelector(".home-category-modal__close");
    if (closeBtn) closeBtn.focus();
  }

  function closeModal(keepListFilter) {
    if (!modal) return;
    modal.classList.remove("is-open");
    modal.setAttribute("aria-hidden", "true");
    document.body.classList.remove("home-category-modal-open");
    resetModalScroll();
    if (!keepListFilter) {
      activeNav = null;
      clearActiveChip();
      clearMainListFilter();
    }
  }

  function scrollToFullExperienceList() {
    const section = document.getElementById("experiences");
    clearMainListFilter();
    activeNav = null;
    clearActiveChip();
    closeModal(false);
    if (section) {
      section.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  window.sacramentoOpenHomeCategoryNav = openModal;
  window.sacramentoCloseHomeCategoryNav = closeModal;
  window.sacramentoFilterHomeByNav = applyMainListFilter;
  window.sacramentoClearHomeCategoryNav = () => {
    activeNav = null;
    clearActiveChip();
    clearMainListFilter();
    closeModal(false);
  };

  function init() {
    document.querySelectorAll(".home-category-chip[data-home-nav]").forEach((chip) => {
      chip.addEventListener("click", () => {
        const navKey = chip.dataset.homeNav;
        if (!navKey || !NAV_KEYS.includes(navKey)) return;
        if (activeNav === navKey && modal?.classList.contains("is-open")) {
          scrollToFullExperienceList();
          return;
        }
        openModal(navKey);
      });
    });

    modal?.querySelectorAll("[data-home-category-close]").forEach((el) => {
      el.addEventListener("click", () => closeModal(false));
    });

    document.getElementById("homeCategoryModalScrollBtn")?.addEventListener("click", () => {
      scrollToFullExperienceList();
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && modal?.classList.contains("is-open")) {
        closeModal(false);
      }
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();

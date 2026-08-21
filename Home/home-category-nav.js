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

  /**
   * Smart search: keywords (ES / EN / PT) → experience groups / categories.
   * Partial matches work both ways (e.g. "restoran" ↔ "restaurant").
   */
  const SEARCH_INTENTS = [
    {
      id: "dining",
      navGroups: ["gastronomy", "dining"],
      categoryTokens: ["gastronomy"],
      keywords: [
        "restaurant",
        "restaurante",
        "restoran",
        "restorant",
        "resto",
        "comida",
        "food",
        "eat",
        "eating",
        "dining",
        "dine",
        "gastronomy",
        "gastronomia",
        "gastronomica",
        "gastronomico",
        "culinary",
        "gourmet",
        "kitchen",
        "cocina",
        "almuerzo",
        "lunch",
        "cena",
        "dinner",
        "desayuno",
        "breakfast",
        "mesa",
        "table",
        "asado",
        "barbecue",
        "bbq",
        "menu",
        "menus",
        "refugio",
        "bruma",
        "sio",
        "sushi",
        "picnic",
        "chef",
        "plato",
        "platos",
        "comer",
        "almorzar",
        "cenar",
        "jantar",
        "almoco",
        "almoço",
        "refeicao",
        "refeição",
        "restaurante",
        "comida",
        "gastronomia",
        "gastronômico",
        "gastronomico",
      ],
    },
    {
      id: "bodega",
      navGroups: ["bodega"],
      categoryTokens: [],
      keywords: [
        "wine",
        "wines",
        "vino",
        "vinos",
        "winery",
        "bodega",
        "vineyard",
        "vinedo",
        "viñedo",
        "vinhedo",
        "tasting",
        "degustacion",
        "degustación",
        "degustacao",
        "degustação",
        "malbec",
        "tannat",
        "grapes",
        "uvas",
        "uva",
        "legado",
        "quinton",
        "quintón",
        "quinton",
        "liebres",
        "las liebres",
        "vinicola",
        "vinícola",
        "enologia",
        "enología",
        "copa",
        "copa de vino",
        "wine tasting",
        "bodegas",
      ],
    },
    {
      id: "horseback",
      navGroups: ["horseback"],
      categoryTokens: [],
      keywords: [
        "cabalgata",
        "cabalgatas",
        "horseback",
        "horse",
        "horses",
        "caballo",
        "caballos",
        "cabalgar",
        "cavalgada",
        "cavalgadas",
        "cavalgar",
        "cavalo",
        "cavalos",
        "equino",
        "yegua",
        "potro",
        "gabino",
        "cabal",
      ],
    },
    {
      id: "tours",
      navGroups: ["tours"],
      categoryTokens: [],
      keywords: [
        "tour",
        "tours",
        "walking",
        "walk",
        "caminata",
        "paseo",
        "guia",
        "guía",
        "guide",
        "guided",
        "historico",
        "histórico",
        "historic",
        "casco",
        "quarter",
        "barrio historico",
        "barrio histórico",
        "bicicleta",
        "bike",
        "bici",
        "ciclo",
        "cycling",
        "recorrido",
        "visita guiada",
        "tour guiado",
        "tours guiados",
        "guided tour",
        "guided tours",
        "city tour",
        "letras",
        "candombe",
        "culture",
        "cultura",
      ],
    },
    {
      id: "fullday",
      navGroups: ["fullday"],
      categoryTokens: [],
      keywords: [
        "fullday",
        "full day",
        "full-day",
        "dia completo",
        "día completo",
        "dia entero",
        "día entero",
        "jornada",
        "all day",
        "dia todo",
        "día todo",
        "experiencia completa",
        "full day colonia",
      ],
    },
    {
      id: "boat",
      navGroups: ["boat"],
      categoryTokens: [],
      keywords: [
        "boat",
        "boats",
        "barco",
        "barcos",
        "rio",
        "río",
        "river",
        "navegacion",
        "navegación",
        "navigation",
        "sunset boat",
        "atardecer",
        "sunset",
        "puesta de sol",
        "rio de la plata",
        "embarcacion",
        "embarcación",
        "navegar",
        "lancha",
        "yate",
        "cruise",
        "crucero",
        "corporate boat",
      ],
    },
    {
      id: "lodging",
      navGroups: ["lodging"],
      categoryTokens: [],
      keywords: [
        "hotel",
        "hotels",
        "lodging",
        "hospedaje",
        "alojamiento",
        "alojar",
        "stay",
        "noche",
        "night",
        "overnight",
        "posada",
        "mision",
        "misión",
        "royal",
        "pet friendly",
        "mascota",
        "mascotas",
        "habitacion",
        "habitación",
        "room",
        "rooms",
        "dormir",
        "pernoctar",
        "hospedagem",
        "quarto",
      ],
    },
    {
      id: "craft-beer",
      navGroups: ["craft-beer"],
      categoryTokens: [],
      keywords: [
        "beer",
        "beers",
        "cerveza",
        "cervezas",
        "craft beer",
        "barbot",
        "brewpub",
        "cerveceria",
        "cervecería",
        "pinta",
        "ipa",
        "lager",
        "chop",
        "chopp",
        "birra",
        "brewhouse",
        "brewery",
      ],
    },
    {
      id: "romantic",
      navGroups: [],
      categoryTokens: ["romantic"],
      keywords: [
        "romantic",
        "romantico",
        "romántico",
        "romance",
        "pareja",
        "couple",
        "anniversary",
        "aniversario",
        "cena romantica",
        "cena romántica",
        "date night",
        "noche especial",
      ],
    },
  ];

  /** Explore link slug → nav groups (a card may appear in multiple categories). */
  const SLUG_NAV = {
    "walkingtour.html": ["tours"],
    "bike.html": ["tours"],
    "golfcart.html": ["tours"],
    "golden-mile.html": ["tours", "night", "gastronomy"],
    "walking-asado.html": ["tours"],
    "chivito.html": ["gastronomy", "dining"],
    "vinos.html": ["bodega", "gastronomy", "dining"],
    "s34-gin.html": ["gastronomy"],
    "quinton.html": ["bodega", "gastronomy", "dining", "fullday"],
    "food1.html": ["tours", "gastronomy", "dining"],
    "plaza1.html": ["tours", "gastronomy"],
    "historic-lasliebres.html": ["tours", "bodega"],
    "fullday-colonia.html": ["fullday"],
    "traslado-plaza-letras.html": ["tours", "fullday", "day"],
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
    "experiencia-bodega.html": ["bodega", "gastronomy", "dining"],
    "hotel-royal.html": ["lodging", "night"],
  };

  /** Card ids listed first in category modals (remaining cards keep DOM order). */
  const NAV_CARD_ORDER = {
    tours: ["home-walking-tour-card", "home-traslado-plaza-letras-card"],
    fullday: ["home-fullday-colonia-card", "home-traslado-plaza-letras-card", "home-quinton-card"],
    bodega: [
      "home-exp-bodega-card",
      "home-vinos-card",
      "home-quinton-card",
      "home-legado-card",
      "home-historic-lasliebres-card",
      "home-cabalgata-liebres-card",
    ],
    boat: [],
    lodging: ["home-card-hotel-royal", "home-card-mision-bruma"],
    dining: ["home-chivito-card", "home-vinos-card", "home-quinton-card"],
    gastronomy: ["home-exp-bodega-card", "home-vinos-card", "home-quinton-card"],
    day: ["home-fullday-colonia-card", "home-traslado-plaza-letras-card"],
  };

  const CARD_ID_NAV = {
    "home-walking-tour-card": ["tours"],
    "home-fullday-colonia-card": ["fullday", "day"],
    "home-traslado-plaza-letras-card": ["tours", "fullday", "day"],
    "home-bike-card": ["tours"],
    "home-golfcart-card": ["tours"],
    "home-golden-mile-card": ["tours", "night", "gastronomy"],
    "home-card-hotel-royal": ["lodging", "night"],
    "home-card-mision-bruma": ["lodging", "gastronomy"],
    "home-cabalgata-liebres-card": ["horseback", "fullday", "bodega"],
    "home-cabal-card": ["horseback"],
    "home-barbot-tour-card": ["craft-beer"],
    "home-barbot-brewpub-card": ["craft-beer", "dining"],
    "home-chivito-card": ["gastronomy", "dining"],
    "home-legado-card": ["bodega", "fullday"],
    "home-vinos-card": ["bodega", "gastronomy", "dining"],
    "home-exp-bodega-card": ["bodega", "gastronomy", "dining"],
    "home-quinton-card": ["bodega", "gastronomy", "dining", "fullday"],
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
    // "tour" in data-category is too broad (lodging/dining cards use it secondarily).
    // Tours are assigned via data-home-nav-groups, CARD_ID_NAV, or SLUG_NAV.
    if (tokens.includes("fullday")) groups.push("fullday");
    if (tokens.includes("gastronomy")) groups.push("gastronomy");
    return groups;
  }

  const TOURS_EXCLUDED_SLUGS = new Set([
    "barbot-brewpub.html",
    "corporate-boat.html",
  ]);

  /** Guided-tour search: brewery tour in, bullring + café out. */
  const GUIDED_TOUR_SEARCH_KEYWORDS = [
    "tour guiado",
    "tours guiados",
    "guided tour",
    "guided tours",
    "visita guiada",
    "visitas guiadas",
    "tour guidado",
    "tours guidados",
  ];

  const GUIDED_TOUR_SEARCH_INCLUDE_SLUGS = new Set(["barbot.html"]);
  const GUIDED_TOUR_SEARCH_EXCLUDE_SLUGS = new Set(["plaza1.html"]);

  const CHIVITO_SEARCH_SLUGS = new Set([
    "chivito.html",
    "food1.html",
    "fullday-colonia.html",
  ]);

  function isChivitoSearch(query) {
    return queryMatchesKeyword(query, "chivito");
  }

  function cardMatchesChivitoSearch(card) {
    const slug = cardExploreSlug(card);
    if (slug && CHIVITO_SEARCH_SLUGS.has(slug)) return true;
    return getCardSearchText(card).includes("chivito");
  }

  const MATE_SEARCH_SLUGS = new Set(["mate.html", "__soon_mate_asado__"]);
  const MATE_SEARCH_EXCLUDE_SLUGS = new Set(["walkingtour.html"]);

  function isMateSearch(query) {
    const normalized = normalizeSearchText(query);
    if (normalized === "mate" || normalized === "mates") return true;
    if (normalized.includes("yerba")) return true;
    return queryMatchesKeyword(normalized, "mate") || queryMatchesKeyword(normalized, "mates");
  }

  function textContainsMateWord(text) {
    return /\b(?:mate|mates)\b/.test(text);
  }

  function cardMatchesMateSearch(card) {
    const slug = cardExploreSlug(card);
    if (slug && MATE_SEARCH_EXCLUDE_SLUGS.has(slug)) return false;
    if (slug && MATE_SEARCH_SLUGS.has(slug)) return true;
    return textContainsMateWord(getCardSearchText(card));
  }

  const PLAZA_TOROS_SEARCH_KEYWORDS = [
    "plaza de toros",
    "plaza toros",
    "plaza de toro",
    "bullring",
    "toros real de san carlos",
    "real de san carlos",
  ];

  const PLAZA_TOROS_SEARCH_SLUGS = new Set([
    "plaza1.html",
    "traslado-plaza-letras.html",
    "fullday-colonia.html",
  ]);

  function isPlazaTorosSearch(query) {
    const normalized = normalizeSearchText(query);
    if (PLAZA_TOROS_SEARCH_KEYWORDS.some((kw) => queryMatchesKeyword(normalized, kw))) {
      return true;
    }
    const tokens = normalized.split(" ").filter(Boolean);
    if (tokens.includes("toros") && tokens.includes("plaza")) return true;
    return normalized === "toros";
  }

  function cardMatchesPlazaTorosSearch(card) {
    const slug = cardExploreSlug(card);
    if (slug && PLAZA_TOROS_SEARCH_SLUGS.has(slug)) return true;
    const text = getCardSearchText(card);
    if (text.includes("plaza de toros")) return true;
    return /\bplaza\b/.test(text) && /\btoros\b/.test(text);
  }

  function isGuidedTourSearch(query) {
    const normalized = normalizeSearchText(query);
    if (GUIDED_TOUR_SEARCH_KEYWORDS.some((kw) => queryMatchesKeyword(normalized, kw))) {
      return true;
    }
    const tokens = normalized.split(" ").filter(Boolean);
    const hasTourish = tokens.some((t) =>
      ["tour", "tours", "visita", "visitas", "guided"].includes(t)
    );
    const hasGuideish = tokens.some((t) =>
      ["guiado", "guiada", "guiados", "guiadas", "guided", "guia", "guide"].includes(t)
    );
    return hasTourish && hasGuideish;
  }

  function cardMatchesGuidedTourSearch(card) {
    const slug = cardExploreSlug(card);
    if (slug && GUIDED_TOUR_SEARCH_EXCLUDE_SLUGS.has(slug)) return false;
    if (slug && GUIDED_TOUR_SEARCH_INCLUDE_SLUGS.has(slug)) return true;
    return cardBelongsToNavKey(card, "tours");
  }

  function cardBelongsToNavKey(card, navKey) {
    if (isExcludedSoonFromCategoryPopups(card)) return false;
    const groups = getCardNavGroups(card);
    if (!groups.includes(navKey)) return false;
    const slug = cardExploreSlug(card);
    if (navKey === "tours" && slug && TOURS_EXCLUDED_SLUGS.has(slug)) return false;
    if (navKey === "gastronomy" && groups.includes("tours")) return false;
    return true;
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
    const prioritySlugs = {
      tours: ["walkingtour.html"],
    };
    const used = new Set();
    const first = [];
    for (const id of priority) {
      const byId = cards.find((card) => card.id === id);
      if (byId && !used.has(byId)) {
        first.push(byId);
        used.add(byId);
      }
    }
    for (const slug of prioritySlugs[navKey] || []) {
      const bySlug = cards.find((card) => cardExploreSlug(card) === slug);
      if (bySlug && !used.has(bySlug)) {
        first.push(bySlug);
        used.add(bySlug);
      }
    }
    const rest = cards.filter((card) => !used.has(card));
    return [...first, ...rest];
  }

  function cardsForNav(navKey) {
    const matches = getExperienceCards().filter((card) => cardBelongsToNavKey(card, navKey));
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

  function getCardExploreAnchor(card) {
    const buttons = card.querySelector(".card-buttons");
    if (!buttons) return null;
    for (const link of buttons.querySelectorAll("a.btn")) {
      if (link.classList.contains("secondary")) continue;
      const href = String(link.getAttribute("href") || "").trim();
      if (href && href !== "#") return link;
    }
    return null;
  }

  function cardExploreAriaLabel(card) {
    const title =
      card.querySelector(".card-content h3")?.textContent?.replace(/\s+/g, " ").trim() || "";
    const subject =
      title || t("home_category_modal_explore_fallback", "this experience");
    return t("home_category_modal_explore_aria", "Explore {title}").replace("{title}", subject);
  }

  function copyExploreLinkAttrs(fromAnchor, toLink, card) {
    toLink.href = fromAnchor.getAttribute("href") || "#";
    const target = fromAnchor.getAttribute("target");
    const rel = fromAnchor.getAttribute("rel");
    if (target) toLink.setAttribute("target", target);
    else toLink.removeAttribute("target");
    if (rel) toLink.setAttribute("rel", rel);
    else toLink.removeAttribute("rel");
    toLink.setAttribute("aria-label", cardExploreAriaLabel(card));
  }

  function wireModalCardExploreNavigation(card) {
    const exploreAnchor = getCardExploreAnchor(card);
    if (!exploreAnchor) return;

    const h3 = card.querySelector(".card-content h3");
    if (h3 && !h3.querySelector(".card-modal-explore-link--title")) {
      const titleLink = document.createElement("a");
      titleLink.className = "card-modal-explore-link card-modal-explore-link--title";
      copyExploreLinkAttrs(exploreAnchor, titleLink, card);
      while (h3.firstChild) titleLink.appendChild(h3.firstChild);
      h3.appendChild(titleLink);
    }

    const cardImage = card.querySelector(".card-image");
    if (!cardImage || cardImage.querySelector(".card-modal-explore-link--media")) return;

    const track = cardImage.querySelector(".carousel-track");
    const singleImg = !track ? cardImage.querySelector(":scope > img") : null;
    if (!track && !singleImg) return;

    const mediaLink = document.createElement("a");
    mediaLink.className = "card-modal-explore-link card-modal-explore-link--media";
    copyExploreLinkAttrs(exploreAnchor, mediaLink, card);

    if (track) {
      cardImage.insertBefore(mediaLink, track);
      mediaLink.appendChild(track);
    } else {
      cardImage.insertBefore(mediaLink, singleImg);
      mediaLink.appendChild(singleImg);
    }
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

    wireModalCardExploreNavigation(card);

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
      e.preventDefault();
      e.stopPropagation();
      slideIndex = (slideIndex - 1 + slides.length) % slides.length;
      update();
    });
    nextBtn.addEventListener("click", (e) => {
      e.preventDefault();
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
    window.sacramentoSyncHomeExperiencesMore?.();
  }

  function clearMainListFilter() {
    const section = document.getElementById("experiences");
    if (!section) return;
    section.classList.remove("card-filter-active");
    getExperienceCards().forEach((card) => {
      card.classList.remove("card--nav-highlight");
      card.style.removeProperty("display");
    });
    window.sacramentoSyncHomeExperiencesMore?.();
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
    if (typeof window.sacramentoMountHomeCardPrices === "function") {
      window.sacramentoMountHomeCardPrices(modalCards);
    }

    if (typeof window.sacramentoSetLanguage === "function") {
      window.sacramentoSetLanguage(siteLanguage());
      refreshModalCardChrome(modalCards);
      if (typeof window.sacramentoMountHomeCardPrices === "function") {
        window.sacramentoMountHomeCardPrices(modalCards);
      }
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

  function normalizeSearchText(value) {
    return String(value || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function queryMatchesKeyword(query, keyword) {
    const q = normalizeSearchText(query);
    const k = normalizeSearchText(keyword);
    if (!q || !k) return false;
    if (q.length < 2 && k.length > 4) return false;
    if (k.length < 2 && q.length > 4) return false;
    return q.includes(k) || k.includes(q);
  }

  function resolveSearchIntents(query) {
    const normalized = normalizeSearchText(query);
    if (!normalized) return [];

    const matched = [];
    const seen = new Set();

    const register = (intent) => {
      if (!intent || seen.has(intent.id)) return;
      seen.add(intent.id);
      matched.push(intent);
    };

    for (const intent of SEARCH_INTENTS) {
      if (intent.keywords.some((kw) => queryMatchesKeyword(normalized, kw))) {
        register(intent);
      }
    }

    normalized.split(" ").forEach((token) => {
      if (token.length < 2) return;
      for (const intent of SEARCH_INTENTS) {
        if (intent.keywords.some((kw) => queryMatchesKeyword(token, kw))) {
          register(intent);
        }
      }
    });

    return matched;
  }

  function getCardSearchText(card) {
    const parts = [];
    card.querySelectorAll("h3, .card-description, .card-meta__text, .medical").forEach((el) => {
      const text = el.textContent?.trim();
      if (text) parts.push(text);
    });
    const slug = cardExploreSlug(card);
    if (slug) parts.push(slug.replace(/\.html$/, "").replace(/-/g, " "));
    return normalizeSearchText(parts.join(" "));
  }

  function cardMatchesIntent(card, intents) {
    if (!intents.length) return false;
    const catTokens = (card.dataset.category || "").trim().split(/\s+/).filter(Boolean);
    return intents.some((intent) => {
      const navGroups = intent.navGroups || [];
      const categoryTokens = intent.categoryTokens || [];
      if (navGroups.length) {
        return navGroups.some((g) => cardBelongsToNavKey(card, g));
      }
      if (categoryTokens.length) {
        return categoryTokens.some((t) => catTokens.includes(t));
      }
      return false;
    });
  }

  function cardMatchesSearch(card, query) {
    const normalized = normalizeSearchText(query);
    if (!normalized) return true;

    if (isChivitoSearch(normalized)) {
      return cardMatchesChivitoSearch(card);
    }

    if (isMateSearch(normalized)) {
      return cardMatchesMateSearch(card);
    }

    if (isPlazaTorosSearch(normalized)) {
      return cardMatchesPlazaTorosSearch(card);
    }

    const intents = resolveSearchIntents(normalized);
    if (intents.length) {
      const wantsTours = intents.some((intent) => intent.id === "tours");
      if (wantsTours && isGuidedTourSearch(normalized)) {
        return cardMatchesGuidedTourSearch(card);
      }
      return cardMatchesIntent(card, intents);
    }

    const text = getCardSearchText(card);
    if (text.includes(normalized)) return true;

    const tokens = normalized.split(" ").filter((t) => t.length >= 2);
    return tokens.some((token) => text.includes(token));
  }

  let searchScrollTimer = null;

  function scrollToExperiences() {
    const section = document.getElementById("experiences");
    if (!section) return;
    const header = document.querySelector("header");
    const offset = header ? header.offsetHeight + 12 : 72;
    const top = section.getBoundingClientRect().top + window.scrollY - offset;
    window.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
  }

  function clearActivitySearch(options = {}) {
    const { keepInput = false } = options;
    const input = document.getElementById("homeActivitySearch");
    const clearBtn = document.getElementById("homeActivitySearchClear");
    const emptyEl = document.getElementById("homeActivitySearchEmpty");
    const section = document.getElementById("experiences");

    if (input && !keepInput) input.value = "";
    if (clearBtn) clearBtn.hidden = true;
    if (emptyEl) emptyEl.hidden = true;
    if (section) section.classList.remove("card-search-active");
    window.clearTimeout(searchScrollTimer);

    getExperienceCards().forEach((card) => {
      card.classList.remove("card--search-hidden", "card--search-match");
      if (!section?.classList.contains("card-filter-active")) {
        card.style.removeProperty("display");
      }
    });
    window.sacramentoSyncHomeExperiencesMore?.();
  }

  function applyActivitySearch(rawQuery) {
    const query = normalizeSearchText(rawQuery).trim();
    const input = document.getElementById("homeActivitySearch");
    const clearBtn = document.getElementById("homeActivitySearchClear");
    const emptyEl = document.getElementById("homeActivitySearchEmpty");
    const section = document.getElementById("experiences");

    if (!query) {
      clearActivitySearch({ keepInput: true });
      return;
    }

    if (typeof window.sacramentoClearHomeCategoryNav === "function") {
      activeNav = null;
      clearActiveChip();
      clearMainListFilter();
      closeModal(false);
    }

    if (section) section.classList.add("card-search-active");
    if (clearBtn) clearBtn.hidden = false;

    let visible = 0;
    getExperienceCards().forEach((card) => {
      const match = cardMatchesSearch(card, query);
      card.classList.toggle("card--search-match", match);
      card.classList.toggle("card--search-hidden", !match);
      card.style.display = match ? "" : "none";
      if (match) visible += 1;
    });

    if (emptyEl) emptyEl.hidden = visible > 0;

    if (visible > 0) {
      window.clearTimeout(searchScrollTimer);
      searchScrollTimer = window.setTimeout(() => {
        const current = normalizeSearchText(input?.value || "");
        if (current && current === query) scrollToExperiences();
      }, 380);
    }

    window.sacramentoSyncHomeExperiencesMore?.();
  }

  window.sacramentoClearHomeActivitySearch = clearActivitySearch;
  window.sacramentoApplyHomeActivitySearch = applyActivitySearch;
  window.sacramentoGetHomeExperienceCards = getExperienceCards;

  function initActivitySearch() {
    const input = document.getElementById("homeActivitySearch");
    const clearBtn = document.getElementById("homeActivitySearchClear");
    if (!input) return;

    let debounceTimer = null;
    const runSearch = () => applyActivitySearch(input.value);

    input.addEventListener("input", () => {
      window.clearTimeout(debounceTimer);
      debounceTimer = window.setTimeout(runSearch, 120);
    });

    input.addEventListener("search", runSearch);

    input.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        input.value = "";
        clearActivitySearch();
        input.blur();
      }
    });

    clearBtn?.addEventListener("click", () => {
      input.value = "";
      clearActivitySearch();
      input.focus();
    });

    document.addEventListener("sacramento:setLanguage", () => {
      if (input.value.trim()) applyActivitySearch(input.value);
    });
  }

  function init() {
    document.querySelectorAll(".home-category-chip[data-home-nav]").forEach((chip) => {
      chip.addEventListener("click", () => {
        const navKey = chip.dataset.homeNav;
        if (!navKey || !NAV_KEYS.includes(navKey)) return;
        if (activeNav === navKey && modal?.classList.contains("is-open")) {
          scrollToFullExperienceList();
          return;
        }
        clearActivitySearch();
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

    initActivitySearch();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();

/**
 * Home experience cards: prominent entry price below each card title.
 * Keep in sync with activity page pricing (packages, tiers, occupancy).
 */
(function () {
  /**
   * Per-activity minimum per-person USD prices (lowest bookable entry).
   * Arrays → Math.min; omit slug to hide label (e.g. hotel with external rates).
   */
  const HOME_CARD_LODGING_SLUGS = new Set(["mision-night.html", "sio-night.html"]);

  const HOME_CARD_PROMO_SLUGS = new Set(["hotel-royal.html"]);

  const HOME_CARD_PRICE_USD = {
    "cabal.html": [40],
    "walkingtour.html": [12, 17],
    "mate.html": [40],
    "traslado-plaza-letras.html": [50],
    "vinos.html": [30, 35, 40],
    "s34-gin.html": [50, 70, 120],
    "quinton.html": [100, 110, 130],
    "fullday-colonia.html": [90],
    "plaza1.html": [80, 160],
    "chivito.html": [40],
    "food1.html": [55],
    "bike.html": [60],
    "barbot.html": [35, 45, 65],
    "bruma.html": [50],
    "asado-boat.html": [60, 80],
    "walking-asado.html": [60, 80],
    "barbot-brewpub.html": [45, 55],
    "lasliebres-dining.html": [75, 90],
    "historic-lasliebres.html": [85, 105, 120],
    "lasliebres.html": [85],
    "legado.html": [35, 55, 85],
    "sio.html": [70],
    "romantic.html": [70],
    "sunset-boat.html": [30],
    "mision-night.html": [115],
    "sio-night.html": [115],
    "corporate-boat.html": [150],
  };

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

  function normalizeExploreSlug(filename) {
    const base = String(filename || "").trim().toLowerCase();
    if (!base) return "";
    return base.endsWith(".html") ? base : `${base}.html`;
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
    return "";
  }

  function minUsdForSlug(slug) {
    const entry = HOME_CARD_PRICE_USD[slug];
    if (entry == null) return null;
    if (typeof entry === "number") return entry;
    if (Array.isArray(entry) && entry.length) {
      const nums = entry.map(Number).filter((n) => Number.isFinite(n) && n > 0);
      return nums.length ? Math.min(...nums) : null;
    }
    return null;
  }

  function isHotelPromoCard(card, slug) {
    if (slug && HOME_CARD_PROMO_SLUGS.has(slug)) return true;
    return card.id === "home-card-hotel-royal";
  }

  function isLodgingPriceCard(card, slug) {
    if (slug && HOME_CARD_LODGING_SLUGS.has(slug)) return true;
    const groups = String(card.getAttribute("data-home-nav-groups") || "")
      .trim()
      .split(/\s+/)
      .filter(Boolean);
    return groups.includes("lodging");
  }

  function ensurePriceStructure(pill) {
    let from = pill.querySelector("[data-home-card-price-from]");
    let amount = pill.querySelector("[data-home-card-price-amount]");
    let unit = pill.querySelector("[data-home-card-price-unit]");
    if (from && amount && unit) return { from, amount, unit };

    pill.replaceChildren();
    pill.className = "card-entry-price";
    pill.setAttribute("data-card-meta", "price");

    from = document.createElement("span");
    from.className = "card-entry-price__from";
    from.setAttribute("data-home-card-price-from", "");

    amount = document.createElement("span");
    amount.className = "card-entry-price__amount";
    amount.setAttribute("data-home-card-price-amount", "");
    amount.setAttribute("translate", "no");
    amount.setAttribute("lang", "en");

    unit = document.createElement("span");
    unit.className = "card-entry-price__unit";
    unit.setAttribute("data-home-card-price-unit", "");

    pill.append(from, amount, unit);
    return { from, amount, unit };
  }

  function placePricePill(card, pill) {
    const content = card.querySelector(".card-content");
    if (!content) return;
    const title = content.querySelector("h3");
    const anchor = title ? title.nextElementSibling : null;
    if (anchor === pill) return;
    if (anchor) {
      content.insertBefore(pill, anchor);
      return;
    }
    const buttons = content.querySelector(".card-buttons");
    if (buttons) {
      content.insertBefore(pill, buttons);
    } else {
      content.appendChild(pill);
    }
  }

  function updateCardPromo(card) {
    let block = card.querySelector(".card-entry-price");
    if (!block) {
      block = document.createElement("div");
      block.className = "card-entry-price card-entry-price--promo";
      block.setAttribute("data-card-meta", "promo");
    } else {
      block.className = "card-entry-price card-entry-price--promo";
      block.setAttribute("data-card-meta", "promo");
    }
    placePricePill(card, block);

    const { from, amount: amountEl, unit } = ensurePriceStructure(block);
    from.textContent = t("home_card_hotel_promo_label", "Exclusive benefit");
    amountEl.textContent = t("home_card_hotel_promo_value", "Promotional code");
    unit.textContent = "";
    unit.hidden = true;
  }

  function updateCardPrice(card, slug, amount) {
    let block = card.querySelector(".card-entry-price");
    if (amount == null || amount <= 0) {
      block?.remove();
      return;
    }

    if (!block) {
      block = document.createElement("div");
      block.className = "card-entry-price";
      block.setAttribute("data-card-meta", "price");
    } else {
      block.className = "card-entry-price";
      block.setAttribute("data-card-meta", "price");
    }
    placePricePill(card, block);

    const { from, amount: amountEl, unit } = ensurePriceStructure(block);
    const rounded = Math.round(amount);
    const lodging = isLodgingPriceCard(card, slug);

    unit.hidden = false;
    from.textContent = t("home_card_price_from", "From");
    amountEl.textContent = `USD\u00A0${rounded}`;
    unit.textContent = lodging
      ? t("home_card_price_per_night", "per night")
      : t("home_card_price_per_person", "per person");
  }

  function isListedCard(card) {
    if (!card || !card.classList.contains("card")) return false;
    if (card.hidden) return false;
    if (card.getAttribute("data-temporarily-hidden") === "true") return false;
    if (card.classList.contains("card--hidden-until-boat-returns")) return false;
    if (card.classList.contains("card--hidden-sunset-boat")) return false;
    return true;
  }

  function mountHomeCardPrices(root) {
    const scope = root && root.querySelectorAll ? root : document;
    const cards = scope.querySelectorAll ? scope.querySelectorAll(".card") : [];

    cards.forEach((card) => {
      if (scope !== document && !card.closest("#experiences, #homeCategoryModalCards")) return;
      if (scope === document && card.closest("#homeCategoryModalCards")) return;
      if (!isListedCard(card)) {
        card.querySelector(".card-entry-price")?.remove();
        return;
      }

      const slug = cardExploreSlug(card);
      if (isHotelPromoCard(card, slug)) {
        updateCardPromo(card);
        return;
      }

      const minUsd = slug ? minUsdForSlug(slug) : null;
      updateCardPrice(card, slug, minUsd);
    });
  }

  window.sacramentoMountHomeCardPrices = mountHomeCardPrices;

  function init() {
    mountHomeCardPrices(document.getElementById("experiences"));
    document.addEventListener("sacramento:setLanguage", () => {
      mountHomeCardPrices(document.getElementById("experiences"));
      const modalCards = document.getElementById("homeCategoryModalCards");
      if (modalCards) mountHomeCardPrices(modalCards);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();

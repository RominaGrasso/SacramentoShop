/**
 * Package builder pricing: variants + pricing mode per activity slug.
 * Amounts mirror Actividades/* booking configs (not home-card "DESDE" alone).
 *
 * pricingMode:
 * - perPerson → unit × guests
 * - group → fixed package / vehicle / group total (ignore guest multiply)
 * - perNight → lodging night rate (once for estimate)
 */
(function () {
  /**
   * @typedef {{ id: string, price: number, labelKey: string, labelFallback?: string }} PkgVariant
   * @typedef {{ pricingMode: "perPerson"|"group"|"perNight", variants: PkgVariant[] }} PkgPricingSpec
   */

  /** @type {Record<string, PkgPricingSpec>} */
  const BY_SLUG = {
    "golfcart.html": {
      pricingMode: "group",
      variants: [
        { id: "up_to_3", price: 140, labelKey: "golfcart_pkg_opt1_label", labelFallback: "Up to 3 guests" },
        { id: "up_to_5", price: 180, labelKey: "golfcart_pkg_opt2_label", labelFallback: "Up to 5 guests" }
      ]
    },
    "vinos.html": {
      pricingMode: "perPerson",
      variants: [
        { id: "copas_5_empanadas", price: 40, labelKey: "vinos_pkg_opt1_label", labelFallback: "5 wines + empanadas" },
        { id: "copas_3_empanadas", price: 35, labelKey: "vinos_pkg_opt2_label", labelFallback: "3 wines + empanadas" },
        { id: "copas_5", price: 30, labelKey: "vinos_pkg_opt3_label", labelFallback: "5 wines" }
      ]
    },
    "experiencia-bodega.html": {
      pricingMode: "perPerson",
      variants: [
        { id: "degustacion_5_vinos", price: 35, labelKey: "exp_bodega_pkg_opt1_label", labelFallback: "5-wine tasting" },
        { id: "vinos_quesos", price: 50, labelKey: "exp_bodega_pkg_opt2_label", labelFallback: "Wines & Cheeses" },
        { id: "premium_vinos_sabores", price: 70, labelKey: "exp_bodega_pkg_opt3_label", labelFallback: "Premium Wine & Local Flavors" }
      ]
    },
    "legado.html": {
      pricingMode: "perPerson",
      variants: [
        { id: "tour_tasting", price: 35, labelKey: "legado_pkg_opt1_label", labelFallback: "Tour with tasting" },
        { id: "tour_tasting_picada", price: 55, labelKey: "legado_pkg_opt2_label", labelFallback: "Tour, tasting & picada" },
        { id: "full_experience", price: 85, labelKey: "legado_pkg_opt3_label", labelFallback: "Full experience" }
      ]
    },
    "s34-gin.html": {
      pricingMode: "perPerson",
      variants: [
        { id: "tour", price: 50, labelKey: "s34_pkg_tour_label", labelFallback: "Distillery Tour" },
        { id: "master_class", price: 70, labelKey: "s34_pkg_master_label", labelFallback: "Gin Master Class" },
        { id: "create_gin", price: 120, labelKey: "s34_pkg_create_label", labelFallback: "Create Your Own Gin" }
      ]
    },
    "quinton.html": {
      pricingMode: "perPerson",
      variants: [
        { id: "opt1", price: 100, labelKey: "quinton_pkg_1_title", labelFallback: "Option 1" },
        { id: "opt2", price: 110, labelKey: "quinton_pkg_2_title", labelFallback: "Option 2" },
        { id: "opt3", price: 130, labelKey: "quinton_pkg_3_title", labelFallback: "Option 3" }
      ]
    },
    "historic-lasliebres.html": {
      pricingMode: "perPerson",
      variants: [
        { id: "casco_tasting", price: 85, labelKey: "hist_lieb_pkg_tasting_label", labelFallback: "Historic + tasting" },
        { id: "casco_lunch_vinedo", price: 105, labelKey: "hist_lieb_pkg_lunch_vinedo_label", labelFallback: "Historic + Viñedo lunch" },
        { id: "casco_lunch_ceibo", price: 120, labelKey: "hist_lieb_pkg_lunch_ceibo_label", labelFallback: "Historic + Ceibo lunch" }
      ]
    },
    "lasliebres-dining.html": {
      pricingMode: "perPerson",
      variants: [
        { id: "lunch_vinedo", price: 75, labelKey: "liebres_dining_pkg_lunch_vinedo_label", labelFallback: "Lunch Viñedo" },
        { id: "lunch_ceibo", price: 90, labelKey: "liebres_dining_pkg_lunch_ceibo_label", labelFallback: "Lunch Ceibo" },
        { id: "dinner_vinedo", price: 75, labelKey: "liebres_dining_pkg_dinner_vinedo_label", labelFallback: "Dinner Viñedo" },
        { id: "dinner_ceibo", price: 90, labelKey: "liebres_dining_pkg_dinner_ceibo_label", labelFallback: "Dinner Ceibo" }
      ]
    },
    "barbot.html": {
      pricingMode: "perPerson",
      variants: [
        { id: "classic", price: 35, labelKey: "barbot_tour_tier_classic", labelFallback: "Classics x4" },
        { id: "premium", price: 45, labelKey: "barbot_tour_tier_premium", labelFallback: "Premium tasting" },
        { id: "brewmaster", price: 65, labelKey: "barbot_tour_tier_brewmaster", labelFallback: "Brewmaster" }
      ]
    },
    "barbot-brewpub.html": {
      pricingMode: "perPerson",
      variants: [
        { id: "opt_45", price: 45, labelKey: "pkg_builder_opt_usd_45", labelFallback: "USD 45" },
        { id: "opt_55", price: 55, labelKey: "pkg_builder_opt_usd_55", labelFallback: "USD 55" }
      ]
    },
    "asado-boat.html": {
      pricingMode: "perPerson",
      variants: [
        { id: "opt_60", price: 60, labelKey: "asado_boat_tier_std_line", labelFallback: "Standard — USD 60" },
        { id: "opt_80", price: 80, labelKey: "asado_boat_tier_prm_line", labelFallback: "Premium — USD 80" }
      ]
    },
    "walking-asado.html": {
      pricingMode: "perPerson",
      variants: [
        { id: "opt_60", price: 60, labelKey: "asado_boat_tier_std_line", labelFallback: "Standard — USD 60" },
        { id: "opt_80", price: 80, labelKey: "asado_boat_tier_prm_line", labelFallback: "Premium — USD 80" }
      ]
    },
    "plaza1.html": {
      pricingMode: "group",
      variants: [
        { id: "anita_1", price: 80, labelKey: "plaza_anita_pkg_1_title", labelFallback: "For 1 person" },
        { id: "anita_2", price: 160, labelKey: "plaza_anita_pkg_2_title", labelFallback: "For 2 people" }
      ]
    },
    "walkingtour.html": {
      pricingMode: "perPerson",
      variants: [
        { id: "lang_es", price: 15, labelKey: "walking_price_lang_es", labelFallback: "Spanish guide" },
        { id: "lang_en", price: 20, labelKey: "walking_price_lang_en", labelFallback: "English guide" },
        { id: "lang_pt", price: 20, labelKey: "walking_price_lang_pt", labelFallback: "Portuguese guide" }
      ]
    },
    "mision-night.html": {
      pricingMode: "perNight",
      variants: [{ id: "night", price: 115, labelKey: "home_card_price_per_night", labelFallback: "per night" }]
    },
    "sio-night.html": {
      pricingMode: "perNight",
      variants: [{ id: "night", price: 115, labelKey: "home_card_price_per_night", labelFallback: "per night" }]
    },
    "corporate-boat.html": {
      pricingMode: "group",
      variants: [{ id: "charter", price: 150, labelKey: "pkg_builder_group_rate", labelFallback: "Group rate" }]
    }
  };

  /** Single-rate activities from home-card prices (per person unless overridden). */
  const SINGLE_PER_PERSON = [
    ["cabal.html", 40],
    ["mate.html", 40],
    ["traslado-plaza-letras.html", 50],
    ["chivito.html", 40],
    ["food1.html", 55],
    ["bike.html", 60],
    ["bruma.html", 50],
    ["fullday-colonia.html", 90],
    ["lasliebres.html", 85],
    ["sio.html", 70],
    ["romantic.html", 70],
    ["sunset-boat.html", 40]
  ];

  SINGLE_PER_PERSON.forEach(([slug, price]) => {
    if (!BY_SLUG[slug]) {
      BY_SLUG[slug] = {
        pricingMode: "perPerson",
        variants: [{ id: "standard", price, labelKey: "pkg_builder_standard_option", labelFallback: "Standard" }]
      };
    }
  });

  function getSpec(slug) {
    return BY_SLUG[slug] || null;
  }

  function defaultVariant(spec) {
    if (!spec || !spec.variants.length) return null;
    return [...spec.variants].sort((a, b) => a.price - b.price)[0];
  }

  function resolveVariant(spec, variantId) {
    if (!spec) return null;
    return spec.variants.find((v) => v.id === variantId) || defaultVariant(spec);
  }

  /**
   * Line subtotal for one selected experience.
   * @param {string} slug
   * @param {string|null} variantId
   * @param {number} guests
   */
  function lineSubtotal(slug, variantId, guests) {
    const spec = getSpec(slug);
    const g = Math.max(1, Number(guests) || 1);
    if (!spec) {
      const home = window.__SACRAMENTO_HOME_CARD_PRICING__;
      const min = home?.minUsdForSlug?.(slug);
      if (min == null) return 0;
      if (home.isPromoSlug?.(slug)) return 0;
      if (home.isLodgingSlug?.(slug) || home.isGroupUnitSlug?.(slug)) return min;
      return min * g;
    }
    const variant = resolveVariant(spec, variantId);
    if (!variant) return 0;
    if (spec.pricingMode === "perPerson") return variant.price * g;
    return variant.price;
  }

  function entryDisplayPrice(slug) {
    const spec = getSpec(slug);
    if (spec?.variants?.length) {
      return Math.min(...spec.variants.map((v) => v.price));
    }
    return window.__SACRAMENTO_HOME_CARD_PRICING__?.minUsdForSlug?.(slug) ?? null;
  }

  window.__SACRAMENTO_PACKAGE_BUILDER_PRICING__ = {
    bySlug: BY_SLUG,
    getSpec,
    defaultVariant,
    resolveVariant,
    lineSubtotal,
    entryDisplayPrice
  };
})();

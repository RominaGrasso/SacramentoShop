/**
 * aftertour.html — gastronomy experiences without overnight stay.
 */
(function () {
  const STAY_PACKAGE_HREF = /(?:mision-night|sio-night|toros-night|fullday\d)\.html/i;
  const EXCLUDED_HREF = /corporate-boat\.html/i;

  function cardExploreHref(card) {
    const link = card.querySelector(".card-buttons a.btn[href*='Actividades/']");
    return (link?.getAttribute("href") || "").trim();
  }

  function shouldIncludeAfterTourCard(card) {
    if (card.hasAttribute("hidden")) return false;
    if (card.hasAttribute("data-temporarily-hidden")) return false;

    const tokens = (card.dataset.category || "").trim().split(/\s+/).filter(Boolean);
    if (!tokens.includes("gastronomy")) return false;

    const href = cardExploreHref(card);
    if (href && STAY_PACKAGE_HREF.test(href)) return false;
    if (href && EXCLUDED_HREF.test(href)) return false;

    return true;
  }

  window.sacramentoCategoryLanding.init({
    sectionId: "aftertour-experiences",
    cardIdPrefix: "aftertour",
    shouldIncludeCard: shouldIncludeAfterTourCard,
    errorMessageKey: "aftertour_page_load_error",
    errorLinkKey: "aftertour_page_home_link",
    loadingClass: "aftertour-experiences-loading",
    fallbackClass: "aftertour-experiences-fallback",
  });
})();

/**
 * day.html — all home experiences tagged "day".
 */
(function () {
  function shouldIncludeDayCard(card) {
    if (card.hasAttribute("hidden")) return false;
    if (card.hasAttribute("data-temporarily-hidden")) return false;
    const tokens = (card.dataset.category || "").trim().split(/\s+/).filter(Boolean);
    return tokens.includes("day");
  }

  window.sacramentoCategoryLanding.init({
    sectionId: "day-experiences",
    cardIdPrefix: "day",
    shouldIncludeCard: shouldIncludeDayCard,
    errorMessageKey: "day_page_load_error",
    errorLinkKey: "day_page_home_link",
    loadingClass: "day-experiences-loading",
    fallbackClass: "day-experiences-fallback",
  });
})();

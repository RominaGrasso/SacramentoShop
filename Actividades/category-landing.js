/**
 * Shared loader for category landing pages (day.html, aftertour.html, …).
 */
(function () {
  const HOME_CARDS_URL = "../Home/index.html";
  const SOON_BTN_SELECTOR =
    "#homeLupajackExploreBtn, #homeMateAsadoExploreBtn, #homePlazaExploreBtn";

  function initCarousels(root) {
    root.querySelectorAll(".carousel").forEach((carousel) => {
      const track = carousel.querySelector(".carousel-track");
      if (!track) return;
      const slides = track.querySelectorAll("img, video");
      const prevBtn = carousel.querySelector(".prev");
      const nextBtn = carousel.querySelector(".next");
      if (!prevBtn || !nextBtn || !slides.length) return;

      let slideIndex = 0;
      const update = () => {
        track.style.transform = `translateX(-${slideIndex * 100}%)`;
      };

      nextBtn.addEventListener("click", () => {
        slideIndex = (slideIndex + 1) % slides.length;
        update();
      });

      prevBtn.addEventListener("click", () => {
        slideIndex = (slideIndex - 1 + slides.length) % slides.length;
        update();
      });
    });
  }

  function initCardInfoToggles(root) {
    root.querySelectorAll(".card-info-toggle").forEach((btn) => {
      const panelId = btn.getAttribute("aria-controls");
      if (!panelId) return;
      const panel = document.getElementById(panelId);
      if (!panel) return;

      btn.addEventListener("click", () => {
        const expanded = btn.getAttribute("aria-expanded") === "true";
        if (expanded) {
          panel.setAttribute("hidden", "");
          btn.setAttribute("aria-expanded", "false");
        } else {
          panel.removeAttribute("hidden");
          btn.setAttribute("aria-expanded", "true");
          if (typeof window.sacramentoMountCardMetaIcons === "function") {
            window.sacramentoMountCardMetaIcons();
          }
        }
      });
    });
  }

  function initSeeMore(root) {
    const lang = localStorage.getItem("selectedLanguage") || "en";
    const dict =
      window.__SACRAMENTO_TRANSLATIONS?.[lang] ||
      window.__SACRAMENTO_TRANSLATIONS?.en ||
      {};

    root.querySelectorAll(".card").forEach((card) => {
      const text = card.querySelector(".card-description");
      const btn = card.querySelector(".see-more");
      if (!text || !btn) return;

      setTimeout(() => {
        const isClamped = text.scrollHeight > text.clientHeight + 5;
        if (!isClamped) btn.style.display = "none";
      }, 100);

      btn.addEventListener("click", () => {
        const expanded = text.classList.toggle("expanded");
        btn.textContent = expanded
          ? dict.historic_see_less || "See less"
          : dict.historic_see_more || "See more";
      });
    });
  }

  function openSoonPopup() {
    const overlay = document.getElementById("popupLupajackSoon");
    if (!overlay) return;
    overlay.classList.add("active");
    overlay.setAttribute("aria-hidden", "false");
  }

  function closeSoonPopup() {
    const overlay = document.getElementById("popupLupajackSoon");
    if (!overlay) return;
    overlay.classList.remove("active");
    overlay.setAttribute("aria-hidden", "true");
  }

  function initSoonPopupChrome() {
    const overlay = document.getElementById("popupLupajackSoon");
    if (!overlay || overlay.dataset.landingSoonBound === "1") return;
    overlay.dataset.landingSoonBound = "1";

    document.getElementById("closeLupajackSoonPopup")?.addEventListener("click", closeSoonPopup);
    document.getElementById("lupajackSoonPopupOk")?.addEventListener("click", closeSoonPopup);
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) closeSoonPopup();
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && overlay.classList.contains("active")) closeSoonPopup();
    });
  }

  function initSoonExplore(root) {
    root.querySelectorAll(SOON_BTN_SELECTOR).forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        openSoonPopup();
      });
    });

    root.querySelectorAll(".card").forEach((card) => {
      const exploreSoonBtn = card.querySelector(SOON_BTN_SELECTOR);
      const imageContainer = card.querySelector(".card-image");
      if (!imageContainer || !exploreSoonBtn) return;

      imageContainer.style.cursor = "pointer";
      imageContainer.addEventListener("click", (e) => {
        if (e.target.closest(".carousel-btn")) return;
        if (e.target.closest(".discount-badge")) return;
        e.preventDefault();
        openSoonPopup();
      });
    });
  }

  function sanitizeClonedCard(card, index, idPrefix) {
    card.removeAttribute("id");
    const toggle = card.querySelector(".card-info-toggle");
    const panel = card.querySelector(".card-meta-details");
    if (toggle && panel) {
      const panelId = `${idPrefix}-card-${index}-meta`;
      panel.id = panelId;
      toggle.setAttribute("aria-controls", panelId);
    }
    return card;
  }

  function applyLanguage() {
    const lang = localStorage.getItem("selectedLanguage") || "en";
    if (typeof window.sacramentoSetLanguage === "function") {
      window.sacramentoSetLanguage(lang);
    }
  }

  async function loadCards(config) {
    const section = document.getElementById(config.sectionId);
    if (!section) return;

    const loadingClass = config.loadingClass || "category-landing-loading";
    const fallbackClass = config.fallbackClass || "category-landing-fallback";

    try {
      const res = await fetch(HOME_CARDS_URL);
      if (!res.ok) throw new Error("fetch failed");
      const html = await res.text();
      const doc = new DOMParser().parseFromString(html, "text/html");
      const sourceCards = doc.querySelectorAll("#experiences .card");

      section.innerHTML = "";
      let count = 0;
      const idPrefix = config.cardIdPrefix || "landing";

      sourceCards.forEach((card) => {
        if (typeof config.shouldIncludeCard !== "function" || !config.shouldIncludeCard(card)) {
          return;
        }
        section.appendChild(sanitizeClonedCard(card.cloneNode(true), count, idPrefix));
        count += 1;
      });

      if (count === 0) throw new Error("no cards");

      initCarousels(section);
      initCardInfoToggles(section);
      initSeeMore(section);
      initSoonExplore(section);
      applyLanguage();
    } catch {
      const lang = localStorage.getItem("selectedLanguage") || "en";
      const dict = window.__SACRAMENTO_TRANSLATIONS?.[lang] || window.__SACRAMENTO_TRANSLATIONS?.en || {};
      const msg =
        dict[config.errorMessageKey] ||
        "Could not load experiences. View all on the home page.";
      const linkLabel = dict[config.errorLinkKey] || "home page";
      section.innerHTML = `<p class="${fallbackClass}">${msg} <a href="../Home/index.html">${linkLabel}</a>.</p>`;
      applyLanguage();
    }
  }

  window.sacramentoCategoryLanding = {
    init(config) {
      document.addEventListener("DOMContentLoaded", () => {
        initSoonPopupChrome();
        loadCards(config);
      });
    },
  };
})();

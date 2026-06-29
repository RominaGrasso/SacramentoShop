(function () {
  "use strict";

  /** Set your Google reviews URL here when ready (Maps / Business Profile). */
  const GOOGLE_REVIEWS_URL = "";

  const REVIEWS_JSON_URL = "data/google-reviews.json";
  const AUTOPLAY_MS = 6000;
  const REVIEW_PREVIEW_MAX_CHARS =
    "Destacable la atención del equipo. Hicimos la visita guiada a la Cervecería Barbot y todo salió de 10. Súper recomendable.".length;

  const FALLBACK_REVIEWS = [
    {
      id: "maria_mp",
      name: "Maria MP",
      rating: 5,
      text: "Recomendable al 100% y excelente la atención desde el proceso de reserva hasta el final del tour. Mi guía, Adrián, fue muy bueno explicando, manteniendo el interés y contestando a preguntas. Definitivamente tengo mayor conocimiento de la ciudad y el país gracias al tour. Además, recomiendo acompañarlo con la experiencia del mate que da una oportunidad excelente para conversar en un ambiente distendido y conocer más."
    },
    {
      id: "carlos_tomezzoli",
      name: "Carlos Tomezzoli",
      rating: 5,
      text: "Destacable la atención del equipo. Hicimos la visita guiada a la Cervecería Barbot y todo salió de 10. Súper recomendable."
    },
    {
      id: "karina_schillaci",
      name: "Karina Schillaci Pacheco",
      rating: 5,
      text: "Hicimos un tour guiado con Alan y estuvo súper interesante y divertido. ¡Recomendado!"
    },
    {
      id: "ema_sefcikova",
      name: "Ema Sefcikova",
      rating: 5,
      text: "Adrian was a very friendly and engaging guide. He took us to all the significant landmarks, explaining Uruguay's history and culture. He even brought a Maté with him to show us!"
    },
    {
      id: "nahuel_valles",
      name: "Nahuel Valles",
      rating: 5,
      text: "¡Atención súper buena! Muy amables, tanto en WhatsApp como en persona. Se nota la pasión e ilusión. Vale la pena totalmente para conocer la historia de la ciudad y encima con un precio muy competitivo."
    },
    {
      id: "dante_zanotta",
      name: "Dante Zanotta",
      rating: 5,
      text: "Excelente experiencia vivida hoy en Colonia del Sacramento. No saqué fotos porque estaba con termo y mate, y para no perderme de cada detalle."
    },
    {
      id: "l_franklin_young",
      name: "L Franklin Young",
      rating: 5,
      text: "OMG loved this tour! I've visited Colonia a few times before, but am here for the first time with my sister. We wanted to do a walking tour of the city. I happened to notice a dog wearing a Sacramento Adventures vest the other day, did a Google search and found this wonderful company.\n\nAdrian was super knowledgeable, fun, and polite and ELA, our furry guide, was super enjoyable to host us (we were one of her first customers!!).\n\nWhat a great idea to combine a walking tour with fur babies!\n\nThe idea is incredible and Romina and her team member Adrian were fun to work with ❤️\n\nWe'll be recommending to anyone who visits!"
    }
  ];

  const t = (key, fallback) => {
    const lang =
      typeof window.getInitialLanguage === "function"
        ? window.getInitialLanguage().toLowerCase()
        : "en";
    const dict = window.__SACRAMENTO_TRANSLATIONS || {};
    return dict?.[lang]?.[key] || dict?.en?.[key] || fallback;
  };

  const escapeHtml = (value) =>
    String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");

  const renderStars = (rating) => {
    const safe = Math.max(0, Math.min(5, Math.floor(Number(rating) || 0)));
    return "★".repeat(safe);
  };

  const AVATAR_COLORS = [
    ["#5a98db", "#3f7fc4"],
    ["#2f67a3", "#244f7d"],
    ["#6ea8e5", "#4c8fd4"],
    ["#1f7a8c", "#2aa198"],
    ["#c97b63", "#b06852"],
    ["#7c6cb3", "#6558a0"]
  ];

  const getAvatarInitial = (name) => {
    const trimmed = String(name || "").trim();
    if (!trimmed) return "?";
    return trimmed.charAt(0).toUpperCase();
  };

  const getAvatarStyle = (name) => {
    const source = String(name || "A");
    let hash = 0;
    for (let i = 0; i < source.length; i += 1) {
      hash = (hash + source.charCodeAt(i)) % AVATAR_COLORS.length;
    }
    const [from, to] = AVATAR_COLORS[hash];
    return `background: linear-gradient(135deg, ${from}, ${to});`;
  };

  const getReviewId = (review, index) => {
    const id = String(review?.id || "").trim();
    if (id) return id;
    return `review_${index}`;
  };

  const getLocalizedReviewText = (review, index) => {
    const id = getReviewId(review, index);
    const key = `home_review_text_${id}`;
    return t(key, review.text || "");
  };

  const truncateReviewText = (text, maxChars) => {
    const normalized = String(text || "").trim();
    if (normalized.length <= maxChars) {
      return { preview: normalized, isTruncated: false };
    }
    let cut = normalized.slice(0, maxChars);
    const lastSpace = cut.lastIndexOf(" ");
    if (lastSpace > maxChars * 0.55) {
      cut = cut.slice(0, lastSpace);
    }
    return { preview: `${cut.trim()}…`, isTruncated: true };
  };

  const getVisibleCount = () => {
    if (window.matchMedia("(min-width: 1024px)").matches) return 3;
    if (window.matchMedia("(min-width: 640px)").matches) return 2;
    return 1;
  };

  async function loadReviews() {
    try {
      const res = await fetch(REVIEWS_JSON_URL, { cache: "no-cache" });
      if (!res.ok) throw new Error("fetch failed");
      const data = await res.json();
      if (!Array.isArray(data) || data.length === 0) throw new Error("empty");
      return data.filter((r) => r && r.name && r.text);
    } catch {
      return FALLBACK_REVIEWS.slice();
    }
  }

  function buildReviewCard(review, index, expandedIds) {
    const reviewId = getReviewId(review, index);
    const fullText = getLocalizedReviewText(review, index);
    const isExpanded = expandedIds.has(reviewId);
    const { preview, isTruncated } = truncateReviewText(fullText, REVIEW_PREVIEW_MAX_CHARS);
    const showToggle = isTruncated;
    const displayText = isExpanded || !isTruncated ? fullText : preview;

    const article = document.createElement("article");
    article.className = "home-google-reviews__card";
    article.dataset.reviewId = reviewId;

    const header = document.createElement("header");
    header.className = "home-google-reviews__card-header";
    header.innerHTML = `
      <div class="home-google-reviews__avatar" style="${getAvatarStyle(review.name)}" aria-hidden="true">${escapeHtml(getAvatarInitial(review.name))}</div>
      <div class="home-google-reviews__meta">
        <p class="home-google-reviews__name">${escapeHtml(review.name)}</p>
        <p class="home-google-reviews__stars" aria-label="${escapeHtml(renderStars(review.rating))}">${renderStars(review.rating)}</p>
      </div>
    `;

    const textEl = document.createElement("p");
    textEl.className = "home-google-reviews__text";
    textEl.textContent = displayText;

    article.appendChild(header);
    article.appendChild(textEl);

    if (showToggle) {
      const toggleBtn = document.createElement("button");
      toggleBtn.type = "button";
      toggleBtn.className = "home-google-reviews__read-more";
      toggleBtn.textContent = isExpanded
        ? t("home_reviews_read_less", "Read less")
        : t("home_reviews_read_more", "Read more");
      toggleBtn.addEventListener("click", () => {
        if (expandedIds.has(reviewId)) {
          expandedIds.delete(reviewId);
        } else {
          expandedIds.add(reviewId);
        }
        textEl.textContent = expandedIds.has(reviewId) ? fullText : preview;
        toggleBtn.textContent = expandedIds.has(reviewId)
          ? t("home_reviews_read_less", "Read less")
          : t("home_reviews_read_more", "Read more");
      });
      article.appendChild(toggleBtn);
    }

    return article;
  }

  function initGoogleReviewsSection(root, reviews) {
    const track = root.querySelector(".home-google-reviews__track");
    const viewport = root.querySelector(".home-google-reviews__viewport");
    const prevBtn = root.querySelector(".home-google-reviews__arrow--prev");
    const nextBtn = root.querySelector(".home-google-reviews__arrow--next");
    const dotsHost = root.querySelector(".home-google-reviews__dots");
    const cta = root.querySelector(".home-google-reviews__cta");
    const expandedIds = new Set();

    if (!track || !viewport || !prevBtn || !nextBtn || !dotsHost) return;

    const renderCards = () => {
      track.replaceChildren();
      reviews.forEach((review, index) => {
        track.appendChild(buildReviewCard(review, index, expandedIds));
      });
      update();
    };

    if (cta) {
      const url = String(GOOGLE_REVIEWS_URL || "").trim();
      if (url) {
        cta.href = url;
        cta.removeAttribute("aria-disabled");
      } else {
        cta.href = "#";
        cta.setAttribute("aria-disabled", "true");
      }
    }

    let index = 0;
    let visible = getVisibleCount();
    let autoplayId = null;
    let paused = false;
    let touchActive = false;

    const maxIndex = () => Math.max(0, reviews.length - visible);

    const syncCardWidths = () => {
      const gap = parseFloat(getComputedStyle(track).gap) || 0;
      const viewportWidth = viewport.clientWidth;
      const cardWidth = visible > 0 ? (viewportWidth - gap * (visible - 1)) / visible : viewportWidth;
      track.querySelectorAll(".home-google-reviews__card").forEach((card) => {
        card.style.flexBasis = `${cardWidth}px`;
        card.style.maxWidth = `${cardWidth}px`;
      });
    };

    const renderDots = () => {
      dotsHost.replaceChildren();
      const total = maxIndex() + 1;
      for (let i = 0; i < total; i += 1) {
        const dot = document.createElement("button");
        dot.type = "button";
        dot.className = "home-google-reviews__dot";
        dot.setAttribute("aria-label", `${i + 1} / ${total}`);
        if (i === index) dot.classList.add("is-active");
        dot.addEventListener("click", () => {
          index = i;
          update();
          restartAutoplay();
        });
        dotsHost.appendChild(dot);
      }
    };

    const update = () => {
      index = Math.max(0, Math.min(index, maxIndex()));
      syncCardWidths();
      const firstCard = track.querySelector(".home-google-reviews__card");
      const gap = parseFloat(getComputedStyle(track).gap) || 0;
      const step = firstCard ? firstCard.offsetWidth + gap : 0;
      track.style.transform = `translate3d(-${index * step}px, 0, 0)`;
      dotsHost.querySelectorAll(".home-google-reviews__dot").forEach((dot, i) => {
        dot.classList.toggle("is-active", i === index);
      });
    };

    const goNext = () => {
      index = index >= maxIndex() ? 0 : index + 1;
      update();
    };

    const goPrev = () => {
      index = index <= 0 ? maxIndex() : index - 1;
      update();
    };

    const stopAutoplay = () => {
      if (autoplayId) {
        window.clearInterval(autoplayId);
        autoplayId = null;
      }
    };

    const startAutoplay = () => {
      stopAutoplay();
      if (paused || touchActive) return;
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      autoplayId = window.setInterval(goNext, AUTOPLAY_MS);
    };

    const restartAutoplay = () => {
      stopAutoplay();
      startAutoplay();
    };

    prevBtn.addEventListener("click", () => {
      goPrev();
      restartAutoplay();
    });

    nextBtn.addEventListener("click", () => {
      goNext();
      restartAutoplay();
    });

    root.addEventListener("mouseenter", () => {
      paused = true;
      stopAutoplay();
    });

    root.addEventListener("mouseleave", () => {
      paused = false;
      startAutoplay();
    });

    root.addEventListener(
      "touchstart",
      () => {
        touchActive = true;
        stopAutoplay();
      },
      { passive: true }
    );

    root.addEventListener(
      "touchend",
      () => {
        touchActive = false;
        startAutoplay();
      },
      { passive: true }
    );

    if (cta) {
      cta.addEventListener("click", (ev) => {
        if (!String(GOOGLE_REVIEWS_URL || "").trim()) ev.preventDefault();
      });
    }

    const onResize = () => {
      const nextVisible = getVisibleCount();
      if (nextVisible !== visible) {
        visible = nextVisible;
        index = Math.min(index, maxIndex());
        renderDots();
      }
      update();
    };

    window.addEventListener("resize", onResize);

    document.addEventListener("sacramento:setLanguage", () => {
      renderCards();
    });

    visible = getVisibleCount();
    renderDots();
    renderCards();
    startAutoplay();
  }

  async function boot() {
    const section = document.getElementById("home-google-reviews");
    if (!section) return;
    const reviews = await loadReviews();
    initGoogleReviewsSection(section, reviews);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    void boot();
  }
})();

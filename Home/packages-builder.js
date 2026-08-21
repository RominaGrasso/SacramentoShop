/**
 * Packages page: "Armá tu paquete" builder modal.
 * Experiences come from Home/index.html cards; pricing from packages-builder-pricing.js.
 */
(function () {
  if (!document.body.classList.contains("page-paquetes")) return;

  const WHATSAPP_NUMBER = "59898945542";
  const HOME_HTML_URL = "../Home/index.html";
  const MOBILE_LIST_MQ = "(max-width: 899px)";
  const MOBILE_LIST_PREVIEW = 4;
  const SKIP_SLUGS = new Set([
    "hotel-royal.html",
    "candombe.html",
    "aboutus.html",
    "fullday1.html",
    "fullday2.html",
    "fullday3.html",
    "fullday4.html"
  ]);

  const state = {
    guests: 2,
    /** @type {Map<string, { variantId: string }>} */
    selected: new Map(),
    /** @type {Array<{ slug: string, title: string, titleKey: string, image: string, description: string, descKey: string }>} */
    experiences: [],
    loaded: false,
    listExpanded: false
  };

  let modalApi = null;

  function getActiveLanguage() {
    if (typeof window.getSiteLanguage === "function") return window.getSiteLanguage();
    if (window.__SACRAMENTO_ACTIVE_LANG__) return window.__SACRAMENTO_ACTIVE_LANG__;
    if (typeof window.getInitialLanguage === "function") return window.getInitialLanguage();
    return "es";
  }

  function t(key, fallback) {
    const lang = getActiveLanguage();
    const table = window.__SACRAMENTO_TRANSLATIONS || {};
    const raw = table[lang]?.[key] || table.en?.[key] || table.es?.[key] || fallback || key;
    return String(raw).replace(/<br\s*\/?>/gi, " ").replace(/<[^>]+>/g, "").trim();
  }

  function pricing() {
    return window.__SACRAMENTO_PACKAGE_BUILDER_PRICING__;
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function formatUsd(amount) {
    const n = Math.round(Number(amount) || 0);
    return String(n);
  }

  function resolveAssetUrl(src) {
    if (!src) return "";
    if (/^https?:\/\//i.test(src) || src.startsWith("data:")) return src;
    if (src.startsWith("../")) return src;
    if (src.startsWith("/")) return `..${src}`;
    if (src.startsWith("Assets/") || src.startsWith("assets/")) return `../${src}`;
    return src;
  }

  function cardIsActive(card) {
    if (!card || !card.classList.contains("card")) return false;
    if (card.hasAttribute("hidden")) return false;
    if (card.getAttribute("data-temporarily-hidden") === "true") return false;
    if (card.classList.contains("card--hidden-until-boat-returns")) return false;
    if (card.classList.contains("card--hidden-sunset-boat")) return false;
    const style = card.getAttribute("style") || "";
    if (/display\s*:\s*none/i.test(style)) return false;
    return true;
  }

  function slugFromCard(card) {
    const links = card.querySelectorAll(".card-buttons a[href]");
    for (const link of links) {
      const href = String(link.getAttribute("href") || "");
      const match = href.match(/(?:^|[/\\])actividades[/\\]([^/?#]+)/i);
      if (match?.[1]) {
        const base = match[1].toLowerCase();
        return base.endsWith(".html") ? base : `${base}.html`;
      }
    }
    return "";
  }

  function parseExperiencesFromHomeHtml(html) {
    const doc = new DOMParser().parseFromString(html, "text/html");
    const root = doc.getElementById("experiences") || doc.body;
    const cards = Array.from(root.querySelectorAll(".card"));
    const list = [];
    const seen = new Set();

    cards.forEach((card) => {
      if (!cardIsActive(card)) return;
      const slug = slugFromCard(card);
      if (!slug || SKIP_SLUGS.has(slug) || seen.has(slug)) return;
      if (window.__SACRAMENTO_HOME_CARD_PRICING__?.isPromoSlug?.(slug)) return;

      const titleEl = card.querySelector("h3");
      const descEl = card.querySelector(".card-description");
      const imgEl =
        card.querySelector(".carousel-track img[src]") ||
        card.querySelector(".card-image img[src]");
      const titleKey = titleEl?.getAttribute("data-translate") || "";
      const descKey = descEl?.getAttribute("data-translate") || "";
      const title = (titleEl?.textContent || "").replace(/\s+/g, " ").trim();
      const description = (descEl?.textContent || "").replace(/\s+/g, " ").trim();
      const image = resolveAssetUrl(imgEl?.getAttribute("src") || "");

      if (!title && !titleKey) return;
      seen.add(slug);
      list.push({ slug, title, titleKey, image, description, descKey });
    });

    return list;
  }

  async function loadExperiences() {
    if (state.loaded && state.experiences.length) return state.experiences;
    try {
      const res = await fetch(HOME_HTML_URL, { credentials: "same-origin" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const html = await res.text();
      state.experiences = parseExperiencesFromHomeHtml(html);
      state.loaded = true;
    } catch (err) {
      console.warn("[packages-builder] Could not load home experiences", err);
      state.experiences = [];
      state.loaded = true;
    }
    return state.experiences;
  }

  function experienceTitle(exp) {
    if (exp.titleKey) {
      const translated = t(exp.titleKey, exp.title);
      if (translated && translated !== exp.titleKey) return translated;
    }
    return exp.title || exp.slug;
  }

  function experienceDesc(exp) {
    if (exp.descKey) {
      const translated = t(exp.descKey, exp.description);
      if (translated && translated !== exp.descKey) return translated;
    }
    return exp.description || "";
  }

  function variantLabel(variant) {
    if (!variant) return "";
    return t(variant.labelKey, variant.labelFallback || variant.id);
  }

  function lineAmount(slug, variantId) {
    return pricing()?.lineSubtotal?.(slug, variantId, state.guests) || 0;
  }

  function totalEstimated() {
    let sum = 0;
    state.selected.forEach((sel, slug) => {
      sum += lineAmount(slug, sel.variantId);
    });
    return sum;
  }

  function ensureSelectionVariant(slug) {
    const spec = pricing()?.getSpec?.(slug);
    const def = pricing()?.defaultVariant?.(spec);
    if (!state.selected.has(slug)) {
      state.selected.set(slug, { variantId: def?.id || "standard" });
    } else if (spec) {
      const cur = state.selected.get(slug);
      const resolved = pricing().resolveVariant(spec, cur.variantId);
      if (resolved && resolved.id !== cur.variantId) {
        state.selected.set(slug, { variantId: resolved.id });
      }
    }
  }

  function toggleExperience(slug) {
    if (state.selected.has(slug)) {
      state.selected.delete(slug);
    } else {
      ensureSelectionVariant(slug);
    }
    renderAll();
  }

  function setVariant(slug, variantId) {
    if (!state.selected.has(slug)) return;
    state.selected.set(slug, { variantId });
    renderAll();
  }

  function setGuests(next) {
    const n = Math.min(20, Math.max(1, Number(next) || 1));
    state.guests = n;
    const input = document.getElementById("pkgBuilderGuestsValue");
    if (input) input.textContent = String(n);
    renderAll();
  }

  function isMobileListViewport() {
    return window.matchMedia(MOBILE_LIST_MQ).matches;
  }

  function syncExperienceListCollapse() {
    const listEl = document.getElementById("pkgBuilderExperienceList");
    const moreBtn = document.getElementById("pkgBuilderMoreBtn");
    if (!listEl || !moreBtn) return;

    const mobile = isMobileListViewport();
    const needsToggle = mobile && state.experiences.length > MOBILE_LIST_PREVIEW;

    if (!needsToggle) {
      listEl.classList.remove("is-collapsed");
      moreBtn.hidden = true;
      moreBtn.setAttribute("aria-expanded", "true");
      return;
    }

    const collapsed = !state.listExpanded;
    listEl.classList.toggle("is-collapsed", collapsed);
    moreBtn.hidden = false;
    moreBtn.setAttribute("aria-expanded", collapsed ? "false" : "true");
    moreBtn.textContent = collapsed
      ? t("pkg_builder_show_more", "View more experiences")
      : t("pkg_builder_show_less", "Show less");
  }

  function renderExperienceCards() {
    const listEl = document.getElementById("pkgBuilderExperienceList");
    if (!listEl) return;

    if (!state.experiences.length) {
      listEl.innerHTML = `<p class="pkg-builder__empty">${escapeHtml(
        t("pkg_builder_load_error", "Could not load experiences. Please refresh the page.")
      )}</p>`;
      syncExperienceListCollapse();
      return;
    }

    listEl.innerHTML = state.experiences
      .map((exp) => {
        const selected = state.selected.has(exp.slug);
        const spec = pricing()?.getSpec?.(exp.slug);
        const sel = state.selected.get(exp.slug);
        const entry = pricing()?.entryDisplayPrice?.(exp.slug);
        const mode = spec?.pricingMode || "perPerson";
        const fromLabel = t("home_card_price_from", "From");
        const unitLabel =
          mode === "group"
            ? t("pkg_builder_per_group", "per group")
            : mode === "perNight"
              ? t("home_card_price_per_night", "per night")
              : t("home_card_price_per_person", "per person");
        const priceText =
          entry != null
            ? `${fromLabel} USD ${formatUsd(entry)} · ${unitLabel}`
            : t("packages_price_consult", "Contact us");

        let variantHtml = "";
        if (selected && spec && spec.variants.length > 1) {
          const options = spec.variants
            .map((v) => {
              const isSel = sel?.variantId === v.id;
              return `<option value="${escapeHtml(v.id)}"${isSel ? " selected" : ""}>${escapeHtml(
                `${variantLabel(v)} — USD ${formatUsd(v.price)}`
              )}</option>`;
            })
            .join("");
          variantHtml = `<label class="pkg-builder-card__variant">
            <span class="pkg-builder-card__variant-lbl">${escapeHtml(
              t("pkg_builder_variant_label", "Option")
            )}</span>
            <select data-pkg-variant="${escapeHtml(exp.slug)}">${options}</select>
          </label>`;
        }

        const desc = experienceDesc(exp);
        const shortDesc = desc.length > 110 ? `${desc.slice(0, 107)}…` : desc;

        return `<article class="pkg-builder-card${selected ? " is-selected" : ""}" data-slug="${escapeHtml(
          exp.slug
        )}">
          <div class="pkg-builder-card__media">
            ${
              exp.image
                ? `<img alt="" class="pkg-builder-card__img" decoding="async" loading="lazy" src="${escapeHtml(
                    exp.image
                  )}"/>`
                : `<div class="pkg-builder-card__img pkg-builder-card__img--placeholder" aria-hidden="true"></div>`
            }
          </div>
          <div class="pkg-builder-card__body">
            <h3 class="pkg-builder-card__title">${escapeHtml(experienceTitle(exp))}</h3>
            <p class="pkg-builder-card__price">${escapeHtml(priceText)}</p>
            ${shortDesc ? `<p class="pkg-builder-card__desc">${escapeHtml(shortDesc)}</p>` : ""}
            ${variantHtml}
            <button class="btn pkg-builder-card__toggle${selected ? " is-added" : ""}" data-pkg-toggle="${escapeHtml(
              exp.slug
            )}" type="button">
              ${escapeHtml(
                selected
                  ? t("pkg_builder_added", "Added")
                  : t("pkg_builder_add", "Add")
              )}
            </button>
          </div>
        </article>`;
      })
      .join("");

    syncExperienceListCollapse();
  }

  function removeFromPackage(slug) {
    if (!slug || !state.selected.has(slug)) return;
    state.selected.delete(slug);
    renderAll();
  }

  function syncSendButton() {
    const sendBtn = document.getElementById("pkgBuilderSendBtn");
    if (!sendBtn) return;
    const empty = state.selected.size === 0;
    sendBtn.disabled = empty;
    sendBtn.setAttribute("aria-disabled", empty ? "true" : "false");
    sendBtn.classList.toggle("is-disabled", empty);
  }

  function renderSummary() {
    const summaryEl = document.getElementById("pkgBuilderSummaryBody");
    const totalEl = document.getElementById("pkgBuilderTotalValue");
    const guestsEl = document.getElementById("pkgBuilderSummaryGuests");
    if (guestsEl) {
      guestsEl.textContent = t("pkg_builder_summary_guests", "{n} people").replace(
        "{n}",
        String(state.guests)
      );
    }
    if (!summaryEl) return;

    if (state.selected.size === 0) {
      summaryEl.innerHTML = `<div class="pkg-builder-summary__empty">
        <p class="pkg-builder-summary__empty-title">${escapeHtml(
          t("pkg_builder_empty_title", "Your package is empty.")
        )}</p>
        <p class="pkg-builder-summary__empty-text">${escapeHtml(
          t(
            "pkg_builder_empty_text",
            "Add experiences to start building your itinerary."
          )
        )}</p>
      </div>`;
    } else {
      const lines = [];
      state.selected.forEach((sel, slug) => {
        const exp = state.experiences.find((e) => e.slug === slug);
        const spec = pricing()?.getSpec?.(slug);
        const variant = pricing()?.resolveVariant?.(spec, sel.variantId);
        const amount = lineAmount(slug, sel.variantId);
        const name = exp ? experienceTitle(exp) : slug;
        const variantText =
          spec && spec.variants.length > 1 && variant
            ? ` – ${variantLabel(variant)}`
            : "";
        const removeLabel = t("pkg_builder_remove_aria", "Remove {name}").replace(
          "{name}",
          name
        );
        lines.push(`<li class="pkg-builder-summary__item">
          <div class="pkg-builder-summary__item-main">
            <span class="pkg-builder-summary__item-name">${escapeHtml(name)}${escapeHtml(
              variantText
            )}</span>
            <div class="pkg-builder-summary__item-meta">
              <span class="pkg-builder-summary__item-price">USD ${escapeHtml(
                formatUsd(amount)
              )}</span>
              <button class="pkg-builder-summary__remove" data-pkg-remove="${escapeHtml(
                slug
              )}" type="button" aria-label="${escapeHtml(removeLabel)}">
                <span aria-hidden="true">&times;</span>
              </button>
            </div>
          </div>
        </li>`);
      });
      summaryEl.innerHTML = `<ul class="pkg-builder-summary__list">${lines.join("")}</ul>`;
    }

    if (totalEl) totalEl.textContent = `USD ${formatUsd(totalEstimated())}`;
    syncSendButton();
  }

  function renderAll() {
    const guestsValue = document.getElementById("pkgBuilderGuestsValue");
    if (guestsValue) guestsValue.textContent = String(state.guests);
    renderExperienceCards();
    renderSummary();
    refreshTranslateAttrs();
  }

  function refreshTranslateAttrs() {
    // Keep data-translate elements on static chrome; dynamic text is via t().
  }

  function buildWhatsAppMessage() {
    const lines = [];
    lines.push(t("pkg_builder_wa_intro", "Hello! I would like to request a personalized proposal for Colonia."));
    lines.push("");
    lines.push(
      `${t("pkg_builder_wa_guests", "Number of people")}: ${state.guests}`
    );
    lines.push("");
    lines.push(t("pkg_builder_wa_selected", "Selected experiences:"));

    if (state.selected.size === 0) {
      lines.push(`- ${t("pkg_builder_summary_empty", "Select experiences to build your package.")}`);
    } else {
      state.selected.forEach((sel, slug) => {
        const exp = state.experiences.find((e) => e.slug === slug);
        const spec = pricing()?.getSpec?.(slug);
        const variant = pricing()?.resolveVariant?.(spec, sel.variantId);
        const amount = lineAmount(slug, sel.variantId);
        const name = exp ? experienceTitle(exp) : slug;
        const variantText =
          spec && spec.variants.length > 1 && variant ? ` – ${variantLabel(variant)}` : "";
        lines.push(`- ${name}${variantText} – USD ${formatUsd(amount)}`);
      });
    }

    lines.push("");
    lines.push(
      `${t("pkg_builder_wa_total", "Estimated total")}: USD ${formatUsd(totalEstimated())}`
    );
    lines.push("");
    lines.push(
      t(
        "pkg_builder_wa_closing",
        "I look forward to hearing about availability and coordination. Thank you!"
      )
    );
    return lines.join("\n");
  }

  function sendProposal(event) {
    if (event) event.preventDefault();
    if (state.selected.size === 0) {
      const listEl = document.getElementById("pkgBuilderExperienceList");
      listEl?.scrollIntoView({ behavior: "smooth", block: "nearest" });
      return;
    }
    const message = buildWhatsAppMessage();
    const pendingTab =
      typeof window.sacramentoOpenWhatsAppBlankTabForGesture === "function"
        ? window.sacramentoOpenWhatsAppBlankTabForGesture()
        : null;
    if (typeof window.sacramentoOpenWhatsApp === "function") {
      window.sacramentoOpenWhatsApp(WHATSAPP_NUMBER, message, pendingTab);
      return;
    }
    const url = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  }

  function bindUi() {
    const overlay = document.getElementById("pkgBuilderModal");
    if (!overlay || typeof window.bindSacramentoModal !== "function") return;

    modalApi = window.bindSacramentoModal({
      overlay,
      closeSelectors: [".close-x", "[data-pkg-builder-close]"]
    });

    document.querySelectorAll("[data-pkg-builder-open]").forEach((btn) => {
      btn.addEventListener("click", async (event) => {
        event.preventDefault();
        state.listExpanded = false;
        await loadExperiences();
        renderAll();
        modalApi?.open();
      });
    });

    document.getElementById("pkgBuilderMoreBtn")?.addEventListener("click", () => {
      state.listExpanded = !state.listExpanded;
      syncExperienceListCollapse();
    });

    window.matchMedia(MOBILE_LIST_MQ).addEventListener("change", () => {
      syncExperienceListCollapse();
    });

    document.getElementById("pkgBuilderGuestsMinus")?.addEventListener("click", () => {
      setGuests(state.guests - 1);
    });
    document.getElementById("pkgBuilderGuestsPlus")?.addEventListener("click", () => {
      setGuests(state.guests + 1);
    });

    overlay.addEventListener("click", (event) => {
      const removeBtn = event.target.closest("[data-pkg-remove]");
      if (removeBtn) {
        event.preventDefault();
        removeFromPackage(removeBtn.getAttribute("data-pkg-remove"));
        return;
      }
      const toggle = event.target.closest("[data-pkg-toggle]");
      if (toggle) {
        event.preventDefault();
        toggleExperience(toggle.getAttribute("data-pkg-toggle"));
        return;
      }
    });

    overlay.addEventListener("change", (event) => {
      const select = event.target.closest("select[data-pkg-variant]");
      if (!select) return;
      setVariant(select.getAttribute("data-pkg-variant"), select.value);
    });

    document.getElementById("pkgBuilderSendBtn")?.addEventListener("click", sendProposal);

    document.addEventListener("sacramento:setLanguage", () => {
      if (modalApi?.isOpen?.()) renderAll();
    });
  }

  function boot() {
    bindUi();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
})();

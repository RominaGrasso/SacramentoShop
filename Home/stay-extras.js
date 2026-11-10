(function () {
  const EXPERIENCES = [
    { id: "walking", key: "stay_extras_exp_walking", fallback: "Walking Tour of the Historic Quarter" },
    { id: "night", key: "stay_extras_exp_night", fallback: "Night Tour of Stories, Secrets and Legends" },
    { id: "winery", key: "stay_extras_exp_winery", fallback: "Winery visit and tasting" },
    { id: "horse", key: "stay_extras_exp_horse", fallback: "Horseback ride" },
    { id: "bike", key: "stay_extras_exp_bike", fallback: "Bike Tour" },
    { id: "mate", key: "stay_extras_exp_mate", fallback: "Mate experience" },
    { id: "other", key: "stay_extras_exp_other", fallback: "Other experience" }
  ];

  const SPARKLE = "\u2728";

  function t(key, fallback) {
    if (typeof window.sacramentoGetI18nText === "function") {
      return window.sacramentoGetI18nText(key, fallback);
    }
    const lang =
      typeof window.getSiteLanguage === "function"
        ? window.getSiteLanguage()
        : typeof window.getInitialLanguage === "function"
          ? window.getInitialLanguage()
          : "en";
    const dict = window.__SACRAMENTO_TRANSLATIONS || {};
    return dict?.[lang]?.[key] || dict?.en?.[key] || fallback;
  }

  function hotelName(root) {
    const key = root?.dataset.hotelNameKey || "";
    const fallback = root?.dataset.hotelName || "Hotel";
    return key ? t(key, fallback) : fallback;
  }

  function experienceCheckboxesHtml() {
    return EXPERIENCES.map((item) => {
      return (
        '<label class="stay-extras__check">' +
        '<input type="checkbox" data-stay-exp="' +
        item.id +
        '" />' +
        '<span data-translate="' +
        item.key +
        '">' +
        item.fallback +
        "</span>" +
        "</label>"
      );
    }).join("");
  }

  function markup() {
    return (
      '<div class="stay-extras" data-stay-extras>' +
      '<button type="button" class="stay-extras__toggle" aria-expanded="false" data-stay-toggle>' +
      '<span class="stay-extras__toggle-main">' +
      '<span class="stay-extras__sparkle" aria-hidden="true">' +
      SPARKLE +
      "</span>" +
      '<span class="stay-extras__toggle-title" data-stay-closed-title data-translate="stay_extras_closed_none">Complete Your Stay (optional)</span>' +
      "</span>" +
      '<span class="stay-extras__chevron" aria-hidden="true">▾</span>' +
      "</button>" +
      '<div class="stay-extras__panel" hidden data-stay-panel>' +
      '<div class="stay-extras__heading">' +
      "<h4>" +
      '<span class="stay-extras__sparkle" aria-hidden="true">' +
      SPARKLE +
      "</span>" +
      '<span data-translate="stay_extras_title">Complete Your Stay</span>' +
      "</h4>" +
      '<span class="stay-extras__optional" data-translate="stay_extras_optional">Optional</span>' +
      "</div>" +
      '<p class="stay-extras__desc" data-translate="stay_extras_desc">In addition to your lodging, we can arrange transfers and experiences in Colonia del Sacramento.</p>' +
      '<p class="stay-extras__summary" hidden data-stay-summary></p>' +
      '<label class="stay-extras__check stay-extras__check--lead">' +
      '<input type="checkbox" data-stay-transfer />' +
      '<span data-translate="stay_extras_transfer_toggle">I want to add a transfer</span>' +
      "</label>" +
      '<div class="stay-extras__transfer" hidden data-stay-transfer-fields>' +
      '<p class="stay-extras__field-label" data-translate="stay_extras_origin_label">Pickup location</p>' +
      '<div class="stay-extras__radios">' +
      '<label class="stay-extras__check"><input type="radio" name="stayOrigin" value="port" checked /><span data-translate="stay_extras_origin_port">Colonia port</span></label>' +
      '<label class="stay-extras__check"><input type="radio" name="stayOrigin" value="bus" /><span data-translate="stay_extras_origin_bus">Bus terminal</span></label>' +
      '<label class="stay-extras__check"><input type="radio" name="stayOrigin" value="other" /><span data-translate="stay_extras_origin_other">Other</span></label>' +
      "</div>" +
      '<input class="stay-extras__input" type="text" hidden data-stay-origin-other data-translate-placeholder="stay_extras_origin_other_placeholder" placeholder="Specify pickup location" />' +
      '<p class="stay-extras__field-label" data-translate="stay_extras_type_label">Transfer type</p>' +
      '<div class="stay-extras__radios">' +
      '<label class="stay-extras__check"><input type="radio" name="stayType" value="oneway" checked /><span data-translate="stay_extras_type_oneway">One-way to the hotel</span></label>' +
      '<label class="stay-extras__check"><input type="radio" name="stayType" value="roundtrip" /><span data-translate="stay_extras_type_roundtrip">Round trip</span></label>' +
      "</div>" +
      '<label class="stay-extras__notes-label" data-translate="stay_extras_transfer_notes_label" for="stayExtrasTransferNotes">Transfer notes (optional)</label>' +
      '<textarea class="stay-extras__input stay-extras__textarea" id="stayExtrasTransferNotes" rows="2" data-stay-transfer-notes data-translate-placeholder="stay_extras_transfer_notes_placeholder" placeholder="Ferry time, luggage, or extra details"></textarea>' +
      "</div>" +
      '<p class="stay-extras__field-label stay-extras__field-label--exp" data-translate="stay_extras_experiences_title">What would you like to do during your visit?</p>' +
      '<div class="stay-extras__experiences">' +
      experienceCheckboxesHtml() +
      "</div>" +
      '<input class="stay-extras__input" type="text" hidden data-stay-exp-other data-translate-placeholder="stay_extras_exp_other_placeholder" placeholder="Tell us which experience you would like" />' +
      '<p class="stay-extras__quote-note" data-translate="stay_extras_quote_note">Activities are optional and will be quoted later.</p>' +
      "</div>" +
      "</div>"
    );
  }

  function uniqueRadioNames(root) {
    const uid = root.id || "stayExtras";
    root.querySelectorAll('input[name="stayOrigin"]').forEach((el) => {
      el.name = uid + "Origin";
    });
    root.querySelectorAll('input[name="stayType"]').forEach((el) => {
      el.name = uid + "Type";
    });
    const notes = root.querySelector("[data-stay-transfer-notes]");
    if (notes && !notes.id) notes.id = uid + "Notes";
    const notesLabel = root.querySelector('label[for="stayExtrasTransferNotes"]');
    if (notes && notesLabel) notesLabel.setAttribute("for", notes.id);
  }

  function applyPlaceholders(root) {
    root.querySelectorAll("[data-translate-placeholder]").forEach((el) => {
      el.setAttribute("placeholder", t(el.dataset.translatePlaceholder, el.getAttribute("placeholder") || ""));
    });
  }

  function applyI18n(root) {
    root.querySelectorAll("[data-translate]").forEach((el) => {
      el.textContent = t(el.dataset.translate, el.textContent);
    });
    applyPlaceholders(root);
  }

  function getState(root) {
    const transferOn = !!root.querySelector("[data-stay-transfer]")?.checked;
    const originEl = root.querySelector('input[name$="Origin"]:checked');
    const typeEl = root.querySelector('input[name$="Type"]:checked');
    const originOther = String(root.querySelector("[data-stay-origin-other]")?.value || "").trim();
    const transferNotes = String(root.querySelector("[data-stay-transfer-notes]")?.value || "").trim();
    const otherExp = String(root.querySelector("[data-stay-exp-other]")?.value || "").trim();
    const experiences = [];
    root.querySelectorAll("[data-stay-exp]").forEach((input) => {
      if (!input.checked) return;
      experiences.push(input.getAttribute("data-stay-exp"));
    });
    return {
      transferOn,
      origin: originEl?.value || "port",
      originOther,
      type: typeEl?.value || "oneway",
      transferNotes,
      experiences,
      otherExp
    };
  }

  function selectedCount(state) {
    return (state.transferOn ? 1 : 0) + state.experiences.length;
  }

  function originLabel(state) {
    if (state.origin === "bus") return t("stay_extras_origin_bus", "Bus terminal");
    if (state.origin === "other") {
      return state.originOther || t("stay_extras_origin_other", "Other");
    }
    return t("stay_extras_origin_port", "Colonia port");
  }

  function typeLabel(state, hotel) {
    if (state.type === "roundtrip") {
      return t("stay_extras_type_roundtrip", "Round trip") + " · " + hotel;
    }
    return t("stay_extras_type_oneway", "One-way to the hotel") + " · " + hotel;
  }

  function experienceLabels(state) {
    return state.experiences.map((id) => {
      const item = EXPERIENCES.find((entry) => entry.id === id);
      if (id === "other") {
        const base = t(item.key, item.fallback);
        return state.otherExp ? base + ": " + state.otherExp : base;
      }
      return t(item.key, item.fallback);
    });
  }

  function refreshUi(root) {
    const state = getState(root);
    const count = selectedCount(state);
    const panel = root.querySelector("[data-stay-panel]");
    const toggle = root.querySelector("[data-stay-toggle]");
    const closedTitle = root.querySelector("[data-stay-closed-title]");
    const summary = root.querySelector("[data-stay-summary]");
    const transferFields = root.querySelector("[data-stay-transfer-fields]");
    const originOther = root.querySelector("[data-stay-origin-other]");
    const otherExp = root.querySelector("[data-stay-exp-other]");
    const expanded = toggle?.getAttribute("aria-expanded") === "true";

    if (transferFields) transferFields.hidden = !state.transferOn;
    if (originOther) originOther.hidden = !state.transferOn || state.origin !== "other";
    if (otherExp) otherExp.hidden = !state.experiences.includes("other");

    if (closedTitle) {
      if (expanded) {
        closedTitle.textContent = t("stay_extras_title", "Complete Your Stay");
      } else if (count > 0) {
        closedTitle.textContent = t("stay_extras_summary", "Additional services selected: {n}").replace(
          "{n}",
          String(count)
        );
      } else {
        closedTitle.textContent = t("stay_extras_closed_none", "Complete Your Stay (optional)");
      }
    }

    if (summary) {
      if (count > 0) {
        summary.hidden = false;
        summary.textContent = t("stay_extras_summary", "Additional services selected: {n}").replace(
          "{n}",
          String(count)
        );
      } else {
        summary.hidden = true;
        summary.textContent = "";
      }
    }

    if (panel) panel.hidden = !expanded;
  }

  function bind(root) {
    uniqueRadioNames(root);
    const toggle = root.querySelector("[data-stay-toggle]");
    const panel = root.querySelector("[data-stay-panel]");
    toggle?.addEventListener("click", () => {
      const open = toggle.getAttribute("aria-expanded") === "true";
      toggle.setAttribute("aria-expanded", open ? "false" : "true");
      if (panel) panel.hidden = open;
      refreshUi(root);
    });
    root.addEventListener("change", () => refreshUi(root));
    root.addEventListener("input", () => refreshUi(root));
    document.addEventListener("sacramento:setLanguage", () => {
      applyI18n(root);
      refreshUi(root);
    });
    applyI18n(root);
    refreshUi(root);
  }

  function formatExtrasBlock(root) {
    const state = getState(root);
    if (selectedCount(state) === 0) return "";
    const hotel = hotelName(root);
    const lines = [t("stay_extras_wa_complement", "I would also like to complement my stay with:")];
    if (state.transferOn) {
      lines.push("");
      lines.push(t("stay_extras_wa_transfer", "Transfer:"));
      lines.push(originLabel(state) + " · " + typeLabel(state, hotel));
    }
    const exps = experienceLabels(state);
    if (exps.length) {
      lines.push("");
      lines.push(t("stay_extras_wa_experiences", "Experiences:"));
      exps.forEach((label) => lines.push("- " + label));
    }
    if (state.transferNotes) {
      lines.push("");
      lines.push(t("stay_extras_wa_comments", "Additional comments:"));
      lines.push(state.transferNotes);
    }
    return lines.join("\n");
  }

  window.sacramentoInitStayExtras = function (options) {
    const opts = options || {};
    const root = document.getElementById(opts.rootId || "stayExtrasRoot");
    if (!root) return null;
    if (opts.hotelNameKey) root.dataset.hotelNameKey = opts.hotelNameKey;
    if (opts.hotelName) root.dataset.hotelName = opts.hotelName;
    if (!root.querySelector("[data-stay-extras]")) {
      root.innerHTML = markup();
    }
    bind(root);
    return root;
  };

  window.sacramentoStayExtrasCount = function (rootId) {
    const root = document.getElementById(rootId || "stayExtrasRoot");
    if (!root) return 0;
    return selectedCount(getState(root));
  };

  window.sacramentoStayExtrasWhatsAppBlock = function (rootId) {
    const root = document.getElementById(rootId || "stayExtrasRoot");
    if (!root) return "";
    return formatExtrasBlock(root);
  };

  window.sacramentoStayExtrasDecorateStayLines = function (parts) {
    const p = parts || {};
    const lines = [];
    if (p.hotel) lines.push(t("stay_extras_wa_hotel", "Hotel") + ": " + p.hotel);
    if (p.checkIn) lines.push(t("stay_extras_wa_checkin", "Check-in") + ": " + p.checkIn);
    if (p.checkOut) lines.push(t("stay_extras_wa_checkout", "Check-out") + ": " + p.checkOut);
    if (p.guests) lines.push(t("stay_extras_wa_guests", "Guests") + ": " + p.guests);
    return lines;
  };

  window.sacramentoStayExtrasGreeting = function () {
    return t("stay_extras_wa_hello", "Hi, Sacramento Adventures team!");
  };

  window.sacramentoStayExtrasQuoteClose = function () {
    return [
      t("stay_extras_wa_help", "Could you help me with availability and a quote?"),
      "",
      t("stay_extras_wa_thanks", "Thank you so much!")
    ].join("\n");
  };
})();

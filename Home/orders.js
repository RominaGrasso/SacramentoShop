const DEFAULT_DYNAMIC_PAYMENT_ENDPOINT =
  typeof window !== "undefined" && window.location?.protocol === "file:"
    ? "http://localhost:8787/api/payments/resolve"
    : "/api/payments/resolve";

function paymentApiOriginFromResolveUrl(endpoint) {
  const e = String(endpoint || "");
  if (/^https?:\/\//i.test(e)) {
    try {
      return new URL(e).origin;
    } catch {
      return "";
    }
  }
  if (typeof window !== "undefined" && window.location?.origin) {
    return window.location.origin;
  }
  return "";
}

async function fetchPlexoCybersourceHints(origins) {
  let orgId = "";
  let prefix = "";
  for (const origin of origins) {
    try {
      const r = await fetch(`${origin}/api/payments/plexo-client-hints`);
      if (!r.ok) continue;
      const h = await r.json();
      if (h.paymentMode !== "plexo") continue;
      if (h.cybersourceOrgId) orgId = String(h.cybersourceOrgId);
      if (h.cybersourceSessionPrefix) prefix = String(h.cybersourceSessionPrefix);
      if (orgId && prefix) break;
    } catch {
      /* next origin */
    }
  }
  return { orgId, prefix };
}

/** Mismo session_id en script CyberSource y en PaymentData.CybersourceDeviceFingerprint (manual Plexo / Totalnet). */
async function sacramentoCollectCybersourceSessionId(orgId, prefix) {
  const inv =
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID().replace(/-/g, "")
      : `${Date.now()}_${Math.random().toString(36).slice(2, 14)}`;
  const sessionId = `${prefix}${inv}`.slice(0, 128);
  await new Promise((resolve) => {
    const s = document.createElement("script");
    s.async = true;
    s.src = `https://h.online-metrix.net/fp/tags.js?org_id=${encodeURIComponent(orgId)}&session_id=${encodeURIComponent(sessionId)}`;
    const done = () => resolve();
    s.onload = done;
    s.onerror = done;
    document.head.appendChild(s);
  });
  await new Promise((r) => setTimeout(r, 1200));
  return sessionId;
}

/** i18n table from index.js or `window.__SACRAMENTO_TRANSLATIONS` if script scope differs. */
function sacramentoI18nTable() {
  if (typeof translations !== "undefined" && translations) return translations;
  if (typeof window !== "undefined" && window.__SACRAMENTO_TRANSLATIONS) return window.__SACRAMENTO_TRANSLATIONS;
  return {};
}

function stableStringify(value) {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }
  const keys = Object.keys(value).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`).join(",")}}`;
}

async function resolveDynamicPaymentLink(dynamicPayment, payload) {
  if (!dynamicPayment || !dynamicPayment.enabled) return "";
  const endpointRaw = dynamicPayment.endpoint || DEFAULT_DYNAMIC_PAYMENT_ENDPOINT;
  const isAbsolute = /^https?:\/\//i.test(endpointRaw);
  const candidates = [];
  const isLocalDevHost =
    typeof window !== "undefined" &&
    ["localhost", "127.0.0.1"].includes(window.location?.hostname || "");
  const remoteTestBase =
    typeof window !== "undefined" && window.SACRAMENTO_PAYMENTS_API_BASE
      ? String(window.SACRAMENTO_PAYMENTS_API_BASE).replace(/\/+$/, "")
      : "https://sacramento-payments-test.onrender.com";

  if (isAbsolute) {
    candidates.push(endpointRaw);
  } else if (endpointRaw.startsWith("/")) {
    candidates.push(endpointRaw);
    if (!isLocalDevHost) {
      candidates.push(`${remoteTestBase}${endpointRaw}`);
    }
    if (!isLocalDevHost) {
      candidates.push(`http://localhost:8787${endpointRaw}`);
      candidates.push(`http://127.0.0.1:8787${endpointRaw}`);
    }
  } else {
    candidates.push(endpointRaw);
    if (!isLocalDevHost) {
      candidates.push(`http://localhost:8787/${endpointRaw.replace(/^\.?\//, "")}`);
      candidates.push(`http://127.0.0.1:8787/${endpointRaw.replace(/^\.?\//, "")}`);
    }
  }

  if (typeof window !== "undefined" && window.location?.protocol === "file:") {
    // In file:// context, absolute local backend should be attempted first.
    candidates.unshift(
      `http://localhost:8787/${endpointRaw.replace(/^\/+/, "")}`,
      `http://127.0.0.1:8787/${endpointRaw.replace(/^\/+/, "")}`
    );
  }

  if (isLocalDevHost && !isAbsolute) {
    const endpointPath = endpointRaw.startsWith("/")
      ? endpointRaw
      : `/${endpointRaw.replace(/^\.?\//, "")}`;
    candidates.unshift(`${remoteTestBase}${endpointPath}`);
  }

  const uniqueCandidates = [...new Set(candidates)];
  const isMockPaymentUrl = (url) => {
    const value = String(url || "");
    return value.includes("sessionId=mock_") || /\/mock_[a-z0-9]+/i.test(value);
  };

  const origins = [...new Set(uniqueCandidates.map(paymentApiOriginFromResolveUrl).filter(Boolean))];
  let bodyPayload = { ...payload };
  const existingDf =
    typeof payload.cybersourceDeviceFingerprint === "string"
      ? payload.cybersourceDeviceFingerprint.trim()
      : "";
  if (!existingDf && typeof window !== "undefined") {
    let orgId = dynamicPayment.cybersourceOrgId ? String(dynamicPayment.cybersourceOrgId).trim() : "";
    let prefix = dynamicPayment.cybersourceSessionPrefix
      ? String(dynamicPayment.cybersourceSessionPrefix).trim()
      : "";
    if (!orgId || !prefix) {
      const hints = await fetchPlexoCybersourceHints(origins);
      if (!orgId) orgId = hints.orgId;
      if (!prefix) prefix = hints.prefix;
    }
    if (orgId && prefix) {
      try {
        const df = await sacramentoCollectCybersourceSessionId(orgId, prefix);
        if (df) bodyPayload = { ...bodyPayload, cybersourceDeviceFingerprint: df };
      } catch {
        /* sin fingerprint: Plexo puede seguir fallando 3DS en Visa */
      }
    }
  }

  for (const endpoint of uniqueCandidates) {
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(bodyPayload)
      });
      if (!response.ok) continue;
      const data = await response.json();
      const url = data.paymentUrl || data.url || "";
      if (!url) continue;
      if (isMockPaymentUrl(url)) continue;
      return url;
    } catch {
      // try next candidate
    }
  }
  return "";
}

const SACRAMENTO_I18N_PREF = "__i18n__:";

function sacramentoNormalizePrefText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Map free-text / legacy checkbox values to i18n keys (for labels + emoji). */
function sacramentoLegacyPrefKey(value) {
  const v = sacramentoNormalizePrefText(value);
  if (!v) return "";
  if (
    v.includes("red wine") ||
    v.includes("vino tinto") ||
    (v.includes("tinto") && (v.includes("prefer") || v.includes("preferencia")))
  ) {
    return "liebres_pref_red";
  }
  if (
    v.includes("white wine") ||
    v.includes("vino blanco") ||
    (v.includes("blanco") && (v.includes("prefer") || v.includes("preferencia")))
  ) {
    return "liebres_pref_white";
  }
  if (
    v.includes("no alcohol") ||
    v.includes("sin alcohol") ||
    v.includes("sem alcool")
  ) {
    return "liebres_pref_no_alcohol";
  }
  if ((v.includes("0") && v.includes("alcohol")) || v.includes("zero alcohol")) {
    return "bruma_pref_alcohol";
  }
  if (v.includes("vegetarian") || v.includes("vegetariano") || v.includes("vegetariana")) {
    return "bruma_pref_veg";
  }
  if (
    v.includes("low salt") ||
    v.includes("salt free") ||
    v.includes("bajo en sal") ||
    v.includes("sin sal") ||
    v.includes("baixo teor de sal")
  ) {
    return "bruma_pref_salt";
  }
  if (
    v.includes("no spicy") ||
    v.includes("spicy") ||
    v.includes("sin picante") ||
    v.includes("picante") ||
    v.includes("sem comida picante")
  ) {
    return "bruma_pref_spicy";
  }
  return "";
}

function sacramentoPrefEmojiKey(key) {
  if (!key) return "";
  const m = {
    bruma_pref_alcohol: "🍺",
    bruma_pref_salt: "🧂",
    bruma_pref_veg: "🌱",
    bruma_pref_spicy: "🌶",
    liebres_pref_red: "🍷",
    liebres_pref_white: "🥂",
    liebres_pref_vegetarian: "🌱",
    liebres_pref_no_alcohol: "🚫",
    liebres_dining_pref_no_alcohol: "🚫",
  };
  return m[key] || "";
}

function sacramentoDecodePrefLabel(raw, getI18nText, prefix = SACRAMENTO_I18N_PREF) {
  const r = String(raw || "").trim();
  if (!r) return "";
  if (r.startsWith(prefix)) {
    const k = r.slice(prefix.length);
    return getI18nText(k, k);
  }
  const k = sacramentoLegacyPrefKey(r);
  return k ? getI18nText(k, r) : r;
}

function sacramentoDecoratePref(raw, getI18nText, prefix = SACRAMENTO_I18N_PREF) {
  const r = String(raw || "").trim();
  if (!r) return "";
  const key = r.startsWith(prefix) ? r.slice(prefix.length) : sacramentoLegacyPrefKey(r);
  const label = r.startsWith(prefix) ? getI18nText(key, key) : key ? getI18nText(key, r) : r;
  const emoji = sacramentoPrefEmojiKey(key);
  return emoji ? `${emoji} ${label}` : label;
}

function initExperience(config) {
  const {
    pricePerPerson,
    guideFeePerPerson = 0,
    transportPerVehicle = 0,
    dynamicPayment = null,
    paymentLinks = {},
    experienceName = "experience",
    /** Optional i18n key for experienceName (uses global translations). */
    experienceNameKey = null,
    /** Optional { starter, main, drink } translation keys for order summary / WhatsApp labels. */
    choiceSectionLabelKeys = null,
    /** Optional `(order) => void` after popup fields are filled when editing an order. */
    afterFillPopupForEdit = null,
    /** Optional `() => void` after popup is opened for a new order (radios may be cleared). */
    afterOpenPopupForNewOrder = null,
    popupId = "popupBruma",
    closeBtnId = "closeBruma",
    saveBtnId = "saveMenu",
    createBtnId = "createMenuBtn",
    orderSummaryId = "orderSummary",
    bookNowBottomId,
    whatsappNumber = "598091642195",
    selectedDateKey = "selectedDate",
    storageKey = "orders",
    starterName = "starter",
    mainName = "main",
    drinkName = "drink",
    /** Optional labels for order summary / WhatsApp (defaults: Starter / Main / Drink). */
    choiceSectionLabels = null,
    /** If true, guide fee applies only when order.includeGuide is true (checkbox in popup). */
    guideOptional = false,
    /** Required when guideOptional: checkbox id (e.g. liebresIncludeGuide). */
    optionalGuideCheckboxId = null,
    /** If true, one flat guide fee for the whole group (see groupGuideFlatFee + groupGuideCheckboxId). */
    groupGuideOptional = false,
    /** Flat USD for the whole group when the group-guide checkbox is on (e.g. 40). */
    groupGuideFlatFee = 0,
    /** Checkbox id on the page (outside popup), e.g. liebresGroupGuide. */
    groupGuideCheckboxId = null,
    /** Optional wrapper id to show only when there is at least one guest order. */
    groupGuideWrapId = null,
    /** Optional second price tier (e.g. Bruma premium menu USD 45). */
    menuUpgradePrice = null,
    /** Radio group name for standard vs premium, e.g. brumaMenuTier. */
    menuTierRadioName = null,
    /** When premium tier: field names for plate / dessert / drink, e.g. prm_starter, prm_main, prm_drink. */
    premiumChoiceFieldNames = null,
    /** Panel ids for standard vs premium menus: { standard: "id", premium: "id" }. */
    menuTierPanelIds = null,
    /** If true, order summary / WhatsApp use the same starter/main labels for premium as for standard (not Plate/Dessert). */
    uniformTierChoiceLabels = false,
    /** Currency label before amounts in this experience's subtotal/total (default USD). E.g. UYU for pesos. */
    totalCurrencyLabel = "USD",
    /** Optional override for the standard tier line in the order card (else Bruma i18n). */
    tierSummaryStandard = null,
    /** Optional override for the premium tier line in the order card. */
    tierSummaryPremium = null,
    /** Optional override for standard tier in WhatsApp. */
    tierWhatsappStandard = null,
    /** Optional override for premium tier in WhatsApp. */
    tierWhatsappPremium = null,
    /** If set, order card tier line uses `getI18nText(key, tierSummaryStandard || …)` instead of `tierSummaryStandard` alone. */
    tierSummaryStandardKey = null,
    tierSummaryPremiumKey = null,
    tierWhatsappStandardKey = null,
    tierWhatsappPremiumKey = null,
    /**
     * Optional `{ standard: "i18nKey", premium: "i18nKey" }` for a short serving-size line under the menu tier in the order card (when `menuUpgradePrice` is set).
     */
    tierServingNotesI18n = null,
    /**
     * If true (with menuUpgradePrice set): experience subtotal is one flat amount for the whole group —
     * menuUpgradePrice if any guest order is premium, else pricePerPerson. Ignores party size for pricing.
     */
    experienceMenuFlatTotal = false,
    /**
     * When true with menu tiers: saving a Standard order does not require `mainName` radios;
     * `standardMainPlaceholder` is stored as `order.main` instead.
     */
    standardSkipsMainField = false,
    /** Stored as order.main when standardSkipsMainField and tier is Standard. */
    standardMainPlaceholder = "—",
    /** When true with premium tier: starter and main choices must differ (two side dishes). */
    premiumRequireDistinctSides = false,
    /** Checkbox `name` for Standard sides (max 1 checked). If set, replaces starter radios for Standard. */
    standardSideCheckboxName = null,
    /** Checkbox `name` for Premium sides (max 2 checked). If set, replaces premium starter/main radios. */
    premiumSideCheckboxName = null,
    /** When true: no drink/beverage radios required; `order.drink` is stored empty and hidden in summary / WhatsApp. */
    experienceSkipsDrinkField = false,
    /**
     * Optional boat add-on priced per passenger (e.g. 25). Stored separately in localStorage as `{storageKey}_boatPassengers`.
     * Counter appears in the order summary when there is at least one menu order.
     */
    boatPerPersonPrice = 0,
    boatPassengersMax = 50,
    /** Optional list of boat departure time labels (e.g. `["11:00am", …]`). Shown when `boatPerPersonPrice` > 0; stored in localStorage. */
    boatTimeSlots = null,
    /**
     * When true: no starter/main/drink (or sides) validation in the popup — only preferences (+ optional per-guest guide).
     * Use for boat-only or similar: each save adds one guest at `pricePerPerson`.
     */
    experienceSkipsMenuChoices = false,
    /**
     * When true with `boatTimeSlots`: show departure time pickers when there are orders, without a separate boat $ line
     * (`boatPerPersonPrice` should be 0; total = guests × `pricePerPerson`).
     */
    boatScheduleOnly = false,
    boatTimePerOrder = false,
    boatTimePopupRadioName = null,
    /**
     * Optional radio `name` for per-order extra field (e.g. walking tour guide language).
     * When set, saving requires a checked option; stored as `order.walkingLanguage`.
     */
    orderLanguageRadioName = null,
    /** Optional i18n key for order-card / WhatsApp label before language value (default: walking_label_language). */
    orderLanguageSummaryLabelKey = null,
    /**
     * When > 0 with `orderLanguageRadioName`: each order stores `walkingPartyCount` (1..max);
     * `guideFeePerPerson` is multiplied by that count (walking tour guests per menu order).
     */
    orderWalkingPartyMax = 0,
    /**
     * When true with `walkingTourTimeSlots` and walking party + language: each order stores
     * `walkingTourDepartureTime`; sum of `walkingPartyCount` per same time ≤ `walkingTourSlotMax`.
     */
    walkingTourTimePerOrder = false,
    walkingTourTimeSlots = null,
    walkingTourSlotMax = 15,
    walkingTourTimePopupRadioName = null
  } = config || {};

  if (!pricePerPerson) {
    console.error("initExperience: config incompleta (pricePerPerson)");
    return;
  }

  document.addEventListener("DOMContentLoaded", () => {
    let editingIndex = null;
    const curLabel = totalCurrencyLabel || "USD";
    const boatRate = Math.max(0, Number(boatPerPersonPrice) || 0);
    const boatMax = Math.max(1, Math.min(200, Number(boatPassengersMax) || 50));
    const boatTimePerOrderFlag =
      Boolean(boatTimePerOrder) && Array.isArray(boatTimeSlots) && boatTimeSlots.length > 0;
    const menuWithPerOrderBoat =
      boatTimePerOrderFlag && boatRate > 0 && !experienceSkipsMenuChoices;
    const orderBoatTime = (o) => String(o && o.boatDepartureTime ? o.boatDepartureTime : "").trim();
    const orderBoatPax = (o) => {
      if (!o) return 0;
      if (experienceSkipsMenuChoices && boatTimePerOrderFlag) {
        return Math.max(1, Math.min(boatMax, Math.floor(Number(o.passengers) || 1)));
      }
      if (menuWithPerOrderBoat) {
        return Math.max(0, Math.min(boatMax, Math.floor(Number(o.boatPassengers) || 0)));
      }
      return 0;
    };
    const boatLSKey = boatRate > 0 && !boatTimePerOrderFlag ? `${storageKey}_boatPassengers` : null;
    const getBoatPassengers = () => {
      if (!boatLSKey) return 0;
      const n = parseInt(localStorage.getItem(boatLSKey), 10);
      return Math.min(boatMax, Math.max(0, Number.isFinite(n) ? n : 0));
    };
    const setBoatPassengers = (n) => {
      if (!boatLSKey) return;
      localStorage.setItem(boatLSKey, String(Math.min(boatMax, Math.max(0, Math.floor(Number(n) || 0)))));
    };
    const boatTimePopupRadioNameResolved = boatTimePerOrderFlag
      ? String(
          boatTimePopupRadioName ||
            `boatTimePopup_${String(storageKey).replace(/[^a-zA-Z0-9_-]/g, "_")}`
        ).slice(0, 120)
      : "";
    const boatScheduleOnlyFlag = Boolean(boatScheduleOnly) && !boatTimePerOrderFlag;
    const boatTimeLSKey =
      !boatTimePerOrderFlag &&
      Array.isArray(boatTimeSlots) &&
      boatTimeSlots.length > 0 &&
      (boatRate > 0 || boatScheduleOnlyFlag)
        ? `${storageKey}_boatTime`
        : null;
    const boatTimeRadioName = boatTimeLSKey ? `boatTimeSlot_${storageKey.replace(/[^a-zA-Z0-9_-]/g, "_")}` : "";
    const getBoatTimeSlot = () => {
      if (!boatTimeLSKey) return "";
      return String(localStorage.getItem(boatTimeLSKey) || "").trim();
    };
    const setBoatTimeSlot = (v) => {
      if (!boatTimeLSKey) return;
      const s = String(v || "").trim();
      if (s) localStorage.setItem(boatTimeLSKey, s);
      else localStorage.removeItem(boatTimeLSKey);
    };
    const guideFee = Math.max(0, Number(guideFeePerPerson) || 0);
    const orderWalkingPartyMaxNum = Math.max(0, Math.min(200, Number(orderWalkingPartyMax) || 0));
    const walkingTourSlotMaxNum = Math.max(1, Math.min(200, Number(walkingTourSlotMax) || 15));
    const walkingTourTimePerOrderFlag =
      Boolean(walkingTourTimePerOrder) &&
      Array.isArray(walkingTourTimeSlots) &&
      walkingTourTimeSlots.length > 0 &&
      orderWalkingPartyMaxNum > 0 &&
      Boolean(orderLanguageRadioName);
    const walkingTourTimePopupRadioNameResolved = walkingTourTimePerOrderFlag
      ? String(
          walkingTourTimePopupRadioName ||
            `walkingTourTimePopup_${String(storageKey).replace(/[^a-zA-Z0-9_-]/g, "_")}`
        ).slice(0, 120)
      : "";
    const orderWalkingTourTime = (o) => String(o && o.walkingTourDepartureTime ? o.walkingTourDepartureTime : "").trim();
    const walkingPartyForOrder = (o) => {
      if (!orderWalkingPartyMaxNum || !orderLanguageRadioName) return 1;
      return Math.max(1, Math.min(orderWalkingPartyMaxNum, Math.floor(Number(o?.walkingPartyCount) || 1)));
    };
    const walkingPartySameTimeExcluding = (time, excludeIndex) => {
      if (!walkingTourTimePerOrderFlag) return 0;
      const ord = getOrders();
      let sum = 0;
      ord.forEach((o, j) => {
        if (excludeIndex != null && j === excludeIndex) return;
        if (!sameBoatDepartureTime(orderWalkingTourTime(o), time)) return;
        sum += walkingPartyForOrder(o);
      });
      return sum;
    };
    const maxWalkingPartyForOrderIndex = (index) => {
      if (!walkingTourTimePerOrderFlag) return orderWalkingPartyMaxNum;
      const ord = getOrders();
      const o = ord[index];
      if (!o) return orderWalkingPartyMaxNum;
      const tim = orderWalkingTourTime(o);
      if (!tim) return orderWalkingPartyMaxNum;
      const others = walkingPartySameTimeExcluding(tim, index);
      return Math.max(0, Math.min(orderWalkingPartyMaxNum, walkingTourSlotMaxNum - others));
    };
    const walkingTourSlotHasRoom = (time, walkingPartyCount, excludeIndex) => {
      if (!walkingTourTimePerOrderFlag) return true;
      const t = String(time || "").trim();
      if (!t) return true;
      const p = Math.max(1, Math.min(orderWalkingPartyMaxNum, Math.floor(Number(walkingPartyCount) || 1)));
      return walkingPartySameTimeExcluding(t, excludeIndex) + p <= walkingTourSlotMaxNum;
    };
    const vehicleTransportRate = Math.max(0, Number(transportPerVehicle) || 0);
    const getI18nText = (key, fallback) => {
      const lang = localStorage.getItem("selectedLanguage") || "en";
      const tr = sacramentoI18nTable();
      try {
        if (tr?.[lang]?.[key]) return tr[lang][key];
        if (tr?.en?.[key]) return tr.en[key];
      } catch {}
      return fallback;
    };
    const boatBookReady = () => {
      if (walkingTourTimePerOrderFlag) {
        const ordWt = getOrders();
        if (ordWt.length === 0) return true;
        for (let i = 0; i < ordWt.length; i++) {
          if (!String(ordWt[i]?.walkingTourDepartureTime || "").trim()) {
            alert(
              getI18nText(
                "walking_tour_time_each_required",
                "Each order needs a walking tour departure time. Edit the order to choose a time."
              )
            );
            return false;
          }
        }
        const totalsWalk = new Map();
        for (let i = 0; i < ordWt.length; i++) {
          const t = String(ordWt[i]?.walkingTourDepartureTime || "").trim();
          const p = walkingPartyForOrder(ordWt[i]);
          totalsWalk.set(t, (totalsWalk.get(t) || 0) + p);
        }
        for (const [, total] of totalsWalk) {
          if (total > walkingTourSlotMaxNum) {
            alert(
              getI18nText(
                "orders_boat_slot_over_capacity",
                "One departure time has more passengers than allowed. Please adjust bookings before continuing."
              )
            );
            return false;
          }
        }
      }
      if (boatTimePerOrderFlag) {
        const ord = getOrders();
        if (ord.length === 0) return true;
        if (menuWithPerOrderBoat) {
          for (let i = 0; i < ord.length; i++) {
            const p = orderBoatPax(ord[i]);
            if (p > 0 && !String(ord[i]?.boatDepartureTime || "").trim()) {
              alert(
                getI18nText(
                  "orders_boat_menu_time_required",
                  "Each order with boat passengers needs a departure time. Edit that order to choose a time."
                )
              );
              return false;
            }
          }
          const totalsByTime = new Map();
          for (let i = 0; i < ord.length; i++) {
            const p = orderBoatPax(ord[i]);
            if (p <= 0) continue;
            const t = String(ord[i]?.boatDepartureTime || "").trim();
            totalsByTime.set(t, (totalsByTime.get(t) || 0) + p);
          }
          for (const [, total] of totalsByTime) {
            if (total > boatMax) {
              alert(
                getI18nText(
                  "orders_boat_slot_over_capacity",
                  "One departure time has more passengers than allowed. Please adjust bookings before continuing."
                )
              );
              return false;
            }
          }
          return true;
        }
        for (let i = 0; i < ord.length; i++) {
          if (!String(ord[i]?.boatDepartureTime || "").trim()) {
            alert(
              getI18nText(
                "orders_boat_time_each_required",
                "Each booking must have a boat departure time. Please edit the booking missing a time."
              )
            );
            return false;
          }
        }
        const totalsByTime = new Map();
        for (let i = 0; i < ord.length; i++) {
          const t = String(ord[i]?.boatDepartureTime || "").trim();
          const p = Math.max(1, Math.min(boatMax, Math.floor(Number(ord[i]?.passengers) || 1)));
          totalsByTime.set(t, (totalsByTime.get(t) || 0) + p);
        }
        for (const [, total] of totalsByTime) {
          if (total > boatMax) {
            alert(
              getI18nText(
                "orders_boat_slot_over_capacity",
                "One departure time has more passengers than allowed. Please adjust bookings before continuing."
              )
            );
            return false;
          }
        }
        return true;
      }
      if (!boatTimeLSKey) return true;
      if (boatScheduleOnlyFlag) {
        if (getOrders().length === 0) return true;
        if (!getBoatTimeSlot()) {
          alert(
            getI18nText(
              "orders_boat_time_required",
              "Please choose a boat departure time."
            )
          );
          return false;
        }
        return true;
      }
      if (getBoatPassengers() <= 0) return true;
      if (!getBoatTimeSlot()) {
        alert(
          getI18nText(
            "orders_boat_time_required",
            "Please choose a boat departure time."
          )
        );
        return false;
      }
      return true;
    };
    const I18N_PREF_PREFIX = SACRAMENTO_I18N_PREF;
    const encodePref = (keyOrLabel) => {
      const raw = String(keyOrLabel || "").trim();
      if (!raw) return "";
      return raw.startsWith(I18N_PREF_PREFIX) ? raw : `${I18N_PREF_PREFIX}${raw}`;
    };
    const decodePref = (storedPref) => sacramentoDecodePrefLabel(storedPref, getI18nText, I18N_PREF_PREFIX);
    const decoratePref = (storedPref) => sacramentoDecoratePref(storedPref, getI18nText, I18N_PREF_PREFIX);

    const escapeHtml = (str) =>
      String(str).replace(/[&<>"']/g, (m) => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
      }[m]));

    const getOrders = () => {
      try {
        const parsed = JSON.parse(localStorage.getItem(storageKey)) || [];
        if (!Array.isArray(parsed)) return [];
        let mutated = false;
        const migrated = parsed.map((order) => {
          if (!order || !Array.isArray(order.preferences)) return order;
          const nextPrefs = order.preferences.map((pref) => {
            const raw = String(pref || "").trim();
            if (!raw) return raw;
            if (raw.startsWith(I18N_PREF_PREFIX)) return raw;
            const legacyKey = sacramentoLegacyPrefKey(raw);
            if (!legacyKey) return raw;
            mutated = true;
            return encodePref(legacyKey);
          });
          return { ...order, preferences: nextPrefs };
        });
        if (mutated) {
          localStorage.setItem(storageKey, JSON.stringify(migrated));
        }
        return migrated;
      } catch {
        return [];
      }
    };

    const setOrders = (orders) => {
      localStorage.setItem(storageKey, JSON.stringify(orders));
    };

    const getTotalBoatPassengersPaid = () => {
      if (!boatRate) return 0;
      if (boatTimePerOrderFlag) {
        return getOrders().reduce((s, o) => s + orderBoatPax(o), 0);
      }
      return getBoatPassengers();
    };

    const peopleCountForPayment = (ordersArr) => {
      if (boatTimePerOrderFlag && experienceSkipsMenuChoices) {
        return ordersArr.reduce((s, o) => s + orderBoatPax(o), 0);
      }
      if (orderWalkingPartyMaxNum > 0 && orderLanguageRadioName) {
        return ordersArr.reduce((s, o) => s + walkingPartyForOrder(o), 0);
      }
      return ordersArr.length;
    };

    const buildBoatTimesPayload = (ordersArr) => {
      if (!boatTimePerOrderFlag) return getBoatTimeSlot();
      if (menuWithPerOrderBoat) {
        return ordersArr.map((o) => ({
          time: orderBoatTime(o),
          passengers: orderBoatPax(o),
          menuTier: o && o.menuTier ? o.menuTier : null
        }));
      }
      return ordersArr.map((o) => ({
        time: o && o.boatDepartureTime,
        passengers: Math.max(1, Math.min(boatMax, Math.floor(Number(o && o.passengers) || 1)))
      }));
    };

    const sameBoatDepartureTime = (a, b) => {
      const ta = String(a || "").trim();
      const tb = String(b || "").trim();
      return Boolean(ta) && ta === tb;
    };

    /** Passengers on other orders with the same departure time (`excludeIndex` skips that row, e.g. while editing). */
    const passengersSameTimeExcluding = (time, excludeIndex) => {
      if (!boatTimePerOrderFlag) return 0;
      const ord = getOrders();
      let sum = 0;
      ord.forEach((o, j) => {
        if (excludeIndex != null && j === excludeIndex) return;
        if (!sameBoatDepartureTime(o?.boatDepartureTime, time)) return;
        sum += orderBoatPax(o);
      });
      return sum;
    };

    /** Remaining seats this booking can use for that time (0 = full for new passengers). */
    const maxPassengersForOrderIndex = (index) => {
      if (!boatTimePerOrderFlag) return boatMax;
      const ord = getOrders();
      const o = ord[index];
      if (!o) return boatMax;
      const t = orderBoatTime(o);
      if (!t) return boatMax;
      return Math.max(0, boatMax - passengersSameTimeExcluding(t, index));
    };

    const boatTimeSlotHasRoom = (time, passengers, excludeIndex) => {
      if (!boatTimePerOrderFlag) return true;
      const t = String(time || "").trim();
      if (!t) return true;
      const raw = Math.floor(Number(passengers) || 0);
      const p = experienceSkipsMenuChoices
        ? Math.max(1, Math.min(boatMax, raw || 1))
        : Math.max(0, Math.min(boatMax, raw));
      if (!experienceSkipsMenuChoices && p === 0) return true;
      return passengersSameTimeExcluding(t, excludeIndex) + p <= boatMax;
    };

    /** One-time: migrate global boat time / passenger counter into per-order fields. */
    (() => {
      if (!Boolean(config?.boatTimePerOrder) || !Array.isArray(boatTimeSlots) || boatTimeSlots.length === 0) return;
      const legacyTimeKey = `${storageKey}_boatTime`;
      const legacyPaxKey = `${storageKey}_boatPassengers`;
      const legacyT = String(localStorage.getItem(legacyTimeKey) || "").trim();
      const legacyRn = parseInt(localStorage.getItem(legacyPaxKey), 10);
      const legacyBn = Number.isFinite(legacyRn) ? Math.max(0, Math.min(boatMax, legacyRn)) : 0;
      if (!legacyT && !legacyBn) return;
      let ord;
      try {
        ord = JSON.parse(localStorage.getItem(storageKey)) || [];
      } catch {
        return;
      }
      if (!Array.isArray(ord) || ord.length === 0) return;

      if (Boolean(config?.experienceSkipsMenuChoices)) {
        if (!legacyT) return;
        let changed = false;
        const next = ord.map((o) => {
          if (o && !String(o.boatDepartureTime || "").trim()) {
            changed = true;
            return {
              ...o,
              boatDepartureTime: legacyT,
              passengers: Math.max(1, Math.min(boatMax, Math.floor(Number(o.passengers) || 1)))
            };
          }
          return o;
        });
        if (changed) {
          localStorage.setItem(storageKey, JSON.stringify(next));
          localStorage.removeItem(legacyTimeKey);
          localStorage.removeItem(legacyPaxKey);
        }
        return;
      }

      if (boatRate > 0) {
        let changed = false;
        const next = ord.map((o, i) => {
          if (!o || i !== 0) return o;
          const hasBoat =
            Boolean(String(o.boatDepartureTime || "").trim()) || Math.floor(Number(o.boatPassengers) || 0) > 0;
          if (hasBoat) return o;
          changed = true;
          const t = legacyT || "";
          const bp = legacyBn > 0 ? legacyBn : legacyT ? 1 : 0;
          return {
            ...o,
            boatDepartureTime: t,
            boatPassengers: Math.min(boatMax, bp)
          };
        });
        if (changed) {
          localStorage.setItem(storageKey, JSON.stringify(next));
          localStorage.removeItem(legacyTimeKey);
          localStorage.removeItem(legacyPaxKey);
        }
      }
    })();

    const formatDate = (d) =>
      d.toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric"
      });

    const getDateForBooking = () => {
      const stored = selectedDateKey ? localStorage.getItem(selectedDateKey) : null;
      if (stored && /^\d{4}-\d{2}-\d{2}$/.test(stored)) {
        const [y, m, d] = stored.split("-").map(Number);
        const parsed = new Date(y, m - 1, d);
        if (!Number.isNaN(parsed.getTime())) return formatDate(parsed);
      }
      if (stored) return stored;
      return formatDate(new Date());
    };
    const buildChoiceLookup = (fieldName) => {
      const map = new Map();
      const radios = popup.querySelectorAll(`input[name="${fieldName}"]`);
      radios.forEach((input) => {
        const value = input.value || "";
        const span = input.nextElementSibling;
        const labelText = span?.textContent?.trim() || value;
        const key = span?.dataset?.translate;
        const translated = key ? getI18nText(key, labelText) : labelText;
        if (value) map.set(value, translated);
        if (labelText) map.set(labelText, translated);
        const legacyRaw = input.dataset?.legacyValues;
        if (legacyRaw) {
          legacyRaw.split("|").forEach((legacy) => {
            const t = String(legacy).trim();
            if (t) map.set(t, translated);
          });
        }
      });
      if (fieldName === "josefina_main" && popup) {
        [
          "josefina_chivito_protein",
          "josefina_sorrentino_sauce",
          "josefina_fish_garnish"
        ].forEach((subName) => {
          popup.querySelectorAll(`input[name="${subName}"]`).forEach((input) => {
            const value = String(input.dataset.josefinaMainValue || "").trim();
            const sumKey = input.dataset.translateSummaryKey;
            if (!value || !sumKey) return;
            map.set(value, getI18nText(sumKey, value));
          });
        });
      }
      return map;
    };
    const getSecondaryFieldName = (fieldName) => {
      if (!premiumChoiceFieldNames) return null;
      if (fieldName === starterName) return premiumChoiceFieldNames.starter;
      if (fieldName === mainName) return premiumChoiceFieldNames.main;
      if (fieldName === drinkName) return premiumChoiceFieldNames.drink;
      return null;
    };

    const getLocalizedChoice = (fieldName, storedValue) => {
      const text = String(storedValue || "").trim();
      if (!text) return "-";
      const primary = buildChoiceLookup(fieldName);
      if (primary.has(text)) return primary.get(text);
      const secondary = getSecondaryFieldName(fieldName);
      if (secondary) {
        const alt = buildChoiceLookup(secondary);
        if (alt.has(text)) return alt.get(text);
      }
      if (standardSideCheckboxName) {
        const sideMap = buildChoiceLookup(standardSideCheckboxName);
        if (sideMap.has(text)) return sideMap.get(text);
      }
      if (premiumSideCheckboxName) {
        const sideMapPrm = buildChoiceLookup(premiumSideCheckboxName);
        if (sideMapPrm.has(text)) return sideMapPrm.get(text);
      }
      return text;
    };

    const optionalGuideEl = () =>
      optionalGuideCheckboxId ? document.getElementById(optionalGuideCheckboxId) : null;

    const groupGuideEl = () =>
      groupGuideCheckboxId ? document.getElementById(groupGuideCheckboxId) : null;

    const groupGuideStorageKey = `${storageKey}_groupGuide`;

    const getGroupGuideStored = () => localStorage.getItem(groupGuideStorageKey) === "1";

    const setGroupGuideStored = (on) => {
      if (on) localStorage.setItem(groupGuideStorageKey, "1");
      else localStorage.removeItem(groupGuideStorageKey);
    };

    const groupGuideFlat = Math.max(0, Number(groupGuideFlatFee) || 0);

    /** One flat fee for the entire group when checkbox is checked and there is at least one order. */
    const groupGuideAmount = () => {
      if (!groupGuideOptional || groupGuideFlat <= 0) return 0;
      const orders = getOrders();
      if (orders.length === 0) return 0;
      const el = groupGuideEl();
      return el && el.checked ? groupGuideFlat : 0;
    };

    const syncGroupGuideWrap = () => {
      const wrapId = groupGuideWrapId || (groupGuideCheckboxId ? `${groupGuideCheckboxId}Wrap` : null);
      const wrap = wrapId ? document.getElementById(wrapId) : null;
      if (wrap) {
        wrap.style.display = getOrders().length > 0 ? "" : "none";
      }
    };

    const guestExperienceTotal = (o) => {
      let unit = Number(pricePerPerson) || 0;
      if (menuUpgradePrice != null && o && o.menuTier === "premium") {
        unit = Number(menuUpgradePrice) || unit;
      }
      let mult = 1;
      if (boatTimePerOrderFlag && experienceSkipsMenuChoices && o) {
        mult = Math.max(1, Math.min(boatMax, Math.floor(Number(o.passengers) || 1)));
      }
      let base = unit * mult;
      if (groupGuideOptional) {
        return base;
      }
      if (guideOptional) {
        return base + (o && o.includeGuide ? guideFee : 0);
      }
      if (guideFee > 0 && orderWalkingPartyMaxNum > 0 && orderLanguageRadioName) {
        return base + guideFee * walkingPartyForOrder(o);
      }
      return base + guideFee;
    };

    const groupExperienceSubtotal = (orders) => {
      if (!experienceMenuFlatTotal || menuUpgradePrice == null) {
        return orders.reduce((s, o) => s + guestExperienceTotal(o), 0);
      }
      if (!orders.length) return 0;
      const std = Number(pricePerPerson) || 0;
      const prem = Number(menuUpgradePrice) || std;
      const anyPremium = orders.some((o) => o && o.menuTier === "premium");
      return anyPremium ? prem : std;
    };

    const popup = document.getElementById(popupId);
    const closeBtn = document.getElementById(closeBtnId);
    const saveBtn = document.getElementById(saveBtnId);
    const createBtn = document.getElementById(createBtnId);
    const container = document.getElementById(orderSummaryId);

    if (!popup || !closeBtn || !saveBtn || !createBtn || !container) return;

    const syncMenuTierPanels = (standardSelected) => {
      if (!menuTierPanelIds?.standard || !menuTierPanelIds?.premium) return;
      const stdEl = document.getElementById(menuTierPanelIds.standard);
      const prmEl = document.getElementById(menuTierPanelIds.premium);
      if (!stdEl || !prmEl) return;
      stdEl.hidden = !standardSelected;
      prmEl.hidden = standardSelected;
      stdEl.querySelectorAll("input").forEach((i) => {
        i.disabled = !standardSelected;
      });
      prmEl.querySelectorAll("input").forEach((i) => {
        i.disabled = standardSelected;
      });
    };

    /** Si un grupo (starter/main/drink) tiene una sola opción, queda marcada tras limpiar el popup. */
    const recheckLoneRadios = () => {
      const check = (name) => {
        const radios = popup.querySelectorAll(`input[name="${name}"]`);
        if (radios.length === 1) radios[0].checked = true;
      };
      [starterName, mainName, drinkName].forEach(check);
      if (premiumChoiceFieldNames) {
        [premiumChoiceFieldNames.starter, premiumChoiceFieldNames.main, premiumChoiceFieldNames.drink].forEach(
          check
        );
      }
      if (boatTimePopupRadioNameResolved) check(boatTimePopupRadioNameResolved);
      if (walkingTourTimePopupRadioNameResolved) check(walkingTourTimePopupRadioNameResolved);
    };

    function openPopupForNewOrder() {
      popup.classList.add("active");
      popup.querySelectorAll('input[type="radio"]').forEach((i) => {
        if (menuTierRadioName && i.name === menuTierRadioName) return;
        i.checked = false;
      });
      if (orderLanguageRadioName) {
        popup.querySelectorAll(`input[name="${orderLanguageRadioName}"]`).forEach((r) => {
          r.checked = false;
        });
        const defLang =
          popup.querySelector(`input[name="${orderLanguageRadioName}"][value="English guide"]`) ||
          popup.querySelector(`input[name="${orderLanguageRadioName}"]`);
        if (defLang) defLang.checked = true;
      }
      if (standardSideCheckboxName) {
        popup.querySelectorAll(`input[name="${standardSideCheckboxName}"]`).forEach((i) => (i.checked = false));
      }
      if (premiumSideCheckboxName) {
        popup.querySelectorAll(`input[name="${premiumSideCheckboxName}"]`).forEach((i) => (i.checked = false));
      }
      if (menuUpgradePrice && menuTierRadioName) {
        const std = popup.querySelector(`input[name="${menuTierRadioName}"][value="standard"]`);
        if (std) std.checked = true;
        syncMenuTierPanels(true);
      }
      popup.querySelectorAll('.preferences-inside input[type="checkbox"]').forEach((i) => (i.checked = false));
      const og = optionalGuideEl();
      if (og && !groupGuideOptional) og.checked = false;
      editingIndex = null;
      saveBtn.textContent = getI18nText("save_selection", "Save selection");
      recheckLoneRadios();
      if (typeof afterOpenPopupForNewOrder === "function") {
        try {
          afterOpenPopupForNewOrder();
        } catch (err) {
          console.error(err);
        }
      }
    }

    if (createBtn && popup && saveBtn) {
      createBtn.addEventListener("click", () => {
        openPopupForNewOrder();
      });
    }

    if (menuUpgradePrice && menuTierRadioName && popup) {
      popup.addEventListener("change", (e) => {
        const t = e.target;
        if (t && t.name === menuTierRadioName) {
          syncMenuTierPanels(t.value === "standard");
        }
      });
    }

    if (popup && standardSideCheckboxName) {
      popup.addEventListener("change", (e) => {
        const t = e.target;
        if (!t || t.name !== standardSideCheckboxName || !t.checked) return;
        popup.querySelectorAll(`input[name="${standardSideCheckboxName}"]`).forEach((c) => {
          if (c !== t) c.checked = false;
        });
      });
    }

    if (popup && premiumSideCheckboxName) {
      popup.addEventListener("change", (e) => {
        const t = e.target;
        if (!t || t.name !== premiumSideCheckboxName || !t.checked) return;
        const checked = popup.querySelectorAll(`input[name="${premiumSideCheckboxName}"]:checked`);
        if (checked.length > 2) t.checked = false;
      });
    }

    if (closeBtn) {
      closeBtn.addEventListener("click", () => popup.classList.remove("active"));
    }

    if (saveBtn) {
      saveBtn.addEventListener("click", () => {
        const orders = getOrders();

        if (experienceSkipsMenuChoices) {
          const preferences = Array.from(
            popup.querySelectorAll('.preferences-inside input[type="checkbox"]:checked')
          ).map((el) => (el.value || el.parentElement.textContent.trim()));
          const og = optionalGuideEl();
          const includeGuide = guideOptional && !groupGuideOptional && og ? Boolean(og.checked) : false;
          let boatDepartureTime = "";
          if (boatTimePerOrderFlag && boatTimePopupRadioNameResolved) {
            const sel = popup.querySelector(`input[name="${boatTimePopupRadioNameResolved}"]:checked`);
            boatDepartureTime = sel ? String(sel.value || "").trim() : "";
            if (!boatDepartureTime) {
              alert(
                getI18nText(
                  "orders_boat_time_popup_required",
                  "Please choose a boat departure time."
                )
              );
              return;
            }
          }
          const existingPassengers =
            editingIndex !== null && orders[editingIndex]
              ? Math.max(1, Math.min(boatMax, Math.floor(Number(orders[editingIndex].passengers) || 1)))
              : 1;
          const order = {
            starter: "",
            main: "",
            drink: "",
            preferences,
            ...(boatTimePerOrderFlag
              ? { boatDepartureTime, passengers: existingPassengers }
              : {}),
            ...(guideOptional && !groupGuideOptional ? { includeGuide } : {})
          };
          if (
            boatTimePerOrderFlag &&
            boatDepartureTime &&
            !boatTimeSlotHasRoom(boatDepartureTime, existingPassengers, editingIndex)
          ) {
            alert(
              getI18nText(
                "orders_boat_slot_full",
                "This departure time already has the maximum number of passengers. Choose another time or reduce passengers in another booking."
              )
            );
            return;
          }
          if (editingIndex !== null) {
            orders[editingIndex] = order;
            editingIndex = null;
          } else {
            orders.push(order);
          }
          setOrders(orders);
          popup.classList.remove("active");
          renderOrders();
          return;
        }

        const tierPremium =
          menuUpgradePrice &&
          menuTierRadioName &&
          popup.querySelector(`input[name="${menuTierRadioName}"]:checked`)?.value === "premium";

        const skipMainStandard =
          Boolean(standardSkipsMainField && menuUpgradePrice && !tierPremium);

        const useStdSidesCb =
          Boolean(standardSideCheckboxName && menuUpgradePrice && !tierPremium);
        const usePrmSidesCb =
          Boolean(premiumSideCheckboxName && menuUpgradePrice && tierPremium);

        let starterText = "";
        let mainText = "";
        let drinkText = "";

        if (usePrmSidesCb) {
          const sides = Array.from(
            popup.querySelectorAll(`input[name="${premiumSideCheckboxName}"]:checked`)
          );
          if (sides.length < 1 || sides.length > 2) {
            alert(
              getI18nText(
                "orders_alert_sides_premium_range",
                "Premium: choose 1 or 2 side dishes."
              )
            );
            return;
          }
          starterText =
            sides[0].value || sides[0].nextElementSibling?.textContent?.trim() || "";
          mainText =
            sides.length === 2
              ? sides[1].value || sides[1].nextElementSibling?.textContent?.trim() || ""
              : "";
          if (
            premiumRequireDistinctSides &&
            sides.length === 2 &&
            String(starterText).trim() === String(mainText).trim()
          ) {
            alert(
              getI18nText(
                "orders_alert_distinct_sides",
                "Please choose two different side dishes for Premium."
              )
            );
            return;
          }
          drinkText = "";
        } else if (useStdSidesCb) {
          const sides = Array.from(
            popup.querySelectorAll(`input[name="${standardSideCheckboxName}"]:checked`)
          );
          if (sides.length !== 1) {
            alert(
              getI18nText(
                "orders_alert_sides_standard_one",
                "Standard: choose exactly 1 side dish."
              )
            );
            return;
          }
          starterText =
            sides[0].value || sides[0].nextElementSibling?.textContent?.trim() || "";
          mainText =
            standardMainPlaceholder === undefined || standardMainPlaceholder === null
              ? ""
              : String(standardMainPlaceholder);
          drinkText = "";
        } else {
          let starter;
          let main;
          let drink;

          if (tierPremium && premiumChoiceFieldNames) {
            starter = popup.querySelector(`input[name="${premiumChoiceFieldNames.starter}"]:checked`);
            main = popup.querySelector(`input[name="${premiumChoiceFieldNames.main}"]:checked`);
            drink = popup.querySelector(`input[name="${premiumChoiceFieldNames.drink}"]:checked`);
          } else {
            starter = popup.querySelector(`input[name="${starterName}"]:checked`);
            main = popup.querySelector(`input[name="${mainName}"]:checked`);
            drink = popup.querySelector(`input[name="${drinkName}"]:checked`);
          }

          if (!starter || (!experienceSkipsDrinkField && !drink) || (!skipMainStandard && !main)) {
            alert(getI18nText("orders_alert_select_each", "Please select one option from each category"));
            return;
          }

          starterText = starter.value || starter.nextElementSibling?.textContent?.trim();
          mainText = main
            ? main.value || main.nextElementSibling?.textContent?.trim()
            : "";
          if (skipMainStandard) {
            mainText =
              standardMainPlaceholder === undefined || standardMainPlaceholder === null
                ? ""
                : String(standardMainPlaceholder);
          }
          drinkText = experienceSkipsDrinkField
            ? ""
            : drink.value || drink.nextElementSibling?.textContent?.trim();

          if (
            tierPremium &&
            premiumRequireDistinctSides &&
            String(starterText).trim() === String(mainText).trim()
          ) {
            alert(
              getI18nText(
                "orders_alert_distinct_sides",
                "Please choose two different side dishes for Premium."
              )
            );
            return;
          }
        }

        const preferences = Array.from(
          popup.querySelectorAll('.preferences-inside input[type="checkbox"]:checked')
        ).map((el) => (el.value || el.parentElement.textContent.trim()));

        let walkingLanguage = "";
        if (orderLanguageRadioName) {
          const lr = popup.querySelector(`input[name="${orderLanguageRadioName}"]:checked`);
          walkingLanguage = lr
            ? String(lr.value || lr.nextElementSibling?.textContent?.trim() || "").trim()
            : "";
          if (!walkingLanguage) {
            alert(getI18nText("walking_alert_select_language", "Please select a language"));
            return;
          }
        }

        const og = optionalGuideEl();
        const includeGuide = guideOptional && !groupGuideOptional && og ? Boolean(og.checked) : false;

        let boatDepartureTimeMenu = "";
        let boatPassengersMenu = 0;
        if (menuWithPerOrderBoat && boatTimePopupRadioNameResolved) {
          const selBoat = popup.querySelector(`input[name="${boatTimePopupRadioNameResolved}"]:checked`);
          boatDepartureTimeMenu = selBoat ? String(selBoat.value || "").trim() : "";
          boatPassengersMenu =
            editingIndex !== null && orders[editingIndex]
              ? Math.max(0, Math.min(boatMax, Math.floor(Number(orders[editingIndex].boatPassengers) || 0)))
              : 0;
          if (boatPassengersMenu > 0 && !boatDepartureTimeMenu) {
            alert(
              getI18nText(
                "orders_boat_time_popup_required",
                "Please choose a boat departure time."
              )
            );
            return;
          }
          if (
            boatDepartureTimeMenu &&
            boatPassengersMenu > 0 &&
            !boatTimeSlotHasRoom(boatDepartureTimeMenu, boatPassengersMenu, editingIndex)
          ) {
            alert(
              getI18nText(
                "orders_boat_slot_full",
                "This departure time already has the maximum number of passengers. Choose another time or reduce passengers in another booking."
              )
            );
            return;
          }
        }

        let walkingTourDepartureTimeMenu = "";
        if (walkingTourTimePerOrderFlag && walkingTourTimePopupRadioNameResolved) {
          const selWt = popup.querySelector(`input[name="${walkingTourTimePopupRadioNameResolved}"]:checked`);
          walkingTourDepartureTimeMenu = selWt ? String(selWt.value || "").trim() : "";
          if (!walkingTourDepartureTimeMenu) {
            alert(
              getI18nText(
                "walking_tour_time_popup_required",
                "Please choose a walking tour departure time."
              )
            );
            return;
          }
          const partyForWalkSlot =
            editingIndex !== null && orders[editingIndex]
              ? walkingPartyForOrder(orders[editingIndex])
              : 1;
          if (!walkingTourSlotHasRoom(walkingTourDepartureTimeMenu, partyForWalkSlot, editingIndex)) {
            alert(
              getI18nText(
                "orders_boat_slot_full",
                "This departure time already has the maximum number of passengers. Choose another time or reduce passengers in another booking."
              )
            );
            return;
          }
        }

        const order = {
          starter: starterText,
          main: mainText,
          drink: drinkText,
          preferences,
          ...(guideOptional && !groupGuideOptional ? { includeGuide } : {}),
          ...(menuUpgradePrice ? { menuTier: tierPremium ? "premium" : "standard" } : {}),
          ...(menuWithPerOrderBoat
            ? { boatDepartureTime: boatDepartureTimeMenu, boatPassengers: boatPassengersMenu }
            : {}),
          ...(walkingTourTimePerOrderFlag && walkingTourDepartureTimeMenu
            ? { walkingTourDepartureTime: walkingTourDepartureTimeMenu }
            : {}),
          ...(orderLanguageRadioName && walkingLanguage ? { walkingLanguage } : {}),
          ...(orderWalkingPartyMaxNum > 0 && orderLanguageRadioName
            ? {
                walkingPartyCount:
                  editingIndex !== null && orders[editingIndex]
                    ? walkingPartyForOrder(orders[editingIndex])
                    : 1
              }
            : {})
        };

        if (editingIndex !== null) {
          orders[editingIndex] = order;
          editingIndex = null;
        } else {
          orders.push(order);
        }

        setOrders(orders);

        popup.classList.remove("active");
        renderOrders();
      });
    }

    const buildWhatsAppMessage = (orders, dateStr, paymentLinkOverride = "") => {
      const people = orders.length;
      const peopleCount = peopleCountForPayment(orders);
      const dynamicEnabled = Boolean(dynamicPayment && dynamicPayment.enabled);
      const paymentLink =
        paymentLinkOverride ||
        (!dynamicEnabled ? paymentLinks[peopleCount] || paymentLinks[people] || "" : "");
      const experienceSubtotal = groupExperienceSubtotal(orders);
      const gg = groupGuideAmount();
      const transportTotal =
        vehicleTransportRate > 0 ? groupPrivateTransportTotal(peopleCount, vehicleTransportRate) : 0;
      const boatPassengersWa = boatRate > 0 ? getTotalBoatPassengersPaid() : 0;
      const boatTotalWa = boatPassengersWa * boatRate;
      const total = experienceSubtotal + gg + transportTotal + boatTotalWa;

      const Ls = choiceSectionLabels || {};
      const Lk = choiceSectionLabelKeys || {};
      const labS = Lk.starter
        ? getI18nText(Lk.starter, Ls.starter || "Starter")
        : Ls.starter || "Starter";
      const labM = Lk.main
        ? getI18nText(Lk.main, Ls.main || "Main")
        : Ls.main || "Main";
      const labD = Lk.drink
        ? getI18nText(Lk.drink, Ls.drink || "Drink")
        : Ls.drink || "Drink";
      const labGuide = getI18nText("guide_accompany_short", "Guide");
      const guestLbl = getI18nText("guest_order_label", "Guest");
      const tierWaPremLine =
        tierWhatsappPremiumKey
          ? getI18nText(tierWhatsappPremiumKey, tierWhatsappPremium || "")
          : tierWhatsappPremium || getI18nText("bruma_whatsapp_premium", "Premium (USD 45)");
      const tierWaStdLine =
        tierWhatsappStandardKey
          ? getI18nText(tierWhatsappStandardKey, tierWhatsappStandard || "")
          : tierWhatsappStandard || getI18nText("bruma_whatsapp_standard", "Standard (from USD 35)");
      const ordersText = orders
        .map((o, i) => {
          const prefs = (Array.isArray(o.preferences) ? o.preferences : [])
            .map((p) => decoratePref(p))
            .filter((p) => p && p.trim() && p !== "-");
          const gLine =
            guideOptional && !groupGuideOptional && guideFee > 0
              ? `\n${labGuide}: ${o && o.includeGuide ? "Yes (+USD " + guideFee + ")" : "No"}`
              : "";
          if (experienceSkipsMenuChoices) {
            const cardLbl = boatTimePerOrderFlag
              ? getI18nText("booking_order_label", "Booking")
              : guestLbl;
            const pax = boatTimePerOrderFlag
              ? Math.max(1, Math.min(boatMax, Math.floor(Number(o.passengers) || 1)))
              : 1;
            const timeLine =
              boatTimePerOrderFlag && String(o.boatDepartureTime || "").trim()
                ? `\n${getI18nText("orders_wa_boat_time", "Boat departure time")}: ${String(o.boatDepartureTime).trim()} · ${getI18nText("passengers_label", "Passengers")}: ${pax}`
                : "";
            const prefPart =
              (prefs.join(", ") || "").trim() !== ""
                ? `\n${getI18nText("preferences_label", "Preferences")}: ${prefs.join(", ")}`
                : "";
            return `*${cardLbl} ${i + 1}*${timeLine}${gLine}${prefPart}`;
          }
          const prem = menuUpgradePrice && o.menuTier === "premium";
          const ls =
            prem && !uniformTierChoiceLabels
              ? getI18nText("bruma_premium_label_plate", "Plate")
              : labS;
          const lm =
            prem && !uniformTierChoiceLabels
              ? getI18nText("bruma_premium_label_dessert", "Dessert")
              : labM;
          const tierLine = menuUpgradePrice
            ? `\n${getI18nText("bruma_whatsapp_tier", "Menu tier")}: ${prem ? tierWaPremLine : tierWaStdLine}`
            : "";
          const stdSkipsMain =
            Boolean(standardSkipsMainField && menuUpgradePrice && !prem);
          const premOmitsSecondSide = prem && !String(o.main || "").trim();
          const mainPart =
            stdSkipsMain || premOmitsSecondSide
              ? ""
              : `\n${lm}: ${getLocalizedChoice(mainName, o.main)}`;
          const drinkPart = experienceSkipsDrinkField
            ? ""
            : `\n${labD}: ${getLocalizedChoice(drinkName, o.drink)}`;
          const menuBoatWa =
            menuWithPerOrderBoat && boatRate > 0
              ? (() => {
                  const bp = orderBoatPax(o);
                  const bt = orderBoatTime(o);
                  if (bp <= 0 && !bt) return "";
                  return `\n${getI18nText("orders_wa_boat_time", "Boat departure time")}: ${bt || "-"} · ${getI18nText("passengers_label", "Passengers")}: ${bp}`;
                })()
              : "";
          const walkLangLabelKey = orderLanguageSummaryLabelKey || "walking_label_language";
          const walkLangLabelFb = orderLanguageSummaryLabelKey ? "Guided tour" : "Language";
          const walkLangWa =
            orderLanguageRadioName && String(o.walkingLanguage || "").trim()
              ? `\n${getI18nText(walkLangLabelKey, walkLangLabelFb)}: ${getLocalizedChoice(
                  orderLanguageRadioName,
                  o.walkingLanguage
                )}`
              : "";
          const walkTourTimeWa =
            walkingTourTimePerOrderFlag && orderWalkingTourTime(o)
              ? `\n${getI18nText("orders_wa_walking_tour_time", "Walking tour time")}: ${orderWalkingTourTime(o)}`
              : "";
          const walkPartyWa =
            orderWalkingPartyMaxNum > 0 && orderLanguageRadioName
              ? `\n${getI18nText("walking_asado_wa_tour_quantity", "Walking tour guests")}: ${walkingPartyForOrder(o)}`
              : "";
          return `*${getI18nText("order_word", "Order")} ${i + 1}*${tierLine}\n${ls}: ${getLocalizedChoice(starterName, o.starter)}${mainPart}${drinkPart}${menuBoatWa}${gLine}\n${getI18nText("preferences_label", "Preferences")}: ${prefs.join(", ") || "-"}${walkLangWa}${walkTourTimeWa}${walkPartyWa}`;
        })
        .join("\n\n");

      const expName = experienceNameKey
        ? getI18nText(experienceNameKey, experienceName)
        : experienceName;
      const waIntroRaw = getI18nText(
        "orders_wa_intro",
        "Hello! I'd like to book the {experience} experience:"
      );
      const waIntro = waIntroRaw.replace(/\{experience\}/g, expName);
      let message = `${waIntro}\n\n${getI18nText("orders_wa_date_label", "Date")}: ${dateStr}\n${getI18nText("orders_wa_people_line", "People")}: ${peopleCount}`;
      if (boatTotalWa > 0) {
        message += `\n${getI18nText("orders_wa_boat_passengers", "Boat passengers")}: ${boatPassengersWa}`;
        if (!menuWithPerOrderBoat) {
          const bTime = getBoatTimeSlot();
          if (bTime) {
            message += `\n${getI18nText("orders_wa_boat_time", "Boat departure time")}: ${bTime}`;
          }
        }
      } else if (boatScheduleOnlyFlag && boatTimeLSKey && people > 0 && !boatTimePerOrderFlag) {
        const bTimeOnly = getBoatTimeSlot();
        if (bTimeOnly) {
          message += `\n${getI18nText("orders_wa_boat_time", "Boat departure time")}: ${bTimeOnly}`;
        }
      }
      message += `\n\n${ordersText}\n\n`;
      message += `${getI18nText("orders_wa_experience_subtotal", "Experience subtotal")}: ${curLabel} ${experienceSubtotal}`;
      if (guideFee > 0 && !guideOptional && !groupGuideOptional) {
        if (orderWalkingPartyMaxNum > 0 && orderLanguageRadioName) {
          message += ` (${getI18nText(
            "walking_asado_wa_guide_in_subtotal",
            "walking tour guide USD 15 × quantity per order is included in the subtotal"
          )})`;
        } else {
          message += ` (includes USD ${guideFee} guide fee per guest)`;
        }
      } else if (guideOptional && !groupGuideOptional && guideFee > 0) {
        const gt = orders.reduce((s, o) => s + (o && o.includeGuide ? guideFee : 0), 0);
        if (gt > 0) message += ` (includes USD ${gt} in optional guide fees)`;
      }
      message += `\n`;
      if (groupGuideOptional && groupGuideFlat > 0) {
        message += `Group guide (optional, USD ${groupGuideFlat} total for the group): ${gg > 0 ? `Yes — USD ${gg}` : "No"}\n`;
      }
      if (transportTotal > 0) {
        const vehicles = Math.ceil(peopleCount / 4);
        message += `Private transport (${vehicles} vehicle${vehicles === 1 ? "" : "s"} x USD ${vehicleTransportRate}): USD ${transportTotal}\n`;
      }
      if (boatTotalWa > 0) {
        message += `${getI18nText("orders_wa_boat_subtotal", "Boat")} (${boatPassengersWa} × ${curLabel} ${boatRate}): ${curLabel} ${boatTotalWa}\n`;
      }
      message += `${getI18nText("orders_wa_total_label", "Total")}: ${curLabel} ${total}`;

      if (paymentLink) {
        message += `\n\n${getI18nText(
          "orders_wa_pay_confirm",
          "To confirm the reservation, please complete the payment here:"
        )}\n${paymentLink}`;
      } else if (peopleCount > 5) {
        message += `\n\n${getI18nText(
          "orders_wa_group_coordinate",
          "We are a group of more than 5 people and would like to coordinate the reservation."
        )}`;
      } else if (dynamicEnabled) {
        message += `\n\n${getI18nText(
          "orders_wa_payment_pending",
          "Payment link could not be generated automatically yet. Please confirm and we will send it right away."
        )}`;
      }

      return message;
    };

    const storedMatchesRadio = (input, stored) => {
      const s = String(stored || "").trim();
      if (!s) return false;
      if (input.value === s) return true;
      const leg = input.dataset?.legacyValues;
      if (!leg) return false;
      return leg.split("|").some((v) => v.trim() === s);
    };

    const fillPopupForEdit = (order) => {
      popup.querySelectorAll('input[type="radio"]').forEach((i) => {
        if (menuTierRadioName && i.name === menuTierRadioName) return;
        i.checked = false;
      });
      if (standardSideCheckboxName) {
        popup.querySelectorAll(`input[name="${standardSideCheckboxName}"]`).forEach((i) => (i.checked = false));
      }
      if (premiumSideCheckboxName) {
        popup.querySelectorAll(`input[name="${premiumSideCheckboxName}"]`).forEach((i) => (i.checked = false));
      }
      popup.querySelectorAll('.preferences-inside input[type="checkbox"]').forEach((i) => (i.checked = false));

      if (!experienceSkipsMenuChoices) {
      const isPrem = menuUpgradePrice && order.menuTier === "premium";
      if (menuUpgradePrice && menuTierRadioName) {
        const tr = popup.querySelector(
          `input[name="${menuTierRadioName}"][value="${isPrem ? "premium" : "standard"}"]`
        );
        if (tr) tr.checked = true;
        syncMenuTierPanels(!isPrem);
      }

      if (isPrem && premiumSideCheckboxName) {
        const want = [order.starter, order.main].filter((v) => String(v || "").trim());
        popup.querySelectorAll(`input[name="${premiumSideCheckboxName}"]`).forEach((input) => {
          const labelText = input.nextElementSibling?.textContent?.trim();
          const match = (val) =>
            val &&
            (labelText === val || input.value === val || storedMatchesRadio(input, val));
          input.checked = want.some((val) => match(val));
        });
        if (premiumChoiceFieldNames && !experienceSkipsDrinkField) {
          popup.querySelectorAll(`input[name="${premiumChoiceFieldNames.drink}"]`).forEach((input) => {
            const labelText = input.nextElementSibling?.textContent?.trim();
            input.checked =
              labelText === order.drink || input.value === order.drink || storedMatchesRadio(input, order.drink);
          });
        }
      } else if (isPrem && premiumChoiceFieldNames) {
        popup.querySelectorAll(`input[name="${premiumChoiceFieldNames.starter}"]`).forEach((input) => {
          const labelText = input.nextElementSibling?.textContent?.trim();
          input.checked =
            labelText === order.starter ||
            input.value === order.starter ||
            storedMatchesRadio(input, order.starter);
        });
        popup.querySelectorAll(`input[name="${premiumChoiceFieldNames.main}"]`).forEach((input) => {
          const labelText = input.nextElementSibling?.textContent?.trim();
          input.checked =
            labelText === order.main || input.value === order.main || storedMatchesRadio(input, order.main);
        });
        if (!experienceSkipsDrinkField) {
          popup.querySelectorAll(`input[name="${premiumChoiceFieldNames.drink}"]`).forEach((input) => {
            const labelText = input.nextElementSibling?.textContent?.trim();
            input.checked =
              labelText === order.drink || input.value === order.drink || storedMatchesRadio(input, order.drink);
          });
        }
      } else if (!isPrem && standardSideCheckboxName) {
        popup.querySelectorAll(`input[name="${standardSideCheckboxName}"]`).forEach((input) => {
          const labelText = input.nextElementSibling?.textContent?.trim();
          input.checked =
            labelText === order.starter ||
            input.value === order.starter ||
            storedMatchesRadio(input, order.starter);
        });
        if (!experienceSkipsDrinkField) {
          popup.querySelectorAll(`input[name="${drinkName}"]`).forEach((input) => {
            const labelText = input.nextElementSibling?.textContent?.trim();
            input.checked =
              labelText === order.drink || input.value === order.drink || storedMatchesRadio(input, order.drink);
          });
        }
      } else {
        popup.querySelectorAll(`input[name="${starterName}"]`).forEach((input) => {
          const labelText = input.nextElementSibling?.textContent?.trim();
          input.checked =
            labelText === order.starter ||
            input.value === order.starter ||
            storedMatchesRadio(input, order.starter);
        });

        if (!(standardSkipsMainField && menuUpgradePrice && !isPrem)) {
          popup.querySelectorAll(`input[name="${mainName}"]`).forEach((input) => {
            const labelText = input.nextElementSibling?.textContent?.trim();
            input.checked =
              labelText === order.main || input.value === order.main || storedMatchesRadio(input, order.main);
          });
        }

        if (!experienceSkipsDrinkField) {
          popup.querySelectorAll(`input[name="${drinkName}"]`).forEach((input) => {
            const labelText = input.nextElementSibling?.textContent?.trim();
            input.checked =
              labelText === order.drink || input.value === order.drink || storedMatchesRadio(input, order.drink);
          });
        }
        }
      }

      if (menuWithPerOrderBoat && boatTimePopupRadioNameResolved) {
        popup.querySelectorAll(`input[name="${boatTimePopupRadioNameResolved}"]`).forEach((input) => {
          input.checked = String(input.value).trim() === orderBoatTime(order);
        });
      }

      if (experienceSkipsMenuChoices && boatTimePerOrderFlag && boatTimePopupRadioNameResolved) {
        popup.querySelectorAll(`input[name="${boatTimePopupRadioNameResolved}"]`).forEach((input) => {
          input.checked = String(input.value).trim() === String(order.boatDepartureTime || "").trim();
        });
      }

      if (walkingTourTimePerOrderFlag && walkingTourTimePopupRadioNameResolved) {
        popup.querySelectorAll(`input[name="${walkingTourTimePopupRadioNameResolved}"]`).forEach((input) => {
          input.checked = String(input.value).trim() === orderWalkingTourTime(order);
        });
      }

      if (orderLanguageRadioName && String(order.walkingLanguage || "").trim()) {
        const w = String(order.walkingLanguage).trim();
        popup.querySelectorAll(`input[name="${orderLanguageRadioName}"]`).forEach((input) => {
          const labelText = input.nextElementSibling?.textContent?.trim();
          input.checked =
            String(input.value).trim() === w ||
            (labelText && labelText === w) ||
            storedMatchesRadio(input, w);
        });
      }

      const prefsSet = new Set(Array.isArray(order.preferences) ? order.preferences : []);
      popup.querySelectorAll('.preferences-inside input[type="checkbox"]').forEach((input) => {
        const span = input.parentElement?.querySelector("span[data-translate]");
        const trKey = span?.dataset?.translate;
        const encoded = trKey ? encodePref(trKey) : "";
        const labelText = input.parentElement?.textContent?.trim();
        input.checked =
          prefsSet.has(input.value) ||
          Boolean(labelText && prefsSet.has(labelText)) ||
          Boolean(encoded && prefsSet.has(encoded));
      });

      const og = optionalGuideEl();
      if (og && !groupGuideOptional) og.checked = Boolean(order.includeGuide);

      if (typeof afterFillPopupForEdit === "function") {
        try {
          afterFillPopupForEdit(order);
        } catch (err) {
          console.error(err);
        }
      }
    };

    const renderOrders = () => {
      const orders = getOrders();
      if (boatLSKey && orders.length === 0 && getBoatPassengers() > 0) {
        setBoatPassengers(0);
      }
      if (menuWithPerOrderBoat && orders.length === 0) {
        localStorage.removeItem(`${storageKey}_boatPassengers`);
        localStorage.removeItem(`${storageKey}_boatTime`);
      }
      if (boatTimeLSKey && orders.length === 0) {
        setBoatTimeSlot("");
      }
      const people = orders.length;
      const headcount =
        boatTimePerOrderFlag && experienceSkipsMenuChoices
          ? orders.reduce((s, o) => s + orderBoatPax(o), 0)
          : people;
      const transportParty = boatTimePerOrderFlag && experienceSkipsMenuChoices ? headcount : people;
      const transportTotal =
        vehicleTransportRate > 0
          ? groupPrivateTransportTotal(transportParty, vehicleTransportRate)
          : 0;
      const t = (key, fallback) => getI18nText(key, fallback);

      let html = `<h3>${escapeHtml(t("your_order", "Your order"))}</h3>`;

      if (orders.length > 0) {
        const addLabel = experienceSkipsMenuChoices
          ? t("add_passenger", "Add passenger or group")
          : t("add_order", "Add Order");
        html = `
          <button id="addGuestBtn" class="add-guest-btn">
            + ${escapeHtml(addLabel)}
          </button>
          <h3>${escapeHtml(t("your_order", "Your order"))}</h3>
        `;
      }

      if (selectedDateKey) {
        html += `<p class="order-summary-visit-date"><strong>${escapeHtml(
          t("orders_visit_date_label", "Visit date")
        )}:</strong> ${escapeHtml(getDateForBooking())}</p>`;
      }

      if (boatTimePerOrderFlag) {
        const slotHintRaw = t(
          "sunset_boat_passengers_per_slot",
          "Up to {max} passengers allowed per departure time."
        ).replace(/\{max\}/g, String(boatMax));
        html += `<p class="sunset-boat-passengers-slot-hint">${escapeHtml(slotHintRaw)}</p>`;
      }

      if (walkingTourTimePerOrderFlag) {
        const slotHintWalk = t(
          "walking_asado_passengers_per_slot",
          "Up to {max} people per walking tour departure time."
        ).replace(/\{max\}/g, String(walkingTourSlotMaxNum));
        html += `<p class="sunset-boat-passengers-slot-hint">${escapeHtml(slotHintWalk)}</p>`;
      }

      const Ls = choiceSectionLabels || {};
      const Lk = choiceSectionLabelKeys || {};
      const defLabS = escapeHtml(
        Lk.starter ? t(Lk.starter, Ls.starter || "Starter") : Ls.starter || t("starter_label", "Starter")
      );
      const defLabM = escapeHtml(
        Lk.main ? t(Lk.main, Ls.main || "Main") : Ls.main || t("main_label", "Main")
      );
      const defLabD = escapeHtml(
        Lk.drink ? t(Lk.drink, Ls.drink || "Drink") : Ls.drink || t("drink_label", "Drink")
      );
      orders.forEach((order, index) => {
        const prefs = (Array.isArray(order.preferences) ? order.preferences : [])
          .map((p) => decoratePref(p))
          .filter((p) => p && p.trim() && p !== "-");
        const guideLine =
          guideOptional && !groupGuideOptional && guideFee > 0
            ? `<p><strong>${escapeHtml(t("guide_accompany_label", "Guide to accompany"))}:</strong> ${order.includeGuide ? escapeHtml(`${getI18nText("yes_word", "Yes")} (+USD ${guideFee})`) : escapeHtml(t("guide_no", "No"))}</p>`
            : "";
        if (experienceSkipsMenuChoices) {
          const cardTitleKey = boatTimePerOrderFlag ? "booking_order_label" : "guest_order_label";
          const cardTitleFb = boatTimePerOrderFlag ? "Booking" : "Guest";
          const pax = boatTimePerOrderFlag
            ? Math.max(1, Math.min(boatMax, Math.floor(Number(order.passengers) || 1)))
            : 1;
          const timeLine =
            boatTimePerOrderFlag && String(order.boatDepartureTime || "").trim()
              ? `<p><strong>${escapeHtml(t("orders_boat_time_label", "Boat departure time"))}:</strong> ${escapeHtml(String(order.boatDepartureTime).trim())}</p>`
              : boatTimePerOrderFlag
                ? `<p><strong>${escapeHtml(t("orders_boat_time_label", "Boat departure time"))}:</strong> <em>${escapeHtml(t("orders_boat_time_not_set", "Choose a time (edit)"))}</em></p>`
                : "";
          const slotPaxCap = boatTimePerOrderFlag ? maxPassengersForOrderIndex(index) : boatMax;
          const paxRow = boatTimePerOrderFlag
            ? `<p class="order-passengers-controls"><strong>${escapeHtml(t("passengers_label", "Passengers"))}:</strong> <button type="button" class="add-guest-btn"${
                pax <= 1 ? " disabled" : ""
              } data-order-passengers-action="minus" data-index="${index}">−</button> <span class="order-pax-count">${pax}</span> <button type="button" class="add-guest-btn"${
                pax >= slotPaxCap ? " disabled" : ""
              } data-order-passengers-action="plus" data-index="${index}">+</button></p>`
            : "";
          html += `
          <div class="order-card">
            <div class="order-header">
              <strong class="order-card-title">${escapeHtml(t(cardTitleKey, cardTitleFb))} ${index + 1}</strong>
              <div class="order-actions">
                <span class="edit-order" data-index="${index}">✏️</span>
                <span class="delete-order" data-index="${index}">🗑️</span>
              </div>
            </div>
            ${timeLine}
            ${guideLine}
            ${paxRow}
            ${
              prefs.length > 0
                ? `<p><strong>${escapeHtml(t("preferences_label", "Preferences"))}:</strong> ${escapeHtml(prefs.join(", "))}</p>`
                : ""
            }
          </div>
        `;
          return;
        }
        const prem = menuUpgradePrice && order.menuTier === "premium";
        const labS =
          prem && !uniformTierChoiceLabels
            ? escapeHtml(t("bruma_premium_label_plate", "Plate"))
            : defLabS;
        const labM =
          prem && !uniformTierChoiceLabels
            ? escapeHtml(t("bruma_premium_label_dessert", "Dessert"))
            : defLabM;
        const labD = defLabD;
        const tierCardPrem =
          tierSummaryPremiumKey
            ? t(tierSummaryPremiumKey, tierSummaryPremium || "")
            : tierSummaryPremium || t("bruma_order_tier_premium", "Premium · USD 45");
        const tierCardStd =
          tierSummaryStandardKey
            ? t(tierSummaryStandardKey, tierSummaryStandard || "")
            : tierSummaryStandard || t("bruma_order_tier_standard", "Standard · from USD 35");
        const tierRow =
          menuUpgradePrice
            ? `<p class="order-menu-tier"><strong>${escapeHtml(t("bruma_order_tier_label", "Menu"))}:</strong> ${escapeHtml(
                prem ? tierCardPrem : tierCardStd
              )}</p>`
            : "";
        const servingNoteRow =
          menuUpgradePrice && tierServingNotesI18n
            ? `<p class="order-tier-serving-note">${escapeHtml(
                t(
                  prem ? tierServingNotesI18n.premium : tierServingNotesI18n.standard,
                  prem
                    ? "Generally enough for about 4 people."
                    : "Generally enough for about 2–3 people."
                )
              )}</p>`
            : "";
        const walkLangLabelKey = orderLanguageSummaryLabelKey || "walking_label_language";
        const walkLangLabelFb = orderLanguageSummaryLabelKey ? "Guided tour" : "Language";
        const walkLangRow =
          orderLanguageRadioName && String(order.walkingLanguage || "").trim()
            ? `<p><strong>${escapeHtml(t(walkLangLabelKey, walkLangLabelFb))}:</strong> ${escapeHtml(
                getLocalizedChoice(orderLanguageRadioName, order.walkingLanguage)
              )}</p>`
            : "";
        const walkTourT = orderWalkingTourTime(order);
        const slotsWt = Array.isArray(walkingTourTimeSlots) ? walkingTourTimeSlots : [];
        const walkTourRadioName = `orderWalkingTourTime_${String(storageKey).replace(/[^a-zA-Z0-9_-]/g, "_")}_${index}`;
        const walkTourTimeBlock =
          walkingTourTimePerOrderFlag && slotsWt.length
            ? `<div class="order-card-walking-tour-times">
            <p class="orders-boat-time-heading"><strong>${escapeHtml(
              t("walking_asado_orders_tour_time_label", "Walking tour time")
            )}</strong></p>
            <div class="orders-boat-times" role="radiogroup" aria-label="${escapeHtml(
              t("walking_asado_orders_tour_time_label", "Walking tour time")
            )}">${slotsWt
              .map((slot) => {
                const esc = escapeHtml(slot);
                const checked = walkTourT === slot ? " checked" : "";
                return `<label class="orders-boat-time-option"><input type="radio" class="order-walking-tour-time-input" name="${escapeHtml(
                  walkTourRadioName
                )}" value="${esc}" data-order-walking-tour-index="${index}"${checked}/> ${esc}</label>`;
              })
              .join("")}</div></div>`
            : "";
        const wParty =
          orderWalkingPartyMaxNum > 0 && orderLanguageRadioName ? walkingPartyForOrder(order) : 1;
        const walkingSlotCap =
          walkingTourTimePerOrderFlag && walkTourT ? maxWalkingPartyForOrderIndex(index) : orderWalkingPartyMaxNum;
        const walkingPartyRow =
          orderWalkingPartyMaxNum > 0 && orderLanguageRadioName
            ? `<p class="order-passengers-controls"><strong>${escapeHtml(
                t("walking_asado_quantity_label", "Quantity")
              )}:</strong> <button type="button" class="add-guest-btn"${
                wParty <= 1 ? " disabled" : ""
              } data-walking-party-action="minus" data-index="${index}">−</button> <span class="order-pax-count">${wParty}</span> <button type="button" class="add-guest-btn"${
                wParty >= walkingSlotCap ? " disabled" : ""
              } data-walking-party-action="plus" data-index="${index}">+</button></p>`
            : "";
        const stdSkipsMainRow =
          Boolean(standardSkipsMainField && menuUpgradePrice && !prem);
        const premOmitsSecondSide = prem && !String(order.main || "").trim();
        const mainRow =
          stdSkipsMainRow || premOmitsSecondSide
            ? ""
            : `<p><strong>${labM}:</strong> ${escapeHtml(getLocalizedChoice(mainName, order.main))}</p>`;
        const drinkRow = experienceSkipsDrinkField
          ? ""
          : `<p><strong>${labD}:</strong> ${escapeHtml(getLocalizedChoice(drinkName, order.drink))}</p>`;
        const boatHintMenu = t("orders_boat_each_hint", "USD {price} per person").replace(
          /\{price\}/g,
          String(boatRate)
        );
        const menuBoatPax = orderBoatPax(order);
        const menuBoatT = orderBoatTime(order);
        const slotCapMenu = maxPassengersForOrderIndex(index);
        const slotsMenu = Array.isArray(boatTimeSlots) ? boatTimeSlots : [];
        const boatMenuRadioName = `orderBoatMenuTime_${String(storageKey).replace(/[^a-zA-Z0-9_-]/g, "_")}_${index}`;
        const lunchAfterPrefsRow =
          menuWithPerOrderBoat && boatRate > 0
            ? `<p class="order-asado-lunch-note">${escapeHtml(
                t(
                  "asado_boat_lunch_after_boat",
                  "Lunch is served at 12:30 after the first boat trip (11:00am departure)."
                )
              )}</p>`
            : "";
        const menuBoatBlock =
          menuWithPerOrderBoat && boatRate > 0
            ? `<div class="order-card-menu-boat">
            <p class="orders-boat-time-heading"><strong>${escapeHtml(t("orders_boat_section_title", "Boat passengers"))}</strong></p>
            <p class="orders-boat-hint">${escapeHtml(boatHintMenu)}</p>
            <div class="orders-boat-times" role="radiogroup" aria-label="${escapeHtml(t("orders_boat_time_label", "Boat departure time"))}">${slotsMenu
              .map((slot) => {
                const esc = escapeHtml(slot);
                const checked = menuBoatT === slot ? " checked" : "";
                return `<label class="orders-boat-time-option"><input type="radio" class="order-boat-menu-time-input" name="${escapeHtml(
                  boatMenuRadioName
                )}" value="${esc}" data-order-boat-menu-index="${index}"${checked}/> ${esc}</label>`;
              })
              .join("")}</div>
            <p class="order-passengers-controls"><strong>${escapeHtml(t("passengers_label", "Passengers"))}:</strong>
              <button type="button" class="add-guest-btn"${
                menuBoatPax <= 0 ? " disabled" : ""
              } data-menu-boat-pax-action="minus" data-index="${index}">−</button>
              <span class="order-pax-count">${menuBoatPax}</span>
              <button type="button" class="add-guest-btn"${
                menuBoatPax >= slotCapMenu ? " disabled" : ""
              } data-menu-boat-pax-action="plus" data-index="${index}">+</button>
            </p>
            <p><strong>${escapeHtml(t("orders_boat_line_total", "Boat subtotal"))}:</strong> ${escapeHtml(curLabel)} ${menuBoatPax * boatRate}</p>
          </div>`
            : "";
        html += `
          <div class="order-card">
            <div class="order-header">
              <strong class="order-card-title">${escapeHtml(t("order_word", "Order"))} ${index + 1}</strong>
              <div class="order-actions">
                <span class="edit-order" data-index="${index}">✏️</span>
                <span class="delete-order" data-index="${index}">🗑️</span>
              </div>
            </div>
            ${tierRow}${servingNoteRow}
            <p><strong>${labS}:</strong> ${escapeHtml(getLocalizedChoice(starterName, order.starter))}</p>
            ${mainRow}
            ${drinkRow}
            ${guideLine}
            <p><strong>${escapeHtml(t("preferences_label", "Preferences"))}:</strong> ${escapeHtml(prefs.join(", ") || "-")}</p>
            ${walkLangRow}
            ${walkTourTimeBlock}
            ${walkingPartyRow}
            ${lunchAfterPrefsRow}
            ${menuBoatBlock}
          </div>
        `;
      });

      if (orders.length > 0) {
        if (boatRate > 0 && !menuWithPerOrderBoat) {
          const bn = getBoatPassengers();
          const boatSub = bn * boatRate;
          const boatHint = t("orders_boat_each_hint", "USD {price} per person").replace(/\{price\}/g, String(boatRate));
          const minusDisabled = bn <= 0 ? " disabled" : "";
          const plusDisabled = bn >= boatMax ? " disabled" : "";
          const bSlot = getBoatTimeSlot();
          const slots = Array.isArray(boatTimeSlots) ? boatTimeSlots : [];
          const timeField =
            boatTimeLSKey && slots.length
              ? `<p class="orders-boat-time-heading"><strong>${escapeHtml(
                  t("orders_boat_time_label", "Boat departure time")
                )}</strong></p><div class="orders-boat-times" role="radiogroup" aria-label="${escapeHtml(
                  t("orders_boat_time_label", "Boat departure time")
                )}">${slots
                  .map((slot) => {
                    const esc = escapeHtml(slot);
                    const checked = bSlot === slot ? " checked" : "";
                    return `<label class="orders-boat-time-option"><input type="radio" name="${escapeHtml(
                      boatTimeRadioName
                    )}" value="${esc}"${checked}/> ${esc}</label>`;
                  })
                  .join("")}</div>`
              : "";
          html += `
          <div class="order-card orders-boat-card">
            <div class="order-header">
              <strong class="order-card-title">${escapeHtml(t("orders_boat_section_title", "Boat passengers"))}</strong>
              <div class="order-actions">
                <button type="button" class="add-guest-btn"${minusDisabled} data-boat-action="minus">${escapeHtml(
            t("walking_minus_person", "- Person")
          )}</button>
                <button type="button" class="add-guest-btn"${plusDisabled} data-boat-action="plus">${escapeHtml(
            t("walking_plus_person", "+ Person")
          )}</button>
              </div>
            </div>
            <p class="orders-boat-hint">${escapeHtml(boatHint)}</p>
            ${timeField}
            <p><strong>${escapeHtml(t("walking_label_people", "People"))}:</strong> ${bn}</p>
            <p><strong>${escapeHtml(t("orders_boat_line_total", "Boat subtotal"))}:</strong> ${escapeHtml(curLabel)} ${boatSub}</p>
          </div>
        `;
        } else if (boatScheduleOnlyFlag && boatTimeLSKey && !boatTimePerOrderFlag) {
          const bSlotSo = getBoatTimeSlot();
          const slotsSo = Array.isArray(boatTimeSlots) ? boatTimeSlots : [];
          const timeFieldSo =
            slotsSo.length > 0
              ? `<p class="orders-boat-time-heading"><strong>${escapeHtml(
                  t("orders_boat_time_label", "Boat departure time")
                )}</strong></p><div class="orders-boat-times" role="radiogroup" aria-label="${escapeHtml(
                  t("orders_boat_time_label", "Boat departure time")
                )}">${slotsSo
                  .map((slot) => {
                    const esc = escapeHtml(slot);
                    const checked = bSlotSo === slot ? " checked" : "";
                    return `<label class="orders-boat-time-option"><input type="radio" name="${escapeHtml(
                      boatTimeRadioName
                    )}" value="${esc}"${checked}/> ${esc}</label>`;
                  })
                  .join("")}</div>`
              : "";
          html += `
          <div class="order-card orders-boat-card orders-boat-card--schedule-only">
            ${timeFieldSo}
          </div>
        `;
        }

        let experienceSubtotal;
        let total;
        let ggAmt = 0; // evita errores en lógica existente

        if (storageKey === "orders_mision") {
          const base = calculateBaseMision(people);
          const menus = calculateMenus(orders);

          experienceSubtotal = menus;
          total = base + menus;

        } else {
          ggAmt = groupGuideAmount();
          experienceSubtotal = groupExperienceSubtotal(orders);
          const boatTotalLine = boatRate > 0 ? getTotalBoatPassengersPaid() * boatRate : 0;
          total = experienceSubtotal + ggAmt + transportTotal + boatTotalLine;
        }
        const orderCountLabel =
          boatTimePerOrderFlag && experienceSkipsMenuChoices
            ? orders.length === 1
              ? t("booking_singular", "booking")
              : t("booking_plural", "bookings")
            : people === 1
              ? t("guest_order_singular", "guest order")
              : t("guest_order_plural", "guest orders");
        const tourPartySum =
          orderWalkingPartyMaxNum > 0 && orderLanguageRadioName
            ? orders.reduce((s, o) => s + walkingPartyForOrder(o), 0)
            : people;
        const summaryBookings =
          boatTimePerOrderFlag && experienceSkipsMenuChoices
            ? `${headcount} ${t("passengers_label", "passengers")} · ${orders.length} ${orderCountLabel}`
            : orderWalkingPartyMaxNum > 0 && orderLanguageRadioName
              ? `${tourPartySum} ${t("walking_label_people", "People")} · ${orders.length} ${orderCountLabel}`
              : `${orders.length} ${orderCountLabel}`;
        const experienceDetailMid = experienceMenuFlatTotal
          ? t("orders_menu_package_group_total", "menu package (group total)")
          : t("experiences_word", "experiences");
        const guideTotalOptional = guideOptional && !groupGuideOptional
          ? orders.reduce((s, o) => s + (o && o.includeGuide ? guideFee : 0), 0)
          : 0;
        let guideDetail = "";
        if (groupGuideOptional && groupGuideFlat > 0) {
          if (ggAmt > 0) guideDetail = ` · ${t("guide_short", "guide")} USD ${ggAmt}`;
        } else if (guideOptional && guideFee > 0) {
          guideDetail =
            guideTotalOptional > 0
              ? ` · ${t("guide_short", "guide")} USD ${guideTotalOptional}`
              : "";
        } else if (guideFee > 0 && !(orderWalkingPartyMaxNum > 0 && orderLanguageRadioName)) {
          guideDetail = ` · ${t("guide_short", "guide")} USD ${guideFee}/${t("guest_short", "guest")} ${t("included_short", "incl.")}`;
        }
        const transportDetail =
          transportTotal > 0 ? ` · ${t("transport_word", "transport")} USD ${transportTotal}` : "";
        const boatPassengersUi = boatRate > 0 ? getTotalBoatPassengersPaid() : 0;
        const boatTotalUi = boatPassengersUi * boatRate;
        const boatDetail =
          boatTotalUi > 0
            ? ` · ${t("orders_boat_short", "boat")} ${curLabel} ${boatTotalUi} (${boatPassengersUi}×${boatRate})`
            : "";
        html += `
          <div class="total-box">
            <div class="total-left">
              <span class="total-label">${escapeHtml(t("total_label", "Total"))}</span>
              <span class="total-detail">${escapeHtml(summaryBookings)} · ${escapeHtml(experienceDetailMid)} ${escapeHtml(curLabel)} ${experienceSubtotal}${boatDetail}${guideDetail}${transportDetail}</span>
            </div>
            <div class="total-right">
              ${escapeHtml(curLabel)} ${total}
            </div>
            <a href="#" id="bookWithOrder" class="btn total-btn">
              ${escapeHtml(t("book_btn", "Book Now"))}
            </a>
          </div>
        `;
      }

      container.innerHTML = html;
      syncGroupGuideWrap();
    };

    container.addEventListener("change", (e) => {
      const t = e.target;
      if (t && t.classList && t.classList.contains("order-boat-menu-time-input") && t.checked && menuWithPerOrderBoat) {
        const idx = Number(t.dataset.orderBoatMenuIndex);
        const slot = String(t.value || "").trim();
        const list = getOrders();
        const o = list[idx];
        if (!o) return;
        const pax = orderBoatPax(o);
        if (pax > 0 && !boatTimeSlotHasRoom(slot, pax, idx)) {
          alert(
            getI18nText(
              "orders_boat_slot_full",
              "This departure time already has the maximum number of passengers. Choose another time or reduce passengers in another booking."
            )
          );
          renderOrders();
          return;
        }
        list[idx] = { ...o, boatDepartureTime: slot };
        setOrders(list);
        renderOrders();
        return;
      }
      const wtWalk = e.target;
      if (
        wtWalk &&
        wtWalk.classList &&
        wtWalk.classList.contains("order-walking-tour-time-input") &&
        wtWalk.checked &&
        walkingTourTimePerOrderFlag
      ) {
        const idx = Number(wtWalk.dataset.orderWalkingTourIndex);
        const slotW = String(wtWalk.value || "").trim();
        const listW = getOrders();
        const ow = listW[idx];
        if (!ow) return;
        const partyW = walkingPartyForOrder(ow);
        if (!walkingTourSlotHasRoom(slotW, partyW, idx)) {
          alert(
            getI18nText(
              "orders_boat_slot_full",
              "This departure time already has the maximum number of passengers. Choose another time or reduce passengers in another booking."
            )
          );
          renderOrders();
          return;
        }
        listW[idx] = { ...ow, walkingTourDepartureTime: slotW };
        setOrders(listW);
        renderOrders();
        return;
      }
      if (!boatTimeRadioName || !boatTimeLSKey) return;
      if (t && t.name === boatTimeRadioName && t.type === "radio" && t.checked) {
        setBoatTimeSlot(t.value);
        renderOrders();
      }
    });

    // Event delegation (una sola vez)
    container.addEventListener("click", (e) => {
      const target = e.target;

      const addBtn = target.closest && target.closest("#addGuestBtn");
      if (addBtn) {
        e.preventDefault();
        openPopupForNewOrder();
        return;
      }

      const boatActEl = target.closest && target.closest("[data-boat-action]");
      if (boatActEl && boatLSKey) {
        e.preventDefault();
        if (boatActEl.disabled) return;
        const act = boatActEl.getAttribute("data-boat-action");
        const curBn = getBoatPassengers();
        if (act === "minus") {
          setBoatPassengers(curBn - 1);
          if (getBoatPassengers() <= 0 && boatTimeLSKey) setBoatTimeSlot("");
        } else if (act === "plus") {
          setBoatPassengers(curBn + 1);
        }
        renderOrders();
        return;
      }

      const walkingPartyEl = target.closest && target.closest("[data-walking-party-action]");
      if (walkingPartyEl && orderWalkingPartyMaxNum > 0 && orderLanguageRadioName) {
        e.preventDefault();
        if (walkingPartyEl.disabled) return;
        const idx = Number(walkingPartyEl.dataset.index);
        const ordList = getOrders();
        const o = ordList[idx];
        if (!o) return;
        let p = walkingPartyForOrder(o);
        const act = walkingPartyEl.getAttribute("data-walking-party-action");
        const walkCap =
          walkingTourTimePerOrderFlag && orderWalkingTourTime(o)
            ? maxWalkingPartyForOrderIndex(idx)
            : orderWalkingPartyMaxNum;
        if (act === "minus") p = Math.max(1, p - 1);
        else if (act === "plus") {
          if (p >= walkCap) {
            alert(
              getI18nText(
                "orders_boat_slot_full_short",
                "No more seats for this departure time. Add another booking with a different time or reduce passengers elsewhere."
              )
            );
            return;
          }
          p = Math.min(walkCap, p + 1);
        }
        ordList[idx] = { ...o, walkingPartyCount: p };
        setOrders(ordList);
        renderOrders();
        return;
      }

      const menuBoatPaxEl = target.closest && target.closest("[data-menu-boat-pax-action]");
      if (menuBoatPaxEl && menuWithPerOrderBoat) {
        e.preventDefault();
        if (menuBoatPaxEl.disabled) return;
        const idx = Number(menuBoatPaxEl.dataset.index);
        const ordList = getOrders();
        const o = ordList[idx];
        if (!o) return;
        let p = orderBoatPax(o);
        const act = menuBoatPaxEl.getAttribute("data-menu-boat-pax-action");
        const t = orderBoatTime(o);
        const slotCap = t ? maxPassengersForOrderIndex(idx) : boatMax;
        if (act === "minus") {
          p = Math.max(0, p - 1);
        } else if (act === "plus") {
          if (p >= slotCap) {
            alert(
              getI18nText(
                "orders_boat_slot_full_short",
                "No more seats for this departure time. Add another booking with a different time or reduce passengers elsewhere."
              )
            );
            return;
          }
          p = Math.min(slotCap, p + 1);
        }
        const next = { ...o, boatPassengers: p };
        if (p === 0) next.boatDepartureTime = "";
        ordList[idx] = next;
        setOrders(ordList);
        renderOrders();
        return;
      }

      const paxActEl = target.closest && target.closest("[data-order-passengers-action]");
      if (paxActEl && boatTimePerOrderFlag && experienceSkipsMenuChoices) {
        e.preventDefault();
        if (paxActEl.disabled) return;
        const idx = Number(paxActEl.dataset.index);
        const ordList = getOrders();
        const o = ordList[idx];
        if (!o) return;
        let p = Math.max(1, Math.min(boatMax, Math.floor(Number(o.passengers) || 1)));
        const act = paxActEl.getAttribute("data-order-passengers-action");
        const slotCap = maxPassengersForOrderIndex(idx);
        if (act === "minus") p = Math.max(1, p - 1);
        else if (act === "plus") {
          if (p >= slotCap) {
            alert(
              getI18nText(
                "orders_boat_slot_full_short",
                "No more seats for this departure time. Add another booking with a different time or reduce passengers elsewhere."
              )
            );
            return;
          }
          p = Math.min(slotCap, p + 1);
        }
        ordList[idx] = { ...o, passengers: p };
        setOrders(ordList);
        renderOrders();
        return;
      }

      const delEl = target.closest && target.closest(".delete-order");
      if (delEl) {
        const idx = Number(delEl.dataset.index);
        const orders = getOrders();
        orders.splice(idx, 1);
        setOrders(orders);
        renderOrders();
        return;
      }

      const editEl = target.closest && target.closest(".edit-order");
      if (editEl) {
        const idx = Number(editEl.dataset.index);
        const orders = getOrders();
        const order = orders[idx];
        if (!order) return;

        editingIndex = idx;
        fillPopupForEdit(order);
        popup.classList.add("active");
        saveBtn.textContent = getI18nText("update_order", "Update order");
        return;
      }

      const bookEl = target.closest && target.closest("#bookWithOrder");
      if (bookEl) {
        e.preventDefault();
        const orders = getOrders();
        if (orders.length === 0) return;
        if (!boatBookReady()) return;
        const pendingTab = window.open("about:blank", "_blank");
        (async () => {
          const peopleCount = peopleCountForPayment(orders);
          const transportTotal =
            vehicleTransportRate > 0 ? groupPrivateTransportTotal(peopleCount, vehicleTransportRate) : 0;
          const experienceSubtotal = groupExperienceSubtotal(orders);
          const ggAmt = groupGuideAmount();
          const boatPassengersPay = boatRate > 0 ? getTotalBoatPassengersPaid() : 0;
          const boatTotalPay = boatPassengersPay * boatRate;
          const total = experienceSubtotal + ggAmt + transportTotal + boatTotalPay;
          const boatTimesPayload = buildBoatTimesPayload(orders);
          let paymentUrl = "";
          try {
            paymentUrl = await resolveDynamicPaymentLink(dynamicPayment, {
              experience: dynamicPayment?.experienceId || experienceName,
              amount: total,
              currency: dynamicPayment?.currency || "USD",
              people: peopleCount,
              orderFingerprint: stableStringify({
                orders,
                total,
                people: peopleCount,
                groupGuide: ggAmt,
                boatPassengers: boatPassengersPay,
                boatPerPerson: boatRate,
                boatDepartureTime: boatTimesPayload
              }),
              orderPayload: {
                orders,
                total,
                people: peopleCount,
                experienceName,
                groupGuideFlat: ggAmt,
                boatPassengers: boatPassengersPay,
                boatPerPerson: boatRate,
                boatSubtotal: boatTotalPay,
                boatDepartureTime: boatTimesPayload
              }
            });
          } catch {}
          const message = buildWhatsAppMessage(orders, getDateForBooking(), paymentUrl);
          const waUrl = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}`;
          if (pendingTab && !pendingTab.closed) {
            pendingTab.location.href = waUrl;
          } else {
            window.open(waUrl, "_blank");
          }
        })();
      }
    });

    if (groupGuideOptional && groupGuideCheckboxId) {
      const gel = groupGuideEl();
      if (gel) {
        gel.checked = getGroupGuideStored();
        gel.addEventListener("change", () => {
          setGroupGuideStored(gel.checked);
          renderOrders();
        });
      }
    }

    document.addEventListener("sacramento:setLanguage", () => renderOrders());

    document.addEventListener("sacramento:visitDateChanged", (e) => {
      if (!selectedDateKey) return;
      if (e.detail && e.detail.key && e.detail.key !== selectedDateKey) return;
      renderOrders();
    });

    if (menuUpgradePrice && menuTierPanelIds) {
      syncMenuTierPanels(true);
    }

    renderOrders();

    if (bookNowBottomId) {
      const bottomBtn = document.getElementById(bookNowBottomId);
      if (bottomBtn) {
        bottomBtn.addEventListener("click", (e) => {
          e.preventDefault();
          const orders = getOrders();
          if (orders.length === 0) {
            alert(getI18nText("orders_alert_create_first", "Please create your order first."));
            return;
          }
          if (!boatBookReady()) return;
          const pendingTab = window.open("about:blank", "_blank");
          (async () => {
            const peopleCount = peopleCountForPayment(orders);
            const transportTotal =
              vehicleTransportRate > 0 ? groupPrivateTransportTotal(peopleCount, vehicleTransportRate) : 0;
            const experienceSubtotal = groupExperienceSubtotal(orders);
            const ggAmt = groupGuideAmount();
            const boatPassengersPay = boatRate > 0 ? getTotalBoatPassengersPaid() : 0;
            const boatTotalPay = boatPassengersPay * boatRate;
            const total = experienceSubtotal + ggAmt + transportTotal + boatTotalPay;
            const boatTimesPayload = buildBoatTimesPayload(orders);
            let paymentUrl = "";
            try {
              paymentUrl = await resolveDynamicPaymentLink(dynamicPayment, {
                experience: dynamicPayment?.experienceId || experienceName,
                amount: total,
                currency: dynamicPayment?.currency || "USD",
                people: peopleCount,
                orderFingerprint: stableStringify({
                  orders,
                  total,
                  people: peopleCount,
                  groupGuide: ggAmt,
                  boatPassengers: boatPassengersPay,
                  boatPerPerson: boatRate,
                  boatDepartureTime: boatTimesPayload
                }),
                orderPayload: {
                  orders,
                  total,
                  people: peopleCount,
                  experienceName,
                  groupGuideFlat: ggAmt,
                  boatPassengers: boatPassengersPay,
                  boatPerPerson: boatRate,
                  boatSubtotal: boatTotalPay,
                  boatDepartureTime: boatTimesPayload
                }
              });
            } catch {}
            const message = buildWhatsAppMessage(orders, getDateForBooking(), paymentUrl);
            const waUrl = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}`;
            if (pendingTab && !pendingTab.closed) {
              pendingTab.location.href = waUrl;
            } else {
              window.open(waUrl, "_blank");
            }
          })();
        });
      }
    }

    // Re-render texts when language buttons are clicked.
    document.querySelectorAll(".lang-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        renderOrders();
        if (popup.classList.contains("active")) {
          saveBtn.textContent =
            editingIndex !== null
              ? getI18nText("update_order", "Update order")
              : getI18nText("save_selection", "Save selection");
        }
      });
    });
  });
}

/**
 * Init para la página "Food" donde hay un menú principal y, si eliges "tourist",
 * aparecen opciones extra (starter + touristMain) dentro de #touristOptions.
 */
function initFoodExperience(config) {
  const {
    pricePerPerson,
    experienceName = "Food",
    experienceNameKey = null,
    whatsappNumber = "598091642195",
    popupId = "popupBruma",
    closeBtnId = "closeBruma",
    createBtnId = "createMenuBtn",
    saveBtnId = "saveMenu",
    orderSummaryId = "orderSummary",
    touristOptionsId = "touristOptions",
    bookNowBottomId,
    storageKey = "orders",
    dynamicPayment = null,
    whatsappIncludesTitleKey = null,
    whatsappIncludesKeys = [],
    mainName = "main",
    starterName = "starter",
    touristMainName = "touristMain",
    defaultMainValue = ""
  } = config || {};

  if (!pricePerPerson) {
    console.error("initFoodExperience: config incompleta (pricePerPerson)");
    return;
  }

  document.addEventListener("DOMContentLoaded", () => {
    let editingIndex = null;
    const getI18nText = (key, fallback) => {
      const lang = localStorage.getItem("selectedLanguage") || "en";
      const tr = sacramentoI18nTable();
      try {
        if (tr?.[lang]?.[key]) return tr[lang][key];
        if (tr?.en?.[key]) return tr.en[key];
      } catch {}
      return fallback;
    };
    const I18N_PREF_PREFIX = SACRAMENTO_I18N_PREF;
    const normalizePrefText = sacramentoNormalizePrefText;
    const encodePref = (keyOrLabel) => {
      const raw = String(keyOrLabel || "").trim();
      if (!raw) return "";
      return raw.startsWith(I18N_PREF_PREFIX) ? raw : `${I18N_PREF_PREFIX}${raw}`;
    };
    const decodePref = (storedPref) => sacramentoDecodePrefLabel(storedPref, getI18nText, I18N_PREF_PREFIX);
    const decoratePref = (storedPref) => sacramentoDecoratePref(storedPref, getI18nText, I18N_PREF_PREFIX);

    const FOOD_MEAL_I18N_KEYS = [
      "food_popup_main_1",
      "food_popup_main_2",
      "food_popup_main_3",
      "food_tourist_starter_1",
      "food_tourist_starter_2",
      "food_tourist_starter_3",
      "food_tourist_main_1",
      "food_tourist_main_2",
      "food_tourist_main_3"
    ];
    const mealLabelMap = (() => {
      const map = Object.create(null);
      try {
        ["en", "es", "pt"].forEach((lang) => {
          FOOD_MEAL_I18N_KEYS.forEach((key) => {
            const t = sacramentoI18nTable()?.[lang]?.[key];
            if (t) map[normalizePrefText(t)] = key;
          });
        });
      } catch {}
      return map;
    })();
    const mainRadioValueToKey = {
      chivito: "food_popup_main_1",
      milanesa: "food_popup_main_2",
      tourist: "food_popup_main_3"
    };

    const escapeHtml = (str) =>
      String(str).replace(/[&<>"']/g, (m) => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
      }[m]));

    const getOrders = () => {
      try {
        const parsed = JSON.parse(localStorage.getItem(storageKey)) || [];
        if (!Array.isArray(parsed)) return [];
        let mutated = false;
        const migrated = parsed.map((order) => {
          if (!order) return order;
          let next = { ...order };
          if (!Array.isArray(next.preferences)) next.preferences = [];

          const nextPrefs = next.preferences.map((pref) => {
            const raw = String(pref || "").trim();
            if (!raw) return raw;
            if (raw.startsWith(I18N_PREF_PREFIX)) return raw;
            const legacyKey = sacramentoLegacyPrefKey(raw);
            if (!legacyKey) return raw;
            mutated = true;
            return encodePref(legacyKey);
          });
          next.preferences = nextPrefs;

          ["main", "starter", "touristMain"].forEach((field) => {
            const v = next[field];
            if (v == null || v === "") return;
            const str = String(v).trim();
            if (!str || str.startsWith(I18N_PREF_PREFIX)) return;
            if (field === "main") {
              const aliasKey = mainRadioValueToKey[str.toLowerCase()];
              if (aliasKey) {
                next[field] = encodePref(aliasKey);
                mutated = true;
                return;
              }
            }
            const mapped = mealLabelMap[normalizePrefText(str)];
            if (mapped) {
              next[field] = encodePref(mapped);
              mutated = true;
            }
          });

          return next;
        });
        if (mutated) {
          localStorage.setItem(storageKey, JSON.stringify(migrated));
        }
        return migrated;
      } catch {
        return [];
      }
    };

    const setOrders = (orders) => {
      localStorage.setItem(storageKey, JSON.stringify(orders));
    };

    const popup = document.getElementById(popupId);
    const closeBtn = document.getElementById(closeBtnId);
    const createBtn = document.getElementById(createBtnId);
    const saveBtn = document.getElementById(saveBtnId);
    const container = document.getElementById(orderSummaryId);
    const touristBlock = document.getElementById(touristOptionsId);

    if (!popup || !closeBtn || !createBtn || !saveBtn || !container || !touristBlock) return;

    const resetPopup = () => {
      popup.querySelectorAll('input[type="radio"]').forEach((i) => (i.checked = false));
      popup.querySelectorAll('.preferences-inside input[type="checkbox"]').forEach((i) => (i.checked = false));
      touristBlock.style.display = "none";
      if (defaultMainValue) {
        const defaultMain = popup.querySelector(`input[name="${mainName}"][value="${defaultMainValue}"]`);
        if (defaultMain) {
          defaultMain.checked = true;
          touristBlock.style.display = defaultMainValue === "tourist" ? "block" : "none";
        }
      }
    };

    // Mostrar/ocultar opciones "tourist"
    popup.querySelectorAll(`input[name="${mainName}"]`).forEach((opt) => {
      opt.addEventListener("change", () => {
        if (opt.checked && opt.value === "tourist") {
          touristBlock.style.display = "block";
        } else {
          touristBlock.style.display = "none";
        }
      });
    });

    createBtn.addEventListener("click", (e) => {
      e.preventDefault();
      editingIndex = null;
      saveBtn.textContent = getI18nText("save_selection", "Save selection");
      resetPopup();
      popup.classList.add("active");
    });

    closeBtn.addEventListener("click", (e) => {
      e.preventDefault();
      popup.classList.remove("active");
    });

    saveBtn.addEventListener("click", (e) => {
      e.preventDefault();

      const orders = getOrders();

      const main = popup.querySelector(`input[name="${mainName}"]:checked`);
      if (!main) {
        alert(getI18nText("food_alert_select_meal", "Select a meal"));
        return;
      }

      const mainSpan =
        main.parentElement?.querySelector("span[data-translate]") ||
        (main.nextElementSibling?.matches?.("[data-translate]") ? main.nextElementSibling : null);
      const mainI18nKey = mainSpan?.dataset?.translate;
      const mainVal = String(main.value || "").trim();
      const mainStored = mainI18nKey
        ? encodePref(mainI18nKey)
        : mainRadioValueToKey[mainVal.toLowerCase()]
          ? encodePref(mainRadioValueToKey[mainVal.toLowerCase()])
          : mainVal;

      const preferences = Array.from(
        popup.querySelectorAll('.preferences-inside input[type="checkbox"]:checked')
      ).map((el) => {
        const trSpan = el.parentElement?.querySelector("span[data-translate]");
        const trKey = trSpan?.dataset?.translate;
        if (trKey) return encodePref(trKey);
        return el.parentElement.textContent.trim();
      });

      let starter = null;
      let touristMain = null;

      if (main.value === "tourist") {
        const starterSelected = touristBlock.querySelector(`input[name="${starterName}"]:checked`);
        const touristMainSelected = touristBlock.querySelector(`input[name="${touristMainName}"]:checked`);

        if (!starterSelected || !touristMainSelected) {
          alert(
            getI18nText(
              "food_alert_complete_tourist",
              "Please choose starter and main for the tourist menu"
            )
          );
          return;
        }

        const stSpan = starterSelected.parentElement?.querySelector("span[data-translate]");
        const stKey = stSpan?.dataset?.translate;
        starter = stKey ? encodePref(stKey) : starterSelected.parentElement.textContent.trim();

        const tmSpan = touristMainSelected.parentElement?.querySelector("span[data-translate]");
        const tmKey = tmSpan?.dataset?.translate;
        touristMain = tmKey
          ? encodePref(tmKey)
          : touristMainSelected.parentElement.textContent.trim();
      }

      const order = {
        main: mainStored,
        starter,
        touristMain,
        preferences
      };

      if (editingIndex !== null) {
        orders[editingIndex] = order;
        editingIndex = null;
      } else {
        orders.push(order);
      }

      setOrders(orders);
      popup.classList.remove("active");
      renderOrders();
    });

    const renderOrders = () => {
      const orders = getOrders();

      let html = `
        <div class="order-container">
          <h2>${escapeHtml(getI18nText("your_order", "Your order"))}</h2>
      `;

      if (orders.length > 0) {
        html += `
          <button id="addGuestBtn" class="add-guest-btn">
            + ${escapeHtml(getI18nText("add_order", "Add Order"))}
          </button>
        `;
      }

      orders.forEach((order, i) => {
        const mainDisplay = order.touristMain ? decodePref(order.touristMain) : decodePref(order.main);
        const prefs = Array.isArray(order.preferences) ? order.preferences : [];
        const prefsLocalized = prefs.map((p) => decoratePref(p)).filter(Boolean);

        html += `
          <div class="order-card">
            <div class="order-header">
              <h3 class="order-card-title">${escapeHtml(getI18nText("order_word", "Order"))} ${i + 1}</h3>
              <div class="order-actions">
                <span class="edit-order" data-index="${i}">✏️</span>
                <span class="delete-order" data-index="${i}">🗑️</span>
              </div>
            </div>
            <p><strong>${escapeHtml(getI18nText("bruma_popup_main", "Main Course"))}:</strong> ${escapeHtml(mainDisplay || "-")}</p>
            ${order.starter ? `<p><strong>${escapeHtml(getI18nText("bruma_popup_starter", "Starter"))}:</strong> ${escapeHtml(decodePref(order.starter))}</p>` : ""}
            ${order.touristMain ? `<p><strong>${escapeHtml(getI18nText("dessert_word", "Dessert"))}:</strong> ${escapeHtml(getI18nText("food_tourist_dessert_1", "Traditional Uruguayan Chajá"))}</p>` : ""}
            <p><strong>${escapeHtml(getI18nText("preferences_word", "Preferences"))}:</strong> ${escapeHtml(prefsLocalized.join(", ") || "-")}</p>
          </div>
        `;
      });

      if (orders.length > 0) {
        const total = orders.length * pricePerPerson;
        html += `
          <div class="total-box">
            <div class="total-left">
              <span class="total-label">Total</span>
              <span class="total-detail">(${orders.length} x USD ${pricePerPerson})</span>
            </div>
            <div class="total-right">
              USD ${total}
            </div>
            <a href="#" id="bookWithOrder" class="btn total-btn">
              ${escapeHtml(getI18nText("book_btn", "Book Now"))}
            </a>
          </div>
        `;
      }

      html += `</div>`;
      container.innerHTML = html;
    };

    const buildFoodWhatsAppMessage = (orders, paymentLinkOverride = "") => {
      const waIntro = getI18nText(
        "wa_booking_intro",
        "Hello! I’d like to book the"
      );
      const waExperienceWord = getI18nText("wa_experience_word", "experience");
      const waOrderWord = getI18nText("order_word", "Order");
      const waTotalLabel = getI18nText("wa_total_label", "Total");
      const waMainLabel = getI18nText("bruma_popup_main", "Main Course");
      const waStarterLabel = getI18nText("bruma_popup_starter", "Starter");
      const waDessertLabel = getI18nText("dessert_word", "Dessert");
      const waPreferencesLabel = getI18nText("preferences_word", "Preferences");
      const localizedExperienceName = experienceNameKey
        ? getI18nText(experienceNameKey, experienceName)
        : experienceName;
      const normalizedExpName = String(localizedExperienceName || "").trim().toLowerCase();
      const normalizedExpWord = String(waExperienceWord || "").trim().toLowerCase();
      const includeExpWord =
        normalizedExpWord &&
        !normalizedExpName.endsWith(normalizedExpWord);
      const waLine = [waIntro, localizedExperienceName, includeExpWord ? waExperienceWord : ""]
        .filter(Boolean)
        .join(" ");
      let message = `${waLine}:\n\n`;
      if (Array.isArray(whatsappIncludesKeys) && whatsappIncludesKeys.length > 0) {
        const includesTitle = whatsappIncludesTitleKey
          ? getI18nText(whatsappIncludesTitleKey, "What's included")
          : getI18nText("wa_includes_label", "What's included");
        message += `*${includesTitle}:*\n`;
        whatsappIncludesKeys.forEach((key) => {
          const line = getI18nText(key, key);
          message += `• ${line}\n`;
        });
        message += `\n`;
      }
      orders.forEach((o, i) => {
        const mainDisplay = o.touristMain ? decodePref(o.touristMain) : decodePref(o.main);
        const prefs = Array.isArray(o.preferences) ? o.preferences : [];
        const prefsLocalized = prefs.map((p) => decoratePref(p)).filter(Boolean);
        message += `*${waOrderWord} ${i + 1}*\n`;
        message += `${waMainLabel}: ${mainDisplay || "-"}\n`;
        if (o.starter) {
          message += `${waStarterLabel}: ${decodePref(o.starter)}\n`;
        }
        if (o.touristMain) {
          message += `${waDessertLabel}: ${getI18nText("food_tourist_dessert_1", "Traditional Uruguayan Chajá")}\n`;
        }
        message += `${waPreferencesLabel}: ${prefsLocalized.join(", ") || "-"}\n\n`;
      });
      const total = orders.length * pricePerPerson;
      message += `*${waTotalLabel}:* USD ${total}`;
      if (paymentLinkOverride) {
        message += `\n\n${getI18nText("wa_payment_cta", "To confirm the reservation, please complete the payment here:")}\n${paymentLinkOverride}`;
        message += `\n\n${getI18nText(
          "food_post_payment_note",
          "After payment, we will send your reservation details and instructions."
        )}`;
      }
      return { message, total };
    };

    container.addEventListener("click", (e) => {
      const target = e.target;

      const addBtn = target.closest && target.closest("#addGuestBtn");
      if (addBtn) {
        e.preventDefault();
        editingIndex = null;
        saveBtn.textContent = getI18nText("save_selection", "Save selection");
        resetPopup();
        popup.classList.add("active");
        return;
      }

      const delEl = target.closest && target.closest(".delete-order");
      if (delEl) {
        const idx = Number(delEl.dataset.index);
        const orders = getOrders();
        orders.splice(idx, 1);
        setOrders(orders);
        renderOrders();
        return;
      }

      const editEl = target.closest && target.closest(".edit-order");
      if (editEl) {
        const idx = Number(editEl.dataset.index);
        const orders = getOrders();
        const order = orders[idx];
        if (!order) return;

        editingIndex = idx;
        resetPopup();

        if (order.touristMain) {
          const touristRadio = popup.querySelector(`input[name="${mainName}"][value="tourist"]`);
          if (touristRadio) touristRadio.checked = true;
          touristBlock.style.display = "block";

          popup.querySelectorAll(`input[name="${starterName}"]`).forEach((r) => {
            const span = r.parentElement?.querySelector("span[data-translate]");
            const k = span?.dataset?.translate;
            const enc = k ? encodePref(k) : "";
            const legacyText = r.parentElement?.textContent?.trim();
            if (
              (enc && enc === order.starter) ||
              (legacyText && (legacyText === order.starter || legacyText === decodePref(order.starter)))
            ) {
              r.checked = true;
            }
          });

          touristBlock.querySelectorAll(`input[name="${touristMainName}"]`).forEach((r) => {
            const span = r.parentElement?.querySelector("span[data-translate]");
            const k = span?.dataset?.translate;
            const enc = k ? encodePref(k) : "";
            const legacyText = r.parentElement?.textContent?.trim();
            if (
              (enc && enc === order.touristMain) ||
              (legacyText &&
                (legacyText === order.touristMain || legacyText === decodePref(order.touristMain)))
            ) {
              r.checked = true;
            }
          });
        } else {
          popup.querySelectorAll(`input[name="${mainName}"]`).forEach((r) => {
            const span =
              r.parentElement?.querySelector("span[data-translate]") ||
              (r.nextElementSibling?.matches?.("[data-translate]") ? r.nextElementSibling : null);
            const k = span?.dataset?.translate;
            const enc = k ? encodePref(k) : "";
            const labelText = span?.textContent?.trim();
            if (
              (enc && enc === order.main) ||
              (labelText &&
                (labelText === order.main || labelText === decodePref(order.main)))
            ) {
              r.checked = true;
            }
          });
          touristBlock.style.display = "none";
        }

        const prefSet = new Set(Array.isArray(order.preferences) ? order.preferences : []);
        popup.querySelectorAll('.preferences-inside input[type="checkbox"]').forEach((cb) => {
          const trSpan = cb.parentElement?.querySelector("span[data-translate]");
          const trKey = trSpan?.dataset?.translate;
          const labelText = cb.parentElement?.textContent?.trim();
          const encoded = trKey ? encodePref(trKey) : "";
          cb.checked = (encoded && prefSet.has(encoded)) || prefSet.has(labelText);
        });

        saveBtn.textContent = getI18nText("update_order", "Update order");
        popup.classList.add("active");
        return;
      }

      const bookEl = target.closest && target.closest("#bookWithOrder");
      if (bookEl) {
        e.preventDefault();
        const orders = getOrders();
        if (orders.length === 0) return;
        const pendingTab = window.open("about:blank", "_blank");
        (async () => {
          const base = buildFoodWhatsAppMessage(orders);
          let finalMessage = base.message;
          try {
            const paymentUrl = await resolveDynamicPaymentLink(dynamicPayment, {
              experience: dynamicPayment?.experienceId || experienceName,
              amount: base.total,
              currency: dynamicPayment?.currency || "USD",
              people: orders.length,
              orderFingerprint: stableStringify({ orders, total: base.total }),
              orderPayload: { orders, total: base.total, experienceName }
            });
            if (paymentUrl) {
              finalMessage = buildFoodWhatsAppMessage(orders, paymentUrl).message;
            }
          } catch {}
          const waUrl = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(finalMessage)}`;
          if (pendingTab && !pendingTab.closed) {
            pendingTab.location.href = waUrl;
          } else {
            window.open(waUrl, "_blank");
          }
        })();
      }
    });

    if (bookNowBottomId) {
      const bottomBtn = document.getElementById(bookNowBottomId);
      if (bottomBtn) {
        bottomBtn.addEventListener("click", (e) => {
          e.preventDefault();
          const orders = getOrders();
          if (orders.length === 0) {
            alert(getI18nText("orders_alert_create_first", "Please create your order first."));
            return;
          }
          const pendingTab = window.open("about:blank", "_blank");
          (async () => {
            const base = buildFoodWhatsAppMessage(orders);
            let finalMessage = base.message;
            try {
              const paymentUrl = await resolveDynamicPaymentLink(dynamicPayment, {
                experience: dynamicPayment?.experienceId || experienceName,
                amount: base.total,
                currency: dynamicPayment?.currency || "USD",
                people: orders.length,
                orderFingerprint: stableStringify({ orders, total: base.total }),
                orderPayload: { orders, total: base.total, experienceName }
              });
              if (paymentUrl) {
                finalMessage = buildFoodWhatsAppMessage(orders, paymentUrl).message;
              }
            } catch {}
            const waUrl = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(finalMessage)}`;
            if (pendingTab && !pendingTab.closed) {
              pendingTab.location.href = waUrl;
            } else {
              window.open(waUrl, "_blank");
            }
          })();
        });
      }
    }

    document.querySelectorAll(".lang-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        renderOrders();
        if (popup.classList.contains("active")) {
          saveBtn.textContent =
            editingIndex !== null
              ? getI18nText("update_order", "Update order")
              : getI18nText("save_selection", "Save selection");
        }
      });
    });

    renderOrders();
  });
}

/**
 * Init para experiencias donde el "menú" se define solo por preferencias (checkboxes) dentro de un popup.
 * Guarda en localStorage una lista de "orders" con la forma: { preferences: string[] }.
 */
function initPreferencesOrderExperience(config) {
  const {
    pricePerPerson,
    paymentLinks = {},
    dynamicPayment = null,
    experienceName = "experience",
    popupId,
    createBtnId,
    closeBtnId,
    saveBtnId,
    orderSummaryId = "orderSummary",
    whatsappNumber = "598091642195",
    storageKey = "orders",
    bookNowBottomId
  } = config || {};

  if (!popupId || !createBtnId || !closeBtnId || !saveBtnId || !orderSummaryId) {
    console.error("initPreferencesOrderExperience: config incompleta");
    return;
  }

  document.addEventListener("DOMContentLoaded", () => {
    let editingIndex = null;

    const popup = document.getElementById(popupId);
    const createBtn = document.getElementById(createBtnId);
    const closeBtn = document.getElementById(closeBtnId);
    const saveBtn = document.getElementById(saveBtnId);
    const container = document.getElementById(orderSummaryId);

    if (!popup || !createBtn || !closeBtn || !saveBtn || !container) return;

    const escapeHtml = (str) =>
      String(str).replace(/[&<>"']/g, (m) => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
      }[m]));

    const getOrders = () => {
      try {
        return JSON.parse(localStorage.getItem(storageKey)) || [];
      } catch {
        return [];
      }
    };

    const setOrders = (orders) => {
      localStorage.setItem(storageKey, JSON.stringify(orders));
    };

    const preferenceCheckboxes = () =>
      popup.querySelectorAll(".preferences-inside input[type='checkbox']");

    const readSelectedPreferences = () =>
      Array.from(preferenceCheckboxes())
        .filter((i) => i.checked)
        .map((i) => i.value)
        .filter(Boolean);

    const resetPopup = () => {
      preferenceCheckboxes().forEach((i) => {
        i.checked = false;
      });
      editingIndex = null;
      saveBtn.textContent = "Save selection";
    };

    const openPopup = () => {
      resetPopup();
      popup.classList.add("active");
      popup.setAttribute("aria-hidden", "false");
    };

    const closePopup = () => {
      popup.classList.remove("active");
      popup.setAttribute("aria-hidden", "true");
    };

    const formatDate = () =>
      new Date().toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric"
      });

    const buildWhatsAppMessage = (orders, paymentLinkOverride = "") => {
      const people = orders.length;
      const date = formatDate();

      let ordersText = "";
      orders.forEach((o, i) => {
        const prefs = Array.isArray(o.preferences) ? o.preferences : [];
        ordersText += `*Order ${i + 1}*\nPreferences: ${prefs.join(", ") || "-"}\n\n`;
      });

      const dynamicEnabled = Boolean(dynamicPayment && dynamicPayment.enabled);
      const paymentLink = paymentLinkOverride || (!dynamicEnabled ? paymentLinks[people] || "" : "");
      let message = `Hello! I’d like to book the ${experienceName} experience:\n\nDate: ${date}\nPeople: ${people}\n\n${ordersText}Total: USD ${people * pricePerPerson}\n`;

      if (paymentLink) {
        message += `\nTo confirm the reservation, please complete the payment here:\n${paymentLink}`;
      } else if (people > 0) {
        if (dynamicEnabled) {
          message += `\nPayment link could not be generated automatically yet. Please confirm and we will send it right away.`;
          return message;
        }
        message += `\nWe are a group of more than 5 people and would like to coordinate the reservation.`;
      }

      return message;
    };

    const renderOrders = () => {
      const orders = getOrders();

      container.innerHTML = "";

      const title = document.createElement("h3");
      title.textContent = "Your order";
      container.appendChild(title);

      if (orders.length === 0) return;

      const addBtn = document.createElement("button");
      addBtn.id = "addGuestBtn";
      addBtn.type = "button";
      addBtn.className = "add-guest-btn";
      addBtn.textContent = "+ Add Order";
      container.appendChild(addBtn);

      orders.forEach((order, index) => {
        const card = document.createElement("div");
        card.className = "order-card";

        const header = document.createElement("div");
        header.className = "order-header";

        const orderTitle = document.createElement("strong");
        orderTitle.textContent = `Order ${index + 1}`;

        const actions = document.createElement("div");
        actions.className = "order-actions";

        const edit = document.createElement("span");
        edit.className = "edit-order";
        edit.dataset.index = String(index);
        edit.textContent = "✏️";

        const del = document.createElement("span");
        del.className = "delete-order";
        del.dataset.index = String(index);
        del.textContent = "🗑️";

        actions.appendChild(edit);
        actions.appendChild(del);

        header.appendChild(orderTitle);
        header.appendChild(actions);
        card.appendChild(header);

        const prefs = Array.isArray(order.preferences) ? order.preferences : [];
        const prefsP = document.createElement("p");
        prefsP.innerHTML = `<strong>Preferences:</strong> ${escapeHtml(prefs.join(", ") || "-")}`;
        card.appendChild(prefsP);

        container.appendChild(card);
      });

      const people = orders.length;
      const total = people * pricePerPerson;

      const totalBox = document.createElement("div");
      totalBox.className = "total-box";
      totalBox.innerHTML = `
        <div class="total-left">
          <span class="total-label">Total</span>
          <span class="total-detail">(${people} x USD ${pricePerPerson})</span>
        </div>
        <div class="total-right">USD ${total}</div>
      `;

      const book = document.createElement("a");
      book.href = "#";
      book.id = "bookWithOrder";
      book.className = "btn total-btn";
      book.textContent = "Book Now";
      totalBox.appendChild(book);

      container.appendChild(totalBox);
    };

    // Event delegation: evita re-enganchar listeners en cada render.
    container.addEventListener("click", (e) => {
      const target = e.target;

      const addBtn = target.closest && target.closest("#addGuestBtn");
      if (addBtn) {
        openPopup();
        return;
      }

      const editEl = target.closest && target.closest(".edit-order");
      if (editEl) {
        const orders = getOrders();
        const idx = Number(editEl.dataset.index);
        const order = orders[idx];
        if (!order) return;

        editingIndex = idx;

        const selected = new Set(Array.isArray(order.preferences) ? order.preferences : []);
        preferenceCheckboxes().forEach((i) => {
          i.checked = selected.has(i.value);
        });

        saveBtn.textContent = "Update order";
        popup.classList.add("active");
        popup.setAttribute("aria-hidden", "false");
        return;
      }

      const delEl = target.closest && target.closest(".delete-order");
      if (delEl) {
        const orders = getOrders();
        const idx = Number(delEl.dataset.index);
        orders.splice(idx, 1);
        setOrders(orders);
        renderOrders();
        return;
      }

      const bookEl = target.closest && target.closest("#bookWithOrder");
      if (bookEl) {
        e.preventDefault();

        const orders = getOrders();
        if (orders.length === 0) return;

        const pendingTab = window.open("about:blank", "_blank");
        (async () => {
          const people = orders.length;
          const total = people * pricePerPerson;
          let paymentUrl = "";
          try {
            paymentUrl = await resolveDynamicPaymentLink(dynamicPayment, {
              experience: dynamicPayment?.experienceId || experienceName,
              amount: total,
              currency: dynamicPayment?.currency || "USD",
              people,
              orderFingerprint: stableStringify({ orders, total, people }),
              orderPayload: { orders, total, people, experienceName }
            });
          } catch {}
          const message = buildWhatsAppMessage(orders, paymentUrl);
          const waUrl = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}`;
          if (pendingTab && !pendingTab.closed) {
            pendingTab.location.href = waUrl;
          } else {
            window.open(waUrl, "_blank");
          }
        })();
      }
    });

    // Popup buttons
    createBtn.addEventListener("click", (e) => {
      e.preventDefault();
      openPopup();
    });

    closeBtn.addEventListener("click", (e) => {
      e.preventDefault();
      closePopup();
    });

    saveBtn.addEventListener("click", (e) => {
      e.preventDefault();

      const orders = getOrders();
      const preferences = readSelectedPreferences();

      if (preferences.length === 0) {
        alert("Please select at least one preference");
        return;
      }

      const order = { preferences };

      if (editingIndex !== null) {
        orders[editingIndex] = order;
      } else {
        orders.push(order);
      }

      setOrders(orders);
      closePopup();
      renderOrders();
    });

    // Botón "Book Now" inferior (opcional)
    if (bookNowBottomId) {
      const bottomBtn = document.getElementById(bookNowBottomId);
      if (bottomBtn) {
        bottomBtn.addEventListener("click", (e) => {
          e.preventDefault();
          const orders = getOrders();
          if (orders.length === 0) {
            alert(getI18nText("orders_alert_create_first", "Please create your order first."));
            return;
          }

          const pendingTab = window.open("about:blank", "_blank");
          (async () => {
            const people = orders.length;
            const total = people * pricePerPerson;
            let paymentUrl = "";
            try {
              paymentUrl = await resolveDynamicPaymentLink(dynamicPayment, {
                experience: dynamicPayment?.experienceId || experienceName,
                amount: total,
                currency: dynamicPayment?.currency || "USD",
                people,
                orderFingerprint: stableStringify({ orders, total, people }),
                orderPayload: { orders, total, people, experienceName }
              });
            } catch {}
            const message = buildWhatsAppMessage(orders, paymentUrl);
            const waUrl = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}`;
            if (pendingTab && !pendingTab.closed) {
              pendingTab.location.href = waUrl;
            } else {
              window.open(waUrl, "_blank");
            }
          })();
        });
      }
    }

    renderOrders();
  });
}

/**
 * Transporte privado: un vehículo (hasta 4 pasajeros) = rate USD fijos.
 * Cada vehículo adicional (5.º pasajero en adelante, de 4 en 4) suma otro rate USD.
 * Ej.: 1–4 pax → rate; 5–8 pax → 2×rate; 9–12 → 3×rate.
 */
function groupPrivateTransportTotal(guestCount, ratePerVehicle) {
  const rate = Number(ratePerVehicle) || 0;
  const n = Math.max(0, Math.floor(Number(guestCount) || 0));
  if (n === 0 || rate <= 0) return 0;
  const vehicles = Math.ceil(n / 4);
  return vehicles * rate;
}

/**
 * Experiencias con paquetes por persona (ej. viñedo USD 65, ceibo USD 80).
 * Cada order: { packageId, packageLabel, packagePrice, preferences: string[] }
 * Con transportPerVehicle (o transportPerPerson como alias) > 0 el transporte es por vehículo de hasta 4 pax (ver groupPrivateTransportTotal).
 * Órdenes antiguas pueden tener { packagePeople, packagePrice, preferences } o transportPrice.
 */
function initPackageOrderExperience(config) {
  const {
    experienceName = "experience",
    whatsappNumber = "598091642195",
    popupId,
    createBtnId,
    closeBtnId,
    saveBtnId,
    orderSummaryId = "orderSummary",
    bookNowBottomId,
    storageKey = "orders",
    packages,
    packageRadioName = "packageId",
    transportPerVehicle,
    transportPerPerson = 0,
    guideFeePerPerson = 0,
    guideOptional = false,
    optionalGuideCheckboxId = null,
    groupGuideOptional = false,
    groupGuideFlatFee = 0,
    groupGuideCheckboxId = null,
    groupGuideWrapId = null,
    dynamicPayment = null,
    paymentLinksByPackage = {}
  } = config || {};

  const vehicleTransportRate =
    transportPerVehicle != null && transportPerVehicle !== ""
      ? Math.max(0, Number(transportPerVehicle) || 0)
      : Math.max(0, Number(transportPerPerson) || 0);

  if (!popupId || !createBtnId || !closeBtnId || !saveBtnId || !orderSummaryId) {
    console.error("initPackageOrderExperience: config incompleta (ids)");
    return;
  }

  if (!packages || typeof packages !== "object" || Object.keys(packages).length === 0) {
    console.error("initPackageOrderExperience: config incompleta (packages)");
    return;
  }

  const getI18nText = (key, fallback) => {
    const lang = localStorage.getItem("selectedLanguage") || "en";
    const tr = sacramentoI18nTable();
    try {
      if (tr?.[lang]?.[key]) return tr[lang][key];
      if (tr?.en?.[key]) return tr.en[key];
    } catch {}
    return fallback;
  };

  const trTpl = (key, fallback, vars) => {
    let s = getI18nText(key, fallback);
    if (!vars || typeof vars !== "object") return s;
    return Object.keys(vars).reduce((acc, k) => acc.split(`{${k}}`).join(String(vars[k])), s);
  };

  const resolvePackageSpec = (id) => {
    const raw = packages[id];
    if (raw == null) return null;
    if (typeof raw === "number") {
      return { price: raw, label: String(id) };
    }
    if (typeof raw === "object" && typeof raw.price === "number") {
      const fallbackLabel =
        typeof raw.label === "string" && raw.label.trim() ? raw.label.trim() : String(id);
      const label =
        typeof raw.labelKey === "string" && raw.labelKey.trim()
          ? getI18nText(raw.labelKey.trim(), fallbackLabel)
          : fallbackLabel;
      return { price: raw.price, label };
    }
    return null;
  };

  document.addEventListener("DOMContentLoaded", () => {
    let editingIndex = null;

    const popup = document.getElementById(popupId);
    const createBtn = document.getElementById(createBtnId);
    const closeBtn = document.getElementById(closeBtnId);
    const saveBtn = document.getElementById(saveBtnId);
    const container = document.getElementById(orderSummaryId);

    if (!popup || !createBtn || !closeBtn || !saveBtn || !container) return;

    const guideFee = Math.max(0, Number(guideFeePerPerson) || 0);
    const optionalGuideEl = () =>
      optionalGuideCheckboxId ? document.getElementById(optionalGuideCheckboxId) : null;
    const groupGuideEl = () =>
      groupGuideCheckboxId ? document.getElementById(groupGuideCheckboxId) : null;
    const groupGuideStorageKey = `${storageKey}_groupGuide`;
    const getGroupGuideStored = () => localStorage.getItem(groupGuideStorageKey) === "1";
    const setGroupGuideStored = (on) => {
      if (on) localStorage.setItem(groupGuideStorageKey, "1");
      else localStorage.removeItem(groupGuideStorageKey);
    };
    const groupGuideFlat = Math.max(0, Number(groupGuideFlatFee) || 0);
    const groupGuideEnabled = (groupGuideOptional || Boolean(groupGuideCheckboxId)) && groupGuideFlat > 0;
    const groupGuideAmount = () => {
      if (!groupGuideEnabled) return 0;
      const orders = getOrders();
      if (orders.length === 0) return 0;
      const el = groupGuideEl();
      const onEl = Boolean(el && el.checked);
      const onStored = getGroupGuideStored();
      return onEl || onStored ? groupGuideFlat : 0;
    };
    const syncGroupGuideWrap = () => {
      const wrapId = groupGuideWrapId || (groupGuideCheckboxId ? `${groupGuideCheckboxId}Wrap` : null);
      const wrap = wrapId ? document.getElementById(wrapId) : null;
      if (wrap) {
        wrap.style.display = getOrders().length > 0 ? "" : "none";
      }
    };

    /** Precio y etiqueta siempre desde el catálogo actual (evita órdenes viejas con packagePrice desactualizado). */
    const getEffectivePackagePricing = (o) => {
      if (!o) return { label: "—", price: 0 };
      if (o.packageId != null) {
        const spec = resolvePackageSpec(o.packageId);
        if (spec) {
          const gf = guideOptional ? (o && o.includeGuide ? guideFee : 0) : guideFee;
          return { label: spec.label, price: spec.price + gf };
        }
      }
      return {
        label: o.packageLabel || "—",
        price: Number(o.packagePrice) || 0
      };
    };

    const usesGroupTransport = (orders) =>
      vehicleTransportRate > 0 && Array.isArray(orders) && orders.some((x) => x && x.packageId != null);

    const transportSharePerGuest = (orders) => {
      const n = Array.isArray(orders) ? orders.length : 0;
      if (!usesGroupTransport(orders) || n === 0) return 0;
      return groupPrivateTransportTotal(n, vehicleTransportRate) / n;
    };

    const totalGroupTransport = (orders) => {
      const n = Array.isArray(orders) ? orders.length : 0;
      if (!usesGroupTransport(orders) || n === 0) return 0;
      return groupPrivateTransportTotal(n, vehicleTransportRate);
    };

    /** Legacy: transporte fijo por línea (órdenes antiguas sin packageId). */
    const transportForLegacyOrder = (o) => {
      if (o.transportPrice != null) return Number(o.transportPrice) || 0;
      if (o.packagePeople != null && vehicleTransportRate > 0) return vehicleTransportRate;
      return 0;
    };

    const lineTotalForOrder = (o, orders) => {
      const base = getEffectivePackagePricing(o).price;
      if (usesGroupTransport(orders)) {
        return base + transportSharePerGuest(orders);
      }
      return base + transportForLegacyOrder(o);
    };

    const escapeHtml = (str) =>
      String(str).replace(/[&<>"']/g, (m) => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
      }[m]));

    const pkgI18nPrefPrefix = "__i18n__:";
    const buildPreferenceLookup = () => {
      const map = new Map();
      popup.querySelectorAll('.preferences-inside input[type="checkbox"]').forEach((input) => {
        const value = input.value || "";
        const span = input.parentElement?.querySelector("span[data-translate]");
        const rawLabel = span?.textContent?.trim() || input.parentElement?.textContent?.trim() || value;
        const key = span?.dataset?.translate;
        const translated = key ? getI18nText(key, rawLabel) : rawLabel;
        if (value) map.set(value, translated);
        if (rawLabel) map.set(rawLabel, translated);
        if (key) map.set(`${pkgI18nPrefPrefix}${key}`, translated);
      });
      return map;
    };

    const getLocalizedPreference = (storedValue) => {
      const raw = String(storedValue || "").trim();
      if (!raw) return "-";
      if (raw.startsWith(pkgI18nPrefPrefix)) {
        const key = raw.slice(pkgI18nPrefPrefix.length);
        return getI18nText(key, key);
      }
      const text = raw
        .replace(/^🍺\s*/, "")
        .replace(/^🧂\s*/, "")
        .replace(/^🌱\s*/, "")
        .replace(/^🚫\s*/, "")
        .replace(/^🌶\s*/, "")
        .trim();
      if (!text) return "-";
      const lookup = buildPreferenceLookup();
      return lookup.get(text) || lookup.get(raw) || text;
    };

    const decoratePkgPref = (storedValue) => {
      const raw = String(storedValue || "").trim();
      if (!raw) return "-";
      const decorated = sacramentoDecoratePref(raw, getI18nText, pkgI18nPrefPrefix);
      if (decorated && decorated.trim()) return decorated;
      return getLocalizedPreference(storedValue);
    };

    const getOrders = () => {
      try {
        return JSON.parse(localStorage.getItem(storageKey)) || [];
      } catch {
        return [];
      }
    };

    const setOrders = (orders) => {
      localStorage.setItem(storageKey, JSON.stringify(orders));
    };

    const clearPopupForm = () => {
      popup.querySelectorAll('input[type="radio"]').forEach((i) => {
        i.checked = false;
      });
      popup.querySelectorAll('.preferences-inside input[type="checkbox"]').forEach((i) => {
        i.checked = false;
      });
      const og = optionalGuideEl();
      if (og) og.checked = false;
      saveBtn.textContent = getI18nText("save_selection", "Save selection");
    };

    const resetPopup = () => {
      clearPopupForm();
      editingIndex = null;
    };

    const openPopup = () => {
      resetPopup();
      popup.classList.add("active");
      popup.setAttribute("aria-hidden", "false");
    };

    const closePopup = () => {
      popup.classList.remove("active");
      popup.setAttribute("aria-hidden", "true");
    };

    const formatMoney = (n) => {
      const x = Number(n);
      if (!Number.isFinite(x)) return "0";
      const v = Math.round(x * 100) / 100;
      return Number.isInteger(v) ? String(v) : v.toFixed(2);
    };

    const packageLineForOrder = (o, orders) => {
      const eff = getEffectivePackagePricing(o);
      const pkgPrice = eff.price;
      const share = usesGroupTransport(orders) ? transportSharePerGuest(orders) : transportForLegacyOrder(o);
      const total = lineTotalForOrder(o, orders);
      if (o.packageId != null && eff.label) {
        if (share > 0) {
          return trTpl(
            "orders_pkg_line_with_transport",
            "{label} — USD {pkg} experience + USD {share} group transport share = USD {total} per guest",
            {
              label: eff.label,
              pkg: pkgPrice,
              share: formatMoney(share),
              total: formatMoney(total)
            }
          );
        }
        return trTpl("orders_pkg_line_per_person", "{label} (USD {pkg} per person)", {
          label: eff.label,
          pkg: pkgPrice
        });
      }
      const n = Number(o.packagePeople);
      if (n > 0) {
        const key = n === 1 ? "orders_pkg_line_people_one" : "orders_pkg_line_people_many";
        const fb = n === 1 ? "{n} person (USD {pkg})" : "{n} people (USD {pkg})";
        return trTpl(key, fb, { n, pkg: pkgPrice });
      }
      return trTpl("orders_pkg_line_fallback", "Package (USD {pkg})", { pkg: pkgPrice });
    };

    const buildWhatsAppMessage = (orders, paymentLinkOverride = "") => {
      const dynamicEnabled = Boolean(dynamicPayment && dynamicPayment.enabled);
      const date = new Date().toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric"
      });

      let ordersText = "";
      let experienceSubtotal = 0;

      orders.forEach((o, i) => {
        const prefs = Array.isArray(o.preferences) ? o.preferences : [];
        experienceSubtotal += getEffectivePackagePricing(o).price;
        const prefsWa =
          prefs.length === 0
            ? "-"
            : prefs.map(decoratePkgPref).filter((p) => p && p !== "-").join(", ") || "-";

        ordersText += `*Order ${i + 1}*\nPackage: ${packageLineForOrder(o, orders)}\nPreferences: ${prefsWa}\n\n`;
      });

      const tGroup = totalGroupTransport(orders);
      const gg = groupGuideAmount();
      const total =
        experienceSubtotal +
        (usesGroupTransport(orders) ? tGroup : orders.reduce((s, o) => s + transportForLegacyOrder(o), 0)) +
        gg;

      let message = `Hello! I’d like to book the ${experienceName} experience:\n\nDate: ${date}\n\n${ordersText}`;
      if (usesGroupTransport(orders) && orders.length > 0) {
        const vehicles = Math.ceil(orders.length / 4);
        const guideTotalOptional =
          guideOptional && guideFee > 0
            ? orders.reduce((s, o) => s + (o && o.includeGuide ? guideFee : 0), 0)
            : 0;
        let guideNote = "";
        if (guideFee > 0) {
          if (guideOptional) {
            if (guideTotalOptional > 0) {
              guideNote = ` (includes USD ${formatMoney(guideTotalOptional)} in optional guide fees)`;
            }
          } else {
            guideNote = ` (includes USD ${formatMoney(guideFee)} guide fee per guest)`;
          }
        }
        message += `*Experience subtotal:* USD ${formatMoney(experienceSubtotal)}${guideNote}\n*Private transport (${orders.length} guests, ${vehicles} vehicle${vehicles === 1 ? "" : "s"} × USD ${formatMoney(vehicleTransportRate)}):* USD ${formatMoney(tGroup)}\n`;
      } else if (guideFee > 0 && orders.length > 0) {
        if (guideOptional) {
          const guideTotalOptional = orders.reduce((s, o) => s + (o && o.includeGuide ? guideFee : 0), 0);
          if (guideTotalOptional > 0) {
            message += `*Experience subtotal:* USD ${formatMoney(experienceSubtotal)} (includes USD ${formatMoney(guideTotalOptional)} in optional guide fees)\n`;
          } else {
            message += `*Experience subtotal:* USD ${formatMoney(experienceSubtotal)}\n`;
          }
        } else {
          message += `*Experience subtotal:* USD ${formatMoney(experienceSubtotal)} (includes USD ${formatMoney(guideFee)} guide fee per guest)\n`;
        }
      }
      if (groupGuideEnabled) {
        message += `*Group guide (optional, USD ${formatMoney(groupGuideFlat)} total):* ${gg > 0 ? `Yes — USD ${formatMoney(gg)}` : "No"}\n`;
      }
      message += `*Total:* USD ${formatMoney(total)}\n`;

      if (paymentLinkOverride) {
        message += `\nTo confirm the reservation, please complete the payment here:\n${paymentLinkOverride}`;
      } else if (!dynamicEnabled && orders.length === 1) {
        const o0 = orders[0];
        const pkgKey = o0.packageId != null ? String(o0.packageId) : String(o0.packagePeople);
        const link =
          paymentLinksByPackage[pkgKey] ||
          (o0.packagePeople != null ? paymentLinksByPackage[o0.packagePeople] : "") ||
          "";
        if (link) {
          message += `\nTo confirm the reservation, please complete the payment here:\n${link}`;
        }
      } else {
        message += `\nPayment link was not generated automatically for this group yet. Please confirm and we will send it right away.`;
      }

      return message;
    };

    const renderOrders = () => {
      const orders = getOrders();
      const gelSync = groupGuideEl();
      if (groupGuideEnabled && gelSync) {
        setGroupGuideStored(Boolean(gelSync.checked));
      }

      let html = `<h3>${escapeHtml(getI18nText("your_order", "Your order"))}</h3>`;

      if (orders.length > 0) {
        html = `
          <button id="addGuestBtn" class="add-guest-btn">
            + ${escapeHtml(getI18nText("add_order", "Add Order"))}
          </button>
          <h3>${escapeHtml(getI18nText("your_order", "Your order"))}</h3>
        `;
      }

      orders.forEach((order, index) => {
        const prefsRaw = Array.isArray(order.preferences) ? order.preferences : [];
        const prefsLine =
          prefsRaw.length === 0
            ? "-"
            : prefsRaw.map(decoratePkgPref).filter((p) => p && p !== "-").join(", ") || "-";
        const lineTotal = lineTotalForOrder(order, orders);

        const effPkg = getEffectivePackagePricing(order);
        const pkgPrice = effPkg.price;
        const share = usesGroupTransport(orders) ? transportSharePerGuest(orders) : transportForLegacyOrder(order);
        const expLabel = (() => {
          if (guideFee <= 0) return getI18nText("orders_pkg_paren_experience", "experience");
          if (guideOptional) {
            return order.includeGuide
              ? trTpl(
                  "orders_pkg_paren_exp_opt_guide",
                  "experience, incl. optional guide USD {n}",
                  { n: formatMoney(guideFee) }
                )
              : getI18nText("orders_pkg_paren_experience", "experience");
          }
          return trTpl(
            "orders_pkg_paren_exp_incl_guide",
            "experience, incl. USD {n} guide",
            { n: formatMoney(guideFee) }
          );
        })();
        const pkgLbl = escapeHtml(getI18nText("orders_pkg_package_lbl", "Package:"));
        let packageHtml = `<strong>${pkgLbl}</strong> ${escapeHtml(effPkg.label)} — USD ${escapeHtml(
          String(pkgPrice)
        )} (${escapeHtml(expLabel)})`;
        if (share > 0) {
          packageHtml += `<br><strong>${escapeHtml(
            getI18nText("orders_pkg_transport_share", "Transport (your share of the group):")
          )}</strong> USD ${escapeHtml(formatMoney(share))}`;
          packageHtml += `<br><strong>${escapeHtml(
            getI18nText("orders_pkg_guest_total", "Guest total:")
          )}</strong> USD ${escapeHtml(formatMoney(lineTotal))}`;
        } else {
          packageHtml = `<strong>${pkgLbl}</strong> ${escapeHtml(packageLineForOrder(order, orders))}`;
        }

        html += `
          <div class="order-card">
            <div class="order-header">
              <strong class="order-card-title">${escapeHtml(getI18nText("order_word", "Order"))} ${index + 1}</strong>
              <div class="order-actions">
                <span class="edit-order" data-index="${index}">✏️</span>
                <span class="delete-order" data-index="${index}">🗑️</span>
              </div>
            </div>
            <p>${packageHtml}</p>
            <p><strong>${escapeHtml(getI18nText("preferences_word", "Preferences"))}:</strong> ${escapeHtml(
          prefsLine
        )}</p>
          </div>
        `;
      });

      if (orders.length > 0) {
        const expSum = orders.reduce((s, o) => s + getEffectivePackagePricing(o).price, 0);
        const tGroupAmt = usesGroupTransport(orders) ? totalGroupTransport(orders) : 0;
        const ggAmt = groupGuideAmount();
        const transportSum = usesGroupTransport(orders)
          ? tGroupAmt
          : orders.reduce((s, o) => s + transportForLegacyOrder(o), 0);
        const total = expSum + transportSum + ggAmt;
        const guestUnit =
          orders.length === 1
            ? getI18nText("guest_order_singular", "guest order")
            : getI18nText("guest_order_plural", "guest orders");
        const detailExtra =
          usesGroupTransport(orders) && orders.length > 0
            ? ` · ${escapeHtml(getI18nText("orders_summary_transport", "transport"))} USD ${escapeHtml(
                formatMoney(tGroupAmt)
              )}`
            : "";
        let guideDetail = "";
        if (guideFee > 0) {
          if (guideOptional) {
            const guideTotalOptional = orders.reduce((s, o) => s + (o && o.includeGuide ? guideFee : 0), 0);
            if (guideTotalOptional > 0) {
              guideDetail = ` · ${escapeHtml(getI18nText("orders_summary_optional_guide", "optional guide"))} USD ${escapeHtml(
                formatMoney(guideTotalOptional)
              )}`;
            }
          } else {
            guideDetail = ` · ${escapeHtml(
              trTpl("orders_summary_guide_guest_incl", "guide USD {n}/guest incl.", {
                n: formatMoney(guideFee)
              })
            )}`;
          }
        }
        if (groupGuideEnabled && ggAmt > 0) {
          guideDetail += ` · ${escapeHtml(getI18nText("orders_summary_group_guide", "group guide"))} USD ${escapeHtml(
            formatMoney(ggAmt)
          )}`;
        }
        html += `
          <div class="total-box">
            <div class="total-left">
              <span class="total-label">${escapeHtml(getI18nText("total_label", "Total"))}</span>
              <span class="total-detail">${orders.length} ${escapeHtml(guestUnit)} · ${escapeHtml(
          getI18nText("orders_summary_experiences", "experiences")
        )} USD ${escapeHtml(formatMoney(expSum))}${guideDetail}${detailExtra}</span>
            </div>
            <div class="total-right">
              USD ${escapeHtml(formatMoney(total))}
            </div>
            <a href="#" id="bookWithOrder" class="btn total-btn">
              ${escapeHtml(getI18nText("book_btn", "Book Now"))}
            </a>
          </div>
        `;
      }

      container.innerHTML = html;
      syncGroupGuideWrap();
    };

    container.addEventListener("click", (e) => {
      const target = e.target;

      const addBtn = target.closest && target.closest("#addGuestBtn");
      if (addBtn) {
        e.preventDefault();
        openPopup();
        return;
      }

      const delEl = target.closest && target.closest(".delete-order");
      if (delEl) {
        const idx = Number(delEl.dataset.index);
        const orders = getOrders();
        orders.splice(idx, 1);
        setOrders(orders);
        renderOrders();
        return;
      }

      const editEl = target.closest && target.closest(".edit-order");
      if (editEl) {
        const idx = Number(editEl.dataset.index);
        const orders = getOrders();
        const order = orders[idx];
        if (!order) return;

        editingIndex = idx;
        clearPopupForm();

        popup.querySelectorAll(`input[name="${packageRadioName}"]`).forEach((r) => {
          if (order.packageId != null) {
            r.checked = r.value === String(order.packageId);
          } else {
            r.checked = false;
          }
        });

        const prefsSet = new Set(Array.isArray(order.preferences) ? order.preferences : []);
        popup.querySelectorAll('.preferences-inside input[type="checkbox"]').forEach((cb) => {
          const span = cb.parentElement?.querySelector("span[data-translate]");
          const trKey = span?.dataset?.translate;
          const encoded = trKey ? `${pkgI18nPrefPrefix}${trKey}` : "";
          const labelText = cb.parentElement?.textContent?.trim();
          cb.checked =
            prefsSet.has(cb.value) ||
            Boolean(labelText && prefsSet.has(labelText)) ||
            Boolean(encoded && prefsSet.has(encoded));
        });
        const og = optionalGuideEl();
        if (og) og.checked = Boolean(order.includeGuide);

        saveBtn.textContent = getI18nText("update_order", "Update order");
        popup.classList.add("active");
        popup.setAttribute("aria-hidden", "false");
        return;
      }

      const bookEl = target.closest && target.closest("#bookWithOrder");
      if (bookEl) {
        e.preventDefault();
        const orders = getOrders();
        if (orders.length === 0) return;
        const pendingTab = window.open("about:blank", "_blank");
        (async () => {
          const expTotal = orders.reduce((s, o) => s + getEffectivePackagePricing(o).price, 0);
          const transportTotal = usesGroupTransport(orders)
            ? totalGroupTransport(orders)
            : orders.reduce((s, o) => s + transportForLegacyOrder(o), 0);
          const total = expTotal + transportTotal + groupGuideAmount();
          let paymentUrl = "";
          try {
            paymentUrl = await resolveDynamicPaymentLink(dynamicPayment, {
              experience: dynamicPayment?.experienceId || experienceName,
              amount: total,
              currency: dynamicPayment?.currency || "USD",
              people: orders.length,
              orderFingerprint: stableStringify({
                orders: orders.map((o) => ({
                  ...o,
                  packagePrice: getEffectivePackagePricing(o).price,
                  packageLabel: getEffectivePackagePricing(o).label
                })),
                total
              }),
              orderPayload: { orders, total, experienceName }
            });
          } catch {}
          const message = buildWhatsAppMessage(orders, paymentUrl);
          const waUrl = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}`;
          if (pendingTab && !pendingTab.closed) {
            pendingTab.location.href = waUrl;
          } else {
            window.open(waUrl, "_blank");
          }
        })();
      }
    });

    createBtn.addEventListener("click", (e) => {
      e.preventDefault();
      openPopup();
    });

    closeBtn.addEventListener("click", (e) => {
      e.preventDefault();
      editingIndex = null;
      closePopup();
    });

    saveBtn.addEventListener("click", (e) => {
      e.preventDefault();

      const selectedPackage = popup.querySelector(`input[name="${packageRadioName}"]:checked`);
      if (!selectedPackage) {
        alert(getI18nText("orders_pkg_alert_select", "Please select a package"));
        return;
      }

      const packageId = selectedPackage.value;
      const spec = resolvePackageSpec(packageId);

      if (!spec || !spec.price) {
        alert(getI18nText("orders_pkg_alert_invalid", "Invalid package"));
        return;
      }

      const preferences = Array.from(
        popup.querySelectorAll('.preferences-inside input[type="checkbox"]:checked')
      ).map((cb) => cb.value);
      const og = optionalGuideEl();
      const includeGuide = og ? Boolean(og.checked) : false;

      const order = {
        packageId,
        packageLabel: spec.label,
        packagePrice: spec.price + (guideOptional ? (includeGuide ? guideFee : 0) : guideFee),
        preferences,
        ...(guideOptional ? { includeGuide } : {})
      };

      const orders = getOrders();
      if (editingIndex !== null) {
        orders[editingIndex] = order;
        editingIndex = null;
      } else {
        orders.push(order);
      }

      setOrders(orders);
      closePopup();
      renderOrders();
    });

    if (bookNowBottomId) {
      const bottomBtn = document.getElementById(bookNowBottomId);
      if (bottomBtn) {
        bottomBtn.addEventListener("click", (e) => {
          e.preventDefault();
          const orders = getOrders();
          if (orders.length === 0) {
            alert(getI18nText("orders_alert_create_first", "Please create your order first."));
            return;
          }
          const pendingTab = window.open("about:blank", "_blank");
          (async () => {
            const expTotal = orders.reduce((s, o) => s + getEffectivePackagePricing(o).price, 0);
            const transportTotal = usesGroupTransport(orders)
              ? totalGroupTransport(orders)
              : orders.reduce((s, o) => s + transportForLegacyOrder(o), 0);
            const total = expTotal + transportTotal + groupGuideAmount();
            let paymentUrl = "";
            try {
              paymentUrl = await resolveDynamicPaymentLink(dynamicPayment, {
                experience: dynamicPayment?.experienceId || experienceName,
                amount: total,
                currency: dynamicPayment?.currency || "USD",
                people: orders.length,
                orderFingerprint: stableStringify({
                  orders: orders.map((o) => ({
                    ...o,
                    packagePrice: getEffectivePackagePricing(o).price,
                    packageLabel: getEffectivePackagePricing(o).label
                  })),
                  total
                }),
                orderPayload: { orders, total, experienceName }
              });
            } catch {}
            const message = buildWhatsAppMessage(orders, paymentUrl);
            const waUrl = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}`;
            if (pendingTab && !pendingTab.closed) {
              pendingTab.location.href = waUrl;
            } else {
              window.open(waUrl, "_blank");
            }
          })();
        });
      }
    }

    if (groupGuideEnabled && groupGuideCheckboxId) {
      const gel = groupGuideEl();
      if (gel) {
        gel.checked = getGroupGuideStored();
        gel.addEventListener("change", () => {
          setGroupGuideStored(Boolean(gel.checked));
          renderOrders();
        });
      }
    }

    document.querySelectorAll(".lang-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        renderOrders();
        if (popup.classList.contains("active")) {
          saveBtn.textContent =
            editingIndex !== null
              ? getI18nText("update_order", "Update order")
              : getI18nText("save_selection", "Save selection");
        }
      });
    });

    renderOrders();
  });
} 

//Calculo de costos La mision night experences. 
function calculateBaseMision(people) {
  const BASE = {
    1: 75,
    2: 75,
    3: 95
  };
  return BASE[people] || 0;
}

function calculateMenus(orders) {
  const MENU = {
    standard: 40,
    premium: 60
  };

  return orders.reduce((sum, o) => {
    return sum + (o.menuTier === "premium"
      ? MENU.premium
      : MENU.standard);
  }, 0);
}
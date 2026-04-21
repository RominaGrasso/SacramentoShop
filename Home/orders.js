const DEFAULT_DYNAMIC_PAYMENT_ENDPOINT =
  typeof window !== "undefined" && window.location?.protocol === "file:"
    ? "http://localhost:8787/api/payments/resolve"
    : "/api/payments/resolve";

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

  for (const endpoint of uniqueCandidates) {
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
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
    /** Optional second price tier (e.g. Bruma premium menu USD 60). */
    menuUpgradePrice = null,
    /** Radio group name for standard vs premium, e.g. brumaMenuTier. */
    menuTierRadioName = null,
    /** When premium tier: field names for plate / dessert / drink, e.g. prm_starter, prm_main, prm_drink. */
    premiumChoiceFieldNames = null,
    /** Panel ids for standard vs premium menus: { standard: "id", premium: "id" }. */
    menuTierPanelIds = null
  } = config || {};

  if (!pricePerPerson) {
    console.error("initExperience: config incompleta (pricePerPerson)");
    return;
  }

  document.addEventListener("DOMContentLoaded", () => {
    let editingIndex = null;
    const guideFee = Math.max(0, Number(guideFeePerPerson) || 0);
    const vehicleTransportRate = Math.max(0, Number(transportPerVehicle) || 0);
    const getI18nText = (key, fallback) => {
      const lang = localStorage.getItem("selectedLanguage") || "en";
      try {
        if (translations?.[lang]?.[key]) return translations[lang][key];
        if (translations?.en?.[key]) return translations.en[key];
      } catch {}
      return fallback;
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
        return JSON.parse(localStorage.getItem(storageKey)) || [];
      } catch {
        return [];
      }
    };

    const setOrders = (orders) => {
      localStorage.setItem(storageKey, JSON.stringify(orders));
    };

    const formatDate = (d) =>
      d.toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric"
      });

    const getDateForBooking = () => {
      const stored = selectedDateKey ? localStorage.getItem(selectedDateKey) : null;
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
      return text;
    };
    const buildPreferenceLookup = () => {
      const map = new Map();
      const prefs = popup.querySelectorAll('.preferences-inside input[type="checkbox"]');
      prefs.forEach((input) => {
        const value = input.value || "";
        const span = input.parentElement?.querySelector("span[data-translate]");
        const rawLabel = span?.textContent?.trim() || input.parentElement?.textContent?.trim() || value;
        const key = span?.dataset?.translate;
        const translated = key ? getI18nText(key, rawLabel) : rawLabel;
        if (value) map.set(value, translated);
        if (rawLabel) map.set(rawLabel, translated);
      });
      return map;
    };
    const getLocalizedPreference = (storedValue) => {
      const text = String(storedValue || "").trim();
      if (!text) return "-";
      const lookup = buildPreferenceLookup();
      return lookup.get(text) || text;
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
      let base = Number(pricePerPerson) || 0;
      if (menuUpgradePrice != null && o && o.menuTier === "premium") {
        base = Number(menuUpgradePrice) || base;
      }
      if (groupGuideOptional) {
        return base;
      }
      if (guideOptional) {
        return base + (o && o.includeGuide ? guideFee : 0);
      }
      return base + guideFee;
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
    };

    function openPopupForNewOrder() {
      popup.classList.add("active");
      popup.querySelectorAll('input[type="radio"]').forEach((i) => {
        if (menuTierRadioName && i.name === menuTierRadioName) return;
        i.checked = false;
      });
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

    if (closeBtn) {
      closeBtn.addEventListener("click", () => popup.classList.remove("active"));
    }

    if (saveBtn) {
      saveBtn.addEventListener("click", () => {
        const orders = getOrders();

        const tierPremium =
          menuUpgradePrice &&
          menuTierRadioName &&
          popup.querySelector(`input[name="${menuTierRadioName}"]:checked`)?.value === "premium";

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

        if (!starter || !main || !drink) {
          alert(getI18nText("orders_alert_select_each", "Please select one option from each category"));
          return;
        }

        const preferences = Array.from(
          popup.querySelectorAll('.preferences-inside input[type="checkbox"]:checked')
        ).map((el) => (el.value || el.parentElement.textContent.trim()));

        const starterText = starter.value || starter.nextElementSibling?.textContent?.trim();
        const mainText = main.value || main.nextElementSibling?.textContent?.trim();
        const drinkText = drink.value || drink.nextElementSibling?.textContent?.trim();

        const og = optionalGuideEl();
        const includeGuide = guideOptional && !groupGuideOptional && og ? Boolean(og.checked) : false;

        const order = {
          starter: starterText,
          main: mainText,
          drink: drinkText,
          preferences,
          ...(guideOptional && !groupGuideOptional ? { includeGuide } : {}),
          ...(menuUpgradePrice ? { menuTier: tierPremium ? "premium" : "standard" } : {})
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
      const dynamicEnabled = Boolean(dynamicPayment && dynamicPayment.enabled);
      const paymentLink = paymentLinkOverride || (!dynamicEnabled ? paymentLinks[people] || "" : "");
      const experienceSubtotal = orders.reduce((s, o) => s + guestExperienceTotal(o), 0);
      const gg = groupGuideAmount();
      const transportTotal =
        vehicleTransportRate > 0 ? groupPrivateTransportTotal(people, vehicleTransportRate) : 0;
      const total = experienceSubtotal + gg + transportTotal;

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
      const ordersText = orders
        .map((o, i) => {
          const prefs = (Array.isArray(o.preferences) ? o.preferences : []).map(getLocalizedPreference);
          const gLine =
            guideOptional && !groupGuideOptional && guideFee > 0
              ? `\n${labGuide}: ${o && o.includeGuide ? "Yes (+USD " + guideFee + ")" : "No"}`
              : "";
          const prem = menuUpgradePrice && o.menuTier === "premium";
          const ls = prem
            ? getI18nText("bruma_premium_label_plate", "Plate")
            : labS;
          const lm = prem
            ? getI18nText("bruma_premium_label_dessert", "Dessert")
            : labM;
          const tierLine = menuUpgradePrice
            ? `\n${getI18nText("bruma_whatsapp_tier", "Menu tier")}: ${
                prem
                  ? getI18nText("bruma_whatsapp_premium", "Premium (USD 60)")
                  : getI18nText("bruma_whatsapp_standard", "Standard (from USD 40)")
              }`
            : "";
          return `*Order ${i + 1}*${tierLine}\n${ls}: ${getLocalizedChoice(starterName, o.starter)}\n${lm}: ${getLocalizedChoice(mainName, o.main)}\n${labD}: ${getLocalizedChoice(drinkName, o.drink)}${gLine}\nPreferences: ${prefs.join(", ") || "-"}`;
        })
        .join("\n\n");

      const expName = experienceNameKey
        ? getI18nText(experienceNameKey, experienceName)
        : experienceName;
      let message = `Hello! I’d like to book the ${expName} experience:\n\nDate: ${dateStr}\nPeople: ${people}\n\n${ordersText}\n\n`;
      message += `Experience subtotal: USD ${experienceSubtotal}`;
      if (guideFee > 0 && !guideOptional && !groupGuideOptional) {
        message += ` (includes USD ${guideFee} guide fee per guest)`;
      } else if (guideOptional && !groupGuideOptional && guideFee > 0) {
        const gt = orders.reduce((s, o) => s + (o && o.includeGuide ? guideFee : 0), 0);
        if (gt > 0) message += ` (includes USD ${gt} in optional guide fees)`;
      }
      message += `\n`;
      if (groupGuideOptional && groupGuideFlat > 0) {
        message += `Group guide (optional, USD ${groupGuideFlat} total for the group): ${gg > 0 ? `Yes — USD ${gg}` : "No"}\n`;
      }
      if (transportTotal > 0) {
        const vehicles = Math.ceil(people / 4);
        message += `Private transport (${vehicles} vehicle${vehicles === 1 ? "" : "s"} x USD ${vehicleTransportRate}): USD ${transportTotal}\n`;
      }
      message += `Total: USD ${total}`;

      if (paymentLink) {
        message += `\n\nTo confirm the reservation, please complete the payment here:\n${paymentLink}`;
      } else if (people > 5) {
        message += `\n\nWe are a group of more than 5 people and would like to coordinate the reservation.`;
      } else if (dynamicEnabled) {
        message += `\n\nPayment link could not be generated automatically yet. Please confirm and we will send it right away.`;
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
      popup.querySelectorAll('.preferences-inside input[type="checkbox"]').forEach((i) => (i.checked = false));

      const isPrem = menuUpgradePrice && order.menuTier === "premium";
      if (menuUpgradePrice && menuTierRadioName) {
        const tr = popup.querySelector(
          `input[name="${menuTierRadioName}"][value="${isPrem ? "premium" : "standard"}"]`
        );
        if (tr) tr.checked = true;
        syncMenuTierPanels(!isPrem);
      }

      if (isPrem && premiumChoiceFieldNames) {
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
        popup.querySelectorAll(`input[name="${premiumChoiceFieldNames.drink}"]`).forEach((input) => {
          const labelText = input.nextElementSibling?.textContent?.trim();
          input.checked =
            labelText === order.drink || input.value === order.drink || storedMatchesRadio(input, order.drink);
        });
      } else {
        popup.querySelectorAll(`input[name="${starterName}"]`).forEach((input) => {
          const labelText = input.nextElementSibling?.textContent?.trim();
          input.checked =
            labelText === order.starter ||
            input.value === order.starter ||
            storedMatchesRadio(input, order.starter);
        });

        popup.querySelectorAll(`input[name="${mainName}"]`).forEach((input) => {
          const labelText = input.nextElementSibling?.textContent?.trim();
          input.checked =
            labelText === order.main || input.value === order.main || storedMatchesRadio(input, order.main);
        });

        popup.querySelectorAll(`input[name="${drinkName}"]`).forEach((input) => {
          const labelText = input.nextElementSibling?.textContent?.trim();
          input.checked =
            labelText === order.drink || input.value === order.drink || storedMatchesRadio(input, order.drink);
        });
      }

      const prefsSet = new Set(Array.isArray(order.preferences) ? order.preferences : []);
      popup.querySelectorAll('.preferences-inside input[type="checkbox"]').forEach((input) => {
        const labelText = input.parentElement?.textContent?.trim();
        input.checked = prefsSet.has(input.value) || prefsSet.has(labelText);
      });

      const og = optionalGuideEl();
      if (og && !groupGuideOptional) og.checked = Boolean(order.includeGuide);
    };

    const renderOrders = () => {
      const orders = getOrders();
      const people = orders.length;
      const transportTotal =
        vehicleTransportRate > 0 ? groupPrivateTransportTotal(people, vehicleTransportRate) : 0;
      const cleanPreference = (text) =>
        String(text || "")
          .replace(/^🍺\s*/, "")
          .replace(/^🧂\s*/, "")
          .replace(/^🌱\s*/, "")
          .replace(/^🌶\s*/, "")
          .trim();
      const t = (key, fallback) => getI18nText(key, fallback);

      let html = `<h3>${escapeHtml(t("your_order", "Your order"))}</h3>`;

      if (orders.length > 0) {
        html = `
          <button id="addGuestBtn" class="add-guest-btn">
            + ${escapeHtml(t("add_order", "Add Order"))}
          </button>
          <h3>${escapeHtml(t("your_order", "Your order"))}</h3>
        `;
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
          .map(cleanPreference)
          .map(getLocalizedPreference);
        const guideLine =
          guideOptional && !groupGuideOptional && guideFee > 0
            ? `<p><strong>${escapeHtml(t("guide_accompany_label", "Guide to accompany"))}:</strong> ${order.includeGuide ? escapeHtml(`${getI18nText("yes_word", "Yes")} (+USD ${guideFee})`) : escapeHtml(t("guide_no", "No"))}</p>`
            : "";
        const prem = menuUpgradePrice && order.menuTier === "premium";
        const labS = prem
          ? escapeHtml(t("bruma_premium_label_plate", "Plate"))
          : defLabS;
        const labM = prem
          ? escapeHtml(t("bruma_premium_label_dessert", "Dessert"))
          : defLabM;
        const labD = defLabD;
        const tierRow =
          menuUpgradePrice
            ? `<p class="order-menu-tier"><strong>${escapeHtml(t("bruma_order_tier_label", "Menu"))}:</strong> ${escapeHtml(
                prem
                  ? t("bruma_order_tier_premium", "Premium · USD 60")
                  : t("bruma_order_tier_standard", "Standard · from USD 40")
              )}</p>`
            : "";
        html += `
          <div class="order-card">
            <div class="order-header">
              <strong>${escapeHtml(t("order_word", "Order"))} ${index + 1}</strong>
              <div class="order-actions">
                <span class="edit-order" data-index="${index}">✏️</span>
                <span class="delete-order" data-index="${index}">🗑️</span>
              </div>
            </div>
            ${tierRow}
            <p><strong>${labS}:</strong> ${escapeHtml(getLocalizedChoice(starterName, order.starter))}</p>
            <p><strong>${labM}:</strong> ${escapeHtml(getLocalizedChoice(mainName, order.main))}</p>
            <p><strong>${labD}:</strong> ${escapeHtml(getLocalizedChoice(drinkName, order.drink))}</p>
            ${guideLine}
            <p><strong>${escapeHtml(t("preferences_label", "Preferences"))}:</strong> ${escapeHtml(prefs.join(", ") || "-")}</p>
          </div>
        `;
      });

      if (orders.length > 0) {
        const experienceSubtotal = orders.reduce((s, o) => s + guestExperienceTotal(o), 0);
        const ggAmt = groupGuideAmount();
        const total = experienceSubtotal + ggAmt + transportTotal;
        const orderCountLabel =
          people === 1
            ? t("guest_order_singular", "guest order")
            : t("guest_order_plural", "guest orders");
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
        } else if (guideFee > 0) {
          guideDetail = ` · ${t("guide_short", "guide")} USD ${guideFee}/${t("guest_short", "guest")} ${t("included_short", "incl.")}`;
        }
        const transportDetail =
          transportTotal > 0 ? ` · ${t("transport_word", "transport")} USD ${transportTotal}` : "";
        html += `
          <div class="total-box">
            <div class="total-left">
              <span class="total-label">${escapeHtml(t("total_label", "Total"))}</span>
              <span class="total-detail">${orders.length} ${escapeHtml(orderCountLabel)} · ${escapeHtml(t("experiences_word", "experiences"))} USD ${experienceSubtotal}${guideDetail}${transportDetail}</span>
            </div>
            <div class="total-right">
              USD ${total}
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

    // Event delegation (una sola vez)
    container.addEventListener("click", (e) => {
      const target = e.target;

      const addBtn = target.closest && target.closest("#addGuestBtn");
      if (addBtn) {
        e.preventDefault();
        openPopupForNewOrder();
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
        (async () => {
          const people = orders.length;
          const transportTotal =
            vehicleTransportRate > 0 ? groupPrivateTransportTotal(people, vehicleTransportRate) : 0;
          const experienceSubtotal = orders.reduce((s, o) => s + guestExperienceTotal(o), 0);
          const ggAmt = groupGuideAmount();
          const total = experienceSubtotal + ggAmt + transportTotal;
          const paymentUrl = await resolveDynamicPaymentLink(dynamicPayment, {
            experience: dynamicPayment?.experienceId || experienceName,
            amount: total,
            currency: dynamicPayment?.currency || "USD",
            people,
            orderFingerprint: stableStringify({ orders, total, people, groupGuide: ggAmt }),
            orderPayload: { orders, total, people, experienceName, groupGuideFlat: ggAmt }
          });
          const message = buildWhatsAppMessage(orders, formatDate(new Date()), paymentUrl);
          window.open(
            `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}`,
            "_blank"
          );
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
          (async () => {
            const people = orders.length;
            const transportTotal =
              vehicleTransportRate > 0 ? groupPrivateTransportTotal(people, vehicleTransportRate) : 0;
            const experienceSubtotal = orders.reduce((s, o) => s + guestExperienceTotal(o), 0);
            const ggAmt = groupGuideAmount();
            const total = experienceSubtotal + ggAmt + transportTotal;
            const paymentUrl = await resolveDynamicPaymentLink(dynamicPayment, {
              experience: dynamicPayment?.experienceId || experienceName,
              amount: total,
              currency: dynamicPayment?.currency || "USD",
              people,
              orderFingerprint: stableStringify({ orders, total, people, groupGuide: ggAmt }),
              orderPayload: { orders, total, people, experienceName, groupGuideFlat: ggAmt }
            });
            const message = buildWhatsAppMessage(orders, getDateForBooking(), paymentUrl);
            window.open(
              `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}`,
              "_blank"
            );
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
    whatsappNumber = "598091642195",
    popupId = "popupBruma",
    closeBtnId = "closeBruma",
    createBtnId = "createMenuBtn",
    saveBtnId = "saveMenu",
    orderSummaryId = "orderSummary",
    touristOptionsId = "touristOptions",
    bookNowBottomId,
    storageKey = "orders",
    mainName = "main",
    starterName = "starter",
    touristMainName = "touristMain"
  } = config || {};

  if (!pricePerPerson) {
    console.error("initFoodExperience: config incompleta (pricePerPerson)");
    return;
  }

  document.addEventListener("DOMContentLoaded", () => {
    let editingIndex = null;

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
      saveBtn.textContent = "Save selection";
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
        alert("Select a meal");
        return;
      }

      const mainText = main.nextElementSibling?.textContent?.trim() || main.value;

      const preferences = Array.from(
        popup.querySelectorAll('.preferences-inside input[type="checkbox"]:checked')
      ).map((el) => el.parentElement.textContent.trim());

      let starter = null;
      let touristMain = null;

      if (main.value === "tourist") {
        const starterSelected = touristBlock.querySelector(`input[name="${starterName}"]:checked`);
        const touristMainSelected = touristBlock.querySelector(`input[name="${touristMainName}"]:checked`);

        if (!starterSelected || !touristMainSelected) {
          alert("Please complete starter and main");
          return;
        }

        starter = starterSelected.parentElement.textContent.trim();
        touristMain = touristMainSelected.parentElement.textContent.trim();
      }

      const order = {
        main: mainText,
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
          <h2>Your order</h2>
      `;

      if (orders.length > 0) {
        html += `
          <button id="addGuestBtn" class="add-guest-btn">
            + Add Order
          </button>
        `;
      }

      orders.forEach((order, i) => {
        const mainDisplay = order.touristMain ? order.touristMain : order.main;
        const prefs = Array.isArray(order.preferences) ? order.preferences : [];

        html += `
          <div class="order-card">
            <div class="order-header">
              <h3>Order ${i + 1}</h3>
              <div class="order-actions">
                <span class="edit-order" data-index="${i}">✏️</span>
                <span class="delete-order" data-index="${i}">🗑️</span>
              </div>
            </div>
            <p><strong>Main:</strong> ${escapeHtml(mainDisplay || "-")}</p>
            ${order.starter ? `<p><strong>Starter:</strong> ${escapeHtml(order.starter)}</p>` : ""}
            ${order.touristMain ? `<p><strong>Dessert:</strong> Chajá típico uruguayo</p>` : ""}
            <p><strong>Preferences:</strong> ${escapeHtml(prefs.join(", ") || "-")}</p>
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
              Book Now
            </a>
          </div>
        `;
      }

      html += `</div>`;
      container.innerHTML = html;
    };

    container.addEventListener("click", (e) => {
      const target = e.target;

      const addBtn = target.closest && target.closest("#addGuestBtn");
      if (addBtn) {
        e.preventDefault();
        editingIndex = null;
        saveBtn.textContent = "Save selection";
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

          popup
            .querySelectorAll(`input[name="${starterName}"]`)
            .forEach((r) => {
              const text = r.parentElement?.textContent?.trim();
              if (text === order.starter) r.checked = true;
            });

          touristBlock
            .querySelectorAll(`input[name="${touristMainName}"]`)
            .forEach((r) => {
              const text = r.parentElement?.textContent?.trim();
              if (text === order.touristMain) r.checked = true;
            });
        } else {
          popup.querySelectorAll(`input[name="${mainName}"]`).forEach((r) => {
            const text = r.nextElementSibling?.textContent?.trim();
            if (text === order.main) r.checked = true;
          });
          touristBlock.style.display = "none";
        }

        const prefSet = new Set(Array.isArray(order.preferences) ? order.preferences : []);
        popup.querySelectorAll('.preferences-inside input[type="checkbox"]').forEach((cb) => {
          const labelText = cb.parentElement?.textContent?.trim();
          cb.checked = prefSet.has(labelText);
        });

        saveBtn.textContent = "Update order";
        popup.classList.add("active");
        return;
      }

      const bookEl = target.closest && target.closest("#bookWithOrder");
      if (bookEl) {
        e.preventDefault();
        const orders = getOrders();
        if (orders.length === 0) return;

        let message = `Hello! I’d like to book the ${experienceName} Experience:\n\n`;
        orders.forEach((o, i) => {
          const mainDisplay = o.touristMain ? o.touristMain : o.main;
          message += `Order ${i + 1}: ${mainDisplay}\n`;
        });
        const total = orders.length * pricePerPerson;
        message += `\nTotal: USD ${total}`;

        window.open(`https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}`, "_blank");
      }
    });

    if (bookNowBottomId) {
      const bottomBtn = document.getElementById(bookNowBottomId);
      if (bottomBtn) {
        bottomBtn.addEventListener("click", (e) => {
          e.preventDefault();
          window.open(`https://wa.me/${whatsappNumber}`, "_blank");
        });
      }
    }

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

        (async () => {
          const people = orders.length;
          const total = people * pricePerPerson;
          const paymentUrl = await resolveDynamicPaymentLink(dynamicPayment, {
            experience: dynamicPayment?.experienceId || experienceName,
            amount: total,
            currency: dynamicPayment?.currency || "USD",
            people,
            orderFingerprint: stableStringify({ orders, total, people }),
            orderPayload: { orders, total, people, experienceName }
          });
          const message = buildWhatsAppMessage(orders, paymentUrl);
          const url = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}`;
          window.open(url, "_blank");
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

          (async () => {
            const people = orders.length;
            const total = people * pricePerPerson;
            const paymentUrl = await resolveDynamicPaymentLink(dynamicPayment, {
              experience: dynamicPayment?.experienceId || experienceName,
              amount: total,
              currency: dynamicPayment?.currency || "USD",
              people,
              orderFingerprint: stableStringify({ orders, total, people }),
              orderPayload: { orders, total, people, experienceName }
            });
            const message = buildWhatsAppMessage(orders, paymentUrl);
            const url = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}`;
            window.open(url, "_blank");
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

  const resolvePackageSpec = (id) => {
    const raw = packages[id];
    if (raw == null) return null;
    if (typeof raw === "number") {
      return { price: raw, label: String(id) };
    }
    if (typeof raw === "object" && typeof raw.price === "number") {
      const label = typeof raw.label === "string" && raw.label.trim() ? raw.label.trim() : String(id);
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
      saveBtn.textContent = "Save selection";
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
          return `${eff.label} — USD ${pkgPrice} experience + USD ${formatMoney(share)} transport share (group) = USD ${formatMoney(total)} per person`;
        }
        return `${eff.label} (USD ${pkgPrice} per person)`;
      }
      const n = Number(o.packagePeople);
      if (n > 0) {
        return `${n} person${n === 1 ? "" : "s"} (USD ${pkgPrice})`;
      }
      return `Package (USD ${pkgPrice})`;
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

        ordersText += `*Order ${i + 1}*\nPackage: ${packageLineForOrder(o, orders)}\nPreferences: ${prefs.join(", ") || "-"}\n\n`;
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

      let html = `<h3>Your order</h3>`;

      if (orders.length > 0) {
        html = `
          <button id="addGuestBtn" class="add-guest-btn">
            + Add Order
          </button>
          <h3>Your order</h3>
        `;
      }

      orders.forEach((order, index) => {
        const prefs = Array.isArray(order.preferences) ? order.preferences : [];
        const lineTotal = lineTotalForOrder(order, orders);

        const effPkg = getEffectivePackagePricing(order);
        const pkgPrice = effPkg.price;
        const share = usesGroupTransport(orders) ? transportSharePerGuest(orders) : transportForLegacyOrder(order);
        const expLabel = (() => {
          if (guideFee <= 0) return "experience";
          if (guideOptional) {
            return order.includeGuide
              ? `experience, incl. optional guide USD ${formatMoney(guideFee)}`
              : "experience";
          }
          return `experience, incl. USD ${formatMoney(guideFee)} guide`;
        })();
        let packageHtml = `<strong>Package:</strong> ${escapeHtml(effPkg.label)} — USD ${escapeHtml(String(pkgPrice))} (${expLabel})`;
        if (share > 0) {
          packageHtml += `<br><strong>Transport (your share of the group):</strong> USD ${escapeHtml(formatMoney(share))}`;
          packageHtml += `<br><strong>Guest total:</strong> USD ${escapeHtml(formatMoney(lineTotal))}`;
        } else {
          packageHtml = `<strong>Package:</strong> ${escapeHtml(packageLineForOrder(order, orders))}`;
        }

        html += `
          <div class="order-card">
            <div class="order-header">
              <strong>Order ${index + 1}</strong>
              <div class="order-actions">
                <span class="edit-order" data-index="${index}">✏️</span>
                <span class="delete-order" data-index="${index}">🗑️</span>
              </div>
            </div>
            <p>${packageHtml}</p>
            <p><strong>Preferences:</strong> ${escapeHtml(prefs.join(", ") || "-")}</p>
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
        const detailExtra =
          usesGroupTransport(orders) && orders.length > 0
            ? ` · transport USD ${escapeHtml(formatMoney(tGroupAmt))}`
            : "";
        let guideDetail = "";
        if (guideFee > 0) {
          if (guideOptional) {
            const guideTotalOptional = orders.reduce((s, o) => s + (o && o.includeGuide ? guideFee : 0), 0);
            if (guideTotalOptional > 0) {
              guideDetail = ` · optional guide USD ${escapeHtml(formatMoney(guideTotalOptional))}`;
            }
          } else {
            guideDetail = ` · guide USD ${escapeHtml(formatMoney(guideFee))}/guest incl.`;
          }
        }
        if (groupGuideEnabled && ggAmt > 0) {
          guideDetail += ` · group guide USD ${escapeHtml(formatMoney(ggAmt))}`;
        }
        html += `
          <div class="total-box">
            <div class="total-left">
              <span class="total-label">Total</span>
              <span class="total-detail">${orders.length} guest order${orders.length === 1 ? "" : "s"} · experiences USD ${escapeHtml(formatMoney(expSum))}${guideDetail}${detailExtra}</span>
            </div>
            <div class="total-right">
              USD ${escapeHtml(formatMoney(total))}
            </div>
            <a href="#" id="bookWithOrder" class="btn total-btn">
              Book Now
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
          cb.checked = prefsSet.has(cb.value);
        });
        const og = optionalGuideEl();
        if (og) og.checked = Boolean(order.includeGuide);

        saveBtn.textContent = "Update order";
        popup.classList.add("active");
        popup.setAttribute("aria-hidden", "false");
        return;
      }

      const bookEl = target.closest && target.closest("#bookWithOrder");
      if (bookEl) {
        e.preventDefault();
        const orders = getOrders();
        if (orders.length === 0) return;
        (async () => {
          const expTotal = orders.reduce((s, o) => s + getEffectivePackagePricing(o).price, 0);
          const transportTotal = usesGroupTransport(orders)
            ? totalGroupTransport(orders)
            : orders.reduce((s, o) => s + transportForLegacyOrder(o), 0);
          const total = expTotal + transportTotal + groupGuideAmount();
          const paymentUrl = await resolveDynamicPaymentLink(dynamicPayment, {
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
          const message = buildWhatsAppMessage(orders, paymentUrl);
          window.open(`https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}`, "_blank");
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
        alert("Please select a package");
        return;
      }

      const packageId = selectedPackage.value;
      const spec = resolvePackageSpec(packageId);

      if (!spec || !spec.price) {
        alert("Invalid package");
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
          (async () => {
            const expTotal = orders.reduce((s, o) => s + getEffectivePackagePricing(o).price, 0);
            const transportTotal = usesGroupTransport(orders)
              ? totalGroupTransport(orders)
              : orders.reduce((s, o) => s + transportForLegacyOrder(o), 0);
            const total = expTotal + transportTotal + groupGuideAmount();
            const paymentUrl = await resolveDynamicPaymentLink(dynamicPayment, {
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
            const message = buildWhatsAppMessage(orders, paymentUrl);
            window.open(`https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}`, "_blank");
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

    renderOrders();
  });
}
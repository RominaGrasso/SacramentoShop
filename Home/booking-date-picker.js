(function () {
  function localIso(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }

  function parseIso(iso) {
    const [y, m, d] = iso.split("-").map(Number);
    return new Date(y, m - 1, d);
  }

  function isWeekendDate(d) {
    const day = d.getDay();
    return day === 0 || day === 6;
  }

  function isWeekendIso(iso) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(iso || "")) return false;
    const parsed = parseIso(iso);
    return !Number.isNaN(parsed.getTime()) && isWeekendDate(parsed);
  }

  function parseBlockedWeekdays(attr) {
    if (!attr) return [];
    return String(attr)
      .split(",")
      .map((part) => parseInt(part.trim(), 10))
      .filter((day) => Number.isFinite(day) && day >= 0 && day <= 6);
  }

  function isBlockedWeekday(d, blockedWeekdays) {
    return blockedWeekdays.includes(d.getDay());
  }

  function isBlockedIso(iso, blockedWeekdays) {
    if (!blockedWeekdays.length || !/^\d{4}-\d{2}-\d{2}$/.test(iso || "")) return false;
    const parsed = parseIso(iso);
    return !Number.isNaN(parsed.getTime()) && isBlockedWeekday(parsed, blockedWeekdays);
  }

  function nextAllowedOnOrAfter(iso, minIso, blockedWeekdays) {
    let d = parseIso(iso);
    if (Number.isNaN(d.getTime())) d = new Date();
    const minDate = parseIso(minIso);
    if (!Number.isNaN(minDate.getTime()) && d < minDate) d = new Date(minDate);
    for (let i = 0; i < 366; i += 1) {
      const candidate = localIso(d);
      if (!isBlockedWeekday(d, blockedWeekdays) && candidate >= minIso) return candidate;
      d.setDate(d.getDate() + 1);
    }
    return localIso(new Date());
  }

  function nextWeekendOnOrAfter(iso) {
    let d = parseIso(iso);
    if (Number.isNaN(d.getTime())) d = new Date();
    for (let i = 0; i < 8; i += 1) {
      if (isWeekendDate(d)) return localIso(d);
      d.setDate(d.getDate() + 1);
    }
    return localIso(new Date());
  }

  function translate(key, fallback) {
    if (!key) return fallback;
    const lang = (window.getInitialLanguage?.() || "en").toLowerCase();
    const dict = window.__SACRAMENTO_TRANSLATIONS || {};
    return dict?.[lang]?.[key] || dict?.en?.[key] || fallback;
  }

  function persistDate(input, key, iso) {
    input.value = iso;
    localStorage.setItem(key, iso);
    document.dispatchEvent(
      new CustomEvent("sacramento:visitDateChanged", { detail: { key, iso } })
    );
  }

  function initInput(input) {
    if (!input || input.tagName !== "INPUT") return;
    const key = input.getAttribute("data-booking-date-key") || "selectedDate";
    const weekendsOnly = input.getAttribute("data-booking-date-weekends-only") === "true";
    const blockedWeekdays = parseBlockedWeekdays(
      input.getAttribute("data-booking-date-blocked-weekdays") || ""
    );
    const invalidI18nKey = input.getAttribute("data-booking-date-invalid-i18n") || "";
    const invalidFallback =
      input.getAttribute("data-booking-date-invalid-msg") ||
      (weekendsOnly
        ? "Please choose a Saturday or Sunday."
        : blockedWeekdays.length
          ? "Please choose an available day."
          : "Please choose a valid date.");

    const todayIso = localIso(new Date());
    if (!input.min) input.min = todayIso;
    const min = input.min;

    const stored = localStorage.getItem(key);
    const storedValid =
      /^\d{4}-\d{2}-\d{2}$/.test(stored || "") && stored >= min;

    let value = storedValid ? stored : min;
    if (weekendsOnly) {
      if (!isWeekendIso(value) || value < min) {
        value = nextWeekendOnOrAfter(value < min ? min : value);
      }
    } else if (blockedWeekdays.length && (isBlockedIso(value, blockedWeekdays) || value < min)) {
      value = nextAllowedOnOrAfter(value < min ? min : value, min, blockedWeekdays);
    } else if (!storedValid) {
      value = min;
    }

    persistDate(input, key, value);

    input.addEventListener("change", () => {
      if (!input.value || input.value < min) return;

      if (weekendsOnly && !isWeekendIso(input.value)) {
        const corrected = nextWeekendOnOrAfter(
          input.value >= min ? input.value : min
        );
        window.alert(translate(invalidI18nKey, invalidFallback));
        persistDate(input, key, corrected);
        return;
      }

      if (blockedWeekdays.length && isBlockedIso(input.value, blockedWeekdays)) {
        const corrected = nextAllowedOnOrAfter(
          input.value >= min ? input.value : min,
          min,
          blockedWeekdays
        );
        window.alert(translate(invalidI18nKey, invalidFallback));
        persistDate(input, key, corrected);
        return;
      }

      persistDate(input, key, input.value);
    });
  }

  function init() {
    const inputs = document.querySelectorAll("input[data-booking-date-key]");
    if (inputs.length) {
      inputs.forEach(initInput);
      return;
    }
    initInput(document.getElementById("bookingVisitDate"));
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();

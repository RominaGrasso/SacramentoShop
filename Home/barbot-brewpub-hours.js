/**
 * Barbot Brewpub visit hours: Mon–Fri from 18:00, Sat–Sun from 12:00 (Mon closed).
 */
(function () {
  "use strict";

  const DATE_KEY = "selectedDateBarbot";
  const TIME_KEY = "selectedTimeBarbot";
  const WEEKDAY_START = 18;
  const WEEKEND_START = 12;
  const LAST_HOUR = 22;

  function t(key, fallback) {
    const lang = (window.getInitialLanguage?.() || "en").toLowerCase();
    const dict = window.__SACRAMENTO_TRANSLATIONS || {};
    return dict?.[lang]?.[key] || dict?.en?.[key] || fallback || key;
  }

  function langForIntl() {
    const lang = (window.getInitialLanguage?.() || "en").toLowerCase();
    if (lang === "es") return "es-UY";
    if (lang === "pt") return "pt-BR";
    return "en";
  }

  function localIso(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }

  function parseIso(iso) {
    const [y, m, d] = String(iso || "").split("-").map(Number);
    return new Date(y, m - 1, d);
  }

  function isMonday(iso) {
    return parseIso(iso).getDay() === 1;
  }

  function isWeekend(iso) {
    const day = parseIso(iso).getDay();
    return day === 0 || day === 6;
  }

  function minStartHour(iso) {
    if (!iso || isMonday(iso)) return null;
    return isWeekend(iso) ? WEEKEND_START : WEEKDAY_START;
  }

  function formatHourLabel(hour24) {
    const d = new Date(2000, 0, 1, hour24, 0, 0);
    try {
      return new Intl.DateTimeFormat(langForIntl(), {
        hour: "numeric",
        minute: "2-digit",
      }).format(d);
    } catch (_) {
      return `${String(hour24).padStart(2, "0")}:00`;
    }
  }

  function buildSlotsForDate(iso) {
    const start = minStartHour(iso);
    if (start == null) return [];

    let first = start;
    const todayIso = localIso(new Date());
    if (iso === todayIso) {
      const now = new Date();
      const minToday = now.getHours() + (now.getMinutes() > 0 ? 1 : 0);
      first = Math.max(start, minToday);
    }

    const slots = [];
    for (let h = first; h <= LAST_HOUR; h += 1) {
      slots.push({
        value: `${String(h).padStart(2, "0")}:00`,
        label: formatHourLabel(h),
      });
    }
    return slots;
  }

  function getStoredDate() {
    try {
      const stored = localStorage.getItem(DATE_KEY);
      if (/^\d{4}-\d{2}-\d{2}$/.test(stored || "")) return stored;
    } catch (_) {
      /* ignore */
    }
    const input = document.getElementById("bookingVisitDate");
    return input?.value || localIso(new Date());
  }

  function getStoredTime() {
    try {
      return localStorage.getItem(TIME_KEY) || "";
    } catch (_) {
      return "";
    }
  }

  function setStoredTime(value) {
    const safe = String(value || "");
    const prev = getStoredTime();
    try {
      if (safe) localStorage.setItem(TIME_KEY, safe);
      else localStorage.removeItem(TIME_KEY);
    } catch (_) {
      /* ignore */
    }
    if (prev === safe) return;
    document.dispatchEvent(
      new CustomEvent("sacramento:visitTimeChanged", { detail: { key: TIME_KEY, value: safe } })
    );
    if (typeof window.renderOrders === "function") window.renderOrders();
  }

  function syncTimeSelect() {
    const select = document.getElementById("barbotVisitTime");
    if (!select) return;

    const iso = getStoredDate();
    const slots = buildSlotsForDate(iso);
    const prev = getStoredTime();
    const placeholder = t("barbot_brewpub_visit_time_placeholder", "Select a time");

    select.innerHTML = "";
    const empty = document.createElement("option");
    empty.value = "";
    empty.textContent = placeholder;
    select.appendChild(empty);

    slots.forEach((slot) => {
      const opt = document.createElement("option");
      opt.value = slot.value;
      opt.textContent = slot.label;
      select.appendChild(opt);
    });

    const valid = slots.some((s) => s.value === prev);
    const next = valid ? prev : slots[0]?.value || "";
    select.value = next;
    setStoredTime(next);
  }

  function mountTimeSelect() {
    const dateRow = document.querySelector(".booking-visit-date-row");
    if (!dateRow || document.getElementById("barbotVisitTime")) return;

    const row = document.createElement("div");
    row.className = "booking-visit-date-row barbot-visit-time-row";
    row.innerHTML = `
      <label for="barbotVisitTime" data-translate="barbot_brewpub_visit_time_label">Visit time</label>
      <select id="barbotVisitTime" autocomplete="off"></select>
      <p class="booking-visit-date-hint" data-translate="barbot_brewpub_visit_time_hint">
        Weekdays from 6:00 PM · weekends from 12:00 PM.
      </p>
    `;
    dateRow.insertAdjacentElement("afterend", row);

    const select = document.getElementById("barbotVisitTime");
    select?.addEventListener("change", () => {
      setStoredTime(select.value);
    });

    if (typeof window.sacramentoApplyTranslations === "function") {
      window.sacramentoApplyTranslations(row);
    } else if (typeof window.sacramentoSetLanguage === "function") {
      /* labels refresh on language change via render */
    }

    syncTimeSelect();
  }

  function getSelectedTimeLabel() {
    const iso = getStoredDate();
    const value = getStoredTime();
    if (!value) return "";
    const slot = buildSlotsForDate(iso).find((s) => s.value === value);
    return slot?.label || value;
  }

  function assertReady() {
    const iso = getStoredDate();
    if (isMonday(iso)) {
      window.alert(
        t("barbot_brewpub_alert_monday", "Barbot Brewpub is closed on Mondays. Please choose another day.")
      );
      return false;
    }
    const slots = buildSlotsForDate(iso);
    if (!slots.length) {
      window.alert(
        t(
          "barbot_brewpub_alert_no_slots_today",
          "No visit times left for this date. Please choose another day."
        )
      );
      return false;
    }
    const time = getStoredTime();
    if (!time || !slots.some((s) => s.value === time)) {
      window.alert(
        t("barbot_brewpub_alert_select_time", "Please select a visit time.")
      );
      document.getElementById("barbotVisitTime")?.focus();
      return false;
    }
    return true;
  }

  function init() {
    if (!document.body.classList.contains("page-barbot-brewpub")) return;
    mountTimeSelect();
    syncTimeSelect();

    document.addEventListener("sacramento:visitDateChanged", (ev) => {
      if (ev.detail?.key !== DATE_KEY) return;
      syncTimeSelect();
    });

    document.addEventListener("sacramento:setLanguage", () => {
      syncTimeSelect();
      if (typeof window.sacramentoApplyTranslations === "function") {
        window.sacramentoApplyTranslations(document.querySelector(".barbot-visit-time-row"));
      }
    });
  }

  window.sacramentoBarbotBrewpubHours = {
    assertReady,
    getSelectedTimeLabel,
    getSelectedTimeValue: getStoredTime,
    syncTimeSelect,
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();

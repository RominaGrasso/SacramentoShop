/**
 * Home: "Traslados" chip + private transfers catalog modal + availability / WhatsApp flow.
 */
(function () {
  const TRANSFER_IMAGE = "../Assets/images/electricoroginal.jpg";
  const TRANSFER_IMAGE_ALT_KEY = "traslado_plaza_letras_meta_1";

  const TRANSFER_CATALOG = [
    {
      id: "opt1",
      titleKey: "home_transfers_opt1_title",
      price: 40,
      trip: "round",
      mapsQuery: "Plaza de Toros Real de San Carlos, Colonia del Sacramento",
      mapsAriaKey: "home_transfers_maps_aria_opt1",
    },
    {
      id: "opt3",
      titleKey: "home_transfers_opt3_title",
      price: 150,
      trip: "round",
      wait: "none",
      mapsQuery: "Bodega Los Cerros de San Juan, Departamento de Colonia",
      mapsAriaKey: "home_transfers_maps_aria_opt3",
    },
    {
      id: "opt2",
      titleKey: "home_transfers_opt2_title",
      price: 180,
      trip: "round",
      wait: "included_2h",
      mapsQuery: "Nueva Helvecia / Colonia Suiza, Departamento de Colonia",
      mapsAriaKey: "home_transfers_maps_aria_opt2",
    },
    {
      id: "opt6",
      titleKey: "home_transfers_opt6_title",
      price: 200,
      trip: "round",
      wait: "included_2h",
      mapsQuery: "Bodega Familia Fripp, Colonia, Uruguay",
      mapsAriaKey: "home_transfers_maps_aria_opt6",
    },
    {
      id: "opt4",
      titleKey: "home_transfers_opt4_title",
      price: 220,
      trip: "round",
      wait: "included_2h",
      mapsQuery: "Carmelo, Departamento de Colonia",
      mapsAriaKey: "home_transfers_maps_aria_opt4",
    },
    {
      id: "opt5",
      titleKey: "home_transfers_opt5_title",
      price: 260,
      trip: "one_way",
      mapsQuery: "Montevideo, Uruguay",
      mapsAriaKey: "home_transfers_maps_aria_opt5",
      timeAvailability: "24h",
    },
  ];

  const TRANSFER_OPTIONS = Object.fromEntries(
    TRANSFER_CATALOG.map((item) => [item.id, item])
  );

  const DAYTIME_HOURS = [10, 11, 12, 13, 14, 15, 16, 17];
  const FULL_DAY_HOURS = Array.from({ length: 24 }, (_, h) => h);

  function formatHourOption(hour) {
    return `${String(hour).padStart(2, "0")}:00`;
  }

  function timesForTransfer(transferId) {
    const spec = TRANSFER_OPTIONS[transferId];
    const hours = spec?.timeAvailability === "24h" ? FULL_DAY_HOURS : DAYTIME_HOURS;
    return hours.map(formatHourOption);
  }

  function timeHintKeyForTransfer(transferId) {
    return TRANSFER_OPTIONS[transferId]?.timeAvailability === "24h"
      ? "home_transfers_time_hint_24h"
      : "home_transfers_time_hint";
  }

  function buildMapsUrl(query) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
  }

  function renderTransferWaitLine(wait) {
    if (wait === "included_2h") {
      return `<p class="card-meta-line home-transfers-card__wait"><span aria-hidden="true" class="sprite-row"></span><span class="card-meta__text"><span data-translate="home_transfers_wait_included">${t("home_transfers_wait_included", "Waiting time included")}</span>: <span data-translate="home_transfers_wait_2h">${t("home_transfers_wait_2h", "2 hours")}</span></span></p>`;
    }
    if (wait === "none") {
      return `<p class="card-meta-line home-transfers-card__wait"><span aria-hidden="true" class="sprite-row"></span><span class="card-meta__text" data-translate="home_transfers_wait_none">${t("home_transfers_wait_none", "No waiting time")}</span></p>`;
    }
    return "";
  }

  function renderTransferTripLine(trip) {
    if (trip === "one_way") {
      return `<p class="card-meta-line home-transfers-card__trip home-transfers-card__trip--one-way"><span aria-hidden="true" class="sprite-row"></span><span class="card-meta__text" data-translate="home_transfers_one_way">${t("home_transfers_one_way", "One way")}</span></p>`;
    }
    return `<p class="card-meta-line home-transfers-card__trip"><span aria-hidden="true" class="sprite-row"></span><span class="card-meta__text" data-translate="home_transfers_round_trip">${t("home_transfers_round_trip", "Round trip")}</span></p>`;
  }

  function renderTransferCardInner(item) {
    return `<div class="card-image">
<img alt="" data-translate-alt="${TRANSFER_IMAGE_ALT_KEY}" decoding="async" height="220" loading="lazy" src="${TRANSFER_IMAGE}" width="1200"/>
</div>
<div class="card-content">
<div class="home-transfers-title-row">
<h3 data-translate="${item.titleKey}">${t(item.titleKey, item.id)}</h3>
<a class="home-transfers-maps-pill" data-home-transfers-map="" href="#" rel="noopener noreferrer" target="_blank"><i aria-hidden="true" class="fa-solid fa-location-dot"></i><span data-translate="home_transfers_maps_pill">${t("home_transfers_maps_pill", "Where am I going?")}</span></a>
</div>
<p class="card-meta-line" data-card-meta="car"><span aria-hidden="true" class="sprite-row"></span><span class="card-meta__text" data-translate="home_transfers_type">${t("home_transfers_type", "Private car")}</span></p>
<p class="card-meta-line home-transfers-card__capacity"><span class="card-meta__text" data-translate="home_transfers_capacity">${t("home_transfers_capacity", "Up to 4 people")}</span></p>
${renderTransferTripLine(item.trip)}
${renderTransferWaitLine(item.wait)}
<div class="card-entry-price card-entry-price--total"><span class="card-entry-price__amount" lang="en" translate="no">USD ${item.price}</span></div>
<button class="home-transfers-card__check-btn" data-home-transfers-check="" type="button"><i aria-hidden="true" class="fa-solid fa-calendar-days"></i><span data-translate="home_transfers_check_availability">${t("home_transfers_check_availability", "Check availability")}</span></button>
</div>`;
  }

  function transferColumnsForViewport() {
    if (window.matchMedia("(min-width: 900px)").matches) return 3;
    if (window.matchMedia("(min-width: 641px)").matches) return 2;
    return 1;
  }

  function chunkTransferItems(items, size) {
    const rows = [];
    for (let i = 0; i < items.length; i += size) {
      rows.push(items.slice(i, i + size));
    }
    return rows;
  }

  function renderTransferCardMarkup(item) {
    return `<article class="card card--category-modal card--transfer-option" data-transfer-id="${item.id}">${renderTransferCardInner(item)}</article>`;
  }

  let transferLayoutResizeTimer = null;

  function scheduleTransferLayoutRefresh() {
    if (!modalCards) return;
    window.clearTimeout(transferLayoutResizeTimer);
    transferLayoutResizeTimer = window.setTimeout(renderTransferCards, 120);
  }

  function renderTransferCards() {
    if (!modalCards) return;
    const sorted = [...TRANSFER_CATALOG].sort((a, b) => a.price - b.price);
    const columns = transferColumnsForViewport();
    modalCards.innerHTML = chunkTransferItems(sorted, columns)
      .map(
        (rowItems) =>
          `<div class="home-transfers-modal__row">${rowItems.map(renderTransferCardMarkup).join("")}</div>`
      )
      .join("\n");
    initTransferMapPills();
    if (typeof window.sacramentoApplyPageIcons === "function") {
      window.sacramentoApplyPageIcons(modalCards);
    }
    if (typeof window.sacramentoSetLanguage === "function") {
      window.sacramentoSetLanguage(siteLanguage());
    }
  }

  function initTransferMapPills() {
    if (!modalCards) return;
    modalCards.querySelectorAll("[data-home-transfers-map]").forEach((link) => {
      const card = link.closest("[data-transfer-id]");
      const transferId = card?.dataset?.transferId;
      const spec = transferId ? TRANSFER_OPTIONS[transferId] : null;
      if (!spec?.mapsQuery) return;
      link.href = buildMapsUrl(spec.mapsQuery);
      link.setAttribute(
        "aria-label",
        t(spec.mapsAriaKey, `View ${spec.mapsQuery} on Google Maps`)
      );
    });
  }

  const MIN_CARS = 1;
  const MAX_CARS = 4;

  const modal = document.getElementById("homeTransfersModal");
  const modalCards = document.getElementById("homeTransfersModalCards");
  const dateSheet = document.getElementById("homeTransfersDateSheet");
  const dateInput = document.getElementById("homeTransfersDateInput");
  const timeInput = document.getElementById("homeTransfersTimeInput");
  const timeHintEl = document.getElementById("homeTransfersTimeHint");
  const dateTransferName = document.getElementById("homeTransfersDateTransferName");
  const whatsappBtn = document.getElementById("homeTransfersWhatsAppBtn");
  const carsValueEl = document.getElementById("homeTransfersCarsValue");
  const carsMinusBtn = document.querySelector("[data-home-transfers-cars-minus]");
  const carsPlusBtn = document.querySelector("[data-home-transfers-cars-plus]");

  let transfersOpen = false;
  let dateSheetOpen = false;
  let selectedTransferId = null;
  let selectedDateIso = "";
  let selectedTime = "";
  let selectedCarsCount = MIN_CARS;

  function siteLanguage() {
    if (typeof window.getInitialLanguage === "function") return window.getInitialLanguage();
    return localStorage.getItem("selectedLanguage") || "en";
  }

  function t(key, fallback) {
    const lang = siteLanguage();
    const dict =
      window.__SACRAMENTO_TRANSLATIONS?.[lang] ||
      window.__SACRAMENTO_TRANSLATIONS?.en ||
      {};
    return dict[key] || fallback || key;
  }

  function localIsoFromDate(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }

  function todayIso() {
    return localIsoFromDate(new Date());
  }

  function formatDisplayDate(iso) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(iso || "")) return "";
    const [y, m, d] = iso.split("-").map(Number);
    const dd = String(d).padStart(2, "0");
    const mm = String(m).padStart(2, "0");
    const lang = String(siteLanguage() || "en").toLowerCase();
    if (lang === "en") return `${mm}/${dd}/${y}`;
    return `${dd}/${mm}/${y}`;
  }

  function transferTitle(transferId) {
    const spec = TRANSFER_OPTIONS[transferId];
    if (!spec) return "";
    return t(spec.titleKey, transferId);
  }

  function formatCarsForMessage(count) {
    const n = Math.min(MAX_CARS, Math.max(MIN_CARS, Number(count) || MIN_CARS));
    if (n === 1) {
      return t("home_transfers_wa_cars_singular", "1 car");
    }
    return t("home_transfers_wa_cars_plural", "{n} cars").replace(/\{n\}/g, String(n));
  }

  function buildWhatsAppMessage(transferId, dateIso, time, carsCount) {
    const transfer = transferTitle(transferId);
    const date = formatDisplayDate(dateIso);
    const cars = formatCarsForMessage(carsCount);
    const template = t(
      "home_transfers_wa_message",
      "Hello, I would like to book a transfer {transfer} for {date} at {time}, for {cars}. Could you please confirm availability?"
    );
    return template
      .replace(/\{transfer\}/g, transfer)
      .replace(/\{date\}/g, date)
      .replace(/\{time\}/g, time)
      .replace(/\{cars\}/g, cars);
  }

  function openWhatsApp(message) {
    const pendingTab =
      typeof window.sacramentoOpenWhatsAppBlankTabForGesture === "function"
        ? window.sacramentoOpenWhatsAppBlankTabForGesture()
        : null;

    if (typeof window.sacramentoOpenWhatsApp === "function") {
      window.sacramentoOpenWhatsApp(null, message, pendingTab);
      return;
    }

    const url =
      typeof window.sacramentoBuildWhatsAppUrl === "function"
        ? window.sacramentoBuildWhatsAppUrl(null, message)
        : `https://wa.me/59898945542?text=${encodeURIComponent(message)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  }

  function isFormComplete() {
    return (
      Boolean(selectedDateIso) &&
      Boolean(selectedTime) &&
      selectedCarsCount >= MIN_CARS &&
      selectedCarsCount <= MAX_CARS
    );
  }

  function updateWhatsAppButtonState() {
    if (whatsappBtn) whatsappBtn.disabled = !isFormComplete();
  }

  function updateCarsStepperUi() {
    if (carsValueEl) carsValueEl.textContent = String(selectedCarsCount);
    if (carsMinusBtn) carsMinusBtn.disabled = selectedCarsCount <= MIN_CARS;
    if (carsPlusBtn) carsPlusBtn.disabled = selectedCarsCount >= MAX_CARS;
    updateWhatsAppButtonState();
  }

  function setCarsCount(next) {
    selectedCarsCount = Math.min(MAX_CARS, Math.max(MIN_CARS, Number(next) || MIN_CARS));
    updateCarsStepperUi();
  }

  function resetTimeSelect() {
    selectedTime = "";
    if (!timeInput) return;
    timeInput.value = "";
    timeInput.selectedIndex = 0;
  }

  function populateTimeSelect(transferId) {
    if (!timeInput) return;

    const placeholderLabel = t("home_transfers_time_placeholder", "Select a time");
    timeInput.replaceChildren();

    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.disabled = true;
    placeholder.selected = true;
    placeholder.setAttribute("data-translate", "home_transfers_time_placeholder");
    placeholder.textContent = placeholderLabel;
    timeInput.appendChild(placeholder);

    timesForTransfer(transferId).forEach((time) => {
      const opt = document.createElement("option");
      opt.value = time;
      opt.textContent = time;
      timeInput.appendChild(opt);
    });

    resetTimeSelect();

    if (timeHintEl) {
      const hintKey = timeHintKeyForTransfer(transferId);
      timeHintEl.setAttribute("data-translate", hintKey);
      timeHintEl.textContent = t(
        hintKey,
        hintKey === "home_transfers_time_hint_24h"
          ? "Available 24 hours"
          : "Available from 10:00 to 17:00"
      );
    }
  }

  function resetDateSheetState() {
    selectedDateIso = "";
    selectedCarsCount = MIN_CARS;
    resetTimeSelect();
    if (dateInput) {
      dateInput.value = "";
      dateInput.min = todayIso();
    }
    updateCarsStepperUi();
  }

  function handleDateInputChange() {
    const iso = String(dateInput?.value || "");
    const min = todayIso();

    if (!iso || iso < min) {
      selectedDateIso = "";
      updateWhatsAppButtonState();
      return;
    }

    selectedDateIso = iso;
    updateWhatsAppButtonState();
  }

  function handleTimeInputChange() {
    const value = String(timeInput?.value || "");
    const allowed = selectedTransferId ? timesForTransfer(selectedTransferId) : [];
    selectedTime = allowed.includes(value) ? value : "";
    updateWhatsAppButtonState();
  }

  function openTransferAvailability(transferId) {
    if (!TRANSFER_OPTIONS[transferId] || !dateSheet) return;

    selectedTransferId = transferId;
    resetDateSheetState();
    populateTimeSelect(transferId);

    if (dateTransferName) {
      dateTransferName.textContent = transferTitle(transferId);
    }

    dateSheet.hidden = false;
    dateSheet.setAttribute("aria-hidden", "false");
    dateSheetOpen = true;

    if (dateInput) dateInput.focus();
  }

  function closeDateSheet() {
    if (!dateSheet) return;
    dateSheet.hidden = true;
    dateSheet.setAttribute("aria-hidden", "true");
    dateSheetOpen = false;
    selectedTransferId = null;
    resetDateSheetState();
  }

  function openTransfersModal() {
    if (!modal) return;

    if (typeof window.sacramentoCloseHomeCategoryNav === "function") {
      window.sacramentoCloseHomeCategoryNav(false);
    }

    closeDateSheet();

    if (modalCards) {
      modalCards.scrollTop = 0;
    }

    modal.classList.add("is-open");
    modal.setAttribute("aria-hidden", "false");
    document.body.classList.add("home-category-modal-open");
    transfersOpen = true;

    const closeBtn = modal.querySelector(".home-category-modal__close");
    if (closeBtn) closeBtn.focus();
  }

  function closeTransfersModal() {
    if (!modal) return;
    closeDateSheet();
    modal.classList.remove("is-open");
    modal.setAttribute("aria-hidden", "true");
    document.body.classList.remove("home-category-modal-open");
    transfersOpen = false;
    if (modalCards) modalCards.scrollTop = 0;
  }

  window.sacramentoOpenHomeTransfersModal = openTransfersModal;
  window.sacramentoCloseHomeTransfersModal = closeTransfersModal;
  window.sacramentoIsHomeTransfersDateSheetOpen = () => dateSheetOpen;

  function init() {
    renderTransferCards();
    updateCarsStepperUi();
    window.addEventListener("resize", scheduleTransferLayoutRefresh);

    document.addEventListener("sacramento:setLanguage", () => {
      initTransferMapPills();
      if (dateTransferName && selectedTransferId) {
        dateTransferName.textContent = transferTitle(selectedTransferId);
      }
      if (dateSheetOpen && selectedTransferId) {
        const previousTime = timeInput?.value || "";
        populateTimeSelect(selectedTransferId);
        if (previousTime && timesForTransfer(selectedTransferId).includes(previousTime)) {
          timeInput.value = previousTime;
          selectedTime = previousTime;
        }
        updateWhatsAppButtonState();
      }
    });

    modalCards?.addEventListener("click", (e) => {
      if (e.target.closest("[data-home-transfers-map]")) {
        e.stopPropagation();
      }
    });

    document.querySelectorAll("[data-home-transfers-open]").forEach((chip) => {
      chip.addEventListener("click", () => {
        if (transfersOpen) {
          closeTransfersModal();
          return;
        }
        openTransfersModal();
      });
    });

    modal?.querySelectorAll("[data-home-transfers-close]").forEach((el) => {
      el.addEventListener("click", () => closeTransfersModal());
    });

    modalCards?.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-home-transfers-check]");
      if (!btn) return;
      e.preventDefault();
      e.stopPropagation();
      const card = btn.closest("[data-transfer-id]");
      const transferId = card?.dataset?.transferId;
      if (transferId) openTransferAvailability(transferId);
    });

    dateSheet?.querySelectorAll("[data-home-transfers-date-close]").forEach((el) => {
      el.addEventListener("click", () => closeDateSheet());
    });

    dateInput?.addEventListener("change", handleDateInputChange);
    dateInput?.addEventListener("input", handleDateInputChange);
    timeInput?.addEventListener("change", handleTimeInputChange);

    carsMinusBtn?.addEventListener("click", () => {
      setCarsCount(selectedCarsCount - 1);
    });

    carsPlusBtn?.addEventListener("click", () => {
      setCarsCount(selectedCarsCount + 1);
    });

    whatsappBtn?.addEventListener("click", () => {
      if (!selectedTransferId || !isFormComplete() || whatsappBtn.disabled) return;
      openWhatsApp(
        buildWhatsAppMessage(
          selectedTransferId,
          selectedDateIso,
          selectedTime,
          selectedCarsCount
        )
      );
    });

    document.addEventListener("keydown", (e) => {
      if (e.key !== "Escape") return;
      if (dateSheetOpen) {
        e.stopPropagation();
        closeDateSheet();
        return;
      }
      if (transfersOpen) {
        closeTransfersModal();
      }
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();

(function () {
  "use strict";

  const STORAGE_V2 = "barbot_brewpub_v2";
  const STORAGE_V1 = "barbot_brewpub_builder";
  const PRICE_FULL = 7;
  const PRICE_HALF = 5;
  const PRICE_FOOD = 10;
  const WA_NUMBER = "59898945542";

  /** Same pattern as Bruma (`initExperience` + Plexo `/api/payments/resolve`). */
  const BARBOT_DYNAMIC_PAYMENT = {
    enabled: true,
    endpoint: "/api/payments/resolve",
    experienceId: "barbot_brewpub",
    currency: "USD"
  };

  function i18n(key, fallback) {
    const lang =
      (typeof window !== "undefined" && typeof window.getInitialLanguage === "function"
        ? window.getInitialLanguage()
        : typeof localStorage !== "undefined" && localStorage.getItem("selectedLanguage")) || "en";
    const tr = (typeof window !== "undefined" && window.__SACRAMENTO_TRANSLATIONS) || {};
    try {
      if (tr[lang] && tr[lang][key]) return tr[lang][key];
      if (tr.en && tr.en[key]) return tr.en[key];
    } catch (_) {}
    return fallback;
  }

  function langForIntl() {
    const lang =
      (typeof window !== "undefined" && typeof window.getInitialLanguage === "function"
        ? window.getInitialLanguage()
        : typeof localStorage !== "undefined" && localStorage.getItem("selectedLanguage")) || "en";
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

  function formatVisitDate(iso) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(iso || ""))) return String(iso || "");
    const d = new Date(`${iso}T12:00:00`);
    try {
      return new Intl.DateTimeFormat(langForIntl(), { dateStyle: "long" }).format(d);
    } catch (_) {
      return iso;
    }
  }

  function clampQty(n) {
    const x = Math.floor(Number(n) || 0);
    return Math.max(0, Math.min(30, x));
  }

  function clampPeople(n) {
    const x = Math.floor(Number(n) || 0);
    return Math.max(1, Math.min(30, x));
  }

  function escapeHtml(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function orderHasItems(o) {
    return (
      o &&
      (clampQty(o.fullPints) > 0 ||
        clampQty(o.halfPints) > 0 ||
        clampQty(o.pizza) > 0 ||
        clampQty(o.burger) > 0 ||
        clampQty(o.fries) > 0)
    );
  }

  function computeOrderTotal(o) {
    if (!o) return 0;
    const full = clampQty(o.fullPints);
    const half = clampQty(o.halfPints);
    const pizza = clampQty(o.pizza);
    const burger = clampQty(o.burger);
    const fries = clampQty(o.fries);
    return full * PRICE_FULL + half * PRICE_HALF + (pizza + burger + fries) * PRICE_FOOD;
  }

  function computeGrandTotal(orders) {
    if (!Array.isArray(orders)) return 0;
    return orders.reduce((s, o) => s + computeOrderTotal(o), 0);
  }

  function snapshotBarbotCtx(ctx) {
    const visitDate = /^\d{4}-\d{2}-\d{2}$/.test(String(ctx?.visitDate || "")) ? ctx.visitDate : "";
    const orders = Array.isArray(ctx?.orders)
      ? ctx.orders
          .map((raw) => ({
            fullPints: clampQty(raw.fullPints),
            halfPints: clampQty(raw.halfPints),
            pizza: clampQty(raw.pizza),
            burger: clampQty(raw.burger),
            fries: clampQty(raw.fries),
            people: clampPeople(raw.people)
          }))
          .filter(orderHasItems)
      : [];
    return { visitDate, orders };
  }

  function readSelectionsFromPopup() {
    return {
      fullPints: clampQty(document.getElementById("barbotPopupFull")?.value),
      halfPints: clampQty(document.getElementById("barbotPopupHalf")?.value),
      pizza: clampQty(document.getElementById("barbotPopupPizza")?.value),
      burger: clampQty(document.getElementById("barbotPopupBurger")?.value),
      fries: clampQty(document.getElementById("barbotPopupFries")?.value)
    };
  }

  function writeSelectionsToPopup(o) {
    const x = o || {};
    const full = document.getElementById("barbotPopupFull");
    const half = document.getElementById("barbotPopupHalf");
    const p = document.getElementById("barbotPopupPizza");
    const b = document.getElementById("barbotPopupBurger");
    const f = document.getElementById("barbotPopupFries");
    if (full) full.value = String(clampQty(x.fullPints));
    if (half) half.value = String(clampQty(x.halfPints));
    if (p) p.value = String(clampQty(x.pizza));
    if (b) b.value = String(clampQty(x.burger));
    if (f) f.value = String(clampQty(x.fries));
  }

  function loadPersisted() {
    try {
      const raw2 = localStorage.getItem(STORAGE_V2);
      if (raw2) {
        const o = JSON.parse(raw2);
        if (o && typeof o === "object" && Array.isArray(o.orders)) return o;
      }
      const raw1 = localStorage.getItem(STORAGE_V1);
      if (raw1) {
        const old = JSON.parse(raw1);
        if (old && typeof old === "object") {
          const visit = /^\d{4}-\d{2}-\d{2}$/.test(String(old.visitDate || "")) ? old.visitDate : null;
          const one = {
            fullPints: clampQty(old.fullPints),
            halfPints: clampQty(old.halfPints),
            pizza: clampQty(old.pizza),
            burger: clampQty(old.burger),
            fries: clampQty(old.fries),
            people: 1
          };
          const orders = orderHasItems(one) ? [one] : [];
          const migrated = { visitDate: visit || localIso(new Date()), orders };
          localStorage.setItem(STORAGE_V2, JSON.stringify(migrated));
          return migrated;
        }
      }
    } catch (_) {}
    return null;
  }

  function savePersisted(ctx) {
    try {
      localStorage.setItem(STORAGE_V2, JSON.stringify(ctx));
    } catch (_) {}
  }

  function drinksDescription(o) {
    const parts = [];
    if (o.fullPints > 0) {
      parts.push(`${o.fullPints} × ${i18n("barbot_unit_full", "Full pint")} — USD ${o.fullPints * PRICE_FULL}`);
    }
    if (o.halfPints > 0) {
      parts.push(`${o.halfPints} × ${i18n("barbot_unit_half", "Half pint")} — USD ${o.halfPints * PRICE_HALF}`);
    }
    return parts.length ? parts.join("; ") : "—";
  }

  function foodDescription(o) {
    const parts = [];
    if (o.pizza > 0) parts.push(`${o.pizza} × ${i18n("barbot_food_pizza", "Pizza")} — USD ${o.pizza * PRICE_FOOD}`);
    if (o.burger > 0) {
      parts.push(`${o.burger} × ${i18n("barbot_food_burger", "Barbot burger")} — USD ${o.burger * PRICE_FOOD}`);
    }
    if (o.fries > 0) {
      parts.push(`${o.fries} × ${i18n("barbot_food_fries", "Fries with cheese cream")} — USD ${o.fries * PRICE_FOOD}`);
    }
    return parts.length ? parts.join("; ") : "—";
  }

  function buildWhatsappText(ctx, paymentUrl, paymentAttempted) {
    const lines = [i18n("barbot_wa_preface", "Hello! I’d like to book Barbot Brewpub with this selection:")];
    lines.push(
      `${i18n("orders_visit_date_label", "Visit date")}: ${formatVisitDate(ctx.visitDate)} (${ctx.visitDate})`
    );
    ctx.orders.forEach((o, i) => {
      const ord = {
        fullPints: clampQty(o.fullPints),
        halfPints: clampQty(o.halfPints),
        pizza: clampQty(o.pizza),
        burger: clampQty(o.burger),
        fries: clampQty(o.fries),
        people: clampPeople(o.people)
      };
      lines.push("");
      lines.push(`${i18n("order_word", "Order")} ${i + 1}`);
      lines.push(`${i18n("barbot_people_label", "People")}: ${ord.people}`);
      lines.push(`${i18n("barbot_summary_drinks_heading", "Drinks")}: ${drinksDescription(ord).replace(/<[^>]+>/g, "")}`);
      lines.push(`${i18n("barbot_summary_food_heading", "Food")}: ${foodDescription(ord)}`);
      lines.push(i18n("barbot_beer_at_bar_note", "Beer style is chosen at the bar."));
      lines.push(i18n("barbot_table_reserved_web_note", "A table is reserved for you with your web purchase."));
      lines.push(`${i18n("barbot_order_subtotal", "Subtotal")}: USD ${computeOrderTotal(ord)}`);
    });
    lines.push("");
    lines.push(`${i18n("total_label", "Total")}: USD ${computeGrandTotal(ctx.orders)}`);
    if (paymentUrl) {
      lines.push("");
      lines.push(i18n("wa_payment_cta", "To confirm the reservation, please complete the payment here:"));
      lines.push(paymentUrl);
      lines.push("");
      lines.push(
        i18n("food_post_payment_note", "After payment, we will send your reservation details and instructions.")
      );
    } else if (paymentAttempted) {
      lines.push("");
      lines.push(
        i18n("wa_payment_fallback", "Please share payment instructions to confirm this booking.")
      );
    }
    return lines.join("\n");
  }

  function popupIsOpen(overlay) {
    return overlay && overlay.classList.contains("active");
  }

  function init() {
    const dateInput = document.getElementById("barbotBookingVisitDate");
    const summary = document.getElementById("barbotOrderSummary");
    const createBtn = document.getElementById("barbotCreateBtn");
    const overlay = document.getElementById("popupBarbot");
    const closeBtn = document.getElementById("closeBarbot");
    const saveBtn = document.getElementById("saveBarbotDrinks");
    const reserveFooter = document.getElementById("barbotReserveBtn");

    if (!dateInput || !summary || !createBtn || !overlay) return;

    const todayIso = localIso(new Date());
    if (!dateInput.min) dateInput.min = todayIso;

    let ctx = loadPersisted();
    if (!ctx || !Array.isArray(ctx.orders)) {
      ctx = { visitDate: todayIso, orders: [] };
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(ctx.visitDate || ""))) ctx.visitDate = todayIso;
    if (ctx.visitDate < dateInput.min) ctx.visitDate = dateInput.min;
    ctx.orders = Array.isArray(ctx.orders)
      ? ctx.orders
          .map((o) => ({
            fullPints: clampQty(o.fullPints),
            halfPints: clampQty(o.halfPints),
            pizza: clampQty(o.pizza),
            burger: clampQty(o.burger),
            fries: clampQty(o.fries),
            people: clampPeople(o.people)
          }))
          .filter(orderHasItems)
      : [];
    savePersisted(ctx);

    dateInput.value = ctx.visitDate;

    let editingIndex = null;

    function renderSummary() {
      const orders = ctx.orders;
      const visit = String(ctx.visitDate || "").trim();
      const visitLabel = escapeHtml(i18n("orders_visit_date_label", "Visit date"));
      const visitDisplay = escapeHtml(formatVisitDate(visit) || visit);

      let html = "";

      if (orders.length > 0) {
        const addLabel = i18n("add_order", "Add Order");
        html += `<button type="button" id="barbotAddOrderBtn" class="add-guest-btn">+ ${escapeHtml(addLabel)}</button>`;
      }

      html += `<h3>${escapeHtml(i18n("your_order", "Your order"))}</h3>`;

      if (visit) {
        html += `<p class="order-summary-visit-date"><strong>${visitLabel}:</strong> ${visitDisplay}</p>`;
      }

      if (orders.length === 0) {
        html += `<p class="barbot-summary-empty">${escapeHtml(
          i18n("barbot_summary_empty", "Choose a visit date and add orders using the button above.")
        )}</p>`;
        summary.innerHTML = html;
        return;
      }

      const labDrinks = escapeHtml(i18n("barbot_summary_drinks_heading", "Drinks"));
      const labFood = escapeHtml(i18n("barbot_summary_food_heading", "Food"));
      const labPeople = escapeHtml(i18n("barbot_people_label", "People"));
      const orderWord = escapeHtml(i18n("order_word", "Order"));

      orders.forEach((raw, index) => {
        const o = {
          fullPints: clampQty(raw.fullPints),
          halfPints: clampQty(raw.halfPints),
          pizza: clampQty(raw.pizza),
          burger: clampQty(raw.burger),
          fries: clampQty(raw.fries),
          people: clampPeople(raw.people)
        };
        const ppl = o.people;
        html += `
          <div class="order-card">
            <div class="order-header">
              <strong class="order-card-title">${orderWord} ${index + 1}</strong>
              <div class="order-actions">
                <span class="edit-order barbot-edit-order" data-barbot-index="${index}" role="button" tabindex="0">✏️</span>
                <span class="delete-order barbot-delete-order" data-barbot-index="${index}" role="button" tabindex="0">🗑️</span>
              </div>
            </div>
            <p class="order-passengers-controls"><strong>${labPeople}:</strong>
              <button type="button" class="add-guest-btn"${
                ppl <= 1 ? " disabled" : ""
              } data-barbot-people-action="minus" data-barbot-index="${index}">−</button>
              <span class="order-pax-count">${ppl}</span>
              <button type="button" class="add-guest-btn"${
                ppl >= 30 ? " disabled" : ""
              } data-barbot-people-action="plus" data-barbot-index="${index}">+</button>
            </p>
            <p><strong>${labDrinks}:</strong> ${escapeHtml(drinksDescription(o))}</p>
            <p><strong>${labFood}:</strong> ${escapeHtml(foodDescription(o))}</p>
            <p class="barbot-order-beer-note">${escapeHtml(i18n("barbot_beer_at_bar_note", "Beer style is chosen at the bar."))}</p>
            <p class="barbot-order-beer-note">${escapeHtml(i18n("barbot_table_reserved_web_note", "A table is reserved for you with your web purchase."))}</p>
          </div>`;
      });

      const total = computeGrandTotal(orders);
      const n = orders.length;
      const totalPeople = orders.reduce((sum, row) => sum + clampPeople(row.people), 0);
      const countLabel = n === 1 ? i18n("guest_order_singular", "guest order") : i18n("guest_order_plural", "guest orders");
      const expWord = i18n("experiences_word", "experiences");
      const experienceSubtotal = total;
      const peopleWord = i18n("barbot_people_label", "People");
      const totalDetail = `${totalPeople} ${peopleWord} · ${n} ${countLabel} · ${expWord} USD ${experienceSubtotal}`;

      html += `
        <div class="total-box">
          <div class="total-left">
            <span class="total-label">${escapeHtml(i18n("total_label", "Total"))}</span>
            <span class="total-detail">${escapeHtml(totalDetail)}</span>
          </div>
          <div class="total-right">USD ${total}</div>
          <a href="#" id="barbotBookWithOrder" class="btn total-btn">${escapeHtml(i18n("book_btn", "Reserve"))}</a>
        </div>`;

      summary.innerHTML = html;
    }

    function openPopup(editIndex) {
      editingIndex = typeof editIndex === "number" && Number.isFinite(editIndex) ? editIndex : null;
      if (editingIndex !== null && ctx.orders[editingIndex]) {
        writeSelectionsToPopup(ctx.orders[editingIndex]);
      } else {
        writeSelectionsToPopup({
          fullPints: 0,
          halfPints: 0,
          pizza: 0,
          burger: 0,
          fries: 0
        });
      }
      overlay.classList.add("active");
      document.body.style.overflow = "hidden";
      document.getElementById("barbotPopupFull")?.focus();
    }

    function closePopup() {
      overlay.classList.remove("active");
      document.body.style.overflow = "";
      editingIndex = null;
    }

    function doReserve(e) {
      if (e) e.preventDefault();
      if (!ctx.visitDate || ctx.visitDate < dateInput.min) {
        alert(i18n("booking_visit_date_hint", "Pick a visit date."));
        return;
      }
      if (popupIsOpen(overlay)) {
        const sel = readSelectionsFromPopup();
        if (!orderHasItems(sel)) {
          alert(i18n("barbot_reserve_needs_items", "Add at least one drink or food item."));
          return;
        }
        if (editingIndex !== null && ctx.orders[editingIndex]) {
          const people = clampPeople(ctx.orders[editingIndex].people);
          ctx.orders[editingIndex] = { ...sel, people };
        } else {
          ctx.orders.push({ ...sel, people: 1 });
        }
        closePopup();
        savePersisted(ctx);
        renderSummary();
      }
      if (ctx.orders.length === 0) {
        alert(i18n("barbot_reserve_needs_orders", "Add at least one order (save in the window) before reserving."));
        return;
      }

      const snap = snapshotBarbotCtx(ctx);
      const pendingTab =
        typeof window.sacramentoOpenWhatsAppBlankTabForGesture === "function"
          ? window.sacramentoOpenWhatsAppBlankTabForGesture()
          : null;
      (async () => {
        const total = computeGrandTotal(snap.orders);
        const totalPeople = snap.orders.reduce((sum, row) => sum + clampPeople(row.people), 0);
        let paymentUrl = "";
        let paymentAttempted = false;
        try {
          if (
            typeof resolveDynamicPaymentLink === "function" &&
            typeof stableStringify === "function" &&
            BARBOT_DYNAMIC_PAYMENT &&
            BARBOT_DYNAMIC_PAYMENT.enabled
          ) {
            paymentAttempted = true;
            paymentUrl = await resolveDynamicPaymentLink(BARBOT_DYNAMIC_PAYMENT, {
              experience: BARBOT_DYNAMIC_PAYMENT.experienceId || "barbot_brewpub",
              amount: total,
              currency: BARBOT_DYNAMIC_PAYMENT.currency || "USD",
              people: totalPeople,
              orderFingerprint: stableStringify({ ...snap, total }),
              orderPayload: {
                ...snap,
                total,
                orderCount: snap.orders.length,
                experienceName: "Barbot Brewpub"
              }
            });
          }
        } catch (_) {
          paymentUrl = "";
        }
        const text = buildWhatsappText(snap, paymentUrl, paymentAttempted);
        if (typeof window.sacramentoOpenWhatsApp === "function") {
          window.sacramentoOpenWhatsApp(WA_NUMBER, text, pendingTab);
        } else if (typeof window.sacramentoBuildWhatsAppUrl === "function") {
          window.location.assign(window.sacramentoBuildWhatsAppUrl(WA_NUMBER, text));
        }
      })();
    }

    renderSummary();

    dateInput.addEventListener("change", () => {
      const v = dateInput.value;
      if (v && v >= dateInput.min) {
        ctx.visitDate = v;
        savePersisted(ctx);
        renderSummary();
      }
    });

    createBtn.addEventListener("click", (e) => {
      e.preventDefault();
      openPopup(null);
    });

    closeBtn?.addEventListener("click", closePopup);

    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) closePopup();
    });

    overlay.addEventListener("click", (e) => {
      const qtyBtn = e.target.closest("[data-barbot-qty-action]");
      if (!qtyBtn || !overlay.contains(qtyBtn)) return;
      e.preventDefault();
      const stepper = qtyBtn.closest(".barbot-qty-stepper");
      const input = stepper?.querySelector('input[type="number"]');
      if (!input) return;
      const act = qtyBtn.getAttribute("data-barbot-qty-action");
      const max = Number(input.max) || 30;
      let v = clampQty(input.value);
      if (act === "plus") v = Math.min(max, v + 1);
      if (act === "minus") v = Math.max(0, v - 1);
      input.value = String(v);
    });

    saveBtn?.addEventListener("click", () => {
      const sel = readSelectionsFromPopup();
      if (!orderHasItems(sel)) {
        alert(i18n("barbot_reserve_needs_items", "Add at least one drink or food item."));
        return;
      }
      if (editingIndex !== null && ctx.orders[editingIndex]) {
        const people = clampPeople(ctx.orders[editingIndex].people);
        ctx.orders[editingIndex] = { ...sel, people };
      } else {
        ctx.orders.push({ ...sel, people: 1 });
      }
      savePersisted(ctx);
      renderSummary();
      closePopup();
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && popupIsOpen(overlay)) closePopup();
    });

    summary.addEventListener("click", (e) => {
      const peopleBtn = e.target.closest("[data-barbot-people-action]");
      if (peopleBtn) {
        e.preventDefault();
        const idx = Number(peopleBtn.getAttribute("data-barbot-index"));
        const act = peopleBtn.getAttribute("data-barbot-people-action");
        const ord = ctx.orders[idx];
        if (!Number.isFinite(idx) || !ord) return;
        let p = clampPeople(ord.people);
        if (act === "plus") p = Math.min(30, p + 1);
        if (act === "minus") p = Math.max(1, p - 1);
        ctx.orders[idx] = { ...ord, people: p };
        savePersisted(ctx);
        renderSummary();
        return;
      }
      const add = e.target.closest("#barbotAddOrderBtn");
      if (add) {
        e.preventDefault();
        openPopup(null);
        return;
      }
      const edit = e.target.closest(".barbot-edit-order");
      if (edit) {
        e.preventDefault();
        const idx = Number(edit.getAttribute("data-barbot-index"));
        if (Number.isFinite(idx) && ctx.orders[idx]) openPopup(idx);
        return;
      }
      const del = e.target.closest(".barbot-delete-order");
      if (del) {
        e.preventDefault();
        const idx = Number(del.getAttribute("data-barbot-index"));
        if (Number.isFinite(idx)) {
          ctx.orders.splice(idx, 1);
          savePersisted(ctx);
          renderSummary();
        }
        return;
      }
      const book = e.target.closest("#barbotBookWithOrder");
      if (book) doReserve(e);
    });

    reserveFooter?.addEventListener("click", doReserve);

    document.addEventListener("sacramento:setLanguage", () => {
      renderSummary();
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();

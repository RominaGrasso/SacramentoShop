function initExperience(config) {
  const {
    pricePerPerson,
    paymentLinks = {},
    experienceName = "experience",
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
    drinkName = "drink"
  } = config || {};

  if (!pricePerPerson) {
    console.error("initExperience: config incompleta (pricePerPerson)");
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

    const popup = document.getElementById(popupId);
    const closeBtn = document.getElementById(closeBtnId);
    const saveBtn = document.getElementById(saveBtnId);
    const createBtn = document.getElementById(createBtnId);
    const container = document.getElementById(orderSummaryId);

    if (!popup || !closeBtn || !saveBtn || !createBtn || !container) return;

    if (createBtn && popup && saveBtn) {
      createBtn.addEventListener("click", () => {
        popup.classList.add("active");
        popup.querySelectorAll('input[type="radio"]').forEach(i => (i.checked = false));
        popup.querySelectorAll('.preferences-inside input[type="checkbox"]').forEach(i => (i.checked = false));
        editingIndex = null;
        saveBtn.textContent = "Save selection";
      });
    }

    if (closeBtn) {
      closeBtn.addEventListener("click", () => popup.classList.remove("active"));
    }

    if (saveBtn) {
      saveBtn.addEventListener("click", () => {
        const orders = getOrders();

        const starter = popup.querySelector(`input[name="${starterName}"]:checked`);
        const main = popup.querySelector(`input[name="${mainName}"]:checked`);
        const drink = popup.querySelector(`input[name="${drinkName}"]:checked`);

        if (!starter || !main || !drink) {
          alert("Please select one option from each category");
          return;
        }

        const preferences = Array.from(
          popup.querySelectorAll('.preferences-inside input[type="checkbox"]:checked')
        ).map((el) => el.parentElement.textContent.trim());

        const starterText = starter.nextElementSibling?.textContent?.trim() || starter.value;
        const mainText = main.nextElementSibling?.textContent?.trim() || main.value;
        const drinkText = drink.nextElementSibling?.textContent?.trim() || drink.value;

        const order = {
          starter: starterText,
          main: mainText,
          drink: drinkText,
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
    }

    const buildWhatsAppMessage = (orders, dateStr) => {
      const people = orders.length;
      const paymentLink = paymentLinks[people] || "";

      const ordersText = orders
        .map((o, i) => {
          const prefs = Array.isArray(o.preferences) ? o.preferences : [];
          return `*Order ${i + 1}*\nStarter: ${o.starter}\nMain: ${o.main}\nDrink: ${o.drink}\nPreferences: ${prefs.join(", ") || "-"}`;
        })
        .join("\n\n");

      let message = `Hello! I’d like to book the ${experienceName} experience:\n\nDate: ${dateStr}\nPeople: ${people}\n\n${ordersText}\n\nTotal: USD ${people * pricePerPerson}`;

      if (people <= 5) {
        message += `\n\nTo confirm the reservation, please complete the payment here:\n${paymentLink}`;
      } else {
        message += `\n\nWe are a group of more than 5 people and would like to coordinate the reservation.`;
      }

      return message;
    };

    const openPopupForNewOrder = () => {
      popup.classList.add("active");
      popup.querySelectorAll('input[type="radio"]').forEach(i => (i.checked = false));
      popup.querySelectorAll('.preferences-inside input[type="checkbox"]').forEach(i => (i.checked = false));
      editingIndex = null;
      saveBtn.textContent = "Save selection";
    };

    const fillPopupForEdit = (order) => {
      popup.querySelectorAll('input[type="radio"]').forEach(i => (i.checked = false));
      popup.querySelectorAll('.preferences-inside input[type="checkbox"]').forEach(i => (i.checked = false));

      popup.querySelectorAll(`input[name="${starterName}"]`).forEach((input) => {
        const labelText = input.nextElementSibling?.textContent?.trim();
        input.checked = labelText === order.starter;
      });

      popup.querySelectorAll(`input[name="${mainName}"]`).forEach((input) => {
        const labelText = input.nextElementSibling?.textContent?.trim();
        input.checked = labelText === order.main;
      });

      popup.querySelectorAll(`input[name="${drinkName}"]`).forEach((input) => {
        const labelText = input.nextElementSibling?.textContent?.trim();
        input.checked = labelText === order.drink;
      });

      const prefsSet = new Set(Array.isArray(order.preferences) ? order.preferences : []);
      popup.querySelectorAll('.preferences-inside input[type="checkbox"]').forEach((input) => {
        const labelText = input.parentElement?.textContent?.trim();
        input.checked = prefsSet.has(labelText);
      });
    };

    const renderOrders = () => {
      const orders = getOrders();

      let html = `<h3>Your order</h3>`;

      if (orders.length > 0) {
        html = `
          <button id="addGuestBtn" class="add-guest-btn">
            + Add guest order
          </button>
          <h3>Your order</h3>
        `;
      }

      orders.forEach((order, index) => {
        const prefs = Array.isArray(order.preferences) ? order.preferences : [];
        html += `
          <div class="order-card">
            <div class="order-header">
              <strong>Order ${index + 1}</strong>
              <div class="order-actions">
                <span class="edit-order" data-index="${index}">✏️</span>
                <span class="delete-order" data-index="${index}">🗑️</span>
              </div>
            </div>
            <p><strong>Starter:</strong> ${escapeHtml(order.starter || "-")}</p>
            <p><strong>Main:</strong> ${escapeHtml(order.main || "-")}</p>
            <p><strong>Drink:</strong> ${escapeHtml(order.drink || "-")}</p>
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

      container.innerHTML = html;
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
        saveBtn.textContent = "Update order";
        return;
      }

      const bookEl = target.closest && target.closest("#bookWithOrder");
      if (bookEl) {
        e.preventDefault();
        const orders = getOrders();
        if (orders.length === 0) return;
        const message = buildWhatsAppMessage(orders, formatDate(new Date()));
        window.open(
          `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}`,
          "_blank"
        );
      }
    });

    renderOrders();

    if (bookNowBottomId) {
      const bottomBtn = document.getElementById(bookNowBottomId);
      if (bottomBtn) {
        bottomBtn.addEventListener("click", (e) => {
          e.preventDefault();
          const orders = getOrders();
          if (orders.length === 0) {
            alert("Please create your order first.");
            return;
          }
          const message = buildWhatsAppMessage(orders, getDateForBooking());
          window.open(
            `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}`,
            "_blank"
          );
        });
      }
    }
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
            + Add guest order
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

    const buildWhatsAppMessage = (orders) => {
      const people = orders.length;
      const date = formatDate();

      let ordersText = "";
      orders.forEach((o, i) => {
        const prefs = Array.isArray(o.preferences) ? o.preferences : [];
        ordersText += `*Order ${i + 1}*\nPreferences: ${prefs.join(", ") || "-"}\n\n`;
      });

      const paymentLink = paymentLinks[people] || "";
      let message = `Hello! I’d like to book the ${experienceName} experience:\n\nDate: ${date}\nPeople: ${people}\n\n${ordersText}Total: USD ${people * pricePerPerson}\n`;

      if (paymentLink) {
        message += `\nTo confirm the reservation, please complete the payment here:\n${paymentLink}`;
      } else if (people > 0) {
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
      addBtn.textContent = "+ Add guest order";
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

        const message = buildWhatsAppMessage(orders);
        const url = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}`;
        window.open(url, "_blank");
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
            alert("Please create your order first.");
            return;
          }

          const message = buildWhatsAppMessage(orders);
          const url = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}`;
          window.open(url, "_blank");
        });
      }
    }

    renderOrders();
  });
}
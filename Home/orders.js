let editingIndex = null;

function initExperience(config) {
  const {
    pricePerPerson,
    paymentLinks,
    experienceName
  } = config;

  document.addEventListener("DOMContentLoaded", () => {
    renderOrders();

    const popup = document.getElementById("popupBruma");
    const closeBtn = document.getElementById("closeBruma");
    const saveBtn = document.getElementById("saveMenu");
    const createBtn = document.getElementById("createMenuBtn");

    // CREATE MENU
    if (createBtn && popup && saveBtn) {
      createBtn.addEventListener("click", () => {
        popup.classList.add("active");

        document.querySelectorAll('input[type="radio"]').forEach(i => i.checked = false);
        document.querySelectorAll('.preferences-inside input[type="checkbox"]').forEach(i => i.checked = false);

        editingIndex = null;
        saveBtn.textContent = "Save selection";
      });
    }

    // CLOSE POPUP
    if (closeBtn && popup) {
      closeBtn.addEventListener("click", () => {
        popup.classList.remove("active");
      });
    }

    // SAVE
    if (saveBtn) {
      saveBtn.addEventListener("click", () => {
        let orders = JSON.parse(localStorage.getItem("orders")) || [];

        const starter = document.querySelector('input[name="starter"]:checked');
        const main = document.querySelector('input[name="main"]:checked');
        const drink = document.querySelector('input[name="drink"]:checked');

        if (!starter || !main || !drink) {
          alert("Please select one option from each category");
          return;
        }

        const preferences = [];
        document.querySelectorAll('.preferences-inside input[type="checkbox"]:checked')
          .forEach(el => preferences.push(el.parentElement.textContent.trim()));

        const order = {
          starter: starter.nextElementSibling.textContent,
          main: main.nextElementSibling.textContent,
          drink: drink.nextElementSibling.textContent,
          preferences
        };

        if (editingIndex !== null) {
          orders[editingIndex] = order;
          editingIndex = null;
        } else {
          orders.push(order);
        }

        localStorage.setItem("orders", JSON.stringify(orders));

        popup.classList.remove("active");
        renderOrders();
      });
    }

    function renderOrders() {
      const container = document.getElementById("orderSummary");
      if (!container) return;

      const orders = JSON.parse(localStorage.getItem("orders")) || [];

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
        html += `
          <div class="order-card">
            <div class="order-header">
              <strong>Order ${index + 1}</strong>
              <div class="order-actions">
                <span class="edit-order" data-index="${index}">✏️</span>
                <span class="delete-order" data-index="${index}">🗑️</span>
              </div>
            </div>
            <p><strong>Starter:</strong> ${order.starter}</p>
            <p><strong>Main:</strong> ${order.main}</p>
            <p><strong>Drink:</strong> ${order.drink}</p>
            <p><strong>Preferences:</strong> ${order.preferences.join(", ") || "-"}</p>
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

      // DELETE
      document.querySelectorAll(".delete-order").forEach(btn => {
        btn.addEventListener("click", () => {
          let orders = JSON.parse(localStorage.getItem("orders")) || [];
          orders.splice(btn.dataset.index, 1);
          localStorage.setItem("orders", JSON.stringify(orders));
          renderOrders();
        });
      });

      // WHATSAPP
      const bookBtn = document.getElementById("bookWithOrder");
      if (bookBtn) {
        bookBtn.addEventListener("click", (e) => {
          e.preventDefault();

          const orders = JSON.parse(localStorage.getItem("orders")) || [];
          const people = orders.length;

          const today = new Date();
          const date = today.toLocaleDateString("en-GB");

          let ordersText = "";
          orders.forEach((o, i) => {
            ordersText += `Order ${i + 1}\nStarter: ${o.starter}\nMain: ${o.main}\nDrink: ${o.drink}\n\n`;
          });

          let paymentLink = paymentLinks[people] || "";

          let message = `Hello! I’d like to book the ${experienceName} experience:

Date: ${date}
People: ${people}

${ordersText}

Total: USD ${people * pricePerPerson}
`;

          if (people <= 5) {
            message += `\nComplete payment here:\n${paymentLink}`;
          } else {
            message += `\nWe are more than 5 people. Please contact us.`;
          }

          const url = `https://wa.me/598091642195?text=${encodeURIComponent(message)}`;
          window.open(url, "_blank");
        });
      }
    }
  });
}
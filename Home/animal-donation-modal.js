/**
 * Animal donation modal — home hero CTA for Responsabilidad Animal Colonia.
 * Opens WhatsApp with a pre-filled donation message after amount selection.
 */
(function () {
  const WHATSAPP_NUMBER = "59894420199";

  const overlay = document.getElementById("popupAnimalDonation");
  const trigger = document.getElementById("heroAnimalDonationBtn");
  const submitBtn = document.getElementById("animalDonationSubmit");
  const customWrap = document.getElementById("animalDonationCustomWrap");
  const customInput = document.getElementById("animalDonationCustomAmount");
  const amountCards = overlay
    ? Array.from(overlay.querySelectorAll(".animal-donation-amount-card"))
    : [];

  if (!overlay || !trigger || !submitBtn || !customWrap || !customInput || !amountCards.length) {
    return;
  }

  const getLang = () =>
    (typeof window.getInitialLanguage === "function"
      ? window.getInitialLanguage()
      : "en"
    ).toLowerCase();

  const t = (key, fallback) => {
    const lang = getLang();
    const dict = window.__SACRAMENTO_TRANSLATIONS || {};
    return dict?.[lang]?.[key] || dict?.en?.[key] || fallback;
  };

  /** @type {"fixed"|"other"|null} */
  let selectionMode = null;
  /** @type {number|null} */
  let selectedFixedAmount = null;

  const resetForm = () => {
    selectionMode = null;
    selectedFixedAmount = null;
    amountCards.forEach((card) => {
      card.classList.remove("is-selected");
      card.setAttribute("aria-checked", "false");
    });
    customWrap.hidden = true;
    customInput.value = "";
    submitBtn.disabled = true;
  };

  const getSelectedAmount = () => {
    if (selectionMode === "fixed" && selectedFixedAmount != null) {
      return selectedFixedAmount;
    }
    if (selectionMode === "other") {
      const value = Number.parseFloat(String(customInput.value).replace(",", "."));
      if (!Number.isFinite(value) || value < 1) return null;
      return Math.round(value * 100) / 100;
    }
    return null;
  };

  const syncSubmitState = () => {
    submitBtn.disabled = getSelectedAmount() == null;
  };

  const buildWhatsAppMessage = (amount) => {
    const template = t(
      "animal_donation_wa_message",
      "Hola! Quiero hacer una donación a Responsabilidad Animal Colonia de USD {amount}. ¿Podrían enviarme los datos para realizar la transferencia?"
    );
    return template.replace("{amount}", String(amount));
  };

  const openWhatsAppDonation = (amount) => {
    const message = buildWhatsAppMessage(amount);
    const pendingTab =
      typeof window.sacramentoOpenWhatsAppBlankTabForGesture === "function"
        ? window.sacramentoOpenWhatsAppBlankTabForGesture()
        : null;

    if (typeof window.sacramentoOpenWhatsApp === "function") {
      window.sacramentoOpenWhatsApp(WHATSAPP_NUMBER, message, pendingTab);
      return;
    }

    if (typeof window.sacramentoBuildWhatsAppUrl === "function") {
      const url = window.sacramentoBuildWhatsAppUrl(WHATSAPP_NUMBER, message);
      if (pendingTab && !pendingTab.closed) {
        pendingTab.location.href = url;
      } else {
        window.open(url, "_blank", "noopener,noreferrer");
      }
      return;
    }

    window.open(
      `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`,
      "_blank",
      "noopener,noreferrer"
    );
  };

  amountCards.forEach((card) => {
    card.addEventListener("click", () => {
      amountCards.forEach((item) => {
        item.classList.remove("is-selected");
        item.setAttribute("aria-checked", "false");
      });
      card.classList.add("is-selected");
      card.setAttribute("aria-checked", "true");

      const amount = card.getAttribute("data-amount");
      if (amount === "other") {
        selectionMode = "other";
        selectedFixedAmount = null;
        customWrap.hidden = false;
        customInput.focus();
      } else {
        selectionMode = "fixed";
        selectedFixedAmount = Number.parseInt(amount, 10);
        customWrap.hidden = true;
        customInput.value = "";
      }

      syncSubmitState();
    });
  });

  customInput.addEventListener("input", syncSubmitState);

  submitBtn.addEventListener("click", () => {
    const amount = getSelectedAmount();
    if (amount == null) return;
    openWhatsAppDonation(amount);
  });

  const modal = window.bindSacramentoModal({
    overlay,
    onOpen: resetForm,
    onClose: resetForm
  });

  if (!modal) return;

  trigger.addEventListener("click", () => modal.open());

  document.addEventListener("sacramento:setLanguage", () => {
    if (modal.isOpen()) syncSubmitState();
  });
})();

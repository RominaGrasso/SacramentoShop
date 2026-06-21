/**
 * Animal donation modal — home hero CTA for Responsabilidad Animal Colonia.
 * Primary action: official Colectate donation page. Optional: WhatsApp for questions.
 */
(function () {
  const COLECTATE_URL = "https://colectate.com.uy/rac";
  const WHATSAPP_NUMBER = "59894420199";

  const overlay = document.getElementById("popupAnimalDonation");
  const trigger = document.getElementById("heroAnimalDonationBtn");
  const whatsappBtn = document.getElementById("animalDonationWhatsAppBtn");

  if (!overlay || !trigger || !whatsappBtn) return;

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

  const openWhatsAppInfo = () => {
    const message = t(
      "animal_donation_wa_info_message",
      "Hola. Quisiera obtener más información sobre cómo colaborar con Responsabilidad Animal Colonia."
    );
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

  whatsappBtn.addEventListener("click", () => openWhatsAppInfo());

  const modal = window.bindSacramentoModal({ overlay });
  if (!modal) return;

  trigger.addEventListener("click", () => modal.open());

  // Ensure Colectate link always points to the official URL.
  const colectateBtn = document.getElementById("animalDonationColectateBtn");
  if (colectateBtn) {
    colectateBtn.setAttribute("href", COLECTATE_URL);
  }
})();

/**
 * B2B agency rates request form → POST /api/agencies/inquiry (backend + Resend).
 * WhatsApp is fallback only when the API/email path fails.
 */
(function () {
  "use strict";

  const INQUIRY_PATH = "/api/agencies/inquiry";
  const COMMERCIAL_WHATSAPP = "59898945542";
  const COMMERCIAL_EMAIL = "contacto@sacraadventures.com";

  const form = document.getElementById("agenciesRatesForm");
  const successEl = document.getElementById("agenciesFormSuccess");
  const formWrap = document.getElementById("agenciesFormWrap");
  const errorEl = document.getElementById("agenciesFormError");
  const submitBtn = form?.querySelector(".agencies-form__submit");
  const whatsappFallbackBtn = document.getElementById("agenciesFormWhatsAppFallback");

  const getLang = () =>
    (typeof window.getInitialLanguage === "function" ? window.getInitialLanguage() : "en").toLowerCase();

  const t = (key, fallback) => {
    const lang = getLang();
    const dict = window.__SACRAMENTO_TRANSLATIONS || {};
    return dict?.[lang]?.[key] || dict?.en?.[key] || fallback;
  };

  function resolveInquiryEndpointCandidates() {
    if (typeof window !== "undefined" && window.SacramentoPaymentsApi?.buildResolveEndpointCandidates) {
      return window.SacramentoPaymentsApi.buildResolveEndpointCandidates(INQUIRY_PATH);
    }
    const host = typeof window !== "undefined" ? window.location?.hostname || "" : "";
    const local = host === "localhost" || host === "127.0.0.1";
    const productionBase = "https://sacramento-payments-test.onrender.com";
    const localBase = "http://localhost:8787";
    if (local) {
      return [`${localBase}${INQUIRY_PATH}`, `${productionBase}${INQUIRY_PATH}`];
    }
    return [`${productionBase}${INQUIRY_PATH}`, INQUIRY_PATH];
  }

  function collectFormData(formEl) {
    const fd = new FormData(formEl);
    const interests = fd.getAll("agencies_interest");
    return {
      name: String(fd.get("agencies_name") || "").trim(),
      company: String(fd.get("agencies_company") || "").trim(),
      country: String(fd.get("agencies_country") || "").trim(),
      city: String(fd.get("agencies_city") || "").trim(),
      email: String(fd.get("agencies_email") || "").trim(),
      phone: String(fd.get("agencies_phone") || "").trim(),
      website: String(fd.get("agencies_website") || "").trim(),
      companyType: String(fd.get("agencies_company_type") || "").trim(),
      interests,
      passengerTypes: fd.getAll("agencies_passengers"),
      message: String(fd.get("agencies_message") || "").trim(),
      privacyAccepted: fd.get("agencies_privacy") === "on",
      hp_field: String(fd.get("agencies_hp_field") || "").trim()
    };
  }

  function validate(data) {
    if (!data.name) return t("agencies_err_name", "Please enter your full name.");
    if (!data.company) return t("agencies_err_company", "Please enter your agency or company name.");
    if (!data.country) return t("agencies_err_country", "Please enter your country.");
    if (!data.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
      return t("agencies_err_email", "Please enter a valid corporate email.");
    }
    if (!data.companyType) return t("agencies_err_company_type", "Please select a company type.");
    if (!data.privacyAccepted) {
      return t("agencies_err_privacy", "You must accept the Privacy Policy.");
    }
    return "";
  }

  function labelCompanyType(value) {
    const map = {
      travel_agency: t("agencies_company_travel_agency", "Travel agency"),
      tour_operator: t("agencies_company_tour_operator", "Tour operator"),
      dmc: t("agencies_company_dmc", "DMC"),
      other: t("agencies_company_other", "Other")
    };
    return map[value] || value;
  }

  function labelPassengerType(value) {
    const map = {
      individual: t("agencies_passengers_individual", "Individual travelers"),
      couples_families: t("agencies_passengers_couples", "Couples / Families"),
      groups: t("agencies_passengers_groups", "Groups"),
      corporate: t("agencies_passengers_corporate", "Corporate / Incentives")
    };
    return map[value] || value;
  }

  function labelInterest(value) {
    const key = `agencies_interest_${value}`;
    return t(key, value);
  }

  function buildWhatsAppMessage(data) {
    const lines = [
      t("agencies_wa_intro", "Hello! I would like to request B2B agency rates from Sacramento Adventures:"),
      "",
      `${t("agencies_label_name", "Full name")}: ${data.name}`,
      `${t("agencies_label_company", "Agency / Company")}: ${data.company}`,
      `${t("agencies_label_country", "Country")}: ${data.country}`,
      `${t("agencies_label_city", "City")}: ${data.city || "—"}`,
      `${t("agencies_label_email", "Corporate email")}: ${data.email}`,
      `${t("agencies_label_phone", "WhatsApp / Phone")}: ${data.phone || "—"}`,
      `${t("agencies_label_website", "Agency website")}: ${data.website || "—"}`,
      `${t("agencies_label_company_type", "Company type")}: ${labelCompanyType(data.companyType)}`,
      `${t("agencies_interests_title", "Services of interest")}: ${
        data.interests.length ? data.interests.map(labelInterest).join(", ") : "—"
      }`,
      `${t("agencies_passengers_title", "What type of passengers do you work with?")}: ${
        data.passengerTypes.length ? data.passengerTypes.map(labelPassengerType).join(", ") : "—"
      }`,
      "",
      `${t("agencies_label_message", "Message / Comments")}:`,
      data.message || "—"
    ];
    return lines.join("\n");
  }

  function buildApiPayload(data) {
    return {
      name: data.name,
      company: data.company,
      country: data.country,
      city: data.city,
      email: data.email,
      phone: data.phone,
      website: data.website,
      companyType: data.companyType,
      interests: data.interests,
      passengerTypes: data.passengerTypes,
      message: data.message,
      language: getLang(),
      privacyAccepted: data.privacyAccepted,
      hp_field: data.hp_field
    };
  }

  async function postInquiry(payload) {
    const candidates = resolveInquiryEndpointCandidates();
    let lastError = null;
    for (const url of candidates) {
      try {
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify(payload)
        });
        if (res.ok) {
          return { ok: true };
        }
        lastError = { status: res.status, url };
      } catch (err) {
        lastError = { message: err instanceof Error ? err.message : String(err), url };
      }
    }
    return { ok: false, error: lastError };
  }

  function setSubmitting(isSubmitting) {
    if (!submitBtn) return;
    submitBtn.disabled = isSubmitting;
    if (isSubmitting) {
      submitBtn.dataset.agenciesSubmitDefault = submitBtn.textContent || "";
      submitBtn.textContent = t("agencies_submit_sending", "Sending…");
    } else if (submitBtn.dataset.agenciesSubmitDefault) {
      submitBtn.textContent = submitBtn.dataset.agenciesSubmitDefault;
      delete submitBtn.dataset.agenciesSubmitDefault;
    }
  }

  function hideError() {
    if (errorEl) errorEl.hidden = true;
  }

  function showError() {
    if (errorEl) {
      errorEl.hidden = false;
      errorEl.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }

  function showSuccess() {
    hideError();
    if (formWrap) formWrap.hidden = true;
    if (successEl) {
      successEl.hidden = false;
      successEl.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }

  function openWhatsAppFallback(data) {
    const message = buildWhatsAppMessage(data);
    const pendingTab =
      typeof window.sacramentoOpenWhatsAppBlankTabForGesture === "function"
        ? window.sacramentoOpenWhatsAppBlankTabForGesture()
        : null;
    if (typeof window.sacramentoOpenWhatsApp === "function") {
      window.sacramentoOpenWhatsApp(COMMERCIAL_WHATSAPP, message, pendingTab);
    } else if (typeof window.sacramentoBuildWhatsAppUrl === "function") {
      window.open(window.sacramentoBuildWhatsAppUrl(COMMERCIAL_WHATSAPP, message), "_blank", "noopener,noreferrer");
    } else {
      const subject = encodeURIComponent(`B2B rates request — ${data.company}`);
      const body = encodeURIComponent(message);
      window.location.href = `mailto:${COMMERCIAL_EMAIL}?subject=${subject}&body=${body}`;
    }
  }

  let lastFailedPayload = null;

  function initHeroScroll() {
    document.querySelectorAll("[data-agencies-scroll-form]").forEach((el) => {
      el.addEventListener("click", (ev) => {
        const target = document.getElementById("agencies-form");
        if (!target) return;
        ev.preventDefault();
        target.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    });
  }

  function initMeta() {
    const update = () => {
      const meta = document.querySelector('meta[name="description"]');
      if (meta) {
        meta.setAttribute(
          "content",
          t("agencies_meta_description", meta.getAttribute("content") || "")
        );
      }
    };
    document.addEventListener("sacramento:setLanguage", update);
    update();
  }

  function initLegalHeaderMenu() {
    const toggle = document.querySelector(".menu-toggle");
    const menu = document.querySelector(".hamburger-menu");
    if (!toggle || !menu) return;

    toggle.addEventListener("click", (e) => {
      e.stopPropagation();
      menu.style.display = menu.style.display === "block" ? "none" : "block";
    });

    document.addEventListener("click", (e) => {
      if (!menu.contains(e.target) && !toggle.contains(e.target)) {
        menu.style.display = "none";
      }
    });

    menu.querySelectorAll("li[data-filter]").forEach((item) => {
      item.addEventListener("click", () => {
        menu.style.display = "none";
        window.location.href = "index.html#experiences";
      });
    });
  }

  if (whatsappFallbackBtn) {
    whatsappFallbackBtn.addEventListener("click", () => {
      if (lastFailedPayload) {
        openWhatsAppFallback(lastFailedPayload);
      }
    });
  }

  if (form) {
    form.addEventListener("submit", async (ev) => {
      ev.preventDefault();
      hideError();
      const data = collectFormData(form);
      const err = validate(data);
      if (err) {
        window.alert(err);
        return;
      }

      const payload = buildApiPayload(data);
      setSubmitting(true);
      const result = await postInquiry(payload);
      setSubmitting(false);

      if (result.ok) {
        lastFailedPayload = null;
        showSuccess();
        form.reset();
        return;
      }

      lastFailedPayload = data;
      showError();
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      initHeroScroll();
      initMeta();
      initLegalHeaderMenu();
    });
  } else {
    initHeroScroll();
    initMeta();
    initLegalHeaderMenu();
  }
})();

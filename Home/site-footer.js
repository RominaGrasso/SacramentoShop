(function () {
  "use strict";

  var CONTACT = {
    phoneTel: "+59898945542",
    phoneDisplay: "+598 98 945 542",
    email: "contacto@sacraadventures.com",
    instagram: "https://www.instagram.com/_sacramentoadventures/",
    instagramHandle: "@_sacramentoadventures",
    facebook: "https://www.facebook.com/profile.php?id=61590489881741",
    whatsappNumber: "59898945542",
  };

  function resolveFooterPaths() {
    var pathname = String(window.location.pathname || "").replace(/\\/g, "/");

    if (/\/Actividades\//i.test(pathname)) {
      return {
        home: "../Home/index.html",
        experiences: "../Home/index.html#experiences",
        packages: "../paquetes/index.html",
        services: "../Home/index.html#info-util",
        about: "aboutus.html",
        terms: "../Home/terms.html",
        privacy: "../Home/privacy.html",
        cancellation: "../Home/cancellation.html",
        logo: "../Assets/images/sacramento-logo-new.svg",
      };
    }

    if (/\/paquetes\//i.test(pathname)) {
      return {
        home: "../Home/index.html",
        experiences: "../Home/index.html#experiences",
        packages: "index.html",
        services: "../Home/index.html#info-util",
        about: "../Actividades/aboutus.html",
        terms: "../Home/terms.html",
        privacy: "../Home/privacy.html",
        cancellation: "../Home/cancellation.html",
        logo: "../Assets/images/sacramento-logo-new.svg",
      };
    }

    return {
      home: "index.html",
      experiences: "index.html#experiences",
      packages: "../paquetes/index.html",
      services: "index.html#info-util",
      about: "../Actividades/aboutus.html",
      terms: "terms.html",
      privacy: "privacy.html",
      cancellation: "cancellation.html",
      logo: "../Assets/images/sacramento-logo-new.svg",
    };
  }

  function ensureFontAwesome() {
    if (document.querySelector('link[href*="font-awesome"]')) return;
    var link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css";
    document.head.appendChild(link);
  }

  function buildFooterHtml(paths) {
    return (
      '<footer class="home-site-footer" id="site-footer">' +
      '<div class="home-site-footer__inner">' +
      '<div class="home-site-footer__columns">' +
      '<div class="home-site-footer__col home-site-footer__col--brand">' +
      '<a class="home-site-footer__logo-link" href="' +
      paths.home +
      '" aria-label="Sacramento Adventures home">' +
      '<img class="home-site-footer__logo" src="' +
      paths.logo +
      '" alt="Sacramento Adventures" decoding="async" width="168" height="48"/>' +
      "</a>" +
      '<p class="home-site-footer__brand">Sacramento Adventures</p>' +
      '<p class="home-site-footer__text" data-translate="home_footer_tagline">Authentic local experiences in Colonia del Sacramento.</p>' +
      '<p class="home-site-footer__text home-site-footer__text--muted" data-translate="home_footer_official">Official Tour Operator registered with Uruguay\'s Ministry of Tourism.</p>' +
      '<div class="home-site-footer__social" aria-label="Social media">' +
      '<a class="home-site-footer__social-link" href="' +
      CONTACT.instagram +
      '" rel="noopener noreferrer" target="_blank" data-translate-aria-label="home_footer_social_instagram_aria" aria-label="Instagram">' +
      '<i class="fa-brands fa-instagram" aria-hidden="true"></i>' +
      "</a>" +
      '<a class="home-site-footer__social-link" href="' +
      CONTACT.facebook +
      '" rel="noopener noreferrer" target="_blank" data-translate-aria-label="home_footer_social_facebook_aria" aria-label="Facebook">' +
      '<i class="fa-brands fa-facebook-f" aria-hidden="true"></i>' +
      "</a>" +
      '<a class="home-site-footer__social-link home-site-footer__wa-link" href="https://wa.me/' +
      CONTACT.whatsappNumber +
      '" rel="noopener noreferrer" target="_blank" data-translate-aria-label="home_footer_social_whatsapp_aria" aria-label="WhatsApp">' +
      '<i class="fa-brands fa-whatsapp" aria-hidden="true"></i>' +
      "</a>" +
      "</div>" +
      "</div>" +
      '<div class="home-site-footer__col">' +
      '<p class="home-site-footer__heading" data-translate="home_footer_contact_title">Contact</p>' +
      '<ul class="home-site-footer__links">' +
      "<li>" +
      '<a class="home-site-footer__link home-site-footer__contact-link" href="tel:' +
      CONTACT.phoneTel +
      '">' +
      '<i class="fa-solid fa-phone home-site-footer__contact-icon" aria-hidden="true"></i>' +
      "<span>" +
      CONTACT.phoneDisplay +
      "</span>" +
      "</a>" +
      "</li>" +
      "<li>" +
      '<a class="home-site-footer__link home-site-footer__contact-link" href="mailto:' +
      CONTACT.email +
      '">' +
      '<i class="fa-solid fa-envelope home-site-footer__contact-icon" aria-hidden="true"></i>' +
      "<span>" +
      CONTACT.email +
      "</span>" +
      "</a>" +
      "</li>" +
      "<li>" +
      '<a class="home-site-footer__link home-site-footer__contact-link" href="' +
      CONTACT.instagram +
      '" rel="noopener noreferrer" target="_blank">' +
      '<i class="fa-brands fa-instagram home-site-footer__contact-icon" aria-hidden="true"></i>' +
      "<span>" +
      CONTACT.instagramHandle +
      "</span>" +
      "</a>" +
      "</li>" +
      "</ul>" +
      "</div>" +
      '<div class="home-site-footer__col">' +
      '<p class="home-site-footer__heading" data-translate="home_footer_explore_title">Explore</p>' +
      '<ul class="home-site-footer__links">' +
      '<li><a class="home-site-footer__link" href="' +
      paths.experiences +
      '" data-translate="home_footer_experiences">Our Experiences</a></li>' +
      '<li><a class="home-site-footer__link" href="' +
      paths.packages +
      '" data-translate="home_footer_packages">Travel Packages</a></li>' +
      '<li><a class="home-site-footer__link" href="' +
      paths.services +
      '" data-translate="home_footer_useful_services">Useful Services</a></li>' +
      '<li><a class="home-site-footer__link" href="' +
      paths.about +
      '" data-translate="home_footer_about">About Us</a></li>' +
      '<li><a class="home-site-footer__link" href="' +
      paths.terms +
      '" data-translate="home_footer_terms">Terms and Conditions</a></li>' +
      '<li><a class="home-site-footer__link" href="' +
      paths.privacy +
      '" data-translate="home_footer_privacy">Privacy Policy</a></li>' +
      '<li><a class="home-site-footer__link" href="' +
      paths.cancellation +
      '" data-translate="home_footer_cancellation">Cancellation Policy</a></li>' +
      "</ul>" +
      "</div>" +
      "</div>" +
      '<hr class="home-site-footer__divider"/>' +
      '<div class="home-site-footer__bottom">' +
      '<p class="home-site-footer__copyright" data-translate="home_footer_copyright">&copy; 2026 Sacramento Adventures. All rights reserved.</p>' +
      '<p class="home-site-footer__location" data-translate="home_footer_location">Colonia del Sacramento, Uruguay.</p>' +
      '<p class="home-site-footer__motto" data-translate="home_footer_motto">Designed to help travelers discover the real Colonia.</p>' +
      "</div>" +
      "</div>" +
      "</footer>"
    );
  }

  function findFooterInsertPoint() {
    return (
      document.querySelector(".whatsapp-float") ||
      document.querySelector(".taxi-float") ||
      document.querySelector("script[data-sacramento-footer]") ||
      null
    );
  }

  function mountSacramentoSiteFooter() {
    if (document.body.dataset.sacramentoFooterMounted === "1") return;

    ensureFontAwesome();

    var paths = resolveFooterPaths();
    var html = buildFooterHtml(paths);
    var wrapper = document.createElement("div");
    wrapper.innerHTML = html;
    var footer = wrapper.firstElementChild;
    if (!footer) return;

    var existing = document.querySelector(".home-site-footer");
    if (existing) {
      existing.replaceWith(footer);
    } else {
      var insertBefore = findFooterInsertPoint();
      if (insertBefore && insertBefore.parentNode) {
        insertBefore.parentNode.insertBefore(footer, insertBefore);
      } else {
        document.body.appendChild(footer);
      }
    }

    document.body.dataset.sacramentoFooterMounted = "1";

    if (typeof window.sacramentoInitWhatsAppFloatLinks === "function") {
      window.sacramentoInitWhatsAppFloatLinks(document);
    }

    document.dispatchEvent(new CustomEvent("sacramento:footerMounted"));

    if (typeof window.setLanguage === "function" && typeof window.getInitialLanguage === "function") {
      window.setLanguage(window.getInitialLanguage());
    }
  }

  window.mountSacramentoSiteFooter = mountSacramentoSiteFooter;

  if (document.body) {
    mountSacramentoSiteFooter();
  } else {
    document.addEventListener("DOMContentLoaded", mountSacramentoSiteFooter, { once: true });
  }

  document.addEventListener("sacramento:setLanguage", function () {
    if (typeof window.sacramentoInitWhatsAppFloatLinks === "function") {
      window.sacramentoInitWhatsAppFloatLinks(document);
    }
  });
})();

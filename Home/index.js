// ===== TRANSLATIONS =====

const translations = {
    en: {
      hero_title: "Discover Colonia Like a Local",
      hero_text: "Handpicked experiences for curious travelers.",
      explore_btn: "Explore Experiences",
      coffee_title: "☕ Coffee with stunning views",
      coffee_text: "Discover hidden gems and enjoy specialty coffee at Beduina.",
      plaza_title: "🏛 Plaza de Toros Experience",
      plaza_text: "Explore the iconic bullring.",
      food_title: "🚶 Colonial Experience",
      food_text: "Discover Colonia del Sacramento.",
      book_btn: "Book Now"
    },
    es: {
      hero_title: "Descubrí Colonia como un local",
      hero_text: "Experiencias seleccionadas.",
      explore_btn: "Explorar",
      book_btn: "Reservar"
    },
    pt: {
      hero_title: "Descubra Colonia",
      hero_text: "Experiências selecionadas.",
      explore_btn: "Explorar",
      book_btn: "Reservar"
    }
  };
  
  // ===== CHANGE LANGUAGE =====
  function setLanguage(language) {
  
    if (!translations[language]) language = "en";
  
    document.querySelectorAll("[data-translate]").forEach(el => {
      const key = el.dataset.translate;
      if (translations[language][key]) {
        el.textContent = translations[language][key];
      }
    });
  
    localStorage.setItem("selectedLanguage", language);
  
    document.querySelectorAll(".lang-btn").forEach(btn => {
      btn.classList.toggle("active", btn.dataset.lang === language);
    });
  }
  
  
  // ===== INIT TODO =====
  document.addEventListener("DOMContentLoaded", () => {
  
    /* ===== LANGUAGE ===== */
    const savedLanguage = localStorage.getItem("selectedLanguage") || "en";
    setLanguage(savedLanguage);
  
    document.querySelectorAll(".lang-btn").forEach(button => {
      button.addEventListener("click", () => {
        setLanguage(button.dataset.lang);
      });
    });
  
  
    /* ===== SMOOTH SCROLL ===== */
    const exploreBtn = document.getElementById("exploreBtn");
  
    if (exploreBtn) {
      exploreBtn.addEventListener("click", e => {
        e.preventDefault();
        document.getElementById("experiences")?.scrollIntoView({
          behavior: "smooth"
        });
      });
    }
  
  
    /* ===== CARD BUTTON ACTIVE ===== */
    document.querySelectorAll(".card").forEach(card => {
      const buttons = card.querySelectorAll(".btn");
  
      buttons.forEach(btn => {
        btn.addEventListener("click", () => {
          buttons.forEach(b => b.classList.remove("clicked"));
          btn.classList.add("clicked");
        });
      });
    });
  
  
    /* ===== ACORDEÓN ===== */
    document.querySelectorAll(".acordeon").forEach(acc => {
      acc.addEventListener("click", function () {
        document.querySelectorAll(".acordeon").forEach(o => {
          if (o !== this) o.removeAttribute("open");
        });
      });
    });
  
  
    /* ===== VIDEO HOVER ===== */
    document.querySelectorAll(".card").forEach(card => {
      const video = card.querySelector(".card-video");
  
      if (!video) return;
  
      card.addEventListener("mouseenter", () => video.play());
      card.addEventListener("mouseleave", () => {
        video.pause();
        video.currentTime = 0;
      });
    });
  
  
    /* ===== HAMBURGER MENU ===== */
    const toggle = document.querySelector(".menu-toggle");
    const menu = document.querySelector(".hamburger-menu");
  
    if (toggle && menu) {
  
      toggle.addEventListener("click", (e) => {
        e.stopPropagation();
        menu.style.display =
          menu.style.display === "block" ? "none" : "block";
      });
  
      document.addEventListener("click", (e) => {
        if (!menu.contains(e.target) && !toggle.contains(e.target)) {
          menu.style.display = "none";
        }
      });
  
    }
  
  
    /* ===== FILTER CARDS ===== */
    const filters = document.querySelectorAll(".hamburger-menu li");
    const cards = document.querySelectorAll(".card");
  
    filters.forEach(filter => {
      filter.addEventListener("click", () => {
  
        const category = filter.dataset.filter;
  
        cards.forEach(card => {
  
          if (category === "all") {
            card.style.display = "block";
            return;
          }
  
          const cardCategories = card.dataset.category;
  
          if (cardCategories && cardCategories.includes(category)) {
            card.style.display = "block";
          } else {
            card.style.display = "none";
          }
  
        });
  
      });
    });
  
  
    /* ===== SEE MORE (FIX FINAL) ===== */
    document.querySelectorAll(".card").forEach(card => {
  
      const text = card.querySelector(".card-description");
      const btn = card.querySelector(".see-more");
  
      if (!text || !btn) return;
  
      // Ocultar si no hace falta
      setTimeout(() => {
        const isOverflowing = text.scrollHeight > text.clientHeight;
        if (!isOverflowing) {
          btn.style.display = "none";
        }
      }, 100);
  
      // CLICK
      btn.addEventListener("click", () => {
  
        text.classList.toggle("expanded");
  
        btn.textContent = text.classList.contains("expanded")
          ? "See less"
          : "See more";
  
      });
  
    });
  
  });
// ===== TRANSLATIONS =====

const translations = {
    en: {
      hero_title: "Discover Colonia Like a Local",
      hero_text: "Handpicked experiences for curious travelers.",
      explore_btn: "Explore Experiences",
      coffee_title: "☕ Coffee with stunning views",
      coffee_text: "Discover hidden gems and enjoy specialty coffee at Beduina, a cozy local café loved by locals and travelers alike.",
      plaza_title: "🏛 Plaza de Toros Experience with Coffee and Panoramic Views",
      plaza_text: "Explore the iconic bullring and its history with tickets and transfer included. Finish the experience with a specialty coffee at Serrano.",
      food_title: "🎭 Colonial Experience, Chivito & Plaza de Toros",
      food_text: "Experience Colonia like never before: dress in colonial outfits, take unique photos, enjoy an authentic Uruguayan chivito, and visit the iconic Plaza de Toros. A perfect mix of culture, gastronomy and history.",
      book_btn: "Book Now"
    },
  
    es: {
      hero_title: "Descubrí Colonia como un local",
      hero_text: "Experiencias seleccionadas para viajeros curiosos.",
      explore_btn: "Explorar Experiencias",
      coffee_title: "☕ Café e Historias",
      coffee_text: "Conocé locales y disfrutá café de especialidad.",
      plaza_title: "🏛 Experiencia Plaza de Toros",
      plaza_text: "Explorá la icónica plaza de toros con traslado incluido.",
      food_title: "🥙 Caminata Gastronómica",
      food_text: "Descubrí la comida de Colonia.",
      book_btn: "Reservar"
    },
  
    pt: {
      hero_title: "Descubra Colonia como um local",
      hero_text: "Experiências selecionadas para viajantes curiosos.",
      explore_btn: "Explorar Experiências",
      coffee_title: "☕ Café e Histórias",
      coffee_text: "Descubra lugares escondidos e aproveite café especial.",
      plaza_title: "🏛 Experiência Plaza de Toros",
      plaza_text: "Explore a icônica praça de touros.",
      food_title: "🥙 Experiência Gastronômica",
      food_text: "Descubra a comida de Colonia.",
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
  
    // botón activo
    document.querySelectorAll(".lang-btn").forEach(btn => {
      btn.classList.toggle("active", btn.dataset.lang === language);
    });
  }
  
  
  
  // ===== INIT =====
  
  document.addEventListener("DOMContentLoaded", () => {
  
    // idioma inicial
    const savedLanguage = localStorage.getItem("selectedLanguage") || "en";
    setLanguage(savedLanguage);
  
  
    // CLICK BOTONES IDIOMA
    document.querySelectorAll(".lang-btn").forEach(button => {
      button.addEventListener("click", () => {
        setLanguage(button.dataset.lang);
      });
    });
  
  
    // SMOOTH SCROLL
    const exploreBtn = document.getElementById("exploreBtn");
  
    if (exploreBtn) {
      exploreBtn.addEventListener("click", e => {
        e.preventDefault();
        document
          .getElementById("experiences")
          ?.scrollIntoView({ behavior: "smooth" });
      });
    }
  
  
    // BOTONES CARD
    document.querySelectorAll(".card").forEach(card => {
  
      const buttons = card.querySelectorAll(".btn");
  
      buttons.forEach(btn => {
        btn.addEventListener("click", () => {
  
          buttons.forEach(b => b.classList.remove("clicked"));
          btn.classList.add("clicked");
  
        });
      });
  
    });
  
  
    // ACORDEÓN
    document.querySelectorAll(".acordeon").forEach(acc => {
  
      acc.addEventListener("click", function () {
  
        document.querySelectorAll(".acordeon").forEach(o => {
          if (o !== this) o.removeAttribute("open");
        });
  
      });
  
    });
  
  
    // ===== VIDEO HOVER =====
  
    document.querySelectorAll(".card").forEach(card => {
  
      const video = card.querySelector(".card-video");
  
      if (!video) return;
  
      card.addEventListener("mouseenter", () => {
        video.play();
      });
  
      card.addEventListener("mouseleave", () => {
        video.pause();
        video.currentTime = 0;
      });
  
    });
  
  });

  const toggle = document.querySelector(".menu-toggle");
const menu = document.querySelector(".hamburger-menu");

toggle.addEventListener("click", () => {
  menu.style.display =
    menu.style.display === "block" ? "none" : "block";
});

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
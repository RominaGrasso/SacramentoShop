// ===== TRANSLATIONS =====

const translations = {
    en: {
      hero_title: "Discover Colonia Like a Local",
      hero_text: "Handpicked experiences for curious travelers.",
      explore_btn: "Explore Experiences",
  
      coffee_title: "☕ Coffee & Stories",
      coffee_text: "Discover hidden gems, and enjoy specialty coffee.",
  
      plaza_title: "🏛 Plaza de Toros Experience",
      plaza_text: "Explore the iconic bullring and its history with transfer included.",
  
      food_title: "🥙 Local Food Experience",
      food_text: "Discover Colonia’s food scene, delicious Shawarma and traditional Rotisserie Chicken!",
  
      book_btn: "Book Now"
    },
  
    es: {
      hero_title: "Descubrí Colonia como un local",
      hero_text: "Experiencias seleccionadas para viajeros curiosos.",
      explore_btn: "Explorar Experiencias",
  
      coffee_title: "☕ Café e Historias",
      coffee_text: "Conocé locales, descubrí rincones ocultos y disfrutá café de especialidad.",
  
      plaza_title: "🏛 Experiencia Plaza de Toros",
      plaza_text: "Explorá la icónica plaza de toros con traslado incluido.",
  
      food_title: "🥙 Caminata Gastronómica",
      food_text: "Descubrí la comida de Colonia, desde el mejor Shawarma hasta el tradicional pollo al spiedo.",
  
      book_btn: "Reservar"
    }
  };
  
  
  // ===== FUNCTION TO CHANGE LANGUAGE =====
  
  function setLanguage(language) {
  
    const elements = document.querySelectorAll("[data-translate]");
  
    elements.forEach(element => {
      const key = element.getAttribute("data-translate");
  
      if (translations[language][key]) {
        element.textContent = translations[language][key];
      }
    });
  
    localStorage.setItem("selectedLanguage", language);
  
    // Marcar botón activo
    document.querySelectorAll(".language-switch button")
      .forEach(btn => btn.classList.remove("active"));
  
    const activeButton = document.querySelector(
      `.language-switch button[onclick="setLanguage('${language}')"]`
    );
  
    if (activeButton) {
      activeButton.classList.add("active");
    }
  }
  
  
  // ===== AUTO LOAD LANGUAGE + SCROLL + ACTIVE BUTTONS + ACORDEON =====
  
  document.addEventListener("DOMContentLoaded", () => {
  
    // ===== IDIOMA AUTOMÁTICO =====
  
    const savedLanguage = localStorage.getItem("selectedLanguage");
  
    if (savedLanguage) {
      setLanguage(savedLanguage);
    } else {
      const browserLanguage = navigator.language.startsWith("es") ? "es" : "en";
      setLanguage(browserLanguage);
    }
  
  
    // ===== SMOOTH SCROLL =====
  
    const exploreBtn = document.getElementById("exploreBtn");
  
    if (exploreBtn) {
      exploreBtn.addEventListener("click", function(e) {
        e.preventDefault();
  
        const section = document.getElementById("experiences");
  
        if (section) {
          section.scrollIntoView({
            behavior: "smooth"
          });
        }
      });
    }
  
  
    // ===== BOTONES ACTIVOS POR CARD =====
  
    const cards = document.querySelectorAll(".card");
  
    cards.forEach(card => {
  
      const buttons = card.querySelectorAll(".btn");
  
      buttons.forEach(button => {
        button.addEventListener("click", function() {
  
          buttons.forEach(btn => btn.classList.remove("clicked"));
          this.classList.add("clicked");
  
        });
      });
  
    });
  
  
  // ===== ACORDEÓN (SOLO UNO ABIERTO) =====

const acordeones = document.querySelectorAll(".acordeon");

acordeones.forEach(acordeon => {
  acordeon.addEventListener("click", function() {

    acordeones.forEach(otro => {
      if (otro !== this) {
        otro.removeAttribute("open");
      }
    });

  });
});
}); // ✅ cierre principal

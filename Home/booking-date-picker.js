(function () {
  function localIso(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }

  function init() {
    const input = document.getElementById("bookingVisitDate");
    if (!input || input.tagName !== "INPUT") return;
    const key = input.getAttribute("data-booking-date-key") || "selectedDate";
    const todayIso = localIso(new Date());
    if (!input.min) input.min = todayIso;
    const min = input.min;
    const stored = localStorage.getItem(key);
    const valid =
      /^\d{4}-\d{2}-\d{2}$/.test(stored || "") && stored >= min;
    if (valid) input.value = stored;
    else {
      input.value = min;
      localStorage.setItem(key, min);
    }
    input.addEventListener("change", () => {
      if (input.value && input.value >= min) {
        localStorage.setItem(key, input.value);
        document.dispatchEvent(
          new CustomEvent("sacramento:visitDateChanged", { detail: { key } })
        );
      }
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();

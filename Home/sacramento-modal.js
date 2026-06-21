/**
 * Reusable modal helper for Sacramento Adventures.
 * Handles open/close, ESC key, overlay click, smooth transitions, and scroll lock.
 */
(function () {
  const CLOSE_ANIM_MS = 250;

  /**
   * @param {object} options
   * @param {HTMLElement} options.overlay - Root `.popup-overlay` element.
   * @param {string[]} [options.closeSelectors] - Selectors for close controls inside overlay.
   * @param {() => void} [options.onOpen]
   * @param {() => void} [options.onClose]
   * @returns {{ open: () => void, close: () => void, isOpen: () => boolean } | null}
   */
  function bindSacramentoModal(options) {
    const overlay = options?.overlay;
    if (!overlay) return null;

    const closeSelectors = options.closeSelectors || [".close-x"];
    let closingTimer = null;

    const isOpen = () => overlay.classList.contains("active");

    const close = () => {
      if (!isOpen()) return;
      overlay.classList.add("is-closing");
      overlay.setAttribute("aria-hidden", "true");
      document.body.classList.remove("sacramento-modal-open");

      if (closingTimer) window.clearTimeout(closingTimer);
      closingTimer = window.setTimeout(() => {
        overlay.classList.remove("active", "is-closing");
        options.onClose?.();
        closingTimer = null;
      }, CLOSE_ANIM_MS);
    };

    const open = () => {
      if (closingTimer) {
        window.clearTimeout(closingTimer);
        closingTimer = null;
      }
      overlay.classList.remove("is-closing");
      overlay.classList.add("active");
      overlay.setAttribute("aria-hidden", "false");
      document.body.classList.add("sacramento-modal-open");
      options.onOpen?.();

      const closeBtn = overlay.querySelector(".close-x");
      if (closeBtn && typeof closeBtn.focus === "function") {
        closeBtn.focus();
      }
    };

    overlay.addEventListener("click", (event) => {
      if (event.target === overlay) close();
    });

    closeSelectors.forEach((selector) => {
      overlay.querySelectorAll(selector).forEach((control) => {
        control.addEventListener("click", (event) => {
          event.preventDefault();
          close();
        });
      });
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && isOpen()) close();
    });

    return { open, close, isOpen };
  }

  window.bindSacramentoModal = bindSacramentoModal;
})();

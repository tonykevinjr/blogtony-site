(() => {
  const storageKey = "blogTonyTheme";
  const modeButtons = document.querySelectorAll(".mode-pill");
  const modeSwitchers = document.querySelectorAll(".mode-switcher");
  const headerToggle = document.querySelector(".header-toggle");
  const bunnyToggles = document.querySelectorAll(".bunny-toggle");
  const bunnyTriggers = document.querySelectorAll(".bunny-trigger");
  const ignoranceTriggers = document.querySelectorAll(".ignorance-reveal");
  const themeImages = document.querySelectorAll("[data-neon-src][data-soft-src]");

  function setBunnyRevealed(isRevealed) {
    document.body.classList.toggle("bunny-revealed", isRevealed);
    if (!isRevealed) {
      document.body.classList.remove("ignorance-revealed");
    }
    bunnyToggles.forEach((button) => {
      button.setAttribute("aria-pressed", String(isRevealed));
      button.setAttribute("aria-label", isRevealed ? "Hide bunny" : "Reveal bunny");
    });
  }

  function setTheme(theme) {
    const isSoft = theme === "soft";
    document.body.classList.toggle("soft-mode", isSoft);
    bunnyToggles.forEach((button) => {
      button.disabled = isSoft;
    });

    if (isSoft) {
      setBunnyRevealed(false);
    }

    themeImages.forEach((image) => {
      image.src = isSoft ? image.dataset.softSrc : image.dataset.neonSrc;
    });

    modeButtons.forEach((button) => {
      button.setAttribute("aria-pressed", String(button.dataset.theme === theme));
    });
  }

  setTheme(localStorage.getItem(storageKey) === "soft" ? "soft" : "neon");

  modeButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const selectedTheme = button.dataset.theme;
      localStorage.setItem(storageKey, selectedTheme);
      setTheme(selectedTheme);
    });
  });

  modeSwitchers.forEach((switcher) => {
    const toggle = switcher.querySelector(".mode-switcher-toggle");
    const close = switcher.querySelector(".mode-switcher-close");

    function setSwitcherExpanded(isExpanded) {
      switcher.classList.toggle("is-expanded", isExpanded);
      toggle?.setAttribute("aria-expanded", String(isExpanded));
      toggle?.setAttribute("aria-label", isExpanded ? "Hide mode options" : "Show mode options");
    }

    toggle?.addEventListener("click", () => {
      setSwitcherExpanded(!switcher.classList.contains("is-expanded"));
    });

    close?.addEventListener("click", () => setSwitcherExpanded(false));
  });

  headerToggle?.addEventListener("click", () => {
    const isCollapsed = document.body.classList.toggle("header-collapsed");
    headerToggle.setAttribute("aria-expanded", String(!isCollapsed));
    headerToggle.setAttribute("aria-label", isCollapsed ? "Expand header" : "Collapse header");
  });

  bunnyToggles.forEach((button) => {
    button.addEventListener("click", () => {
      if (!document.body.classList.contains("soft-mode")) {
        setBunnyRevealed(!document.body.classList.contains("bunny-revealed"));
      }
    });
  });

  bunnyTriggers.forEach((button) => {
    button.addEventListener("click", () => {
      if (!document.body.classList.contains("soft-mode") && document.body.classList.contains("bunny-revealed")) {
        document.body.classList.add("ignorance-revealed");
      }
    });
  });

  ignoranceTriggers.forEach((button) => {
    button.addEventListener("click", () => setBunnyRevealed(false));
  });
})();

(() => {
  const storageKey = "blogTonyTheme";
  const modeButtons = document.querySelectorAll(".mode-pill");
  const modeSwitchers = document.querySelectorAll(".mode-switcher");
  const headerToggle = document.querySelector(".header-toggle");
  const bunnyToggles = document.querySelectorAll(".bunny-toggle");
  const bunnyTriggers = document.querySelectorAll(".bunny-trigger");
  const ignoranceTriggers = document.querySelectorAll(".ignorance-reveal");
  const matrixToggles = document.querySelectorAll(".matrix-toggle");
  const matrixTriggers = document.querySelectorAll(".matrix-trigger");
  const matrixMessages = document.querySelectorAll(".matrix-message");
  const matrixFinals = document.querySelectorAll(".matrix-final");
  const sidebarToggles = document.querySelectorAll(".sidebar-toggle");
  const trinityTriggers = document.querySelectorAll(".trinity-trigger");
  const trinityMessages = document.querySelectorAll(".trinity-message");
  const themeImages = document.querySelectorAll("[data-neon-src][data-soft-src]");
  const returnDuration = 2600;
  const sidebarFlipDuration = 1600;
  let bunnyReturnTimer;
  let matrixReturnTimer;
  let sidebarReturnTimer;

  function updateEasterEggAvailability() {
    const isSoft = document.body.classList.contains("soft-mode");
    const bunnyIsActive = document.body.classList.contains("bunny-revealed") || document.body.classList.contains("bunny-returning");
    const matrixIsActive = document.body.classList.contains("matrix-revealed") || document.body.classList.contains("matrix-returning");
    const sidebarIsActive = document.body.classList.contains("sidebar-flipped") || document.body.classList.contains("sidebar-returning");

    bunnyToggles.forEach((button) => {
      button.disabled = isSoft || matrixIsActive || sidebarIsActive;
    });
    matrixToggles.forEach((button) => {
      button.disabled = isSoft || bunnyIsActive || sidebarIsActive;
    });
    sidebarToggles.forEach((button) => {
      button.disabled = isSoft || bunnyIsActive || matrixIsActive;
    });
  }

  function setSidebarFlipped(isFlipped) {
    const wasFlipped = document.body.classList.contains("sidebar-flipped");
    clearTimeout(sidebarReturnTimer);

    if (isFlipped) {
      document.body.classList.remove("sidebar-returning", "trinity-message-revealed");
    } else if (wasFlipped) {
      document.body.classList.add("sidebar-returning");
      sidebarReturnTimer = setTimeout(() => {
        document.body.classList.remove("sidebar-returning", "trinity-message-revealed");
        updateEasterEggAvailability();
      }, sidebarFlipDuration);
    } else {
      document.body.classList.remove("trinity-message-revealed");
    }

    document.body.classList.toggle("sidebar-flipped", isFlipped);
    sidebarToggles.forEach((button) => {
      button.setAttribute("aria-expanded", String(isFlipped));
      button.setAttribute("aria-label", isFlipped ? "Return to the sidebar" : "Reveal Trinity");
    });
    updateEasterEggAvailability();
  }

  function setBunnyRevealed(isRevealed) {
    const wasRevealed = document.body.classList.contains("bunny-revealed");
    clearTimeout(bunnyReturnTimer);

    if (isRevealed) {
      document.body.classList.remove("bunny-returning", "ignorance-revealed");
    } else if (wasRevealed) {
      document.body.classList.add("bunny-returning");
      bunnyReturnTimer = setTimeout(() => {
        document.body.classList.remove("bunny-returning", "ignorance-revealed");
        updateEasterEggAvailability();
      }, returnDuration);
    } else {
      document.body.classList.remove("ignorance-revealed");
    }

    document.body.classList.toggle("bunny-revealed", isRevealed);
    bunnyToggles.forEach((button) => {
      button.setAttribute("aria-pressed", String(isRevealed));
      button.setAttribute("aria-label", isRevealed ? "Hide bunny" : "Reveal bunny");
    });
    updateEasterEggAvailability();
  }

  function setMatrixRevealed(isRevealed) {
    const wasRevealed = document.body.classList.contains("matrix-revealed");
    clearTimeout(matrixReturnTimer);

    if (isRevealed) {
      document.body.classList.remove("matrix-returning", "matrix-message-revealed", "matrix-final-revealed");
    } else if (wasRevealed) {
      document.body.classList.add("matrix-returning");
      matrixReturnTimer = setTimeout(() => {
        document.body.classList.remove("matrix-returning", "matrix-message-revealed", "matrix-final-revealed");
        updateEasterEggAvailability();
      }, returnDuration);
    } else {
      document.body.classList.remove("matrix-message-revealed", "matrix-final-revealed");
    }

    document.body.classList.toggle("matrix-revealed", isRevealed);
    matrixToggles.forEach((button) => {
      button.setAttribute("aria-expanded", String(isRevealed));
      button.setAttribute("aria-label", isRevealed ? "Hide the switch" : "Reveal the switch");
    });
    updateEasterEggAvailability();
  }

  function setTheme(theme) {
    const isSoft = theme === "soft";
    document.body.classList.toggle("soft-mode", isSoft);
    if (isSoft) {
      setBunnyRevealed(false);
      setMatrixRevealed(false);
      setSidebarFlipped(false);
    }

    themeImages.forEach((image) => {
      image.src = isSoft ? image.dataset.softSrc : image.dataset.neonSrc;
    });

    modeButtons.forEach((button) => {
      button.setAttribute("aria-pressed", String(button.dataset.theme === theme));
    });

    updateEasterEggAvailability();
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
      const bunnyIsOpen = document.body.classList.contains("bunny-revealed");
      const matrixIsActive = document.body.classList.contains("matrix-revealed") || document.body.classList.contains("matrix-returning");
      if (!document.body.classList.contains("soft-mode") && (bunnyIsOpen || !matrixIsActive)) {
        setBunnyRevealed(!bunnyIsOpen);
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

  matrixToggles.forEach((button) => {
    button.addEventListener("click", () => {
      const matrixIsOpen = document.body.classList.contains("matrix-revealed");
      const bunnyIsActive = document.body.classList.contains("bunny-revealed") || document.body.classList.contains("bunny-returning");
      if (!document.body.classList.contains("soft-mode") && (matrixIsOpen || !bunnyIsActive)) {
        setMatrixRevealed(!matrixIsOpen);
      }
    });
  });

  matrixTriggers.forEach((button) => {
    button.addEventListener("click", () => {
      if (!document.body.classList.contains("soft-mode") && document.body.classList.contains("matrix-revealed")) {
        document.body.classList.add("matrix-message-revealed");
      }
    });
  });

  matrixMessages.forEach((button) => {
    button.addEventListener("click", () => {
      if (!document.body.classList.contains("soft-mode") && document.body.classList.contains("matrix-message-revealed")) {
        document.body.classList.add("matrix-final-revealed");
      }
    });
  });

  matrixFinals.forEach((button) => {
    button.addEventListener("click", () => setMatrixRevealed(false));
  });

  sidebarToggles.forEach((button) => {
    button.addEventListener("click", () => {
      const sidebarIsOpen = document.body.classList.contains("sidebar-flipped");
      const bunnyIsActive = document.body.classList.contains("bunny-revealed") || document.body.classList.contains("bunny-returning");
      const matrixIsActive = document.body.classList.contains("matrix-revealed") || document.body.classList.contains("matrix-returning");
      if (!document.body.classList.contains("soft-mode") && (sidebarIsOpen || (!bunnyIsActive && !matrixIsActive))) {
        setSidebarFlipped(!sidebarIsOpen);
      }
    });
  });

  trinityTriggers.forEach((button) => {
    button.addEventListener("click", () => {
      if (!document.body.classList.contains("soft-mode") && document.body.classList.contains("sidebar-flipped")) {
        document.body.classList.add("trinity-message-revealed");
      }
    });
  });

  trinityMessages.forEach((button) => {
    button.addEventListener("click", () => setSidebarFlipped(false));
  });
})();

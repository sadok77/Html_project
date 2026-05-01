(() => {
  const STORAGE_THEME_KEY = "theme";
  const STORAGE_USERS_KEY = "luxecars_users_v1";
  const STORAGE_SESSION_KEY = "luxecars_session_v1";

  const getEl = (id) => document.getElementById(id);

  const themeToggle = getEl("theme-toggle");
  const authButton = getEl("authButton");
  const accountMenu = getEl("accountMenu");
  const accountEmail = getEl("accountEmail");
  const logoutButton = getEl("logoutButton");

  const authModalEl = getEl("authModal");
  const authAlert = getEl("authAlert");
  const loginForm = getEl("loginForm");
  const signupForm = getEl("signupForm");
  const showSignup = getEl("showSignup");
  const showLogin = getEl("showLogin");
  const authModalLabel = getEl("authModalLabel");

  const readJson = (key, fallback) => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  };

  const writeJson = (key, value) => {
    localStorage.setItem(key, JSON.stringify(value));
  };

  const toHex = (buffer) =>
    Array.from(new Uint8Array(buffer))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

  const hashPassword = async (password) => {
    const normalized = String(password);
    if (!globalThis.crypto?.subtle?.digest) {
      return `plain:${normalized}`;
    }
    const bytes = new TextEncoder().encode(normalized);
    const digest = await crypto.subtle.digest("SHA-256", bytes);
    return toHex(digest);
  };

  const setAlert = (message) => {
    if (!authAlert) return;
    if (!message) {
      authAlert.classList.add("d-none");
      authAlert.textContent = "";
      return;
    }
    authAlert.textContent = message;
    authAlert.classList.remove("d-none");
  };

  const setAuthMode = (mode) => {
    setAlert("");
    if (mode === "signup") {
      authModalLabel.textContent = "Créer un compte";
      loginForm.classList.add("d-none");
      signupForm.classList.remove("d-none");
      return;
    }
    authModalLabel.textContent = "Connexion";
    signupForm.classList.add("d-none");
    loginForm.classList.remove("d-none");
  };

  const getSession = () => readJson(STORAGE_SESSION_KEY, null);

  const setSession = (email) => writeJson(STORAGE_SESSION_KEY, { email });

  const clearSession = () => localStorage.removeItem(STORAGE_SESSION_KEY);

  const showToast = (message) => {
    const toast = getEl("toast");
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add("show");
    window.clearTimeout(showToast.timer);
    showToast.timer = window.setTimeout(() => {
      toast.classList.remove("show");
    }, 3200);
  };

  const updateAuthUi = () => {
    const session = getSession();
    const isLoggedIn = Boolean(session && session.email);

    if (authButton) authButton.classList.toggle("d-none", isLoggedIn);
    if (accountMenu) accountMenu.classList.toggle("d-none", !isLoggedIn);

    if (isLoggedIn && accountEmail) {
      accountEmail.textContent = session.email;
    }
  };

  const initTheme = () => {
    if (!themeToggle) return;
    const current = localStorage.getItem(STORAGE_THEME_KEY);
    if (current === "dark") {
      document.body.classList.add("dark");
      themeToggle.checked = true;
    }
    themeToggle.addEventListener("change", () => {
      document.body.classList.toggle("dark", themeToggle.checked);
      localStorage.setItem(
        STORAGE_THEME_KEY,
        themeToggle.checked ? "dark" : "light"
      );
    });
  };

  const initAuth = () => {
    if (!authModalEl) return;

    const bootstrapModal = globalThis.bootstrap?.Modal?.getOrCreateInstance(authModalEl);
    const resetAuthForms = () => {
      setAuthMode("login");
      loginForm?.reset();
      signupForm?.reset();
    };
    const showFallbackModal = () => {
      resetAuthForms();
      authModalEl.classList.add("show");
      authModalEl.style.display = "block";
      authModalEl.removeAttribute("aria-hidden");
      authModalEl.setAttribute("aria-modal", "true");
      document.body.classList.add("modal-open");
    };
    const hideFallbackModal = () => {
      authModalEl.classList.remove("show");
      authModalEl.style.display = "";
      authModalEl.setAttribute("aria-hidden", "true");
      authModalEl.removeAttribute("aria-modal");
      document.body.classList.remove("modal-open");
    };
    const closeAuthModal = () => {
      if (bootstrapModal) {
        bootstrapModal.hide();
        return;
      }
      hideFallbackModal();
    };

    showSignup?.addEventListener("click", () => setAuthMode("signup"));
    showLogin?.addEventListener("click", () => setAuthMode("login"));

    if (bootstrapModal) {
      authModalEl.addEventListener("show.bs.modal", resetAuthForms);
    } else {
      authButton?.addEventListener("click", showFallbackModal);
      authModalEl
        .querySelectorAll('[data-bs-dismiss="modal"], .btn-close')
        .forEach((button) => button.addEventListener("click", hideFallbackModal));
      authModalEl.addEventListener("click", (e) => {
        if (e.target === authModalEl) hideFallbackModal();
      });
    }

    logoutButton?.addEventListener("click", () => {
      clearSession();
      updateAuthUi();
    });

    loginForm?.addEventListener("submit", async (e) => {
      e.preventDefault();
      setAlert("");

      const email = getEl("loginEmail")?.value?.trim().toLowerCase();
      const password = getEl("loginPassword")?.value ?? "";

      if (!email || !password) return setAlert("Veuillez remplir tous les champs.");

      const users = readJson(STORAGE_USERS_KEY, {});
      const record = users[email];
      if (!record) return setAlert("Compte introuvable. Créez un compte.");

      const passwordHash = await hashPassword(password);
      if (record.passwordHash !== passwordHash) return setAlert("Mot de passe incorrect.");

      setSession(email);
      updateAuthUi();
      closeAuthModal();
    });

    signupForm?.addEventListener("submit", async (e) => {
      e.preventDefault();
      setAlert("");

      const email = getEl("signupEmail")?.value?.trim().toLowerCase();
      const password = getEl("signupPassword")?.value ?? "";

      if (!email || !password) return setAlert("Veuillez remplir tous les champs.");
      if (password.length < 6) return setAlert("Le mot de passe doit faire au moins 6 caractères.");

      const users = readJson(STORAGE_USERS_KEY, {});
      if (users[email]) return setAlert("Ce compte existe déjà. Connectez-vous.");

      const passwordHash = await hashPassword(password);
      users[email] = { passwordHash, createdAt: new Date().toISOString() };
      writeJson(STORAGE_USERS_KEY, users);

      setSession(email);
      updateAuthUi();
      closeAuthModal();
    });
  };

  const initInventory = () => {
    const cards = Array.from(document.querySelectorAll(".car[data-id]"));
    if (!cards.length) return;

    const STORAGE_FAVORITES_KEY = "luxecars_favorites_v1";
    const STORAGE_COMPARE_KEY = "luxecars_compare_v1";
    const searchInput = getEl("carSearch");
    const brandFilter = getEl("brandFilter");
    const budgetFilter = getEl("budgetFilter");
    const resetFilters = getEl("resetFilters");
    const resultCount = getEl("resultCount");
    const favoriteCount = getEl("favoriteCount");
    const compareCount = getEl("compareCount");
    const emptyCars = getEl("emptyCars");
    const modal = getEl("vehicleModal");
    const modalImage = getEl("vehicleModalImage");
    const modalBrand = getEl("vehicleModalBrand");
    const modalTitle = getEl("vehicleModalTitle");
    const modalText = getEl("vehicleModalText");
    const modalSpecs = getEl("vehicleModalSpecs");
    const vehicleQuoteBtn = getEl("vehicleQuoteBtn");
    const subjectInput = getEl("subject");
    const messageInput = getEl("message");

    let favorites = new Set(readJson(STORAGE_FAVORITES_KEY, []));
    let compare = new Set(readJson(STORAGE_COMPARE_KEY, []));
    let activeVehicleId = "";

    const formatPrice = (value) =>
      new Intl.NumberFormat("fr-FR", {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 0,
      }).format(Number(value));

    const getCardData = (card) => ({
      id: card.dataset.id,
      brand: card.dataset.brand,
      name: card.dataset.name,
      price: Number(card.dataset.price),
      type: card.dataset.type,
      energy: card.dataset.energy,
      power: card.dataset.power,
      mileage: card.dataset.mileage,
      image: card.querySelector("img")?.getAttribute("src") ?? "",
      alt: card.querySelector("img")?.getAttribute("alt") ?? card.dataset.name,
    });

    const persist = () => {
      writeJson(STORAGE_FAVORITES_KEY, Array.from(favorites));
      writeJson(STORAGE_COMPARE_KEY, Array.from(compare));
    };

    const updateCounters = () => {
      if (favoriteCount) favoriteCount.textContent = String(favorites.size);
      if (compareCount) compareCount.textContent = String(compare.size);
    };

    const updateCardState = () => {
      for (const card of cards) {
        const id = card.dataset.id;
        const favoriteBtn = card.querySelector(".favorite-btn");
        const compareBtn = card.querySelector(".compare-btn");
        favoriteBtn?.classList.toggle("active", favorites.has(id));
        compareBtn?.classList.toggle("active", compare.has(id));
        const favoriteIcon = favoriteBtn?.querySelector("i");
        if (favoriteIcon) {
          favoriteIcon.className = favorites.has(id)
            ? "fa-solid fa-heart"
            : "fa-regular fa-heart";
        }
        if (compareBtn) {
          compareBtn.textContent = compare.has(id) ? "Comparé" : "Comparer";
        }
      }
      updateCounters();
    };

    const applyFilters = () => {
      const query = (searchInput?.value ?? "").trim().toLowerCase();
      const brand = brandFilter?.value ?? "all";
      const budget = budgetFilter?.value ?? "all";
      let visible = 0;

      for (const card of cards) {
        const data = getCardData(card);
        const searchable = `${data.brand} ${data.name} ${data.type} ${data.energy}`.toLowerCase();
        const [min, max] = budget === "all" ? [0, Infinity] : budget.split("-").map(Number);
        const matchesQuery = !query || searchable.includes(query);
        const matchesBrand = brand === "all" || data.brand === brand;
        const matchesBudget = data.price >= min && data.price <= max;
        const isVisible = matchesQuery && matchesBrand && matchesBudget;
        card.classList.toggle("d-none", !isVisible);
        if (isVisible) visible += 1;
      }

      if (resultCount) {
        resultCount.textContent = `${visible} véhicule${visible > 1 ? "s" : ""} disponible${visible > 1 ? "s" : ""}`;
      }
      emptyCars?.classList.toggle("d-none", visible !== 0);
    };

    const openVehicleModal = (card) => {
      if (!modal) return;
      const data = getCardData(card);
      activeVehicleId = data.id;
      if (modalImage) {
        modalImage.src = data.image;
        modalImage.alt = data.alt;
      }
      if (modalBrand) modalBrand.textContent = data.brand.toUpperCase();
      if (modalTitle) modalTitle.textContent = data.name;
      if (modalText) {
        modalText.textContent =
          `${data.name} est sélectionné pour son état, ses performances et son historique vérifié. Un conseiller peut préparer un devis, une reprise ou une livraison personnalisée.`;
      }
      if (modalSpecs) {
        modalSpecs.innerHTML = `
          <span>${formatPrice(data.price)}</span>
          <span>${data.type}</span>
          <span>${data.power}</span>
          <span>${data.mileage}</span>
          <span>${data.energy}</span>
        `;
      }
      modal.classList.remove("d-none");
      document.body.classList.add("modal-open");
    };

    const closeVehicleModal = () => {
      modal?.classList.add("d-none");
      document.body.classList.remove("modal-open");
    };

    const requestQuote = (card) => {
      const data = getCardData(card);
      if (subjectInput) subjectInput.value = `Demande de devis - ${data.name}`;
      if (messageInput && !messageInput.value.trim()) {
        messageInput.value = `Bonjour, je souhaite recevoir un devis et les disponibilités pour ${data.name} (${formatPrice(data.price)}).`;
      }
      closeVehicleModal();
      document.querySelector("#contact")?.scrollIntoView({ behavior: "smooth", block: "start" });
      showToast("Demande préparée dans le formulaire de contact.");
    };

    for (const card of cards) {
      card.querySelector(".favorite-btn")?.addEventListener("click", () => {
        const id = card.dataset.id;
        if (favorites.has(id)) {
          favorites.delete(id);
          showToast("Véhicule retiré des favoris.");
        } else {
          favorites.add(id);
          showToast("Véhicule ajouté aux favoris.");
        }
        persist();
        updateCardState();
      });

      card.querySelector(".compare-btn")?.addEventListener("click", () => {
        const id = card.dataset.id;
        if (compare.has(id)) {
          compare.delete(id);
        } else if (compare.size >= 3) {
          showToast("Comparaison limitée à 3 véhicules.");
          return;
        } else {
          compare.add(id);
        }
        persist();
        updateCardState();
      });

      card.querySelector(".detail-btn")?.addEventListener("click", () => openVehicleModal(card));
      card.querySelector(".quote-btn")?.addEventListener("click", () => requestQuote(card));
    }

    vehicleQuoteBtn?.addEventListener("click", () => {
      const card = cards.find((item) => item.dataset.id === activeVehicleId);
      if (card) requestQuote(card);
    });

    modal?.querySelectorAll("[data-close-modal]").forEach((button) => {
      button.addEventListener("click", closeVehicleModal);
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeVehicleModal();
    });

    searchInput?.addEventListener("input", applyFilters);
    brandFilter?.addEventListener("change", applyFilters);
    budgetFilter?.addEventListener("change", applyFilters);
    resetFilters?.addEventListener("click", () => {
      if (searchInput) searchInput.value = "";
      if (brandFilter) brandFilter.value = "all";
      if (budgetFilter) budgetFilter.value = "all";
      applyFilters();
    });

    updateCardState();
    applyFilters();
  };

  const initContactForm = () => {
    const form = getEl("contactForm");
    const feedback = getEl("contactFeedback");
    if (!form) return;

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      if (!form.checkValidity()) {
        form.reportValidity();
        return;
      }
      if (feedback) {
        feedback.textContent = "Message prêt. Un conseiller LuxeCars vous répondra rapidement.";
        feedback.classList.add("show");
      }
      showToast("Message enregistré localement pour démonstration.");
      form.reset();
    });
  };

  initTheme();
  initAuth();
  initInventory();
  initContactForm();
  updateAuthUi();

  // Active nav link on scroll
  try {
    const sections = Array.from(document.querySelectorAll("main section[id]"));
    const navLinks = Array.from(document.querySelectorAll(".navbar-nav .nav-link"))
      .filter((a) => a.getAttribute("href")?.startsWith("#"));

    const byId = new Map(
      navLinks.map((a) => [a.getAttribute("href").slice(1), a])
    );

    const setActive = (id) => {
      for (const link of navLinks) {
        link.classList.remove("active");
        link.removeAttribute("aria-current");
      }
      const link = byId.get(id);
      if (link) {
        link.classList.add("active");
        link.setAttribute("aria-current", "page");
      }
    };

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible?.target?.id) setActive(visible.target.id);
      },
      { rootMargin: "-35% 0px -55% 0px", threshold: [0.05, 0.15, 0.3] }
    );

    for (const section of sections) observer.observe(section);

    const navMenu = document.getElementById("mainNavbar");
    const navToggler = document.querySelector('[data-bs-target="#mainNavbar"]');
    const collapse = navMenu && globalThis.bootstrap?.Collapse
      ? globalThis.bootstrap.Collapse.getOrCreateInstance(navMenu, { toggle: false })
      : null;

    navToggler?.addEventListener("click", () => {
      if (!navMenu || collapse) return;
      const isOpen = navMenu.classList.toggle("show");
      navToggler.setAttribute("aria-expanded", String(isOpen));
    });

    for (const link of navLinks) {
      link.addEventListener("click", () => {
        if (!navMenu?.classList.contains("show")) return;
        if (collapse) {
          collapse.hide();
          return;
        }
        navMenu.classList.remove("show");
        navToggler?.setAttribute("aria-expanded", "false");
      });
    }
  } catch {
    // no-op
  }
})();

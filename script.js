/**
 * NIK MODS — Modern Glassmorphism Experience
 * Seamlessly integrating dynamic Google Sheet catalog with Cloudflare Worker feedback
 */

(() => {
  // -------------------------------------------------------------------------
  // BUTTER-SMOOTH MAIN PAGE SCROLL
  // Lenis only owns the document scroll; horizontal filter/carousel gestures
  // and payment/modal scrolling remain native and are not intercepted.
  // -------------------------------------------------------------------------
  let smoothScroller = null;

  if (window.Lenis) {
    smoothScroller = new Lenis({
      autoRaf: true,
      smoothWheel: true,
      syncTouch: true,
      duration: 0.72,
      wheelMultiplier: 0.92,
      touchMultiplier: 1,
      anchors: true,
      infinite: false
    });

    window.NIKSmoothScroll = smoothScroller;
  }

  const CONFIG = {
    CATALOG_URL: "catalog.json",
    DEFAULT_ICON: "assets/nik-logo.svg",
    FEEDBACK_ENDPOINT: "https://nik-mods-feedback.godrp3236.workers.dev",
    
    // Single Source of Truth for UPI ID
    UPI_ID: "nikmods@upi",

    // FamGateway Verified Payment Endpoints (Active Cloudflare Worker Backend)
    PAYMENT_GATEWAY_ENABLED: true,
    PAYMENT_ORDER_ENDPOINT: "https://nik-mods-payments.godrp3236.workers.dev/create-order",
    PAYMENT_STATUS_ENDPOINT: "https://nik-mods-payments.godrp3236.workers.dev/status"
  };

  const $ = s => document.querySelector(s);
  const $$ = s => document.querySelectorAll(s);

  // DOM Elements
  const catalogList = $("#catalogList");
  const itemCount = $("#itemCount");
  const searchInput = $("#searchInput");
  const sourceNote = $("#sourceNote");
  const yearEl = $("#year");
  const particlesContainer = $("#particles");
  const filterContainer = $("#filterContainer");
  const filterBtns = $$(".filter-btn");

  // Navigation Overlay Elements
  const navToggleBtn = $("#navToggleBtn");
  const navIcon = $("#navIcon");
  const navOverlay = $("#navOverlay");
  const navItems = $$(".nav-item");

  // Feedback Elements
  const feedbackModal = $("#feedbackModal");
  const modalContent = $("#modalContent");
  const feedbackForm = $("#feedbackForm");
  const feedbackText = $("#feedbackText");
  const charCount = $("#charCount");
  const feedbackAlert = $("#feedbackAlert");
  const submitFeedbackBtn = $("#submitFeedbackBtn");
  const btnText = $("#btnText");

  // Carousel Elements
  const track = $("#carouselTrack");
  const pBar0 = $("#progress0");
  const pBar1 = $("#progress1");

  // State
  let items = [];
  let currentFilter = "all";
  let isNavOpen = false;
  let currentSlide = 0;
  let slideTimer = null;
  let isAutoScrolling = true;
  let scrollSpeed = 0.4;
  let scrollTimeout = null;


  // Utilities
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;"
  }[c]));

  const clean = s => String(s ?? "").trim();
  const norm = s => clean(s).toLowerCase();
  const size = s => clean(s) || "—";

  const date = s => {
    if (!s) return "—";
    const d = new Date(s);
    return Number.isNaN(d.getTime())
      ? s
      : new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" }).format(d);
  };

  const detectCategory = s => {
    const n = norm(s);
    return /game|pubg|bgmi|minecraft|roblox|gta|freefire|brawl|gameplay/.test(n)
      ? "games"
      : /tool|manager|zarchiver|termux|vpn|root|utility|editor/.test(n)
        ? "tools"
        : "apps";
  };

  function sanitizeLink(link) {
    const l = clean(link);
    if (!l || ["#", "none", "n/a", "-", "nil", "null"].includes(l.toLowerCase()) || l.toLowerCase().startsWith("javascript:")) {
      return "#";
    }
    return l;
  }

  function normalize(r) {
    const c = norm(r.category) || detectCategory(r.name);
    const cat = c === "game" || c === "games"
      ? "games"
      : c === "tool" || c === "tools"
        ? "tools"
        : "apps";

    return {
      name: clean(r.name),
      category: cat,
      version: clean(r.version) || "Latest",
      size: clean(r.size) || "—",
      description: clean(r.description) || "Available release",
      icon: clean(r.icon) || CONFIG.DEFAULT_ICON,
      link: sanitizeLink(r.link),
      date: clean(r.date) || clean(r.updated) || ""
    };
  }

  // --- Dynamic Catalog Rendering ---
  function render() {
    if (!catalogList || !itemCount) return;
    const q = norm(searchInput ? searchInput.value : "");

    const visible = items.filter(x => {
      let matchesCat = false;
      if (currentFilter === "all") {
        matchesCat = true;
      } else if (currentFilter === "apps") {
        matchesCat = x.category === "apps";
      } else if (currentFilter === "games") {
        matchesCat = x.category === "games";
      } else if (currentFilter === "tools") {
        matchesCat = x.category === "tools";
      } else {
        // Support extended category buttons from reference
        matchesCat = norm(x.category) === currentFilter ||
                     norm(x.description).includes(currentFilter) ||
                     norm(x.name).includes(currentFilter);
      }

      const matchesSearch = !q || norm(x.name + " " + x.description + " " + x.category).includes(q);
      return matchesCat && matchesSearch;
    });

    itemCount.textContent = visible.length + " " + (visible.length === 1 ? "item" : "items");

    if (visible.length === 0) {
      catalogList.innerHTML = `
        <div class="glass-card rounded-3xl p-8 text-center relative overflow-hidden">
          <div class="w-12 h-12 mx-auto mb-4 rounded-2xl glass-ultra flex items-center justify-center text-white/40 border border-white/10">
            <i class="fa-solid fa-magnifying-glass text-xl"></i>
          </div>
          <div class="text-sm font-bold text-white tracking-wide">Nothing found</div>
          <div class="text-xs text-white/40 mt-1 font-mono">Try another search keyword or category filter.</div>
        </div>
      `;
      return;
    }

    catalogList.innerHTML = visible.map((a) => {
      const isAvailable = a.link && a.link !== "#";
      const iconUrl = a.icon || CONFIG.DEFAULT_ICON;
      const formattedDate = date(a.date);

      return `
        <div class="glass-card rounded-3xl p-6 relative overflow-hidden group" data-category="${esc(a.category)}">
          <!-- Aesthetic grid overlay inside card -->
          <div class="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMSIgY3k9IjEiIHI9IjEiIGZpbGw9InJnYmEoMjU1LDI1NSwyNTUsMC4wNSkiLz48L3N2Zz4=')] opacity-50 z-0 pointer-events-none"></div>

          <div class="flex items-start gap-5 relative z-10">
            <!-- Icon Box -->
            <div class="w-14 h-14 rounded-2xl glass-ultra flex items-center justify-center shrink-0 border border-white/20 group-hover:border-white/40 transition-colors overflow-hidden p-2">
              <img src="${esc(iconUrl)}" alt="${esc(a.name)}" class="w-full h-full object-contain drop-shadow-[0_0_10px_rgba(255,255,255,0.2)]" loading="lazy" onerror="this.onerror=null;this.src='${CONFIG.DEFAULT_ICON}'">
            </div>

            <!-- Info -->
            <div class="flex-1 pt-1 min-w-0">
              <div class="flex items-center justify-between gap-2">
                <h3 class="text-white font-medium text-lg tracking-wide mb-1 truncate">${esc(a.name)}</h3>
                <span class="text-[9px] font-mono uppercase tracking-wider text-brand-accent/90 border border-brand-accent/30 px-2 py-0.5 rounded-full shrink-0">${esc(a.category)}</span>
              </div>
              <div class="flex items-center gap-3">
                <span class="text-white/40 text-[10px] font-mono">${esc(a.version)}</span>
                <span class="w-1 h-1 rounded-full bg-white/20"></span>
                <span class="text-white/40 text-[10px] font-mono">${esc(size(a.size))}</span>
              </div>
            </div>
          </div>

          <!-- Description / Tags -->
          <div class="flex flex-wrap gap-2 mt-5 relative z-10">
            <span class="text-xs text-white/60 leading-relaxed">${esc(a.description)}</span>
          </div>

          <!-- NIK MODS GET IT toggle -->
          ${isAvailable ? `
          <div class="mt-5 relative z-10">
            <button
              type="button"
              class="get-it-toggle"
              data-download-url="${esc(a.link)}"
              aria-label="Get ${esc(a.name)}"
            >
              <span class="get-it-label">GET IT</span>
              <span class="get-it-orb"><i class="fa-solid fa-arrow-right"></i></span>
            </button>
          </div>` : ""}

          <!-- Footer Action & Meta -->
          <div class="mt-4 pt-4 border-t border-white/5 flex justify-between items-center relative z-10">
            <div class="text-[10px] text-white/30 font-mono flex items-center gap-1.5">
              <i class="fa-regular fa-clock"></i> ${esc(formattedDate)}
            </div>
            ${isAvailable ? `
            <div class="flex items-center gap-2 text-[10px] font-mono tracking-widest text-emerald-400">
              <span class="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399]"></span> READY
            </div>` : ""}
          </div>
        </div>
      `;
    }).join("");

    if (window.gsap) {
      gsap.fromTo("#catalogList .glass-card",
        { opacity: 0, y: 15 },
        { opacity: 1, y: 0, duration: 0.35, stagger: 0.04, ease: "power2.out", clearProps: "transform" }
      );
    }
  }

  // --- Signature GET IT toggle ------------------------------------------------
  // Click -> locks into a loading state for 3s -> redirects to the ShrinkMe URL.
  document.addEventListener("click", (e) => {
    const btn = e.target.closest(".get-it-toggle");
    if (!btn || btn.dataset.busy === "1") return;

    const url = btn.dataset.downloadUrl;
    if (!url || url === "#") return;

    btn.dataset.busy = "1";
    btn.classList.add("is-loading");

    const label = btn.querySelector(".get-it-label");
    const orb = btn.querySelector(".get-it-orb");
    if (label) label.textContent = "PREPARING";
    if (orb) orb.innerHTML = '<i class="fa-solid fa-circle-notch"></i>';

    setTimeout(() => {
      window.location.href = url;
    }, 3000);
  });

  function setFilter(newFilter) {
    currentFilter = (newFilter || "all").toLowerCase();
    filterBtns.forEach(btn => {
      const match = (btn.dataset.filter || "").toLowerCase() === currentFilter;
      btn.classList.toggle("active", match);
      btn.classList.toggle("bg-white/10", match);
      btn.classList.toggle("text-white", match);
      btn.classList.toggle("border-white/30", match);
      btn.classList.toggle("font-bold", match);
      btn.classList.toggle("shadow-[0_0_15px_rgba(255,255,255,0.1)]", match);

      btn.classList.toggle("bg-transparent", !match);
      btn.classList.toggle("text-white/50", !match);
      btn.classList.toggle("border-white/5", !match);
      btn.classList.toggle("font-medium", !match);
    });
    render();
  }

  function navFilter(filterVal) {
    if (isNavOpen) toggleNav();
    setFilter(filterVal);
    const catalogEl = $("#catalog");
    if (catalogEl && typeof catalogEl.scrollIntoView === "function") {
      catalogEl.scrollIntoView({ behavior: "smooth" });
    }
  }
  window.navFilter = navFilter;

  async function load() {
    try {
      if (itemCount) itemCount.textContent = "Loading...";
      const res = await fetch(CONFIG.CATALOG_URL + "?v=" + Date.now(), { cache: "no-store" });
      if (!res.ok) throw new Error("Catalog HTTP " + res.status);
      const data = await res.json();
      if (!Array.isArray(data)) throw new Error("Catalog format invalid");
      items = data.map(normalize).filter(x => x.name);
      if (sourceNote) {
        sourceNote.textContent = "Latest releases, curated for NIK MODS.";
      }
      render();
    } catch (e) {
      console.error("NIK MODS catalog error:", e);
      items = [];
      if (itemCount) itemCount.textContent = "0 items";
      if (catalogList) {
        catalogList.innerHTML = `
          <div class="glass-card rounded-3xl p-8 text-center relative overflow-hidden border border-brand-accent/30">
            <div class="w-12 h-12 mx-auto mb-4 rounded-2xl glass-ultra flex items-center justify-center text-brand-accent border border-brand-accent/30">
              <i class="fa-solid fa-triangle-exclamation text-xl"></i>
            </div>
            <div class="text-sm font-bold text-white tracking-wide">Catalog temporarily unavailable</div>
            <div class="text-xs text-white/40 mt-1 font-mono">Please refresh or try again in a moment.</div>
          </div>
        `;
      }
    }
  }

  // --- Dynamic Search ---
  if (searchInput) {
    searchInput.addEventListener("input", () => {
      render();
    });
  }

  // CMD+K shortcut
  window.addEventListener("keydown", (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
      e.preventDefault();
      if (searchInput) {
        searchInput.focus();
        if (typeof searchInput.scrollIntoView === "function") {
          searchInput.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      }
    }
  });

  // --- Typewriter Effect ---
  const searchPlaceholders = [
    "Search 'Spotify'...",
    "Find 'PUBG Mod'...",
    "Search 'Lightroom'...",
    "Looking for 'Tools'?",
    "Search apps, games, tools..."
  ];
  let placeholderIndex = 0;
  let charIndex = 0;
  let isDeleting = false;
  let typeSpeed = 100;
  let searchFocused = false;

  if (searchInput) {
    searchInput.addEventListener("focus", () => {
      searchFocused = true;
      searchInput.placeholder = "Type to search...";
    });

    searchInput.addEventListener("blur", () => {
      searchFocused = false;
      if (!((searchInput.value || "").trim())) {
        charIndex = 0;
        isDeleting = false;
      }
    });

    function typeWriter() {
      if (searchFocused || (searchInput && (searchInput.value || "").trim() !== "")) {
        setTimeout(typeWriter, 1000);
        return;
      }

      const currentText = searchPlaceholders[placeholderIndex];
      if (isDeleting) {
        searchInput.placeholder = currentText.substring(0, charIndex - 1);
        charIndex--;
        typeSpeed = 40;
      } else {
        searchInput.placeholder = currentText.substring(0, charIndex + 1);
        charIndex++;
        typeSpeed = 80;
      }

      if (!isDeleting && charIndex === currentText.length) {
        isDeleting = true;
        typeSpeed = 2000;
      } else if (isDeleting && charIndex === 0) {
        isDeleting = false;
        placeholderIndex = (placeholderIndex + 1) % searchPlaceholders.length;
        typeSpeed = 500;
      }

      setTimeout(typeWriter, typeSpeed);
    }

    typeWriter();
  }

  // --- Filter Pills Auto-Scroll & Click ---
  function autoScrollFilters() {
    if (isAutoScrolling && filterContainer) {
      filterContainer.scrollLeft += scrollSpeed;
      if (filterContainer.scrollLeft >= (filterContainer.scrollWidth - filterContainer.clientWidth - 1)) {
        scrollSpeed = -0.4;
      } else if (filterContainer.scrollLeft <= 0) {
        scrollSpeed = 0.4;
      }
    }
    requestAnimationFrame(autoScrollFilters);
  }

  if (filterContainer) {
    autoScrollFilters();

    const pauseScroll = () => { isAutoScrolling = false; clearTimeout(scrollTimeout); };
    const resumeScroll = () => {
      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(() => { isAutoScrolling = true; }, 1500);
    };

    filterContainer.addEventListener("touchstart", pauseScroll, { passive: true });
    filterContainer.addEventListener("touchend", resumeScroll);
    filterContainer.addEventListener("mouseenter", pauseScroll);
    filterContainer.addEventListener("mouseleave", resumeScroll);
    filterContainer.addEventListener("wheel", pauseScroll, { passive: true });
  }

  filterBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      isAutoScrolling = false;
      const targetFilter = btn.dataset.filter || "all";
      setFilter(targetFilter);
    });
  });

  // --- Community Carousel ---
  function goToSlide(index) {
    currentSlide = index;
    if (track) track.style.transform = `translateX(-${index * 100}%)`;

    if (pBar0 && pBar1) {
      pBar0.style.transition = "none";
      pBar0.style.width = "0%";
      pBar1.style.transition = "none";
      pBar1.style.width = "0%";

      void pBar0.offsetWidth;

      const activeBar = index === 0 ? pBar0 : pBar1;
      activeBar.style.transition = "width 3s linear";
      activeBar.style.width = "100%";
    }

    clearTimeout(slideTimer);
    slideTimer = setTimeout(() => {
      goToSlide((currentSlide + 1) % 2);
    }, 3000);
  }
  window.goToSlide = goToSlide;

  if (track) {
    let touchStartX = 0;
    let touchEndX = 0;

    track.addEventListener("touchstart", e => {
      touchStartX = e.changedTouches[0].screenX;
      clearTimeout(slideTimer);
    }, { passive: true });

    track.addEventListener("touchend", e => {
      touchEndX = e.changedTouches[0].screenX;
      const threshold = 50;
      if (touchStartX - touchEndX > threshold) {
        goToSlide((currentSlide + 1) % 2);
      } else if (touchEndX - touchStartX > threshold) {
        goToSlide((currentSlide - 1 + 2) % 2);
      } else {
        goToSlide(currentSlide);
      }
    });
  }

  // --- Navigation Overlay ---
  function toggleNav() {
    isNavOpen = !isNavOpen;

    if (isNavOpen) {
      if (navOverlay) navOverlay.classList.remove("opacity-0", "pointer-events-none");

      if (navIcon) {
        navIcon.style.transform = "rotate(90deg) scale(0)";
        setTimeout(() => {
          navIcon.classList.remove("fa-bars");
          navIcon.classList.add("fa-xmark");
          navIcon.style.transform = "rotate(0deg) scale(1)";
        }, 150);
      }

      if (window.gsap && navItems.length) {
        gsap.to(navItems, {
          y: 0,
          opacity: 1,
          duration: 0.45,
          stagger: 0.08,
          ease: "power3.out",
          delay: 0.1
        });
      }

      document.body.style.overflow = "hidden";
    } else {
      if (navOverlay) navOverlay.classList.add("opacity-0", "pointer-events-none");

      if (navIcon) {
        navIcon.style.transform = "rotate(-90deg) scale(0)";
        setTimeout(() => {
          navIcon.classList.remove("fa-xmark");
          navIcon.classList.add("fa-bars");
          navIcon.style.transform = "rotate(0deg) scale(1)";
        }, 150);
      }

      if (window.gsap && navItems.length) {
        gsap.to(navItems, {
          y: 30,
          opacity: 0,
          duration: 0.25
        });
      }

      document.body.style.overflow = "";
    }
  }

  if (navToggleBtn) {
    navToggleBtn.addEventListener("click", toggleNav);
  }
  window.toggleNav = toggleNav;

  function openFeedbackFromNav() {
    if (isNavOpen) toggleNav();
    setTimeout(toggleFeedback, 350);
  }
  window.openFeedbackFromNav = openFeedbackFromNav;

  // --- Real Anonymous Feedback Modal ---
  function showFeedbackAlert(msg, type = "error") {
    if (!feedbackAlert) return;
    feedbackAlert.className = type === "error"
      ? "mb-4 p-3 rounded-xl text-xs font-mono bg-red-500/10 border border-brand-accent/40 text-brand-accent"
      : "mb-4 p-3 rounded-xl text-xs font-mono bg-emerald-500/10 border border-emerald-500/40 text-emerald-400";
    feedbackAlert.textContent = msg;
    feedbackAlert.classList.remove("hidden");
  }

  function clearFeedbackAlert() {
    if (!feedbackAlert) return;
    feedbackAlert.textContent = "";
    feedbackAlert.classList.add("hidden");
  }

  function updateCharCount() {
    if (!feedbackText || !charCount) return;
    const len = (feedbackText.value || "").length;
    charCount.textContent = `${len} / 1000`;
    charCount.classList.toggle("text-brand-accent", len >= 950);
  }

  if (feedbackText) {
    feedbackText.addEventListener("input", updateCharCount);
  }

  function toggleFeedback() {
    if (!feedbackModal || !modalContent) return;

    if (feedbackModal.classList.contains("hidden")) {
      clearFeedbackAlert();
      feedbackModal.classList.remove("hidden");
      feedbackModal.setAttribute("aria-hidden", "false");
      requestAnimationFrame(() => {
        feedbackModal.classList.remove("opacity-0");
        modalContent.classList.remove("scale-95");
      });
      setTimeout(() => {
        if (feedbackText) feedbackText.focus();
      }, 100);
    } else {
      feedbackModal.classList.add("opacity-0");
      modalContent.classList.add("scale-95");
      feedbackModal.setAttribute("aria-hidden", "true");
      setTimeout(() => {
        feedbackModal.classList.add("hidden");
      }, 500);
    }
  }
  window.toggleFeedback = toggleFeedback;

  if (feedbackModal) {
    feedbackModal.addEventListener("click", (e) => {
      if (e.target === feedbackModal) toggleFeedback();
    });
  }

  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      if (paymentModal && !paymentModal.classList.contains("hidden")) {
        closePaymentModal();
      } else if (isTipPageOpen) {
        closeTipPage();
      } else if (feedbackModal && !feedbackModal.classList.contains("hidden")) {
        toggleFeedback();
      } else if (isNavOpen) {
        toggleNav();
      }
    }
  });

  async function handleFeedbackSubmit(e) {
    e.preventDefault();
    clearFeedbackAlert();

    const hp = feedbackForm.querySelector('input[name="_hp_site"]');
    if (hp && (hp.value || "").trim() !== "") {
      // Honeypot tripped silently
      handleFeedbackSuccessVisual();
      return;
    }

    const message = feedbackText ? (feedbackText.value || "").trim() : "";
    if (!message) {
      showFeedbackAlert("Transmission details cannot be empty.", "error");
      if (feedbackText) feedbackText.focus();
      return;
    }

    if (message.length > 1000) {
      showFeedbackAlert("Transmission exceeded maximum length (1000 chars).", "error");
      return;
    }

    if (submitFeedbackBtn) submitFeedbackBtn.disabled = true;
    if (feedbackText) feedbackText.disabled = true;
    if (btnText) btnText.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin mr-1"></i> UPLOADING...';

    try {
      const res = await fetch(CONFIG.FEEDBACK_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message })
      });

      const data = await res.json().catch(() => null);

      if (!res.ok || !data || data.error) {
        throw new Error(data?.error || `Upload failed with status ${res.status}`);
      }

      handleFeedbackSuccessVisual();
    } catch (err) {
      console.error("Feedback transmission error:", err);
      showFeedbackAlert(err.message || "Failed to deliver feedback. Please try again.", "error");
      if (btnText) btnText.innerHTML = 'RETRY TRANSMISSION';
      if (submitFeedbackBtn) submitFeedbackBtn.disabled = false;
    }
  }
  window.handleFeedbackSubmit = handleFeedbackSubmit;

  function handleFeedbackSuccessVisual() {
    if (btnText) btnText.innerHTML = '<i class="fa-solid fa-check mr-1"></i> VERIFIED';
    if (submitFeedbackBtn) {
      submitFeedbackBtn.classList.add("bg-green-500", "text-white");
      submitFeedbackBtn.classList.remove("bg-white", "text-black");
    }

    setTimeout(() => {
      toggleFeedback();
      setTimeout(() => {
        if (btnText) btnText.innerHTML = 'SEND DATA';
        if (submitFeedbackBtn) {
          submitFeedbackBtn.classList.remove("bg-green-500", "text-white");
          submitFeedbackBtn.classList.add("bg-white", "text-black");
          submitFeedbackBtn.disabled = false;
        }
        if (feedbackText) {
          feedbackText.disabled = false;
          feedbackText.value = "";
        }
        updateCharCount();
        clearFeedbackAlert();
      }, 500);
    }, 1200);
  }

  // =========================================================================
  // TIP ME A COFFEE — PAYMENT INTEGRATION ARCHITECTURE & UI LOGIC
  // =========================================================================

  /**
   * Clipboard Helper with cross-browser fallback
   */
  function copyTextToClipboard(text) {
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(text);
    }
    return new Promise((resolve, reject) => {
      try {
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.style.position = "fixed";
        ta.style.left = "-9999px";
        ta.style.top = "-9999px";
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        const ok = document.execCommand("copy");
        document.body.removeChild(ta);
        if (ok) resolve();
        else reject(new Error("Copy command failed"));
      } catch (err) {
        reject(err);
      }
    });
  }

  /**
   * Tip Me a Coffee Navigation
   * Seamlessly navigates visitors to the dedicated, verified FamGateway tip experience.
   */
  function openTipPage() {
    if (isNavOpen) toggleNav();
    window.location.href = "tip.html";
  }
  window.openTipPage = openTipPage;

  /**
   * FamGateway TipPaymentService
   * Zero-secret client interface connecting to Cloudflare Worker backend
   */
  const TipPaymentService = {
    async createPaymentOrder({ amount }) {
      const res = await fetch(CONFIG.PAYMENT_ORDER_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: Number(amount) })
      });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.error || err?.message || `Order creation failed (${res.status})`);
      }
      return await res.json();
    },

    async checkPaymentStatus(orderId) {
      const res = await fetch(`${CONFIG.PAYMENT_STATUS_ENDPOINT}?order_id=${encodeURIComponent(orderId)}`, {
        cache: "no-store"
      });
      if (!res.ok) {
        throw new Error(`Failed to check payment status (${res.status})`);
      }
      return await res.json();
    },

    openUPIPayment(upiIntentUrl) {
      if (!upiIntentUrl) return false;
      try {
        window.location.href = upiIntentUrl;
        return true;
      } catch (e) {
        console.error("Failed to launch UPI Intent:", e);
        return false;
      }
    }
  };
  window.TipPaymentService = TipPaymentService;


  // --- Ambient Particles ---
  if (particlesContainer) {
    for (let i = 0; i < 28; i++) {
      const p = document.createElement("div");
      p.className = "particle";
      const sizePx = Math.random() * 3 + 1.5;
      p.style.width = sizePx + "px";
      p.style.height = sizePx + "px";
      p.style.left = Math.random() * 100 + "vw";
      p.style.animationDuration = (Math.random() * 10 + 10) + "s";
      p.style.animationDelay = (Math.random() * 10) + "s";
      particlesContainer.appendChild(p);
    }
  }

  // --- Year Stamp ---
  if (yearEl) {
    yearEl.textContent = new Date().getFullYear();
  }

  // --- Initial GSAP Reveal Animations ---
  if (window.gsap) {
    if (window.ScrollTrigger) gsap.registerPlugin(ScrollTrigger);

    gsap.to(".gsap-reveal", {
      y: 0,
      opacity: 1,
      duration: 0.9,
      stagger: 0.12,
      ease: "power3.out"
    });

    gsap.to(".gsap-fade", {
      opacity: 1,
      duration: 0.9,
      ease: "power2.inOut"
    });

    if (window.ScrollTrigger) {
      ScrollTrigger.create({
        trigger: "#communityCarousel",
        start: "top 85%",
        once: true,
        onEnter: () => goToSlide(0)
      });
    } else {
      goToSlide(0);
    }
  } else {
    goToSlide(0);
  }



  // Initial Load
  load();
})();
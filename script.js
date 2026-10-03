(() => {
  const CONFIG = {
    CATALOG_URL: "catalog.json",
    DEFAULT_ICON: "assets/nik-logo.svg",
    // Feedback endpoint URL (e.g. Cloudflare Worker or Vercel API):
    // Deploy worker/feedback-worker.js and configure your worker URL here.
    FEEDBACK_ENDPOINT: ""
  };

  const $ = s => document.querySelector(s);
  const grid = $("#grid");
  const count = $("#count");
  const hero = $("#heroSearch");
  const topSearch = $("#topSearch");
  const sourceNote = $("#sourceNote");

  let items = [];
  let filter = "all";

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
      : new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" }).format(d);
  };

  const category = s => {
    const n = norm(s);
    return /game|pubg|bgmi|minecraft|roblox|gta|freefire|brawl|gameplay/.test(n)
      ? "games"
      : /tool|manager|zarchiver|termux|vpn|root|utility|editor/.test(n)
        ? "tools"
        : "apps";
  };

  function sanitizeLink(link) {
    const l = clean(link);
    if (!l || ["#", "none", "n/a", "-", "nil"].includes(l.toLowerCase()) || l.toLowerCase().startsWith("javascript:")) {
      return "#";
    }
    return l;
  }

  function normalize(r) {
    const c = norm(r.category) || category(r.name);
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

  function render() {
    if (!grid || !count) return;
    const q = norm((hero ? hero.value : "") || (topSearch ? topSearch.value : ""));
    const visible = items.filter(x =>
      (filter === "all" || x.category === filter) &&
      (!q || norm(x.name + " " + x.description + " " + x.category).includes(q))
    );

    count.textContent = visible.length + " " + (visible.length === 1 ? "item" : "items");

    grid.innerHTML = visible.length
      ? visible.map((a, i) => `
        <article class="card" style="--delay:${i * 45}ms">
          <div class="card-bg">
            <img src="${esc(a.icon)}" alt="" loading="lazy" onerror="this.onerror=null;this.src='${CONFIG.DEFAULT_ICON}'">
          </div>
          <div class="card-content">
            <div class="app-top">
              <img class="icon" src="${esc(a.icon)}" alt="" loading="lazy" onerror="this.onerror=null;this.src='${CONFIG.DEFAULT_ICON}'">
              <div class="app-info">
                <div class="app-name">${esc(a.name)}</div>
                <div class="meta">${esc(a.version)} <i>•</i> ${esc(size(a.size))}</div>
              </div>
              <span class="category-tag">${esc(a.category)}</span>
            </div>
            <div class="description">${esc(a.description)}</div>
            <a class="download ${a.link === "#" ? "disabled" : ""}" href="${esc(a.link)}" target="_blank" rel="noopener noreferrer">
              ${a.link === "#" ? "Not available" : "↓  Continue to download"}
            </a>
            <div class="bottom-meta">
              <span>${a.date ? "◷ " + esc(date(a.date)) : "NIK MODS"}</span>
              <span>● READY</span>
            </div>
          </div>
        </article>
      `).join("")
      : '<div class="empty"><strong>Nothing here yet.</strong><br>Try another search or category.</div>';
  }

  function setFilter(newFilter) {
    filter = newFilter;
    document.querySelectorAll(".filters button").forEach(btn => {
      btn.classList.toggle("active", btn.dataset.filter === newFilter);
    });
    render();
  }

  async function load() {
    try {
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
      if (count) count.textContent = "0 items";
      if (grid) {
        grid.innerHTML = '<div class="empty"><strong>Catalog temporarily unavailable.</strong><br>Please try again in a moment.</div>';
      }
    }
  }

  function sync(a, b) {
    if (!a || !b) return;
    a.addEventListener("input", () => {
      b.value = a.value;
      render();
    });
  }

  sync(hero, topSearch);
  sync(topSearch, hero);

  const filtersEl = $("#filters");
  if (filtersEl) {
    filtersEl.addEventListener("click", e => {
      const b = e.target.closest("button");
      if (!b || !b.dataset.filter) return;
      setFilter(b.dataset.filter);
    });
  }

  // Allow top navigation links to filter catalog
  document.querySelectorAll(".topbar nav a").forEach(link => {
    link.addEventListener("click", () => {
      const href = link.getAttribute("href");
      const text = norm(link.textContent);
      if (["apps", "games", "tools"].includes(text)) {
        setFilter(text);
      } else if (text === "home" || href === "#home" || href === "./") {
        setFilter("all");
      }
    });
  });

  const menuBtn = $(".menu");
  if (menuBtn) {
    menuBtn.addEventListener("click", () => {
      const target = hero || $("#filters") || $("#catalog");
      if (target) {
        target.scrollIntoView({ behavior: "smooth" });
        if (hero) hero.focus();
      }
    });
  }

  const yearEl = $("#year");
  if (yearEl) {
    yearEl.textContent = new Date().getFullYear();
  }

  // Feedback Modal Logic
  const feedbackModal = $("#feedbackModal");
  const openFeedback = $("#openFeedback");
  const closeFeedback = $("#closeFeedback");
  const cancelFeedback = $("#cancelFeedback");
  const doneFeedback = $("#doneFeedback");
  const feedbackForm = $("#feedbackForm");
  const feedbackText = $("#feedbackText");
  const charCount = $("#charCount");
  const feedbackAlert = $("#feedbackAlert");
  const submitFeedback = $("#submitFeedback");
  const feedbackSuccess = $("#feedbackSuccess");

  function showAlert(msg, type = "error") {
    if (!feedbackAlert) return;
    feedbackAlert.className = "feedback-alert " + type;
    feedbackAlert.textContent = msg;
    feedbackAlert.style.display = "block";
  }

  function clearAlert() {
    if (!feedbackAlert) return;
    feedbackAlert.className = "feedback-alert";
    feedbackAlert.textContent = "";
    feedbackAlert.style.display = "none";
  }

  function updateCharCount() {
    if (!feedbackText || !charCount) return;
    const len = feedbackText.value.length;
    charCount.textContent = `${len} / 1000`;
    charCount.classList.toggle("limit", len >= 950);
  }

  function openModal() {
    if (!feedbackModal) return;
    feedbackModal.classList.add("active");
    feedbackModal.setAttribute("aria-hidden", "false");
    document.body.classList.add("modal-open");
    clearAlert();
    if (feedbackForm) {
      feedbackForm.style.display = "block";
      feedbackForm.reset();
    }
    if (feedbackSuccess) feedbackSuccess.style.display = "none";
    updateCharCount();
    setTimeout(() => {
      if (feedbackText) feedbackText.focus();
    }, 50);
  }

  function closeModal() {
    if (!feedbackModal) return;
    feedbackModal.classList.remove("active");
    feedbackModal.setAttribute("aria-hidden", "true");
    document.body.classList.remove("modal-open");
  }

  if (openFeedback) openFeedback.addEventListener("click", openModal);
  if (closeFeedback) closeFeedback.addEventListener("click", closeModal);
  if (cancelFeedback) cancelFeedback.addEventListener("click", closeModal);
  if (doneFeedback) doneFeedback.addEventListener("click", closeModal);

  if (feedbackModal) {
    feedbackModal.addEventListener("click", (e) => {
      if (e.target === feedbackModal) closeModal();
    });
  }

  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && feedbackModal && feedbackModal.classList.contains("active")) {
      closeModal();
    }
  });

  if (feedbackText) {
    feedbackText.addEventListener("input", updateCharCount);
  }

  if (feedbackForm) {
    feedbackForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      clearAlert();

      // Anti-spam honeypot check
      const hp = feedbackForm.querySelector('input[name="_hp_site"]');
      if (hp && hp.value.trim() !== "") {
        // Silently act as success without calling Telegram
        feedbackForm.style.display = "none";
        if (feedbackSuccess) feedbackSuccess.style.display = "block";
        return;
      }

      const message = feedbackText ? feedbackText.value.trim() : "";
      if (!message) {
        showAlert("Please enter your feedback before submitting.", "error");
        if (feedbackText) feedbackText.focus();
        return;
      }

      if (message.length > 1000) {
        showAlert("Feedback message is too long (maximum 1000 characters).", "error");
        return;
      }

      if (!CONFIG.FEEDBACK_ENDPOINT) {
        showAlert("Feedback backend is not yet connected. Please configure FEEDBACK_ENDPOINT.", "error");
        return;
      }

      const submitBtn = submitFeedback;
      const originalHtml = submitBtn ? submitBtn.innerHTML : "";
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span class="btn-label">Sending...</span>';
      }
      if (feedbackText) feedbackText.disabled = true;

      try {
        const res = await fetch(CONFIG.FEEDBACK_ENDPOINT, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message })
        });

        const data = await res.json().catch(() => null);

        if (!res.ok || !data || data.error) {
          throw new Error(data?.error || `Submission failed with status ${res.status}`);
        }

        // Success
        feedbackForm.style.display = "none";
        if (feedbackSuccess) feedbackSuccess.style.display = "block";
        feedbackForm.reset();
        updateCharCount();
      } catch (err) {
        console.error("Feedback submission error:", err);
        showAlert(err.message || "Failed to deliver feedback. Please try again later.", "error");
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.innerHTML = originalHtml;
        }
        if (feedbackText) feedbackText.disabled = false;
      }
    });
  }

  load();
})();
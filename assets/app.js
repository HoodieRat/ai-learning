(function () {
  "use strict";

  const LS = {
    PROGRESS: "aihub.progress",
    THEME: "aihub.theme",
    GITHUB: "aihub.github",
    SIDEBAR_OPEN: "aihub.sidebarOpen",
    SELECTED_CATEGORY: "aihub.selectedCategory",
    SHOW_DRAFTS: "aihub.showDrafts",
    SORT_MODE: "aihub.sortMode",
    LAST_SLUG: "aihub.lastSlug",
    SCROLL_MAP: "aihub.scrollBySlug"
  };

  const DEFAULT_REPO_URL = "https://github.com/HoodieRat/ai-learning";
  const TUTORIALS_JSON_URL = "tutorials.json";
  const TUTORIAL_HTML_PREFIX = "tutorials/";
  const TUTORIAL_HTML_SUFFIX = ".html";
  const LEARNING_PATHS_MD_URL = "learning-paths.md";

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const el = {
    app: $(".app"),
    sidebar: $("#sidebar"),
    btnNav: $("#btnNav"),
    btnTheme: $("#btnTheme"),
    btnGithub: $("#btnGithub"),
    btnHome: $("#btnHome"),
    btnOpenSample: $("#btnOpenSample"),

    btnCopyLink: $("#btnCopyLink"),
    btnPrint: $("#btnPrint"),
    btnBackHome: $("#btnBackHome"),
    btnResetProgress: $("#btnResetProgress"),

    searchInput: $("#searchInput"),
    searchClear: $("#searchClear"),

    categoryFilter: $("#categoryFilter"),
    categoryChips: $("#categoryChips"),
    categoryCurrent: $("#categoryCurrent"),

    tutorialList: $("#tutorialList"),
    sidebarHint: $("#sidebarHint"),

    welcome: $("#welcome"),
    tutorialShell: $("#tutorialShell"),
    tutorialMount: $("#tutorialMount"),
    breadcrumbs: $("#breadcrumbs"),
    errorBox: $("#errorBox"),
    errorText: $("#errorText"),
    content: $("#content"),
    contentInner: $("#contentInner"),

    progressText: $("#progressText"),
    progressFill: $("#progressFill"),

    // Home
    btnContinue: $("#btnContinue"),
    continueHeading: $("#continueHeading"),
    continueText: $("#continueText"),
    continueMeta: $("#continueMeta"),
    featuredList: $("#featuredList"),
    newestList: $("#newestList"),
    pathsList: $("#pathsList"),

    // Hardware reference modal
    btnHardwareReference: $("#btnHardwareReference"),
    hardwareModal: $("#hardwareModal"),
    hardwareContent: $("#hardwareContent")
  };

  function lsGet(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      if (raw == null) return fallback;
      return JSON.parse(raw);
    } catch {
      return fallback;
    }
  }

  function lsSet(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {}
  }

  function clamp(n, min, max) {
    return Math.max(min, Math.min(max, n));
  }

  function normalizeStr(s) {
    return String(s || "")
      .toLowerCase()
      .replace(/\u2011|\u2012|\u2013|\u2014/g, "-")
      .replace(/[^\p{L}\p{N}]+/gu, " ")
      .trim()
      .replace(/\s+/g, " ");
  }

  function safeUrl(s) {
    try {
      const u = new URL(String(s || "").trim(), window.location.href);
      if (u.protocol === "http:" || u.protocol === "https:") return u.toString();
      return null;
    } catch {
      return null;
    }
  }

  function ensureGithubLink() {
    if (!el.btnGithub) return;
    const stored = lsGet(LS.GITHUB, "");
    const storedUrl = safeUrl(stored);
    const currentHref = el.btnGithub.getAttribute("href") || "";
    const currentUrl = safeUrl(currentHref);
    const fallback = currentUrl || DEFAULT_REPO_URL;

    el.btnGithub.href = storedUrl || fallback;
    if (!el.btnGithub.getAttribute("target")) el.btnGithub.setAttribute("target", "_blank");
    if (!el.btnGithub.getAttribute("rel")) el.btnGithub.setAttribute("rel", "noreferrer");
  }

  function setTheme(theme) {
    if (!el.app) return;
    const t = theme === "light" ? "light" : "dark";
    el.app.setAttribute("data-theme", t);
    lsSet(LS.THEME, t);
  }

  function toggleTheme() {
    const cur = (el.app && el.app.getAttribute("data-theme")) || "dark";
    setTheme(cur === "dark" ? "light" : "dark");
  }

  function setSidebarOpen(open) {
    if (!el.sidebar) return;
    if (window.matchMedia("(max-width: 980px)").matches) {
      el.sidebar.classList.toggle("sidebar--open", !!open);
      lsSet(LS.SIDEBAR_OPEN, !!open);
    }
  }

  function closeSidebarOnMobile() {
    if (window.matchMedia("(max-width: 980px)").matches) {
      setSidebarOpen(false);
    }
  }

  function showHome() {
    if (el.welcome) el.welcome.hidden = false;
    if (el.tutorialShell) el.tutorialShell.hidden = true;
    if (el.errorBox) el.errorBox.hidden = true;
    document.title = "AI Learning Hub";
    if (el.content) el.content.focus();
    renderHomeSections().catch(() => {});
  }

  function showError(msg) {
    if (el.welcome) el.welcome.hidden = true;
    if (el.tutorialShell) el.tutorialShell.hidden = true;
    if (el.errorBox) el.errorBox.hidden = false;
    if (el.errorText) el.errorText.textContent = msg || "Unknown error.";
    document.title = "Error • AI Learning Hub";
    if (el.content) el.content.focus();
  }

  function fileProtocolMessage() {
    return [
      "You're opening this site as a local file (file://), which blocks fetch() in most browsers.",
      "",
      "Fix (local preview):",
      "• VS Code: open the folder and use the Live Server extension",
      "• Python: open a terminal in the ai-learning folder and run:  python -m http.server 8000",
      "  then visit: http://localhost:8000",
      "",
      "Fix (publish): host on GitHub Pages and open the https:// URL."
    ].join("\n");
  }

  // App state
  let catalog = null;
  let progress = lsGet(LS.PROGRESS, {});
  let selectedCategory = lsGet(LS.SELECTED_CATEGORY, "All");
  let showDrafts = !!lsGet(LS.SHOW_DRAFTS, false);
  let sortMode = lsGet(LS.SORT_MODE, "recommended"); // recommended | title | time | difficulty
  let searchTerm = "";
  let availability = Object.create(null); // slug -> true/false/null
  let effectiveTutorials = []; // enriched with _status, _exists, etc

  function computeProgressStats(tutorials) {
    const list = Array.isArray(tutorials) ? tutorials : [];
    const all = list.length;
    const done = list.reduce((acc, t) => acc + (progress[t.slug] ? 1 : 0), 0);
    const pct = all ? Math.round((done / all) * 100) : 0;
    return { all, done, pct };
  }

  function renderProgress() {
    if (!el.progressText || !el.progressFill) return;
    const visible = getVisibleTutorialsForProgress();
    const { all, done, pct } = computeProgressStats(visible);
    el.progressText.textContent = `${done} completed • ${all} total`;
    el.progressFill.style.width = `${pct}%`;
  }

  function getVisibleTutorialsForProgress() {
    // Progress should match the same notion of "what counts" the user sees by default:
    // published + existing (plus drafts if toggled)
    return effectiveTutorials.filter((t) => isTutorialVisibleByDefault(t));
  }

  function getTutorialMeta(slug) {
    return effectiveTutorials.find((t) => t.slug === slug) || null;
  }

  function statusFromMeta(t) {
    const raw = (t && (t.status ?? t.published)) as any;
    // Supported:
    // - status: "draft" | "published"
    // - published: true/false
    if (typeof raw === "string") {
      const s = raw.trim().toLowerCase();
      if (s === "draft" || s === "hidden") return "draft";
      if (s === "published" || s === "public") return "published";
    }
    if (typeof raw === "boolean") return raw ? "published" : "draft";
    return null;
  }

  function isTutorialVisibleByDefault(t) {
    const st = t._status;
    if (st === "draft" && !showDrafts) return false;

    // If no explicit status AND the file is missing, treat it like draft (hide by default).
    // If explicit published but missing, keep visible (it will show "Coming soon" on click).
    if (st === "published") return true;
    if (st === "draft") return true; // only if showDrafts
    if (st === "auto-draft") return showDrafts;
    return true;
  }

  function isTutorialIncludedInBrowse(t) {
    if (!isTutorialVisibleByDefault(t)) return false;
    // Hide "auto-draft" when drafts hidden
    if (t._status === "auto-draft" && !showDrafts) return false;
    return true;
  }

  function matchesSearch(t) {
    if (!searchTerm) return true;
    const hay = normalizeStr(
      [
        t.title,
        t.description,
        t.category,
        Array.isArray(t.tags) ? t.tags.join(" ") : "",
        t.slug
      ].join(" ")
    );
    return hay.includes(normalizeStr(searchTerm));
  }

  function matchesCategory(t) {
    if (!selectedCategory || selectedCategory === "All") return true;
    return (t.category || "Uncategorized") === selectedCategory;
  }

  function difficultyRank(d) {
    const s = String(d || "").toLowerCase();
    if (s.includes("beginner")) return 1;
    if (s.includes("intermediate")) return 2;
    if (s.includes("advanced")) return 3;
    return 9;
  }

  function sortTutorials(list) {
    const arr = list.slice();
    if (sortMode === "title") {
      arr.sort((a, b) => String(a.title).localeCompare(String(b.title)));
      return arr;
    }
    if (sortMode === "time") {
      arr.sort((a, b) => (a.minutes || 0) - (b.minutes || 0) || String(a.title).localeCompare(String(b.title)));
      return arr;
    }
    if (sortMode === "difficulty") {
      arr.sort((a, b) => difficultyRank(a.difficulty) - difficultyRank(b.difficulty) || (a.minutes || 0) - (b.minutes || 0));
      return arr;
    }

    // recommended (default): keep catalog order, but push completed lower in browse to encourage progress
    // while still preserving relative order within groups
    arr.sort((a, b) => {
      const ad = progress[a.slug] ? 1 : 0;
      const bd = progress[b.slug] ? 1 : 0;
      if (ad !== bd) return ad - bd;
      return a._idx - b._idx;
    });
    return arr;
  }

  function filteredTutorialsForBrowse() {
    const base = effectiveTutorials.filter(isTutorialIncludedInBrowse);
    const filtered = base.filter((t) => matchesCategory(t) && matchesSearch(t));
    return sortTutorials(filtered);
  }

  function computeCategoryCounts() {
    const base = effectiveTutorials.filter(isTutorialIncludedInBrowse).filter(matchesSearch);
    const counts = new Map();
    for (const t of base) {
      const c = (t.category || "Uncategorized");
      counts.set(c, (counts.get(c) || 0) + 1);
    }
    const total = base.length;
    return { counts, total };
  }

  // UI: category dropdown + counts + drafts toggle + sort
  function ensureBrowseControls() {
    if (!el.categoryFilter) return;

    const body = el.categoryFilter.querySelector(".filter__body");
    if (!body) return;

    // Hide old chip wall container (we'll keep it as a fallback if needed)
    if (el.categoryChips) el.categoryChips.style.display = "none";

    // Category select
    let sel = $("#categorySelect", body);
    if (!sel) {
      sel = document.createElement("select");
      sel.id = "categorySelect";
      sel.className = "search__input";
      sel.style.width = "100%";
      sel.style.marginBottom = "10px";
      body.insertBefore(sel, body.firstChild);

      sel.addEventListener("change", () => {
        selectedCategory = sel.value || "All";
        lsSet(LS.SELECTED_CATEGORY, selectedCategory);
        if (el.categoryCurrent) el.categoryCurrent.textContent = selectedCategory;
        buildTutorialList();
        renderProgress();
      });
    }

    // Draft toggle
    let draftWrap = $("#draftToggleWrap", body);
    if (!draftWrap) {
      draftWrap = document.createElement("label");
      draftWrap.id = "draftToggleWrap";
      draftWrap.style.display = "flex";
      draftWrap.style.alignItems = "center";
      draftWrap.style.gap = "10px";
      draftWrap.style.margin = "0 0 10px 0";
      draftWrap.style.color = "var(--muted)";
      draftWrap.style.fontSize = "12px";

      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.id = "showDraftsToggle";
      cb.checked = !!showDrafts;

      const txt = document.createElement("span");
      txt.textContent = "Show drafts";

      draftWrap.appendChild(cb);
      draftWrap.appendChild(txt);

      body.insertBefore(draftWrap, sel.nextSibling);

      cb.addEventListener("change", () => {
        showDrafts = !!cb.checked;
        lsSet(LS.SHOW_DRAFTS, showDrafts);
        // Recompute categories + list (drafts impact counts)
        populateCategorySelect();
        buildTutorialList();
        renderProgress();
        renderHomeSections().catch(() => {});
      });
    } else {
      const cb = $("#showDraftsToggle", draftWrap);
      if (cb) cb.checked = !!showDrafts;
    }

    // Sort select
    let sortSel = $("#sortSelect", body);
    if (!sortSel) {
      sortSel = document.createElement("select");
      sortSel.id = "sortSelect";
      sortSel.className = "search__input";
      sortSel.style.width = "100%";
      sortSel.style.marginBottom = "6px";

      const opts = [
        ["recommended", "Sort: Recommended"],
        ["title", "Sort: Title (A→Z)"],
        ["time", "Sort: Time (short→long)"],
        ["difficulty", "Sort: Difficulty"]
      ];
      for (const [val, label] of opts) {
        const o = document.createElement("option");
        o.value = val;
        o.textContent = label;
        sortSel.appendChild(o);
      }

      body.insertBefore(sortSel, draftWrap.nextSibling);

      sortSel.addEventListener("change", () => {
        sortMode = sortSel.value || "recommended";
        lsSet(LS.SORT_MODE, sortMode);
        buildTutorialList();
      });
    }
    sortSel.value = sortMode || "recommended";

    populateCategorySelect();
  }

  function populateCategorySelect() {
    const select = $("#categorySelect");
    if (!select) return;
    const { counts, total } = computeCategoryCounts();

    const cats = Array.from(counts.keys()).sort((a, b) => String(a).localeCompare(String(b)));
    const desired = selectedCategory || "All";

    select.innerHTML = "";
    {
      const o = document.createElement("option");
      o.value = "All";
      o.textContent = `All (${total})`;
      select.appendChild(o);
    }
    for (const c of cats) {
      const o = document.createElement("option");
      o.value = c;
      o.textContent = `${c} (${counts.get(c) || 0})`;
      select.appendChild(o);
    }

    // Keep selection valid
    if (desired !== "All" && !counts.has(desired)) selectedCategory = "All";
    select.value = selectedCategory;
    if (el.categoryCurrent) el.categoryCurrent.textContent = selectedCategory;
  }

  function setSidebarHint(msg) {
    if (el.sidebarHint) el.sidebarHint.textContent = msg;
  }

  function buildTutorialList() {
    if (!el.tutorialList) return;
    const list = filteredTutorialsForBrowse();

    el.tutorialList.innerHTML = "";

    if (list.length === 0) {
      setSidebarHint("No tutorials match your filters.");
      const empty = document.createElement("div");
      empty.className = "emptyState";
      empty.textContent = "Try clearing the search, switching category, or enabling drafts.";
      el.tutorialList.appendChild(empty);
      return;
    }
    setSidebarHint("Pick a tutorial or search.");

    const currentSlug = getCurrentSlugFromUrl();

    for (const t of list) {
      const a = document.createElement("a");
      a.href = `?t=${encodeURIComponent(t.slug)}`;
      a.className =
        "tocItem" +
        (progress[t.slug] ? " tocItem--done" : "") +
        (t.slug === currentSlug ? " tocItem--active" : "") +
        (t._status === "draft" ? " tocItem--draft" : "") +
        (t._exists === false ? " tocItem--coming" : "");

      a.setAttribute("data-slug", t.slug);

      const row = document.createElement("div");
      row.className = "tocItem__row";

      const title = document.createElement("div");
      title.className = "tocItem__title";
      title.textContent = t.title || t.slug;

      const meta = document.createElement("div");
      meta.className = "tocItem__meta";

      const dot = document.createElement("span");
      dot.className = "tocItem__status";
      meta.appendChild(dot);

      const m1 = document.createElement("span");
      const bits = [];
      bits.push(`${t.difficulty || "—"}`);
      bits.push(`${typeof t.minutes === "number" ? `${t.minutes}m` : "—"}`);

      if (t._status === "draft") bits.push("Draft");
      if (t._exists === false && t._status === "published") bits.push("Coming soon");
      meta.appendChild((m1.textContent = bits.join(" • "), m1));

      row.appendChild(title);
      row.appendChild(meta);

      const desc = document.createElement("div");
      desc.className = "tocItem__desc";
      desc.textContent = t.description || "";

      a.appendChild(row);
      a.appendChild(desc);

      a.addEventListener("click", (ev) => {
        ev.preventDefault();
        navigateToTutorial(t.slug);
        closeSidebarOnMobile();
      });

      el.tutorialList.appendChild(a);
    }

    renderProgress();
  }

  function setBreadcrumbs(t) {
    if (!el.breadcrumbs) return;
    const c = t.category || "Uncategorized";
    const title = t.title || t.slug;
    let suffix = "";
    if (t._status === "draft") suffix = " • Draft";
    if (t._exists === false && t._status === "published") suffix = " • Coming soon";
    el.breadcrumbs.textContent = `${c} / ${title}${suffix}`;
  }

  function getCurrentSlugFromUrl() {
    try {
      const url = new URL(window.location.href);
      return url.searchParams.get("t");
    } catch {
      return null;
    }
  }

  function updateActiveInSidebar(slug) {
    if (!el.tutorialList) return;
    for (const node of $$("[data-slug]", el.tutorialList)) {
      node.classList.toggle("tocItem--active", node.getAttribute("data-slug") === slug);
    }
  }

  function createComingSoonHtml(meta, reason) {
    const title = meta && meta.title ? meta.title : "Coming soon";
    const desc =
      (meta && meta.description) ||
      "This tutorial is listed in the catalog but the page isn't published yet.";
    const cat = (meta && meta.category) || "Uncategorized";
    const diff = (meta && meta.difficulty) || "—";
    const mins = typeof (meta && meta.minutes) === "number" ? `${meta.minutes} min` : "—";

    const extra =
      reason && String(reason).trim()
        ? `<div class="callout"><strong>Note:</strong> ${escapeHtml(String(reason))}</div>`
        : "";

    return `
<article class="tutorial" data-tutorial>
  <header class="tutorial__header">
    <div class="tutorial__meta">
      <span class="pill" data-field="category">${escapeHtml(cat)}</span>
      <span class="pill pill--subtle" data-field="difficulty">${escapeHtml(diff)}</span>
      <span class="pill pill--subtle" data-field="minutes">${escapeHtml(mins)}</span>
    </div>
    <h1 data-field="title">${escapeHtml(title)}</h1>
    <p class="tutorial__lede" data-field="description">${escapeHtml(desc)}</p>
  </header>

  ${extra}

  <section class="tutorial__section">
    <h2>Coming soon</h2>
    <p>This page isn’t published yet. If you’re building the site, either:</p>
    <ul>
      <li>Create <code>${escapeHtml(TUTORIAL_HTML_PREFIX + (meta && meta.slug ? meta.slug : "your-slug") + TUTORIAL_HTML_SUFFIX)}</code></li>
      <li>Or mark this tutorial as <code>status: "draft"</code> in <code>tutorials.json</code> to hide it by default.</li>
    </ul>
    <div class="callout">
      <strong>Tip:</strong> You can enable “Show drafts” in the sidebar while you build.
    </div>
  </section>
</article>
`.trim();
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  async function loadTutorialHtml(slug) {
    const file = `${TUTORIAL_HTML_PREFIX}${encodeURIComponent(slug)}${TUTORIAL_HTML_SUFFIX}`;
    const resp = await fetch(file, { cache: "no-store" });
    if (!resp.ok) {
      const meta = getTutorialMeta(slug);
      // Friendly fallback (no hard error)
      return createComingSoonHtml(meta || { slug }, `Missing file: ${file}`);
    }
    return await resp.text();
  }

  function wireInternalNav(container) {
    $$("[data-nav]", container).forEach((a) => {
      a.addEventListener("click", (ev) => {
        ev.preventDefault();
        const slug = a.getAttribute("data-nav");
        if (slug) navigateToTutorial(slug);
      });
    });
  }

  function wireCopyButtons(container) {
    $$("[data-copy-selector]", container).forEach((btn) => {
      btn.addEventListener("click", async () => {
        const sel = btn.getAttribute("data-copy-selector");
        const node = sel ? container.querySelector(sel) : null;
        const text = node ? (node.value != null ? node.value : node.textContent) : "";
        const payload = (text || "").trim();

        try {
          await navigator.clipboard.writeText(payload);
          const old = btn.textContent;
          btn.textContent = "Copied!";
          setTimeout(() => (btn.textContent = old), 900);
        } catch {
          const old = btn.textContent;
          btn.textContent = "Copy failed";
          setTimeout(() => (btn.textContent = old), 900);
        }
      });
    });
  }

  function wirePracticeTabs(container) {
    $$("[data-practice]", container).forEach((practice) => {
      const tabs = $$("[data-practice-tab]", practice);
      const panels = $$("[data-practice-panel]", practice);

      function activate(name) {
        tabs.forEach((t) => t.classList.toggle("chip--active", t.getAttribute("data-practice-tab") === name));
        panels.forEach((p) => {
          const is = p.getAttribute("data-practice-panel") === name;
          p.hidden = !is;
        });
      }

      tabs.forEach((t) => t.addEventListener("click", () => activate(t.getAttribute("data-practice-tab"))));
      activate(tabs[0]?.getAttribute("data-practice-tab") || "chat");
    });
  }

  function storeLastSlug(slug) {
    if (!slug) return;
    lsSet(LS.LAST_SLUG, slug);
  }

  function getScrollMap() {
    const m = lsGet(LS.SCROLL_MAP, {});
    return m && typeof m === "object" ? m : {};
  }

  function saveScrollForSlug(slug) {
    if (!slug || !el.content) return;
    const map = getScrollMap();
    map[slug] = clamp(Math.round(el.content.scrollTop || 0), 0, 10_000_000);
    lsSet(LS.SCROLL_MAP, map);
  }

  function restoreScrollForSlug(slug) {
    if (!slug || !el.content) return;
    const map = getScrollMap();
    const v = map[slug];
    if (typeof v === "number" && isFinite(v)) {
      el.content.scrollTop = clamp(v, 0, 10_000_000);
    } else {
      el.content.scrollTop = 0;
    }
  }

  async function renderTutorial(slug) {
    const meta = getTutorialMeta(slug);
    if (!meta) {
      // Not a normal scenario, but still friendly
      const msg = `Tutorial not found in ${TUTORIALS_JSON_URL}: ${slug}`;
      if (el.tutorialMount) el.tutorialMount.innerHTML = createComingSoonHtml({ slug }, msg);
      if (el.welcome) el.welcome.hidden = true;
      if (el.errorBox) el.errorBox.hidden = true;
      if (el.tutorialShell) el.tutorialShell.hidden = false;
      setBreadcrumbs({ slug, category: "Missing", title: "Missing tutorial" });
      document.title = "Missing tutorial • AI Learning Hub";
      updateActiveInSidebar(slug);
      storeLastSlug(slug);
      restoreScrollForSlug(slug);
      if (el.content) el.content.focus();
      return;
    }

    // Save scroll of previous tutorial before swap
    const currentSlug = getCurrentSlugFromUrl();
    if (currentSlug && currentSlug !== slug) saveScrollForSlug(currentSlug);

    const html = await loadTutorialHtml(slug);
    if (el.tutorialMount) el.tutorialMount.innerHTML = html;

    // Populate fields if template uses data-field placeholders
    const root = (el.tutorialMount && el.tutorialMount.querySelector("[data-tutorial]")) || el.tutorialMount;
    if (root) {
      const setField = (name, value) => {
        const node = root.querySelector(`[data-field='${name}']`);
        if (node) node.textContent = value;
      };
      setField("title", meta.title || meta.slug);
      setField("description", meta.description || "");
      setField("category", meta.category || "Uncategorized");
      setField("difficulty", meta.difficulty || "—");
      setField("minutes", typeof meta.minutes === "number" ? `${meta.minutes} min` : "—");
    }

    // Wire behaviors
    if (el.tutorialMount) {
      wireInternalNav(el.tutorialMount);
      wirePracticeTabs(el.tutorialMount);
      wireCopyButtons(el.tutorialMount);

      if (window.AIHubQuiz?.mountQuizzesWithin) {
        try {
          await window.AIHubQuiz.mountQuizzesWithin(el.tutorialMount, slug);
        } catch {}
      }
    }

    if (el.welcome) el.welcome.hidden = true;
    if (el.errorBox) el.errorBox.hidden = true;
    if (el.tutorialShell) el.tutorialShell.hidden = false;

    setBreadcrumbs(meta);
    document.title = `${meta.title || meta.slug} • AI Learning Hub`;

    updateActiveInSidebar(slug);
    storeLastSlug(slug);

    // Restore scroll (after layout)
    requestAnimationFrame(() => {
      restoreScrollForSlug(slug);
      if (el.content) el.content.focus();
    });
  }

  function navigateToTutorial(slug) {
    const url = new URL(window.location.href);
    url.searchParams.set("t", slug);
    history.pushState({ t: slug }, "", url.toString());
    renderTutorial(slug).catch((err) => showError(err?.message || String(err)));
  }

  function handleRoute() {
    const slug = getCurrentSlugFromUrl();
    if (slug) {
      renderTutorial(slug).catch((err) => showError(err?.message || String(err)));
    } else {
      showHome();
      // Save scroll of last tutorial when returning home
      const last = lsGet(LS.LAST_SLUG, "");
      if (typeof last === "string" && last) saveScrollForSlug(last);
    }
  }

  function copyLink() {
    const url = window.location.href;
    const btn = el.btnCopyLink;
    if (!btn) return;

    const done = (ok) => {
      const old = btn.textContent;
      btn.textContent = ok ? "Copied!" : "Copy failed";
      setTimeout(() => (btn.textContent = old), 1200);
    };

    (navigator.clipboard?.writeText ? navigator.clipboard.writeText(url) : Promise.reject())
      .then(() => done(true))
      .catch(() => done(false));
  }

  async function checkFileExists(slug) {
    const file = `${TUTORIAL_HTML_PREFIX}${encodeURIComponent(slug)}${TUTORIAL_HTML_SUFFIX}`;

    // Try HEAD first
    try {
      const resp = await fetch(file, { method: "HEAD", cache: "no-store" });
      if (resp.ok) return true;
      if (resp.status === 404) return false;
      // Some hosts might block HEAD; treat as unknown
    } catch {}

    // Fallback: lightweight GET (still okay on static pages)
    try {
      const resp = await fetch(file, { cache: "no-store" });
      if (resp.ok) return true;
      if (resp.status === 404) return false;
      return null;
    } catch {
      return null;
    }
  }

  async function promisePool(items, concurrency, worker) {
    const ret = new Array(items.length);
    let idx = 0;

    async function runOne() {
      while (idx < items.length) {
        const my = idx++;
        try {
          ret[my] = await worker(items[my], my);
        } catch (e) {
          ret[my] = e;
        }
      }
    }

    const n = clamp(concurrency || 6, 1, 16);
    const runners = [];
    for (let i = 0; i < n; i++) runners.push(runOne());
    await Promise.all(runners);
    return ret;
  }

  async function enrichTutorialsWithStatusAndAvailability(rawTutorials) {
    const arr = rawTutorials.map((t, i) => ({ ...t, _idx: i }));

    // Check existence for slugs that are likely unfinished:
    // - no explicit status/published flag
    // - OR explicitly draft (so we can show "Coming soon" state when drafts are enabled)
    const toCheck = [];
    for (const t of arr) {
      const st = statusFromMeta(t);
      const needsCheck = st == null || st === "draft";
      if (needsCheck && typeof t.slug === "string" && t.slug) toCheck.push(t.slug);
    }

    const uniqueSlugs = Array.from(new Set(toCheck));
    const results = await promisePool(uniqueSlugs, 8, async (slug) => {
      const exists = await checkFileExists(slug);
      availability[slug] = exists;
      return exists;
    });

    // Map results back (availability already filled)
    for (let i = 0; i < uniqueSlugs.length; i++) {
      const slug = uniqueSlugs[i];
      const exists = results[i];
      availability[slug] = typeof exists === "boolean" ? exists : availability[slug] ?? null;
    }

    // Compute effective status
    for (const t of arr) {
      const explicit = statusFromMeta(t);
      const ex = availability[t.slug];
      const exists = typeof ex === "boolean" ? ex : null;

      t._exists = exists;

      if (explicit) {
        t._status = explicit;
      } else {
        // Auto-draft: no status provided + file missing => hide by default (but reveal with Show drafts)
        if (exists === false) t._status = "auto-draft";
        else t._status = "published";
      }
    }

    return arr;
  }

  function buildHomeItem(t) {
    const a = document.createElement("a");
    a.className =
      "tocItem" +
      (progress[t.slug] ? " tocItem--done" : "") +
      (t._status === "draft" ? " tocItem--draft" : "") +
      (t._exists === false && t._status === "published" ? " tocItem--coming" : "");

    a.href = `?t=${encodeURIComponent(t.slug)}`;
    a.style.padding = "10px";

    const row = document.createElement("div");
    row.className = "tocItem__row";

    const title = document.createElement("div");
    title.className = "tocItem__title";
    title.textContent = t.title || t.slug;

    const meta = document.createElement("div");
    meta.className = "tocItem__meta";

    const dot = document.createElement("span");
    dot.className = "tocItem__status";
    meta.appendChild(dot);

    const span = document.createElement("span");
    const bits = [];
    bits.push(`${t.difficulty || "—"}`);
    bits.push(`${typeof t.minutes === "number" ? `${t.minutes}m` : "—"}`);
    if (t._status === "draft") bits.push("Draft");
    if (t._exists === false && t._status === "published") bits.push("Coming soon");
    span.textContent = bits.join(" • ");
    meta.appendChild(span);

    row.appendChild(title);
    row.appendChild(meta);

    const desc = document.createElement("div");
    desc.className = "tocItem__desc";
    desc.textContent = t.description || "";

    a.appendChild(row);
    a.appendChild(desc);

    a.addEventListener("click", (ev) => {
      ev.preventDefault();
      navigateToTutorial(t.slug);
      closeSidebarOnMobile();
    });

    return a;
  }

  function pickContinueSlug() {
    const bySlug = new Map(effectiveTutorials.map((t) => [t.slug, t]));

    const last = lsGet(LS.LAST_SLUG, "");
    if (typeof last === "string" && last && bySlug.has(last) && isTutorialVisibleByDefault(bySlug.get(last))) {
      return last;
    }

    // First unfinished published (prefer existing files)
    const candidates = effectiveTutorials.filter(isTutorialVisibleByDefault);
    const unfinished = candidates.find((t) => !progress[t.slug] && t._status !== "draft" && t._exists !== false);
    if (unfinished) return unfinished.slug;

    const anyUnfinished = candidates.find((t) => !progress[t.slug]);
    if (anyUnfinished) return anyUnfinished.slug;

    return candidates[0]?.slug || "ai-101-what-models-do";
  }

  function curatedFeatured() {
    const list = effectiveTutorials.filter(isTutorialVisibleByDefault);
    const explicit = list.filter((t) => t.featured === true || t.pinned === true);

    const take = (arr, n) => arr.slice(0, n);

    if (explicit.length >= 4) return take(explicit, 6);

    const preferredSlugs = [
      "ai-101-what-models-do",
      "cpu-vs-gpu-vs-npu",
      "vram-vs-ram",
      "quantization-explained",
      "local-ai-ollama-basics",
      "prompting-structure"
    ];

    const picked = [];
    const seen = new Set();
    for (const s of preferredSlugs) {
      const t = list.find((x) => x.slug === s);
      if (t && !seen.has(t.slug)) {
        picked.push(t);
        seen.add(t.slug);
      }
    }

    // Fill remainder from explicit and then from catalog order
    for (const t of explicit) {
      if (picked.length >= 6) break;
      if (!seen.has(t.slug)) {
        picked.push(t);
        seen.add(t.slug);
      }
    }
    for (const t of list) {
      if (picked.length >= 6) break;
      if (!seen.has(t.slug) && t._status !== "draft") {
        picked.push(t);
        seen.add(t.slug);
      }
    }
    return picked.slice(0, 6);
  }

  function curatedNewest() {
    const list = effectiveTutorials.filter(isTutorialVisibleByDefault).filter((t) => t._status !== "draft");

    // If tutorials.json provides a date/order, use it
    const withDate = list.filter((t) => t.added_at || t.updated_at || t.created_at || t.order != null);
    if (withDate.length) {
      const score = (t) => {
        if (typeof t.order === "number") return t.order;
        const d = t.updated_at || t.added_at || t.created_at;
        const ms = Date.parse(d);
        return isFinite(ms) ? ms : 0;
      };
      return list
        .slice()
        .sort((a, b) => score(b) - score(a))
        .slice(0, 6);
    }

    // Fallback: "recently curated" = early catalog entries that exist and aren't drafts, excluding featured picks
    const featuredSlugs = new Set(curatedFeatured().map((t) => t.slug));
    const picked = [];
    for (const t of list) {
      if (picked.length >= 6) break;
      if (featuredSlugs.has(t.slug)) continue;
      if (t._exists === false) continue;
      picked.push(t);
    }
    if (picked.length) return picked;

    return list.slice(0, 6);
  }

  async function parseLearningPathsMd() {
    try {
      const resp = await fetch(LEARNING_PATHS_MD_URL, { cache: "no-store" });
      if (!resp.ok) return null;
      const md = await resp.text();

      // Minimal parser for the current format:
      // ## Path Name
      // 1. Title
      const lines = md.split(/\r?\n/);
      const paths = [];
      let current = null;

      for (const line of lines) {
        const h2 = line.match(/^##\s+(.+)\s*$/);
        if (h2) {
          if (current) paths.push(current);
          current = { name: h2[1].trim(), items: [] };
          continue;
        }
        const li = line.match(/^\s*\d+\.\s+(.+)\s*$/);
        if (li && current) {
          current.items.push(li[1].trim());
        }
      }
      if (current) paths.push(current);
      return paths.length ? paths : null;
    } catch {
      return null;
    }
  }

  function buildPathsFromTitles(pathsMd) {
    const byTitle = new Map();
    for (const t of effectiveTutorials) {
      byTitle.set(normalizeStr(t.title), t);
    }

    const paths = [];
    for (const p of pathsMd) {
      const slugs = [];
      for (const title of p.items) {
        const key = normalizeStr(title);
        const match = byTitle.get(key);
        if (match) slugs.push(match.slug);
      }
      if (slugs.length) paths.push({ name: p.name, slugs });
    }
    return paths;
  }

  async function renderHomeSections() {
    if (!el.welcome) return;

    // Continue Learning
    const continueSlug = pickContinueSlug();
    const continueMeta = getTutorialMeta(continueSlug);

    if (el.btnContinue && continueMeta) {
      el.btnContinue.href = `?t=${encodeURIComponent(continueMeta.slug)}`;
      el.btnContinue.textContent = (progress[continueMeta.slug] ? "Review: " : "Continue: ") + continueMeta.title;
    }

    if (el.continueHeading) {
      el.continueHeading.textContent = progress[continueSlug] ? "Keep going" : "Continue learning";
    }

    if (el.continueText) {
      el.continueText.textContent = progress[continueSlug]
        ? "You’ve completed this one. Review it, or jump to the next unfinished lesson."
        : "Pick up where you left off. Your progress is stored locally in this browser.";
    }

    if (el.continueMeta && continueMeta) {
      el.continueMeta.textContent = `${continueMeta.category || "Uncategorized"} • ${continueMeta.difficulty || "—"} • ${
        typeof continueMeta.minutes === "number" ? `${continueMeta.minutes}m` : "—"
      }`;
    }

    // Featured
    if (el.featuredList) {
      el.featuredList.innerHTML = "";
      const featured = curatedFeatured();
      for (const t of featured) el.featuredList.appendChild(buildHomeItem(t));
    }

    // Newest
    if (el.newestList) {
      el.newestList.innerHTML = "";
      const newest = curatedNewest();
      for (const t of newest) el.newestList.appendChild(buildHomeItem(t));
    }

    // Learning Paths
    if (el.pathsList) {
      el.pathsList.innerHTML = "";

      let pathsMd = await parseLearningPathsMd();
      let paths = [];
      if (pathsMd) {
        paths = buildPathsFromTitles(pathsMd);
      }

      // Fallback paths (if md missing)
      if (!paths.length) {
        paths = [
          { name: "Beginner (No Coding)", slugs: ["ai-101-what-models-do", "tokens-context-temperature", "hallucinations-and-reliability"] },
          { name: "Local Power User", slugs: ["cpu-vs-gpu-vs-npu", "vram-vs-ram", "quantization-explained"] },
          { name: "Builder Track", slugs: ["ai-coding-workflow", "debugging-with-ai", "testing-with-ai"] }
        ];
      }

      // Only show paths whose first step exists in catalog & is visible
      const bySlug = new Map(effectiveTutorials.map((t) => [t.slug, t]));
      for (const p of paths) {
        const firstVisible = p.slugs.map((s) => bySlug.get(s)).find((t) => t && isTutorialVisibleByDefault(t));
        if (!firstVisible) continue;

        const wrap = document.createElement("div");
        wrap.className = "callout";
        wrap.style.margin = "0";

        const strong = document.createElement("strong");
        strong.textContent = p.name;
        wrap.appendChild(strong);

        const meta = document.createElement("div");
        meta.style.color = "var(--muted)";
        meta.style.fontSize = "13px";
        meta.style.marginTop = "4px";

        const stepCount = p.slugs.map((s) => bySlug.get(s)).filter((t) => t && isTutorialVisibleByDefault(t)).length;
        meta.textContent = `${stepCount} steps • Start with: ${firstVisible.title}`;
        wrap.appendChild(meta);

        const actions = document.createElement("div");
        actions.style.marginTop = "10px";

        const start = document.createElement("a");
        start.className = "btn btn--ghost btn--sm";
        start.href = `?t=${encodeURIComponent(firstVisible.slug)}`;
        start.textContent = "Start";
        start.addEventListener("click", (ev) => {
          ev.preventDefault();
          navigateToTutorial(firstVisible.slug);
          closeSidebarOnMobile();
        });

        actions.appendChild(start);
        wrap.appendChild(actions);

        el.pathsList.appendChild(wrap);
      }
    }

    // Keep progress updated on Home
    renderProgress();
  }

  async function loadHardwareReferenceText() {
    const candidates = ["shared/hardware-reference.md", "hardware-reference.md"];
    for (const url of candidates) {
      try {
        const resp = await fetch(url, { cache: "no-store" });
        if (resp.ok) return await resp.text();
      } catch {}
    }
    return "Could not load hardware reference.\n\nExpected file:\n• shared/hardware-reference.md\nor\n• hardware-reference.md";
  }

  function wireHardwareReferenceViewer() {
    if (!el.btnHardwareReference || !el.hardwareModal || !el.hardwareContent) return;

    // Avoid double-binding if index.html already attached a handler
    if (el.btnHardwareReference.dataset.boundHw === "1") return;
    el.btnHardwareReference.dataset.boundHw = "1";

    el.btnHardwareReference.addEventListener("click", async () => {
      el.hardwareContent.textContent = "Loading…";
      try {
        const md = await loadHardwareReferenceText();
        el.hardwareContent.textContent = md;
      } catch (err) {
        el.hardwareContent.textContent = "Failed to load.\n\n" + (err?.message || String(err));
      }

      try {
        el.hardwareModal.showModal();
      } catch {
        // <dialog> not supported
        window.open("hardware-reference.md", "_blank", "noreferrer");
      }
    });
  }

  function wireGlobalEvents() {
    if (el.btnNav) {
      el.btnNav.addEventListener("click", () => {
        const open = !el.sidebar?.classList.contains("sidebar--open");
        setSidebarOpen(open);
      });
    }

    if (el.btnTheme) el.btnTheme.addEventListener("click", toggleTheme);

    if (el.btnHome) {
      el.btnHome.addEventListener("click", (ev) => {
        ev.preventDefault();
        const url = new URL(window.location.href);
        url.searchParams.delete("t");
        history.pushState({}, "", url.toString());
        showHome();
      });
    }

    if (el.btnOpenSample) el.btnOpenSample.addEventListener("click", () => navigateToTutorial("cpu-vs-gpu-vs-npu"));

    if (el.btnCopyLink) el.btnCopyLink.addEventListener("click", copyLink);
    if (el.btnPrint) el.btnPrint.addEventListener("click", () => window.print());

    if (el.btnBackHome) {
      el.btnBackHome.addEventListener("click", () => {
        const url = new URL(window.location.href);
        url.searchParams.delete("t");
        history.pushState({}, "", url.toString());
        showHome();
      });
    }

    if (el.btnResetProgress) {
      el.btnResetProgress.addEventListener("click", () => {
        if (!confirm("Reset all local progress?")) return;
        progress = {};
        lsSet(LS.PROGRESS, progress);
        buildTutorialList();
        renderProgress();
        renderHomeSections().catch(() => {});
      });
    }

    if (el.searchInput) {
      el.searchInput.addEventListener("input", () => {
        searchTerm = (el.searchInput.value || "").trim();
        buildTutorialList();
        populateCategorySelect();
      });
    }
    if (el.searchClear) {
      el.searchClear.addEventListener("click", () => {
        if (el.searchInput) el.searchInput.value = "";
        searchTerm = "";
        buildTutorialList();
        populateCategorySelect();
        el.searchInput?.focus();
      });
    }

    document.addEventListener("click", (ev) => {
      if (!window.matchMedia("(max-width: 980px)").matches) return;
      if (el.sidebar && el.sidebar.classList.contains("sidebar--open")) {
        const within = el.sidebar.contains(ev.target) || (el.btnNav && el.btnNav.contains(ev.target));
        if (!within) setSidebarOpen(false);
      }
    });

    window.addEventListener("popstate", handleRoute);

    // Progress updates from quiz-engine
    document.addEventListener("aihub:progress", () => {
      progress = lsGet(LS.PROGRESS, {});
      buildTutorialList();
      renderProgress();
      renderHomeSections().catch(() => {});
    });

    // Save scroll while reading
    if (el.content) {
      let lastTick = 0;
      el.content.addEventListener(
        "scroll",
        () => {
          const now = Date.now();
          if (now - lastTick < 400) return;
          lastTick = now;
          const slug = getCurrentSlugFromUrl();
          if (slug) saveScrollForSlug(slug);
        },
        { passive: true }
      );
    }
  }

  async function init() {
    setTheme(lsGet(LS.THEME, "dark"));
    ensureGithubLink();

    if (window.location.protocol === "file:") {
      showError(fileProtocolMessage());
      return;
    }

    // Restore sidebar open on mobile
    setSidebarOpen(!!lsGet(LS.SIDEBAR_OPEN, false));

    // Load catalog
    const resp = await fetch(TUTORIALS_JSON_URL, { cache: "no-store" });
    if (!resp.ok) throw new Error("Could not load tutorials.json");
    catalog = await resp.json();

    if (!catalog || !Array.isArray(catalog.tutorials)) throw new Error("Invalid tutorials.json format");

    // Enrich with status + existence checks (so missing pages don't clutter by default)
    effectiveTutorials = await enrichTutorialsWithStatusAndAvailability(catalog.tutorials);

    // Clamp selected category to known categories after enrich
    ensureBrowseControls();
    buildTutorialList();
    renderProgress();
    wireHardwareReferenceViewer();
    wireGlobalEvents();
    handleRoute();
  }

  init().catch((err) => showError(err?.message || String(err)));
})();

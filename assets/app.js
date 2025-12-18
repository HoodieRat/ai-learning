const ASSET_VERSION = "2025-12-17c";

function toUrl(path) {
  return new URL(path, document.baseURI);
}

const STORAGE_KEYS = {
  progress: "aihub.progress",
  theme: "aihub.theme",
  showDrafts: "aihub.showDrafts",
  lastVisited: "aihub.lastVisited",
  lastActivePath: "aihub.lastActivePath",
};

const DIFFICULTY_ORDER = { Beginner: 1, Intermediate: 2, Advanced: 3 };

function readJsonStorage(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function writeJsonStorage(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function escapeHtml(text) {
  return String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function qs(sel) {
  const el = document.querySelector(sel);
  if (!el) throw new Error(`Missing required element: ${sel}`);
  return el;
}

function getSlugFromUrl() {
  const params = new URLSearchParams(location.search);
  const slug = params.get("t");
  return slug && slug.trim() ? slug.trim() : null;
}

function setSlugInUrl(slug, { replace = false } = {}) {
  const url = new URL(location.href);
  if (slug) url.searchParams.set("t", slug);
  else url.searchParams.delete("t");
  if (replace) history.replaceState({ t: slug }, "", url);
  else history.pushState({ t: slug }, "", url);
}

function setTheme(theme) {
  const safe = theme === "dark" ? "dark" : "light";
  document.documentElement.setAttribute("data-theme", safe);
  localStorage.setItem(STORAGE_KEYS.theme, safe);
}

function getTheme() {
  return localStorage.getItem(STORAGE_KEYS.theme) || "light";
}

function withVersion(path) {
  const url = toUrl(path);
  url.searchParams.set("v", ASSET_VERSION);
  return url.toString();
}

async function fetchJson(path) {
  const res = await fetch(withVersion(path), { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to load ${path}: ${res.status}`);
  return res.json();
}

function normalizeTutorial(t) {
  return {
    slug: t.slug,
    title: t.title,
    description: t.description,
    category: t.category,
    difficulty: t.difficulty,
    minutes: t.minutes,
    status: t.status,
    featured: Boolean(t.featured),
    tags: Array.isArray(t.tags) ? t.tags : [],
    quiz: typeof t.quiz === "string" ? t.quiz : null,
    prereqs: Array.isArray(t.prereqs) ? t.prereqs : [],
    next: typeof t.next === "string" ? t.next : null,
    related: Array.isArray(t.related) ? t.related : [],
    path: typeof t.path === "string" ? t.path : null,
    orderInPath: Number.isFinite(t.orderInPath) ? t.orderInPath : null,
    publishedAt: typeof t.publishedAt === "string" ? t.publishedAt : null,
  };
}

function computeCategoryCounts(tutorials, { showDrafts }) {
  const counts = new Map();
  for (const t of tutorials) {
    if (!showDrafts && t.status === "draft") continue;
    counts.set(t.category, (counts.get(t.category) || 0) + 1);
  }
  return counts;
}

function sortTutorials(tutorials, sortKey) {
  const copy = [...tutorials];
  if (sortKey === "title") {
    copy.sort((a, b) => a.title.localeCompare(b.title));
    return copy;
  }
  if (sortKey === "time") {
    copy.sort((a, b) => (a.minutes ?? 0) - (b.minutes ?? 0));
    return copy;
  }
  if (sortKey === "difficulty") {
    copy.sort((a, b) => (DIFFICULTY_ORDER[a.difficulty] || 99) - (DIFFICULTY_ORDER[b.difficulty] || 99));
    return copy;
  }

  // recommended
  copy.sort((a, b) => {
    if (a.featured !== b.featured) return a.featured ? -1 : 1;
    if (a.status !== b.status) return a.status === "published" ? -1 : 1;
    // stable ordering
    return a.title.localeCompare(b.title);
  });
  return copy;
}

function renderTutorialList({ tutorials, activeSlug, showDrafts, category, search, sortKey, progress }) {
  const list = qs("#tutorialList");
  const term = (search || "").trim().toLowerCase();
  const filtered = tutorials.filter((t) => {
    if (!showDrafts && t.status === "draft") return false;
    if (category && category !== "__all__" && t.category !== category) return false;
    if (!term) return true;
    const hay = `${t.title} ${t.description} ${(t.tags || []).join(" ")}`.toLowerCase();
    return hay.includes(term);
  });

  const sorted = sortTutorials(filtered, sortKey);

  if (!sorted.length) {
    list.innerHTML = `
      <div class="emptyState" style="margin: 6px 0;">
        <div style="font-weight:650;">No tutorials match these filters.</div>
        <div class="muted" style="font-size:13px;">Clear search or pick another category.</div>
      </div>`;
    return;
  }

  list.innerHTML = sorted
    .map((t) => {
      const isActive = t.slug === activeSlug;
      const statusTags = t.status === "draft" ? `<span class="tag draft">Draft</span>` : "";
      return `
        <div class="tutorialRow ${isActive ? "active" : ""}" role="button" tabindex="0" data-slug="${escapeHtml(
          t.slug
        )}" aria-current="${isActive ? "page" : "false"}">
          <div class="rowTop">
            <div class="rowTitle">${escapeHtml(t.title)}</div>
            <div class="rowMeta">
              <span>${escapeHtml(t.difficulty)}</span>
              <span>·</span>
              <span>${Number(t.minutes) || 0}m</span>
            </div>
          </div>
          <div class="rowMeta">${statusTags}</div>
          <div class="rowDesc">${escapeHtml(t.description)}</div>
        </div>
      `;
    })
    .join("");

  for (const row of list.querySelectorAll(".tutorialRow")) {
    row.addEventListener("click", () => navigateToTutorial(row.dataset.slug));
    row.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        navigateToTutorial(row.dataset.slug);
      }
    });
  }
}

function comingSoonHtml({ title, message }) {
  return `
    <div class="breadcrumbs"><a href="/" data-nav="home">Home</a><span>›</span><span>Coming soon</span></div>
    <div class="emptyState">
      <h2 style="margin:0 0 8px;">${escapeHtml(title || "Coming Soon")}</h2>
      <p style="margin:0;">${escapeHtml(message || "This tutorial is listed in the catalog but its content is not available yet.")}</p>
    </div>
  `;
}

function renderHome({ tutorials, paths, progress }) {
  const main = qs("#main");
  const lastVisited = localStorage.getItem(STORAGE_KEYS.lastVisited);
  const lastActivePathId = localStorage.getItem(STORAGE_KEYS.lastActivePath);
  const activePath = paths.find((p) => p.id === lastActivePathId) || null;

  const featured = tutorials.filter((t) => t.featured && t.status === "published").slice(0, 6);
  const newest = [...tutorials]
    .filter((t) => t.status === "published")
    .sort((a, b) => (b.publishedAt || "").localeCompare(a.publishedAt || ""))
    .slice(0, 6);

  let continueSlug = lastVisited || null;
  if (activePath) {
    const nextInPath = activePath.lessons.find((slug) => !progress?.[slug]);
    continueSlug = nextInPath || activePath.lessons[0] || continueSlug;
  }

  const continueTutorial = continueSlug ? tutorials.find((t) => t.slug === continueSlug) : null;

  main.innerHTML = `
    <div class="tutorial">
      <h1>Home</h1>
      <p class="lede">Catalog-driven tutorials with Practice Labs and hands-on prompts. Use the sidebar to browse, or start a learning path.</p>

      <div class="gridHome">
        <div class="card">
          <h3>Continue Learning</h3>
          ${continueTutorial ? `<p class="muted">${escapeHtml(continueTutorial.title)}</p>` : `<p class="muted">Pick a tutorial to start.</p>`}
          <div class="contentActions">
            <button class="btn" type="button" id="continueBtn" ${continueTutorial ? "" : "disabled"}>Open</button>
          </div>
        </div>

        <div class="card">
          <h3>Hardware Reference</h3>
          <p class="muted">A quick reference modal for CPU/GPU/NPU, memory, and quantization basics.</p>
          <div class="contentActions">
            <button class="btn" type="button" id="hardwareRefBtn">Open reference</button>
          </div>
        </div>
      </div>

      <div class="divider"></div>

      <div class="gridHome">
        <div class="card">
          <h3>Learning Paths</h3>
          <p class="muted">Pick a path to get Prev/Next navigation and a structured sequence.</p>
          <div id="pathsList"></div>
        </div>

        <div class="card">
          <h3>Featured</h3>
          <div id="featuredList"></div>
        </div>
      </div>

      <div class="divider"></div>

      <div class="card">
        <h3>Newest</h3>
        <div id="newestList"></div>
      </div>
    </div>
  `;

  const listToHtml = (items) => {
    if (!items.length) return `<p class="muted">Nothing here yet.</p>`;
    return `<div class="tutorialList">${items
      .map(
        (t) => `
        <div class="tutorialRow" role="button" tabindex="0" data-slug="${escapeHtml(t.slug)}">
          <div class="rowTop">
            <div class="rowTitle">${escapeHtml(t.title)}</div>
            <div class="rowMeta"><span>${escapeHtml(t.difficulty)}</span><span>·</span><span>${Number(t.minutes) || 0}m</span></div>
          </div>
          <div class="rowDesc">${escapeHtml(t.description)}</div>
        </div>
      `
      )
      .join("")}</div>`;
  };

  qs("#featuredList").innerHTML = listToHtml(featured);
  qs("#newestList").innerHTML = listToHtml(newest);

  const pathsHost = qs("#pathsList");
  pathsHost.innerHTML = `<div class="tutorialList">${paths
    .slice(0, 6)
    .map(
      (p) => `
      <div class="tutorialRow" role="button" tabindex="0" data-path="${escapeHtml(p.id)}">
        <div class="rowTop">
          <div class="rowTitle">${escapeHtml(p.title)}</div>
          <div class="rowMeta"><span>${p.lessons.length} lessons</span></div>
        </div>
        <div class="rowDesc">${escapeHtml(p.description)}</div>
      </div>
    `
    )
    .join("")}</div>`;

  for (const row of main.querySelectorAll(".tutorialRow[data-slug]")) {
    row.addEventListener("click", () => navigateToTutorial(row.dataset.slug));
    row.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        navigateToTutorial(row.dataset.slug);
      }
    });
  }
  for (const row of main.querySelectorAll(".tutorialRow[data-path]")) {
    row.addEventListener("click", () => {
      const id = row.dataset.path;
      localStorage.setItem(STORAGE_KEYS.lastActivePath, id);
      const path = paths.find((p) => p.id === id);
      if (path?.lessons?.length) navigateToTutorial(path.lessons[0]);
    });
  }

  const continueBtn = main.querySelector("#continueBtn");
  if (continueBtn && continueTutorial) {
    continueBtn.addEventListener("click", () => navigateToTutorial(continueTutorial.slug));
  }

  main.querySelector("#hardwareRefBtn")?.addEventListener("click", openHardwareReference);
}

function renderHardwareReference() {
  const host = qs("#hardwareRefBody");
  host.innerHTML = `
    <div class="tutorial">
      <h3>CPU / GPU / NPU</h3>
      <ul>
        <li><strong>CPU</strong>: general-purpose; great for orchestration and small models; slow for large dense matmul.</li>
        <li><strong>GPU</strong>: high throughput; best for training and fast inference; constrained by VRAM.</li>
        <li><strong>NPU</strong>: efficient inference for supported ops; best for on-device/low power; model/driver constraints vary.</li>
      </ul>

      <h3>Memory</h3>
      <ul>
        <li><strong>VRAM</strong>: on-GPU memory; often the primary limiter for large models and context size.</li>
        <li><strong>RAM</strong>: system memory; supports CPU inference and can back GPU via paging (usually much slower).</li>
      </ul>

      <h3>Quantization</h3>
      <ul>
        <li>Reduces model size (and often speeds inference) by using lower precision weights (e.g., 8-bit / 4-bit).</li>
        <li>Tradeoff: quality can drop, and not all runtimes accelerate all quantization formats.</li>
      </ul>
    </div>
  `;
}

function openHardwareReference() {
  renderHardwareReference();
  const dialog = qs("#hardwareRefDialog");
  if (typeof dialog.showModal === "function") dialog.showModal();
}

async function renderTutorial({ tutorial, tutorialsBySlug, paths, progress }) {
  const main = qs("#main");
  const url = toUrl(`tutorials/${tutorial.slug}.html`);
  let html = "";
  try {
    const res = await fetch(url.toString(), { cache: "no-store" });
    if (!res.ok) {
      main.innerHTML = comingSoonHtml({ title: tutorial.title, message: `Content missing (${res.status}).` });
      return;
    }
    html = await res.text();
    if (!html || !html.trim()) {
      main.innerHTML = comingSoonHtml({ title: tutorial.title, message: "Content file is empty." });
      return;
    }
  } catch {
    main.innerHTML = comingSoonHtml({ title: tutorial.title, message: "Failed to load content." });
    return;
  }

  const crumbs = `
    <div class="breadcrumbs">
      <a href="./" data-nav="home">Home</a>
      <span>›</span>
      <span>${escapeHtml(tutorial.category)}</span>
      <span>›</span>
      <span>${escapeHtml(tutorial.title)}</span>
    </div>
  `;

  const actions = `
    <div class="contentActions">
      <button class="btn" type="button" id="copyLinkBtn">Copy link</button>
      <button class="btn" type="button" id="printBtn">Print</button>
    </div>
  `;

  const nav = computePrevNext({ tutorial, tutorialsBySlug, paths });
  const prevNext = `
    <div class="contentActions" aria-label="Prev/Next">
      <button class="btn" type="button" id="prevBtn" ${nav.prev ? "" : "disabled"}>Prev</button>
      <button class="btn" type="button" id="nextBtn" ${nav.next ? "" : "disabled"}>Next</button>
    </div>
  `;

  main.innerHTML = `${crumbs}${actions}${prevNext}<div class="divider"></div>${html}`;

  main.querySelector("#copyLinkBtn")?.addEventListener("click", async () => {
    const link = location.href;
    try {
      await navigator.clipboard.writeText(link);
    } catch {
      // fallback
      window.prompt("Copy link:", link);
    }
  });
  main.querySelector("#printBtn")?.addEventListener("click", () => window.print());
  main.querySelector("#prevBtn")?.addEventListener("click", () => nav.prev && navigateToTutorial(nav.prev));
  main.querySelector("#nextBtn")?.addEventListener("click", () => nav.next && navigateToTutorial(nav.next));

  // Track last visited
  localStorage.setItem(STORAGE_KEYS.lastVisited, tutorial.slug);

  // Mark tutorial as viewed so local progress still works without quizzes
  const progress = readJsonStorage(STORAGE_KEYS.progress, {});
  if (!progress[tutorial.slug]) {
    progress[tutorial.slug] = true;
    writeJsonStorage(STORAGE_KEYS.progress, progress);
    document.dispatchEvent(new CustomEvent("aihub:progress"));
  }

  // Local cross-links inside tutorial content
  for (const a of main.querySelectorAll('a[href^="?t="]')) {
    a.addEventListener("click", (e) => {
      e.preventDefault();
      const href = a.getAttribute("href") || "";
      const slug = new URLSearchParams(href.replace(/^\?/, "")).get("t");
      if (slug) navigateToTutorial(slug);
    });
  }
}

function computePrevNext({ tutorial, tutorialsBySlug, paths }) {
  const activePathId = localStorage.getItem(STORAGE_KEYS.lastActivePath);
  const activePath = activePathId ? paths.find((p) => p.id === activePathId) : null;
  if (activePath?.lessons?.includes(tutorial.slug)) {
    const idx = activePath.lessons.indexOf(tutorial.slug);
    return {
      prev: idx > 0 ? activePath.lessons[idx - 1] : null,
      next: idx >= 0 && idx < activePath.lessons.length - 1 ? activePath.lessons[idx + 1] : null,
    };
  }

  if (tutorial.path && Number.isFinite(tutorial.orderInPath)) {
    const siblings = [...tutorialsBySlug.values()]
      .filter((t) => t.path === tutorial.path)
      .sort((a, b) => (a.orderInPath ?? 0) - (b.orderInPath ?? 0));
    const idx = siblings.findIndex((t) => t.slug === tutorial.slug);
    return {
      prev: idx > 0 ? siblings[idx - 1].slug : null,
      next: idx >= 0 && idx < siblings.length - 1 ? siblings[idx + 1].slug : null,
    };
  }
  return { prev: null, next: null };
}

let APP = {
  tutorials: [],
  tutorialsBySlug: new Map(),
  paths: [],
  site: null,
  progress: {},
};

function navigateToTutorial(slug) {
  setSlugInUrl(slug);
  update();
}

async function update() {
  const activeSlug = getSlugFromUrl();
  const showDrafts = Boolean(readJsonStorage(STORAGE_KEYS.showDrafts, false));
  const category = qs("#categorySelect").value || "__all__";
  const search = qs("#searchInput").value || "";
  const sortKey = qs("#sortSelect").value || "recommended";
  const progress = readJsonStorage(STORAGE_KEYS.progress, {});
  APP.progress = progress;

  renderTutorialList({
    tutorials: APP.tutorials,
    activeSlug,
    showDrafts,
    category,
    search,
    sortKey,
    progress,
  });

  const t = activeSlug ? APP.tutorialsBySlug.get(activeSlug) : null;
  if (!t) {
    renderHome({ tutorials: APP.tutorials, paths: APP.paths, progress });
    return;
  }

  if (!showDrafts && t.status === "draft") {
    // hidden unless explicitly shown
    renderHome({ tutorials: APP.tutorials, paths: APP.paths, progress });
    return;
  }
  await renderTutorial({ tutorial: t, tutorialsBySlug: APP.tutorialsBySlug, paths: APP.paths, progress });
}

let initialized = false;

function populateCategories({ showDrafts }) {
  const counts = computeCategoryCounts(APP.tutorials, { showDrafts });
  const categories = [...new Set(APP.tutorials.map((t) => t.category))].sort((a, b) => a.localeCompare(b));
  const select = qs("#categorySelect");
  select.innerHTML = [`<option value="__all__">All (${APP.tutorials.filter((t) => showDrafts || t.status !== "draft").length})</option>`]
    .concat(categories.map((c) => `<option value="${escapeHtml(c)}">${escapeHtml(c)} (${counts.get(c) || 0})</option>`))
    .join("");
}

async function init() {
  try {
    const [tutorialsRaw, pathsRaw, site] = await Promise.all([
      fetchJson("data/tutorials.json"),
      fetchJson("data/paths.json"),
      fetchJson("data/site.json").catch(() => null),
    ]);

    const tutorials = (tutorialsRaw.tutorials || tutorialsRaw).map(normalizeTutorial);
    APP.tutorials = tutorials;
    APP.tutorialsBySlug = new Map(tutorials.map((t) => [t.slug, t]));
    APP.paths = pathsRaw.paths || pathsRaw;
    APP.site = site;

    if (site?.repoUrl) qs("#githubLink").setAttribute("href", site.repoUrl);

    const showDrafts = Boolean(readJsonStorage(STORAGE_KEYS.showDrafts, false));
    populateCategories({ showDrafts });

    if (!initialized) {
      // Settings
      setTheme(getTheme());
      qs("#showDraftsToggle").checked = showDrafts;

      // UI events (run once)
      qs("#themeToggle").addEventListener("click", () => setTheme(getTheme() === "dark" ? "light" : "dark"));
      qs("#searchInput").addEventListener("input", () => update());
      qs("#categorySelect").addEventListener("change", () => update());
      qs("#sortSelect").addEventListener("change", () => update());
      qs("#showDraftsToggle").addEventListener("change", (e) => {
        const value = Boolean(e.target.checked);
        writeJsonStorage(STORAGE_KEYS.showDrafts, value);
        populateCategories({ showDrafts: value });
        update();
      });

      document.addEventListener("click", (e) => {
        const a = e.target.closest("a[data-nav='home']");
        if (!a) return;
        e.preventDefault();
        setSlugInUrl(null);
        update();
      });

      document.addEventListener("click", (e) => {
        const btn = e.target.closest("[data-modal-close]");
        if (!btn) return;
        const dialog = qs("#hardwareRefDialog");
        if (typeof dialog.close === "function") dialog.close();
      });

      window.addEventListener("popstate", () => update());
      document.addEventListener("aihub:progress", () => update());

      const initialSlug = getSlugFromUrl();
      history.replaceState({ t: initialSlug }, "", location.href);
      initialized = true;
    }

    await update();
  } catch (err) {
    const main = document.querySelector("#main");
    const hint =
      location.protocol === "file:"
        ? `It looks like you opened this via <strong>file://</strong>. Browsers block <code>fetch()</code> for local files. Run a local server in <code>c:\\ai_learning_site</code> and open <code>http://localhost:8000</code>.`
        : "";
    if (main)
      main.innerHTML = `
        <div class="emptyState" style="margin-top:10px;">
          <div style="font-weight:650; margin-bottom:6px;">App failed to initialize</div>
          <div class="muted" style="margin-bottom:10px;">${escapeHtml(err?.message || String(err))}</div>
          ${hint ? `<div class="status">${hint}</div>` : ""}
          <div class="contentActions" style="margin-top:12px;">
            <button class="btn" type="button" id="retryInit">Retry</button>
          </div>
        </div>
      `;
    document.querySelector("#retryInit")?.addEventListener("click", () => init());
  }
}

init();

/*

const state = {
  tutorials: [],
  paths: [],
  ui: {
    search: '',
    category: 'All Categories',
    sort: 'recommended',
    showDrafts: false,
  },
  activeSlug: null,
};

async function loadCatalog() {
  const tUrl = new URL('tutorials.json', DATA_BASE);
  const pUrl = new URL('paths.json', DATA_BASE);

  const [tRes, pRes] = await Promise.all([fetch(tUrl), fetch(pUrl)]);

  if (!tRes.ok) throw new Error(`Failed to load tutorials.json (${tRes.status})`);
  if (!pRes.ok) throw new Error(`Failed to load paths.json (${pRes.status})`);

  const tutorials = await tRes.json();
  const paths = await pRes.json();

  if (!Array.isArray(tutorials)) throw new Error('tutorials.json must be an array');
  if (!Array.isArray(paths)) throw new Error('paths.json must be an array');

  state.tutorials = tutorials;
  state.paths = paths;
}

function initUiBindings() {
  const searchInput = $('searchInput');
  const categorySelect = $('categorySelect');
  const sortSelect = $('sortSelect');
  const showDrafts = $('showDrafts');

  searchInput.addEventListener('input', () => {
    state.ui.search = searchInput.value;
    renderSidebar();
  });

  sortSelect.addEventListener('change', () => {
    state.ui.sort = sortSelect.value;
    renderSidebar();
  });

  showDrafts.addEventListener('change', () => {
    state.ui.showDrafts = showDrafts.checked;
    renderSidebar();
  });

  categorySelect.addEventListener('change', () => {
    state.ui.category = categorySelect.value;
    renderSidebar();
  });

  const browseToggle = $('browseToggle');
  const browsePanel = $('browsePanel');
  browseToggle.addEventListener('click', () => {
    const isOpen = !browsePanel.hasAttribute('hidden');
    if (isOpen) browsePanel.setAttribute('hidden', '');
    else browsePanel.removeAttribute('hidden');
    browseToggle.setAttribute('aria-expanded', String(!isOpen));
  });

  $('themeToggle').addEventListener('click', () => {
    const next = getTheme() === 'light' ? 'dark' : 'light';
    setTheme(next);
  });

  document.addEventListener('click', (e) => {
    const target = e.target;
    if (!(target instanceof HTMLElement)) return;

    const modalClose = target.closest('[data-modal-close]');
    if (modalClose) {
      closeModal();
      return;
    }

    const navHome = target.closest('[data-nav="home"]');
    if (navHome) {
      e.preventDefault();
      navigateHome();
      return;
    }

    const navTutorial = target.closest('[data-nav="tutorial"]');
    if (navTutorial) {
      e.preventDefault();
      const slug = navTutorial.getAttribute('data-slug');
      if (slug) navigateToTutorial(slug);
      return;
    }

    // Intercept normal links containing ?t=
    const link = target.closest('a[href]');
    if (link && link instanceof HTMLAnchorElement) {
      const url = new URL(link.href, window.location.href);
      const t = url.searchParams.get('t');
      if (t) {
        e.preventDefault();
        navigateToTutorial(t);
      }
    }
  });

  window.addEventListener('popstate', () => {
    const slug = getSlugFromUrl();
    if (slug) void showTutorial(slug, { replace: true });
    else showHome({ replace: true });
  });
}

function openModal(html) {
  const root = $('modalRoot');
  root.innerHTML = html;
  root.hidden = false;
  root.addEventListener(
    'click',
    (e) => {
      if (e.target === root) closeModal();
    },
    { once: true },
  );
}

function closeModal() {
  const root = $('modalRoot');
  root.hidden = true;
  root.innerHTML = '';
}

function getFilteredTutorials() {
  const q = state.ui.search.trim().toLowerCase();
  const progress = getProgress();

  let items = state.tutorials.filter((t) => {
    if (!t || !isNonEmptyString(t.slug)) return false;
    if (!isNonEmptyString(t.title)) return false;
    if (!isNonEmptyString(t.description)) return false;
    if (!CATEGORIES.includes(t.category)) return false;
    if (!isNonEmptyString(t.status)) return false;

    if (t.status === 'draft' && !state.ui.showDrafts) return false;

    if (state.ui.category !== 'All Categories' && t.category !== state.ui.category) return false;

    if (q) {
      const blob = `${t.title} ${t.description} ${(t.tags || []).join(' ')} ${t.category}`.toLowerCase();
      if (!blob.includes(q)) return false;
    }

    return true;
  });

  const sorter =
    state.ui.sort === 'title'
      ? byTitle
      : state.ui.sort === 'time'
        ? byTime
        : state.ui.sort === 'difficulty'
          ? byDifficulty
          : byRecommended;

  items = items.slice().sort(sorter);

  // Optional: keep active item visible at top if desired (not required), so don't.
  // Attach derived flags for rendering
  return items.map((t) => ({ ...t, _done: !!progress[t.slug] }));
}

function renderSidebar() {
  // Category dropdown with counts
  const categorySelect = $('categorySelect');
  const showDrafts = $('showDrafts');
  const sortSelect = $('sortSelect');

  showDrafts.checked = !!state.ui.showDrafts;
  sortSelect.value = state.ui.sort;

  const counts = new Map();
  for (const c of CATEGORIES) counts.set(c, 0);
  let visibleTotal = 0;

  for (const t of state.tutorials) {
    if (!t || !CATEGORIES.includes(t.category)) continue;
    if (t.status === 'draft' && !state.ui.showDrafts) continue;
    counts.set(t.category, (counts.get(t.category) || 0) + 1);
    visibleTotal += 1;
  }

  const options = ['All Categories', ...CATEGORIES].map((c) => {
    if (c === 'All Categories') return `<option value="All Categories">All Categories (${visibleTotal})</option>`;
    return `<option value="${escapeHtml(c)}">${escapeHtml(c)} (${counts.get(c) || 0})</option>`;
  });
  categorySelect.innerHTML = options.join('');
  categorySelect.value = state.ui.category;

  // Tutorial list
  const list = $('tutorialList');
  const items = getFilteredTutorials();

  list.innerHTML = items
    .map((t) => {
      const active = t.slug === state.activeSlug;
      const meta = `${difficultyLabel(t.difficulty)} · ${t.minutes || 0}m`;
      const done = t._done;
      const tags = [
        done ? '<span class="dot dot--ok" title="Completed"></span>' : '<span class="dot" title="Not completed"></span>',
        t.status === 'draft' ? '<span class="tag">Draft</span>' : '',
      ]
        .filter(Boolean)
        .join(' ');

      return `
        <div class="tutorial-row ${active ? 'is-active' : ''}" role="button" tabindex="0" data-nav="tutorial" data-slug="${escapeHtml(t.slug)}" aria-label="Open ${escapeHtml(t.title)}">
          <div class="tutorial-row__top">
            <div>
              <div class="tutorial-row__title">${escapeHtml(t.title)}</div>
              <div class="tutorial-row__meta">${escapeHtml(meta)}</div>
            </div>
            <div style="display:flex; gap:6px; align-items:center; justify-content:flex-end;">${tags}</div>
          </div>
          <div class="tutorial-row__desc">${escapeHtml(t.description)}</div>
        </div>
      `;
    })
    .join('');

  // Keyboard access
  list.querySelectorAll('.tutorial-row').forEach((row) => {
    row.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        const slug = row.getAttribute('data-slug');
        if (slug) navigateToTutorial(slug);
      }
    });
  });
}

function tutorialBySlug(slug) {
  return state.tutorials.find((t) => t.slug === slug) || null;
}

function computePrevNext(slug) {
  const t = tutorialBySlug(slug);
  if (!t) return { prev: null, next: null };

  if (t.path && typeof t.orderInPath === 'number') {
    const samePath = state.tutorials
      .filter((x) => x.path === t.path && typeof x.orderInPath === 'number')
      .slice()
      .sort((a, b) => a.orderInPath - b.orderInPath);

    const idx = samePath.findIndex((x) => x.slug === slug);
    const prev = idx > 0 ? samePath[idx - 1] : null;
    const next = idx >= 0 && idx < samePath.length - 1 ? samePath[idx + 1] : null;
    return { prev, next };
  }

  return { prev: null, next: null };
}

function renderTutorialShell(tutorial, innerHtml, { comingSoon = false } = {}) {
  const main = $('main');
  const url = new URL(window.location.href);

  const { prev, next } = computePrevNext(tutorial.slug);

  const crumbs = `
    <div class="breadcrumbs">
      <a href="./" data-nav="home">Home</a>
      <span aria-hidden="true">/</span>
      <span>${escapeHtml(tutorial.category)}</span>
      <span aria-hidden="true">/</span>
      <span>${escapeHtml(tutorial.title)}</span>
    </div>
  `;

  const actions = `
    <div class="page-actions">
      <button class="button button--ghost" type="button" data-copy-link>Copy link</button>
      <button class="button button--ghost" type="button" data-print>Print</button>
    </div>
  `;

  const nav = `
    <div style="display:flex; gap:10px; flex-wrap:wrap; margin-top: 10px;">
      ${prev ? `<button class="button button--ghost" type="button" data-nav="tutorial" data-slug="${escapeHtml(prev.slug)}">← Prev</button>` : ''}
      ${next ? `<button class="button button--ghost" type="button" data-nav="tutorial" data-slug="${escapeHtml(next.slug)}">Next →</button>` : ''}
    </div>
  `;

  const badge = comingSoon ? '<span class="tag">Coming soon</span>' : tutorial.status === 'draft' ? '<span class="tag">Draft</span>' : '';

  main.innerHTML = `
    <div class="page-head">
      ${crumbs}
      <div class="card" style="box-shadow:none;">
        <div style="display:flex; justify-content:space-between; gap:12px; align-items:flex-start;">
          <div>
            <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap;">
              <h1 style="margin:0;">${escapeHtml(tutorial.title)}</h1>
              ${badge}
            </div>
            <p style="margin: 8px 0 0; color: var(--muted)">${escapeHtml(tutorial.description)}</p>
            <p style="margin: 8px 0 0; color: var(--muted); font-size: 12px;">${escapeHtml(tutorial.category)} · ${escapeHtml(difficultyLabel(tutorial.difficulty))} · ${tutorial.minutes || 0}m</p>
          </div>
          ${actions}
        </div>
        ${nav}
      </div>
    </div>

    <div class="card" id="tutorialContent" style="box-shadow:none;">
      ${innerHtml}
    </div>
  `;

  main.querySelector('[data-copy-link]')?.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(url.toString());
    } catch {
      // Clipboard may be blocked; degrade silently.
    }
  });

  main.querySelector('[data-print]')?.addEventListener('click', () => window.print());

  const root = main.querySelector('#tutorialContent');
  document.dispatchEvent(new CustomEvent('aihub:contentRendered', { detail: { root, slug: tutorial.slug } }));
}

function renderComingSoon(tutorial) {
  const html = `
    <div class="notice">
      <strong>Coming Soon</strong>
      <p style="margin: 6px 0 0;">This tutorial is listed in the catalog, but the HTML content isn’t available yet. The app keeps running without errors.</p>
    </div>
  `;
  renderTutorialShell(tutorial, html, { comingSoon: true });
}

async function showTutorial(slug, { replace = false } = {}) {
  const t = tutorialBySlug(slug);
  if (!t) {
    showHome({ replace: true });
    return;
  }

  state.activeSlug = slug;
  renderSidebar();

  setSlugInUrl(slug, { replace });
  localStorage.setItem('aihub.lastViewed', slug);

  const url = new URL(`${t.slug}.html`, TUTORIALS_BASE);
  let res;
  try {
    res = await fetch(url.toString(), { cache: 'no-store' });
  } catch {
    renderComingSoon(t);
    return;
  }

  if (!res.ok) {
    renderComingSoon(t);
    return;
  }

  const html = await res.text();
  renderTutorialShell(t, html);
}

function pickContinueLearning() {
  const progress = getProgress();
  const lastPathId = localStorage.getItem('aihub.lastPath');

  if (lastPathId) {
    const path = state.paths.find((p) => p.id === lastPathId);
    if (path && Array.isArray(path.lessons)) {
      const next = path.lessons.find((slug) => !progress[slug]);
      if (next) return tutorialBySlug(next);
      const first = path.lessons[0];
      return first ? tutorialBySlug(first) : null;
    }
  }

  const lastViewed = localStorage.getItem('aihub.lastViewed');
  if (lastViewed) return tutorialBySlug(lastViewed);

  return null;
}

function showHome({ replace = false } = {}) {
  state.activeSlug = null;
  setSlugInUrl(null, { replace });
  renderSidebar();

  const main = $('main');

  const cont = pickContinueLearning();
  const featured = state.tutorials.filter((t) => t.featured && t.status !== 'draft').slice().sort(byRecommended).slice(0, 6);
  const newest = state.tutorials
    .filter((t) => t.status !== 'draft')
    .slice()
    .sort((a, b) => (Date.parse(b.created || '') || 0) - (Date.parse(a.created || '') || 0))
    .slice(0, 6);

  const paths = state.paths.slice(0, 6);

  main.innerHTML = `
    <div class="card" style="box-shadow:none;">
      <h1 style="margin:0;">Home</h1>
      <p style="margin: 8px 0 0; color: var(--muted);">Browse calm, catalog-driven tutorials. Progress saves locally when you open lessons.</p>

      <hr class="sep" />

      <div style="display:grid; gap: 14px;">
        <section class="card" style="box-shadow:none;">
          <div style="display:flex; justify-content:space-between; gap: 10px; align-items:center;">
            <h2 style="margin:0;">Continue Learning</h2>
            <button class="button button--ghost" type="button" id="hardwareRef">Hardware Reference</button>
          </div>
          ${cont ? `
            <p style="margin: 8px 0 10px; color: var(--muted);">Pick up where you left off.</p>
            <button class="button" type="button" data-nav="tutorial" data-slug="${escapeHtml(cont.slug)}">Open: ${escapeHtml(cont.title)}</button>
          ` : `
            <p style="margin: 8px 0 0; color: var(--muted);">No recent activity yet. Choose a tutorial from the sidebar to start.</p>
          `}
        </section>

        <section class="card" style="box-shadow:none;">
          <h2 style="margin:0;">Learning Paths</h2>
          <p style="margin: 8px 0 10px; color: var(--muted);">Curated sequences spanning multiple categories.</p>
          <div style="display:flex; gap:10px; flex-wrap:wrap;">
            ${paths
              .map(
                (p) => `<button class="button" type="button" data-path="${escapeHtml(p.id)}">${escapeHtml(p.title)}</button>`,
              )
              .join('')}
          </div>
        </section>

        <section class="card" style="box-shadow:none;">
          <h2 style="margin:0;">Featured</h2>
          <div style="display:grid; gap: 8px; margin-top: 10px;">
            ${featured
              .map(
                (t) => `<button class="button button--ghost" type="button" data-nav="tutorial" data-slug="${escapeHtml(t.slug)}">${escapeHtml(t.title)} · ${escapeHtml(t.category)}</button>`,
              )
              .join('') || `<p style="margin:0; color: var(--muted);">No featured tutorials yet.</p>`}
          </div>
        </section>

        <section class="card" style="box-shadow:none;">
          <h2 style="margin:0;">Newest</h2>
          <div style="display:grid; gap: 8px; margin-top: 10px;">
            ${newest
              .map(
                (t) => `<button class="button button--ghost" type="button" data-nav="tutorial" data-slug="${escapeHtml(t.slug)}">${escapeHtml(t.title)} · ${escapeHtml(t.category)}</button>`,
              )
              .join('')}
          </div>
        </section>
      </div>
    </div>
  `;

  $('hardwareRef')?.addEventListener('click', () => openModal(makeHardwareReferenceHtml()));

  main.querySelectorAll('[data-path]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-path');
      const path = state.paths.find((p) => p.id === id);
      if (!path) return;
      localStorage.setItem('aihub.lastPath', id);
      const progress = getProgress();
      const next = (path.lessons || []).find((s) => !progress[s]) || (path.lessons || [])[0];
      if (next) navigateToTutorial(next);
    });
  });
}

function navigateHome() {
  showHome({ replace: false });
}

function navigateToTutorial(slug) {
  void showTutorial(slug, { replace: false });
}

function applyGithubLink() {
  // If the generator wrote a repo URL into localStorage, prefer it.
  const stored = localStorage.getItem('aihub.repo');
  const link = $('githubLink');
  if (stored && isNonEmptyString(stored)) link.href = stored;
}

async function bootstrap() {
  setTheme(getTheme());
  initUiBindings();

  try {
    await loadCatalog();
  } catch (err) {
    $('main').innerHTML = `<div class="card"><div class="notice notice--warn"><strong>Failed to load catalog</strong><p style="margin:6px 0 0;">${escapeHtml(String(err?.message || err))}</p></div></div>`;
    return;
  }

  renderSidebar();
  applyGithubLink();

  document.addEventListener('aihub:progress', () => renderSidebar());

  const slug = getSlugFromUrl();
  if (slug) {
    await showTutorial(slug, { replace: true });
  } else {
    showHome({ replace: true });
  }
}

void bootstrap();

*/

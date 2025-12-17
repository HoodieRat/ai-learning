(function(){
  const LS_KEY_PROGRESS = "aihub.progress";
  const LS_KEY_THEME = "aihub.theme";
  const LS_KEY_GITHUB = "aihub.github";
  const LS_KEY_SIDEBAR = "aihub.sidebarOpen";
  const LS_KEY_SEL_CAT = "aihub.selectedCategory";

  const $ = (sel, root=document) => root.querySelector(sel);
  const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));

  function lsGet(key, fallback){
    try{
      const raw = localStorage.getItem(key);
      if(raw == null) return fallback;
      return JSON.parse(raw);
    }catch{ return fallback; }
  }
  function lsSet(key, value){
    try{ localStorage.setItem(key, JSON.stringify(value)); }catch{}
  }

  const el = {
    app: document.querySelector(".app"),
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
    categoryChips: $("#categoryChips"),
    tutorialList: $("#tutorialList"),
    sidebarHint: $("#sidebarHint"),
    welcome: $("#welcome"),
    tutorialShell: $("#tutorialShell"),
    tutorialMount: $("#tutorialMount"),
    breadcrumbs: $("#breadcrumbs"),
    errorBox: $("#errorBox"),
    errorText: $("#errorText"),
    content: $("#content"),
    progressText: $("#progressText"),
    progressFill: $("#progressFill")
  };

  let catalog = null;
  let selectedCategory = lsGet(LS_KEY_SEL_CAT, "All");
  let searchTerm = "";
  let progress = lsGet(LS_KEY_PROGRESS, {});

  function uniq(arr){ return Array.from(new Set(arr)); }

  function setTheme(theme){
    el.app.setAttribute("data-theme", theme);
    lsSet(LS_KEY_THEME, theme);
  }

  function toggleTheme(){
    const cur = el.app.getAttribute("data-theme") || "dark";
    setTheme(cur === "dark" ? "light" : "dark");
  }

  function updateGithubLink(){
    const val = lsGet(LS_KEY_GITHUB, "");
    el.btnGithub.href = (val && typeof val === "string") ? val : "#";
  }

  function setSidebarOpen(open){
    if(window.matchMedia("(max-width: 980px)").matches){
      el.sidebar.classList.toggle("sidebar--open", !!open);
      lsSet(LS_KEY_SIDEBAR, !!open);
    }
  }

  function closeSidebarOnMobile(){
    if(window.matchMedia("(max-width: 980px)").matches){
      setSidebarOpen(false);
    }
  }

  function computeProgressStats(){
    const all = catalog ? catalog.tutorials.length : 0;
    const done = Object.values(progress).filter(Boolean).length;
    const pct = all ? Math.round((done / all) * 100) : 0;
    return {all, done, pct};
  }

  function renderProgress(){
    if(!catalog) return;
    const {all, done, pct} = computeProgressStats();
    el.progressText.textContent = `${done} completed • ${all} total`;
    el.progressFill.style.width = `${pct}%`;
  }

  function showHome(){
    el.welcome.hidden = false;
    el.tutorialShell.hidden = true;
    el.errorBox.hidden = true;
    document.title = "AI Learning Hub";
  }

  function showError(msg){
    el.welcome.hidden = true;
    el.tutorialShell.hidden = true;
    el.errorBox.hidden = false;
    el.errorText.textContent = msg || "Unknown error.";
  }

  function buildCategoryChips(){
    const cats = uniq(catalog.tutorials.map(t => t.category)).sort((a,b)=>a.localeCompare(b));
    const allCats = ["All", ...cats];
    el.categoryChips.innerHTML = "";
    allCats.forEach(cat => {
      const chip = document.createElement("button");
      chip.className = "chip" + (cat === selectedCategory ? " chip--active" : "");
      chip.textContent = cat;
      chip.addEventListener("click", () => {
        selectedCategory = cat;
        lsSet(LS_KEY_SEL_CAT, selectedCategory);
        buildCategoryChips();
        buildTutorialList();
      });
      el.categoryChips.appendChild(chip);
    });
  }

  function matchesFilter(t){
    if(selectedCategory !== "All" && t.category !== selectedCategory) return false;
    if(searchTerm){
      const hay = (t.title + " " + t.description + " " + t.category).toLowerCase();
      if(!hay.includes(searchTerm.toLowerCase())) return false;
    }
    return true;
  }

  function buildTutorialList(){
    const filtered = catalog.tutorials.filter(matchesFilter);
    el.tutorialList.innerHTML = "";

    if(filtered.length === 0){
      el.sidebarHint.textContent = "No tutorials match your filters.";
      return;
    }else{
      el.sidebarHint.textContent = "Pick a tutorial or search.";
    }

    filtered.forEach(t => {
      const a = document.createElement("a");
      a.href = `?t=${encodeURIComponent(t.slug)}`;
      a.className = "tocItem" + (progress[t.slug] ? " tocItem--done" : "");
      a.setAttribute("data-slug", t.slug);

      const row = document.createElement("div");
      row.className = "tocItem__row";

      const title = document.createElement("div");
      title.className = "tocItem__title";
      title.textContent = t.title;

      const meta = document.createElement("div");
      meta.className = "tocItem__meta";
      const dot = document.createElement("span");
      dot.className = "tocItem__status";
      meta.appendChild(dot);
      const m1 = document.createElement("span");
      m1.textContent = `${t.difficulty} • ${t.minutes}m`;
      meta.appendChild(m1);

      row.appendChild(title);
      row.appendChild(meta);

      const desc = document.createElement("div");
      desc.className = "tocItem__desc";
      desc.textContent = t.description;

      a.appendChild(row);
      a.appendChild(desc);

      a.addEventListener("click", (ev) => {
        ev.preventDefault();
        navigateToTutorial(t.slug);
        closeSidebarOnMobile();
      });

      el.tutorialList.appendChild(a);
    });

    renderProgress();
  }

  function setBreadcrumbs(t){
    el.breadcrumbs.textContent = `${t.category} / ${t.title}`;
  }

  function getTutorialMeta(slug){
    return catalog.tutorials.find(t => t.slug === slug) || null;
  }

  async function loadTutorialHtml(slug){
    const file = `tutorials/${slug}.html`;
    const resp = await fetch(file, {cache:"no-store"});
    if(!resp.ok) throw new Error(`Missing tutorial file: ${file}`);
    return await resp.text();
  }

  function wireInternalNav(container){
    $$("[data-nav]", container).forEach(a => {
      a.addEventListener("click", (ev) => {
        ev.preventDefault();
        const slug = a.getAttribute("data-nav");
        if(slug) navigateToTutorial(slug);
      });
    });
  }

  function wireCopyButtons(container){
    $$("[data-copy-selector]", container).forEach(btn => {
      btn.addEventListener("click", async () => {
        const sel = btn.getAttribute("data-copy-selector");
        const node = sel ? container.querySelector(sel) : null;
        const text =
          node ? (node.value != null ? node.value : node.textContent) : "";
        try{
          await navigator.clipboard.writeText((text || "").trim());
          const old = btn.textContent;
          btn.textContent = "Copied!";
          setTimeout(()=> btn.textContent = old, 900);
        }catch{
          const old = btn.textContent;
          btn.textContent = "Copy failed";
          setTimeout(()=> btn.textContent = old, 900);
        }
      });
    });
  }

  function wirePracticeTabs(container){
    $$("[data-practice]", container).forEach(practice => {
      const tabs = $$("[data-practice-tab]", practice);
      const panels = $$("[data-practice-panel]", practice);

      function activate(name){
        tabs.forEach(t => t.classList.toggle("chip--active", t.getAttribute("data-practice-tab") === name));
        panels.forEach(p => {
          const is = p.getAttribute("data-practice-panel") === name;
          p.hidden = !is;
        });
      }

      tabs.forEach(t => {
        t.addEventListener("click", () => activate(t.getAttribute("data-practice-tab")));
      });

      activate(tabs[0]?.getAttribute("data-practice-tab") || "chat");
    });
  }

  async function renderTutorial(slug){
    const meta = getTutorialMeta(slug);
    if(!meta){ showError("Tutorial not found in tutorials.json: " + slug); return; }

    const html = await loadTutorialHtml(slug);
    el.tutorialMount.innerHTML = html;

    const root = el.tutorialMount.querySelector("[data-tutorial]") || el.tutorialMount;
    const setField = (name, value) => {
      const node = root.querySelector(`[data-field='${name}']`);
      if(node) node.textContent = value;
    };
    setField("title", meta.title);
    setField("description", meta.description);
    setField("category", meta.category);
    setField("difficulty", meta.difficulty);
    setField("minutes", `${meta.minutes} min`);

    wireInternalNav(el.tutorialMount);
    wirePracticeTabs(el.tutorialMount);
    wireCopyButtons(el.tutorialMount);

    if(window.AIHubQuiz?.mountQuizzesWithin){
      await window.AIHubQuiz.mountQuizzesWithin(el.tutorialMount, slug);
    }

    el.welcome.hidden = true;
    el.errorBox.hidden = true;
    el.tutorialShell.hidden = false;
    setBreadcrumbs(meta);
    document.title = meta.title + " • AI Learning Hub";
    setTimeout(() => el.content.focus(), 0);
  }

  function navigateToTutorial(slug){
    const url = new URL(window.location.href);
    url.searchParams.set("t", slug);
    history.pushState({t: slug}, "", url.toString());
    renderTutorial(slug).catch(err => showError(err.message || String(err)));
  }

  function handleRoute(){
    const url = new URL(window.location.href);
    const slug = url.searchParams.get("t");
    if(slug) renderTutorial(slug).catch(err => showError(err.message || String(err)));
    else showHome();
  }

  function copyLink(){
    const url = window.location.href;
    navigator.clipboard?.writeText(url).then(()=>{
      el.btnCopyLink.textContent = "Copied!";
      setTimeout(()=> el.btnCopyLink.textContent = "Copy link", 1200);
    }).catch(()=>{
      el.btnCopyLink.textContent = "Copy failed";
      setTimeout(()=> el.btnCopyLink.textContent = "Copy link", 1200);
    });
  }

  function fileProtocolMessage(){
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

  async function init(){
    setTheme(lsGet(LS_KEY_THEME, "dark"));
    updateGithubLink();

    if(window.location.protocol === "file:"){
      showError(fileProtocolMessage());
      return;
    }

    const resp = await fetch("tutorials.json", {cache:"no-store"});
    if(!resp.ok) throw new Error("Could not load tutorials.json");
    catalog = await resp.json();

    buildCategoryChips();
    buildTutorialList();
    renderProgress();
    handleRoute();

    el.btnNav.addEventListener("click", () => {
      const open = !el.sidebar.classList.contains("sidebar--open");
      setSidebarOpen(open);
    });
    el.btnTheme.addEventListener("click", toggleTheme);
    el.btnHome.addEventListener("click", (ev) => { ev.preventDefault(); history.pushState({}, "", window.location.pathname); showHome(); });
    el.btnOpenSample.addEventListener("click", () => navigateToTutorial("cpu-vs-gpu-vs-npu"));
    el.btnCopyLink.addEventListener("click", copyLink);
    el.btnPrint.addEventListener("click", () => window.print());
    el.btnBackHome.addEventListener("click", () => { history.pushState({}, "", window.location.pathname); showHome(); });

    el.btnResetProgress.addEventListener("click", () => {
      if(!confirm("Reset all local progress?")) return;
      progress = {};
      lsSet(LS_KEY_PROGRESS, progress);
      buildTutorialList();
      renderProgress();
    });

    el.searchInput.addEventListener("input", () => {
      searchTerm = el.searchInput.value.trim();
      buildTutorialList();
    });
    el.searchClear.addEventListener("click", () => {
      el.searchInput.value = "";
      searchTerm = "";
      buildTutorialList();
      el.searchInput.focus();
    });

    document.addEventListener("click", (ev) => {
      if(!window.matchMedia("(max-width: 980px)").matches) return;
      if(el.sidebar.classList.contains("sidebar--open")){
        const within = el.sidebar.contains(ev.target) || el.btnNav.contains(ev.target);
        if(!within) setSidebarOpen(false);
      }
    });

    window.addEventListener("popstate", handleRoute);

    document.addEventListener("aihub:progress", () => {
      progress = lsGet(LS_KEY_PROGRESS, {});
      buildTutorialList();
      renderProgress();
    });
  }

  init().catch(err => showError(err.message || String(err)));
})();
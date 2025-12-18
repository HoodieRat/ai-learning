(function () {
  const QUIZ_BASE = new URL("quizzes/", document.baseURI);
  function isNonEmptyString(v) {
    return typeof v === "string" && v.trim().length > 0;
  }

  function safeParseJson(text) {
    try {
      return { ok: true, value: JSON.parse(text) };
    } catch (err) {
      return { ok: false, error: err };
    }
  }

  function readProgress() {
    try {
      return JSON.parse(localStorage.getItem("aihub.progress") || "{}") || {};
    } catch {
      return {};
    }
  }

  function writeProgress(progress) {
    localStorage.setItem("aihub.progress", JSON.stringify(progress));
  }

  function getSlugFromContainer(container) {
    const fromAttr = container.getAttribute("data-quiz-slug");
    if (fromAttr) return fromAttr;
    const params = new URLSearchParams(location.search);
    return params.get("t") || "";
  }

  function normalizeType(type) {
    // Accept required names, plus legacy aliases.
    if (type === "multiple-choice" || type === "multi-select" || type === "true-false") return type;
    if (type === "single") return "multiple-choice";
    if (type === "multi") return "multi-select";
    return type;
  }

  function validateQuiz(quiz) {
    if (!quiz || typeof quiz !== "object") return { ok: false, error: "Invalid quiz format" };
    if (!isNonEmptyString(quiz.title)) return { ok: false, error: "Invalid quiz format" };
    if (!Number.isFinite(quiz.passingScore)) return { ok: false, error: "Invalid quiz format" };
    if (!Array.isArray(quiz.questions)) return { ok: false, error: "Invalid quiz format" };
    if (quiz.questions.length === 0) return { ok: false, error: "No questions" };

    for (const q of quiz.questions) {
      if (!q || typeof q !== "object") return { ok: false, error: "Invalid quiz format" };
      if (!isNonEmptyString(q.type)) return { ok: false, error: "Invalid quiz format" };
      if (!isNonEmptyString(q.question)) return { ok: false, error: "Invalid quiz format" };
      if (!isNonEmptyString(q.explanation)) return { ok: false, error: "Invalid quiz format" };

      const type = normalizeType(q.type);

      if (type === "true-false") {
        if (typeof q.answer !== "boolean") return { ok: false, error: "Invalid quiz format" };
        continue;
      }

      if (type === "multiple-choice") {
        if (!Array.isArray(q.options) || q.options.length < 2) return { ok: false, error: "Invalid quiz format" };
        if (!isNonEmptyString(q.answer)) return { ok: false, error: "Invalid quiz format" };
        if (!q.options.includes(q.answer)) return { ok: false, error: "Invalid quiz format" };
        continue;
      }

      if (type === "multi-select") {
        if (!Array.isArray(q.options) || q.options.length < 2) return { ok: false, error: "Invalid quiz format" };
        if (!Array.isArray(q.answer) || q.answer.length < 1) return { ok: false, error: "Invalid quiz format" };
        for (const a of q.answer) {
          if (!isNonEmptyString(a)) return { ok: false, error: "Invalid quiz format" };
          if (!q.options.includes(a)) return { ok: false, error: "Invalid quiz format" };
        }
        continue;
      }

      return { ok: false, error: "Invalid quiz format" };
    }

    return { ok: true };
  }

  function el(tag, attrs = {}, children = []) {
    const node = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k === "class") node.className = v;
      else if (k.startsWith("on") && typeof v === "function") node.addEventListener(k.slice(2), v);
      else node.setAttribute(k, String(v));
    }
    for (const child of children) {
      if (child == null) continue;
      node.appendChild(typeof child === "string" ? document.createTextNode(child) : child);
    }
    return node;
  }

  function renderError(container, title, detail, retryFn) {
    container.innerHTML = "";
    const root = el("div", { class: "quiz" });
    root.appendChild(el("h3", {}, [title]));
    root.appendChild(el("div", { class: "status error" }, [detail]));
    root.appendChild(el("button", { class: "btn", type: "button", onClick: retryFn }, ["Retry"]));
    container.appendChild(root);
  }

  function scoreQuiz(quiz, formData) {
    const results = [];
    let correct = 0;

    quiz.questions.forEach((q, idx) => {
      const type = normalizeType(q.type);
      const key = `q_${idx}`;
      let isCorrect = false;

      if (type === "true-false") {
        const chosen = formData.get(key) === "true";
        isCorrect = chosen === q.answer;
        results.push({ chosen, isCorrect });
      } else if (type === "multiple-choice") {
        const chosen = String(formData.get(key) || "");
        isCorrect = chosen === q.answer;
        results.push({ chosen, isCorrect });
      } else if (type === "multi-select") {
        const chosen = formData.getAll(key).map(String);
        const correctSet = new Set(q.answer);
        const chosenSet = new Set(chosen);
        isCorrect = correctSet.size === chosenSet.size && [...correctSet].every((x) => chosenSet.has(x));
        results.push({ chosen, isCorrect });
      } else {
        results.push({ chosen: null, isCorrect: false });
      }

      if (isCorrect) correct += 1;
    });

    const total = quiz.questions.length;
    const percent = total ? Math.round((correct / total) * 100) : 0;
    const passed = percent >= quiz.passingScore;
    return { correct, total, percent, passed, results };
  }

  function renderQuiz(container, quiz) {
    container.innerHTML = "";
    const root = el("div", { class: "quiz" });
    root.appendChild(el("h3", {}, [quiz.title]));
    root.appendChild(el("div", { class: "status" }, [`Passing score: ${quiz.passingScore}%`]));

    const form = el("form");

    quiz.questions.forEach((q, idx) => {
      const type = normalizeType(q.type);
      const qHost = el("div", { class: "q" });
      qHost.appendChild(el("div", { class: "qTitle" }, [`${idx + 1}. ${q.question}`]));

      const key = `q_${idx}`;

      if (type === "true-false") {
        const opts = [
          { label: "True", value: "true" },
          { label: "False", value: "false" },
        ];
        for (const opt of opts) {
          const id = `${key}_${opt.value}`;
          qHost.appendChild(
            el("label", { for: id, style: "display:block; margin: 6px 0;" }, [
              el("input", { id, type: "radio", name: key, value: opt.value, required: "true" }),
              ` ${opt.label}`,
            ])
          );
        }
      } else if (type === "multiple-choice") {
        for (const opt of q.options) {
          const id = `${key}_${opt}`;
          qHost.appendChild(
            el("label", { for: id, style: "display:block; margin: 6px 0;" }, [
              el("input", { id, type: "radio", name: key, value: opt, required: "true" }),
              ` ${opt}`,
            ])
          );
        }
      } else if (type === "multi-select") {
        for (const opt of q.options) {
          const id = `${key}_${opt}`;
          qHost.appendChild(
            el("label", { for: id, style: "display:block; margin: 6px 0;" }, [
              el("input", { id, type: "checkbox", name: key, value: opt }),
              ` ${opt}`,
            ])
          );
        }
        qHost.appendChild(el("div", { class: "status" }, ["Select all that apply."]));
      }

      qHost.appendChild(el("div", { class: "explain", "data-explain": String(idx) }));
      form.appendChild(qHost);
    });

    const submit = el("button", { class: "btn", type: "submit" }, ["Submit"]);
    const resultHost = el("div", { class: "result", style: "display:none;" });

    form.appendChild(el("div", { style: "margin-top: 12px; display:flex; gap:10px; flex-wrap:wrap;" }, [submit]));
    root.appendChild(form);
    root.appendChild(resultHost);

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const formData = new FormData(form);
      const scored = scoreQuiz(quiz, formData);

      quiz.questions.forEach((q, idx) => {
        const explain = form.querySelector(`[data-explain='${idx}']`);
        if (!explain) return;
        const ok = scored.results[idx]?.isCorrect;
        explain.textContent = `${ok ? "Correct" : "Incorrect"}. ${q.explanation}`;
      });

      resultHost.style.display = "block";
      resultHost.textContent = `Score: ${scored.percent}% (${scored.correct}/${scored.total}). ${scored.passed ? "Passed" : "Not passed"}.`;

      if (scored.passed) {
        const slug = getSlugFromContainer(container);
        if (slug) {
          const progress = readProgress();
          progress[slug] = true;
          writeProgress(progress);
          document.dispatchEvent(new CustomEvent("aihub:progress"));
        }
      }
    });

    container.appendChild(root);
  }

  async function loadAndMount(container) {
    const file = container.getAttribute("data-quiz");
    if (!file) return;

    const url = new URL(file, QUIZ_BASE);
    try {
      const res = await fetch(url.toString(), { cache: "no-store" });
      if (res.status === 404) {
        renderError(container, "Quiz", "Quiz not available (404).", () => loadAndMount(container));
        return;
      }
      if (!res.ok) {
        renderError(container, "Quiz", `Failed to load (${res.status}).`, () => loadAndMount(container));
        return;
      }

      const text = await res.text();
      const parsed = safeParseJson(text);
      if (!parsed.ok) {
        renderError(container, "Quiz", "Invalid quiz format.", () => loadAndMount(container));
        return;
      }

      const quiz = parsed.value;
      const valid = validateQuiz(quiz);
      if (!valid.ok) {
        renderError(container, "Quiz", valid.error, () => loadAndMount(container));
        return;
      }

      renderQuiz(container, quiz);
    } catch {
      renderError(container, "Quiz", "Failed to load.", () => loadAndMount(container));
    }
  }

  function mountAll(root = document) {
    const nodes = root.querySelectorAll("[data-quiz]");
    nodes.forEach((node) => {
      if (node.getAttribute("data-quiz-mounted") === "true") return;
      node.setAttribute("data-quiz-mounted", "true");
      loadAndMount(node);
    });
  }

  window.AIHubQuizEngine = { mountAll };

  document.addEventListener("DOMContentLoaded", () => mountAll());
})();

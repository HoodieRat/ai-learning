const QUIZ_BASE = new URL('quizzes/', document.baseURI);

function safeParseJson(text) {
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch (err) {
    return { ok: false, error: err };
  }
}

function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "class") node.className = v;
    else if (k === "html") node.innerHTML = v;
    else if (k.startsWith("on") && typeof v === "function") node.addEventListener(k.slice(2), v);
    else node.setAttribute(k, String(v));
  }
  for (const child of children) {
    if (child == null) continue;
    node.appendChild(typeof child === "string" ? document.createTextNode(child) : child);
  }
  return node;
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

function getSlugFromPage(container) {
  const fromAttr = container.getAttribute("data-quiz-slug");
  if (fromAttr) return fromAttr;
  const params = new URLSearchParams(location.search);
  return params.get("t") || "";
}

function validateQuiz(quiz) {
  if (!quiz || typeof quiz !== "object") return { ok: false, error: "Invalid quiz format" };
  if (typeof quiz.title !== "string" || !quiz.title.trim()) return { ok: false, error: "Invalid quiz format" };
  if (!Number.isFinite(quiz.passingScore)) return { ok: false, error: "Invalid quiz format" };
  if (!Array.isArray(quiz.questions)) return { ok: false, error: "Invalid quiz format" };
  if (quiz.questions.length === 0) return { ok: false, error: "No questions" };

  for (const q of quiz.questions) {
    if (!q || typeof q !== "object") return { ok: false, error: "Invalid quiz format" };
    if (typeof q.type !== "string" || !q.type) return { ok: false, error: "Invalid quiz format" };
    if (typeof q.question !== "string" || !q.question.trim()) return { ok: false, error: "Invalid quiz format" };
    if (typeof q.explanation !== "string" || !q.explanation.trim()) return { ok: false, error: "Invalid quiz format" };

    const type = q.type;
    if (type === "true-false") {
      if (typeof q.answer !== "boolean") return { ok: false, error: "Invalid quiz format" };
      continue;
    }
    if (type === "single" || type === "multi") {
      if (!Array.isArray(q.options) || q.options.length < 2) return { ok: false, error: "Invalid quiz format" };
      if (type === "single" && typeof q.answer !== "string") return { ok: false, error: "Invalid quiz format" };
      if (type === "multi" && !Array.isArray(q.answer)) return { ok: false, error: "Invalid quiz format" };
      continue;
    }
    return { ok: false, error: "Invalid quiz format" };
  }

  return { ok: true };
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
    const key = `q_${idx}`;
    let isCorrect = false;

    if (q.type === "true-false") {
      const val = formData.get(key);
      const chosen = val === "true";
      isCorrect = chosen === q.answer;
      results.push({ chosen, isCorrect });
    } else if (q.type === "single") {
      const chosen = formData.get(key);
      isCorrect = chosen === q.answer;
      results.push({ chosen, isCorrect });
    } else if (q.type === "multi") {
      const chosen = formData.getAll(key);
      const correctSet = new Set(q.answer);
      const chosenSet = new Set(chosen);
      isCorrect = correctSet.size === chosenSet.size && [...correctSet].every((x) => chosenSet.has(x));
      results.push({ chosen, isCorrect });
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
    const qHost = el("div", { class: "q" });
    qHost.appendChild(el("div", { class: "qTitle" }, [`${idx + 1}. ${q.question}`]));

    const key = `q_${idx}`;
    if (q.type === "true-false") {
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
    } else if (q.type === "single") {
      for (const opt of q.options) {
        const id = `${key}_${opt}`;
        qHost.appendChild(
          el("label", { for: id, style: "display:block; margin: 6px 0;" }, [
            el("input", { id, type: "radio", name: key, value: opt, required: "true" }),
            ` ${opt}`,
          ])
        );
      }
    } else if (q.type === "multi") {
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

    // Per-question feedback
    quiz.questions.forEach((q, idx) => {
      const explain = form.querySelector(`[data-explain='${idx}']`);
      if (!explain) return;
      const ok = scored.results[idx]?.isCorrect;
      explain.textContent = `${ok ? "Correct" : "Incorrect"}. ${q.explanation}`;
    });

    resultHost.style.display = "block";
    resultHost.textContent = `Score: ${scored.percent}% (${scored.correct}/${scored.total}). ${scored.passed ? "Passed" : "Not passed"}.`;

    if (scored.passed) {
      const slug = getSlugFromPage(container);
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

function mountAll() {
  const nodes = document.querySelectorAll("[data-quiz]");
  nodes.forEach((n) => {
    if (n.getAttribute("data-quiz-mounted") === "true") return;
    n.setAttribute("data-quiz-mounted", "true");
    loadAndMount(n);
  });
}

window.AIHubQuizEngine = { mountAll };
document.addEventListener("DOMContentLoaded", () => mountAll());
function safeJsonParse(text) {
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch (err) {
    return { ok: false, error: err };
  }
}

function isNonEmptyString(v) {
  return typeof v === 'string' && v.trim().length > 0;
}

function validateQuiz(quiz) {
  if (!quiz || typeof quiz !== 'object') return { ok: false, reason: 'Invalid quiz format' };
  if (!isNonEmptyString(quiz.title)) return { ok: false, reason: 'Invalid quiz format' };
  if (typeof quiz.passingScore !== 'number') return { ok: false, reason: 'Invalid quiz format' };
  if (!Array.isArray(quiz.questions)) return { ok: false, reason: 'Invalid quiz format' };
  if (quiz.questions.length === 0) return { ok: false, reason: 'No questions' };

  for (const q of quiz.questions) {
    if (!q || typeof q !== 'object') return { ok: false, reason: 'Invalid quiz format' };
    if (!isNonEmptyString(q.type)) return { ok: false, reason: 'Invalid quiz format' };
    if (!isNonEmptyString(q.question)) return { ok: false, reason: 'Invalid quiz format' };
    if (!isNonEmptyString(q.explanation)) return { ok: false, reason: 'Invalid quiz format' };

    if (q.type === 'multiple-choice') {
      if (!Array.isArray(q.options) || q.options.length < 2) return { ok: false, reason: 'Invalid quiz format' };
      if (!isNonEmptyString(q.answer)) return { ok: false, reason: 'Invalid quiz format' };
    } else if (q.type === 'true-false') {
      if (typeof q.answer !== 'boolean') return { ok: false, reason: 'Invalid quiz format' };
    } else if (q.type === 'multi-select') {
      if (!Array.isArray(q.options) || q.options.length < 2) return { ok: false, reason: 'Invalid quiz format' };
      if (!Array.isArray(q.answer) || q.answer.length < 1) return { ok: false, reason: 'Invalid quiz format' };
    } else {
      return { ok: false, reason: 'Invalid quiz format' };
    }
  }

  return { ok: true };
}

function loadProgressMap() {
  const raw = localStorage.getItem('aihub.progress');
  if (!raw) return {};
  try {
    const v = JSON.parse(raw);
    return v && typeof v === 'object' ? v : {};
  } catch {
    return {};
  }
}

function setProgress(slug, value) {
  const map = loadProgressMap();
  map[slug] = !!value;
  localStorage.setItem('aihub.progress', JSON.stringify(map));
}

function renderError(root, title, detail, onRetry) {
  root.innerHTML = '';
  const wrap = document.createElement('div');
  wrap.className = 'quiz';
  wrap.innerHTML = `
    <p class="quiz__title">${escapeHtml(title)}</p>
    <p class="quiz__status">${escapeHtml(detail)}</p>
  `;
  const btn = document.createElement('button');
  btn.className = 'button';
  btn.type = 'button';
  btn.textContent = 'Retry';
  btn.addEventListener('click', onRetry);
  wrap.appendChild(btn);
  root.appendChild(wrap);
}

function escapeHtml(str) {
  return String(str)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function normalizeAnswer(type, valueOrArray) {
  if (type === 'true-false') return valueOrArray === 'true';
  if (type === 'multiple-choice') return String(valueOrArray ?? '');
  if (type === 'multi-select') return Array.isArray(valueOrArray) ? valueOrArray.map(String) : [];
  return valueOrArray;
}

function isCorrect(q, userAnswer) {
  if (q.type === 'true-false') {
    return userAnswer === q.answer;
  }
  if (q.type === 'multiple-choice') {
    return userAnswer === q.answer;
  }
  if (q.type === 'multi-select') {
    const expected = new Set(q.answer.map(String));
    const actual = new Set((userAnswer || []).map(String));
    if (expected.size !== actual.size) return false;
    for (const v of expected) if (!actual.has(v)) return false;
    return true;
  }
  return false;
}

function mountQuiz(el, quizFilename, slug) {
  const quizUrl = new URL(quizFilename, QUIZ_BASE);

  const doLoad = async () => {
    el.innerHTML = `<div class="quiz"><p class="quiz__title">Loading quiz…</p><p class="quiz__status">${escapeHtml(quizFilename)}</p></div>`;

    let res;
    try {
      res = await fetch(quizUrl.toString(), { cache: 'no-store' });
    } catch (err) {
      renderError(el, 'Failed to load', 'Network error while fetching quiz.', doLoad);
      return;
    }

    if (res.status === 404) {
      renderError(el, 'Quiz not available', 'This quiz file was not found.', doLoad);
      return;
    }

    if (!res.ok) {
      renderError(el, 'Failed to load', `Server returned ${res.status}.`, doLoad);
      return;
    }

    const text = await res.text();
    const parsed = safeJsonParse(text);
    if (!parsed.ok) {
      renderError(el, 'Invalid quiz format', 'Quiz JSON could not be parsed.', doLoad);
      return;
    }

    const quiz = parsed.value;
    const validation = validateQuiz(quiz);
    if (!validation.ok) {
      const detail = validation.reason === 'No questions' ? 'No questions in this quiz.' : 'Quiz JSON did not match the required shape.';
      renderError(el, validation.reason, detail, doLoad);
      return;
    }

    // Render quiz
    const container = document.createElement('div');
    container.className = 'quiz';

    const title = document.createElement('p');
    title.className = 'quiz__title';
    title.textContent = quiz.title;
    container.appendChild(title);

    const status = document.createElement('p');
    status.className = 'quiz__status';
    status.textContent = `Passing score: ${quiz.passingScore}%`;
    container.appendChild(status);

    const form = document.createElement('form');
    form.addEventListener('submit', (e) => e.preventDefault());

    const answers = new Map();

    quiz.questions.forEach((q, idx) => {
      const qWrap = document.createElement('div');
      qWrap.className = 'quiz__question';

      const qTitle = document.createElement('p');
      qTitle.className = 'quiz__qtitle';
      qTitle.textContent = `${idx + 1}. ${q.question}`;
      qWrap.appendChild(qTitle);

      const name = `q_${idx}`;

      if (q.type === 'true-false') {
        const options = [
          { label: 'True', value: 'true' },
          { label: 'False', value: 'false' },
        ];
        for (const opt of options) {
          const row = document.createElement('label');
          row.className = 'quiz__opt';
          const input = document.createElement('input');
          input.type = 'radio';
          input.name = name;
          input.value = opt.value;
          input.addEventListener('change', () => answers.set(idx, normalizeAnswer(q.type, input.value)));
          const span = document.createElement('span');
          span.textContent = opt.label;
          row.appendChild(input);
          row.appendChild(span);
          qWrap.appendChild(row);
        }
      } else if (q.type === 'multiple-choice') {
        for (const opt of q.options) {
          const row = document.createElement('label');
          row.className = 'quiz__opt';
          const input = document.createElement('input');
          input.type = 'radio';
          input.name = name;
          input.value = opt;
          input.addEventListener('change', () => answers.set(idx, normalizeAnswer(q.type, input.value)));
          const span = document.createElement('span');
          span.textContent = opt;
          row.appendChild(input);
          row.appendChild(span);
          qWrap.appendChild(row);
        }
      } else if (q.type === 'multi-select') {
        const selected = new Set();
        for (const opt of q.options) {
          const row = document.createElement('label');
          row.className = 'quiz__opt';
          const input = document.createElement('input');
          input.type = 'checkbox';
          input.name = name;
          input.value = opt;
          input.addEventListener('change', () => {
            if (input.checked) selected.add(opt);
            else selected.delete(opt);
            answers.set(idx, normalizeAnswer(q.type, Array.from(selected)));
          });
          const span = document.createElement('span');
          span.textContent = opt;
          row.appendChild(input);
          row.appendChild(span);
          qWrap.appendChild(row);
        }
      }

      const explain = document.createElement('div');
      explain.className = 'quiz__explain';
      explain.hidden = true;
      qWrap.appendChild(explain);

      form.appendChild(qWrap);
    });

    const submitRow = document.createElement('div');
    submitRow.style.marginTop = '12px';
    submitRow.style.display = 'flex';
    submitRow.style.gap = '10px';
    submitRow.style.flexWrap = 'wrap';

    const submit = document.createElement('button');
    submit.className = 'button';
    submit.type = 'button';
    submit.textContent = 'Submit';

    const reset = document.createElement('button');
    reset.className = 'button button--ghost';
    reset.type = 'button';
    reset.textContent = 'Reset';

    const result = document.createElement('div');
    result.className = 'notice';
    result.hidden = true;

    submit.addEventListener('click', () => {
      let correct = 0;
      quiz.questions.forEach((q, idx) => {
        const user = answers.get(idx);
        const ok = isCorrect(q, user);
        if (ok) correct += 1;

        const qNode = form.querySelectorAll('.quiz__question')[idx];
        const explain = qNode.querySelector('.quiz__explain');
        explain.hidden = false;
        explain.textContent = `${ok ? 'Correct.' : 'Not quite.'} ${q.explanation}`;
      });

      const total = quiz.questions.length;
      const pct = Math.round((correct / total) * 100);
      const passed = pct >= quiz.passingScore;

      result.hidden = false;
      result.className = `notice ${passed ? '' : 'notice--warn'}`;
      result.textContent = `Score: ${pct}% (${correct}/${total}). ${passed ? 'Passed.' : 'Not passed.'}`;

      if (passed && slug) {
        setProgress(slug, true);
        document.dispatchEvent(new CustomEvent('aihub:progress'));
      }
    });

    reset.addEventListener('click', () => {
      el.innerHTML = '';
      mountQuiz(el, quizFilename, slug);
    });

    submitRow.appendChild(submit);
    submitRow.appendChild(reset);

    form.appendChild(submitRow);
    form.appendChild(result);

    container.appendChild(form);

    el.innerHTML = '';
    el.appendChild(container);
  };

  void doLoad();
}

function inferSlug() {
  const params = new URLSearchParams(window.location.search);
  return params.get('t') || '';
}

function mountAll(root = document, slug = inferSlug()) {
  const nodes = Array.from(root.querySelectorAll('[data-quiz]'));
  for (const node of nodes) {
    const filename = node.getAttribute('data-quiz');
    if (!filename) continue;
    mountQuiz(node, filename, slug);
  }
}

window.aihubQuizEngine = { mountAll };

document.addEventListener('aihub:contentRendered', (e) => {
  const root = e.detail?.root || document;
  const slug = e.detail?.slug || inferSlug();
  mountAll(root, slug);
});

// In case quizzes exist in initial DOM (rare)
document.addEventListener('DOMContentLoaded', () => mountAll(document, inferSlug()));

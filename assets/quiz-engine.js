/* Quiz Engine — static, no backend
   - Loads quiz JSON via fetch
   - Supports: multiple-choice, multi-select, true-false
   - Stores pass status in localStorage per tutorial slug
*/
(function(){
  const LS = {
    get(key, fallback){
      try{
        const raw = localStorage.getItem(key);
        if(raw == null) return fallback;
        return JSON.parse(raw);
      }catch{ return fallback; }
    },
    set(key, value){
      try{ localStorage.setItem(key, JSON.stringify(value)); }catch{}
    }
  };

  function h(tag, attrs={}, children=[]){
    const el = document.createElement(tag);
    for(const [k,v] of Object.entries(attrs)){
      if(k === "class") el.className = v;
      else if(k.startsWith("on") && typeof v === "function") el.addEventListener(k.slice(2), v);
      else if(v === true) el.setAttribute(k, "");
      else if(v !== false && v != null) el.setAttribute(k, String(v));
    }
    for(const c of children){
      if(c == null) continue;
      if(typeof c === "string") el.appendChild(document.createTextNode(c));
      else el.appendChild(c);
    }
    return el;
  }

  function normalizeQuiz(q){
    if(!q || !Array.isArray(q.questions)) throw new Error("Invalid quiz format.");
    if(typeof q.passingScore !== "number") q.passingScore = 70;
    return q;
  }

  function renderQuiz(mount, quizData, opts){
    const quiz = normalizeQuiz(quizData);
    const state = { answers: new Map() };
    const root = h("div", {class:"quiz"});

    const title = h("div", {class:"quiz__title"}, [quiz.title || "Quiz"]);
    const badge = h("span", {class:"quiz__badge", style:"display:none; margin-left:10px;"}, [""]);
    const titleRow = h("div", {style:"display:flex; align-items:center; justify-content:space-between; gap:10px;"}, [ title, badge ]);

    const questionsWrap = h("div", {});
    const explainRefs = [];

    function setBadge(passed, score){
      badge.style.display = "inline-flex";
      badge.className = "quiz__badge " + (passed ? "quiz__badge--pass" : "quiz__badge--fail");
      badge.textContent = (passed ? "Passed" : "Not passed") + " • " + score + "%";
    }

    function renderQuestion(q, idx){
      const qWrap = h("div", {class:"quiz__q"});
      qWrap.appendChild(h("h3", {}, [`${idx+1}. ${q.question || ""}`]));

      const type = q.type || "multiple-choice";
      const options = Array.isArray(q.options) ? q.options : null;

      if(type === "true-false"){
        const optsTF = ["True","False"];
        const name = `q_${idx}`;
        optsTF.forEach((label, i) => {
          const val = i === 0;
          const input = h("input", {type:"radio", name, value: String(val)});
          input.addEventListener("change", () => state.answers.set(idx, val));
          qWrap.appendChild(h("label", {class:"quiz__opt"}, [input, h("span", {}, [label])]));
        });
      } else if(type === "multi-select"){
        if(!options) throw new Error("multi-select requires options[]");
        options.forEach((label, i) => {
          const input = h("input", {type:"checkbox", value:String(i)});
          input.addEventListener("change", () => {
            const cur = state.answers.get(idx) || [];
            const set = new Set(cur);
            if(input.checked) set.add(i); else set.delete(i);
            state.answers.set(idx, Array.from(set).sort((a,b)=>a-b));
          });
          qWrap.appendChild(h("label", {class:"quiz__opt"}, [input, h("span", {}, [label])]));
        });
      } else {
        if(!options) throw new Error("multiple-choice requires options[]");
        const name = `q_${idx}`;
        options.forEach((label, i) => {
          const input = h("input", {type:"radio", name, value:String(i)});
          input.addEventListener("change", () => state.answers.set(idx, i));
          qWrap.appendChild(h("label", {class:"quiz__opt"}, [input, h("span", {}, [label])]));
        });
      }

      const explain = h("div", {class:"quiz__explain", style:"display:none;"});
      qWrap.appendChild(explain);
      explainRefs.push(explain);

      return qWrap;
    }

    quiz.questions.forEach((q, idx) => questionsWrap.appendChild(renderQuestion(q, idx)));

    const result = h("div", {class:"quiz__result"});
    const btnSubmit = h("button", {class:"btn btn--sm"}, ["Submit"]);
    const btnReset = h("button", {class:"btn btn--ghost btn--sm"}, ["Reset"]);

    function computeScore(){
      let correct = 0;
      const total = quiz.questions.length || 1;
      quiz.questions.forEach((q, idx) => {
        const user = state.answers.get(idx);
        const type = q.type || "multiple-choice";
        let ok = false;
        if(type === "true-false"){
          ok = typeof user === "boolean" && user === q.answer;
        } else if(type === "multi-select"){
          const ans = Array.isArray(q.answer) ? q.answer.slice().sort((a,b)=>a-b) : [];
          const usr = Array.isArray(user) ? user.slice().sort((a,b)=>a-b) : [];
          ok = ans.length === usr.length && ans.every((v,i)=>v===usr[i]);
        } else {
          ok = typeof user === "number" && user === q.answer;
        }
        if(ok) correct++;
      });
      return {correct, total, pct: Math.round((correct/total)*100)};
    }

    function markComplete(slug){
      if(!slug) return;
      const key = "aihub.progress";
      const prog = LS.get(key, {});
      prog[slug] = true;
      LS.set(key, prog);
      document.dispatchEvent(new CustomEvent("aihub:progress", {detail:{slug, done:true}}));
    }

    btnSubmit.addEventListener("click", () => {
      const {correct, total, pct} = computeScore();
      const passed = pct >= quiz.passingScore;
      setBadge(passed, pct);

      result.innerHTML = "";
      result.appendChild(h("div", {}, [`Score: `, h("strong", {}, [`${pct}%`]), ` (${correct}/${total}) • Passing: ${quiz.passingScore}%`]));

      quiz.questions.forEach((q, idx) => {
        const explain = explainRefs[idx];
        const type = q.type || "multiple-choice";
        const user = state.answers.get(idx);

        let ok = false;
        if(type === "true-false"){
          ok = typeof user === "boolean" && user === q.answer;
        } else if(type === "multi-select"){
          const ans = Array.isArray(q.answer) ? q.answer.slice().sort((a,b)=>a-b) : [];
          const usr = Array.isArray(user) ? user.slice().sort((a,b)=>a-b) : [];
          ok = ans.length === usr.length && ans.every((v,i)=>v===usr[i]);
        } else {
          ok = typeof user === "number" && user === q.answer;
        }

        explain.style.display = "block";
        explain.innerHTML = "";
        explain.appendChild(h("div", {}, [h("strong", {}, [ok ? "Correct. " : "Not quite. "]), (q.explanation || "Review and try again.")]));
      });

      if(passed) markComplete(opts && opts.tutorialSlug);
    });

    btnReset.addEventListener("click", () => {
      state.answers = new Map();
      badge.style.display = "none";
      result.textContent = "";
      explainRefs.forEach(e => { e.style.display = "none"; e.textContent = ""; });
      root.querySelectorAll("input").forEach(i => { i.checked = false; });
    });

    root.appendChild(titleRow);
    root.appendChild(questionsWrap);
    root.appendChild(h("div", {class:"quiz__actions"}, [btnSubmit, btnReset, result]));
    mount.innerHTML = "";
    mount.appendChild(root);
  }

  async function mountQuizzesWithin(container, tutorialSlug){
    const mounts = container.querySelectorAll("[data-quiz]");
    for(const m of mounts){
      const file = m.getAttribute("data-quiz");
      if(!file) continue;
      try{
        const resp = await fetch("quizzes/" + file, {cache:"no-store"});
        if(!resp.ok) throw new Error("Quiz not found: " + file);
        const data = await resp.json();
        renderQuiz(m, data, {tutorialSlug});
      }catch(err){
        m.innerHTML = "";
        const msg = (err && err.message) ? err.message : String(err);
        m.appendChild(document.createTextNode("Quiz unavailable: " + msg));
      }
    }
  }

  window.AIHubQuiz = { renderQuiz, mountQuizzesWithin };
})();
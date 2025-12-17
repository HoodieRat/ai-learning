# AI Learning Hub (GitHub Pages Template)

This is a static tutorial site template (HTML/CSS/JS) designed for GitHub Pages.

## Add a tutorial
1) Copy `tutorials/tutorial-template.html` → `tutorials/<slug>.html`
2) Add an entry to `tutorials.json` with the same `slug`
3) Optional: add `quizzes/<slug>.quiz.json` and reference it in the tutorial via:
   `<div class="quizMount" data-quiz="<slug>.quiz.json"></div>`

## Progress tracking
- Quiz passes and checklists are saved locally in your browser (localStorage).

## GitHub button
- To set the GitHub button URL quickly, open DevTools console and run:
  `localStorage.setItem('aihub.github', JSON.stringify('https://github.com/<you>/<repo>'))`

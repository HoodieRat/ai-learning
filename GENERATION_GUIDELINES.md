# Generation Guidelines

This repository is intentionally **catalog-driven**:

- `data/tutorials.json` is the single source of truth for tutorials.
- `data/paths.json` is the single source of truth for learning paths.
- `tutorials/<slug>.html` contains tutorial content.
- `quizzes/<file>.quiz.json` contains quiz content.

Non-negotiable requirements

1. Every tutorial must include a **Practice Lab** section.
   - Concrete task
   - Written success criteria (no UI checkboxes)
   - A verification step that does not require paid tools

2. Foundations tutorial for each category has an attached quiz (6+ questions, passingScore 70).
   - Tutorial HTML must include a mount element:
     `<div data-quiz="the-file.quiz.json"></div>`

3. Draft tutorials remain hidden unless “Show drafts” is enabled.

4. Missing tutorial HTML must never hard-error.
   - Render an in-app Coming Soon view.

5. No broken quiz UI on quiz-less tutorials.
   - Only mount quiz UI when `[data-quiz]` exists.

Operational conventions

- Slug equals filename without `.html` (example: `tutorials/ai-101-what-models-do.html`).
- Cross-links inside tutorials should use `?t=<slug>`.
- Quizzes are fetched from `/quizzes/<filename>`.
- Passing a quiz sets `localStorage.aihub.progress[slug] = true` and dispatches `aihub:progress`.
# Generation Guidelines

These files define how the AI Learning Hub content and catalog are produced.

## Goals

- Catalog-driven: `data/tutorials.json` is the single source of truth.
- Resilient: missing tutorial HTML must never crash the app; show an in-app Coming Soon.
- Teach, not demo: every tutorial includes a **Practice Lab** section with a concrete task, success criteria, and a verify step that does not require paid tools.
- Curriculum depth: each category has a 4-step progression (Foundations → Hands-on → Pitfalls → Capstone).
- Quizzes: at least one quiz per category attached to the Foundations tutorial.

## Content rules

- Avoid filler. Prefer short-but-real over long generic text.
- Use consistent structure across tutorials:
  - Overview
  - Prereqs / Next / Related (with `?t=<slug>` links)
  - Practice Lab (task + success criteria + verify)
  - Failure modes (common pitfalls)
- Use “Practice Lab(s)” wording everywhere (avoid the term entirely).

## Catalog rules

`tutorials.json` entries must include:

- `slug`, `title`, `description`, `category`, `difficulty`, `minutes`, `status`

Optional fields used by the app:

- `featured`, `tags`, `quiz`, `prereqs`, `next`, `related`, `path`, `orderInPath`, `created`

## Quizzes

Quiz JSON format:

- `title` (string)
- `passingScore` (number, 70)
- `questions` (array, 6+)

Each question:

- `type`: `multiple-choice` | `true-false` | `multi-select`
- `question` (string)
- `options` (array, when applicable)
- `answer` (string|boolean|string[])
- `explanation` (string)

Tutorial HTML must include a mount element when a quiz exists:

```html
<div data-quiz="the-file.quiz.json"></div>
```

## Generator

Run the generator whenever you change tutorial definitions:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\generate-content.ps1
```

It writes:

- `data/tutorials.json`
- `data/paths.json`
- `tutorials/*.html`
- `quizzes/*.quiz.json`

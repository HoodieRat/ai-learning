# Generation TODO

Status snapshot for this generator run:

- [ ] Build `data/tutorials.json` for all required tutorials + depth requirements
- [ ] Build `data/paths.json` (6 paths, 8–14 lessons each)
- [ ] Generate tutorial HTML pages (Practice Lab everywhere)
- [ ] Generate quizzes (12 total, 6+ questions each)
- [ ] Validate routing, drafts toggle, Coming Soon, quiz engine, progress persistence
# Generation TODO

This file is the human-readable tracking list for keeping the project coherent.

## Must stay true

- `data/tutorials.json` is the single source of truth.
- Draft tutorials are hidden unless “Show drafts” is enabled.
- Missing HTML for published tutorials shows Coming Soon (no hard errors).
- Every tutorial includes a Practice Lab section.
- At least 1 quiz per category (12 total), attached to Foundations tutorial.

## When adding a new tutorial

1. Add it to the generator list in `scripts/generate-content.ps1`.
2. Ensure `category` matches the allowed categories.
3. Set sequencing: `prereqs`, `next`, `related`, `path`, `orderInPath`.
4. Decide quiz:
   - Foundations tutorials should have a quiz.
   - Others can be quiz-less.
5. Run the generator.
6. Smoke-check: open the site, search, navigate, take a quiz.

## Known required files

- Quizzes (must exist):
  - `quizzes/ai-101-what-models-do.quiz.json`
  - `quizzes/cpu-vs-gpu-vs-npu.quiz.json`
  - `quizzes/prompting-structure-quickstart.quiz.json`
  - `quizzes/rag-basics-chunking-retrieval.quiz.json`
  - `quizzes/coding-ai-workflow-and-guardrails.quiz.json`

## Next improvements (optional)

- Add minimal automated validation script for quiz/tutorial shape.
- Add a lightweight dev server script for local preview.

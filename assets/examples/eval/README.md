# Evaluation sample assets

- rubric.md: coverage/factuality/tone/safety rubric for summaries
- metric_eval.py: simple key-presence checker (stdin JSON)
- judge_eval.py: stub judge output; replace with your LLM call

Example:
cat outputs.json | python assets/examples/eval/metric_eval.py
cat outputs.json | python assets/examples/eval/judge_eval.py

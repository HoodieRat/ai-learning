# Tiny RAG sample assets

Contents:
- `corpus/`: three markdown docs (PTO, expenses, remote work)
- `qa.csv`: 6 evaluation questions with expected citations
- `rag_quickstart.py`: builds a Chroma store and answers sample questions
- `rag_eval.py`: runs the QA set and reports pass/fail with citations

Setup (PowerShell):
```
python -m venv .rag-venv
.\.rag-venv\Scripts\Activate.ps1
pip install "langchain>=0.2" "langchain-community>=0.2" chromadb sentence-transformers
```
(Optional) OpenAI fallback:
```
$env:USE_OPENAI="1"; $env:OPENAI_API_KEY="sk-..."; pip install openai langchain-openai
```
Run quickstart:
```
python assets/examples/rag/rag_quickstart.py
```
Run eval:
```
python assets/examples/rag/rag_eval.py
```
Switch LLM (local Ollama):
```
$env:OLLAMA_MODEL="llama3:8b"
```
Clean vector store:
```
Remove-Item -Recurse -Force assets/examples/rag/.chroma
```

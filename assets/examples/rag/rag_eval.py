"""Tiny RAG evaluation over the sample corpus and qa.csv.

Assumes the same environment as rag_quickstart.py and uses the same prompt/chain.
Outputs per-question correctness and a summary accuracy.
"""

import csv
from pathlib import Path

from rag_quickstart import build_chain

BASE_DIR = Path(__file__).parent
QA_FILE = BASE_DIR / "qa.csv"


def load_qa():
    with QA_FILE.open(newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        return list(reader)


def main():
    chain = build_chain()
    qa_rows = load_qa()
    total = len(qa_rows)
    correct = 0
    for row in qa_rows:
        q = row["question"].strip()
        expected_cite = row["citation"].strip()
        result = chain(q)
        answer = result["result"].strip().lower()
        cites = " | ".join(sorted({doc.metadata.get("source", "?") for doc in result["source_documents"]}))
        hit = expected_cite.lower().split(":")[0] in answer or expected_cite.lower() in answer or expected_cite.lower() in cites.lower()
        correct += 1 if hit else 0
        print("---")
        print("Q:", q)
        print("A:", answer)
        print("Expected cite:", expected_cite)
        print("Observed cites:", cites)
        print("Pass:" if hit else "Fail:", "hit expected citation" if hit else "citation missing or wrong")
    acc = correct / total * 100 if total else 0
    print(f"\nSummary: {correct}/{total} correct ({acc:.1f}%)")


if __name__ == "__main__":
    main()

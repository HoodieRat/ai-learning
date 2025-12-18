import json, sys
from datetime import datetime

RUBRIC = {
    "coverage": "Score 0-2: product, issue, impact, next_step present?",
    "factuality": "Score 0-2: no invented facts; aligns to source.",
    "tone": "Score 0-1: neutral/professional.",
    "safety": "Score 0-1: no promises not in source."
}

def main():
    data = json.load(sys.stdin)
    for item in data:
        print({
            "id": item.get("id"),
            "timestamp": datetime.utcnow().isoformat(),
            "coverage": 2,
            "factuality": 2,
            "tone": 1,
            "safety": 1,
            "notes": "stub scores; replace with LLM judge call"
        })

if __name__ == "__main__":
    main()

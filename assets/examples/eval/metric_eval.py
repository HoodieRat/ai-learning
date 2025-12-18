import json, sys

def main():
    data = json.load(sys.stdin)
    passed = 0
    total = 0
    for item in data:
        total += 1
        ok = all(k in item.get("json", {}) for k in ("product","issue","impact","next_step"))
        if ok:
            passed += 1
        print({"id": item.get("id"), "pass": ok})
    print(f"Metrics pass rate: {passed}/{total}")

if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""Validate the published PediaQ question bank without external dependencies."""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
questions = json.loads((ROOT / "questions.json").read_text(encoding="utf-8"))
assert isinstance(questions, list) and questions, "Question bank must be nonempty"
ids = set()
illustrated = []
missing = []
for q in questions:
    qid = q["id"]
    assert qid not in ids, f"Duplicate question ID: {qid}"
    ids.add(qid)
    assert isinstance(q.get("ja"), str) and q["ja"].strip(), qid
    assert isinstance(q.get("en"), str) and q["en"].strip(), qid
    assert isinstance(q.get("options"), list) and len(q["options"]) == 4, qid
    assert type(q.get("correct")) is int and 0 <= q["correct"] < 4, qid
    assert all(isinstance(o.get("ja"), str) and isinstance(o.get("en"), str) for o in q["options"]), qid
    comic = q.get("comic")
    if comic:
        path = (ROOT / comic).resolve()
        assert path.is_relative_to(ROOT.resolve()), f"Comic path escapes repository: {qid}"
        assert path.is_file() and path.stat().st_size > 10000, f"Missing or invalid comic: {qid}"
        illustrated.append(qid)
    else:
        missing.append(qid)
    if qid.startswith("AUTO-"):
        assert comic, f"Automatically generated question must have a manga: {qid}"
print(f"Validated {len(questions)} questions; {len(illustrated)} manga assets; {len(missing)} legacy questions awaiting manga")
if missing:
    print("Legacy questions without manga:", ", ".join(missing))

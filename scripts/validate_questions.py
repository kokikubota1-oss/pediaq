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
    for i, opt in enumerate(q["options"]):
        assert isinstance(opt.get("whyja"), str) and len(opt["whyja"]) >= 20, f"Missing Japanese option rationale: {qid} {i}"
        assert isinstance(opt.get("whyen"), str) and len(opt["whyen"]) >= 20, f"Missing English option rationale: {qid} {i}"
    comic = q.get("comic")
    if comic:
        path = (ROOT / comic).resolve()
        assert path.is_relative_to(ROOT.resolve()), f"Comic path escapes repository: {qid}"
        assert path.is_file() and path.stat().st_size > 10000, f"Missing or invalid comic: {qid}"
        illustrated.append(qid)
    else:
        missing.append(qid)
    images = q.get("images")
    if images is not None:
        assert isinstance(images, list) and len(images) == 4, f"Four images required: {qid}"
        for img in images:
            assert all(img.get(k) for k in ("url", "source", "license", "creator")), f"Missing attribution: {qid}"
            assert img["url"].startswith("https://") and img["source"].startswith("https://"), qid
    if qid.startswith("AUTO-"):
        assert comic or images, f"Generated question needs attributed images or manga: {qid}"
print(f"Validated {len(questions)} questions; {len(illustrated)} manga assets; {len(missing)} legacy questions awaiting manga")
if missing:
    print("Legacy questions without manga:", ", ".join(missing))

#!/usr/bin/env python3
"""
EnigmaPath question-bank tool (standard library only).

Source of truth: data/questions/level-01.json ... level-10.json
Each file is a JSON list of questions:
  {"question_text": str, "options": [4 strings], "correct_answer_index": 0-3,
   "term_category": "Term 1" | "Term 2" | "Term 3"}

Commands:
  python3 tools/questions_tool.py merge [N ...]    merge data/questions/_parts/LNN-*.json into level-NN.json
                                                    (parts are appended to the level file, then deleted)
  python3 tools/questions_tool.py validate [N ...] validate all levels (or only the given level numbers)
  python3 tools/questions_tool.py build            validate, then write quiz/data/questions.js
"""
from __future__ import annotations

import json
import re
import sys
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
QDIR = ROOT / "data" / "questions"
PARTS = QDIR / "_parts"
OUT_JS = ROOT / "quiz" / "data" / "questions.js"
LEVELS = list(range(1, 11))
TERMS = ("Term 1", "Term 2", "Term 3")
MIN_PER_LEVEL = 100
KEYS = {"question_text", "options", "correct_answer_index", "term_category"}
BANNED = re.compile(r"\b(all|none|both) of the (above|these)\b|\ball the above\b", re.I)


def level_file(n: int) -> Path:
    return QDIR / "level-{:02d}.json".format(n)


def load(n: int):
    path = level_file(n)
    if not path.exists():
        return None
    return json.loads(path.read_text(encoding="utf-8"))


def norm(text: str) -> str:
    return re.sub(r"\s+", " ", re.sub(r"[^a-z0-9 ]+", " ", text.lower())).strip()


def validate(levels=None, strict_new=True):
    errors, warnings = [], []
    seen = {}
    levels = levels or LEVELS
    for n in LEVELS:
        data = load(n)
        if data is None:
            if n in levels:
                errors.append("level {}: file missing".format(n))
            continue
        if not isinstance(data, list):
            errors.append("level {}: must be a list".format(n))
            continue
        for i, q in enumerate(data, 1):
            tag = "L{} #{}".format(n, i)
            if not isinstance(q, dict) or set(q) != KEYS:
                errors.append("{}: bad keys {}".format(tag, sorted(q) if isinstance(q, dict) else type(q)))
                continue
            text = q["question_text"]
            opts = q["options"]
            idx = q["correct_answer_index"]
            if not isinstance(text, str) or len(text.strip()) < 8:
                errors.append("{}: question_text too short/not a string".format(tag))
                continue
            if not (isinstance(opts, list) and len(opts) == 4 and all(isinstance(o, str) and o.strip() for o in opts)):
                errors.append("{}: needs exactly 4 non-empty string options".format(tag))
                continue
            if not (isinstance(idx, int) and not isinstance(idx, bool) and 0 <= idx < 4):
                errors.append("{}: correct_answer_index must be 0-3".format(tag))
                continue
            if q["term_category"] not in TERMS:
                errors.append("{}: term_category must be one of {}".format(tag, TERMS))
            if len({re.sub(r"\s+", " ", o.strip().lower()) for o in opts}) != 4:
                errors.append("{}: duplicate options: {}".format(tag, opts))
            if BANNED.search(" ".join(opts)):
                errors.append("{}: uses 'all/none of the above' style option".format(tag))
            key = norm(text)
            if key in seen and seen[key] != tag:
                (errors if n in levels else warnings).append("{}: duplicate of {} ({})".format(tag, seen[key], text[:60]))
            else:
                seen[key] = tag
        if n in levels:
            if len(data) < MIN_PER_LEVEL:
                errors.append("level {}: only {} questions (need {})".format(n, len(data), MIN_PER_LEVEL))
            terms = Counter(q.get("term_category") for q in data if isinstance(q, dict))
            for t in TERMS:
                if terms[t] < 0.2 * len(data):
                    warnings.append("level {}: few {} questions ({})".format(n, t, terms[t]))
            pos = Counter(q.get("correct_answer_index") for q in data if isinstance(q, dict))
            if n > 3 and strict_new and pos and max(pos.values()) > 0.4 * len(data):
                warnings.append("level {}: correct answer positions are lopsided {}".format(n, dict(pos)))
            longest = sum(
                1 for q in data
                if isinstance(q, dict) and isinstance(q.get("options"), list) and len(q["options"]) == 4
                and isinstance(q.get("correct_answer_index"), int) and 0 <= q["correct_answer_index"] < 4
                and len(q["options"][q["correct_answer_index"]]) == max(len(o) for o in q["options"])
            )
            if data and longest > 0.5 * len(data):
                warnings.append("level {}: the correct answer is the longest option in {}/{} questions (bias)".format(n, longest, len(data)))
    return errors, warnings


def cmd_merge(only=None):
    for n in only or LEVELS:
        parts = sorted(PARTS.glob("L{:02d}-*.json".format(n)))
        if not parts:
            continue
        data = load(n) or []
        for p in parts:
            chunk = json.loads(p.read_text(encoding="utf-8"))
            data.extend(chunk)
            print("level {}: +{} from {}".format(n, len(chunk), p.name))
        level_file(n).write_text(json.dumps(data, indent=1, ensure_ascii=False) + "\n", encoding="utf-8")
        for p in parts:
            p.unlink()
        print("level {}: now {} questions".format(n, len(data)))


def report(errors, warnings):
    for w in warnings:
        print("WARN  " + w)
    for e in errors:
        print("ERROR " + e)
    print("{} error(s), {} warning(s)".format(len(errors), len(warnings)))


def cmd_build():
    errors, warnings = validate()
    report(errors, warnings)
    if errors:
        sys.exit(1)
    bank = {}
    for n in LEVELS:
        bank["level{}".format(n)] = load(n)
    OUT_JS.parent.mkdir(parents=True, exist_ok=True)
    OUT_JS.write_text(
        "/* Generated by tools/questions_tool.py build. Do not edit by hand. */\n"
        "window.QUESTION_BANK = " + json.dumps(bank, ensure_ascii=False, separators=(",", ":")) + ";\n",
        encoding="utf-8",
    )
    print("wrote {} ({} questions)".format(OUT_JS.relative_to(ROOT), sum(len(v) for v in bank.values())))


def main():
    cmd = sys.argv[1] if len(sys.argv) > 1 else "validate"
    if cmd == "merge":
        cmd_merge([int(a) for a in sys.argv[2:]] or None)
    elif cmd == "validate":
        lv = [int(a) for a in sys.argv[2:]] or None
        errors, warnings = validate(lv)
        report(errors, warnings)
        sys.exit(1 if errors else 0)
    elif cmd == "build":
        cmd_build()
    else:
        print(__doc__)
        sys.exit(2)


if __name__ == "__main__":
    main()

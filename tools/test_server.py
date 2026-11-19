#!/usr/bin/env python3
"""API tests for server.py. Uses a temporary folder, so real exams/results are untouched.
Run: python3 tools/test_server.py"""
import csv
import io
import json
import sys
import tempfile
import threading
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
import server  # noqa: E402

tmp = Path(tempfile.mkdtemp(prefix="enigmapath-test-"))
server.EXAMS_DIR = tmp / "exams"
server.RESULTS_DIR = tmp / "results"
httpd = server.make_server("127.0.0.1", 0)
PORT = httpd.server_address[1]
threading.Thread(target=httpd.serve_forever, daemon=True).start()
BASE = "http://127.0.0.1:%d" % PORT

failures = 0


def call(method, path, body=None):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(BASE + path, data=data, method=method, headers={"Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req) as r:
            raw = r.read()
            return r.status, (json.loads(raw) if r.headers.get_content_type() == "application/json" else raw.decode())
    except urllib.error.HTTPError as e:
        raw = e.read()
        try:
            return e.code, json.loads(raw)
        except ValueError:
            return e.code, raw.decode()


def check(name, cond, extra=""):
    global failures
    if cond:
        print("ok  ", name)
    else:
        failures += 1
        print("FAIL", name, extra)


MAZE = {"name": "Tiny", "map": ["#####", "#S.G#", "#####"], "dir": "E"}
EXAM = {
    "id": "unit-test-exam", "title": "Unit test exam", "description": "", "reveal": "wrong",
    "items": [
        {"type": "question", "id": "q1", "text": "2+2?", "options": ["3", "4", "5", "6"], "correct": 1},
        {"type": "maze", "id": "m1", "title": "Tiny maze", "intro": "Look", "maze": MAZE, "questions": [
            {"id": "m1a", "text": "Fewest instructions?", "options": ["1", "2", "3"], "correct": 1, "auto": "fewestInstructions"},
            {"id": "m1b", "text": "Turns?", "options": ["0", "1"], "correct": 0},
        ]},
    ],
}

s, r = call("POST", "/api/exams", EXAM)
check("save valid exam", s == 200 and r.get("questions") == 3, r)
bad = json.loads(json.dumps(EXAM)); bad["items"][0]["correct"] = 9
check("reject correct index out of range", call("POST", "/api/exams", bad)[0] == 400)
bad = json.loads(json.dumps(EXAM)); bad["items"][0]["options"] = ["a", "A", "b"]
check("reject duplicate options", call("POST", "/api/exams", bad)[0] == 400)
bad = json.loads(json.dumps(EXAM)); bad["items"][1]["maze"]["map"] = ["#####", "#S.##", "#####"]
check("reject maze without goal", call("POST", "/api/exams", bad)[0] == 400)
bad = json.loads(json.dumps(EXAM)); bad["id"] = "../evil"
check("reject bad id", call("POST", "/api/exams", bad)[0] == 400)

s, r = call("GET", "/api/exams")
check("list has the exam", s == 200 and [e["id"] for e in r["exams"]] == ["unit-test-exam"] and r["exams"][0]["questions"] == 3, r)
s, r = call("GET", "/api/exams/unit-test-exam")
check("teacher view has the answer key", s == 200 and r["items"][0]["correct"] == 1)
s, r = call("GET", "/api/exams/unit-test-exam/student")
text = json.dumps(r)
check("student view hides answers", s == 200 and '"correct"' not in text and '"auto"' not in text, text[:200])
check("student view keeps questions and maze", len(r["items"]) == 2 and r["items"][1]["maze"]["map"])

# students answer: q1 right (original index 1), m1a wrong (0), m1b unanswered
sub = {
    "examId": "unit-test-exam", "student": "Ada Lovelace", "grade": 7, "startedAt": "2026-01-01 10:00:00", "durationSec": 61,
    "answers": [
        {"qid": "q1", "chosen": 1, "order": [2, 1, 0, 3], "position": 2},
        {"qid": "m1a", "chosen": 0, "order": [1, 0, 2], "position": 3},
        {"qid": "m1b", "chosen": None, "order": [0, 1], "position": 1},
    ],
}
s, r = call("POST", "/api/submit", sub)
check("submit graded", s == 200 and r["score"] == 1 and r["total"] == 3 and abs(r["percent"] - 33.3) < 0.1, r)
check("reveal=wrong lists only wrong/unanswered questions", sorted(a["n"] for a in r["review"]) == [2, 3], r["review"])
check("review gives the correct text", {a["n"]: a["correctText"] for a in r["review"]} == {2: "2", 3: "0"})
for bad_sub in ({**sub, "student": ""}, {**sub, "grade": 2}, {**sub, "grade": 13}, {**sub, "examId": "nope"}):
    check("reject bad submission %s/%s" % (bad_sub["student"], bad_sub["grade"]), call("POST", "/api/submit", bad_sub)[0] in (400, 404))

s, r = call("GET", "/api/results")
check("result stored", s == 200 and len(r["results"]) == 1 and r["results"][0]["student"] == "Ada Lovelace")
rec = r["results"][0]
check("result lists wrong questions with chosen/correct text", [(a["n"], a["chosenText"], a["correctText"]) for a in rec["answers"] if not a["isCorrect"]] == [(2, "1", "2"), (3, None, "0")], rec["answers"])
files = list((server.RESULTS_DIR / "unit-test-exam").glob("*.json"))
check("one json file per attempt", len(files) == 1)
rows = list(csv.DictReader(io.StringIO((server.RESULTS_DIR / "results.csv").read_text(encoding="utf-8-sig"))))
check("csv row", len(rows) == 1 and rows[0]["student"] == "Ada Lovelace" and rows[0]["wrong_questions"] == "Q2" and rows[0]["unanswered_questions"] == "Q3" and rows[0]["grade"] == "7", rows)
s, text = call("GET", "/api/results.csv")
check("csv endpoint", s == 200 and "Ada Lovelace" in text)

# reveal modes
for mode, expect in (("score", 0), ("all", 3)):
    e = json.loads(json.dumps(EXAM)); e["id"] = "mode-" + mode; e["reveal"] = mode
    call("POST", "/api/exams", e)
    s, r = call("POST", "/api/submit", {**sub, "examId": e["id"]})
    check("reveal=%s -> %d review rows" % (mode, expect), s == 200 and len(r["review"]) == expect, r)

# import
imp = dict(rec); imp["id"] = "imported-1"; imp["student"] = "Grace Hopper"
s, r = call("POST", "/api/results/import", {"results": [imp, imp, {"nonsense": True}]})
check("import adds once, skips dup, flags invalid", s == 200 and (r["added"], r["skipped"], r["invalid"]) == (1, 1, 1), r)
s, r = call("GET", "/api/results?exam=unit-test-exam")
check("filter by exam", {x["student"] for x in r["results"]} == {"Ada Lovelace", "Grace Hopper"})

# delete
s, r = call("DELETE", "/api/results/imported-1")
check("delete result", s == 200 and len(call("GET", "/api/results?exam=unit-test-exam")[1]["results"]) == 1)
check("csv rewritten after delete", "Grace Hopper" not in (server.RESULTS_DIR / "results.csv").read_text(encoding="utf-8-sig"))
check("delete exam", call("DELETE", "/api/exams/mode-all")[0] == 200 and call("GET", "/api/exams/mode-all")[0] == 404)

# static files and blocked paths
for path, code in (("/index.html", 200), ("/shared/theme.css", 200), ("/server.py", 404), ("/data/exams/unit-test-exam.json", 404), ("/results/results.csv", 404), ("/tools/test_server.py", 404)):
    try:
        with urllib.request.urlopen(BASE + path) as resp:
            got = resp.status
    except urllib.error.HTTPError as e:
        got = e.code
    check("GET %s -> %d" % (path, code), got == code, got)

httpd.shutdown()
print("%d failure(s)" % failures if failures else "server tests passed")
sys.exit(1 if failures else 0)

# EnigmaPath

ICT learning suite: a practice quiz, a robot-programming maze game, a cipher lab, a Tower of Hanoi simulator and a
teacher-made exam with a point-and-click builder. Plain HTML, CSS and JavaScript plus one small Python server for the exam.
Everything is local; nothing needs the internet.

Palette: `#141e2b` `#26394d` `#405B72` `#71899b` `#b2c1c5` `#e8e9e2`
(plus three status colours for correct / wrong / warning, because the palette has no green or red).

## Running it

| What | How |
|---|---|
| Practice Quiz, Guide the Robot, Enigmatica Cipher Lab, Tower of Hanoi | Double-click **`index.html`** and pick a tile. No server needed. |
| Exam, exam builder, results page | Double-click **`start.bat`** (Windows) or **`start.sh`** (Linux/macOS). It starts the server and opens the browser. Needs Python 3. |

To copy EnigmaPath to another computer, copy the whole folder. Each student PC keeps its own `results/` folder.

## The apps

### Practice Quiz (`quiz/`)
Ten levels, chosen by the student; the page never mentions school grades.
Level 1 is the easiest (original age 8-9 content) and Level 10 is the hardest (Cambridge IGCSE ICT 0417 practical-theory topics).
Every level has at least 100 questions (1,033 in total). A run draws a random selection (default 20) with shuffled answers,
shows right/wrong straight after each answer, then a result and a review. Options: difficulty (Easy/Medium/Hard/Mixed),
number of questions, and *Revision* (also draw from earlier levels). Best scores are remembered in the browser.

Level guide: 1-3 primary skills · 4 lower-secondary foundations · 5 binary, networks, algorithms · 6 protocols, HTML, programming ·
7 computer systems and devices (IGCSE) · 8 networks, effects of ICT, applications · 9 systems life cycle, security, communication, files, images ·
10 documents, charts, databases, presentations, spreadsheets, web authoring.

### Guide the Robot (`robot/`)
Orientation mode only: *Forward*, *Turn left*, *Turn right*. 20 hand-checked mazes from 11x11 to 25x27 tiles, all with loops and several
routes. Build the program (buttons or the arrow keys), then Run / Step / Pause / Reset. Levels unlock one after another;
**Teacher mode** (tick the box on the level screen) unlocks everything and can load a shortest program. There is no login.

### Enigmatica Cipher Lab (`cipher/`)
Encrypt, decrypt and crack Caesar and Vigenere ciphers, with illustrated "how it works" pages.

### Tower of Hanoi (`hanoi/`)
3-8 discs, click or drag, undo, hint, auto-solve from any position, move counter against the 2^n-1 minimum, best records, and a short explanation of recursion.

## Exams

### Teacher: building an exam (`exam/builder.html`)
1. Start the server, open the hub, click **Teacher: create an exam** (or go to `exam/builder.html`).
2. **+ New exam**, give it a title and choose what students see at the end (score only / score and wrong answers / full review).
3. Add items:
   * **+ Question**: type the question and 2-6 answers, tick the correct one.
   * **+ Maze with questions**: choose a library maze (loader menu), generate a random one, or draw your own (paint walls, place Start, Goal and the robot's direction). Live statistics show size, fewest instructions, shortest path, loops, dead ends and routes. Then add **automatic questions** (fewest instructions, shortest path, fewest turns, loops, dead ends, number of routes, number of shortest paths, direction after a program, does this program reach the goal?) or **write your own**. Wrong answers for automatic questions are generated; everything stays editable. After changing the maze press *Recalculate automatic questions*.
   * **+ From the practice quiz bank**: tick questions from any of the 10 levels.
4. **Save exam**. Exams are stored as `data/exams/<id>.json`. **Export file** / **Import file** move an exam between computers.

### Students (`exam/index.html`)
They choose the exam, type their **name**, choose their **grade (3-12)** and start. One question per page, no right/wrong feedback until the end,
free navigation and an overview page before submitting. For every student the order of questions and the position of the correct answer are
shuffled, **except** that a maze always stays together with its own questions (so question 1 for one student is another question for the next).
There is no timer. An unfinished exam can be resumed on the same computer. The server grades the answers.

### Results (`exam/results.html`)
Each submission is saved in `results/<exam-id>/<id>.json` (name, grade, score, time, and for every question what was asked, what the student
chose, the correct answer, and whether it was wrong), and one line is appended to `results/results.csv` (open it in Excel/LibreOffice):
`finished_at, exam_id, exam_title, student, grade, score, total, percent, duration_sec, wrong_questions, unanswered_questions, wrong_details`.
The results page lists attempts, filters by exam, grade or name, expands each student's wrong answers, shows per-question statistics, and exports CSV.

**Several computers:** copy each student PC's `results` folder (or just the `.json` files) to the teacher's computer and use **Import result files**.
Duplicates are skipped.

**One teacher PC and a network:** run `python3 server.py --host 0.0.0.0` and let students open `http://<teacher-ip>:8000/exam/index.html`.
Use `--data <folder>` to keep exams and results somewhere else.

## Questions

* Source: `data/questions/level-01.json` ... `level-10.json` (a list per level: `question_text`, 4 `options`, `correct_answer_index`, `term_category` = Term 1/2/3 = easy/medium/hard).
* After editing, run `python3 tools/questions_tool.py build`. It validates (4 distinct options, index in range, no duplicates across levels, at least 100 per level, balanced answer positions and lengths) and regenerates `quiz/data/questions.js`, which is what the quiz loads.
* The writing rules used for the bank are in `tools/QUESTION_BRIEF.md`.

## Mazes

`shared/maze-lib.js` has the robot rules, solver and analysis (also used by the exam). Built-in mazes are in `shared/maze-levels.js`, generated once by
`node tools/gen_mazes.js`; nothing is random at play time. Maze format: `#` wall, `.` floor, `S` start, `G` goal, plus the start direction.

## Tests

```
python3 tools/questions_tool.py validate      # question bank rules
node tools/validate_mazes.js                  # robot rules + all 20 mazes solvable, looped, increasing difficulty
node tools/test_exam_core.js                  # shuffling, automatic questions, validation
node tools/test_hanoi.js                      # Hanoi logic incl. exhaustive optimal-solution check
python3 tools/test_server.py                  # exam server API (uses a temporary folder)
node tools/test_robot_ui.js                   # headless Chromium: plays the robot game
node tools/test_quiz_ui.js                    # headless Chromium: plays the quiz
node tools/test_exam_ui.js                    # headless Chromium: builds an exam, takes it, reads the results
```

## Folder layout

```
index.html            hub                    start.bat / start.sh   exam server launcher
server.py             exam server            shared/                theme, maze library, exam core
quiz/  robot/  cipher/  hanoi/               the apps
exam/                 index.html (student), builder.html, results.html
data/questions/       question bank          data/exams/            saved exams
results/              saved exam results     tools/                 build + test scripts
```

Lucas M.R 2026, with vibes

# EnigmaPath — static edition

A small learning suite made of plain HTML, CSS and JavaScript: a practice quiz, a robot-programming maze game, a cipher lab, a Tower of Hanoi puzzle, four algorithm/maths labs, a fun-fact bank and a password-guessing game.

This edition is made for static hosting. It has **no server, no build step and no backend**. Open `index.html` directly or deploy the repository root to any static host.

## Deploy to Netlify

The repository is Netlify-ready:

1. In Netlify, choose **Add new site → Import an existing project** and select this repository.
2. Leave the build command empty.
3. Set the publish directory to `.` (already set in `netlify.toml`).
4. Deploy.

Every page is served as-is. There is no configuration, database or environment variable to add.

## The exam

The exam is **not included in this static edition**. It needs the local Python server to load exams and save students' results, which a static site cannot do.

Clicking the **Exam** tile on the home page shows the note:

> Exam is only available on local server

Use the separate local server version of EnigmaPath to take or build exams.

## What is inside

| Folder | App |
|---|---|
| `quiz/` | Practice Quiz — eight subjects, ten levels each |
| `robot/` | Guide the Robot — program a route through a maze |
| `cipher/` | Enigmatica Cipher Lab |
| `hanoi/` | Tower of Hanoi |
| `binary-search/` | Binary Search Lab |
| `knights-tour/` | Knight's Tour |
| `graph-color/` | Graph Colouring |
| `huffman/` | Huffman Coding |
| `codebreaker/` | Guess the Password |
| `facts/` | Fun facts |
| `about/` | About the app |
| `shared/` | Theme, footer, maze library and small shared scripts |

## Local preview

Any static file server works, for example:

```sh
python3 -m http.server 8080
```

Then open <http://localhost:8080>. Double-clicking `index.html` also works for most browsers.

---

Lucas M.R 2026, with vibes.

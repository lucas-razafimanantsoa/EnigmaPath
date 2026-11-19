'use strict';
/* End-to-end browser test: teacher builds an exam in the GUI, a student takes it, the teacher sees the result.
 * Starts server.py on a temporary data folder. Run: node tools/test_exam_ui.js */
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { open, sleep } = require('./cdp');

const PORT = 8300 + Math.floor(Math.random() * 500);
const BASE = 'http://127.0.0.1:' + PORT;
const data = fs.mkdtempSync(path.join(os.tmpdir(), 'ep-e2e-'));

(async () => {
  const srv = spawn('python3', [path.resolve(__dirname, '../server.py'), '--port', String(PORT), '--no-browser', '--data', data], { stdio: 'ignore' });
  for (let i = 0; i < 40; i++) { try { await fetch(BASE + '/api/exams'); break; } catch (e) { await sleep(150); } }
  let bad = 0;
  const expect = (name, cond, extra) => { if (!cond) { bad++; console.log('FAIL', name, extra === undefined ? '' : extra); } else console.log('ok  ', name); };

  /* ---------------- teacher builds an exam ---------------- */
  const t = await open(BASE + '/exam/builder.html', 1300, 900);
  expect('builder shows no exams yet', /No exams yet/.test(await t.ev('document.getElementById("list-hint").textContent')));
  await t.click('#btn-new');
  await t.type('#ex-title', 'E2E test exam');
  await t.type('#ex-desc', 'Answer everything.');
  await t.ev('document.getElementById("ex-reveal").value="all";document.getElementById("ex-reveal").dispatchEvent(new Event("change"))');
  // first (blank) question
  await t.type('#items .item:nth-child(1) textarea', 'What is 2 + 2?');
  const opts = ['3', '4', '5', '22'];
  for (let i = 0; i < 4; i++) await t.type('#items .item:nth-child(1) .opt-row:nth-child(' + (i + 1) + ') input[type=text]', opts[i]);
  await t.click('#items .item:nth-child(1) .opt-row:nth-child(2) input[type=radio]');
  // second plain question
  await t.click('#add-q');
  await t.type('#items .item:nth-child(2) textarea', 'Which part is the brain of the computer?');
  const o2 = ['CPU', 'Mouse', 'Monitor', 'Speaker'];
  for (let i = 0; i < 4; i++) await t.type('#items .item:nth-child(2) .opt-row:nth-child(' + (i + 1) + ') input[type=text]', o2[i]);
  // maze block with automatic questions
  await t.click('#add-maze');
  await t.sleep(300);
  expect('maze editor mounted with stats', (await t.ev('document.querySelectorAll("#items .me-stat").length')) >= 6);
  await t.ev('document.querySelector("#items .item:nth-child(3) .auto-row select").value="fewestInstructions"');
  await t.click('#items .item:nth-child(3) .auto-row .btn--primary');
  await t.ev('document.querySelector("#items .item:nth-child(3) .auto-row select").value="loops"');
  await t.click('#items .item:nth-child(3) .auto-row .btn--primary');
  await t.ev('document.querySelector("#items .item:nth-child(3) .auto-row select").value="traceOutcome"');
  await t.click('#items .item:nth-child(3) .auto-row .btn--primary');
  expect('3 automatic questions added', (await t.ev('document.querySelectorAll("#items .item:nth-child(3) .q-block").length')) === 3);
  await t.shot('/tmp/opencode/builder.png', 1300, 1600);
  // library maze 1 expected answers
  const M = require('../shared/maze-lib.js');
  const LV = require('../shared/maze-levels.js')[0];
  const analysis = M.analyze(M.parse(LV.map, LV.dir));

  await t.click('#btn-save');
  await t.sleep(500);
  const saveMsg = await t.ev('document.getElementById("save-msg").textContent');
  expect('saved', /Saved/.test(saveMsg), saveMsg);
  const list = await (await fetch(BASE + '/api/exams')).json();
  expect('exam stored on the server with 5 questions', list.exams.length === 1 && list.exams[0].questions === 5, JSON.stringify(list));
  const full = await (await fetch(BASE + '/api/exams/' + list.exams[0].id)).json();
  const mazeQs = full.items[2].questions;
  expect('stored auto answer = fewest instructions', mazeQs[0].options[mazeQs[0].correct] === String(analysis.fewestInstructions), JSON.stringify(mazeQs[0]));
  expect('stored auto answer = loops', mazeQs[1].options[mazeQs[1].correct] === String(analysis.loops));
  expect('builder errors', t.logs.filter((l) => /EXCEPTION|error/i.test(l)).length === 0, t.logs.join('|'));
  await t.close();

  /* ---------------- student takes it ---------------- */
  const s = await open(BASE + '/exam/index.html', 1200, 900);
  expect('exam appears in the list', (await s.ev('document.getElementById("exam-select").options.length')) === 1);
  await s.click('#start-btn');
  expect('name required', /name/i.test(await s.ev('document.getElementById("start-error").textContent')));
  await s.type('#student-name', 'Test Student');
  await s.click('#start-btn');
  expect('grade required', /grade/i.test(await s.ev('document.getElementById("start-error").textContent')));
  await s.ev('document.getElementById("student-grade").value="8"');
  await s.click('#start-btn');
  expect('question screen', (await s.ev('!document.getElementById("screen-question").hidden')) === true);

  const seenMazes = [];
  const total = 5;
  const picked = [];
  for (let i = 0; i < total; i++) {
    const info = JSON.parse(await s.ev('JSON.stringify({text:document.getElementById("q-text").textContent,opts:[...document.querySelectorAll("#q-options .option")].map(o=>o.textContent.slice(1)),maze:!document.getElementById("maze-panel").hidden,fb:!!document.querySelector(".feedback, .is-correct, .is-incorrect")})'));
    expect('Q' + (i + 1) + ' shows no right/wrong feedback', info.fb === false);
    seenMazes.push(info.maze);
    // answer: choose the true answer for plain questions, option 1 for maze questions
    let idx = 0;
    if (/2 \+ 2/.test(info.text)) idx = info.opts.indexOf('4');
    else if (/brain/.test(info.text)) idx = info.opts.indexOf('CPU');
    else idx = i % 2 === 0 ? 0 : 1;
    picked.push({ text: info.text, idx });
    await s.click('#q-options .option:nth-child(' + (idx + 1) + ')');
    expect('Q' + (i + 1) + ' option stays neutral after choosing', (await s.ev('document.querySelectorAll(".is-correct,.is-incorrect").length')) === 0);
    await s.click('#btn-next');
  }
  // maze questions were consecutive with the maze visible
  const firstMaze = seenMazes.indexOf(true);
  expect('the 3 maze questions are adjacent and show the maze', seenMazes.slice(firstMaze, firstMaze + 3).every(Boolean) && seenMazes.filter(Boolean).length === 3, JSON.stringify(seenMazes));
  expect('overview screen', (await s.ev('!document.getElementById("screen-overview").hidden')) === true);
  await s.shot('/tmp/opencode/exam-overview.png');
  await s.click('#ov-submit');
  await s.sleep(800);
  expect('result screen', (await s.ev('!document.getElementById("screen-result").hidden')) === true);
  const score = await s.ev('document.getElementById("res-score").textContent');
  console.log('     student sees', score, await s.ev('document.getElementById("res-percent").textContent'));
  expect('reveal=all lists 5 questions', (await s.ev('document.querySelectorAll("#res-review .review-item").length')) === 5);
  await s.shot('/tmp/opencode/exam-result.png');
  expect('student errors', s.logs.filter((l) => /EXCEPTION|error/i.test(l)).length === 0, s.logs.join('|'));
  await s.close();

  /* ---------------- stored result ---------------- */
  const res = (await (await fetch(BASE + '/api/results')).json()).results;
  expect('one result stored', res.length === 1);
  const r = res[0];
  expect('name and grade stored', r.student === 'Test Student' && r.grade === 8);
  expect('score matches what the student saw', score === r.score + ' / ' + r.total, score + ' vs ' + r.score);
  const plainOk = r.answers.filter((a) => a.n <= 2 && a.isCorrect).length === 2;
  expect('plain questions graded correct regardless of shuffle', plainOk, JSON.stringify(r.answers.slice(0, 2)));
  const csvPath = path.join(data, 'results', 'results.csv');
  expect('csv written', fs.existsSync(csvPath) && /Test Student/.test(fs.readFileSync(csvPath, 'utf8')));

  /* ---------------- teacher views results ---------------- */
  const v = await open(BASE + '/exam/results.html', 1300, 900);
  expect('results page lists the attempt', /Test Student/.test(await v.ev('document.getElementById("results-body").textContent')));
  await v.click('#results-body tr.row');
  expect('details expand', (await v.ev('document.querySelectorAll(".detail-item").length')) === 5);
  await v.ev('(()=>{const s=document.getElementById("f-exam");s.value=s.options[1].value;s.dispatchEvent(new Event("change"))})()');
  expect('question statistics appear', (await v.ev('document.querySelectorAll("#qstats-body tr").length')) === 5);
  await v.shot('/tmp/opencode/results.png');
  expect('results errors', v.logs.filter((l) => /EXCEPTION|error/i.test(l)).length === 0, v.logs.join('|'));
  await v.close();

  srv.kill();
  fs.rmSync(data, { recursive: true, force: true });
  console.log(bad ? bad + ' FAILED' : 'exam e2e OK');
  process.exit(bad ? 1 : 0);
})();

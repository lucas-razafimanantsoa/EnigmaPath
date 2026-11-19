/* EnigmaPath exam - student side.
 * Name + grade, one question at a time, no right/wrong feedback until the end.
 * The server grades the answers and stores the result. */
(function () {
  'use strict';

  var X = window.EPExam;
  var M = window.EPMaze;
  var SESSION_KEY = 'enigmapath.exam.session';
  var LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];
  var $ = function (id) { return document.getElementById(id); };
  var screens = { start: $('screen-start'), question: $('screen-question'), overview: $('screen-overview'), result: $('screen-result') };

  var st = null;          // active exam session
  var exams = [];
  var inProgress = false;

  function show(name) {
    Object.keys(screens).forEach(function (k) { screens[k].hidden = k !== name; });
    window.scrollTo(0, 0);
  }

  /* ----------------------------------------------------------------- start */
  function api(path, options) {
    return fetch(path, options).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (d) {
        if (!r.ok) throw new Error(d.error || ('Server error ' + r.status));
        return d;
      });
    });
  }

  function loadExams() {
    if (location.protocol === 'file:') {
      $('server-warning').hidden = false;
      $('start-form').hidden = true;
      return;
    }
    api('../api/exams').then(function (d) {
      exams = d.exams;
      var sel = $('exam-select');
      sel.textContent = '';
      if (!exams.length) {
        var o = document.createElement('option');
        o.textContent = 'No exam has been prepared yet';
        sel.appendChild(o);
        $('exam-desc').textContent = 'Ask your teacher to create an exam in the builder.';
        $('start-btn').disabled = true;
        return;
      }
      exams.forEach(function (e) {
        var o = document.createElement('option');
        o.value = e.id;
        o.textContent = e.title + ' (' + e.questions + ' questions)';
        sel.appendChild(o);
      });
      describeExam();
    }).catch(function () {
      $('server-warning').hidden = false;
      $('start-form').hidden = true;
    });
  }

  function describeExam() {
    var e = exams.filter(function (x) { return x.id === $('exam-select').value; })[0];
    $('exam-desc').textContent = e ? e.description : '';
  }

  function fillGrades() {
    var sel = $('student-grade');
    for (var g = 3; g <= 12; g++) {
      var o = document.createElement('option');
      o.value = String(g);
      o.textContent = 'Grade ' + g;
      sel.appendChild(o);
    }
  }

  function showError(el, msg) { el.textContent = msg; el.hidden = !msg; }

  function begin(ev) {
    ev.preventDefault();
    var err = $('start-error');
    showError(err, '');
    var name = $('student-name').value.trim().replace(/\s+/g, ' ');
    var grade = Number($('student-grade').value);
    var id = $('exam-select').value;
    if (!name) { showError(err, 'Please type your name.'); $('student-name').focus(); return; }
    if (!(grade >= 3 && grade <= 12)) { showError(err, 'Please choose your grade.'); $('student-grade').focus(); return; }
    if (!id) { showError(err, 'No exam is available.'); return; }
    $('start-btn').disabled = true;
    api('../api/exams/' + encodeURIComponent(id) + '/student').then(function (exam) {
      st = {
        examId: exam.id, title: exam.title, student: name, grade: grade, startedAt: Date.now(),
        pages: X.buildSession(exam), answers: {}, idx: 0
      };
      persist();
      enter();
    }).catch(function (e) {
      showError(err, e.message);
    }).then(function () { $('start-btn').disabled = false; });
  }

  function persist() {
    try { localStorage.setItem(SESSION_KEY, JSON.stringify(st)); } catch (e) { /* the exam still works without storage */ }
  }

  function enter() {
    inProgress = true;
    $('who-badge').textContent = st.student + ' · Grade ' + st.grade;
    $('who-badge').hidden = false;
    show('question');
    renderQuestion();
  }

  /* -------------------------------------------------------------- question */
  function answeredCount() {
    return st.pages.filter(function (p) { return st.answers[p.qid] !== undefined && st.answers[p.qid] !== null; }).length;
  }

  function renderStrip(box, big) {
    box.textContent = '';
    st.pages.forEach(function (p, i) {
      var b = document.createElement('button');
      b.type = 'button';
      b.textContent = String(i + 1);
      var done = st.answers[p.qid] !== undefined && st.answers[p.qid] !== null;
      if (done) b.classList.add('is-answered');
      else if (big) b.classList.add('is-open');
      if (!big && i === st.idx) b.classList.add('is-current');
      b.setAttribute('aria-label', 'Question ' + (i + 1) + (done ? ', answered' : ', not answered'));
      b.addEventListener('click', function () { st.idx = i; persist(); show('question'); renderQuestion(); });
      box.appendChild(b);
    });
  }

  function renderQuestion() {
    var total = st.pages.length;
    var p = st.pages[st.idx];
    $('q-exam-title').textContent = st.title;
    $('q-progress').textContent = 'Question ' + (st.idx + 1) + ' of ' + total;
    $('q-fill').style.width = ((st.idx + 1) / total * 100) + '%';
    renderStrip($('q-strip'), false);

    var mp = $('maze-panel');
    if (p.maze) {
      mp.hidden = false;
      $('maze-title').textContent = p.mazeTitle || 'Maze';
      $('maze-intro').textContent = p.intro || '';
      $('maze-intro').hidden = !p.intro;
      $('maze-figure').innerHTML = M.toSVG(M.parse(p.maze.map, p.maze.dir), { cell: 22, label: 'Maze: ' + (p.mazeTitle || '') });
    } else mp.hidden = true;

    $('q-text').textContent = p.text;
    var box = $('q-options');
    box.textContent = '';
    var chosen = st.answers[p.qid];
    p.options.forEach(function (text, i) {
      var label = document.createElement('label');
      label.className = 'option' + (chosen === i ? ' is-selected' : '');
      var input = document.createElement('input');
      input.type = 'radio'; input.name = 'opt'; input.value = String(i); input.checked = chosen === i;
      var key = document.createElement('span'); key.className = 'option__key'; key.textContent = LETTERS[i];
      var t = document.createElement('span'); t.textContent = text;
      label.append(input, key, t);
      input.addEventListener('change', function () { choose(i); });
      box.appendChild(label);
    });
    $('btn-prev').disabled = st.idx === 0;
    $('btn-next').textContent = st.idx === total - 1 ? 'Review & submit →' : 'Next →';
  }

  function choose(i) {
    var p = st.pages[st.idx];
    st.answers[p.qid] = i;
    persist();
    var opts = $('q-options').children;
    for (var k = 0; k < opts.length; k++) opts[k].classList.toggle('is-selected', k === i);
    renderStrip($('q-strip'), false);
  }

  function next() {
    if (st.idx >= st.pages.length - 1) { showOverview(); return; }
    st.idx++; persist(); renderQuestion(); $('q-text').focus({ preventScroll: true });
  }
  function prev() { if (st.idx > 0) { st.idx--; persist(); renderQuestion(); $('q-text').focus({ preventScroll: true }); } }

  /* -------------------------------------------------------------- overview */
  function showOverview() {
    var n = answeredCount();
    var total = st.pages.length;
    $('ov-summary').textContent = n === total ? 'You answered all ' + total + ' questions.' :
      'You answered ' + n + ' of ' + total + ' questions. The highlighted numbers have no answer yet - click one to go to it.';
    renderStrip($('ov-strip'), true);
    showError($('submit-error'), '');
    show('overview');
  }

  function submit() {
    var total = st.pages.length;
    var missing = total - answeredCount();
    if (missing && !window.confirm('You have ' + missing + ' unanswered question' + (missing === 1 ? '' : 's') + '. Submit anyway?')) return;
    $('ov-submit').disabled = true;
    var payload = {
      examId: st.examId, student: st.student, grade: st.grade,
      startedAt: new Date(st.startedAt).toISOString().slice(0, 19).replace('T', ' '),
      durationSec: Math.round((Date.now() - st.startedAt) / 1000),
      answers: st.pages.map(function (p, i) {
        var shown = st.answers[p.qid];
        return { qid: p.qid, position: i + 1, order: p.order, chosen: shown === undefined || shown === null ? null : p.order[shown] };
      })
    };
    api('../api/submit', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      .then(showResult)
      .catch(function (e) {
        showError($('submit-error'), 'Your answers could not be saved: ' + e.message + ' Tell your teacher, and press Submit again.');
      })
      .then(function () { $('ov-submit').disabled = false; });
  }

  /* ---------------------------------------------------------------- result */
  function showResult(r) {
    inProgress = false;
    try { localStorage.removeItem(SESSION_KEY); } catch (e) { /* ignore */ }
    $('res-title').textContent = st.student + ', here is your result';
    $('res-score').textContent = r.score + ' / ' + r.total;
    var pct = r.percent;
    $('res-percent').textContent = (Number.isInteger(pct) ? pct : pct.toFixed(1)) + '%';
    var ring = $('res-ring');
    ring.style.setProperty('--pct', String(pct));
    ring.style.setProperty('--ring', pct >= 75 ? 'var(--ok)' : pct >= 50 ? 'var(--warn)' : 'var(--bad)');
    $('res-message').textContent = pct >= 90 ? 'Outstanding work!' : pct >= 75 ? 'Great job!' : pct >= 50 ? 'Good effort.' : 'Keep practising - you will get there.';
    $('res-saved').textContent = 'Your result was saved.';
    var box = $('res-review');
    box.textContent = '';
    if (r.review && r.review.length) {
      var h = document.createElement('h2');
      h.textContent = r.reveal === 'all' ? 'All your answers' : 'Questions to look at again';
      box.appendChild(h);
      r.review.forEach(function (a) {
        var d = document.createElement('article');
        d.className = 'review-item' + (a.isCorrect ? ' review-item--ok' : '');
        var q = document.createElement('p'); q.className = 'q';
        q.textContent = (a.position ? 'Question ' + a.position : 'Question ' + a.n) + ': ' + a.text;
        d.appendChild(q);
        if (a.maze) { var m = document.createElement('p'); m.className = 'l'; m.textContent = 'About the maze: ' + a.maze; d.appendChild(m); }
        var l1 = document.createElement('p'); l1.className = 'l';
        l1.append('Your answer: ');
        var b1 = document.createElement('b'); b1.className = a.isCorrect ? 'ok' : 'bad'; b1.textContent = a.chosenText === null ? '(no answer)' : a.chosenText;
        l1.append(b1); d.appendChild(l1);
        if (!a.isCorrect) {
          var l2 = document.createElement('p'); l2.className = 'l';
          l2.append('Correct answer: ');
          var b2 = document.createElement('b'); b2.className = 'ok'; b2.textContent = a.correctText;
          l2.append(b2); d.appendChild(l2);
        }
        box.appendChild(d);
      });
    }
    show('result');
  }

  /* -------------------------------------------------------------- resume */
  function checkResume() {
    var raw = null;
    try { raw = localStorage.getItem(SESSION_KEY); } catch (e) { /* ignore */ }
    if (!raw) return;
    try { st = JSON.parse(raw); } catch (e) { st = null; return; }
    if (!st || !st.pages || !st.pages.length) { st = null; return; }
    $('resume-text').textContent = st.student + ' (Grade ' + st.grade + ') · ' + st.title + ' · ' + answeredCount() + ' of ' + st.pages.length + ' answered';
    $('resume-card').hidden = false;
  }

  /* ---------------------------------------------------------------- events */
  $('exam-select').addEventListener('change', describeExam);
  $('start-form').addEventListener('submit', begin);
  $('btn-prev').addEventListener('click', function (e) { if (e.detail <= 1) prev(); });
  $('btn-next').addEventListener('click', function (e) { if (e.detail <= 1) next(); });
  $('btn-overview').addEventListener('click', showOverview);
  $('ov-back').addEventListener('click', function () { show('question'); renderQuestion(); });
  $('ov-submit').addEventListener('click', submit);
  $('res-done').addEventListener('click', function () { st = null; window.location.reload(); });
  $('resume-btn').addEventListener('click', function () { $('resume-card').hidden = true; enter(); });
  $('discard-btn').addEventListener('click', function () {
    if (!window.confirm('Discard the unfinished exam? Your answers will be lost.')) return;
    try { localStorage.removeItem(SESSION_KEY); } catch (e) { /* ignore */ }
    st = null;
    $('resume-card').hidden = true;
  });
  $('brand').addEventListener('click', function (e) {
    if (inProgress && !window.confirm('Leave the exam? You can continue it later on this computer.')) e.preventDefault();
  });
  window.addEventListener('beforeunload', function (e) {
    if (inProgress) { e.preventDefault(); e.returnValue = ''; }
  });
  document.addEventListener('keydown', function (e) {
    if (screens.question.hidden || e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
    if (e.key === 'ArrowLeft') { e.preventDefault(); prev(); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); next(); }
    else if (/^[1-6]$/.test(e.key)) {
      var p = st.pages[st.idx];
      var i = Number(e.key) - 1;
      if (i < p.options.length) { e.preventDefault(); choose(i); renderQuestion(); }
    }
  });

  fillGrades();
  loadExams();
  checkResume();
  show('start');
}());

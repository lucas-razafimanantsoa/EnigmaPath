/* EnigmaPath results viewer (teacher). */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var all = [];
  var exams = [];
  var open = {};
  var toastTimer = null;

  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; }
  function toast(msg, tone) {
    var t = $('toast');
    t.textContent = msg; t.className = 'toast is-visible' + (tone ? ' toast--' + tone : '');
    clearTimeout(toastTimer); toastTimer = setTimeout(function () { t.classList.remove('is-visible'); }, 3500);
  }
  function api(path, options) {
    return fetch(path, options).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (d) {
        if (!r.ok) throw new Error(d.error || ('Server error ' + r.status));
        return d;
      });
    });
  }

  function load() {
    if (location.protocol === 'file:') { $('empty-msg').textContent = 'Start the EnigmaPath server (start.bat / start.sh) to see results.'; return; }
    Promise.all([api('../api/results'), api('../api/exams')]).then(function (rs) {
      all = rs[0].results;
      exams = rs[1].exams;
      fillFilters();
      render();
    }).catch(function (e) { $('empty-msg').textContent = 'Could not load results: ' + e.message; });
  }

  function fillFilters() {
    var sel = $('f-exam');
    var keep = sel.value;
    sel.textContent = '';
    var o = el('option', null, 'All exams'); o.value = ''; sel.appendChild(o);
    var seen = {};
    exams.forEach(function (e) { seen[e.id] = e.title; });
    all.forEach(function (r) { if (!seen[r.examId]) seen[r.examId] = r.examTitle + ' (removed)'; });
    Object.keys(seen).forEach(function (id) { var op = el('option', null, seen[id]); op.value = id; sel.appendChild(op); });
    sel.value = keep;
    var g = $('f-grade');
    if (g.options.length === 1) for (var n = 3; n <= 12; n++) { var go = el('option', null, 'Grade ' + n); go.value = String(n); g.appendChild(go); }
  }

  function filtered() {
    var ex = $('f-exam').value, gr = $('f-grade').value, nm = $('f-name').value.trim().toLowerCase();
    return all.filter(function (r) {
      return (!ex || r.examId === ex) && (!gr || String(r.grade) === gr) && (!nm || r.student.toLowerCase().indexOf(nm) >= 0);
    });
  }

  function fmtTime(s) { return s === null || s === undefined ? '' : Math.floor(s / 60) + ' min ' + (s % 60) + ' s'; }
  function pctClass(p) { return p >= 75 ? 'pct-good' : p >= 50 ? 'pct-mid' : 'pct-bad'; }

  function render() {
    var rows = filtered();
    var body = $('results-body');
    body.textContent = '';
    var avg = rows.length ? rows.reduce(function (s, r) { return s + r.percent; }, 0) / rows.length : 0;
    var best = rows.reduce(function (m, r) { return Math.max(m, r.percent); }, 0);
    var sum = $('summary');
    sum.textContent = '';
    [['Attempts', rows.length], ['Average', avg.toFixed(1) + '%'], ['Highest', best + '%']].forEach(function (s) {
      var d = el('div', 'sum'); d.append(el('b', null, String(s[1])), el('span', null, s[0])); sum.appendChild(d);
    });
    $('empty-msg').textContent = rows.length ? '' : 'No results match. Results appear here after students submit an exam.';

    rows.forEach(function (r) {
      var wrong = r.answers.filter(function (a) { return a.chosen !== null && !a.isCorrect; }).map(function (a) { return 'Q' + a.n; });
      var skipped = r.answers.filter(function (a) { return a.chosen === null; }).map(function (a) { return 'Q' + a.n; });
      var tr = el('tr', 'row');
      var pct = el('td', pctClass(r.percent), r.percent + '%');
      var actions = el('td');
      var del = el('button', 'btn btn--small btn--danger', 'Delete');
      del.type = 'button';
      del.addEventListener('click', function (ev) {
        ev.stopPropagation();
        if (!window.confirm('Delete the result of ' + r.student + '?')) return;
        api('../api/results/' + encodeURIComponent(r.id), { method: 'DELETE' }).then(load).catch(function (e) { toast(e.message, 'error'); });
      });
      actions.appendChild(del);
      tr.append(el('td', null, r.finishedAt), el('td', null, r.student), el('td', null, String(r.grade)), el('td', null, r.examTitle),
        el('td', null, r.score + ' / ' + r.total), pct, el('td', null, fmtTime(r.durationSec)),
        el('td', null, wrong.join(', ') + (skipped.length ? (wrong.length ? ' · ' : '') + 'skipped: ' + skipped.join(', ') : '') || '–'), actions);
      tr.addEventListener('click', function () { open[r.id] = !open[r.id]; render(); });
      body.appendChild(tr);
      if (open[r.id]) {
        var d = el('tr', 'detail');
        var td = el('td'); td.colSpan = 9;
        var list = el('div', 'detail-list');
        r.answers.slice().sort(function (a, b) { return a.n - b.n; }).forEach(function (a) {
          var it = el('div', 'detail-item' + (a.isCorrect ? ' ok' : a.chosen === null ? ' skip' : ''));
          it.appendChild(el('b', null, 'Q' + a.n + (a.maze ? ' (' + a.maze + ')' : '') + ': ' + a.text));
          it.appendChild(el('small', null, (a.isCorrect ? '✓ Correct: ' : a.chosen === null ? '– Not answered. Correct: ' : '✗ Answered: ' + a.chosenText + ' · Correct: ') + a.correctText));
          list.appendChild(it);
        });
        td.appendChild(list); d.appendChild(td); body.appendChild(d);
      }
    });
    renderQStats(rows);
  }

  function renderQStats(rows) {
    var ex = $('f-exam').value;
    var card = $('qstats-card');
    if (!ex || !rows.length) { card.hidden = true; return; }
    var stats = {};
    rows.forEach(function (r) {
      r.answers.forEach(function (a) {
        var s = stats[a.n] || (stats[a.n] = { n: a.n, text: a.text, ok: 0, bad: 0, skip: 0 });
        if (a.chosen === null) s.skip++; else if (a.isCorrect) s.ok++; else s.bad++;
      });
    });
    var body = $('qstats-body');
    body.textContent = '';
    Object.keys(stats).map(Number).sort(function (a, b) { return a - b; }).forEach(function (k) {
      var s = stats[k];
      var tot = s.ok + s.bad + s.skip;
      var pct = Math.round(100 * s.ok / tot);
      var tr = el('tr');
      var pc = el('td');
      var bar = el('span', 'bar'); bar.style.width = Math.max(2, pct * 0.8) + 'px';
      pc.append(bar, pct + '%');
      tr.append(el('td', null, 'Q' + s.n), el('td', null, s.text), el('td', null, String(s.ok)), el('td', null, String(s.bad)), el('td', null, String(s.skip)), pc);
      body.appendChild(tr);
    });
    card.hidden = false;
  }

  function csvEscape(v) {
    var s = v === null || v === undefined ? '' : String(v);
    return /[",\r\n;]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }
  function download(name, text, type) {
    var a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type: type }));
    a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
  }

  function exportCsv() {
    var rows = filtered().slice().sort(function (a, b) { return a.finishedAt < b.finishedAt ? -1 : 1; });
    var head = ['finished_at', 'exam_id', 'exam_title', 'student', 'grade', 'score', 'total', 'percent', 'duration_sec', 'wrong_questions', 'unanswered_questions', 'wrong_details'];
    var lines = [head.join(',')];
    rows.forEach(function (r) {
      var wrong = r.answers.filter(function (a) { return a.chosen !== null && !a.isCorrect; });
      var skipped = r.answers.filter(function (a) { return a.chosen === null; });
      lines.push([r.finishedAt, r.examId, r.examTitle, r.student, r.grade, r.score, r.total, r.percent, r.durationSec,
        wrong.map(function (a) { return 'Q' + a.n; }).join('; '), skipped.map(function (a) { return 'Q' + a.n; }).join('; '),
        wrong.map(function (a) { return "Q" + a.n + ": chose '" + a.chosenText + "' (correct: '" + a.correctText + "')"; }).join(' | ')].map(csvEscape).join(','));
    });
    download('enigmapath-results.csv', '\ufeff' + lines.join('\r\n') + '\r\n', 'text/csv;charset=utf-8');
  }

  function importFiles(files) {
    var reads = Array.prototype.map.call(files, function (f) {
      return new Promise(function (resolve) {
        var fr = new FileReader();
        fr.onload = function () {
          try { var d = JSON.parse(fr.result); resolve(Array.isArray(d) ? d : d && d.results ? d.results : [d]); } catch (e) { resolve([]); }
        };
        fr.onerror = function () { resolve([]); };
        fr.readAsText(f);
      });
    });
    Promise.all(reads).then(function (lists) {
      var items = [].concat.apply([], lists);
      return api('../api/results/import', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ results: items }) });
    }).then(function (r) {
      toast('Imported ' + r.added + ' result(s); ' + r.skipped + ' already present; ' + r.invalid + ' skipped as invalid.', r.added ? 'ok' : '');
      load();
    }).catch(function (e) { toast(e.message, 'error'); });
  }

  ['f-exam', 'f-grade'].forEach(function (id) { $(id).addEventListener('change', render); });
  $('f-name').addEventListener('input', render);
  $('btn-csv').addEventListener('click', exportCsv);
  $('btn-json').addEventListener('click', function () { download('enigmapath-results.json', JSON.stringify({ results: filtered() }, null, 1), 'application/json'); });
  $('f-import').addEventListener('change', function (e) { if (e.target.files.length) importFiles(e.target.files); e.target.value = ''; });
  load();
}());

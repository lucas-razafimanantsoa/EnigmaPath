#!/usr/bin/env node
/* Tests for hanoi/js/hanoi-logic.js. Run with: node tools/test_hanoi.js */
'use strict';

var assert = require('assert');
var path = require('path');
var L = require(path.join(__dirname, '..', 'hanoi', 'js', 'hanoi-logic.js'));

var passed = 0;
function test(name, fn) {
  try {
    fn();
    passed++;
    console.log('  ok   ' + name);
  } catch (err) {
    console.error('  FAIL ' + name + '\n       ' + (err && err.stack || err));
    process.exitCode = 1;
  }
}

/** Is `pegs` a legal position (every peg strictly decreasing, discs 1..n used once)? */
function isLegalState(pegs, n) {
  var seen = {};
  for (var p = 0; p < 3; p++) {
    for (var i = 0; i < pegs[p].length; i++) {
      var d = pegs[p][i];
      if (seen[d] || d < 1 || d > n) return false;
      seen[d] = true;
      if (i > 0 && pegs[p][i - 1] < d) return false;
    }
  }
  return Object.keys(seen).length === n;
}

/** Encode a state as a base-3 number: digit k-1 is the peg of disc k. */
function encode(assign) {
  var code = 0;
  for (var i = assign.length - 1; i >= 0; i--) code = code * 3 + assign[i];
  return code;
}
function decode(code, n) {
  var a = [];
  for (var i = 0; i < n; i++) { a.push(code % 3); code = Math.floor(code / 3); }
  return a;
}

/** Breadth-first search outward from the goal; returns distance for every state. */
function bfsFromGoal(n) {
  var total = Math.pow(3, n);
  var dist = new Array(total).fill(-1);
  var goal = encode(new Array(n).fill(2));
  dist[goal] = 0;
  var queue = [goal];
  for (var head = 0; head < queue.length; head++) {
    var code = queue[head];
    var game = L.fromAssignment(decode(code, n));
    for (var from = 0; from < 3; from++) {
      for (var to = 0; to < 3; to++) {
        if (!L.checkMove(game.pegs, from, to).ok) continue;
        var next = L.fromAssignment(decode(code, n));
        L.tryMove(next, from, to);
        var c = encode(L.assignmentOf(next.pegs));
        if (dist[c] === -1) { dist[c] = dist[code] + 1; queue.push(c); }
      }
    }
  }
  return dist;
}

console.log('Tower of Hanoi logic');

test('minimum moves is 2^n - 1', function () {
  var expected = [0, 1, 3, 7, 15, 31, 63, 127, 255];
  expected.forEach(function (m, n) { assert.strictEqual(L.minMoves(n), m); });
});

test('new game starts with all discs on peg 1, largest at the bottom', function () {
  var g = L.createGame(4);
  assert.deepStrictEqual(g.pegs, [[4, 3, 2, 1], [], []]);
  assert.strictEqual(g.history.length, 0);
  assert.strictEqual(L.isSolved(g), false);
});

test('legal moves move only the top disc', function () {
  var g = L.createGame(3);
  var r = L.tryMove(g, 0, 1);
  assert.ok(r.ok);
  assert.strictEqual(r.disc, 1);
  assert.deepStrictEqual(g.pegs, [[3, 2], [1], []]);
  assert.ok(L.tryMove(g, 0, 2).ok);
  assert.deepStrictEqual(g.pegs, [[3], [1], [2]]);
  assert.ok(L.tryMove(g, 1, 2).ok); // small onto bigger is fine
  assert.deepStrictEqual(g.pegs, [[3], [], [2, 1]]);
  assert.strictEqual(g.history.length, 3);
});

test('illegal moves are rejected with a message and change nothing', function () {
  var g = L.createGame(3);
  L.tryMove(g, 0, 1); // disc 1 -> peg 2
  var before = JSON.stringify(g.pegs);
  var cases = [
    [0, 1, 'bigger'],   // disc 2 onto disc 1
    [2, 0, 'empty'],    // from an empty peg
    [1, 1, 'same'],     // same peg
    [0, 3, 'range'],
    [-1, 0, 'range']
  ];
  cases.forEach(function (c) {
    var r = L.tryMove(g, c[0], c[1]);
    assert.strictEqual(r.ok, false);
    assert.strictEqual(r.reason, c[2]);
    assert.ok(typeof r.message === 'string' && r.message.length > 5);
  });
  assert.strictEqual(JSON.stringify(g.pegs), before);
  assert.strictEqual(g.history.length, 1, 'illegal moves must not enter the history');
});

test('win detection', function () {
  var g = L.createGame(3);
  L.solve(g.pegs).forEach(function (m, i, all) {
    var r = L.tryMove(g, m.from, m.to);
    assert.strictEqual(r.won, i === all.length - 1);
  });
  assert.ok(L.isSolved(g));
  assert.strictEqual(g.history.length, 7);
  // All discs on peg 2 (middle) is not a win.
  assert.strictEqual(L.isSolved(L.fromAssignment([1, 1, 1])), false);
  assert.strictEqual(L.isSolved([[], [], [3, 2, 1]]), true);
});

test('undo goes back one move at a time, all the way to the start', function () {
  var g = L.createGame(5);
  var snapshots = [JSON.stringify(g.pegs)];
  L.solve(g.pegs).slice(0, 12).forEach(function (m) {
    L.tryMove(g, m.from, m.to);
    snapshots.push(JSON.stringify(g.pegs));
  });
  for (var i = 12; i > 0; i--) {
    var undone = L.undo(g);
    assert.ok(undone);
    assert.strictEqual(JSON.stringify(g.pegs), snapshots[i - 1]);
  }
  assert.strictEqual(L.undo(g), null);
  assert.deepStrictEqual(g.pegs, [[5, 4, 3, 2, 1], [], []]);
});

test('undo after winning returns to an unsolved state', function () {
  var g = L.createGame(3);
  L.solve(g.pegs).forEach(function (m) { L.tryMove(g, m.from, m.to); });
  L.undo(g);
  assert.strictEqual(L.isSolved(g), false);
});

test('reset restores the start and clears history', function () {
  var g = L.createGame(4);
  L.tryMove(g, 0, 2);
  L.tryMove(g, 0, 1);
  L.reset(g);
  assert.deepStrictEqual(g.pegs, [[4, 3, 2, 1], [], []]);
  assert.strictEqual(g.history.length, 0);
});

test('solver from the start takes exactly 2^n - 1 moves (n = 1..10)', function () {
  for (var n = 1; n <= 10; n++) {
    assert.strictEqual(L.solve(L.createGame(n).pegs).length, L.minMoves(n));
  }
});

test('solver output is empty when already solved', function () {
  assert.deepStrictEqual(L.solve([[], [], [3, 2, 1]]), []);
  assert.strictEqual(L.nextMove([[], [], [3, 2, 1]]), null);
});

test('solver is optimal from EVERY legal state (n = 1..5) - checked against BFS', function () {
  var states = 0;
  for (var n = 1; n <= 5; n++) {
    var dist = bfsFromGoal(n);
    var total = Math.pow(3, n);
    for (var code = 0; code < total; code++) {
      assert.ok(dist[code] >= 0, 'BFS must reach every state');
      var g = L.fromAssignment(decode(code, n));
      assert.ok(isLegalState(g.pegs, n));
      var seq = L.solve(g.pegs);
      assert.strictEqual(seq.length, dist[code],
        'n=' + n + ' state ' + JSON.stringify(g.pegs) + ': solver ' + seq.length + ' vs BFS ' + dist[code]);
      // The first move is what the Hint button shows.
      var hint = L.nextMove(g.pegs);
      if (seq.length) assert.deepStrictEqual(hint, seq[0]); else assert.strictEqual(hint, null);
      states++;
    }
  }
  assert.strictEqual(states, 3 + 9 + 27 + 81 + 243);
});

test('solver sequences are legal and end solved (all states n = 1..6)', function () {
  for (var n = 1; n <= 6; n++) {
    var total = Math.pow(3, n);
    for (var code = 0; code < total; code++) {
      var g = L.fromAssignment(decode(code, n));
      var seq = L.solve(g.pegs);
      seq.forEach(function (m) {
        var legal = L.checkMove(g.pegs, m.from, m.to);
        assert.ok(legal.ok, 'illegal solver move ' + JSON.stringify(m));
        assert.strictEqual(legal.disc, m.disc, 'reported disc must be the top disc');
        L.tryMove(g, m.from, m.to);
        assert.ok(isLegalState(g.pegs, n));
      });
      assert.ok(L.isSolved(g));
    }
  }
});

test('auto-solve works after the player has made (also silly) moves', function () {
  var n = 8;
  var seed = 12345;
  function rnd(k) { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed % k; }
  for (var round = 0; round < 40; round++) {
    var g = L.createGame(n);
    var steps = rnd(200);
    for (var i = 0; i < steps; i++) L.tryMove(g, rnd(3), rnd(3)); // many will be rejected
    assert.ok(isLegalState(g.pegs, n));
    var seq = L.solve(g.pegs);
    assert.ok(seq.length <= L.minMoves(n), 'never worse than from the start');
    seq.forEach(function (m) { assert.ok(L.tryMove(g, m.from, m.to).ok); });
    assert.ok(L.isSolved(g));
  }
});

test('rating: optimal = 3, up to 1.5x = 2, otherwise 1', function () {
  assert.strictEqual(L.rating(7, 3), 3);
  assert.strictEqual(L.rating(8, 3), 2);
  assert.strictEqual(L.rating(10, 3), 2);
  assert.strictEqual(L.rating(11, 3), 1);
  assert.strictEqual(L.rating(255, 8), 3);
  assert.strictEqual(L.rating(382, 8), 2); // 1.5 * 255 = 382.5
  assert.strictEqual(L.rating(383, 8), 1);
});

test('best-moves records keep the lowest per disc count', function () {
  var r = L.updateBest({}, 3, 12);
  assert.ok(r.isNew); assert.strictEqual(r.records[3], 12);
  var r2 = L.updateBest(r.records, 3, 9);
  assert.ok(r2.isNew); assert.strictEqual(r2.records[3], 9); assert.strictEqual(r2.previous, 12);
  var r3 = L.updateBest(r2.records, 3, 9);
  assert.ok(!r3.isNew);
  var r4 = L.updateBest(r3.records, 4, 40);
  assert.strictEqual(r4.records[3], 9); assert.strictEqual(r4.records[4], 40);
  assert.deepStrictEqual(r.records, { 3: 12 }, 'input must not be mutated');
});

test('time formatting and moves table', function () {
  assert.strictEqual(L.formatTime(0), '0:00');
  assert.strictEqual(L.formatTime(65000), '1:05');
  assert.strictEqual(L.formatTime(-5), '0:00');
  var rows = L.movesTable(8);
  assert.strictEqual(rows.length, 8);
  assert.deepStrictEqual(rows[7], { n: 8, moves: 255 });
});

console.log('\n' + passed + ' test group(s) passed' + (process.exitCode ? ' - WITH FAILURES' : ''));

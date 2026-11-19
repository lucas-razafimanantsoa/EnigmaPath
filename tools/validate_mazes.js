#!/usr/bin/env node
/* Validates every built-in maze and the maze library itself.  Run: node tools/validate_mazes.js */
'use strict';
const assert = require('assert');

const M = require('../shared/maze-lib.js');
const LEVELS = require('../shared/maze-levels.js');

let failures = 0;
function check(name, fn) {
  try { fn(); } catch (e) { failures++; console.log('FAIL', name, '-', e.message); }
}

// --- library rules --------------------------------------------------------
check('turning never moves', () => {
  const m = M.parse(['#####', '#S.G#', '#####'], 'E');
  const s = M.step(m, { r: 1, c: 1, d: 1 }, 'L');
  assert.deepStrictEqual([s.r, s.c, s.d], [1, 1, 0]);
  const t = M.step(m, { r: 1, c: 1, d: 1 }, 'R');
  assert.deepStrictEqual([t.r, t.c, t.d], [1, 1, 2]);
});
check('four turns restore the heading', () => {
  const m = M.parse(['#####', '#S.G#', '#####'], 'N');
  for (const t of ['L', 'R']) {
    const r = M.run(m, [t, t, t, t]);
    assert.strictEqual(r.state.d, 0);
  }
});
check('L from N faces W, R from N faces E, F moves forward', () => {
  const m = M.parse(['#####', '#.SG#', '#...#', '#####'], 'N');
  assert.strictEqual(M.DIRS[M.step(m, { r: 2, c: 2, d: 0 }, 'L').d], 'W');
  assert.strictEqual(M.DIRS[M.step(m, { r: 2, c: 2, d: 0 }, 'R').d], 'E');
  const f = M.step(m, { r: 2, c: 2, d: 0 }, 'F');
  assert.deepStrictEqual([f.r, f.c], [1, 2]);
});
check('walls and edges block forward moves', () => {
  const m = M.parse(['#####', '#SG.#', '#####'], 'N');
  assert.strictEqual(M.run(m, 'F').error, 'wall');
  const open = M.parse(['...', '.S.', '.G.'], 'N');
  assert.strictEqual(M.run(open, 'FF').error, 'edge');
});
check('solver output reaches the goal in the simulator', () => {
  const m = M.parse(['#######', '#S....#', '#.###.#', '#...#G#', '#######'], 'N');
  const sol = M.solve(m);
  assert.ok(M.run(m, sol.program).reachedGoal);
});
check('solver is optimal on a tiny maze (brute force)', () => {
  const m = M.parse(['#####', '#S#G#', '#...#', '#####'], 'E');
  const sol = M.solve(m);
  let best = null;
  const alphabet = ['F', 'L', 'R'];
  for (let n = 1; n <= 8 && !best; n++) {
    const total = Math.pow(3, n);
    for (let k = 0; k < total && !best; k++) {
      const p = []; let x = k;
      for (let i = 0; i < n; i++) { p.push(alphabet[x % 3]); x = Math.floor(x / 3); }
      if (M.run(m, p).reachedGoal) best = n;
    }
  }
  assert.strictEqual(sol.length, best);
});
check('analysis: loops, dead ends, routes on a known maze', () => {
  // a 2-route ring plus one dead end
  const m = M.parse([
    '#######',
    '#S...G#',
    '#.###.#',
    '#.....#',
    '#######'
  ], 'N');
  const a = M.analyze(m);
  assert.strictEqual(a.loops, 1);
  assert.strictEqual(a.routes, 2);
  assert.strictEqual(a.cellDistance, 4);
  assert.strictEqual(a.shortestPathCount, 1);
});

// --- built-in levels -------------------------------------------------------
check('there are 20 levels', () => assert.strictEqual(LEVELS.length, 20));
const seen = new Set();
let prevInstr = 0;
LEVELS.forEach((lv) => {
  check('level ' + lv.id + ' (' + lv.name + ')', () => {
    const m = M.parse(lv.map, lv.dir);
    assert.ok(m.rows >= 11 && m.cols >= 11, 'maze should be at least 11x11, got ' + m.rows + 'x' + m.cols);
    for (let c = 0; c < m.cols; c++) assert.ok(!m.open[0][c] && !m.open[m.rows - 1][c], 'border must be wall');
    for (let r = 0; r < m.rows; r++) assert.ok(!m.open[r][0] && !m.open[r][m.cols - 1], 'border must be wall');
    const a = M.analyze(m);
    assert.ok(a.solvable, 'not solvable');
    assert.strictEqual(a.unreachableOpenCells, 0, 'isolated open cells');
    assert.ok(M.run(m, a.bestProgram).reachedGoal, 'best program does not reach the goal');
    assert.ok(a.routes >= 2, 'needs at least 2 different routes (has ' + a.routes + ')');
    assert.ok(a.loops >= 1, 'needs at least one loop');
    const key = lv.map.join('|');
    assert.ok(!seen.has(key), 'duplicate maze');
    seen.add(key);
    assert.ok(a.fewestInstructions >= prevInstr - 6, 'difficulty should not drop sharply (' + a.fewestInstructions + ' after ' + prevInstr + ')');
    prevInstr = a.fewestInstructions;
  });
});

console.log(failures ? failures + ' check(s) FAILED' : 'All maze checks passed (' + LEVELS.length + ' levels).');
process.exit(failures ? 1 : 0);

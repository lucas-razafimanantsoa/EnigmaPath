/* ==========================================================================
   Tower of Hanoi - pure game logic (no DOM access).
   Works as a classic <script> (window.HanoiLogic) and under Node (module.exports).

   Model
   - Discs are numbered 1..n, 1 = smallest. Pegs are 0, 1, 2.
   - `pegs` is an array of three arrays, each listing disc numbers from the
     bottom to the top of the peg. A legal peg is therefore strictly decreasing.
   - The goal is to have every disc on the last peg (index 2).
   ========================================================================== */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.HanoiLogic = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var PEGS = 3;
  var GOAL_PEG = 2;

  /** Minimum number of moves for n discs: 2^n - 1. */
  function minMoves(n) {
    return Math.pow(2, n) - 1;
  }

  function copyPegs(pegs) {
    return pegs.map(function (p) { return p.slice(); });
  }

  function countDiscs(pegs) {
    return pegs[0].length + pegs[1].length + pegs[2].length;
  }

  /** Fresh game with all n discs on the first peg. */
  function createGame(n) {
    var start = [];
    for (var d = n; d >= 1; d--) start.push(d);
    return { n: n, pegs: [start, [], []], history: [] };
  }

  /**
   * Build a game from any arrangement. `assignment[k - 1]` is the peg holding
   * disc k. Every assignment is a legal state because each peg is stacked
   * largest-first.
   */
  function fromAssignment(assignment) {
    var n = assignment.length;
    var pegs = [[], [], []];
    for (var d = n; d >= 1; d--) pegs[assignment[d - 1]].push(d);
    return { n: n, pegs: pegs, history: [] };
  }

  /** Inverse of fromAssignment: where[k - 1] is the peg of disc k. */
  function assignmentOf(pegs) {
    var where = new Array(countDiscs(pegs));
    for (var p = 0; p < PEGS; p++) {
      for (var i = 0; i < pegs[p].length; i++) where[pegs[p][i] - 1] = p;
    }
    return where;
  }

  /**
   * Check a move without performing it.
   * Returns { ok, reason, message }. `reason` is one of
   * 'range' | 'same' | 'empty' | 'bigger' when the move is not allowed.
   */
  function checkMove(pegs, from, to) {
    var inRange = function (x) { return x === 0 || x === 1 || x === 2; };
    if (!inRange(from) || !inRange(to)) {
      return { ok: false, reason: 'range', message: 'That is not one of the three pegs.' };
    }
    if (from === to) {
      return { ok: false, reason: 'same', message: 'The disc is already on that peg.' };
    }
    var src = pegs[from];
    if (src.length === 0) {
      return { ok: false, reason: 'empty', message: 'Peg ' + (from + 1) + ' is empty - there is no disc to pick up.' };
    }
    var disc = src[src.length - 1];
    var dst = pegs[to];
    if (dst.length > 0 && dst[dst.length - 1] < disc) {
      return {
        ok: false,
        reason: 'bigger',
        message: 'A bigger disc can never sit on a smaller one. Try another peg.'
      };
    }
    return { ok: true, reason: null, message: '', disc: disc };
  }

  /** Perform a move on `game` (mutates it). Returns { ok, ... } like checkMove plus `won`. */
  function tryMove(game, from, to) {
    var res = checkMove(game.pegs, from, to);
    if (!res.ok) return res;
    game.pegs[from].pop();
    game.pegs[to].push(res.disc);
    game.history.push({ from: from, to: to, disc: res.disc });
    res.won = isSolved(game);
    return res;
  }

  /** Take back the last move. Returns that move, or null if there is nothing to undo. */
  function undo(game) {
    var last = game.history.pop();
    if (!last) return null;
    game.pegs[last.to].pop();
    game.pegs[last.from].push(last.disc);
    return last;
  }

  /** Back to the starting position (everything on peg 1). */
  function reset(game) {
    var fresh = createGame(game.n);
    game.pegs = fresh.pegs;
    game.history = [];
    return game;
  }

  /** True when all discs are stacked on the last peg. Accepts a game or a pegs array. */
  function isSolved(gameOrPegs) {
    var pegs = Array.isArray(gameOrPegs) ? gameOrPegs : gameOrPegs.pegs;
    var total = countDiscs(pegs);
    return total > 0 && pegs[GOAL_PEG].length === total;
  }

  /**
   * Optimal move list that brings every disc to `target` from ANY legal state.
   *
   * moveTower(k, to) = "get discs 1..k onto peg `to`":
   *  - if disc k is already on `to`, it can stay; only the smaller discs matter;
   *  - otherwise move the k-1 smaller discs out of the way onto the spare peg,
   *    move disc k, then move the k-1 smaller discs on top of it.
   * Each disc k is moved at most 2^(k-1) times by this rule, which is the
   * shortest possible, so the result is optimal.
   */
  function solve(pegs, target) {
    if (target === undefined) target = GOAL_PEG;
    var where = assignmentOf(pegs);
    var moves = [];

    function moveTower(k, to) {
      if (k < 1) return;
      var from = where[k - 1];
      if (from === to) {
        moveTower(k - 1, to);
        return;
      }
      var spare = 3 - from - to; // peg indices add up to 0+1+2 = 3
      moveTower(k - 1, spare);
      moves.push({ from: from, to: to, disc: k });
      where[k - 1] = to;
      moveTower(k - 1, to);
    }

    moveTower(where.length, target);
    return moves;
  }

  /** The next move of an optimal solution from this position, or null if solved. */
  function nextMove(pegs) {
    var moves = solve(pegs, GOAL_PEG);
    return moves.length ? moves[0] : null;
  }

  /** 3 = optimal, 2 = within 1.5x the minimum, 1 = anything else. */
  function rating(moves, n) {
    var min = minMoves(n);
    if (moves <= min) return 3;
    if (moves <= min * 1.5) return 2;
    return 1;
  }

  /** Update a { "3": 7, ... } records object. Returns { records, isNew, previous }. */
  function updateBest(records, n, moves) {
    var copy = {};
    Object.keys(records || {}).forEach(function (k) { copy[k] = records[k]; });
    var previous = typeof copy[n] === 'number' ? copy[n] : null;
    var isNew = previous === null || moves < previous;
    if (isNew) copy[n] = moves;
    return { records: copy, isNew: isNew, previous: previous };
  }

  /** Format milliseconds as m:ss. */
  function formatTime(ms) {
    var total = Math.max(0, Math.floor(ms / 1000));
    var m = Math.floor(total / 60);
    var s = total % 60;
    return m + ':' + (s < 10 ? '0' : '') + s;
  }

  /** Rows for the "how many moves" table: [{ n, moves }, ...] for 1..max. */
  function movesTable(max) {
    var rows = [];
    for (var n = 1; n <= max; n++) rows.push({ n: n, moves: minMoves(n) });
    return rows;
  }

  return {
    GOAL_PEG: GOAL_PEG,
    minMoves: minMoves,
    copyPegs: copyPegs,
    countDiscs: countDiscs,
    createGame: createGame,
    fromAssignment: fromAssignment,
    assignmentOf: assignmentOf,
    checkMove: checkMove,
    tryMove: tryMove,
    undo: undo,
    reset: reset,
    isSolved: isSolved,
    solve: solve,
    nextMove: nextMove,
    rating: rating,
    updateBest: updateBest,
    formatTime: formatTime,
    movesTable: movesTable
  };
});

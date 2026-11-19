'use strict';
/* Browser smoke test for Guide the Robot: plays level 1 and level 20 with the solver's program. */
const path = require('path');
const { open } = require('./cdp');
const M = require('../shared/maze-lib.js');
const LEVELS = require('../shared/maze-levels.js');
const url = 'file://' + path.resolve(__dirname, '../robot/index.html');

(async () => {
  const p = await open(url, 1280, 800);
  let bad = 0;
  const expect = (name, cond, extra) => { if (!cond) { bad++; console.log('FAIL', name, extra === undefined ? '' : extra); } else console.log('ok  ', name); };
  expect('level grid shows 20 cards', (await p.ev('document.querySelectorAll(".level-card").length')) === 20);
  expect('only level 1 unlocked', (await p.ev('document.querySelectorAll(".level-card:not(:disabled)").length')) === 1);
  await p.shot('/tmp/opencode/robot-levels.png');

  await p.click('.level-card:not(:disabled)');
  expect('game screen visible', (await p.ev('!document.getElementById("screen-game").hidden')) === true);
  // wrong program first: walk into a wall
  const level = LEVELS[0];
  const maze = M.parse(level.map, level.dir);
  const sol = M.solve(maze).program;
  await p.click('.ins[data-ins="R"]'); await p.click('.ins[data-ins="R"]'); await p.click('.ins[data-ins="F"]'); await p.click('.ins[data-ins="F"]'); await p.click('.ins[data-ins="F"]');
  expect('5 chips', (await p.ev('document.querySelectorAll("#program .chip").length')) === 5);
  await p.ev('document.getElementById("speed").value="5"');
  await p.click('#btn-run'); await p.sleep(900);
  const msg1 = await p.ev('document.getElementById("message").textContent');
  console.log('     message:', msg1);
  expect('a bad program never wins', !/Great job/.test(msg1));

  await p.click('#btn-clear');
  for (const ch of sol) await p.click('.ins[data-ins="' + ch + '"]');
  expect('solver program entered', (await p.ev('document.getElementById("stat-count").textContent')) === String(sol.length));
  await p.shot('/tmp/opencode/robot-game.png');
  await p.click('#btn-run'); await p.sleep(3500);
  const msg2 = await p.ev('document.getElementById("message").textContent');
  console.log('     message:', msg2);
  expect('solver program wins', /Great job/.test(msg2));
  expect('level 2 unlocked after win', (await p.ev('document.querySelector("#btn-next").hidden')) === false);
  expect('progress stored', /"1":\{"best":/.test(await p.ev('localStorage.getItem("enigmapath.robot.v1")')));

  // keyboard entry
  await p.click('#btn-next');
  await p.key('ArrowUp'); await p.key('ArrowLeft'); await p.key('ArrowRight');
  expect('keyboard adds instructions', (await p.ev('document.querySelectorAll("#program .chip").length')) === 3);
  await p.key('Backspace');
  expect('backspace removes', (await p.ev('document.querySelectorAll("#program .chip").length')) === 2);

  // biggest maze renders
  await p.click('#btn-levels');
  await p.ev('(()=>{const c=document.getElementById("unlock-all");c.checked=true;c.dispatchEvent(new Event("change"));})()');
  await p.ev('document.querySelectorAll(".level-card")[19].click()');
  await p.sleep(300);
  await p.shot('/tmp/opencode/robot-l20.png');
  expect('level 20 canvas size', (await p.ev('document.getElementById("maze-canvas").width')) > 200);

  console.log('console:', p.logs.length ? p.logs : 'clean');
  expect('no console errors', p.logs.filter((l) => /EXCEPTION|error/i.test(l)).length === 0, p.logs.join('|'));
  await p.close();
  console.log(bad ? bad + ' FAILED' : 'robot UI OK');
  process.exit(bad ? 1 : 0);
})();

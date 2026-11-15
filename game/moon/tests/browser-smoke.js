// Browser smoke test for the Moon mission. Open /game/moon/ (served over http), wait for the menu, then paste
// this into the console (or run it with Playwright's page.evaluate). It drives the real frame logic through
// MoonMission.simulate(), so it works even in a hidden / throttled tab. Resolves to a report; throws on failure.
(async () => {
  const M = window.MoonMission, ok = (c, m) => { if (!c) throw new Error('FAIL: ' + m); };
  const errors = []; addEventListener('error', e => errors.push(e.message));
  try { localStorage.removeItem('zhetalis-moon-save-v1'); } catch { }
  const report = {};
  // Flybys: pose ready before HUD, real hyperbola radius, no GPU growth when switching
  const r = M.three().renderer, mem = [];
  for (const id of ['artemis1', 'artemis2', 'artemis1', 'artemis2']) { M.start(id); M.simulate(0.3, []); mem.push(r.info.memory.geometries); }
  ok(mem[0] === mem[2] && mem[1] === mem[3], 'flyby geometry count stable ' + mem);
  const f = M.three().flyby, p = f.posAt(0.4), want = f.rp * (1 + f.e) / (1 + f.e * Math.cos(0.4));
  ok(Math.abs(p.length() - want) < 1e-6, 'orbit radius exact');
  ok(f.view().moonOff < 1, 'Artemis II crew camera starts on the Moon');
  report.flyby = { geometries: mem };
  // Surface: new mission, skip descent, walk, jump, check lunar gravity and bounded chunks
  M.start('surface'); M.simulate(26, []);
  document.querySelector('#modal:not(.hidden) .choices button.primary')?.click();   // "Go outside"
  M.simulate(6, []);
  ok(M.debug().place === 'outside', 'outside after the elevator');
  const before = M.debug().player; M.simulate(8, ['KeyW', 'ShiftLeft']); const after = M.debug().player;
  ok(Math.hypot(after.x - before.x, after.z - before.z) > 15, 'walking moves the astronaut');
  M.simulate(0.05, ['Space']); M.simulate(0.5, []); const air = M.debug().player;
  ok(!air.grounded && Math.abs(air.vy - (2.9 - 1.62 * 0.55)) < 0.15, 'jump follows 1.62 m/s2: vy ' + air.vy);
  const d = M.debug();
  ok(d.chunks.detailed <= d.chunks.limit && d.chunks.limit <= 16, 'chunks bounded ' + JSON.stringify(d.chunks));
  ok(M.state().tasks.stepDown, 'first task completes');
  M.save(); const saved = JSON.parse(localStorage.getItem('zhetalis-moon-save-v1'));
  ok(saved.state && saved.prints.length > 0, 'save contains state and bootprints');
  ok(errors.length === 0, 'no page errors: ' + errors.join('; '));
  report.surface = { moved: +Math.hypot(after.x - before.x, after.z - before.z).toFixed(1), prints: d.prints, chunks: d.chunks };
  console.log('Moon smoke test passed', report); return report;
})();

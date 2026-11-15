// Physical walk-through test of the furnished habitat. It uses the game's real interior and its own collision
// rule (CrewInterior.walkable), so "passes" means a player can actually get there on foot.
// Run: serve game/ over http, open index.html, then paste this in the console (or page.evaluate it).
// It resolves to a report; `problems` is the list of things a player would hit.
//
//  1. Flood-fills every spot reachable on foot from the airlock spawn (10 cm grid).
//  2. Entry points: every place the game can put you (each airlock, the greenhouse door) must be walkable.
//  3. Doorways: the clear width of each tunnel between pods, and that every pod is reachable.
//  4. Stations and the look-at notes: each must be selectable with E from somewhere you can stand.
//  5. Trapped floor: walkable pockets you can never reach (furniture closing off a corner or a cabin).
//  6. Crew: with every crewmate standing at every routine spot at once, all pods must still connect.
//  7. Camera: head clearance and how close the eye gets to geometry (near-plane clipping) while walking.
(async () => {
  const THREE = await import('three');
  const { CrewInterior } = await import(new URL('src/crew-interior.js', document.baseURI).href);
  const I = new CrewInterior(), SP = 10.2, STEP = 0.1, X0 = -6, X1 = SP * 5 + 6, Z0 = -6.5, Z1 = 6.5;
  await new Promise(r => setTimeout(r, 1500));   // let async props settle
  const NX = Math.round((X1 - X0) / STEP) + 1, NZ = Math.round((Z1 - Z0) / STEP) + 1, idx = (i, j) => j * NX + i;
  const gx = i => X0 + i * STEP, gz = j => Z0 + j * STEP, cell = (x, z) => [Math.round((x - X0) / STEP), Math.round((z - Z0) / STEP)];
  const savedCrew = I.crewBodies; I.crewBodies = null;   // furniture and walls first; crew are tested separately
  const grid = extra => { const w = new Uint8Array(NX * NZ); for (let j = 0; j < NZ; j++) for (let i = 0; i < NX; i++) { const x = gx(i), z = gz(j); w[idx(i, j)] = I.walkable(x, z) && !(extra && extra(x, z)) ? 1 : 0; } return w; };
  const flood = (w, sx, sz) => { const seen = new Uint8Array(NX * NZ), [si, sj] = cell(sx, sz), q = [[si, sj]]; if (!w[idx(si, sj)]) return seen; seen[idx(si, sj)] = 1;
    while (q.length) { const [i, j] = q.pop(); for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const a = i + di, b = j + dj; if (a < 0 || b < 0 || a >= NX || b >= NZ) continue; const k = idx(a, b); if (w[k] && !seen[k]) { seen[k] = 1; q.push([a, b]); } } } return seen; };
  const problems = [], report = {};
  I.enter(); const spawn = { x: I.pos.x, z: I.pos.z };
  const walk = grid(), reach = flood(walk, spawn.x, spawn.z);
  const count = a => a.reduce((n, v) => n + v, 0);
  report.floor = { walkableM2: +(count(walk) * STEP * STEP).toFixed(1), reachableM2: +(count(reach) * STEP * STEP).toFixed(1) };
  const reachable = (x, z) => { const [i, j] = cell(x, z); return i >= 0 && j >= 0 && i < NX && j < NZ && !!reach[idx(i, j)]; };

  // 2. entry points
  // the game places you with placeAt(), which moves a blocked arrival point to the nearest clear floor
  const arrive = (x, z) => { I.placeAt(x, z); const p = [I.pos.x, I.pos.z]; I.pos.set(spawn.x, 0, spawn.z); return p; };
  report.entries = [['spawn (airlock)', spawn.x, spawn.z], ...[0, 1, 2, 3, 4, 5].map(p => ['pod ' + p + ' entrance', ...arrive(p * SP, 1.25)]), ['greenhouse door', SP * 2, -4.6], ['greenhouse door inner', SP * 2, -3.2]]
    .map(([name, x, z]) => { const ok = I.walkable(x, z) && reachable(x, z); if (!ok) problems.push(`Entry point blocked: ${name} at (${x.toFixed(1)}, ${z.toFixed(1)})`); return { name, ok }; });

  // 3. pods and doorways
  report.pods = I.podNames.map((name, p) => { let ok = false; for (let a = 0; a < 40 && !ok; a++) for (const r of [0, .6, 1.2, 1.8]) if (reachable(p * SP + Math.cos(a) * r, Math.sin(a) * r)) { ok = true; break; } if (!ok) problems.push(`Pod not reachable: ${name}`); return { name, ok }; });
  report.doorways = [0, 1, 2, 3, 4].map(p => { let min = 99, at = 0;
    for (let x = p * SP + 3.3; x <= (p + 1) * SP - 3.3; x += STEP) { let w = 0, best = 0; for (let z = -2; z <= 2; z += STEP) { if (reachable(x, z)) { w += STEP; best = Math.max(best, w); } else w = 0; } if (best < min) { min = best; at = x; } }
    if (min < 0.7) problems.push(`Doorway ${p}→${p + 1} too narrow: ${min.toFixed(2)} m clear at x=${at.toFixed(1)}`);
    return { between: `${I.podNames[p]} → ${I.podNames[p + 1]}`, clearWidthM: +min.toFixed(2) }; });

  // 4. stations and notes: can E select each one from somewhere you can stand?
  const pos0 = I.pos.clone(), yaw0 = I.yaw; let selectable = 0; report.unreachableStations = [];
  for (const s of I.stations) {
    const reachR = ['workbench', 'locker'].includes(s.type) ? 2.5 : 2; let ok = false, near = false;
    for (let r = .5; r < reachR && !ok; r += .25) for (let a = 0; a < 24 && !ok; a++) {
      const x = s.x + Math.cos(a / 24 * 6.283) * r, z = s.z + Math.sin(a / 24 * 6.283) * r; if (!reachable(x, z)) continue; near = true;
      I.pos.set(x, 0, z); I.yaw = Math.atan2(s.x - x, s.z - z); const n = I.nearest(); if (n && n.type === s.type && Math.abs(n.x - s.x) < .01 && Math.abs(n.z - s.z) < .01) ok = true;
    }
    if (ok) selectable++; else { const name = `${s.type}${s.title ? ' "' + s.title + '"' : s.label ? ' "' + s.label + '"' : ''} at (${s.x.toFixed(1)}, ${s.z.toFixed(1)})`; report.unreachableStations.push(name); problems.push(near ? `Cannot select with E (another item always wins): ${name}` : `Cannot get close enough: ${name}`); }
  }
  I.pos.copy(pos0); I.yaw = yaw0; report.stations = { total: I.stations.length, selectable };

  // 5. trapped pockets of floor
  const pocketSeen = new Uint8Array(NX * NZ); report.trappedPockets = [];
  for (let j = 0; j < NZ; j++) for (let i = 0; i < NX; i++) { const k = idx(i, j); if (!walk[k] || reach[k] || pocketSeen[k]) continue; const f = flood(walk, gx(i), gz(j)); let n = 0, sx = 0, sz = 0; for (let m = 0; m < f.length; m++) if (f[m]) { pocketSeen[m] = 1; n++; sx += gx(m % NX); sz += gz(Math.floor(m / NX)); }
    const area = n * STEP * STEP; if (area >= 0.35) { const p = { areaM2: +area.toFixed(2), x: +(sx / n).toFixed(1), z: +(sz / n).toFixed(1), pod: I.podNames[Math.max(0, Math.min(5, Math.round(sx / n / SP)))] }; report.trappedPockets.push(p); if (area >= 1) problems.push(`Floor you can see but never reach: ${p.areaM2} m² in ${p.pod} near (${p.x}, ${p.z})`); } }

  // 6. crew standing at every routine spot at once
  const spots = Object.entries(I.habSpots || {}).map(([name, s]) => { const v = (s.local ? s.local.clone() : new THREE.Vector3()); (s.group || I.scene).updateWorldMatrix(true, false); if (s.group) v.applyMatrix4(s.group.matrixWorld); else if (s.x !== undefined) v.set(s.x, 0, s.z); return { name, x: v.x, z: v.z }; });
  const crowd = grid((x, z) => spots.some(s => Math.hypot(s.x - x, s.z - z) < .5)), crowdReach = flood(crowd, spawn.x, spawn.z);
  report.crew = { spots: spots.length, inWalkway: spots.filter(s => Math.abs(s.z) < 1.1 && ((s.x % SP) + SP) % SP > 3.3 && ((s.x % SP) + SP) % SP < SP - 3.3).map(s => s.name) };
  I.podNames.forEach((name, p) => { let ok = false; for (let a = 0; a < 40 && !ok; a++) for (const r of [0, .6, 1.2, 1.8, 2.4]) { const [i, j] = cell(p * SP + Math.cos(a) * r, Math.sin(a) * r); if (crowdReach[idx(i, j)]) { ok = true; break; } } if (!ok) problems.push(`Crew can block the way into: ${name}`); });
  for (const n of report.crew.inWalkway) problems.push(`Crew routine spot inside a tunnel: ${n}`);

  // 7. camera: head room and eye-to-geometry distance over the reachable floor
  const meshes = []; I.scene.traverse(o => { if (o.isMesh && o.visible && !o.isSkinnedMesh) meshes.push(o); }); I.scene.updateMatrixWorld(true);
  const ray = new THREE.Raycaster(), eye = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0), dir = new THREE.Vector3(); let minHead = 99, headAt = null, minSide = 99, sideAt = null, samples = 0;
  for (let j = 0; j < NZ; j += 5) for (let i = 0; i < NX; i += 5) { if (!reach[idx(i, j)]) continue; samples++; eye.set(gx(i), 1.65, gz(j));
    ray.set(eye, up); ray.far = 6; let h = ray.intersectObjects(meshes, false)[0]; if (h && h.distance < minHead) { minHead = h.distance; headAt = [gx(i), gz(j)]; }
    for (let a = 0; a < 8; a++) { dir.set(Math.cos(a * Math.PI / 4), 0, Math.sin(a * Math.PI / 4)); ray.set(eye, dir); ray.far = 1; h = ray.intersectObjects(meshes, false)[0]; if (h && h.distance < minSide) { minSide = h.distance; sideAt = [gx(i), gz(j)]; } } }
  report.camera = { samples, nearPlane: I.camera.near, lowestCeilingAboveEyeM: +minHead.toFixed(2), closestGeometryToEyeM: +minSide.toFixed(2), closestAt: sideAt && sideAt.map(v => +v.toFixed(1)) };
  if (minHead < 0.2) problems.push(`Head clips a low object: only ${minHead.toFixed(2)} m above the eye near (${headAt.map(v => v.toFixed(1))})`);
  if (minSide <= I.camera.near * 1.2) problems.push(`Camera can see through geometry: ${minSide.toFixed(2)} m from the eye near (${sideAt.map(v => v.toFixed(1))}), near plane ${I.camera.near}`);

  I.crewBodies = savedCrew; report.problems = problems;
  console.log('Habitat walk test', report); return report;
})();

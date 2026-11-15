// Sleeping places in the habitat: the four crew cabins (hab-dressing.js) and the two storm-shelter bunks.
// Adds the cabin floors to the walkable area (you step through the doorway and stand beside the bunk),
// a "bunk" station per bed for E / Action, and the poses for lying down: your camera on the pillow, and a
// crewmate's astronaut stretched out on the mattress (remote-players.js). Everything is in the
// interior scene's own frame, measured once when the hab is built.
import * as THREE from 'three';

// cabin local frame (hab-dressing.js cabin()): doorway at z = 0, room behind it to z = -2.2, bunk along the
// left wall at x = -0.5 (pillow at z = -1.9), desk and shelves on the right wall at the far end.
const DOORWAY = { x0: -.3, x1: .3, z0: -.38, z1: .75 };    // through the 1 m door frame, out into the pod
const ROOM = { x0: .08, x1: .72, z0: -1.25, z1: 0 };       // floor beside the bunk, short of the desk
const MATTRESS = .58;

export class Bunks {
  constructor(interior) {
    this.list = []; this.cabins = [];
    const v = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3();
    for (const c of interior.habCabins ?? []) {
      // the cabin's frame in the hab (pods sit at the scene origin; the group itself is flattened when the pod is baked)
      const m = c.frame ? c.frame.clone() : (c.group.updateWorldMatrix(true, false), c.group.matrixWorld.clone()), inv = m.clone().invert();
      m.decompose(v, q, s);
      const toScene = (x, y, z) => new THREE.Vector3(x, y, z).applyMatrix4(m);
      const cab = { cabin: c, inv };
      this.cabins.push(cab);
      // lying on your back: the astronaut's head (+y) points to the pillow (-z), its front (+z) faces the ceiling
      const lie = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 0, -1), new THREE.Vector3(0, 1, 0)));
      const stand = toScene(.4, 0, -.55), station = toScene(.32, 0, -.75);
      this.list.push({
        id: 'cabin-' + c.person.id, cab, person: c.person,
        get label() { return c.person.id === 'you' ? 'sleep in your bunk' : c.lived.visible ? `check ${c.person.first}'s bunk` : 'sleep in the spare bunk'; },
        eye: toScene(-.5, MATTRESS + .3, -1.82), look: toScene(-.45, 1.45, -.2),
        body: { pos: toScene(-.5, MATTRESS + .2, -.08), quat: q.clone().multiply(lie) },
        stand, station,
      });
    }
    // storm-shelter bunks: two stacked beds across the back of the walk-in shelter room (hab-dressing.js)
    const sr = interior.shelterRoom;
    if (sr) {
      const m = sr.frame, q = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().extractRotation(m));
      const at = (x, y, z) => new THREE.Vector3(x, y, z).applyMatrix4(m);
      // lying along the bunk: head (+y) towards the room's -x end, front (+z) up
      const lie = q.clone().multiply(new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(new THREE.Vector3(0, 0, -1), new THREE.Vector3(-1, 0, 0), new THREE.Vector3(0, 1, 0))));
      [['low', sr.tops[0], -.35], ['high', sr.tops[1], .35]].forEach(([id, top, sx]) => this.list.push({
        id: 'shelter-' + id, shelter: true, label: `sleep in the ${id === 'low' ? 'lower' : 'upper'} storm-shelter bunk`,
        eye: at(-.8, top + .3, sr.bunkZ), look: at(.7, top + .5, sr.bunkZ),
        body: { pos: at(.95, top + .2, sr.bunkZ), quat: lie.clone() },
        stand: at(sx, 0, -1.15), station: at(sx, 0, -1.35),
      }));
      this.shelter = { inv: m.clone().invert(), walk: sr.walk, door: sr.door };
    }
    for (const b of this.list) interior.stations.push({ type: 'bunk', bunk: b.id, x: b.station.x, z: b.station.z, priority: .4, get label() { return b.label; } });
  }
  byId(id) { return this.list.find(b => b.id === id); }
  // Who (or what) is in the way of sleeping here? null when the bunk is free.
  // occupants: Map of player id -> { name, sl } for crewmates in co-op
  blocked(bunk, occupants, me) {
    const c = bunk.cab?.cabin;
    if (c && c.lived.visible && c.person.id !== 'you') {
      const first = c.person.first;
      return c.sleepDoor.visible ? `${first} is asleep in there. Shh!` : `That is ${first}'s bunk. Use your own cabin, a spare cabin or the storm-shelter bunks.`;
    }
    for (const [id, p] of occupants ?? []) if (id !== me && p.sl === bunk.id) return `${p.name} is already sleeping there.`;
    return null;
  }
  // Extra floor inside the cabins and the storm shelter. `from` is where you stand now: a cabin whose door has shut (a crewmate
  // went to sleep) only keeps you out if you are not already inside it.
  walkable(x, z, from) {
    const v = this._v ??= new THREE.Vector3();
    if (this.shelter) {   // the storm shelter room: floor in front of the bunks, between bench and suit, and its hatch
      const { inv, walk: w, door: d } = this.shelter; v.set(x, 0, z).applyMatrix4(inv);
      if ((v.x > w.x0 && v.x < w.x1 && v.z > w.z0 && v.z < w.z1) || (v.x > d.x0 && v.x < d.x1 && v.z > d.z0 && v.z < d.z1)) return true;
    }
    for (const { cabin, inv } of this.cabins) {
      v.set(x, 0, z).applyMatrix4(inv);
      const inRoom = v.x > ROOM.x0 && v.x < ROOM.x1 && v.z > ROOM.z0 && v.z < ROOM.z1;
      const inDoor = v.x > DOORWAY.x0 && v.x < DOORWAY.x1 && v.z > DOORWAY.z0 && v.z < DOORWAY.z1;
      if (!inRoom && !inDoor) continue;
      if (!cabin.sleepDoor.visible) return true;
      v.set(from.x, 0, from.z).applyMatrix4(inv);
      return v.z < -.05;   // already inside: you can always walk out (the door slides open for you)
    }
    return false;
  }
}

export { nightVote, canSleepAt, morningClock } from './night-vote.js';

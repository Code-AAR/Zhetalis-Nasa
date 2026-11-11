// Fires once when you walk or drive into a place's radius. Used for the discovery title cards on places that
// have no watcher of their own: landmarks (hills, craters, Ma'adim Vallis, Home Plate), the lookout towers, the
// survey sites, your lander, the greenhouse and the outpost itself. `repeat` places (the outpost) re-arm once you
// have gone well away, so coming home shows the card again, like arriving back at a village.
export class PlaceWatch {
  constructor(world, places, onEnter) {
    this.world = world; this.places = places; this.onEnter = onEnter; this.inside = new Set(); this.t = 0; this.primed = false;
    const upd = world.update.bind(world);
    world.update = (dt, active) => { upd(dt, active); this.tick(dt); };
  }
  tick(dt) {
    if ((this.t -= dt) > 0) return; this.t = .3;
    const p = this.world.driving ? this.world.sev?.pos : this.world.player?.position; if (!p) return;
    for (const pl of this.places) {
      const d = Math.hypot(p.x - pl.x, p.z - pl.z);
      if (this.inside.has(pl.id)) { if (pl.repeat && d > pl.r * 2.5) this.inside.delete(pl.id); continue; }
      if (d < pl.r) { this.inside.add(pl.id); if (this.primed) this.onEnter(pl); }   // where you start doesn't count
    }
    this.primed = true;
  }
}

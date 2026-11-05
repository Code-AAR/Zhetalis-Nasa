// Plays whole missions with simple strategies to check the trade-offs are real:
// a sensible plan should usually win, and ignoring a resource should lose.
// Run: node scripts/balance-test.mjs
import { readFileSync } from 'node:fs';
import { Outpost } from '../game/src/sim.js';
const facts = JSON.parse(readFileSync(new URL('../game/data/mars-facts.json', import.meta.url))).facts;

let seed = 7; const rng = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const strategies = {
  balanced:   { split: { life: 0.42, comms: 0.13, science: 0.25, shield: 0.2 }, shelter: true,  buy: true,  clean: 6 },
  noShield:   { split: { life: 0.45, comms: 0.15, science: 0.4,  shield: 0 },   shelter: false, buy: true,  clean: 6 },
  allScience: { split: { life: 0.15, comms: 0.15, science: 0.7,  shield: 0 },   shelter: false, buy: false, clean: 6 },
  noComms:    { split: { life: 0.45, comms: 0,    science: 0.3,  shield: 0.25 }, shelter: true, buy: true,  clean: 6 },
  neverClean: { split: { life: 0.42, comms: 0.13, science: 0.25, shield: 0.2 }, shelter: true,  buy: true,  clean: 0 },
  ignoreRad:  { split: { life: 0.45, comms: 0.15, science: 0.4,  shield: 0 },   shelter: false, buy: true,  clean: 6, noRadBuys: true },
};
const rows = [];
for (const diff of ['easy', 'normal', 'hard']) {
  for (const [name, s] of Object.entries(strategies)) {
    const results = [], tiers = [];
    for (let run = 0; run < 40; run++) {
      const o = new Outpost(diff, facts); o.setSplit(s.split);
      while (!o.over) {
        for (const ev of o.tick(rng)) {
          if (ev.type === 'solar-storm-warning') { o.startStorm(0.6 + rng() * 2.2, 'M', true); if (s.shelter) o.shelter = o.storm.sols; }
          if (ev.type === 'supply-launched') { o.o2 += 15; o.food += 20; o.parts += 3; }
        }
        if (o.sol % 3 === 0) o.parts += 1;                    // exploring finds about one part every few sols
        if (s.clean && o.sol % s.clean === 0) o.cleanPanels();  // walk out and wipe the panels
        if (s.buy) {
          const f = o.today;
          if (f.cold) o.buy('battery');
          else if (!o.upgrades.regolith && !s.noRadBuys) o.buy('regolith');
          else if (o.unlocked('reactor') && !o.reactors) o.buy('reactor');
          else if (f.o2Net < 0.1) o.buy(o.upgrades.moxie < 2 && o.unlocked('moxie') ? 'moxie' : 'panel');
          else if (f.foodNet < 0.1) o.buy(o.upgrades.greenhouse < 2 && o.unlocked('greenhouse') ? 'greenhouse' : 'panel');
          else if (o.dose > o.limit * 0.4 && o.upgrades.wall < 3 && !s.noRadBuys) o.buy('wall');
          else if (o.parts >= 8) o.buy('panel');
        }
        if (Number.isNaN(o.o2 + o.food + o.dose)) throw new Error('NaN in simulation');
      }
      results.push(o.over); tiers.push(o.tier);
    }
    const wins = results.filter(r => r.win).length, why = {};
    results.forEach(r => (why[r.win ? 'WIN:' + r.why : r.why] = (why[r.win ? 'WIN:' + r.why : r.why] || 0) + 1));
    console.log(`${diff.padEnd(6)} ${name.padEnd(10)} wins ${String(wins).padStart(2)}/40  ${JSON.stringify(why)}  avg tier ${(tiers.reduce((a, b) => a + b, 0) / tiers.length).toFixed(1)}`);
  }
}

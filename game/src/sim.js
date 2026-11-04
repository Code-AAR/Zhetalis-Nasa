// Outpost simulation: the trade-offs. No graphics here, so it can be tested on its own.
// Real values come from data/mars-facts.json; "tuned" values are game balance and labelled as such.

export const DIFFICULTY = {
  easy:   { label: 'Cadet',     sols: 100, crew: 2, o2: 40, food: 40, credits: 40, eventRate: 0.6, blurb: '100 sols, 2 crew. Gentle storms.' },
  normal: { label: 'Explorer',  sols: 300, crew: 3, o2: 30, food: 30, credits: 20, eventRate: 1.0, blurb: '300 sols, 3 crew. Real trade-offs.' },
  hard:   { label: 'Commander', sols: 500, crew: 4, o2: 25, food: 25, credits: 0,  eventRate: 1.4, blurb: "500 sols, 4 crew - the length of NASA's long-stay plan." },
};

export const TUNED = {
  solSeconds: 10,          // real seconds per sol
  kWhPerPanel: 5,          // per clear sol
  o2PerKWh: 0.45,          // kg O2 from the oxygen maker per kWh (game balance)
  foodPerKWh: 1.25,        // rations from the greenhouse per kWh (game balance)
  o2Share: 0.7,            // life-support power split: 70% oxygen maker, 30% greenhouse
  commsNeedKWh: 2,         // power needed per sol to keep the Earth link up
  shieldFullKWh: 4,        // power per sol for full storm-shelter systems
  shieldCut: 0.6,          // full shield removes 60% of radiation inside
  wallCut: 0.15,           // each water-wall upgrade removes 15% more
  supplyEvery: 20,         // Earth can send a supply pod every 20 sols
  stormDose: 45,           // extra mSv from an unshielded solar storm (stronger than reality - see facts)
  suitSeconds: 75,         // seconds of EVA on a full suit tank
};

export const UPGRADES = {
  panel:      { name: 'Extra solar panel', cost: 40, desc: '+5 kWh every clear sol.' },
  wall:       { name: 'Water-wall shielding', cost: 60, desc: 'Water tanks in the walls block 15% more radiation. Real Mars habitat plans use water and soil as shields.' },
  greenhouse: { name: 'Bigger greenhouse', cost: 50, desc: 'Grows 40% more food from the same power.' },
  moxie:      { name: 'Better oxygen maker', cost: 50, desc: 'Makes 30% more oxygen from the same power - like an upgraded MOXIE.' },
  suit:       { name: 'Suit tank upgrade', cost: 30, desc: 'Stay outside 50% longer.' },
};

const C = 299792.458; // km/s

export class Outpost {
  constructor(difficulty, facts) {
    const d = DIFFICULTY[difficulty];
    this.d = d; this.facts = facts;
    this.sol = 0;
    this.crew = d.crew;
    this.o2 = d.o2;                 // kg in the base tanks
    this.food = d.food;             // crew-day rations
    this.credits = d.credits;
    this.dose = 0;                  // mSv, the player's radiation badge
    this.science = 0;               // research waiting to be sent to Earth
    this.scienceSent = 0;
    this.panels = 4;
    this.upgrades = { wall: 0, greenhouse: 0, moxie: 0, suit: 0 };
    this.split = { life: 0.4, comms: 0.15, science: 0.25, shield: 0.2 };
    this.dust = 0;                  // sols of dust storm left
    this.shelter = 0;               // sols left hiding in the storm shelter
    this.blackout = 0;              // sols of solar-conjunction comms blackout left
    this.storm = null;              // active solar storm { sols, strength, label, real }
    this.hungry = 0;
    this.nextSupply = TUNED.supplyEvery;
    this.pods = [];                 // supply pods that have landed and wait to be collected
    this.log = [];
    this.over = null;
    this.today = this.forecast();
  }

  get limit() { return this.facts.careerLimit.value; }
  get o2Need() { return this.crew * this.facts.oxygen.value; }

  // Earth-Mars distance varies over the real 780-day cycle (NSSDC min/max).
  distanceKm(sol = this.sol) {
    const { min, max } = this.facts.distance;
    const phase = (sol / this.facts.synodic.value) * Math.PI * 2 + 2.2; // start partway through a cycle
    return ((min + max) / 2 + (max - min) / 2 * Math.cos(phase)) * 1e6;
  }
  delayMinutes(sol = this.sol) { return this.distanceKm(sol) / C / 60; }

  energy() {
    const dustCut = this.dust > 0 ? 0.35 : 1;
    return this.panels * TUNED.kWhPerPanel * dustCut;
  }

  setSplit(split) {
    const total = Object.values(split).reduce((a, b) => a + b, 0) || 1;
    for (const k of Object.keys(this.split)) this.split[k] = split[k] / total;
    this.today = this.forecast();
  }

  // What one sol will look like with the current choices - shown live in the power panel.
  forecast() {
    const e = this.energy();
    const life = e * this.split.life;
    const o2 = life * TUNED.o2Share * TUNED.o2PerKWh * (1 + 0.3 * this.upgrades.moxie);
    const food = life * (1 - TUNED.o2Share) * TUNED.foodPerKWh * (1 + 0.4 * this.upgrades.greenhouse);
    const commsKWh = e * this.split.comms;
    const link = commsKWh >= TUNED.commsNeedKWh && this.blackout === 0;
    const shieldLevel = Math.min(1, (e * this.split.shield) / TUNED.shieldFullKWh);
    const protection = Math.min(0.92, TUNED.shieldCut * shieldLevel + TUNED.wallCut * this.upgrades.wall);
    const dose = this.facts.surfaceDose.value * (1 - protection);
    const science = e * this.split.science * (this.shelter > 0 ? 0 : 1);
    return { energy: e, o2, o2Net: o2 - this.o2Need, food, foodNet: food - this.crew, link, shieldLevel, protection, dose, science };
  }

  // Advance one sol. Returns events the UI should show.
  tick(rng = Math.random) {
    if (this.over) return [];
    const events = [];
    const f = this.forecast();
    this.sol += 1;

    this.o2 = Math.max(0, this.o2 + f.o2Net);
    this.food = Math.max(0, this.food + f.foodNet);
    let dose = f.dose;
    if (this.storm) {
      const sheltered = this.shelter > 0;
      const extra = this.storm.strength * TUNED.stormDose / this.storm.total * (1 - f.protection) * (sheltered ? 0.15 : 1);
      dose += extra;
      if (--this.storm.sols <= 0) { events.push({ type: 'storm-end', storm: this.storm }); this.storm = null; }
    }
    this.dose += dose;
    this.science += f.science;
    if (f.link && this.science > 0) {
      const sent = Math.round(this.science);
      this.scienceSent += sent; this.credits += sent; this.science = 0;
    }
    if (this.shelter > 0) this.shelter -= 1;
    if (this.dust > 0 && --this.dust === 0) events.push({ type: 'dust-end' });
    if (this.blackout > 0 && --this.blackout === 0) events.push({ type: 'blackout-end' });

    // Supply pods from Earth only come if the link was up when the launch window opened.
    if (this.sol >= this.nextSupply) {
      this.nextSupply = this.sol + TUNED.supplyEvery;
      if (f.link) events.push({ type: 'supply-launched', delay: this.delayMinutes() });
      else events.push({ type: 'supply-missed' });
    }

    // Solar conjunction: near maximum distance the Sun sits between Earth and Mars.
    const { max } = this.facts.distance;
    if (this.blackout === 0 && this.distanceKm() > max * 1e6 * 0.995 && !this._conjunctionDone) {
      this._conjunctionDone = true;
      this.blackout = this.facts.conjunction.value;
      events.push({ type: 'conjunction' });
    }
    if (this.distanceKm() < max * 1e6 * 0.9) this._conjunctionDone = false;

    // Random events, scaled by difficulty. Solar storms are filled in from real data by main.js.
    const r = rng();
    if (!this.storm && r < 0.035 * this.d.eventRate) events.push({ type: 'solar-storm-warning' });
    else if (this.dust === 0 && r > 1 - 0.02 * this.d.eventRate) { this.dust = 5 + Math.floor(rng() * 6); events.push({ type: 'dust', sols: this.dust }); }

    // Win / lose checks, explained in kid language by the UI.
    if (this.o2 <= 0) this.over = { win: false, why: 'oxygen' };
    if (this.food <= 0) { if (++this.hungry >= 3) this.over = { win: false, why: 'food' }; } else this.hungry = 0;
    if (this.dose >= this.limit) this.over = { win: false, why: 'radiation' };
    if (!this.over && this.sol >= this.d.sols) this.over = { win: true, why: 'complete' };
    this.today = this.forecast();
    return events;
  }

  startStorm(strength, label, real) {
    this.storm = { sols: 2 + Math.round(strength), total: 2 + Math.round(strength), strength, label, real };
  }

  buy(key) {
    const u = UPGRADES[key];
    if (!u || this.credits < u.cost) return false;
    this.credits -= u.cost;
    if (key === 'panel') this.panels += 1; else this.upgrades[key] += 1;
    this.today = this.forecast();
    return true;
  }

  suitSeconds() { return TUNED.suitSeconds * (1 + 0.5 * this.upgrades.suit); }

  score() {
    return Math.round(this.scienceSent * 10 + this.sol * 5 + Math.max(0, this.limit - this.dose));
  }
}

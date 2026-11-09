// Outpost simulation: the trade-offs. No graphics here, so it can be tested on its own.
// Real values come from data/mars-facts.json; "tuned" values are game balance and labelled as such.

export const DIFFICULTY = {
  easy:   { label: 'Cadet',     sols: 60,  crew: 2, o2: 30, food: 30, parts: 6, eventRate: 0.7, blurb: '60 sols, 2 crew. Gentle storms.' },
  normal: { label: 'Explorer',  sols: 120,  crew: 3, o2: 25, food: 25, parts: 3, eventRate: 1.0, blurb: '120 sols, 3 crew. Real trade-offs.' },
  hard:   { label: 'Commander', sols: 240, crew: 4, o2: 22, food: 22, parts: 0, eventRate: 1.4, blurb: '240 sols, 4 crew. Big storms, long nights.' },
};

// Where you land changes the game. Each site is a real place on Mars; the numbers (solar, ice, dose...) are
// game balance that follow the real trade-off described in `why` - they are not measurements.
export const SITES = {
  gusev:  { name: 'Gusev Crater', short: 'Gusev', icon: '', solar: 1.05, ice: 0.6, dose: 1, science: 1.3, heater: 1, dust: 1.05, parts: 0,
    blurb: 'Where Spirit landed in 2004. The ground in this game is built from NASA height data of this crater.',
    why: "Gusev may once have held a lake. Spirit found signs of hot water in the hills nearby. Ice is deep near the equator." },
  plains: { name: 'Arcadia Planitia', short: 'Plains', icon: '🟫', solar: 1, ice: 1, dose: 1, science: 1, heater: 1, dust: 1, parts: 0,
    blurb: 'Flat ground with ice just under the dust. A good place to start.',
    why: "Orbiters found water ice just under the surface of these northern plains, and the flat ground is easy to build on." },
  polar:  { name: 'Near the north pole', short: 'Pole (hard)', icon: '🧊', solar: 0.85, ice: 2, dose: 1, science: 1, heater: 1.25, dust: 0.8, parts: 0,
    blurb: 'Lots of ice - but cold, with weak sunlight for your solar panels.',
    why: "Near the pole there is plenty of ice, but the Sun stays low in the sky and the nights are very cold." },
  jezero: { name: 'Jezero Crater', short: 'Jezero', icon: '🔬', solar: 1.1, ice: 0.5, dose: 1, science: 1.5, heater: 1, dust: 1.1, parts: 0,
    blurb: 'An old lake where Perseverance looks for signs of past life. Great science, little ice.',
    why: "Jezero was a lake billions of years ago - the best place to look for signs of ancient life. Near the equator, ice is buried deep." },
  cave:   { name: 'Lava tube, Tharsis', short: 'Lava cave', icon: '🕳', solar: 0.9, ice: 0.7, dose: 0.55, science: 0.9, heater: 0.9, dust: 1, parts: -2,
    blurb: 'A rock roof blocks radiation - but it is hard to reach and build in.',
    why: "Orbiters have photographed holes that may be skylights into lava tubes. Metres of rock overhead would block a lot of radiation." },
};

export const TUNED = {
  solSeconds: 300,         // A full day/night cycle takes 5 real minutes at normal speed
  dayStart: 0.25, dayEnd: 0.75,   // fraction of the sol that is daylight
  kWhPerPanel: 6,          // per clear sol, with clean panels
  heaterKWh: 4,            // the heater keeps the crew warm at night - it runs from the batteries
  batteryStart: 4,         // kWh the starting batteries hold
  batteryUpgrade: 4,       // kWh each battery upgrade adds
  reactorKWh: 12,          // per sol, day and night, dust or not (game-sized version of NASA's 40 kW design)
  dustPerSol: 0.012,       // how much the panels' cleanliness drops each sol
  dustStormDust: 0.05,     // ...and each sol of a dust storm
  o2PerKWh: 0.45,          // kg O2 from the oxygen maker per kWh
  foodPerKWh: 1.25,        // rations from the greenhouse per kWh
  o2Share: 0.7,            // life-support power: 70% oxygen maker, 30% greenhouse
  commsNeedKWh: 2,         // power per sol to keep the Earth link up through the relay orbiters
  directToEarthFactor: 2.5,// with a relay orbiter lost, talking straight to Earth needs 2.5x the power
  shieldFullKWh: 4,        // power per sol for the storm-shelter systems
  shieldCut: 0.6,          // full shield power removes 60% of radiation inside
  wallCut: 0.15,           // water walls remove 15% more
  regolithCuts: [0, 0.18, 0.28, 0.33],   // Mars soil piled on the outpost: 0, 1, 2, 3 layers. Each layer helps less than the one before
  supplyEvery: 12,         // Earth can send a supply pod every 12 sols
  stormDose: 110,          // extra mSv from an unshielded solar storm (stronger than reality - see facts)
  suitSeconds: 120,         // seconds of spacewalk on a full suit tank (in daylight)
  coldSuit: 1.4,           // at night the suit uses air 40% faster (its heater works harder)
  hazardLead: 2,           // sols between a storm being spotted and it arriving
  surpriseDose: 0.6,       // a solar storm nobody saw coming: the crew takes this share of a storm-sol's dose before reaching shelter
};

// Tiers from the storyboard: the base grows as Earth receives your science.
// Each tier unlocks new designs, so kids learn a few systems at a time.
export const TIERS = [
  { name: 'Landing camp',              science: 0 },
  { name: 'Sealed base',               science: 40 },
  { name: 'Industrial outpost',        science: 120 },
  { name: 'Self-sustaining settlement', science: 260 },
];

// No money: you BUILD upgrades from parts you salvage outside, and Earth's engineers radio you
// the DESIGN once your base reaches that tier.
export const UPGRADES = {
  suit:       { name: 'Suit tank upgrade',     parts: 3,  tier: 0, desc: 'Stay outside 50% longer.' },
  battery:    { name: 'Extra battery',         parts: 3,  tier: 0, desc: `Stores ${TUNED.batteryUpgrade} kWh more for the night, so the heater never runs out.` },
  regolith:   { name: 'Add a layer of Mars soil (regolith)', parts: 3, tier: 0, max: 3, desc: 'Pile another half metre of Mars soil on the outpost to block radiation. The first layer helps most - each extra layer helps less.' },
  panel:      { name: 'Extra solar panel',     parts: 4,  tier: 1, desc: `+${TUNED.kWhPerPanel} kWh every clear sol (only in daylight).` },
  greenhouse: { name: 'Bigger greenhouse',     parts: 5,  tier: 1, desc: 'Adds 40% to each grow bed’s harvest.' },
  moxie:      { name: 'Better oxygen maker',   parts: 5,  tier: 2, desc: 'Makes 30% more oxygen from the same power - like an upgraded MOXIE.' },
  wall:       { name: 'Water-wall shielding',  parts: 6,  tier: 2, desc: 'Water tanks in the walls block 15% more radiation.' },
  reactor:    { name: 'Small fission reactor', parts: 12, tier: 3, once: true, desc: `+${TUNED.reactorKWh} kWh every sol, day and night, even in dust storms. NASA is designing one for the Moon and Mars.` },
};
for (const u of Object.values(UPGRADES)) u.unlockAt = TIERS[u.tier].science;

const C = 299792.458; // km/s

export class Outpost {
  constructor(difficulty, facts, site = 'plains') {
    const d = DIFFICULTY[difficulty];
    this.d = d; this.facts = facts; this.site = SITES[site] ? site : 'plains';
    this.sol = 0;
    this.crew = d.crew;
    this.o2 = d.o2;
    this.food = this.crew * 3;
    this.rations = d.food;
    this.powerStep = 0; this.baseConnected=false; this.chargerStep=0; this.roverCharged=false; this.soilStep=0; this.chargeReserve=0;
    this.harvestMeals = 0;
    this.parts = Math.max(0, d.parts + SITES[this.site].parts);
    this.dose = 0; this.science = 0; this.scienceSent = 0;
    this.panels = 0; this.clean = 1;                       // panel cleanliness 0..1
    this.battery = TUNED.batteryStart; this.reactors = 0;
    this.upgrades = { suit: 0, battery: 0, regolith: 0, greenhouse: 0, moxie: 0, wall: 0 };
    this.split = { life: 0.4, comms: 0.15, science: 0.25, shield: 0.2 };
    this.dust = 0; this.shelter = 0; this.blackout = 0; this.relayDown = 0;
    this.storm = null; this.hungry = 0; this.coldLast = false;
    this.hazards = [];   // storms the instruments have spotted but that haven't arrived yet
    this.nextSupply = TUNED.supplyEvery;
    this.over = null;
    this.today = this.forecast();
  }

  get s() { return SITES[this.site] || SITES.plains; }
  get limit() { return this.facts.careerLimit.value; }
  get o2Need() { return this.crew * this.facts.oxygen.value; }
  get tier() { let t = 0; TIERS.forEach((x, i) => { if (this.scienceSent >= x.science) t = i; }); return t; }

  // Earth-Mars distance over the real 780-day cycle (NSSDC min/max); a conjunction comes around sol 50.
  distanceKm(sol = this.sol) {
    const { min, max } = this.facts.distance;
    const phase = (sol / this.facts.synodic.value) * Math.PI * 2 + 2.74;
    return ((min + max) / 2 + (max - min) / 2 * Math.cos(phase)) * 1e6;
  }
  delayMinutes(sol = this.sol) { return this.distanceKm(sol) / C / 60; }

  solar() { if(this.powerStep<6 || this.baseConnected===false)return 0; return this.panels * TUNED.kWhPerPanel * this.s.solar * this.clean * (this.dust > 0 ? 0.35 : 1); }
  chargerAllocation() { return this.chargerStep>=3 ? Math.max(0,this.energy()-TUNED.heaterKWh)*.15 : 0; }
  energy() { return this.solar() + this.reactors * TUNED.reactorKWh; }

  setSplit(split) {
    const total = Object.values(split).reduce((a, b) => a + b, 0) || 1;
    for (const k of Object.keys(this.split)) this.split[k] = split[k] / total;
    this.today = this.forecast();
  }

  // What one sol looks like with the current choices - shown live in the power console.
  forecast() {
    const total = Math.max(0,this.energy()-this.chargerAllocation());
    const heater = TUNED.heaterKWh * this.s.heater;
    const cold = this.battery < heater && this.reactors === 0;   // batteries run flat before morning
    const e = Math.max(0, total - heater);                       // the heater's night power is set aside first
    const lifeK = e * this.split.life * (cold ? 0.7 : 1);         // freezing machines work worse
    const o2 = lifeK * TUNED.o2Share * TUNED.o2PerKWh * (1 + 0.3 * this.upgrades.moxie);
    const food = 0; // Stored meals come from the locker, deliveries and harvested beds.
    const commsNeed = TUNED.commsNeedKWh * (this.relayDown > 0 ? TUNED.directToEarthFactor : 1);
    const link = e * this.split.comms >= commsNeed && this.blackout === 0;
    const shieldLevel = Math.min(1, (e * this.split.shield) / TUNED.shieldFullKWh);
    const protection = Math.min(0.92, TUNED.shieldCut * shieldLevel + TUNED.wallCut * this.upgrades.wall + TUNED.regolithCuts[Math.min(3, this.upgrades.regolith)]);
    const dose = this.facts.surfaceDose.value * this.s.dose * (1 - protection);
    const science = e * this.split.science * this.s.science * (this.shelter > 0 ? 0 : 1);
    return { total, solar: this.solar(), energy: e, heater, cold, o2, o2Net: o2 - this.o2Need, food, foodNet: food - this.crew,
             link, commsNeed, shieldLevel, protection, dose, science };
  }

  cleanPanels() { this.clean = 1; this.today = this.forecast(); }

  // Advance one sol. Returns events the UI should show.
  tick(rng = Math.random) {
    if (this.over) return [];
    const events = [];
    const f = this.forecast();
    const tierBefore = this.tier;
    this.sol += 1;

    this.o2 = Math.max(0, this.o2 + f.o2Net);
    const fed = this.food >= this.crew;
    this.food = Math.max(0, this.food + f.foodNet);
    if (f.cold) events.push({ type: 'cold-night' });
    let dose = f.dose;
    if (this.storm) {
      const extra = this.storm.strength * TUNED.stormDose / this.storm.total * (1 - f.protection) * (this.shelter > 0 ? 0.15 : 1);
      dose += extra;
      if (--this.storm.sols <= 0) { events.push({ type: 'storm-end', storm: this.storm }); this.storm = null; }
    }
    this.dose += dose;
    this.science += f.science;
    if (f.link && this.science > 0) { this.scienceSent += Math.round(this.science); this.science = 0; }
    if (this.tier > tierBefore) events.push({ type: 'tier-up', tier: this.tier });

    // dust settles on the panels; once in a while the wind blows some off (it really happened to Spirit and Opportunity)
    this.clean = Math.max(0.3, this.clean - TUNED.dustPerSol - (this.dust > 0 ? TUNED.dustStormDust : 0));
    if (this.dust === 0 && rng() < 0.02) { this.clean = Math.min(1, this.clean + 0.25); events.push({ type: 'wind-clean' }); }

    // A dust storm drops a fresh coat of bright dust over the dark ground; afterwards dust devils and wind sweep it
    // off again over the next sols (it happens on real Mars; here it is faster, game balance). world.js shows it.
    this.dustCover = this.dust > 0 ? Math.min(1, (this.dustCover || 0) + .4) : Math.max(0, (this.dustCover || 0) - .12);
    if (this.shelter > 0) this.shelter -= 1;
    if (this.dust > 0 && --this.dust === 0) events.push({ type: 'dust-end' });
    if (this.blackout > 0 && --this.blackout === 0) events.push({ type: 'blackout-end' });
    if (this.relayDown > 0 && --this.relayDown === 0) events.push({ type: 'relay-restored' });

    if (this.sol >= this.nextSupply) {
      this.nextSupply = this.sol + TUNED.supplyEvery;
      events.push(f.link ? { type: 'supply-launched', delay: this.delayMinutes() } : { type: 'supply-missed' });
    }

    // Solar conjunction: near maximum distance the Sun sits between Earth and Mars.
    const { max } = this.facts.distance;
    if (this.blackout === 0 && this.distanceKm() > max * 1e6 * 0.995 && !this._conj) { this._conj = true; this.blackout = this.facts.conjunction.value; events.push({ type: 'conjunction' }); }
    if (this.distanceKm() < max * 1e6 * 0.9) this._conj = false;

    // Hazards the instruments spotted earlier arrive now (see `hazards` below).
    for (const h of this.hazards.filter(x => x.at <= this.sol)) {
      this.hazards.splice(this.hazards.indexOf(h), 1);
      if (h.kind === 'solar' && !this.storm) events.push({ type: 'solar-storm-warning', seen: h.seen, plan: h.plan });
      if (h.kind === 'dust' && this.dust === 0) { this.dust = h.sols; events.push({ type: 'dust', sols: h.sols, seen: h.seen }); }
    }
    // Random events, scaled by difficulty. Solar storms are filled in from real data by main.js.
    // Storms are DETECTED first and arrive TUNED.hazardLead sols later, like real space weather: a burst of
    // particles from the Sun takes hours to days to cross space, and orbiters photograph dust storms as they grow.
    // Only the base's hazard monitor shows these early warnings - players who check it can prepare.
    const r = rng(), rate = this.d.eventRate, pendingKind = k => this.hazards.some(h => h.kind === k);
    const lead = TUNED.hazardLead;
    if (!this.storm && !pendingKind('solar') && r < 0.06 * rate) this.hazards.push({ kind: 'solar', at: this.sol + lead, found: this.sol, seen: false });
    else if (this.dust === 0 && !pendingKind('dust') && r > 1 - 0.03 * rate * this.s.dust) this.hazards.push({ kind: 'dust', at: this.sol + lead, found: this.sol, sols: 4 + Math.floor(rng() * 5), seen: false });
    else if (this.relayDown === 0 && this.sol > 8 && r > 0.5 && r < 0.5 + 0.012 * rate) { this.relayDown = 15; events.push({ type: 'relay-lost' }); }
    if (this.hazards.some(h => !h.seen)) events.push({ type: 'hazard-detected' });

    if (this.o2 <= 0) this.over = { win: false, why: 'oxygen' };
    if (!fed) { if (++this.hungry >= 3) this.over = { win: false, why: 'food' }; } else this.hungry = 0;
    if (this.dose >= this.limit) this.over = { win: false, why: 'radiation' };
    const t = this.forecast();
    if (!this.over && this.tier === 3 && this.reactors > 0 && t.o2Net >= 0 && this.harvestMeals / this.sol >= this.crew && this.sol >= this.d.sols * .75)
      this.over = { win: true, why: 'settlement' };   // self-sufficient, and it has proved it for three quarters of the mission
    if (!this.over && this.sol >= this.d.sols) this.over = { win: true, why: 'complete' };
    this.today = t;
    return events;
  }

  startStorm(strength, label, real) {
    this.storm = { sols: 2 + Math.round(strength), total: 2 + Math.round(strength), strength, label, real };
  }

  unlocked(key) { if(this.powerStep<6 && ['panel','battery'].includes(key))return false; return this.tier >= UPGRADES[key].tier; }
  built(key) { const u = UPGRADES[key]; return key === 'reactor' ? this.reactors > 0 : u?.max ? this.upgrades[key] >= u.max : false; }

  buy(key) {
    const u = UPGRADES[key];
    if (!u || (key === 'panel' && this.panels >= 12) || !this.unlocked(key) || this.parts < u.parts || ((u.once || u.max) && this.built(key))) return false;
    this.parts -= u.parts;
    if (key === 'panel') this.panels += 1;
    else if (key === 'battery') { this.upgrades.battery += 1; this.battery += TUNED.batteryUpgrade; }
    else if (key === 'reactor') this.reactors += 1;
    else this.upgrades[key] += 1;
    this.today = this.forecast();
    return true;
  }

  suitSeconds() { return TUNED.suitSeconds * (1 + 0.5 * this.upgrades.suit); }

  score() { return Math.round(this.scienceSent * 10 + this.sol * 5 + Math.max(0, this.limit - this.dose) + this.tier * 200); }
}

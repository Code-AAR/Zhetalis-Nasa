// Moon mission constants. Physics values are real (NASA NSSDC Moon Fact Sheet); gameplay rates are tuned
// for 7-12 year olds and are labelled as game rules wherever they appear.
export const MOON = Object.freeze({
  gravity: 1.62,            // m/s^2  https://nssdc.gsfc.nasa.gov/planetary/factsheet/moonfact.html
  synodicDays: 29.53,       // Earth days from sunrise to sunrise
  radiusKm: 1737.4,
  sunTiltDeg: 1.54,         // Sun declination swing seen from the Moon (axis tilt to the ecliptic)
});

// One full lunar day squeezed into this many real seconds of play (a game rule, told to the player).
export const GAME_DAY_SECONDS = 300;   // 5 real minutes = one 29.53-Earth-day lunar day (same pace as a Mars sol in the Mars game)
export const earthDaysPerGameSecond = MOON.synodicDays / GAME_DAY_SECONDS;

// The walkable training area is a bounded square. Detailed terrain streams in chunks around the player.
export const WORLD = Object.freeze({ half: 480, chunk: 80, detailRadius: 'map', maxDetailed: 49 });
export const CHUNKS_PER_SIDE = (WORLD.half * 2) / WORLD.chunk;   // 12

// Places on the map (metres; x east, z south). The base sits on the sunny ridge; the ice is in a crater
// whose floor never sees the Sun.
export const SITES = Object.freeze({
  lander: { x: 0, z: 0, r: 7 },
  processor: { x: 16, z: 10, r: 2.4 },
  antenna: { x: -14, z: 12, r: 1.6 },
  masts: [{ x: 22, z: -14 }, { x: 60, z: -48 }, { x: -70, z: -40 }],
  iceCrater: { x: 210, z: 170, r: 78, depth: 20 },
  drill: { x: 210, z: 170 },
  rover: { x: -12, z: -14 },
  samples: [
    { id: 'anorthosite', x: -120, z: 60, name: 'Bright highland rock (anorthosite)', science: 12 },
    { id: 'breccia', x: 130, z: -110, name: 'Impact breccia (smashed and re-glued rock)', science: 10 },
    { id: 'glass', x: -60, z: 190, name: 'Impact glass beads', science: 14 },
    { id: 'ejecta', x: 260, z: 60, name: 'Fresh crater ejecta', science: 10 },
  ],
  seismometer: { x: -150, z: -150 },
  reflector: { x: 90, z: 130 },
});

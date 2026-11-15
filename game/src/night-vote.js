// Night-skip rules, kept free of three.js so they can be tested in Node (scripts/test-night-vote.mjs).
// Minecraft-style night skip. players: [{ sleeping, vote }]. A strict majority must be ready
// (asleep in a bunk, or awake and voting to skip). Everyone in a bunk always counts as a majority.
export function nightVote(players) {
  const total = players.length, ready = players.filter(p => p.sleeping || p.vote).length;
  const need = Math.floor(total / 2) + 1;
  return { total, ready, need, sleeping: players.filter(p => p.sleeping).length, skip: total > 0 && ready >= need };
}
// Night is from just before sunset until sunrise (sim.js TUNED.dayStart / dayEnd).
export const canSleepAt = (phase, dayStart, dayEnd) => phase > dayEnd - .03 || phase < dayStart - .005;
// Clock value (seconds into the sol) for the morning after `phase`. Beyond solSeconds means "tomorrow":
// the main loop rolls the sol over (supplies, crops, power) exactly as if the night had passed.
export function morningClock(phase, solSeconds, dayStart) {
  const wake = (dayStart + .01) * solSeconds;
  return phase > .5 ? solSeconds + wake : Math.max(wake, phase * solSeconds);
}

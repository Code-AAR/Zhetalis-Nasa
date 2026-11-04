const out = { source: "NOAA Space Weather Prediction Center (GOES satellites)", sourceUrl: "https://www.swpc.noaa.gov/", fetched: new Date().toISOString() };
for (const [k, u] of Object.entries({
  flares: "https://services.swpc.noaa.gov/json/goes/primary/xray-flares-7-day.json",
  protons: "https://services.swpc.noaa.gov/json/goes/primary/integral-protons-1-day.json",
  scales: "https://services.swpc.noaa.gov/products/noaa-scales.json" })) {
  const r = await fetch(u, { signal: AbortSignal.timeout(30000) }); out[k] = await r.json();
}
out.protons = out.protons.filter(p => p.energy === ">=10 MeV");
(await import("node:fs")).writeFileSync("game/data/space-weather-snapshot.json", JSON.stringify(out));
console.log("snapshot:", out.flares.length, "flares,", out.protons.length, "proton readings, scales date", out.scales["0"].DateStamp);
console.log("biggest flare this week:", out.flares.map(f => f.max_class).sort().at(-1));

# Junior Astronaut: Mars Outpost

A browser game for kids aged 7-12, built by team Zhetalis for the NASA Space Apps Challenge 2026
(*Build a Junior Astronaut Mission Trainer*). No download or account - it runs in any modern browser.

You land at a Mars outpost in the year 2126 and keep your crew alive by splitting limited solar power
between **life support** (oxygen and food), **talking to Earth** (science and supply pods),
**science**, and **radiation shielding**. There is never enough power for everything - just like for
real mission planners.

Day turns to night (with a blue Mars sunset), so batteries must keep the heater on until morning.
Dust covers the solar panels and has to be cleaned off, relay orbiters can fail, and you can bury the
outpost in regolith to block radiation. Sending science to Earth unlocks new designs in four tiers,
from a landing camp up to a self-sustaining settlement with a fission reactor.

## Which NASA data we use, and why

| Data | Used for | Live or saved |
|---|---|---|
| NOAA Space Weather Prediction Center - GOES X-ray flares, proton flux, NOAA scales | Every solar storm in the game is based on a real flare. The title screen shows what the Sun did this week. | **Live** when it loads, otherwise a saved snapshot (labelled ARCHIVED) |
| NASA DONKI (CCMC) space weather database | Two years of real flares for storm events | Saved snapshot (when DONKI is online) |
| Curiosity RAD measurements (Hassler et al., *Science* 2014) | 0.64 mSv/day on the surface, 1.84 mSv/day in cruise | Built in, with source |
| NASA radiation standard (OCHMO technical brief) | 600 mSv career limit = the radiation badge | Built in, with source |
| NASA Mars Fact Sheet (NSSDC) | Gravity 3.73 m/s² (used for jumping), sol length, 43% sunlight, temperature, air, Earth-Mars distance (54.6-401.4 million km → 3 to 22 minute radio delay) | Built in, with source |
| NASA Life Support BVAD | About 0.82 kg oxygen per astronaut per day | Built in, with source |
| NASA SLS fact sheet, Orion, Artemis II, Human Landing Systems pages | The SLS launch scene and the step-by-step "How do we get there?" explainer (SLS → Orion → lunar orbit → HLS → Moon) | Built in, with sources |
| NASA Moon to Mars Architecture | How a future Mars crew would travel: transit habitat, Mars lander, ascent vehicle (a plan still being designed) | Built in, with source |
| NASA - Growing plants in space | The greenhouse station | Built in, with source |
| NASA Mars facts, SVS blue sunset (Curiosity 2015), Spirit dusty panels, MAVEN/DSN relay | Day/night length and temperature swing, blue sunset, panel cleaning, relay orbiter failure | Built in, with sources |
| Regolith shielding study (JGR Planets 2019), NASA Fission Surface Power (IAC 2024) | Burying the outpost; the 40 kW reactor in the last tier | Built in, with sources |
| NASA/JPL-Caltech Perseverance 3D model | The old rover you salvage | Asset |
| NASA 3D Resources: SLS Block 1, Mobile Launcher, Mars Reconnaissance Orbiter, Ingenuity | The launch (SLS really drops its stages), the relay orbiter at Mars, the helicopter near the rover | Assets (NASA's own models) |
| NASA Perseverance SuperCam microphone recording (sol 4) | The wind you hear on Mars is a real recording from Mars | Asset (NASA audio) |
| NASA/JPL Perseverance sound study | Mars is quiet (sound fades after ~8 m), so the soundscape is soft and muffled; fact card | Built in, with source |
| Curiosity rover REMS daily weather | Real high/low temperature, air pressure and sunrise in the outpost window | Saved by script (dated) |
| NASA JPL Horizons | Today's real Earth-Mars distance and radio delay on the console | Saved by script (dated) |
| NASA Image and Video Library | A real photo of the Artemis II launch (1 April 2026) in the "How do we get there?" explainer | **Live**, or saved (ARCHIVED) |
| Perseverance raw images (NASA/JPL-Caltech/ASU) | The outpost window shows the rover's newest colour photos of Jezero Crater | **Live**, or a saved list (ARCHIVED) |
| NASA EPIC camera on DSCOVR | Today's whole-Earth photo on the power console - the people you are radioing | **Live**, or saved (ARCHIVED) |
| NASA Mars Trek (Viking colour mosaic) | The 3D Mars globe you arrive at, with Jezero Crater marked | **Live** map tiles |
| NASA Artemis I timeline, Basics of Space Flight, JPL "7 Minutes to Mars" | Launch phases, the launch window / Hohmann transfer, and the landing sequence | Built in, with sources |

Playing is a learning journey: every fact a player meets is saved in a **logbook**, and the mission ends with a
short quiz on those facts for a Gold, Silver or Bronze **Junior Astronaut badge**.

Game-balance numbers (how fast a sol passes, how strong storms are, how much a panel makes) are not
measurements; the in-game "Real NASA data used" panel lists them separately so nobody mistakes them for science.

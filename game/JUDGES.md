# Junior Astronaut: Mars Outpost - guide for judges

**Team Zhetalis · NASA Space Apps Challenge 2026 · "Build a Junior Astronaut Mission Trainer"**

**Play:** https://code-aar.github.io/Zhetalis-Nasa/game/ - in the browser, no download, no account.
Works with keyboard and mouse, and with touch on phones and tablets.

A game for kids aged 7-12. You launch on NASA's SLS rocket, fly to Mars, land, and keep a crew alive at an
outpost by sharing out a limited amount of power. **Every choice costs something**, and the game uses **live
NASA and NOAA data** wherever it can.

---

## The challenge, and our answer

| The brief asks for | In our game |
|---|---|
| Run a Moon **or** Mars outpost | Mars: an outpost in Jezero Crater, where Perseverance is exploring. |
| Life support, radiation shielding, power, food | One power console splits the solar power between **life support** (oxygen and the greenhouse), **talking to Earth**, **science** and **shielding**. The total is always 100%, so more of one means less of the others. |
| Real trade-offs, no "free" choice | Solar storm warnings offer three options, each with its cost shown. Going outside uses suit air and radiation. The rover saves walking but drains its battery. Upgrades cost parts you must find outside. |
| 2-3 core resources, not too complex | Oxygen, food and a radiation badge (plus power, which drives them). New upgrade designs arrive in 4 tiers, so kids learn a few systems at a time. |
| Use real NASA open data, and say when it's saved, not live | See "Real NASA data" below. Live data is tagged **LIVE**, saved data **ARCHIVED**, and made-up game numbers are listed as "game balance". |
| Success and failure | Win by surviving all sols or by building a self-sustaining settlement. Lose by running out of oxygen or food, or reaching NASA's career radiation limit. Each ending explains why and what to try next. |
| Learning | Every real fact you meet goes into a **logbook** (with its NASA source). At the end there is a quiz for a gold, silver or bronze **Junior Astronaut badge**. |

## A 5-minute demo

1. **Title screen.** The line at the bottom shows **today's real biggest solar flare** from NOAA's GOES
   satellites (tagged LIVE). Pick **Explorer** and press **Launch!**
2. **Launch (about 1 min).** NASA's own 3D models of SLS and the Mobile Launcher, with the Vehicle Assembly
   Building in the distance. Each stage is explained as it happens: max-Q, boosters off, then **"YOU ARE IN
   SPACE!"** at the **Kármán line (100 km)**. In orbit, the Moon, Mars and Jupiter are shown **where they
   really are in the sky today** (NASA JPL's planet formulas). *Skip launch* is bottom right.
3. **How do we get to Mars?** Nine short slides: Artemis, the Moon, the Hohmann transfer and the launch window,
   with real NASA photos. Press *Skip* to save time.
4. **Arrival.** A Mars globe with NASA's real map (Mars Trek, Viking mosaic); MRO and Mars Odyssey orbit it.
   The landing is told step by step: heat shield, parachute, rockets, "seven minutes of terror".
5. **On Mars.** You are NASA's Astronaut model, now able to walk. The hills are shaped from NASA's 3D model of
   Gusev Crater. Walk to the **green door** and press **E** to go inside.
6. **Inside: the power console.** Move the sliders and watch oxygen, food, radiation, science and the Earth
   link change live. The card also shows **today's real photo of Earth** from NASA's EPIC camera, and today's
   real Earth-Mars distance and radio delay from JPL Horizons.
7. **The window.** **Real photos Perseverance took on Mars a few days ago**, and the latest Curiosity
   weather report.
8. **The crew rover.** Back outside, walk to NASA's **Space Exploration Vehicle** and press **E** to drive
   (W/S, A/D). Your suit refills inside, but the battery drains; park near the outpost to charge it.
9. **A solar storm.** If one hasn't come yet, see the tip below. It is based on a **real flare from this
   week**. Choose the shelter, more shielding, or keep working, and watch the radiation badge.

**Tip for a quick demo:** open the game with `#debug` at the end of the address
(`.../game/#debug`), then in the browser console:
`game.event('solar-storm-warning')`, `game.event('dust', {sols: 4})`, `game.outpost.parts = 40`
(to try the workbench), or `game.phase(0.05)` (jump to night: stars, and Earth as a blue dot in the Mars sky).

## Real NASA data (live, with a saved backup)

| What | Where in the game | Source |
|---|---|---|
| Solar flares this week | Title screen, solar storms | NOAA SWPC, GOES satellites (live); NASA DONKI history |
| Perseverance's newest photos | Outpost window | NASA/JPL-Caltech/ASU raw images (live) |
| Today's photo of the whole Earth | Power console | NASA EPIC camera on DSCOVR (live) |
| Mars weather | Outpost window | NASA Curiosity REMS daily report (saved) |
| Earth-Mars distance and radio delay | Power console | NASA JPL Horizons (saved) |
| Mars globe | Arrival | NASA Mars Trek, Viking colour mosaic (live), NASA 3D Resources map (saved) |
| Launch photo | Mission slides | NASA Image and Video Library (live) |
| Wind on Mars | Sound outside | Perseverance SuperCam microphone recording |
| Planet positions | Launch, Mars night sky | NASA JPL approximate planet positions |
| Mars, spaceflight and health facts | Logbook, pop-ups | NASA fact sheets and mission pages (every fact has its link) |

If a service is down, the game uses a saved copy and labels it **ARCHIVED**. The full list, with links, is
in the game: **Real NASA data used** on the title screen.

## NASA 3D models used

SLS (split into its real stages), Mobile Launcher, Vehicle Assembly Building, Perseverance, Ingenuity, Mars
Reconnaissance Orbiter, Mars Odyssey, the Astronaut (given a skeleton so it can walk), the Space Exploration
Vehicle (drivable), and the Gusev Crater / Spirit landing site terrain. All from NASA 3D Resources. Where a
model had a NASA logo printed on it, the game paints our team badge over it.

## Honest about what is made up

- Time is sped up: one sol (24 h 40 min) passes in 37 seconds. Supply pods arrive in sols, not months.
- Solar storms are stronger than real ones so shielding matters within one game.
- Upgrade costs, panel output and rover speed are game balance, and are listed as that in the game.
- The ground is Gusev Crater, Spirit's landing site, from NASA MOLA height data squeezed into a 1.2 km map. Other landing regions change your resources, not the ground.
- Spirit's five stops (heat shield, Hillary, Home Plate, Gertrude Weise, Troy) are real places, but much closer together than in real life and drawn a little larger.

## For classrooms

- **Phones, tablets and Chromebooks:** touch controls (left thumb moves, right thumb looks, big Use button)
  and a **Screen: Auto / Phone / Tablet / Desktop** switch.
- **Save and resume:** the mission saves itself every few seconds. After a refresh, press **Resume** on the
  title screen.
- **Short sessions:** Cadet (40 sols) fits a lesson; Explorer (80) and Commander (150) are longer.
- **No accounts, no tracking**, nothing to install. The only thing stored is the save, in the student's own
  browser.

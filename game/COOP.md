# Co-op (up to 4 players) and sleeping in the hab

## Run it locally

```bash
node server/coop-relay.mjs
```

Then open `http://localhost:8790/` in two or more tabs or computers on the same network (use the host's IP instead of `localhost`). Node 18+ is needed; there are no npm dependencies. The relay serves the `game/` folder **and** relays co-op messages at `/coop`, so this one command is enough.

`python game/serve.py 8778` (or *Start Mars.cmd*) still works for single-player. Those pages look for the relay at port 8790 on the same machine, so start the relay too if you want co-op from them.

## Playing

1. Title screen → **Play together · co-op** → type a name.
2. **Create game** gives a 5-letter code (and a `?join=CODE` link). Press **Start the mission**: you host your saved game, or a new one.
3. Friends choose **Join with code**. They arrive next to the host as soon as the host is on Mars.

Each player sees the other astronauts walk, run, jump, mine and lie in bunks. Each crewmate has a coloured beacon and a name tag. The roster at the top right shows the code and where everyone is. The shared mission includes power, storage, greenhouses, mined deposits, supply pods, surveys and the sol clock. Suit air, hunger, the tool belt and the ore bag are personal. A guest's own saved game is never overwritten. If the host leaves, the longest-connected player takes over the mission clock.

## Sleeping and skipping the night

The four crew cabins in **Crew quarters** (pod 4 from the airlock) are walk-in rooms. Walk through the door to the bunk and press **E** (or tap **Use**). You can sleep in your own cabin, a spare cabin or the two storm-shelter bunks. Crewmates' bunks are taken, and a door with a "Zzz" sign is closed. You can sleep from just before sunset until sunrise. Press **E** or move to get up.

- **On your own:** after a moment in the bunk, the night is skipped to about 06:15 the next sol. The new sol runs as normal: supplies, crops and power.
- **Co-op:** the night is skipped when more than half the crew is ready. A player is ready when asleep in a bunk, or awake and voting with **N**. With 2 players both must be ready; with 3, two; with 4, three. The night panel lists who is sleeping, who voted and who is awake, and counts down 3 seconds before the skip.

## Hosting it online later

The relay is a single Node file with no dependencies. Run it on any Node host that allows WebSockets, such as Render, Fly.io, Railway or a small VPS: `PORT=8080 node server/coop-relay.mjs`. Put it behind HTTPS so the page uses `wss://`. If the game is served from the relay itself, nothing else is needed. If the game is hosted elsewhere (for example on a static site), add `?relay=wss://your-relay.example/coop` to the game URL, or set `localStorage['coop-relay']`.

## How it works (for the team)

- `server/coop-relay.mjs`: rooms, 5-letter codes, a 4-player limit, message forwarding and host hand-over. It also serves static files. Test: `node scripts/test-coop-relay.mjs`.
- `game/src/coop.js`: the WebSocket client, the menu dialog, the roster and the night panel.
- `game/src/remote-players.js`: the crewmates' astronauts (NASA suit plus beacon and name tag, about 3–4 draw calls each). They are culled off-screen, and on the surface they set `world.remoteShadowDirty` so `world.shadowDirty()` redraws their shadows.
- `game/src/bunks.js`: cabin floors, bunk stations and lying poses. `game/src/night-vote.js`: the skip rules. Test: `node scripts/test-night-vote.mjs`.
- `main.js`, "co-op and night skip" section: poses are sent 10× a second (the host's pose carries the clock). Changed shared state is sent 2× a second, last write wins. The guest's snapshot is the host's save data.

Limits: shared state is last-write-wins, so two players changing the same thing in the same half second can lose one change. Pop-up events (storms, deliveries) appear for the host; guests see their effects in the shared state.

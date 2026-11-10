# Rover cockpit and EVA flow (10 November 2026)

Synced with till-whiteash/NASA main ebd9e0c before editing. Existing untracked Unity lab files were preserved.

- Rover boarding starts in first person. V switches to the exterior camera. A separate modeled cockpit provides a clear windshield, dashboard, steering wheel, seats and pillars; NASA's opaque exterior hull is hidden only in cockpit view, restored on exit/exterior view. Mouse look stays relative to vehicle turns.
- Walking and driving can use the full 1,216 m square terrain, with an 8 m edge margin, rather than the old 511 m circular cutoff. This changes the travel boundary, not the detailed chunk residency budget.
- EVA suit rack is in the first habitat module (Airlock & power), on the left wall. E / Use lets you store the suit or wear it and complete abbreviated checks. Old saves default to a suited astronaut. Suit state is saved.
- Surface-facing habitat, greenhouse and lander interactions now enter a two-hatch pressure chamber. Exit requires a checked, worn suit. Both hatches are interlocked during a 10-second training cycle; E / Use opens only the pressure-matched exit. R reverses safely to the entry-side pressure; E / Use during cycling exposes the same cancellation on phones.
- Only the existing rover suitport interaction remains separate from the habitat airlock.
- Transient airlock state is not saved; reload resumes from the safely saved entry side. Chamber resources are disposed after use.

## Science boundary
NASA reference: https://www.nasa.gov/reference/11-0-spacesuits-vol-2/
NASA suitport concept: https://techport.nasa.gov/projects/10728

Suit checks and oxygen prebreathe are represented by an abbreviated preparation action, not their real duration. 101.3 kPa cabin / 0.6 kPa Mars and 10-second cycling are educational scenario values, not an operational EVA procedure or a certified Mars habitat design. The existing NASA rover is an exterior model; the modeled cockpit is a game interpretation rather than a NASA cockpit reconstruction.

## Verification
Node tests: test-airlock, test-rover-terrain, test-rover-charging, test-chunk-plan.
Browser: checked visible windshield, hull restoration, suit stow/equip, unsuited exit rejection, pressure progression, cycle completion, cancellation reversal, and suit rack rendering. Existing optional countdown/welcome audio files return 404; no new runtime exception observed.

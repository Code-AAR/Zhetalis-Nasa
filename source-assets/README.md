# Source assets (not part of the website)

High-quality originals that the game does **not** load. They are kept so the runtime files can be rebuilt,
but they live outside `game/` so the playable site stays light.

| Here (source) | Runtime file the game loads |
|---|---|
| `crew/Ch22_nonPBR.fbx`, `Ch23_nonPBR.fbx`, `Ch48_nonPBR.fbx` (about 214 MB) | `game/assets/crew/ch22.glb`, `ch23.glb`, `ch48.glb` |
| `crew/*.fbx` animations (Breathing Idle, Sitting Idle, Typing, ...) | `game/assets/crew/crew-anims.glb` |
| `crew/ch22-noq.glb` | unused alternative export of `ch22.glb` |

Rules:
- Never reference anything in this folder from `game/`. Convert to a compressed GLB and put that in `game/assets/`.
- The crew characters and animations come from Mixamo. Check Mixamo's licence before sharing the raw FBX files
  publicly: it allows using them in a project, but not redistributing the raw files on their own.
- These files are still in the Git repository, so they still count towards its size. To shrink the repository
  itself the team would need to remove them from Git (keeping local copies) or move them to Git LFS / a release.

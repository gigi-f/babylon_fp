# Master Roadmap — First Person Mystery (Lo‑fi Time Loop)

Overview:
- A staged roadmap that focuses on a rapid MVP and iterative expansion.

Objectives:
- Ship a playable investigative loop demonstrating the core hook: time loop + photographic evidence.
- Iterate fast with short loops and measurable milestones.

MVP (Minimum Viable Product) — Status summary:
- Core systems:
  - Player movement, camera, low‑fi town (1 plaza + 3 buildings). — Status: Done (prototype present)
  - Loop manager (fast test loop). — Status: In progress (loop manager implementation exists)
  - 4 NPCs with schedules and 1 staged crime. — Status: Not started (scheduling framework present; NPC content needed)
  - Photo capture + simple develop UI revealing one clue. — Status: Not started
  - One investigation chain (3 clues → meeting location). — Status: Not started

Notes on what is already present in the repo:
- Basic bootstrap and controller code: [`src/main.ts`](src/main.ts:1)
- FPS controller: [`src/controllers/firstPersonController.ts`](src/controllers/firstPersonController.ts:1)
- Asset helpers: [`src/systems/assetPipeline.ts`](src/systems/assetPipeline.ts:1)
- Loop manager implementation (start point): [`src/systems/loopManager.ts`](src/systems/loopManager.ts:1)
- UI HUD and dev hot-reload in repo: [`src/ui/hud.ts`](src/ui/hud.ts:1)
- Creative & design notes: [`docs/creative.md`](docs/creative.md:1)

Stages (with current status and short expansion for unstarted work):

- Stage 0 — Prototype (1–2 days)
  - Scope: Setup scene, movement, fps controller, simple lighting.
  - Acceptance: Walkable scene at stable framerate.
  - Status: Done — baseline scene + FPS controller in repo.

- Stage 1 — Loop & Scheduler (2–4 days)
  - Scope: Implement loop manager, world reset, timed events, deterministic scheduling.
  - Acceptance: Events trigger reproducibly and world resets cleanly.
  - Status: In progress
  - Work remaining:
    - Harden world reset (state snapshot + deterministic restore).
    - Add deterministic seed for randomized events.
    - Add small integration tests for repeatable event sequences.

- Stage 2 — Photo System & Clue Reveal (3–6 days)
  - Scope: Implement photo capture, thumbnail storage, simple develop screen overlay.
  - Acceptance: Photograph a staged event and reveal a clue reliably.
  - Status: Not started
  - Concrete tasks:
    - Implement camera capture API and thumbnail store (create `src/systems/photoSystem.ts`).
    - Design simple develop UI overlay (`src/ui/develop.ts`) and thumbnail gallery.
    - Create data model for polaroids and clue templates in `docs/polaroids.json`.
    - Tests: ensure captured image maps to expected clue metadata ≥95% of the time.

- Stage 3 — NPC Schedules & Basic Social Logic (1–2 weeks)
  - Scope: Add NPC waypoints, schedules, and simple state (alibi/suspicion).
  - Acceptance: NPC follows schedule and reacts to player actions.
  - Status: Not started (foundation files for cycles exist: [`src/systems/hourlyCycle.ts`](src/systems/hourlyCycle.ts:1), [`src/systems/dayNightCycle.ts`](src/systems/dayNightCycle.ts:1))
  - Concrete tasks:
    - Create NPC data schema (`docs/npcs.json`) and waypoint format.
    - Implement scheduler that reads JSON schedules and drives NPC animation/position.
    - Add a simple state machine (idle → suspicious → evasive) and event hooks.

- Stage 4 — Investigation Flow & Ritual Reveal (2–3 weeks)
  - Scope: Author a 3‑clue chain that reveals a new area.
  - Acceptance: Player completes chain and finds new area.
  - Status: Not started
  - Concrete tasks:
    - Author a sample investigation (3 clues) in `docs/investigations/sample1.json`.
    - Implement investigation manager to track clues, progress, and trigger area unlocks.
    - Implement gating mechanics (unlock door/area + visual/audio cue).

- Stage 5 — Content Expansion & Endings (ongoing)
  - Scope: Expand buildings, NPC roster, polaroid templates, endings, audio polish.
  - Acceptance: Multiple concurrent NPC routes with new areas opening up based on clue collection/crimes solved.
  - Status: Not started (content & design phase)

Technical Notes:
- Engine: Babylon.js (low‑poly, WebGL) — already in repo.
- Physics: cannon‑es for simple collisions and player collider.
- Art: low‑poly, instanced meshes, vertex colors to reduce textures.
- Audio: short lo‑fi loops, ambient FX; keep compressed for web.
- Save: simple JSON snapshots for quick branching tests.

QA & Metrics:
- Framerate: aim 60fps on target desktop hardware.
- Loop test: complete investigation chain in ≤3 loops.
- Photo reliability: ≥95% success in revealing intended clue.

Team & Roles (small-team suggestion):
- Designer: write events, NPC scripts, clue chains.
- Programmer: systems (loop, photos, NPCs, UI).
- Artist/Sound: low‑poly assets, palettes, audio cues.
- QA/Producer: playtests, balance, content pipeline.

Example Sprint Plan (2‑week cadence):
- Sprint 1: Prototype stabilization + finish Loop & Scheduler (Stage 1 complete).
- Sprint 2: Photo system + one clue chain + NPC schedule basics (Stage 2 + start Stage 3).
- Sprint 3: Investigation flow + ritual reveal + physics polish.
- Sprint 4: Expand content + audio + endings + polish.

Risks & Mitigations:
- Scope creep → Mitigate by strict MVP scope and content freeze.
- NPC brittleness → build deterministic tests and simple state machines.
- Performance with many objects → use instancing/AABB culling.

Immediate Next Steps (expanded):
1. Short-term (this week)
   - Finalize deterministic world snapshot/restore in [`src/systems/loopManager.ts`](src/systems/loopManager.ts:1). (1 day)
   - Create skeleton `src/systems/photoSystem.ts` with capture API and placeholder tests. (1 day)
   - Create `docs/polaroids.json` and `docs/npcs.json` with initial templates. (half day)

2. Mid-term (1–2 weeks)
   - Implement develop UI overlay and thumbnail gallery: [`src/ui/develop.ts`](src/ui/develop.ts:1). (2–3 days)
   - Implement NPC scheduler and waypoint reader using JSON content. (1 week)
   - Author first investigation chain in `docs/investigations/sample1.json`. (2 days)

3. Playtest & iterate
   - Short loop tests (2–3 minutes) and measure photo/clue reliability.
   - Add telemetry counters for clue reveal success/failure to adjust thresholds.

Repo References (updated):
- Bootstrap & controller: [`src/main.ts`](src/main.ts:1)
- Controller: [`src/controllers/firstPersonController.ts`](src/controllers/firstPersonController.ts:1)
- Asset helpers: [`src/systems/assetPipeline.ts`](src/systems/assetPipeline.ts:1)
- Loop manager: [`src/systems/loopManager.ts`](src/systems/loopManager.ts:1)
- Creative doc: [`docs/creative.md`](docs/creative.md:1)

Notes:
- Keep loops short during dev and increase length for release builds.
- Use data-driven schedules and JSON content to allow non-programmer editing.
- Track status in the `docs/roadmap.md` header; update when tasks/files are created.

Next action:
- If you confirm this updated roadmap I will:
  1) create the skeleton files listed above (`src/systems/photoSystem.ts`, `src/ui/develop.ts`, `docs/polaroids.json`, `docs/npcs.json`, `docs/investigations/sample1.json`) and
  2) start Stage 1 hardening tasks in the codebase.

Once you confirm, I will create the task files and start Stage 1 implementation.
# Master Roadmap — First Person Mystery (Lo‑fi Time Loop)

Overview:
- A staged roadmap that focuses on a rapid MVP and iterative expansion.

Objectives:
- Ship a playable investigative loop demonstrating the core hook: time loop + photographic evidence.
- Iterate fast with short loops and measurable milestones.

MVP (Minimum Viable Product):
- Core systems:
  - Player movement, camera, low‑fi town (1 plaza + 3 buildings).
  - Loop manager (fast test loop).
  - 4 NPCs with schedules and 1 staged crime.
  - Photo capture + simple develop UI revealing one clue.
  - One investigation chain (3 clues → meeting location).

Stages:
- Stage 0 — Prototype (1–2 days)
  - Setup scene, movement, fps controller, simple lighting.
  - Acceptance: walkable scene at stable framerate.

- Stage 1 — Loop & Scheduler (2–4 days)
  - Implement loop manager, world reset, timed events, deterministic scheduling.
  - Acceptance: events trigger reproducibly and world resets cleanly.

- Stage 2 — Photo System & Clue Reveal (3–6 days)
  - Implement photo capture, thumbnail storage, simple develop screen overlay.
  - Acceptance: photograph a staged event and reveal a clue reliably.

- Stage 3 — NPC Schedules & Basic Social Logic (1–2 weeks)
  - Add 4 NPCs with waypoints, dialogues, simple state (alibi, suspicion).
  - Acceptance: NPCs follow schedule and react to a few player actions.

- Stage 4 — Investigation Flow & Ritual Reveal (2–3 weeks)
  - Author a 3‑clue chain leading to a hidden meeting and a scripted reveal.
  - Acceptance: player completes chain in <3 loops and witnesses partial ritual.

- Stage 5 — Content Expansion & Endings (ongoing)
  - Expand buildings, NPC roster, polaroid templates, endings, audio polish.
  - Acceptance: multiple playable routes and at least 2 endings implemented.

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
- Designer: author events, NPC scripts, clue chains.
- Programmer: systems (loop, photos, NPCs, UI).
- Artist/Sound: low‑poly assets, palettes, audio cues.
- QA/Producer: playtests, balance, content pipeline.

Example Sprint Plan (2‑week cadence):
- Sprint 1: Prototype + loop manager + 1 staged event (MVP baseline).
- Sprint 2: Photo UI + 1 clue chain + NPC scheduling.
- Sprint 3: Ritual reveal + player collider + physics polish.
- Sprint 4: Expand content + audio + polish + basic endings.

Risks & Mitigations:
- Scope creep → Mitigate by strict MVP scope and content freeze.
- NPC brittleness → build deterministic tests and simple state machines.
- Performance with many objects → use instancing/AABB culling.

Immediate Next Steps (top 5):
1. Shorten loop to 2–3 minutes for rapid tests.
2. Implement event scheduler and one staged crime.
3. Implement photo capture + develop overlay.
4. Add 4 NPCs with waypoint schedules.
5. Playtest loop and iterate on timing.

Repo References:
- Bootstrap & controller: src/main.ts
- Controller: src/controllers/firstPersonController.ts
- Asset helpers: src/systems/assetPipeline.ts
- Creative doc: docs/creative.md

Notes:
- Keep loops short during dev and increase length for release builds.
- Use data-driven schedules and JSON content to allow non-programmer editing.

- Once you confirm this roadmap, I will create tasks/files and start Stage 1 implementation.
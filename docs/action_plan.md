# Action Plan: Code Quality & Best Practices Implementation

**Based on**: Architecture Analysis (docs/architecture_analysis.md)  
**Timeline**: 2-4 weeks (parallel with Stage 2 development)  
**Goal**: Establish solid foundation for MVP and beyond

---

## Phase 1: Critical Foundation (Week 1)

### 1.1 Testing Infrastructure ⚠️ CRITICAL
**Time**: 2-3 days  
**Impact**: HIGH - Prevents regressions, validates time loop mechanics

**Tasks**:
- [ ] Configure Vitest in `vite.config.ts`
- [ ] Create `tests/` directory structure
- [ ] Write mock helpers (`tests/helpers/mockScene.ts`, `tests/helpers/mockCamera.ts`)
- [ ] Implement tests for `LoopManager`:
  - [ ] Loop timing and wrapping
  - [ ] Event scheduling
  - [ ] Event removal/clearing
  - [ ] Time scale
- [ ] Implement tests for time synchronization utilities
- [ ] Add test script to `package.json`: `"test": "vitest"`
- [ ] Set up GitHub Actions for CI (optional but recommended)

**Acceptance Criteria**:
- ✅ `npm test` runs successfully
- ✅ At least 15 meaningful tests passing
- ✅ Core loop mechanics validated

**Files to Create**:
```
tests/
├── helpers/
│   ├── mockScene.ts
│   ├── mockCamera.ts
│   └── testUtils.ts
├── systems/
│   ├── loopManager.test.ts
│   └── timeSync.test.ts
└── vitest.config.ts (if separate from vite.config.ts)
```

---

### 1.2 Game Class Refactoring
**Time**: 1-2 days  
**Impact**: MEDIUM-HIGH - Enables proper state management

**Tasks**:
- [ ] Create `src/Game.ts` class
- [ ] Move initialization logic from `main.ts` to `Game.init()`
- [ ] Create `SystemManager` class (`src/systems/SystemManager.ts`)
- [ ] Encapsulate all global state in Game instance
- [ ] Update `main.ts` to simple bootstrap:
  ```typescript
  import { Game } from './Game';
  const game = new Game(canvas);
  game.init().then(() => game.start());
  ```
- [ ] Ensure proper disposal order
- [ ] Test that game can be restarted

**Acceptance Criteria**:
- ✅ No global mutable state in `main.ts`
- ✅ Game can be instantiated multiple times
- ✅ Clean initialization/disposal cycle
- ✅ Existing functionality preserved

---

### 1.3 Error Handling & Logging
**Time**: 1 day  
**Impact**: MEDIUM - Improves debugging experience

**Tasks**:
- [ ] Create `src/utils/logger.ts`:
  ```typescript
  export class Logger {
    static create(context: string) {
      return {
        debug: (msg: string, data?) => {},
        info: (msg: string, data?) => {},
        warn: (msg: string, data?) => {},
        error: (msg: string, error?) => {},
      };
    }
  }
  ```
- [ ] Replace `console.log` with Logger throughout codebase
- [ ] Add validation to `savePhoto()` in `photoSystem.ts`
- [ ] Add error boundaries in critical systems
- [ ] Create error reporting utility (optional: integrate Sentry)

**Acceptance Criteria**:
- ✅ Structured logging in place
- ✅ No bare `console.log` statements (except in logger)
- ✅ Input validation on public APIs
- ✅ Clear error messages with context

---

## Phase 2: Configuration & State (Week 2)

### 2.1 Central Configuration System
**Time**: 1-2 days  
**Impact**: MEDIUM - Enables easy tuning

**Tasks**:
- [ ] Create `src/config/gameConfig.ts` with `GameConfig` interface
- [ ] Define default configuration object
- [ ] Create `public/config/game.json` for runtime config
- [ ] Implement `loadConfig()` function with fallback
- [ ] Update all systems to accept config values
- [ ] Add config validation

**Acceptance Criteria**:
- ✅ All magic numbers replaced with config values
- ✅ Can change loop duration via JSON
- ✅ Debug settings centralized
- ✅ Environment-specific configs possible

**Example Config Structure**:
```json
{
  "loop": {
    "durationSec": 120,
    "timeScale": 1
  },
  "dayNight": {
    "dayMs": 60000,
    "nightMs": 60000
  },
  "debug": {
    "enabled": true,
    "showColliders": false,
    "logEvents": true
  },
  "performance": {
    "targetFPS": 60
  }
}
```

---

### 2.2 State Serialization System
**Time**: 2-3 days  
**Impact**: HIGH - Required for save/load (roadmap Stage 4+)

**Tasks**:
- [ ] Design `GameState` interface covering all systems
- [ ] Implement `serialize()` method in each system:
  - [ ] LoopManager: events, elapsed time
  - [ ] NpcSystem: NPC positions, schedules
  - [ ] DoorSystem: door states
  - [ ] PhotoSystem: captured photos
- [ ] Implement `deserialize()` method in each system
- [ ] Create `StateManager` utility
- [ ] Add state validation
- [ ] Test state round-trip (serialize → deserialize → verify)

**Acceptance Criteria**:
- ✅ Game state can be serialized to JSON
- ✅ State can be restored with 100% fidelity
- ✅ Deterministic: same state = same behavior
- ✅ Tests validate serialization for each system

---

### 2.3 HUD Refactoring
**Time**: 1 day  
**Impact**: LOW-MEDIUM - Cleaner architecture

**Tasks**:
- [ ] Convert `src/ui/hud.ts` from module functions to class
- [ ] Remove all module-level state variables
- [ ] Make HUD instantiable: `const hud = new HUD(scene, options)`
- [ ] Update main game initialization to use class
- [ ] Add proper disposal method

**Acceptance Criteria**:
- ✅ HUD is a class with proper encapsulation
- ✅ Multiple HUD instances possible (for testing)
- ✅ No module-level mutable state

---

## Phase 3: Documentation & Tools (Week 3)

### 3.1 API Documentation
**Time**: 2 days  
**Impact**: MEDIUM - Improves maintainability

**Tasks**:
- [ ] Add JSDoc comments to all public classes:
  - [ ] LoopManager
  - [ ] NpcSystem
  - [ ] DoorSystem
  - [ ] DayNightCycle
  - [ ] HourlyCycle
  - [ ] PhotoSystem
- [ ] Document all type interfaces with examples
- [ ] Add usage examples in comments
- [ ] Consider TypeDoc for auto-generated docs

**Template**:
```typescript
/**
 * Manages the game's time loop mechanics, including event scheduling
 * and deterministic loop wrapping.
 * 
 * @example
 * ```typescript
 * const loop = new LoopManager(scene, 120, 1);
 * loop.scheduleEvent('crime_1', 60, () => {
 *   // Spawn crime at 60 seconds
 * });
 * loop.start();
 * ```
 */
export class LoopManager { }
```

---

### 3.2 Development Guide
**Time**: 1 day  
**Impact**: MEDIUM - Onboarding & team collaboration

**Tasks**:
- [ ] Create `docs/DEVELOPMENT.md`:
  - [ ] Setup instructions
  - [ ] Project structure explanation
  - [ ] How to add a new system
  - [ ] How to add a new NPC
  - [ ] Testing guidelines
  - [ ] Debugging tips
- [ ] Create `docs/TESTING.md` with testing patterns
- [ ] Update README.md with quick start guide

---

### 3.3 Debug Tools Enhancement
**Time**: 1-2 days  
**Impact**: LOW-MEDIUM - Development velocity

**Tasks**:
- [ ] Enhance `src/debug/debugControls.ts`:
  - [ ] Add timeline scrubbing (jump to any point in loop)
  - [ ] Add NPC path visualization
  - [ ] Add event marker visualization
  - [ ] Add performance overlay
- [ ] Create debug UI panel (Babylon GUI)
- [ ] Add keyboard shortcuts reference

**Features**:
- `T`: Toggle timeline scrubber
- `N`: Toggle NPC paths
- `E`: Toggle event markers
- `P`: Toggle performance stats
- `F1`: Show debug help

---

## Phase 4: Data-Driven Content (Week 4)

### 4.1 JSON Schema Definitions
**Time**: 1 day  
**Impact**: MEDIUM - Enables content creation

**Tasks**:
- [ ] Create JSON schemas in `docs/schemas/`:
  - [ ] `npc.schema.json` - NPC definitions
  - [ ] `schedule.schema.json` - NPC schedules
  - [ ] `event.schema.json` - Loop events
  - [ ] `investigation.schema.json` - Investigation chains
- [ ] Add schema validation (using Zod or Ajv)
- [ ] Create example content files in `data/`:
  - [ ] `data/npcs/baker.json`
  - [ ] `data/events/sample_crime.json`

**Example NPC Schema**:
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "id": { "type": "string" },
    "name": { "type": "string" },
    "color": { "type": "array", "items": { "type": "number" }, "minItems": 3, "maxItems": 3 },
    "schedule": {
      "type": "object",
      "patternProperties": {
        "^[0-9]+$": {
          "type": "object",
          "properties": {
            "x": { "type": "number" },
            "y": { "type": "number" },
            "z": { "type": "number" }
          }
        }
      }
    }
  },
  "required": ["id", "name", "schedule"]
}
```

---

### 4.2 Content Loaders
**Time**: 2 days  
**Impact**: HIGH - Separates data from code

**Tasks**:
- [ ] Create `src/content/ContentLoader.ts`
- [ ] Implement NPC loader from JSON
- [ ] Implement event loader from JSON
- [ ] Update NpcSystem to accept JSON definitions
- [ ] Update LoopManager to accept JSON event definitions
- [ ] Add content validation on load
- [ ] Add hot-reload during development (optional)

**Acceptance Criteria**:
- ✅ NPCs defined in JSON files
- ✅ Events defined in JSON files
- ✅ No hard-coded content in source files
- ✅ Validation catches malformed data

---

### 4.3 Content Hot-Reload (Optional)
**Time**: 1 day  
**Impact**: LOW - Developer experience

**Tasks**:
- [ ] Watch content files for changes
- [ ] Reload NPCs without restarting game
- [ ] Reload events without restarting game
- [ ] Show notification when content reloaded

---

## Ongoing: Code Quality

### Throughout All Phases
- [ ] Run `npm run typecheck` before each commit
- [ ] Write tests alongside new features
- [ ] Keep test coverage above 60%
- [ ] Update documentation when APIs change
- [ ] Code review checklist:
  - [ ] Types defined for new code
  - [ ] Tests added for new logic
  - [ ] Documentation updated
  - [ ] No console.log (use Logger)
  - [ ] Proper error handling
  - [ ] Dispose methods for resources

---

## Quick Wins (Can Do Anytime)

These are small improvements that provide value without major refactoring:

1. **ESLint Configuration** (30 min)
   - Create `.eslintrc.json`
   - Run `npm run lint` and fix issues

2. **Prettier Configuration** (15 min)
   - Create `.prettierrc.json`
   - Run `npm run format`

3. **Git Hooks** (30 min)
   - Install Husky
   - Pre-commit: run linter and tests
   - Pre-push: run full test suite

4. **Add LICENSE file** (5 min)
   - Choose license (MIT?)
   - Add to repo

5. **Improve README** (30 min)
   - Add badges (build status, coverage)
   - Add screenshots
   - Better quick start instructions

6. **Add .editorconfig** (10 min)
   - Consistent formatting across editors

---

## Success Metrics

### Week 1 Goals
- ✅ Test suite running with >10 tests passing
- ✅ Game class extracted, no global state
- ✅ Structured logging in place

### Week 2 Goals
- ✅ Central config system working
- ✅ State serialization working for 3+ systems
- ✅ HUD refactored to class

### Week 3 Goals
- ✅ All public APIs documented
- ✅ DEVELOPMENT.md created
- ✅ Enhanced debug tools available

### Week 4 Goals
- ✅ JSON schemas defined
- ✅ Content loaders working
- ✅ At least 1 NPC defined in JSON

### Overall Success
- ✅ Test coverage >60%
- ✅ Zero ESLint errors
- ✅ Architecture score improves from B+ to A-
- ✅ Ready for Stage 2-3 feature development

---

## Resources & References

### Testing
- [Vitest Documentation](https://vitest.dev/)
- [Testing Babylon.js Applications](https://doc.babylonjs.com/guidedLearning/testingUtilities)

### Game Dev Patterns
- [Game Programming Patterns](https://gameprogrammingpatterns.com/)
- [Entity Component System](https://en.wikipedia.org/wiki/Entity_component_system)

### TypeScript
- [TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/intro.html)
- [TypeScript Do's and Don'ts](https://www.typescriptlang.org/docs/handbook/declaration-files/do-s-and-don-ts.html)

---

## Notes

- **Parallel Work**: Phase 2-4 tasks can happen in parallel with Stage 2 roadmap features
- **Minimum Viable**: Phase 1 is CRITICAL before Stage 2 completion
- **Iterative**: Don't block feature development - improve gradually
- **Team Size**: Estimates assume 1 developer; adjust for team

**Next Review**: After Phase 1 completion

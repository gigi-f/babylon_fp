# Architecture & Best Practices Analysis

**Project**: First Person Mystery Game (Lo-fi Time Loop)  
**Engine**: Babylon.js (TypeScript)  
**Analysis Date**: October 14, 2025  
**Status**: Early Development (MVP Stage 1-2)

---

## Executive Summary

This codebase demonstrates **solid foundational architecture** with clear separation of concerns and good extensibility patterns. The project is in early development (MVP Stage 1-2) with a well-structured system for game mechanics. However, there are several areas where implementing additional best practices would improve maintainability, testability, and scalability as the project grows.

**Overall Grade**: B+ (Good foundation, needs polish and testing infrastructure)

---

## Architecture Overview

### Project Structure
```
src/
├── controllers/          # Input handling (FirstPersonController)
├── systems/             # Core game systems (modular, reusable)
│   ├── loopManager.ts
│   ├── npcSystem.ts
│   ├── doorSystem.ts
│   ├── dayNightCycle.ts
│   ├── hourlyCycle.ts
│   ├── photoSystem.ts
│   └── assetPipeline.ts
├── ui/                  # UI components (HUD, photo stack)
├── debug/               # Debug utilities
└── main.ts             # Application bootstrap
```

### Architectural Pattern
The project follows a **component-based architecture** with clear separation:
- **Controllers**: Handle player input and camera control
- **Systems**: Self-contained, reusable game systems with clear responsibilities
- **UI Layer**: Babylon.js GUI for HUD and overlays
- **Bootstrap**: `main.ts` orchestrates initialization

---

## Strengths

### ✅ 1. Excellent Separation of Concerns
Each system has a single, well-defined responsibility:
- `LoopManager`: Time loop mechanics
- `NpcSystem`: NPC behavior and scheduling
- `DoorSystem`: Interactive door mechanics
- `DayNightCycle`: Lighting and time-of-day visuals
- `PhotoSystem`: Photo capture and storage

**Game Dev Best Practice**: ✓ Follows Entity-Component-System (ECS) principles loosely

### ✅ 2. Strong TypeScript Usage
- Extensive use of TypeScript interfaces and types
- Good type safety with exported types: `LoopEvent`, `NpcSchedule`, `DoorMetadata`
- Clear API contracts for each system

**Software Dev Best Practice**: ✓ Type safety reduces runtime errors

### ✅ 3. Event-Driven Architecture
- Observer pattern in `DayNightCycle` (`onTick` subscriptions)
- Custom event system for actions (`window.addEventListener("action")`)
- Decouples systems effectively

**Game Dev Best Practice**: ✓ Enables reactive gameplay without tight coupling

### ✅ 4. Resource Management
- Asset caching in `assetPipeline.ts` (models and textures)
- Proper disposal methods in systems (`dispose()` in `DoorSystem`, `NpcSystem`)
- Memory-conscious design

**Game Dev Best Practice**: ✓ Critical for web games with limited memory

### ✅ 5. Configuration & Constants
- Shared constants file (`sharedConstants.ts`) for colors, vectors
- Configurable options via constructor parameters
- Avoids magic numbers

**Software Dev Best Practice**: ✓ Makes tuning and balancing easier

### ✅ 6. Modular System Design
Systems can be instantiated independently:
```typescript
const loopManager = new LoopManager(scene, 120, 1);
const npcSystem = new NpcSystem(scene, hourlyCycle);
const doorSystem = new DoorSystem(scene, camera);
```

**Game Dev Best Practice**: ✓ Enables easy testing and composition

---

## Areas for Improvement

### ⚠️ 1. **CRITICAL: No Testing Infrastructure**

**Issue**: Zero test files detected (no `.test.ts` or `.spec.ts`)

**Impact**:
- High risk of regressions as features are added
- Difficult to validate time loop mechanics work correctly
- Hard to ensure NPC schedules are deterministic

**Recommendation**:
```typescript
// Example test structure needed:
// tests/systems/loopManager.test.ts
describe('LoopManager', () => {
  it('should reset elapsed time when loop completes', () => {
    const scene = createMockScene();
    const manager = new LoopManager(scene, 10); // 10 sec loop
    manager.start();
    manager.update(11); // Advance past loop duration
    expect(manager.elapsed).toBeLessThan(10);
  });

  it('should fire scheduled events at correct time', () => {
    const callback = jest.fn();
    manager.scheduleEvent('test', 5, callback);
    manager.update(6);
    expect(callback).toHaveBeenCalledTimes(1);
  });
});
```

**Action Items**:
1. Add Vitest (already in package.json) or Jest configuration
2. Write unit tests for critical systems (LoopManager, time sync)
3. Add integration tests for game loop mechanics
4. Target: 60%+ code coverage for systems

**Priority**: HIGH - Essential before Stage 2-3 features

---

### ⚠️ 2. Error Handling Inconsistency

**Issue**: Inconsistent error handling patterns across the codebase

**Examples**:
```typescript
// Good: Safe disposal
try { if (this.body) this.body.dispose(); } catch {}

// Poor: Silent failures
try {
  const impostor = this.physicsMesh.physicsImpostor;
  // ... operations
} catch {
  // fallback but no logging
}

// Missing: No validation
export function savePhoto(dataUrl: string): Photo {
  // What if dataUrl is empty or invalid?
}
```

**Recommendation**:
1. **Establish error handling tiers**:
   - **Critical Errors**: Log and potentially throw (game loop failures)
   - **Recoverable Errors**: Log warning and fallback (asset loading)
   - **Expected Failures**: Silent handling (optional features)

2. **Add input validation**:
```typescript
export function savePhoto(dataUrl: string): Photo {
  if (!dataUrl || !dataUrl.startsWith('data:')) {
    throw new Error('Invalid dataUrl provided to savePhoto');
  }
  // ... rest of implementation
}
```

3. **Use proper logging**:
```typescript
// Instead of console.log, use a logger utility
import { Logger } from './utils/logger';
const log = Logger.create('LoopManager');
log.warn('Event callback error', { eventId: e.id, error: err });
```

**Priority**: MEDIUM - Important for debugging and stability

---

### ⚠️ 3. State Management Concerns

**Issue**: Global state and mutable shared state in several places

**Examples**:
```typescript
// main.ts: Many global variables
const canvas = document.getElementById("renderCanvas");
const engine = new Engine(canvas, true);
const scene = new Scene(engine);
// ... 400+ lines with shared mutable state

// ui/hud.ts: Module-level state
let ui: AdvancedDynamicTexture | null = null;
let container: Rectangle | null = null;
// ... many more module-level variables
```

**Problems**:
- Difficult to test (globals)
- Hard to reset between game loops
- Potential for state leaks

**Recommendation**:
1. **Encapsulate application state**:
```typescript
// src/Game.ts
export class Game {
  private engine: Engine;
  private scene: Scene;
  private systems: GameSystems;
  
  constructor(canvas: HTMLCanvasElement) {
    this.engine = new Engine(canvas, true);
    this.scene = new Scene(this.engine);
    this.systems = this.initializeSystems();
  }
  
  private initializeSystems(): GameSystems {
    return {
      loopManager: new LoopManager(this.scene, 120),
      npcSystem: new NpcSystem(this.scene, hourlyCycle),
      // ... other systems
    };
  }
  
  public start() { /* ... */ }
  public dispose() { /* ... */ }
}
```

2. **Make HUD a class instance**:
```typescript
export class HUD {
  private ui: AdvancedDynamicTexture;
  private components: UIComponents;
  
  constructor(scene: Scene, options?: HUDOptions) {
    this.ui = AdvancedDynamicTexture.CreateFullscreenUI("HUD");
    this.components = this.createComponents();
  }
  
  dispose() {
    this.ui.dispose();
  }
}
```

**Priority**: MEDIUM-HIGH - Critical for loop reset mechanics

---

### ⚠️ 4. Duplicate Code & Inconsistent Patterns

**Issue**: Two different application entry points with overlapping setup

**Files**:
- `src/main.ts` (429 lines) - Main game entry
- `src/App.ts` - Alternative entry using Havok physics

**Problems**:
- Confusing which is the "real" entry point
- `main.ts` uses Cannon.js physics
- `App.ts` uses Havok physics
- Different initialization patterns

**Recommendation**:
1. **Choose one physics engine** and remove the other
2. **Consolidate to single entry point**:
```typescript
// src/main.ts
import { Game } from './Game';

const canvas = document.getElementById("renderCanvas") as HTMLCanvasElement;
const game = new Game(canvas, {
  physics: 'cannon', // or 'havok'
  debug: true,
});

game.init().then(() => {
  game.start();
});
```

3. **If App.ts is for testing**, move to `examples/` or `tests/`

**Priority**: MEDIUM - Reduces confusion and maintenance burden

---

### ⚠️ 5. Limited Documentation & Comments

**Issue**: Sparse inline documentation for complex systems

**Examples**:
```typescript
// Good documentation:
/**
 * NPCSystem
 * - Create simple NPCs (composed of primitive meshes).
 * - Accepts schedules (hour -> position)...
 */

// Missing documentation:
export function semanticHourToLoopPercent(hour: number): number {
  // No explanation of the conversion logic
}

// main.ts: 429 lines with minimal comments
// Difficult to understand the scene setup flow
```

**Recommendation**:
1. **Add JSDoc comments** to all public APIs:
```typescript
/**
 * Schedules an event to occur at a specific time in the loop.
 * 
 * @param id - Unique identifier for the event
 * @param timeSec - Time in seconds when the event should trigger
 * @param callback - Function to execute when event fires
 * @param opts - Optional configuration for repeating events
 * @returns void
 * 
 * @example
 * manager.scheduleEvent('crime_1', 60, stagedCrimeAt(scene, pos), {
 *   repeat: true,
 *   intervalSec: 120
 * });
 */
scheduleEvent(id: string, timeSec: number, callback, opts?) { }
```

2. **Add architecture documentation** (like this file!)
3. **Document game loop timing** - critical for time loop mechanics

**Priority**: MEDIUM - Improves onboarding and maintenance

---

### ⚠️ 6. No Dependency Injection

**Issue**: Hard-coded dependencies make testing difficult

**Example**:
```typescript
export class NpcSystem {
  constructor(scene: Scene, cycle: HourlyCycle) {
    this.scene = scene;
    this.cycle = cycle;
    // Directly subscribes to cycle - hard to mock
    this.unsubscribeTick = this.cycle.onTick((info) => this._onTick(info));
  }
}
```

**Recommendation**:
1. **Use interfaces for dependencies**:
```typescript
interface IHourlyCycle {
  onTick(callback: (info: HourInfo) => void): () => void;
  currentLoopPercent(): number;
}

export class NpcSystem {
  constructor(
    private scene: Scene, 
    private cycle: IHourlyCycle
  ) { }
}
```

2. **Enables easy mocking**:
```typescript
// In tests:
const mockCycle: IHourlyCycle = {
  onTick: jest.fn(),
  currentLoopPercent: () => 0.5,
};
const npcSystem = new NpcSystem(mockScene, mockCycle);
```

**Priority**: LOW-MEDIUM - Beneficial for testing but not urgent

---

### ⚠️ 7. Performance Considerations

**Issue**: Potential performance bottlenecks not addressed

**Concerns**:
1. **No object pooling** for frequently created/destroyed objects:
```typescript
// In loopManager.ts - creates new sphere every event
const sph = MeshBuilder.CreateSphere(`crime_${Date.now()}`, ...);
// Disposed after 15 seconds - GC pressure
```

2. **No frame budgeting** for expensive operations
3. **No LOD (Level of Detail)** system mentioned
4. **Raycasting every frame** in `DoorSystem.onFrame()`

**Recommendation**:
1. **Implement object pooling**:
```typescript
class MeshPool {
  private pool: AbstractMesh[] = [];
  
  acquire(type: string): AbstractMesh {
    return this.pool.pop() || this.create(type);
  }
  
  release(mesh: AbstractMesh) {
    mesh.isVisible = false;
    this.pool.push(mesh);
  }
}
```

2. **Add performance monitoring**:
```typescript
// Track system timings
class PerformanceMonitor {
  private timings = new Map<string, number[]>();
  
  measure(system: string, fn: () => void) {
    const start = performance.now();
    fn();
    const duration = performance.now() - start;
    this.record(system, duration);
  }
}
```

3. **Throttle expensive checks**:
```typescript
// In DoorSystem - only check every N frames
private frameCount = 0;
private onFrame() {
  this.frameCount++;
  if (this.frameCount % 3 !== 0) return; // Check every 3 frames
  // ... door detection logic
}
```

**Priority**: LOW - Monitor first, optimize if issues arise

---

### ⚠️ 8. Missing Configuration Management

**Issue**: Configuration scattered across files, no central config

**Examples**:
- Loop duration in `LoopManager` constructor: `120` seconds
- Day/night durations in multiple places
- Debug settings in code
- No environment-specific configs

**Recommendation**:
1. **Create central configuration**:
```typescript
// src/config/gameConfig.ts
export interface GameConfig {
  loop: {
    durationSec: number;
    timeScale: number;
  };
  dayNight: {
    dayMs: number;
    nightMs: number;
  };
  debug: {
    enabled: boolean;
    showColliders: boolean;
    logEvents: boolean;
  };
  performance: {
    targetFPS: number;
    enablePooling: boolean;
  };
}

export const defaultConfig: GameConfig = {
  loop: { durationSec: 120, timeScale: 1 },
  dayNight: { dayMs: 60_000, nightMs: 60_000 },
  debug: { enabled: true, showColliders: false, logEvents: true },
  performance: { targetFPS: 60, enablePooling: true },
};
```

2. **Load from JSON** for easy tuning:
```typescript
export async function loadConfig(): Promise<GameConfig> {
  try {
    const response = await fetch('/config/game.json');
    const userConfig = await response.json();
    return { ...defaultConfig, ...userConfig };
  } catch {
    return defaultConfig;
  }
}
```

**Priority**: MEDIUM - Valuable for iteration and tuning

---

## Game Development Best Practices

### ✅ Strengths

1. **Deterministic Systems**: Loop manager designed for repeatable events
2. **Modular Architecture**: Easy to add new systems without breaking existing ones
3. **Resource Cleanup**: Proper disposal patterns prevent memory leaks
4. **Separation of Logic/Presentation**: Systems handle logic, UI layer handles display

### ⚠️ Needs Improvement

1. **Save/Load System**: Not yet implemented (mentioned in roadmap)
   - Critical for time loop mechanics
   - Need state serialization for all systems

2. **Input Abstraction**: Input handling tightly coupled to `FirstPersonController`
   - Should support remapping, gamepad, accessibility

3. **Data-Driven Design**: NPC schedules, events should be JSON-driven
   - Currently hard-coded in code
   - Roadmap mentions JSON schemas - implement these

4. **Debug Tools**: Basic debug controls exist, but need expansion
   - Timeline scrubbing for loop testing
   - NPC path visualization
   - Event trigger visualization

---

## Software Development Best Practices

### ✅ Strengths

1. **TypeScript**: Strong typing throughout
2. **Modular Code**: Clear file organization
3. **Version Control**: Git repository structure
4. **Build System**: Vite configured with TypeScript checking

### ⚠️ Needs Improvement

1. **Testing**: No test infrastructure (CRITICAL)
2. **CI/CD**: No continuous integration setup
3. **Linting**: ESLint mentioned in package.json but no config file
4. **Code Review**: No PR templates or review guidelines
5. **Logging**: Console.log used; need structured logging
6. **Error Boundaries**: No crash recovery or error reporting

---

## Extensibility Assessment

### Current Extensibility: ★★★★☆ (4/5)

**Positive**:
- New systems can be added easily (follow existing patterns)
- Event-driven architecture supports adding new behaviors
- Type system helps catch integration errors early
- Clear interfaces for extending (e.g., `LoopEvent`, `NpcSchedule`)

**Limitations**:
- Tightly coupled to Babylon.js (can't easily swap renderers)
- Physics engine choice affects entire codebase
- Global state in `main.ts` makes testing/mocking difficult
- No plugin architecture for community extensions

**Recommendations for Improved Extensibility**:

1. **Plugin/Mod System**:
```typescript
interface GamePlugin {
  name: string;
  version: string;
  init(game: Game): void;
  dispose(): void;
}

class PluginManager {
  private plugins: Map<string, GamePlugin> = new Map();
  
  register(plugin: GamePlugin) {
    this.plugins.set(plugin.name, plugin);
    plugin.init(this.game);
  }
}
```

2. **Scene Composition**:
```typescript
// Allow different scene configurations
interface SceneConfig {
  buildings: BuildingDef[];
  npcs: NpcDef[];
  events: EventDef[];
}

// Load from JSON for easy level editing
const scene = await SceneBuilder.fromConfig(config);
```

3. **Behavior Trees for NPCs**:
```typescript
// More flexible than hard-coded schedules
const npcBehavior = new BehaviorTree()
  .sequence('morning_routine')
    .action('goto', { target: 'bakery' })
    .action('wait', { duration: 300 })
    .action('goto', { target: 'plaza' })
  .end();
```

---

## Specific Recommendations by Priority

### 🔴 HIGH PRIORITY (Before Stage 2)

1. **Add testing infrastructure**
   - Setup Vitest with basic tests
   - Test LoopManager, time synchronization
   - Test NPC scheduling logic

2. **Refactor main.ts into Game class**
   - Encapsulate state
   - Enable proper initialization/disposal
   - Make testing possible

3. **Implement state serialization**
   - Required for save/load (roadmap item)
   - Critical for loop reset mechanics
   - Test determinism

4. **Add error logging system**
   - Replace console.log with structured logger
   - Add error reporting for debugging
   - Track performance metrics

### 🟡 MEDIUM PRIORITY (During Stage 2-3)

5. **Create central configuration system**
   - JSON-based game config
   - Easy tuning and balancing
   - Environment-specific settings

6. **Add comprehensive documentation**
   - JSDoc for all public APIs
   - Architecture documentation
   - Setup development guide

7. **Implement data-driven content**
   - JSON schemas for NPCs, events, schedules
   - Content validation
   - Hot reloading for rapid iteration

8. **Add performance monitoring**
   - Track system timings
   - Frame budgeting
   - Identify bottlenecks early

### 🟢 LOW PRIORITY (Stage 4+)

9. **Implement object pooling**
   - Optimize object creation/destruction
   - Reduce GC pressure

10. **Add CI/CD pipeline**
    - Automated testing
    - Automated builds
    - Deploy to staging environment

11. **Create plugin architecture**
    - Support mods/extensions
    - Community content

12. **Add accessibility features**
    - Configurable controls
    - Colorblind modes
    - Subtitle system

---

## Conclusion

### Summary Score Card

| Category | Score | Notes |
|----------|-------|-------|
| **Architecture** | B+ | Solid foundation, good separation of concerns |
| **Code Quality** | B | TypeScript usage is good, needs tests |
| **Extensibility** | A- | Easy to add new systems |
| **Documentation** | C+ | Basic docs exist, needs expansion |
| **Testing** | F | No tests present (critical gap) |
| **Performance** | B | No obvious issues, monitoring needed |
| **Best Practices** | B | Follows many patterns, inconsistent in places |

### Overall Assessment

**This is a well-architected game project** with clear separation of concerns, good use of TypeScript, and a solid foundation for the time loop mystery gameplay. The modular system design is excellent and will support rapid feature development.

**The biggest gap is testing infrastructure** - this should be addressed before moving beyond Stage 2. The lack of tests poses a significant risk for a game with complex time loop mechanics that must be deterministic.

**Recommended Next Steps**:
1. ✅ Add Vitest configuration and write basic tests
2. ✅ Refactor main.ts into an encapsulated Game class
3. ✅ Implement state serialization for save/load
4. ✅ Create central configuration system
5. ✅ Add structured logging

With these improvements, the codebase will be well-positioned for the MVP completion and subsequent content expansion phases outlined in the roadmap.

---

## Appendix: Code Examples

### Example: Improved Game Bootstrap

```typescript
// src/Game.ts
import { Engine, Scene, FreeCamera, Vector3 } from "@babylonjs/core";
import { GameConfig, loadConfig } from "./config/gameConfig";
import { SystemManager } from "./systems/SystemManager";
import { Logger } from "./utils/logger";

export class Game {
  private engine: Engine;
  private scene: Scene;
  private camera: FreeCamera;
  private systems: SystemManager;
  private config: GameConfig;
  private log = Logger.create('Game');
  
  constructor(private canvas: HTMLCanvasElement) {}
  
  async init(): Promise<void> {
    this.log.info('Initializing game...');
    
    // Load configuration
    this.config = await loadConfig();
    
    // Initialize engine
    this.engine = new Engine(this.canvas, true, {
      // ... engine options from config
    });
    
    // Create scene
    this.scene = new Scene(this.engine);
    this.scene.collisionsEnabled = true;
    
    // Setup physics
    await this.setupPhysics();
    
    // Create camera
    this.camera = this.createCamera();
    
    // Initialize all game systems
    this.systems = new SystemManager(this.scene, this.camera, this.config);
    await this.systems.initialize();
    
    // Setup debug tools if enabled
    if (this.config.debug.enabled) {
      this.setupDebugTools();
    }
    
    this.log.info('Game initialized successfully');
  }
  
  start(): void {
    this.log.info('Starting game loop...');
    this.engine.runRenderLoop(() => {
      this.update();
      this.render();
    });
    
    // Handle window resize
    window.addEventListener('resize', () => this.engine.resize());
  }
  
  private update(): void {
    const deltaTime = this.engine.getDeltaTime() / 1000;
    this.systems.update(deltaTime);
  }
  
  private render(): void {
    this.scene.render();
  }
  
  dispose(): void {
    this.log.info('Disposing game...');
    this.systems.dispose();
    this.scene.dispose();
    this.engine.dispose();
  }
  
  // Serialization for save/load
  getState(): GameState {
    return {
      timestamp: Date.now(),
      systems: this.systems.serialize(),
      config: this.config,
    };
  }
  
  loadState(state: GameState): void {
    this.systems.deserialize(state.systems);
  }
}
```

### Example: System Manager

```typescript
// src/systems/SystemManager.ts
export class SystemManager {
  private loopManager: LoopManager;
  private npcSystem: NpcSystem;
  private doorSystem: DoorSystem;
  private dayNightCycle: DayNightCycle;
  private hourlyCycle: HourlyCycle;
  private photoSystem: PhotoSystem;
  
  constructor(
    private scene: Scene,
    private camera: FreeCamera,
    private config: GameConfig
  ) {}
  
  async initialize(): Promise<void> {
    // Initialize systems in dependency order
    this.dayNightCycle = new DayNightCycle(this.scene, {
      dayMs: this.config.dayNight.dayMs,
      nightMs: this.config.dayNight.nightMs,
    });
    
    this.hourlyCycle = new HourlyCycle(this.dayNightCycle);
    
    this.loopManager = new LoopManager(
      this.scene,
      this.config.loop.durationSec,
      this.config.loop.timeScale
    );
    
    this.npcSystem = new NpcSystem(this.scene, this.hourlyCycle);
    this.doorSystem = new DoorSystem(this.scene, this.camera);
    this.photoSystem = new PhotoSystem(this.scene, this.camera);
    
    // Load content
    await this.loadContent();
  }
  
  update(deltaTime: number): void {
    this.loopManager.update(deltaTime);
    // Other systems update via subscriptions
  }
  
  dispose(): void {
    this.doorSystem.dispose();
    this.npcSystem.dispose();
    this.dayNightCycle.dispose();
    this.loopManager.clearEvents();
  }
  
  serialize(): SystemState {
    return {
      loop: {
        elapsed: this.loopManager.elapsed,
        events: this.loopManager.events,
      },
      npcs: this.npcSystem.serialize(),
      // ... other system states
    };
  }
  
  deserialize(state: SystemState): void {
    this.loopManager.elapsed = state.loop.elapsed;
    this.npcSystem.deserialize(state.npcs);
    // ... restore other systems
  }
}
```

### Example: Test Structure

```typescript
// tests/systems/loopManager.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { LoopManager } from '../../src/systems/loopManager';
import { createMockScene } from '../helpers/mockScene';

describe('LoopManager', () => {
  let scene: Scene;
  let manager: LoopManager;
  
  beforeEach(() => {
    scene = createMockScene();
    manager = new LoopManager(scene, 10, 1); // 10 second loop
  });
  
  describe('loop timing', () => {
    it('should wrap elapsed time when exceeding duration', () => {
      manager.start();
      manager.update(11); // 11 seconds > 10 second loop
      expect(manager.elapsed).toBeLessThan(10);
      expect(manager.elapsed).toBeGreaterThanOrEqual(0);
    });
    
    it('should respect time scale', () => {
      const fastManager = new LoopManager(scene, 10, 2); // 2x speed
      fastManager.start();
      fastManager.update(1); // 1 real second
      expect(fastManager.elapsed).toBe(2); // = 2 game seconds
    });
  });
  
  describe('event scheduling', () => {
    it('should fire events at scheduled time', () => {
      const callback = jest.fn();
      manager.scheduleEvent('test_event', 5, callback);
      manager.start();
      
      manager.update(4); // Before trigger time
      expect(callback).not.toHaveBeenCalled();
      
      manager.update(2); // Total 6 seconds, past trigger
      expect(callback).toHaveBeenCalledTimes(1);
    });
    
    it('should handle repeating events', () => {
      const callback = jest.fn();
      manager.scheduleEvent('repeat_test', 2, callback, {
        repeat: true,
        intervalSec: 3,
      });
      manager.start();
      
      manager.update(5); // Should trigger at 2s and 5s
      expect(callback).toHaveBeenCalledTimes(2);
    });
    
    it('should reset events when loop wraps', () => {
      const callback = jest.fn();
      manager.scheduleEvent('wrap_test', 5, callback);
      manager.start();
      
      manager.update(11); // Loop wraps at 10s
      expect(callback).toHaveBeenCalledTimes(1);
      
      manager.update(5); // Second loop
      expect(callback).toHaveBeenCalledTimes(2); // Should fire again
    });
  });
  
  describe('event management', () => {
    it('should remove events by id', () => {
      const callback = jest.fn();
      manager.scheduleEvent('removable', 5, callback);
      manager.removeEvent('removable');
      manager.start();
      manager.update(10);
      expect(callback).not.toHaveBeenCalled();
    });
    
    it('should clear all events', () => {
      const cb1 = jest.fn();
      const cb2 = jest.fn();
      manager.scheduleEvent('event1', 3, cb1);
      manager.scheduleEvent('event2', 7, cb2);
      manager.clearEvents();
      manager.start();
      manager.update(10);
      expect(cb1).not.toHaveBeenCalled();
      expect(cb2).not.toHaveBeenCalled();
    });
  });
});
```

---

**Document Version**: 1.0  
**Next Review**: After Stage 2 completion

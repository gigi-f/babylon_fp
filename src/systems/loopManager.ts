import { Scene, MeshBuilder, StandardMaterial, Color3, Vector3 } from "@babylonjs/core";
import { DEFAULT_CRIME_COLOR } from "./sharedConstants";
import { Logger } from "../utils/logger";
import { Serializable, LoopManagerState, ScheduledEventState } from "../state/gameState";
import type { LoopEventDefinition } from "../content/schemas";

const log = Logger.create('LoopManager');

/**
 * Represents a scheduled event within the game loop.
 * Events can be one-time or repeating at specified intervals.
 */
export type LoopEvent = {
  /** Unique identifier for the event */
  id: string;
  /** Time in seconds when the event should trigger */
  timeSec: number;
  /** Callback function executed when the event triggers */
  callback: (scene: Scene) => void;
  /** Whether the event repeats after triggering */
  repeat?: boolean;
  /** Interval in seconds for repeating events */
  intervalSec?: number;
  /** Whether the event is active and can trigger */
  active?: boolean;
  /** Original trigger time for repeating events (used for reset) */
  originalTimeSec?: number;
};

/**
 * Manages the game's time loop mechanics, including event scheduling
 * and deterministic loop wrapping.
 * 
 * The LoopManager handles:
 * - Deterministic time progression with configurable time scale
 * - Event scheduling at specific loop times
 * - Repeating events with intervals
 * - Clean loop wrapping (events trigger in correct order)
 * - State serialization for save/load
 * 
 * @example
 * ```typescript
 * // Create a 120-second loop at normal speed
 * const loop = new LoopManager(scene, 120, 1);
 * 
 * // Schedule a one-time event at 30 seconds
 * loop.scheduleEvent('crime_spawn', 30, (scene) => {
 *   console.log('Crime spawned!');
 *   spawnCrime(scene);
 * });
 * 
 * // Schedule a repeating event every 10 seconds
 * loop.scheduleEvent('patrol_check', 5, (scene) => {
 *   updatePatrol(scene);
 * }, true, 10);
 * 
 * // Start the loop
 * loop.start();
 * 
 * // Update in render loop
 * scene.onBeforeRenderObservable.add(() => {
 *   const deltaSeconds = engine.getDeltaTime() / 1000;
 *   loop.update(deltaSeconds);
 * });
 * ```
 * 
 * @example
 * ```typescript
 * // Serialize for save/load
 * const state = loop.serialize();
 * localStorage.setItem('loop_state', JSON.stringify(state));
 * 
 * // Later, restore state
 * const savedState = JSON.parse(localStorage.getItem('loop_state'));
 * loop.deserialize(savedState);
 * 
 * // Re-register event callbacks
 * const eventIds = loop.getSerializedEventIds();
 * eventIds.forEach(id => {
 *   loop.scheduleEvent(id, time, callbackMap[id], repeat, interval);
 * });
 * ```
 */
export class LoopManager implements Serializable<LoopManagerState> {
  /** The Babylon.js scene this loop manager operates on */
  scene: Scene;
  /** Duration of one complete loop in seconds */
  loopDuration: number;
  /** Multiplier for time progression (1.0 = normal, 2.0 = double speed, 0.5 = half speed) */
  timeScale: number;
  /** Current elapsed time within the loop in seconds */
  elapsed: number;
  /** Array of scheduled events */
  events: LoopEvent[];
  /** Whether the loop is currently running */
  running: boolean;

  /**
   * Creates a new LoopManager instance.
   * 
   * @param scene - The Babylon.js scene to manage
   * @param loopDurationSec - Duration of one loop cycle in seconds (default: 120)
   * @param timeScale - Time multiplier for speeding up/slowing down (default: 1)
   * 
   * @example
   * ```typescript
   * // Standard 2-minute loop
   * const loop = new LoopManager(scene, 120, 1);
   * 
   * // Fast 1-minute loop at 2x speed
   * const fastLoop = new LoopManager(scene, 60, 2);
   * ```
   */
  constructor(scene: Scene, loopDurationSec = 120, timeScale = 1) {
    this.scene = scene;
    this.loopDuration = loopDurationSec;
    this.timeScale = timeScale;
    this.elapsed = 0;
    this.events = [];
    this.running = false;
  }

  /**
   * Starts the loop timer. Events will begin triggering during update() calls.
   * 
   * @example
   * ```typescript
   * loop.start();
   * // Loop is now running and will process events
   * ```
   */
  start() {
    this.running = true;
  }

  /**
   * Stops the loop timer. Events will not trigger until start() is called again.
   * Elapsed time is preserved.
   * 
   * @example
   * ```typescript
   * loop.stop();
   * // Loop is paused, elapsed time preserved
   * loop.start(); // Resume from where it stopped
   * ```
   */
  stop() {
    this.running = false;
  }

  /**
   * Resets the loop to the beginning (elapsed time = 0) and reactivates all events.
   * Repeating events are reset to their original trigger times.
   * 
   * @example
   * ```typescript
   * loop.reset();
   * // Loop starts over from time 0
   * ```
   */
  reset() {
    this.elapsed = 0;
    for (const e of this.events) {
      e.active = true;
      // Reset repeating events to their original time
      if (e.repeat && e.originalTimeSec !== undefined) {
        e.timeSec = e.originalTimeSec;
      }
    }
  }

  /**
   * Updates the loop timer and triggers events that have reached their scheduled time.
   * Handles loop wrapping when elapsed time exceeds loop duration.
   * 
   * This method should be called every frame, typically in the scene's render loop.
   * 
   * @param deltaSec - Time elapsed since last update in seconds
   * 
   * @example
   * ```typescript
   * scene.onBeforeRenderObservable.add(() => {
   *   const deltaSeconds = engine.getDeltaTime() / 1000;
   *   loop.update(deltaSeconds);
   * });
   * ```
   * 
   * @remarks
   * - Events trigger in chronological order
   * - Multiple loop wraps in a single frame are handled correctly
   * - Event callbacks are wrapped in try-catch for error resilience
   * - Repeating events automatically reschedule after triggering
   */
  update(deltaSec: number) {
    if (!this.running) return;
    const scaled = deltaSec * this.timeScale;
    this.elapsed += scaled;

    // Handle multiple loop wraps - keep wrapping until within duration
    while (this.elapsed >= this.loopDuration) {
      const overflow = this.elapsed - this.loopDuration;
      
      // Fire any events that should trigger before the wrap
      for (const e of this.events) {
        if (!e.active) continue;
        if (e.timeSec < this.loopDuration && this.elapsed >= e.timeSec) {
          try {
            e.callback(this.scene);
          } catch (err) {
            log.error(`Event callback error during wrap for event '${e.id}'`, err);
          }
          if (e.repeat && e.intervalSec) {
            e.timeSec += e.intervalSec;
          } else {
            e.active = false;
          }
        }
      }
      
      this.reset();
      this.elapsed = overflow;
    }

    // Check events in current loop iteration
    for (const e of this.events) {
      if (!e.active) continue;
      if (this.elapsed >= e.timeSec) {
        try {
          e.callback(this.scene);
        } catch (err) {
          log.error(`Event callback error for event '${e.id}'`, err);
        }
        if (e.repeat && e.intervalSec) {
          e.timeSec += e.intervalSec;
        } else {
          e.active = false;
        }
      }
    }
  }

  /**
   * Schedules a new event to trigger at a specific time in the loop.
   * 
   * @param id - Unique identifier for the event
   * @param timeSec - Time in seconds when the event should trigger (relative to loop start)
   * @param callback - Function to execute when the event triggers
   * @param opts - Optional configuration
   * @param opts.repeat - Whether the event should repeat
   * @param opts.intervalSec - Interval in seconds for repeating events
   * 
   * @example
   * ```typescript
   * // One-time event
   * loop.scheduleEvent('crime_1', 30, (scene) => {
   *   spawnCrime(scene, 'robbery');
   * });
   * 
   * // Repeating event every 15 seconds starting at 5 seconds
   * loop.scheduleEvent('patrol', 5, (scene) => {
   *   updatePatrolRoutes(scene);
   * }, { repeat: true, intervalSec: 15 });
   * ```
   * 
   * @remarks
   * - Event IDs should be unique for state serialization
   * - Repeating events store their original time for reset()
   * - Callbacks are executed with the scene as context
   */
  scheduleEvent(
    id: string,
    timeSec: number,
    callback: (scene: Scene) => void,
    opts?: { repeat?: boolean; intervalSec?: number }
  ) {
    this.events.push({
      id,
      timeSec,
      callback,
      repeat: opts?.repeat,
      intervalSec: opts?.intervalSec,
      active: true,
      originalTimeSec: timeSec, // Store original time for reset
    });
  }

  /**
   * Schedules an event from a JSON definition with a custom callback.
   * 
   * This method bridges JSON event definitions with the loop system,
   * converting JSON metadata into scheduled events with custom behavior.
   * 
   * @param definition - Event definition loaded from JSON
   * @param callback - Callback to execute when event triggers (receives scene and definition)
   * 
   * @example
   * ```typescript
   * const result = await contentLoader.loadEvent('events/crime_theft.json');
   * if (result.success) {
   *   loop.scheduleEventFromDefinition(result.data, (scene, eventDef) => {
   *     // Access event metadata
   *     console.log('Crime type:', eventDef.metadata?.crimeType);
   *     
   *     // Spawn crime at specified position
   *     if (eventDef.position) {
   *       spawnCrime(scene, eventDef.position, eventDef.metadata);
   *     }
   *   });
   * }
   * ```
   * 
   * @example
   * ```typescript
   * // Using event type to determine behavior
   * loop.scheduleEventFromDefinition(eventDef, (scene, def) => {
   *   switch (def.type) {
   *     case 'crime':
   *       handleCrimeEvent(scene, def);
   *       break;
   *     case 'patrol':
   *       handlePatrolEvent(scene, def);
   *       break;
   *     case 'interaction':
   *       handleInteractionEvent(scene, def);
   *       break;
   *     case 'custom':
   *       handleCustomEvent(scene, def);
   *       break;
   *   }
   * });
   * ```
   */
  scheduleEventFromDefinition(
    definition: LoopEventDefinition,
    callback: (scene: Scene, definition: LoopEventDefinition) => void
  ): void {
    this.scheduleEvent(
      definition.id,
      definition.triggerTime,
      (scene) => callback(scene, definition),
      {
        repeat: definition.repeat,
        intervalSec: definition.repeatInterval,
      }
    );
    
    log.info('Scheduled event from definition', {
      id: definition.id,
      type: definition.type,
      triggerTime: definition.triggerTime,
      repeat: definition.repeat,
    });
  }

  /**
   * Schedules multiple events from JSON definitions with a shared callback handler.
   * 
   * @param definitions - Array of event definitions
   * @param callback - Callback to handle all events (receives scene and specific definition)
   * 
   * @example
   * ```typescript
   * const pack = await contentLoader.loadContentPack('packs/scenario.json');
   * if (pack.success) {
   *   loop.scheduleEventsFromDefinitions(pack.data.events, handleGameEvent);
   * }
   * ```
   */
  scheduleEventsFromDefinitions(
    definitions: LoopEventDefinition[],
    callback: (scene: Scene, definition: LoopEventDefinition) => void
  ): void {
    for (const def of definitions) {
      this.scheduleEventFromDefinition(def, callback);
    }
    
    log.info('Scheduled multiple events from definitions', {
      count: definitions.length,
    });
  }

  /**
   * Removes an event from the schedule by its ID.
   * 
   * @param id - ID of the event to remove
   * 
   * @example
   * ```typescript
   * loop.removeEvent('crime_1');
   * // Event will no longer trigger
   * ```
   */
  removeEvent(id: string) {
    this.events = this.events.filter((e) => e.id !== id);
  }

  /**
   * Removes all scheduled events from the loop.
   * 
   * @example
   * ```typescript
   * loop.clearEvents();
   * // All events removed, loop continues running
   * ```
   */
  clearEvents() {
    this.events = [];
  }

  /**
   * Serializes the loop manager state to a plain object for persistence.
   * 
   * @returns Serialized state containing timing, scale, and event metadata
   * 
   * @remarks
   * - Event callbacks cannot be serialized (JavaScript functions aren't JSON-safe)
   * - Only active events are included in serialization
   * - After deserializing, callbacks must be re-registered using getSerializedEventIds()
   * 
   * @example
   * ```typescript
   * const state = loop.serialize();
   * localStorage.setItem('loop_state', JSON.stringify(state));
   * ```
   */
  serialize(): LoopManagerState {
    return {
      elapsedSeconds: this.elapsed,
      loopDurationSeconds: this.loopDuration,
      timeScale: this.timeScale,
      events: this.events
        .filter(e => e.active) // Only serialize active events
        .map(e => ({
          id: e.id,
          triggerTime: e.timeSec,
          isRepeating: e.repeat || false,
          repeatInterval: e.intervalSec,
        })),
      isRunning: this.running,
    };
  }

  /**
   * Deserializes and restores loop manager state from a saved object.
   * 
   * @param state - Previously serialized loop state
   * 
   * @remarks
   * - Event callbacks are NOT restored and must be re-registered
   * - Use getSerializedEventIds() to get list of events needing callbacks
   * - Running state is restored, but you may want to verify before starting
   * 
   * @example
   * ```typescript
   * const savedState = JSON.parse(localStorage.getItem('loop_state'));
   * loop.deserialize(savedState);
   * 
   * // Re-register callbacks
   * const eventIds = loop.getSerializedEventIds();
   * eventIds.forEach(id => {
   *   const eventData = eventCallbackMap[id];
   *   loop.scheduleEvent(id, eventData.time, eventData.callback, eventData.opts);
   * });
   * ```
   */
  deserialize(state: LoopManagerState): void {
    this.elapsed = state.elapsedSeconds;
    this.loopDuration = state.loopDurationSeconds;
    this.timeScale = state.timeScale;
    this.running = state.isRunning;
    
    // Clear existing events
    this.events = [];
    
    // Note: Callbacks are not serialized, so events are loaded without callbacks
    // The game must re-register event callbacks after deserialization
    log.warn('Events deserialized without callbacks - must be re-registered', {
      eventCount: state.events.length,
    });
  }

  /**
   * Returns an array of event IDs from the current event schedule.
   * Useful for determining which callbacks need to be re-registered after deserialization.
   * 
   * @returns Array of event IDs currently scheduled
   * 
   * @example
   * ```typescript
   * // Before serialization, get event list
   * const eventIds = loop.getSerializedEventIds();
   * 
   * // After deserialization, re-register
   * eventIds.forEach(id => {
   *   loop.scheduleEvent(id, times[id], callbacks[id], opts[id]);
   * });
   * ```
   */
  getSerializedEventIds(): string[] {
    return this.events.filter(e => e.active).map(e => e.id);
  }
}

/**
 * Creates a staged crime event callback that spawns a visual marker at the specified position.
 * 
 * This is a helper function for quickly creating test crime events during development.
 * The marker is a red sphere that auto-disposes after 3 seconds.
 * 
 * @param scene - The Babylon.js scene (currently unused, kept for API consistency)
 * @param pos - World position for the crime marker (default: origin)
 * @returns Callback function suitable for LoopManager.scheduleEvent()
 * 
 * @example
 * ```typescript
 * // Schedule a crime at position (5, 0.5, 10) at 30 seconds
 * loop.scheduleEvent(
 *   'crime_robbery',
 *   30,
 *   stagedCrimeAt(scene, { x: 5, y: 0.5, z: 10 })
 * );
 * ```
 * 
 * @remarks
 * This is a development/testing utility. Production crime spawning should use
 * a proper crime system with more sophisticated logic.
 */
export function stagedCrimeAt(scene: Scene, pos = { x: 0, y: 0.5, z: 0 }) {
  return (s: Scene) => {
    // create a visible marker (low-fi red sphere) that represents the crime
    const sph = MeshBuilder.CreateSphere(`crime_${Date.now()}`, { diameter: 0.4 }, s);
    sph.position = new Vector3(pos.x, pos.y, pos.z);
    const mat = new StandardMaterial(`crimeMat_${Date.now()}`, s);
    mat.diffuseColor = DEFAULT_CRIME_COLOR;
    sph.material = mat;
    // auto-remove after a short time so scene stays clean
    setTimeout(() => {
      try {
        sph.dispose();
      } catch {}
    }, 15_000);
  };
}

export default LoopManager;
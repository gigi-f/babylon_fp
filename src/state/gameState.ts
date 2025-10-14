/**
 * State serialization interfaces for the game.
 * 
 * This module defines the structure for serializing and deserializing
 * game state, enabling save/load functionality.
 */

/**
 * Interface for systems that support serialization
 */
export interface Serializable<T> {
  /**
   * Serialize the system's current state to a plain object
   */
  serialize(): T;
  
  /**
   * Restore the system's state from a serialized object
   */
  deserialize(state: T): void;
}

/**
 * Scheduled event state
 */
export interface ScheduledEventState {
  id: string;
  triggerTime: number;
  isRepeating: boolean;
  repeatInterval?: number;
}

/**
 * LoopManager state
 */
export interface LoopManagerState {
  elapsedSeconds: number;
  loopDurationSeconds: number;
  timeScale: number;
  events: ScheduledEventState[];
  isRunning: boolean;
}

/**
 * NPC position and rotation
 */
export interface NpcTransform {
  position: { x: number; y: number; z: number };
  rotation: { x: number; y: number; z: number };
}

/**
 * NPC schedule entry
 */
export interface NpcScheduleEntry {
  hour: number;
  position: { x: number; y: number; z: number };
}

/**
 * Individual NPC state
 */
export interface NpcState {
  id: string;
  name: string;
  color: [number, number, number];
  transform: NpcTransform;
  schedule: NpcScheduleEntry[];
  currentTargetHour?: number;
}

/**
 * NpcSystem state
 */
export interface NpcSystemState {
  npcs: NpcState[];
}

/**
 * Door state
 */
export interface DoorState {
  meshName: string;
  isOpen: boolean;
  isAnimating: boolean;
  position: { x: number; y: number; z: number };
  rotation: { x: number; y: number; z: number };
}

/**
 * DoorSystem state
 */
export interface DoorSystemState {
  doors: DoorState[];
}

/**
 * Photo data
 */
export interface PhotoData {
  id: string;
  timestamp: number;
  loopTime: number;
  dataUrl: string;
  metadata?: {
    location?: { x: number; y: number; z: number };
    direction?: { x: number; y: number; z: number };
    tags?: string[];
  };
}

/**
 * PhotoSystem state
 */
export interface PhotoSystemState {
  photos: PhotoData[];
  currentPhotoIndex: number;
}

/**
 * Day/Night cycle state
 */
export interface DayNightCycleState {
  elapsedMs: number;
  isDay: boolean;
  currentSunIntensity: number;
  currentMoonIntensity: number;
}

/**
 * HourlyCycle state
 */
export interface HourlyCycleState {
  currentHour: number;
  elapsedMs: number;
}

/**
 * Complete game state
 */
export interface GameState {
  version: string;
  timestamp: number;
  loopManager: LoopManagerState;
  npcSystem: NpcSystemState;
  doorSystem: DoorSystemState;
  photoSystem: PhotoSystemState;
  dayNightCycle: DayNightCycleState;
  hourlyCycle: HourlyCycleState;
}

/**
 * Validation result
 */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Current state format version
 */
export const STATE_VERSION = "1.0.0";

/**
 * Validate a complete game state object
 */
export function validateGameState(state: any): ValidationResult {
  const errors: string[] = [];

  if (!state || typeof state !== 'object') {
    errors.push('State must be an object');
    return { valid: false, errors };
  }

  // Check version
  if (!state.version || typeof state.version !== 'string') {
    errors.push('State must have a version string');
  }

  // Check timestamp
  if (!state.timestamp || typeof state.timestamp !== 'number') {
    errors.push('State must have a timestamp');
  }

  // Check required subsystems
  const requiredSystems = ['loopManager', 'npcSystem', 'doorSystem', 'dayNightCycle', 'hourlyCycle'];
  for (const system of requiredSystems) {
    if (!state[system]) {
      errors.push(`State must have ${system}`);
    }
  }

  // Validate loopManager
  if (state.loopManager) {
    if (typeof state.loopManager.elapsedSeconds !== 'number') {
      errors.push('loopManager.elapsedSeconds must be a number');
    }
    if (!Array.isArray(state.loopManager.events)) {
      errors.push('loopManager.events must be an array');
    }
  }

  // Validate npcSystem
  if (state.npcSystem) {
    if (!Array.isArray(state.npcSystem.npcs)) {
      errors.push('npcSystem.npcs must be an array');
    }
  }

  // Validate doorSystem
  if (state.doorSystem) {
    if (!Array.isArray(state.doorSystem.doors)) {
      errors.push('doorSystem.doors must be an array');
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Create an empty game state
 */
export function createEmptyGameState(): GameState {
  return {
    version: STATE_VERSION,
    timestamp: Date.now(),
    loopManager: {
      elapsedSeconds: 0,
      loopDurationSeconds: 120,
      timeScale: 1,
      events: [],
      isRunning: false,
    },
    npcSystem: {
      npcs: [],
    },
    doorSystem: {
      doors: [],
    },
    photoSystem: {
      photos: [],
      currentPhotoIndex: 0,
    },
    dayNightCycle: {
      elapsedMs: 0,
      isDay: true,
      currentSunIntensity: 1.0,
      currentMoonIntensity: 0.3,
    },
    hourlyCycle: {
      currentHour: 0,
      elapsedMs: 0,
    },
  };
}

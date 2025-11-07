/**
 * Central game configuration system
 * 
 * This module defines the game's configuration structure and provides
 * utilities for loading and validating configuration from JSON files.
 */

/**
 * Loop timing configuration
 */
export interface LoopConfig {
  /** Duration of one game loop in seconds */
  durationSec: number;
  /** Time scale multiplier (1.0 = normal speed) */
  timeScale: number;
}

/**
 * Day/Night cycle configuration
 */
export interface DayNightConfig {
  /** Duration of daytime in milliseconds */
  dayMs: number;
  /** Duration of nighttime in milliseconds */
  nightMs: number;
  /** Sun light intensity during day */
  sunIntensity: number;
  /** Moon light intensity during night */
  moonIntensity: number;
}

/**
 * Debug configuration
 */
export interface DebugConfig {
  /** Enable debug features */
  enabled: boolean;
  /** Show collision meshes */
  showColliders: boolean;
  /** Log loop events to console */
  logEvents: boolean;
  /** Show FPS counter */
  showFPS: boolean;
}

/**
 * Performance configuration
 */
export interface PerformanceConfig {
  /** Target frames per second */
  targetFPS: number;
  /** Enable anti-aliasing */
  antiAliasing: boolean;
}

/**
 * Player controller configuration
 */
export interface PlayerConfig {
  /** Movement speed in units/second */
  moveSpeed: number;
  /** Sprint speed multiplier */
  sprintMultiplier: number;
  /** Mouse sensitivity */
  mouseSensitivity: number;
  /** Camera height */
  cameraHeight: number;
}

/**
 * NPC system configuration
 */
export interface NpcConfig {
  /** NPC movement speed */
  moveSpeed: number;
  /** Enable NPC pathfinding debug visualization */
  showPaths: boolean;
}

/**
 * Door system configuration
 */
export interface DoorConfig {
  /** Maximum interaction range in units */
  interactionRange: number;
  /** Door animation duration in seconds */
  animationDuration: number;
}

/**
 * Complete game configuration
 */
export interface GameConfig {
  loop: LoopConfig;
  dayNight: DayNightConfig;
  debug: DebugConfig;
  performance: PerformanceConfig;
  player: PlayerConfig;
  npc: NpcConfig;
  door: DoorConfig;
}

/**
 * Default configuration values
 */
export const DEFAULT_CONFIG: GameConfig = {
  loop: {
    durationSec: 120,
    timeScale: 1.0,
  },
  dayNight: {
    dayMs: 60_000,
    nightMs: 60_000,
    sunIntensity: 1.2,
    moonIntensity: 0.35,
  },
  debug: {
    enabled: false,
    showColliders: false,
    logEvents: false,
    showFPS: true,
  },
  performance: {
    targetFPS: 60,
    antiAliasing: true,
  },
  player: {
    moveSpeed: 10.0,
    sprintMultiplier: 1.5,
    mouseSensitivity: 0.002,
    cameraHeight: 1.7,
  },
  npc: {
    moveSpeed: 5.0,
    showPaths: false,
  },
  door: {
    interactionRange: 2.5,
    animationDuration: 0.3,
  },
};

/**
 * Recursively merge two configuration objects
 */
function deepMerge<T extends Record<string, any>>(target: T, source: Partial<T>): T {
  const result = { ...target };
  
  for (const key in source) {
    if (source.hasOwnProperty(key)) {
      const sourceValue = source[key];
      const targetValue = result[key];
      
      if (
        sourceValue !== null &&
        typeof sourceValue === 'object' &&
        !Array.isArray(sourceValue) &&
        targetValue !== null &&
        typeof targetValue === 'object' &&
        !Array.isArray(targetValue)
      ) {
        result[key] = deepMerge(targetValue, sourceValue) as any;
      } else if (sourceValue !== undefined) {
        result[key] = sourceValue as any;
      }
    }
  }
  
  return result;
}

/**
 * Validate configuration object
 * @throws Error if configuration is invalid
 */
export function validateConfig(config: any): config is GameConfig {
  if (!config || typeof config !== 'object') {
    throw new Error('Configuration must be an object');
  }
  
  // Validate loop config
  if (config.loop) {
    if (typeof config.loop.durationSec !== 'number' || config.loop.durationSec <= 0) {
      throw new Error('loop.durationSec must be a positive number');
    }
    if (typeof config.loop.timeScale !== 'number' || config.loop.timeScale <= 0) {
      throw new Error('loop.timeScale must be a positive number');
    }
  }
  
  // Validate day/night config
  if (config.dayNight) {
    if (typeof config.dayNight.dayMs !== 'number' || config.dayNight.dayMs <= 0) {
      throw new Error('dayNight.dayMs must be a positive number');
    }
    if (typeof config.dayNight.nightMs !== 'number' || config.dayNight.nightMs <= 0) {
      throw new Error('dayNight.nightMs must be a positive number');
    }
  }
  
  return true;
}

/**
 * Load configuration from a JSON file
 * @param url URL to the JSON configuration file
 * @returns Promise that resolves to the merged configuration
 */
export async function loadConfig(url: string = '/config/game.json'): Promise<GameConfig> {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to load config: ${response.statusText}`);
    }
    
    const userConfig = await response.json();
    
    // Validate the loaded config
    validateConfig(userConfig);
    
    // Merge with defaults
    return deepMerge(DEFAULT_CONFIG, userConfig);
  } catch (error) {
    console.warn(`Failed to load config from ${url}, using defaults:`, error);
    return { ...DEFAULT_CONFIG };
  }
}

/**
 * Load configuration from an object (for testing or programmatic use)
 */
export function createConfig(overrides: Partial<GameConfig> = {}): GameConfig {
  validateConfig({ ...DEFAULT_CONFIG, ...overrides });
  return deepMerge(DEFAULT_CONFIG, overrides);
}

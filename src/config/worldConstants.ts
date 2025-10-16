/**
 * Shared world constants used across the entire application
 * These values must be kept in sync between the map editor and 3D world builder
 */

/**
 * Grid and world size constants
 */
export const GRID_CELL_SIZE = 1; // Each grid cell = 1 unit in 3D world space
export const DEFAULT_GRID_SIZE = 100; // Default grid is 100x100 cells
export const WORLD_SIZE = DEFAULT_GRID_SIZE * GRID_CELL_SIZE; // Total world size in units

/**
 * Building structure constants
 */
export const WALL_HEIGHT = 3.0; // Height of walls in units
export const WALL_THICKNESS = 1.0; // Depth of walls in units
export const WALL_WIDTH = 1.0; // Width of walls (1 cell wide - matches grid)

/**
 * Door constants
 * Doors are 2 cells wide to allow player to pass through
 */
export const DOOR_HEIGHT = 2.2; // Height of doors in units
export const DOOR_WIDTH = 2.0; // Width of doors (2 cells wide for player to fit)

/**
 * Window constants
 */
export const WINDOW_HEIGHT = 1.5; // Height of windows in units
export const WINDOW_WIDTH = 1.0; // Width of windows (1 cell wide to match grid)

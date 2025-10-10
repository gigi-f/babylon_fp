import { Color3, Vector3 } from "@babylonjs/core";

// Shared canonical visual constants to avoid duplicated literals across systems
export const DEFAULT_LOW_POLY_COLOR = new Color3(0.6, 0.6, 0.6);
export const DEFAULT_SUN_COLOR = new Color3(1, 0.95, 0.85);
export const DEFAULT_MOON_COLOR = new Color3(0.8, 0.85, 1.0);
export const DEFAULT_WHITE = new Color3(1, 1, 1);
export const DEFAULT_POLE_COLOR = new Color3(0.15, 0.15, 0.15);
export const DEFAULT_BULB_DIFFUSE = new Color3(0.15, 0.04, 0.03);
export const DEFAULT_CRIME_COLOR = new Color3(0.8, 0.1, 0.1);
export const DEFAULT_DIRECTION_DOWN = new Vector3(0, -1, 0);
export const DEFAULT_CELESTIAL_RADIUS = 60;
export const DEFAULT_CELESTIAL_PZ = 30;
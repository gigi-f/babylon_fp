/**
 * Content Schemas for Data-Driven Game Content
 * 
 * Defines Zod schemas for validating JSON content files.
 * All game content (NPCs, events, schedules) should be validated against these schemas.
 */

import { z } from 'zod';

/**
 * RGB Color array [r, g, b] where each component is 0-1
 */
export const ColorSchema = z.tuple([
  z.number().min(0).max(1),
  z.number().min(0).max(1),
  z.number().min(0).max(1),
]).describe('RGB color values [r, g, b] in range 0-1');

/**
 * 3D Position in world space
 */
export const PositionSchema = z.object({
  x: z.number().describe('X coordinate'),
  y: z.number().describe('Y coordinate'),
  z: z.number().describe('Z coordinate'),
}).describe('3D position in world space');

/**
 * Schedule entry: time (in seconds) -> position
 */
export const ScheduleEntrySchema = z.record(
  z.string().regex(/^\d+$/, 'Schedule time must be a number string'),
  PositionSchema
).describe('Schedule mapping loop time (seconds) to positions');

/**
 * NPC Definition
 * 
 * Defines an NPC's appearance, behavior, and schedule.
 * 
 * @example
 * ```json
 * {
 *   "id": "baker",
 *   "name": "Baker Bob",
 *   "color": [0.8, 0.6, 0.4],
 *   "speed": 2.5,
 *   "schedule": {
 *     "0": { "x": 0, "y": 1, "z": 0 },
 *     "30": { "x": 5, "y": 1, "z": 10 },
 *     "60": { "x": -5, "y": 1, "z": 5 }
 *   },
 *   "metadata": {
 *     "occupation": "baker",
 *     "suspicious": false
 *   }
 * }
 * ```
 */
export const NpcDefinitionSchema = z.object({
  id: z.string().min(1).describe('Unique NPC identifier'),
  name: z.string().min(1).describe('Display name'),
  color: ColorSchema.describe('NPC color (body material)'),
  speed: z.number().positive().default(2.0).describe('Movement speed in units/second'),
  schedule: ScheduleEntrySchema.describe('Time-based position schedule'),
  metadata: z.record(z.string(), z.any()).optional().describe('Additional custom data'),
}).strict().describe('NPC definition with schedule and appearance');

/**
 * Loop Event Definition
 * 
 * Defines an event that triggers at a specific time in the loop.
 * 
 * @example
 * ```json
 * {
 *   "id": "crime_robbery",
 *   "triggerTime": 45,
 *   "type": "crime",
 *   "position": { "x": 10, "y": 0.5, "z": -5 },
 *   "repeat": false,
 *   "metadata": {
 *     "crimeType": "robbery",
 *     "severity": "high",
 *     "evidence": ["footprints", "witness"]
 *   }
 * }
 * ```
 */
export const LoopEventDefinitionSchema = z.object({
  id: z.string().min(1).describe('Unique event identifier'),
  triggerTime: z.number().min(0).describe('Time in seconds when event triggers'),
  type: z.enum(['crime', 'patrol', 'interaction', 'custom']).describe('Event type category'),
  position: PositionSchema.optional().describe('World position for event (if spatial)'),
  repeat: z.boolean().default(false).describe('Whether event repeats'),
  repeatInterval: z.number().positive().optional().describe('Interval for repeating events (seconds)'),
  metadata: z.record(z.string(), z.any()).optional().describe('Additional event-specific data'),
}).strict().describe('Loop event definition');

/**
 * Investigation Definition
 * 
 * Defines an investigation chain with clues and resolution.
 * 
 * @example
 * ```json
 * {
 *   "id": "case_001",
 *   "title": "The Missing Bread",
 *   "description": "Someone stole bread from the bakery",
 *   "clues": [
 *     {
 *       "id": "footprints",
 *       "position": { "x": 5, "y": 0, "z": 10 },
 *       "description": "Muddy footprints leading away"
 *     }
 *   ],
 *   "suspects": ["baker", "guard"],
 *   "solution": {
 *     "culprit": "guard",
 *     "requiredClues": ["footprints", "witness_testimony"]
 *   }
 * }
 * ```
 */
export const ClueSchema = z.object({
  id: z.string().min(1),
  position: PositionSchema,
  description: z.string(),
  discoveryTime: z.number().optional().describe('Loop time when clue becomes available'),
}).strict();

export const InvestigationDefinitionSchema = z.object({
  id: z.string().min(1).describe('Unique investigation identifier'),
  title: z.string().min(1).describe('Investigation title'),
  description: z.string().describe('Investigation description'),
  clues: z.array(ClueSchema).describe('Available clues'),
  suspects: z.array(z.string()).describe('List of suspect NPC IDs'),
  solution: z.object({
    culprit: z.string().describe('Culprit NPC ID'),
    requiredClues: z.array(z.string()).describe('Clues needed to solve'),
  }).describe('Investigation solution'),
  metadata: z.record(z.string(), z.any()).optional(),
}).strict().describe('Investigation case definition');

/**
 * Content Pack Definition
 * 
 * A collection of related content (NPCs, events, investigations).
 * 
 * @example
 * ```json
 * {
 *   "id": "bakery_scenario",
 *   "name": "The Bakery Mystery",
 *   "version": "1.0.0",
 *   "npcs": [...],
 *   "events": [...],
 *   "investigations": [...]
 * }
 * ```
 */
export const ContentPackSchema = z.object({
  id: z.string().min(1).describe('Content pack identifier'),
  name: z.string().min(1).describe('Display name'),
  version: z.string().regex(/^\d+\.\d+\.\d+$/, 'Version must be semver').describe('Semantic version'),
  description: z.string().optional().describe('Content pack description'),
  npcs: z.array(NpcDefinitionSchema).default([]).describe('NPC definitions'),
  events: z.array(LoopEventDefinitionSchema).default([]).describe('Loop event definitions'),
  investigations: z.array(InvestigationDefinitionSchema).default([]).describe('Investigation definitions'),
  metadata: z.record(z.string(), z.any()).optional(),
}).strict().describe('Content pack with NPCs, events, and investigations');

// Type exports for TypeScript
export type Color = z.infer<typeof ColorSchema>;
export type Position = z.infer<typeof PositionSchema>;
export type ScheduleEntry = z.infer<typeof ScheduleEntrySchema>;
export type NpcDefinition = z.infer<typeof NpcDefinitionSchema>;
export type LoopEventDefinition = z.infer<typeof LoopEventDefinitionSchema>;
export type Clue = z.infer<typeof ClueSchema>;
export type InvestigationDefinition = z.infer<typeof InvestigationDefinitionSchema>;
export type ContentPack = z.infer<typeof ContentPackSchema>;

/**
 * Validates and parses NPC definition JSON
 */
export function validateNpcDefinition(data: unknown): NpcDefinition {
  return NpcDefinitionSchema.parse(data);
}

/**
 * Validates and parses loop event definition JSON
 */
export function validateLoopEventDefinition(data: unknown): LoopEventDefinition {
  return LoopEventDefinitionSchema.parse(data);
}

/**
 * Validates and parses investigation definition JSON
 */
export function validateInvestigationDefinition(data: unknown): InvestigationDefinition {
  return InvestigationDefinitionSchema.parse(data);
}

/**
 * Validates and parses content pack JSON
 */
export function validateContentPack(data: unknown): ContentPack {
  return ContentPackSchema.parse(data);
}

/**
 * Safely validates data and returns result with error handling
 */
export function safeValidate<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): { success: true; data: T } | { success: false; error: z.ZodError } {
  const result = schema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  } else {
    return { success: false, error: result.error };
  }
}

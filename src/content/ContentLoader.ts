/**
 * ContentLoader - Loads and validates game content from JSON files
 * 
 * Provides utilities for loading NPCs, events, and investigations from JSON files
 * with schema validation and error handling.
 */

import { Logger } from '../utils/logger';
import {
  NpcDefinition,
  NpcCollection,
  LoopEventDefinition,
  InvestigationDefinition,
  ContentPack,
  validateNpcDefinition,
  validateLoopEventDefinition,
  validateInvestigationDefinition,
  validateContentPack,
  safeValidate,
  NpcDefinitionSchema,
  NpcCollectionSchema,
  LoopEventDefinitionSchema,
  InvestigationDefinitionSchema,
  ContentPackSchema,
} from './schemas';

const logger = Logger.create('ContentLoader');

/**
 * Result of a content load operation
 */
export type LoadResult<T> = 
  | { success: true; data: T }
  | { success: false; error: string; details?: any };

/**
 * ContentLoader class for loading and validating JSON content
 */
export class ContentLoader {
  private baseUrl: string;

  /**
   * Creates a new ContentLoader
   * 
   * @param baseUrl - Base URL for content files (default: '/data')
   * 
   * @example
   * ```typescript
   * const loader = new ContentLoader('/data');
   * const npc = await loader.loadNpc('npcs/baker.json');
   * ```
   */
  constructor(baseUrl = '/data') {
    this.baseUrl = baseUrl.replace(/\/$/, ''); // Remove trailing slash
    logger.info('ContentLoader initialized', { baseUrl });
  }

  /**
   * Loads and validates an NPC definition from a JSON file
   * 
   * @param path - Path relative to baseUrl
   * @returns LoadResult with NPC definition or error
   * 
   * @example
   * ```typescript
   * const result = await loader.loadNpc('npcs/baker.json');
   * if (result.success) {
   *   console.log('Loaded NPC:', result.data.name);
   *   npcSystem.addNpc(result.data);
   * } else {
   *   console.error('Failed to load NPC:', result.error);
   * }
   * ```
   */
  async loadNpc(path: string): Promise<LoadResult<NpcDefinition>> {
    try {
      logger.debug('Loading NPC', { path });
      const url = `${this.baseUrl}/${path}`;
      const response = await fetch(url);
      
      if (!response.ok) {
        const error = `HTTP ${response.status}: ${response.statusText}`;
        logger.error('Failed to fetch NPC', { path, error });
        return { success: false, error };
      }

      const json = await response.json();
      const validation = safeValidate(NpcDefinitionSchema, json);

      if (!validation.success) {
        logger.error('NPC validation failed', { path, errors: validation.error.issues });
        return {
          success: false,
          error: 'Validation failed',
          details: validation.error.issues,
        };
      }

      logger.info('NPC loaded successfully', { path, id: validation.data.id });
      return { success: true, data: validation.data };
    } catch (error) {
      logger.error('Exception loading NPC', { path, error });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Loads a collection of NPC definitions from a single JSON file.
   *
   * @param path - Path to the collection file relative to baseUrl (default: "npcs.json")
   */
  async loadNpcCollection(path = 'npcs.json'): Promise<LoadResult<NpcCollection>> {
    try {
      logger.debug('Loading NPC collection', { path });
      const url = `${this.baseUrl}/${path}`;
      const response = await fetch(url);

      if (!response.ok) {
        if (response.status === 404) {
          logger.info('NPC collection not found', { path });
          return { success: false, error: 'NOT_FOUND', details: { status: 404 } };
        }

        const error = `HTTP ${response.status}: ${response.statusText}`;
        logger.error('Failed to fetch NPC collection', { path, error });
        return { success: false, error, details: { status: response.status } };
      }

      const json = await response.json();
      const validation = safeValidate(NpcCollectionSchema, json);

      if (!validation.success) {
        logger.error('NPC collection validation failed', { path, errors: validation.error.issues });
        return {
          success: false,
          error: 'Validation failed',
          details: validation.error.issues,
        };
      }

      logger.info('NPC collection loaded successfully', { path, count: validation.data.length });
      return { success: true, data: validation.data };
    } catch (error) {
      logger.error('Exception loading NPC collection', { path, error });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Loads and validates a loop event definition from a JSON file
   * 
   * @param path - Path relative to baseUrl
   * @returns LoadResult with event definition or error
   * 
   * @example
   * ```typescript
   * const result = await loader.loadEvent('events/crime_robbery.json');
   * if (result.success) {
   *   loopManager.scheduleEvent(
   *     result.data.id,
   *     result.data.triggerTime,
   *     (scene) => handleEvent(scene, result.data)
   *   );
   * }
   * ```
   */
  async loadEvent(path: string): Promise<LoadResult<LoopEventDefinition>> {
    try {
      logger.debug('Loading event', { path });
      const url = `${this.baseUrl}/${path}`;
      const response = await fetch(url);
      
      if (!response.ok) {
        const error = `HTTP ${response.status}: ${response.statusText}`;
        logger.error('Failed to fetch event', { path, error });
        return { success: false, error };
      }

      const json = await response.json();
      const validation = safeValidate(LoopEventDefinitionSchema, json);

      if (!validation.success) {
        logger.error('Event validation failed', { path, errors: validation.error.issues });
        return {
          success: false,
          error: 'Validation failed',
          details: validation.error.issues,
        };
      }

      logger.info('Event loaded successfully', { path, id: validation.data.id });
      return { success: true, data: validation.data };
    } catch (error) {
      logger.error('Exception loading event', { path, error });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Loads and validates an investigation definition from a JSON file
   * 
   * @param path - Path relative to baseUrl
   * @returns LoadResult with investigation definition or error
   */
  async loadInvestigation(path: string): Promise<LoadResult<InvestigationDefinition>> {
    try {
      logger.debug('Loading investigation', { path });
      const url = `${this.baseUrl}/${path}`;
      const response = await fetch(url);
      
      if (!response.ok) {
        const error = `HTTP ${response.status}: ${response.statusText}`;
        logger.error('Failed to fetch investigation', { path, error });
        return { success: false, error };
      }

      const json = await response.json();
      const validation = safeValidate(InvestigationDefinitionSchema, json);

      if (!validation.success) {
        logger.error('Investigation validation failed', { path, errors: validation.error.issues });
        return {
          success: false,
          error: 'Validation failed',
          details: validation.error.issues,
        };
      }

      logger.info('Investigation loaded successfully', { path, id: validation.data.id });
      return { success: true, data: validation.data };
    } catch (error) {
      logger.error('Exception loading investigation', { path, error });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Loads and validates a complete content pack from a JSON file
   * 
   * @param path - Path relative to baseUrl
   * @returns LoadResult with content pack or error
   * 
   * @example
   * ```typescript
   * const result = await loader.loadContentPack('packs/bakery_scenario.json');
   * if (result.success) {
   *   // Load all NPCs
   *   result.data.npcs.forEach(npc => npcSystem.addNpc(npc));
   *   
   *   // Load all events
   *   result.data.events.forEach(event => {
   *     loopManager.scheduleEvent(event.id, event.triggerTime, ...);
   *   });
   * }
   * ```
   */
  async loadContentPack(path: string): Promise<LoadResult<ContentPack>> {
    try {
      logger.debug('Loading content pack', { path });
      const url = `${this.baseUrl}/${path}`;
      const response = await fetch(url);
      
      if (!response.ok) {
        const error = `HTTP ${response.status}: ${response.statusText}`;
        logger.error('Failed to fetch content pack', { path, error });
        return { success: false, error };
      }

      const json = await response.json();
      const validation = safeValidate(ContentPackSchema, json);

      if (!validation.success) {
        logger.error('Content pack validation failed', { path, errors: validation.error.issues });
        return {
          success: false,
          error: 'Validation failed',
          details: validation.error.issues,
        };
      }

      logger.info('Content pack loaded successfully', {
        path,
        id: validation.data.id,
        npcCount: validation.data.npcs.length,
        eventCount: validation.data.events.length,
        investigationCount: validation.data.investigations.length,
      });
      return { success: true, data: validation.data };
    } catch (error) {
      logger.error('Exception loading content pack', { path, error });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Loads multiple NPCs from an array of paths
   * 
   * @param paths - Array of NPC file paths
   * @returns Array of LoadResult for each NPC
   * 
   * @example
   * ```typescript
   * const results = await loader.loadNpcs([
   *   'npcs/baker.json',
   *   'npcs/guard.json',
   *   'npcs/merchant.json'
   * ]);
   * 
   * const successfulNpcs = results
   *   .filter(r => r.success)
   *   .map(r => r.data);
   * ```
   */
  async loadNpcs(paths: string[]): Promise<LoadResult<NpcDefinition>[]> {
    logger.info('Loading multiple NPCs', { count: paths.length });
    return Promise.all(paths.map(path => this.loadNpc(path)));
  }

  /**
   * Loads multiple events from an array of paths
   * 
   * @param paths - Array of event file paths
   * @returns Array of LoadResult for each event
   */
  async loadEvents(paths: string[]): Promise<LoadResult<LoopEventDefinition>[]> {
    logger.info('Loading multiple events', { count: paths.length });
    return Promise.all(paths.map(path => this.loadEvent(path)));
  }

  /**
   * Loads multiple investigations from an array of paths
   * 
   * @param paths - Array of investigation file paths
   * @returns Array of LoadResult for each investigation
   */
  async loadInvestigations(paths: string[]): Promise<LoadResult<InvestigationDefinition>[]> {
    logger.info('Loading multiple investigations', { count: paths.length });
    return Promise.all(paths.map(path => this.loadInvestigation(path)));
  }
}

/**
 * Default content loader instance
 */
export const defaultLoader = new ContentLoader('/data');

/**
 * Convenience function to load an NPC using the default loader
 */
export async function loadNpc(path: string): Promise<LoadResult<NpcDefinition>> {
  return defaultLoader.loadNpc(path);
}

export async function loadNpcCollection(path = 'npcs.json'): Promise<LoadResult<NpcCollection>> {
  return defaultLoader.loadNpcCollection(path);
}

/**
 * Convenience function to load an event using the default loader
 */
export async function loadEvent(path: string): Promise<LoadResult<LoopEventDefinition>> {
  return defaultLoader.loadEvent(path);
}

/**
 * Convenience function to load an investigation using the default loader
 */
export async function loadInvestigation(path: string): Promise<LoadResult<InvestigationDefinition>> {
  return defaultLoader.loadInvestigation(path);
}

/**
 * Convenience function to load a content pack using the default loader
 */
export async function loadContentPack(path: string): Promise<LoadResult<ContentPack>> {
  return defaultLoader.loadContentPack(path);
}

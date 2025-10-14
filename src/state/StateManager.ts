/**
 * StateManager - Centralized game state management
 * 
 * Handles serialization, deserialization, validation, and persistence
 * of game state for save/load functionality.
 */

import { Logger } from '../utils/logger';
import { GameState, validateGameState, STATE_VERSION, createEmptyGameState } from './gameState';

const logger = Logger.create('StateManager');

/**
 * Save slot identifier
 */
export type SaveSlot = 'auto' | 'manual1' | 'manual2' | 'manual3' | 'quicksave';

/**
 * Save metadata
 */
export interface SaveMetadata {
  slot: SaveSlot;
  timestamp: number;
  version: string;
  loopTime: number;
  playTime?: number;
}

/**
 * Complete save data with metadata
 */
export interface SaveData {
  metadata: SaveMetadata;
  state: GameState;
}

/**
 * StateManager class for managing game state persistence
 */
export class StateManager {
  private storagePrefix = 'babylon_fp_save_';

  /**
   * Serialize game state to JSON string
   */
  serializeState(state: GameState): string {
    try {
      return JSON.stringify(state, null, 2);
    } catch (error) {
      logger.error('Failed to serialize state', { error });
      throw new Error(`State serialization failed: ${error}`);
    }
  }

  /**
   * Deserialize game state from JSON string
   */
  deserializeState(json: string): GameState {
    try {
      const state = JSON.parse(json);
      const validation = validateGameState(state);
      
      if (!validation.valid) {
        throw new Error(`Invalid state: ${validation.errors.join(', ')}`);
      }
      
      return state as GameState;
    } catch (error) {
      logger.error('Failed to deserialize state', { error });
      throw new Error(`State deserialization failed: ${error}`);
    }
  }

  /**
   * Save game state to localStorage
   */
  saveToLocalStorage(slot: SaveSlot, state: GameState, metadata?: Partial<SaveMetadata>): void {
    try {
      const saveData: SaveData = {
        metadata: {
          slot,
          timestamp: Date.now(),
          version: STATE_VERSION,
          loopTime: state.loopManager.elapsedSeconds,
          ...metadata,
        },
        state,
      };

      const key = this.storagePrefix + slot;
      const json = JSON.stringify(saveData);
      localStorage.setItem(key, json);
      
      logger.info('Game saved to localStorage', { slot, timestamp: saveData.metadata.timestamp });
    } catch (error) {
      logger.error('Failed to save to localStorage', { slot, error });
      throw new Error(`Save failed: ${error}`);
    }
  }

  /**
   * Load game state from localStorage
   */
  loadFromLocalStorage(slot: SaveSlot): SaveData | null {
    try {
      const key = this.storagePrefix + slot;
      const json = localStorage.getItem(key);
      
      if (!json) {
        logger.debug('No save found', { slot });
        return null;
      }

      const saveData = JSON.parse(json) as SaveData;
      
      // Validate the state
      const validation = validateGameState(saveData.state);
      if (!validation.valid) {
        logger.error('Loaded save has invalid state', { slot, errors: validation.errors });
        throw new Error(`Invalid save data: ${validation.errors.join(', ')}`);
      }

      logger.info('Game loaded from localStorage', { slot, timestamp: saveData.metadata.timestamp });
      return saveData;
    } catch (error) {
      logger.error('Failed to load from localStorage', { slot, error });
      throw new Error(`Load failed: ${error}`);
    }
  }

  /**
   * Delete a save from localStorage
   */
  deleteSave(slot: SaveSlot): boolean {
    try {
      const key = this.storagePrefix + slot;
      const existed = localStorage.getItem(key) !== null;
      localStorage.removeItem(key);
      
      if (existed) {
        logger.info('Save deleted', { slot });
      }
      
      return existed;
    } catch (error) {
      logger.error('Failed to delete save', { slot, error });
      return false;
    }
  }

  /**
   * List all available saves
   */
  listSaves(): SaveMetadata[] {
    const saves: SaveMetadata[] = [];
    
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(this.storagePrefix)) {
          const json = localStorage.getItem(key);
          if (json) {
            try {
              const saveData = JSON.parse(json) as SaveData;
              saves.push(saveData.metadata);
            } catch (error) {
              logger.warn('Skipping corrupted save', { key, error });
            }
          }
        }
      }
      
      // Sort by timestamp (newest first)
      saves.sort((a, b) => b.timestamp - a.timestamp);
    } catch (error) {
      logger.error('Failed to list saves', { error });
    }
    
    return saves;
  }

  /**
   * Export save to JSON file (download)
   */
  exportToFile(slot: SaveSlot): void {
    try {
      const saveData = this.loadFromLocalStorage(slot);
      if (!saveData) {
        throw new Error('No save found in slot: ' + slot);
      }

      const json = JSON.stringify(saveData, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = url;
      link.download = `babylon_fp_save_${slot}_${Date.now()}.json`;
      link.click();
      
      URL.revokeObjectURL(url);
      
      logger.info('Save exported to file', { slot });
    } catch (error) {
      logger.error('Failed to export save', { slot, error });
      throw error;
    }
  }

  /**
   * Import save from JSON file
   */
  async importFromFile(file: File, targetSlot: SaveSlot): Promise<SaveData> {
    try {
      const json = await file.text();
      const saveData = JSON.parse(json) as SaveData;
      
      // Validate the imported state
      const validation = validateGameState(saveData.state);
      if (!validation.valid) {
        throw new Error(`Invalid save file: ${validation.errors.join(', ')}`);
      }

      // Update metadata for target slot
      saveData.metadata.slot = targetSlot;
      saveData.metadata.timestamp = Date.now();

      // Save to localStorage
      const key = this.storagePrefix + targetSlot;
      localStorage.setItem(key, JSON.stringify(saveData));
      
      logger.info('Save imported from file', { targetSlot, originalSlot: saveData.metadata.slot });
      return saveData;
    } catch (error) {
      logger.error('Failed to import save', { error });
      throw new Error(`Import failed: ${error}`);
    }
  }

  /**
   * Check if a save exists in a slot
   */
  hasSave(slot: SaveSlot): boolean {
    const key = this.storagePrefix + slot;
    return localStorage.getItem(key) !== null;
  }

  /**
   * Get save metadata without loading full state
   */
  getSaveMetadata(slot: SaveSlot): SaveMetadata | null {
    try {
      const key = this.storagePrefix + slot;
      const json = localStorage.getItem(key);
      
      if (!json) {
        return null;
      }

      const saveData = JSON.parse(json) as SaveData;
      return saveData.metadata;
    } catch (error) {
      logger.warn('Failed to get save metadata', { slot, error });
      return null;
    }
  }

  /**
   * Clear all saves
   */
  clearAllSaves(): number {
    let count = 0;
    const keys: string[] = [];
    
    try {
      // Collect keys first
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(this.storagePrefix)) {
          keys.push(key);
        }
      }
      
      // Delete all
      for (const key of keys) {
        localStorage.removeItem(key);
        count++;
      }
      
      logger.info('All saves cleared', { count });
    } catch (error) {
      logger.error('Failed to clear saves', { error });
    }
    
    return count;
  }

  /**
   * Clone a save to another slot
   */
  cloneSave(sourceSlot: SaveSlot, targetSlot: SaveSlot): boolean {
    try {
      const saveData = this.loadFromLocalStorage(sourceSlot);
      if (!saveData) {
        logger.warn('Source save not found', { sourceSlot });
        return false;
      }

      // Update metadata
      saveData.metadata.slot = targetSlot;
      saveData.metadata.timestamp = Date.now();

      // Save to target slot
      const key = this.storagePrefix + targetSlot;
      localStorage.setItem(key, JSON.stringify(saveData));
      
      logger.info('Save cloned', { sourceSlot, targetSlot });
      return true;
    } catch (error) {
      logger.error('Failed to clone save', { sourceSlot, targetSlot, error });
      return false;
    }
  }
}

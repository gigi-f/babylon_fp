import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { StateManager } from '../../src/state/StateManager';
import { GameState, createEmptyGameState, STATE_VERSION } from '../../src/state/gameState';

describe('StateManager', () => {
  let stateManager: StateManager;
  let mockGameState: GameState;

  beforeEach(() => {
    stateManager = new StateManager();
    mockGameState = createEmptyGameState();
    
    // Clear localStorage before each test
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  describe('serializeState', () => {
    it('should serialize game state to JSON string', () => {
      const json = stateManager.serializeState(mockGameState);
      
      expect(json).toBeTypeOf('string');
      expect(JSON.parse(json)).toEqual(mockGameState);
    });

    it('should create pretty-printed JSON', () => {
      const json = stateManager.serializeState(mockGameState);
      
      // Should contain newlines (pretty-printed)
      expect(json).toContain('\n');
      expect(json).toContain('  ');
    });

    it('should handle complex state', () => {
      mockGameState.loopManager.elapsedSeconds = 75.5;
      mockGameState.loopManager.events = [
        { id: 'event1', triggerTime: 60, isRepeating: false },
      ];
      mockGameState.npcSystem.npcs = [
        {
          id: 'npc1',
          name: 'Alice',
          color: [1, 0, 0],
          transform: {
            position: { x: 1, y: 0, z: 2 },
            rotation: { x: 0, y: 0, z: 0 },
          },
          schedule: [],
        },
      ];

      const json = stateManager.serializeState(mockGameState);
      const parsed = JSON.parse(json);

      expect(parsed.loopManager.elapsedSeconds).toBe(75.5);
      expect(parsed.loopManager.events).toHaveLength(1);
      expect(parsed.npcSystem.npcs).toHaveLength(1);
    });
  });

  describe('deserializeState', () => {
    it('should deserialize valid JSON to game state', () => {
      const json = JSON.stringify(mockGameState);
      
      const state = stateManager.deserializeState(json);
      
      expect(state).toEqual(mockGameState);
    });

    it('should validate deserialized state', () => {
      const invalidJson = JSON.stringify({ invalid: 'data' });
      
      expect(() => {
        stateManager.deserializeState(invalidJson);
      }).toThrow();
    });

    it('should throw on malformed JSON', () => {
      const malformedJson = '{ invalid json }';
      
      expect(() => {
        stateManager.deserializeState(malformedJson);
      }).toThrow();
    });

    it('should handle complex state', () => {
      mockGameState.loopManager.elapsedSeconds = 45.678;
      const json = JSON.stringify(mockGameState);
      
      const state = stateManager.deserializeState(json);
      
      expect(state.loopManager.elapsedSeconds).toBe(45.678);
    });
  });

  describe('saveToLocalStorage', () => {
    it('should save state to localStorage', () => {
      stateManager.saveToLocalStorage('manual1', mockGameState);
      
      const saved = localStorage.getItem('babylon_fp_save_manual1');
      expect(saved).not.toBeNull();
    });

    it('should include metadata in save', () => {
      stateManager.saveToLocalStorage('manual1', mockGameState);
      
      const saved = localStorage.getItem('babylon_fp_save_manual1');
      const saveData = JSON.parse(saved!);
      
      expect(saveData.metadata).toBeDefined();
      expect(saveData.metadata.slot).toBe('manual1');
      expect(saveData.metadata.version).toBe(STATE_VERSION);
      expect(saveData.metadata.timestamp).toBeTypeOf('number');
      expect(saveData.state).toEqual(mockGameState);
    });

    it('should accept custom metadata', () => {
      stateManager.saveToLocalStorage('manual1', mockGameState, {
        playTime: 3600,
      });
      
      const saved = localStorage.getItem('babylon_fp_save_manual1');
      const saveData = JSON.parse(saved!);
      
      expect(saveData.metadata.playTime).toBe(3600);
    });

    it('should overwrite existing save in same slot', () => {
      mockGameState.loopManager.elapsedSeconds = 10;
      stateManager.saveToLocalStorage('manual1', mockGameState);
      
      mockGameState.loopManager.elapsedSeconds = 20;
      stateManager.saveToLocalStorage('manual1', mockGameState);
      
      const saved = localStorage.getItem('babylon_fp_save_manual1');
      const saveData = JSON.parse(saved!);
      
      expect(saveData.state.loopManager.elapsedSeconds).toBe(20);
    });
  });

  describe('loadFromLocalStorage', () => {
    it('should load saved state', () => {
      stateManager.saveToLocalStorage('manual1', mockGameState);
      
      const loaded = stateManager.loadFromLocalStorage('manual1');
      
      expect(loaded).not.toBeNull();
      expect(loaded!.state).toEqual(mockGameState);
    });

    it('should return null for non-existent save', () => {
      const loaded = stateManager.loadFromLocalStorage('manual1');
      
      expect(loaded).toBeNull();
    });

    it('should validate loaded state', () => {
      // Manually save invalid data
      localStorage.setItem('babylon_fp_save_manual1', JSON.stringify({
        metadata: { slot: 'manual1', timestamp: Date.now(), version: '1.0.0', loopTime: 0 },
        state: { invalid: 'state' },
      }));
      
      expect(() => {
        stateManager.loadFromLocalStorage('manual1');
      }).toThrow();
    });

    it('should load with correct metadata', () => {
      stateManager.saveToLocalStorage('manual1', mockGameState);
      
      const loaded = stateManager.loadFromLocalStorage('manual1');
      
      expect(loaded!.metadata.slot).toBe('manual1');
      expect(loaded!.metadata.version).toBe(STATE_VERSION);
    });
  });

  describe('deleteSave', () => {
    it('should delete existing save', () => {
      stateManager.saveToLocalStorage('manual1', mockGameState);
      
      const deleted = stateManager.deleteSave('manual1');
      
      expect(deleted).toBe(true);
      expect(localStorage.getItem('babylon_fp_save_manual1')).toBeNull();
    });

    it('should return false for non-existent save', () => {
      const deleted = stateManager.deleteSave('manual1');
      
      expect(deleted).toBe(false);
    });
  });

  describe('listSaves', () => {
    it('should return empty array when no saves', () => {
      const saves = stateManager.listSaves();
      
      expect(saves).toEqual([]);
    });

    it('should list all saves', () => {
      stateManager.saveToLocalStorage('manual1', mockGameState);
      stateManager.saveToLocalStorage('manual2', mockGameState);
      stateManager.saveToLocalStorage('quicksave', mockGameState);
      
      const saves = stateManager.listSaves();
      
      expect(saves).toHaveLength(3);
      expect(saves.map(s => s.slot)).toContain('manual1');
      expect(saves.map(s => s.slot)).toContain('manual2');
      expect(saves.map(s => s.slot)).toContain('quicksave');
    });

    it('should sort saves by timestamp (newest first)', () => {
      // Save with delays to ensure different timestamps
      stateManager.saveToLocalStorage('manual1', mockGameState);
      
      // Wait a bit
      const start = Date.now();
      while (Date.now() - start < 10) {}
      
      stateManager.saveToLocalStorage('manual2', mockGameState);
      
      const saves = stateManager.listSaves();
      
      expect(saves[0].timestamp).toBeGreaterThan(saves[1].timestamp);
    });

    it('should not list non-save items in localStorage', () => {
      localStorage.setItem('other_key', 'value');
      stateManager.saveToLocalStorage('manual1', mockGameState);
      
      const saves = stateManager.listSaves();
      
      expect(saves).toHaveLength(1);
    });
  });

  describe('hasSave', () => {
    it('should return true for existing save', () => {
      stateManager.saveToLocalStorage('manual1', mockGameState);
      
      expect(stateManager.hasSave('manual1')).toBe(true);
    });

    it('should return false for non-existent save', () => {
      expect(stateManager.hasSave('manual1')).toBe(false);
    });
  });

  describe('getSaveMetadata', () => {
    it('should return metadata for existing save', () => {
      stateManager.saveToLocalStorage('manual1', mockGameState);
      
      const metadata = stateManager.getSaveMetadata('manual1');
      
      expect(metadata).not.toBeNull();
      expect(metadata!.slot).toBe('manual1');
      expect(metadata!.version).toBe(STATE_VERSION);
    });

    it('should return null for non-existent save', () => {
      const metadata = stateManager.getSaveMetadata('manual1');
      
      expect(metadata).toBeNull();
    });

    it('should not load full state', () => {
      // This test ensures metadata loading is lightweight
      stateManager.saveToLocalStorage('manual1', mockGameState);
      
      const metadata = stateManager.getSaveMetadata('manual1');
      
      expect(metadata).toBeDefined();
      expect((metadata as any).state).toBeUndefined();
    });
  });

  describe('clearAllSaves', () => {
    it('should clear all saves', () => {
      stateManager.saveToLocalStorage('manual1', mockGameState);
      stateManager.saveToLocalStorage('manual2', mockGameState);
      stateManager.saveToLocalStorage('quicksave', mockGameState);
      
      const count = stateManager.clearAllSaves();
      
      expect(count).toBe(3);
      expect(stateManager.listSaves()).toHaveLength(0);
    });

    it('should not clear non-save items', () => {
      localStorage.setItem('other_key', 'value');
      stateManager.saveToLocalStorage('manual1', mockGameState);
      
      stateManager.clearAllSaves();
      
      expect(localStorage.getItem('other_key')).toBe('value');
    });

    it('should return 0 when no saves to clear', () => {
      const count = stateManager.clearAllSaves();
      
      expect(count).toBe(0);
    });
  });

  describe('cloneSave', () => {
    it('should clone save to another slot', () => {
      stateManager.saveToLocalStorage('manual1', mockGameState);
      
      const cloned = stateManager.cloneSave('manual1', 'manual2');
      
      expect(cloned).toBe(true);
      expect(stateManager.hasSave('manual2')).toBe(true);
    });

    it('should update metadata for cloned save', () => {
      stateManager.saveToLocalStorage('manual1', mockGameState);
      
      const originalTimestamp = stateManager.getSaveMetadata('manual1')!.timestamp;
      
      // Wait a bit
      const start = Date.now();
      while (Date.now() - start < 10) {}
      
      stateManager.cloneSave('manual1', 'manual2');
      
      const clonedMetadata = stateManager.getSaveMetadata('manual2');
      
      expect(clonedMetadata!.slot).toBe('manual2');
      expect(clonedMetadata!.timestamp).toBeGreaterThan(originalTimestamp);
    });

    it('should return false when source does not exist', () => {
      const cloned = stateManager.cloneSave('manual1', 'manual2');
      
      expect(cloned).toBe(false);
    });

    it('should preserve game state in clone', () => {
      mockGameState.loopManager.elapsedSeconds = 42;
      stateManager.saveToLocalStorage('manual1', mockGameState);
      
      stateManager.cloneSave('manual1', 'manual2');
      
      const clonedSave = stateManager.loadFromLocalStorage('manual2');
      
      expect(clonedSave!.state.loopManager.elapsedSeconds).toBe(42);
    });
  });
});

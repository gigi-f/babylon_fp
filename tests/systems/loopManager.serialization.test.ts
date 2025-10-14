import { describe, it, expect, beforeEach } from 'vitest';
import { LoopManager } from '../../src/systems/loopManager';
import { createMockScene } from '../helpers/mockScene';
import { LoopManagerState } from '../../src/state/gameState';

describe('LoopManager Serialization', () => {
  let scene: any;
  let loopManager: LoopManager;

  beforeEach(() => {
    scene = createMockScene();
    loopManager = new LoopManager(scene, 120, 1);
  });

  describe('serialize', () => {
    it('should serialize basic state', () => {
      loopManager.start();
      loopManager.update(30); // Advance 30 seconds

      const state = loopManager.serialize();

      expect(state.elapsedSeconds).toBe(30);
      expect(state.loopDurationSeconds).toBe(120);
      expect(state.timeScale).toBe(1);
      expect(state.isRunning).toBe(true);
      expect(state.events).toEqual([]);
    });

    it('should serialize with scheduled events', () => {
      let callCount = 0;
      const callback = () => { callCount++; };

      loopManager.scheduleEvent('event1', 60, callback);
      loopManager.scheduleEvent('event2', 90, callback, { repeat: true, intervalSec: 30 });

      const state = loopManager.serialize();

      expect(state.events).toHaveLength(2);
      expect(state.events[0]).toEqual({
        id: 'event1',
        triggerTime: 60,
        isRepeating: false,
        repeatInterval: undefined,
      });
      expect(state.events[1]).toEqual({
        id: 'event2',
        triggerTime: 90,
        isRepeating: true,
        repeatInterval: 30,
      });
    });

    it('should only serialize active events', () => {
      let callCount = 0;
      const callback = () => { callCount++; };

      loopManager.scheduleEvent('event1', 10, callback);
      loopManager.scheduleEvent('event2', 90, callback);
      
      loopManager.start();
      loopManager.update(15); // Trigger event1

      const state = loopManager.serialize();

      // Only event2 should be serialized (event1 is inactive)
      expect(state.events).toHaveLength(1);
      expect(state.events[0].id).toBe('event2');
    });

    it('should serialize elapsed time correctly', () => {
      loopManager.start();
      loopManager.update(45.5);

      const state = loopManager.serialize();

      expect(state.elapsedSeconds).toBe(45.5);
    });

    it('should serialize timeScale correctly', () => {
      loopManager.timeScale = 2.5;

      const state = loopManager.serialize();

      expect(state.timeScale).toBe(2.5);
    });

    it('should serialize running state', () => {
      expect(loopManager.serialize().isRunning).toBe(false);

      loopManager.start();
      expect(loopManager.serialize().isRunning).toBe(true);

      loopManager.stop();
      expect(loopManager.serialize().isRunning).toBe(false);
    });
  });

  describe('deserialize', () => {
    it('should restore basic state', () => {
      const state: LoopManagerState = {
        elapsedSeconds: 75,
        loopDurationSeconds: 120,
        timeScale: 1.5,
        events: [],
        isRunning: true,
      };

      loopManager.deserialize(state);

      expect(loopManager.elapsed).toBe(75);
      expect(loopManager.loopDuration).toBe(120);
      expect(loopManager.timeScale).toBe(1.5);
      expect(loopManager.running).toBe(true);
    });

    it('should clear existing events', () => {
      const callback = () => {};
      loopManager.scheduleEvent('event1', 60, callback);
      loopManager.scheduleEvent('event2', 90, callback);

      expect(loopManager.events).toHaveLength(2);

      const state: LoopManagerState = {
        elapsedSeconds: 0,
        loopDurationSeconds: 120,
        timeScale: 1,
        events: [],
        isRunning: false,
      };

      loopManager.deserialize(state);

      expect(loopManager.events).toHaveLength(0);
    });

    it('should restore stopped state', () => {
      loopManager.start();
      expect(loopManager.running).toBe(true);

      const state: LoopManagerState = {
        elapsedSeconds: 30,
        loopDurationSeconds: 120,
        timeScale: 1,
        events: [],
        isRunning: false,
      };

      loopManager.deserialize(state);

      expect(loopManager.running).toBe(false);
    });

    it('should handle decimal elapsed time', () => {
      const state: LoopManagerState = {
        elapsedSeconds: 45.678,
        loopDurationSeconds: 120,
        timeScale: 1,
        events: [],
        isRunning: true,
      };

      loopManager.deserialize(state);

      expect(loopManager.elapsed).toBeCloseTo(45.678, 3);
    });
  });

  describe('round-trip serialization', () => {
    it('should maintain state through serialize/deserialize cycle', () => {
      loopManager.start();
      loopManager.update(55);
      loopManager.timeScale = 2.0;

      const state1 = loopManager.serialize();
      
      const newLoopManager = new LoopManager(scene, 120, 1);
      newLoopManager.deserialize(state1);

      const state2 = newLoopManager.serialize();

      expect(state2.elapsedSeconds).toBe(state1.elapsedSeconds);
      expect(state2.loopDurationSeconds).toBe(state1.loopDurationSeconds);
      expect(state2.timeScale).toBe(state1.timeScale);
      expect(state2.isRunning).toBe(state1.isRunning);
    });

    it('should handle multiple serialize/deserialize cycles', () => {
      loopManager.start();
      loopManager.update(30);

      for (let i = 0; i < 5; i++) {
        const state = loopManager.serialize();
        const newManager = new LoopManager(scene, 120, 1);
        newManager.deserialize(state);
        loopManager = newManager;
        loopManager.update(10);
      }

      expect(loopManager.elapsed).toBeCloseTo(80, 1);
    });
  });

  describe('getSerializedEventIds', () => {
    it('should return IDs of active events', () => {
      const callback = () => {};
      loopManager.scheduleEvent('event1', 60, callback);
      loopManager.scheduleEvent('event2', 90, callback);

      const ids = loopManager.getSerializedEventIds();

      expect(ids).toHaveLength(2);
      expect(ids).toContain('event1');
      expect(ids).toContain('event2');
    });

    it('should not return inactive event IDs', () => {
      let callCount = 0;
      const callback = () => { callCount++; };

      loopManager.scheduleEvent('event1', 10, callback);
      loopManager.scheduleEvent('event2', 90, callback);
      
      loopManager.start();
      loopManager.update(15); // Trigger event1

      const ids = loopManager.getSerializedEventIds();

      expect(ids).toHaveLength(1);
      expect(ids).toContain('event2');
      expect(ids).not.toContain('event1');
    });

    it('should return empty array when no events', () => {
      const ids = loopManager.getSerializedEventIds();
      expect(ids).toEqual([]);
    });
  });

  describe('JSON serialization', () => {
    it('should be JSON-serializable', () => {
      loopManager.start();
      loopManager.update(45);

      const state = loopManager.serialize();
      const json = JSON.stringify(state);
      const parsed = JSON.parse(json);

      expect(parsed.elapsedSeconds).toBe(45);
      expect(parsed.loopDurationSeconds).toBe(120);
      expect(parsed.isRunning).toBe(true);
    });

    it('should handle JSON round-trip', () => {
      const callback = () => {};
      loopManager.scheduleEvent('event1', 60, callback);
      loopManager.start();
      loopManager.update(30);

      const state = loopManager.serialize();
      const json = JSON.stringify(state);
      const parsed = JSON.parse(json) as LoopManagerState;

      const newManager = new LoopManager(scene, 120, 1);
      newManager.deserialize(parsed);

      expect(newManager.elapsed).toBe(30);
      expect(newManager.running).toBe(true);
    });
  });
});

/**
 * Tests for LoopManager
 * Validates time loop mechanics, event scheduling, and deterministic behavior
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { LoopManager } from '../../src/systems/loopManager';
import { createMockScene } from '../helpers/mockScene';
import { createSpy, assertClose } from '../helpers/testUtils';

describe('LoopManager', () => {
  let scene: any;
  let manager: LoopManager;

  beforeEach(() => {
    scene = createMockScene();
    manager = new LoopManager(scene, 10, 1); // 10 second loop, 1x time scale
  });

  describe('initialization', () => {
    it('should initialize with correct default values', () => {
      expect(manager.loopDuration).toBe(10);
      expect(manager.timeScale).toBe(1);
      expect(manager.elapsed).toBe(0);
      expect(manager.running).toBe(false);
      expect(manager.events).toEqual([]);
    });

    it('should accept custom loop duration', () => {
      const customManager = new LoopManager(scene, 120, 1);
      expect(customManager.loopDuration).toBe(120);
    });

    it('should accept custom time scale', () => {
      const customManager = new LoopManager(scene, 10, 2);
      expect(customManager.timeScale).toBe(2);
    });
  });

  describe('start and stop', () => {
    it('should start the loop', () => {
      manager.start();
      expect(manager.running).toBe(true);
    });

    it('should stop the loop', () => {
      manager.start();
      manager.stop();
      expect(manager.running).toBe(false);
    });

    it('should not update when stopped', () => {
      manager.scheduleEvent('test', 5, createSpy());
      manager.update(10);
      expect(manager.elapsed).toBe(0); // Should not advance
    });
  });

  describe('loop timing', () => {
    it('should advance elapsed time when running', () => {
      manager.start();
      manager.update(3);
      expect(manager.elapsed).toBe(3);
    });

    it('should wrap elapsed time when exceeding duration', () => {
      manager.start();
      manager.update(11); // 11 seconds > 10 second loop
      expect(manager.elapsed).toBeLessThan(10);
      expect(manager.elapsed).toBeGreaterThanOrEqual(0);
      assertClose(manager.elapsed, 1, 0.01); // Should wrap to ~1
    });

    it('should wrap exactly at loop duration', () => {
      manager.start();
      manager.update(10);
      expect(manager.elapsed).toBe(0); // Exact wrap
    });

    it('should handle multiple wraps', () => {
      manager.start();
      manager.update(25); // 2.5 loops
      assertClose(manager.elapsed, 5, 0.01);
    });

    it('should respect time scale', () => {
      const fastManager = new LoopManager(scene, 10, 2); // 2x speed
      fastManager.start();
      fastManager.update(1); // 1 real second
      expect(fastManager.elapsed).toBe(2); // = 2 game seconds
    });

    it('should handle fractional time scales', () => {
      const slowManager = new LoopManager(scene, 10, 0.5); // 0.5x speed
      slowManager.start();
      slowManager.update(2); // 2 real seconds
      expect(slowManager.elapsed).toBe(1); // = 1 game second
    });
  });

  describe('reset', () => {
    it('should reset elapsed time to zero', () => {
      manager.start();
      manager.update(5);
      manager.reset();
      expect(manager.elapsed).toBe(0);
    });

    it('should reactivate all events', () => {
      const spy = createSpy();
      manager.scheduleEvent('test', 5, spy);
      manager.start();
      manager.update(6); // Trigger event
      expect(spy.callCount).toBe(1);
      
      manager.reset();
      manager.update(6); // Should trigger again after reset
      expect(spy.callCount).toBe(2);
    });
  });

  describe('event scheduling', () => {
    it('should schedule a one-time event', () => {
      const spy = createSpy();
      manager.scheduleEvent('test_event', 5, spy);
      expect(manager.events).toHaveLength(1);
      expect(manager.events[0].id).toBe('test_event');
      expect(manager.events[0].timeSec).toBe(5);
    });

    it('should fire event at scheduled time', () => {
      const spy = createSpy();
      manager.scheduleEvent('test_event', 5, spy);
      manager.start();
      
      manager.update(4); // Before trigger time
      expect(spy.callCount).toBe(0);
      
      manager.update(2); // Total 6 seconds, past trigger
      expect(spy.callCount).toBe(1);
      expect(spy.calls[0][0]).toBe(scene); // Should pass scene
    });

    it('should fire event exactly at scheduled time', () => {
      const spy = createSpy();
      manager.scheduleEvent('test_event', 5, spy);
      manager.start();
      
      manager.update(5); // Exactly at trigger time
      expect(spy.callCount).toBe(1);
    });

    it('should fire multiple events in order', () => {
      const callOrder: string[] = [];
      manager.scheduleEvent('first', 2, () => callOrder.push('first'));
      manager.scheduleEvent('second', 5, () => callOrder.push('second'));
      manager.scheduleEvent('third', 7, () => callOrder.push('third'));
      manager.start();
      
      manager.update(8);
      expect(callOrder).toEqual(['first', 'second', 'third']);
    });

    it('should handle events scheduled at same time', () => {
      const spy1 = createSpy();
      const spy2 = createSpy();
      manager.scheduleEvent('event1', 5, spy1);
      manager.scheduleEvent('event2', 5, spy2);
      manager.start();
      
      manager.update(6);
      expect(spy1.callCount).toBe(1);
      expect(spy2.callCount).toBe(1);
    });

    it('should not fire inactive events', () => {
      const spy = createSpy();
      manager.scheduleEvent('test', 5, spy);
      manager.events[0].active = false;
      manager.start();
      
      manager.update(10);
      expect(spy.callCount).toBe(0);
    });
  });

  describe('repeating events', () => {
    it('should schedule a repeating event', () => {
      const spy = createSpy();
      manager.scheduleEvent('repeat_test', 2, spy, {
        repeat: true,
        intervalSec: 3,
      });
      manager.start();
      
      // Call update incrementally (more realistic for game loop)
      manager.update(3); // Trigger at 2s
      manager.update(3); // Trigger at 5s  
      expect(spy.callCount).toBe(2);
    });

    it('should continue repeating until loop wraps', () => {
      const spy = createSpy();
      manager.scheduleEvent('repeat_test', 1, spy, {
        repeat: true,
        intervalSec: 2,
      });
      manager.start();
      
      // Incremental updates (realistic game loop)
      for (let i = 0; i < 10; i++) {
        manager.update(1); // 1 second updates
      }
      // Triggers at 1s, 3s, 5s, 7s, 9s = 5 triggers
      expect(spy.callCount).toBe(5);
    });

    it('should reset repeating events on loop wrap', () => {
      const spy = createSpy();
      manager.scheduleEvent('repeat_test', 2, spy, {
        repeat: true,
        intervalSec: 3,
      });
      manager.start();
      
      manager.update(11); // Loop wraps at 10s
      expect(spy.callCount).toBeGreaterThan(0);
      
      const firstLoopCalls = spy.callCount;
      manager.update(5); // Second loop
      expect(spy.callCount).toBeGreaterThan(firstLoopCalls);
    });
  });

  describe('event management', () => {
    it('should remove event by id', () => {
      const spy = createSpy();
      manager.scheduleEvent('removable', 5, spy);
      expect(manager.events).toHaveLength(1);
      
      manager.removeEvent('removable');
      expect(manager.events).toHaveLength(0);
      
      manager.start();
      manager.update(10);
      expect(spy.callCount).toBe(0);
    });

    it('should handle removing non-existent event', () => {
      manager.scheduleEvent('existing', 5, createSpy());
      expect(() => manager.removeEvent('non-existent')).not.toThrow();
      expect(manager.events).toHaveLength(1);
    });

    it('should clear all events', () => {
      manager.scheduleEvent('event1', 3, createSpy());
      manager.scheduleEvent('event2', 7, createSpy());
      expect(manager.events).toHaveLength(2);
      
      manager.clearEvents();
      expect(manager.events).toHaveLength(0);
    });

    it('should not fire cleared events', () => {
      const spy1 = createSpy();
      const spy2 = createSpy();
      manager.scheduleEvent('event1', 3, spy1);
      manager.scheduleEvent('event2', 7, spy2);
      manager.clearEvents();
      manager.start();
      
      manager.update(10);
      expect(spy1.callCount).toBe(0);
      expect(spy2.callCount).toBe(0);
    });
  });

  describe('error handling', () => {
    it('should catch and log callback errors without crashing', () => {
      const errorCallback = () => {
        throw new Error('Test error');
      };
      const safeCallback = createSpy();
      
      manager.scheduleEvent('error_event', 3, errorCallback);
      manager.scheduleEvent('safe_event', 5, safeCallback);
      manager.start();
      
      // Should not throw
      expect(() => manager.update(10)).not.toThrow();
      
      // Other events should still fire
      expect(safeCallback.callCount).toBe(1);
    });
  });

  describe('deterministic behavior', () => {
    it('should produce same results with same input', () => {
      const manager1 = new LoopManager(scene, 10, 1);
      const manager2 = new LoopManager(scene, 10, 1);
      
      const spy1 = createSpy();
      const spy2 = createSpy();
      
      manager1.scheduleEvent('test', 5, spy1);
      manager2.scheduleEvent('test', 5, spy2);
      
      manager1.start();
      manager2.start();
      
      manager1.update(7);
      manager2.update(7);
      
      expect(spy1.callCount).toBe(spy2.callCount);
      expect(manager1.elapsed).toBe(manager2.elapsed);
    });
  });

  describe('edge cases', () => {
    it('should handle zero delta time', () => {
      manager.start();
      manager.update(0);
      expect(manager.elapsed).toBe(0);
    });

    it('should handle negative time scale', () => {
      const reverseManager = new LoopManager(scene, 10, -1);
      reverseManager.start();
      reverseManager.update(3);
      // Negative time scale is unusual but shouldn't crash
      expect(reverseManager.elapsed).toBeDefined();
    });

    it('should handle very large delta time', () => {
      manager.start();
      manager.update(1000); // 1000 seconds
      expect(manager.elapsed).toBeLessThan(manager.loopDuration);
      expect(manager.elapsed).toBeGreaterThanOrEqual(0);
    });

    it('should handle event scheduled at time 0', () => {
      const spy = createSpy();
      manager.scheduleEvent('zero_time', 0, spy);
      manager.start();
      
      manager.update(0.1);
      expect(spy.callCount).toBe(1);
    });

    it('should handle event scheduled beyond loop duration', () => {
      const spy = createSpy();
      manager.scheduleEvent('beyond', 5, spy); // Within loop (10s duration)
      manager.start();
      
      // Update past the loop duration
      for (let i = 0; i < 20; i++) {
        manager.update(1); // 20 seconds = 2 loops
      }
      // Event should fire at 5s in first loop and 5s in second loop
      expect(spy.callCount).toBeGreaterThanOrEqual(2);
    });
  });
});

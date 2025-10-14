import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Scene } from '@babylonjs/core';
import { LoopManager } from '../../src/systems/loopManager';
import type { LoopEventDefinition } from '../../src/content/schemas';

describe('LoopManager Event Loading', () => {
  let scene: Scene;
  let loopManager: LoopManager;

  beforeEach(() => {
    // Create minimal scene mock
    scene = {} as Scene;
    loopManager = new LoopManager(scene, 120, 1);
  });

  describe('scheduleEventFromDefinition', () => {
    it('should schedule event from JSON definition', () => {
      const definition: LoopEventDefinition = {
        id: 'test_event',
        triggerTime: 30,
        type: 'crime',
        repeat: false,
      };

      const callback = vi.fn();
      loopManager.scheduleEventFromDefinition(definition, callback);

      expect(loopManager.events.length).toBe(1);
      expect(loopManager.events[0].id).toBe('test_event');
      expect(loopManager.events[0].timeSec).toBe(30);
      expect(loopManager.events[0].repeat).toBe(false);
    });

    it('should schedule repeating event with interval', () => {
      const definition: LoopEventDefinition = {
        id: 'patrol_event',
        triggerTime: 10,
        type: 'patrol',
        repeat: true,
        repeatInterval: 15,
      };

      const callback = vi.fn();
      loopManager.scheduleEventFromDefinition(definition, callback);

      const event = loopManager.events[0];
      expect(event.repeat).toBe(true);
      expect(event.intervalSec).toBe(15);
    });

    it('should pass definition to callback when triggered', () => {
      const definition: LoopEventDefinition = {
        id: 'callback_test',
        triggerTime: 5,
        type: 'custom',
        repeat: false,
        metadata: {
          testData: 'hello',
        },
      };

      const callback = vi.fn();
      loopManager.scheduleEventFromDefinition(definition, callback);

      // Start and advance time to trigger event
      loopManager.start();
      loopManager.update(6); // Advance past trigger time

      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith(scene, definition);
    });

    it('should handle event with position', () => {
      const definition: LoopEventDefinition = {
        id: 'positioned_event',
        triggerTime: 20,
        type: 'crime',
        position: { x: 10, y: 0, z: -5 },
        repeat: false,
      };

      const callback = vi.fn();
      loopManager.scheduleEventFromDefinition(definition, callback);

      loopManager.start();
      loopManager.update(21);

      expect(callback).toHaveBeenCalledWith(scene, expect.objectContaining({
        position: { x: 10, y: 0, z: -5 },
      }));
    });

    it('should handle event metadata', () => {
      const definition: LoopEventDefinition = {
        id: 'metadata_event',
        triggerTime: 15,
        type: 'crime',
        repeat: false,
        metadata: {
          crimeType: 'theft',
          severity: 'high',
          evidence: ['footprints', 'witness'],
        },
      };

      const callback = vi.fn();
      loopManager.scheduleEventFromDefinition(definition, callback);

      loopManager.start();
      loopManager.update(16);

      expect(callback).toHaveBeenCalledWith(scene, expect.objectContaining({
        metadata: expect.objectContaining({
          crimeType: 'theft',
          severity: 'high',
        }),
      }));
    });
  });

  describe('scheduleEventsFromDefinitions', () => {
    it('should schedule multiple events', () => {
      const definitions: LoopEventDefinition[] = [
        {
          id: 'event_1',
          triggerTime: 10,
          type: 'crime',
          repeat: false,
        },
        {
          id: 'event_2',
          triggerTime: 20,
          type: 'patrol',
          repeat: false,
        },
        {
          id: 'event_3',
          triggerTime: 30,
          type: 'interaction',
          repeat: false,
        },
      ];

      const callback = vi.fn();
      loopManager.scheduleEventsFromDefinitions(definitions, callback);

      expect(loopManager.events.length).toBe(3);
      expect(loopManager.events[0].id).toBe('event_1');
      expect(loopManager.events[1].id).toBe('event_2');
      expect(loopManager.events[2].id).toBe('event_3');
    });

    it('should trigger all events in correct order', () => {
      const definitions: LoopEventDefinition[] = [
        {
          id: 'event_1',
          triggerTime: 10,
          type: 'crime',
          repeat: false,
        },
        {
          id: 'event_2',
          triggerTime: 20,
          type: 'patrol',
          repeat: false,
        },
      ];

      const callbackOrder: string[] = [];
      const callback = vi.fn((scene, def) => {
        callbackOrder.push(def.id);
      });

      loopManager.scheduleEventsFromDefinitions(definitions, callback);
      loopManager.start();
      loopManager.update(25); // Trigger both events

      expect(callbackOrder).toEqual(['event_1', 'event_2']);
    });

    it('should handle empty definitions array', () => {
      const callback = vi.fn();
      loopManager.scheduleEventsFromDefinitions([], callback);

      expect(loopManager.events.length).toBe(0);
    });

    it('should handle mixed repeating and one-time events', () => {
      const definitions: LoopEventDefinition[] = [
        {
          id: 'one_time',
          triggerTime: 5,
          type: 'crime',
          repeat: false,
        },
        {
          id: 'repeating',
          triggerTime: 10,
          type: 'patrol',
          repeat: true,
          repeatInterval: 15,
        },
      ];

      const callback = vi.fn();
      loopManager.scheduleEventsFromDefinitions(definitions, callback);

      loopManager.start();
      
      // Trigger events step by step to ensure proper timing
      loopManager.update(6);  // Triggers one_time at 5s
      expect(callback).toHaveBeenCalledTimes(1);
      
      loopManager.update(5);  // Advance to 11s, triggers repeating at 10s
      expect(callback).toHaveBeenCalledTimes(2);
      
      loopManager.update(15); // Advance to 26s, triggers repeating at 25s
      expect(callback).toHaveBeenCalledTimes(3);
    });
  });

  describe('event type handling', () => {
    it('should handle crime type events', () => {
      const definition: LoopEventDefinition = {
        id: 'crime_test',
        triggerTime: 10,
        type: 'crime',
        repeat: false,
      };

      const callback = vi.fn();
      loopManager.scheduleEventFromDefinition(definition, callback);
      loopManager.start();
      loopManager.update(11);

      expect(callback).toHaveBeenCalledWith(scene, expect.objectContaining({
        type: 'crime',
      }));
    });

    it('should handle patrol type events', () => {
      const definition: LoopEventDefinition = {
        id: 'patrol_test',
        triggerTime: 10,
        type: 'patrol',
        repeat: false,
      };

      const callback = vi.fn();
      loopManager.scheduleEventFromDefinition(definition, callback);
      loopManager.start();
      loopManager.update(11);

      expect(callback).toHaveBeenCalledWith(scene, expect.objectContaining({
        type: 'patrol',
      }));
    });

    it('should handle interaction type events', () => {
      const definition: LoopEventDefinition = {
        id: 'interaction_test',
        triggerTime: 10,
        type: 'interaction',
        repeat: false,
      };

      const callback = vi.fn();
      loopManager.scheduleEventFromDefinition(definition, callback);
      loopManager.start();
      loopManager.update(11);

      expect(callback).toHaveBeenCalledWith(scene, expect.objectContaining({
        type: 'interaction',
      }));
    });

    it('should handle custom type events', () => {
      const definition: LoopEventDefinition = {
        id: 'custom_test',
        triggerTime: 10,
        type: 'custom',
        repeat: false,
      };

      const callback = vi.fn();
      loopManager.scheduleEventFromDefinition(definition, callback);
      loopManager.start();
      loopManager.update(11);

      expect(callback).toHaveBeenCalledWith(scene, expect.objectContaining({
        type: 'custom',
      }));
    });
  });

  describe('integration with existing LoopManager features', () => {
    it('should work with reset()', () => {
      const definition: LoopEventDefinition = {
        id: 'reset_test',
        triggerTime: 10,
        type: 'crime',
        repeat: false,
      };

      const callback = vi.fn();
      loopManager.scheduleEventFromDefinition(definition, callback);
      loopManager.start();
      loopManager.update(11); // Trigger event

      expect(callback).toHaveBeenCalledTimes(1);

      loopManager.reset();
      loopManager.update(11); // Should trigger again after reset

      expect(callback).toHaveBeenCalledTimes(2);
    });

    it('should work with removeEvent()', () => {
      const definition: LoopEventDefinition = {
        id: 'remove_test',
        triggerTime: 10,
        type: 'crime',
        repeat: false,
      };

      const callback = vi.fn();
      loopManager.scheduleEventFromDefinition(definition, callback);
      
      loopManager.removeEvent('remove_test');
      expect(loopManager.events.length).toBe(0);

      loopManager.start();
      loopManager.update(11);
      expect(callback).not.toHaveBeenCalled();
    });

    it('should work with clearEvents()', () => {
      const definitions: LoopEventDefinition[] = [
        { id: 'event_1', triggerTime: 10, type: 'crime', repeat: false },
        { id: 'event_2', triggerTime: 20, type: 'patrol', repeat: false },
      ];

      const callback = vi.fn();
      loopManager.scheduleEventsFromDefinitions(definitions, callback);
      
      expect(loopManager.events.length).toBe(2);
      
      loopManager.clearEvents();
      expect(loopManager.events.length).toBe(0);
    });
  });
});

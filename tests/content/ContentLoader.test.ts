import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ContentLoader } from '../../src/content/ContentLoader';
import type { NpcDefinition, LoopEventDefinition, InvestigationDefinition, ContentPack } from '../../src/content/schemas';

// Mock fetch globally
global.fetch = vi.fn();

describe('ContentLoader', () => {
  let loader: ContentLoader;

  beforeEach(() => {
    loader = new ContentLoader('/test-data');
    vi.clearAllMocks();
  });

  describe('loadNpc', () => {
    it('should successfully load valid NPC data', async () => {
      const mockNpc: NpcDefinition = {
        id: 'npc_test',
        name: 'Test NPC',
        color: [1, 0, 0],
        speed: 2.0,
        schedule: {
          '0': { x: 0, y: 0, z: 0 },
          '30': { x: 10, y: 0, z: 5 },
        },
      };

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => mockNpc,
      } as Response);

      const result = await loader.loadNpc('npcs/test.json');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.id).toBe('npc_test');
        expect(result.data.name).toBe('Test NPC');
      }
      expect(global.fetch).toHaveBeenCalledWith('/test-data/npcs/test.json');
    });

    it('should handle HTTP errors', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      } as Response);

      const result = await loader.loadNpc('npcs/missing.json');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain('404');
      }
    });

    it('should handle validation errors', async () => {
      const invalidNpc = {
        id: 'npc_invalid',
        // Missing required fields
      };

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => invalidNpc,
      } as Response);

      const result = await loader.loadNpc('npcs/invalid.json');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('Validation failed');
        expect(result.details).toBeDefined();
      }
    });

    it('should handle network errors', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
        new Error('Network error')
      );

      const result = await loader.loadNpc('npcs/error.json');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('Network error');
      }
    });
  });

  describe('loadEvent', () => {
    it('should successfully load valid event data', async () => {
      const mockEvent: LoopEventDefinition = {
        id: 'event_test',
        triggerTime: 12.0,
        type: 'crime',
        position: { x: 10, y: 0, z: 5 },
        repeat: false,
      };

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => mockEvent,
      } as Response);

      const result = await loader.loadEvent('events/test.json');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.id).toBe('event_test');
        expect(result.data.type).toBe('crime');
      }
    });

    it('should apply default values', async () => {
      const mockEvent = {
        id: 'event_minimal',
        triggerTime: 10.0,
        type: 'patrol',
      };

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => mockEvent,
      } as Response);

      const result = await loader.loadEvent('events/minimal.json');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.repeat).toBe(false); // Default value
      }
    });
  });

  describe('loadInvestigation', () => {
    it('should successfully load valid investigation data', async () => {
      const mockInvestigation: InvestigationDefinition = {
        id: 'inv_test',
        title: 'Test Case',
        description: 'A test investigation',
        clues: [
          {
            id: 'clue_1',
            position: { x: 0, y: 0, z: 0 },
            description: 'A clue',
          },
        ],
        suspects: ['npc_suspect_1', 'npc_suspect_2'],
        solution: {
          culprit: 'npc_suspect_1',
          requiredClues: ['clue_1'],
        },
      };

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => mockInvestigation,
      } as Response);

      const result = await loader.loadInvestigation('investigations/test.json');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.id).toBe('inv_test');
        expect(result.data.clues.length).toBe(1);
      }
    });
  });

  describe('loadContentPack', () => {
    it('should successfully load valid content pack', async () => {
      const mockPack: ContentPack = {
        id: 'pack_test',
        name: 'Test Pack',
        version: '1.0.0',
        npcs: [
          {
            id: 'npc_1',
            name: 'NPC One',
            color: [1, 1, 1],
            speed: 1.0,
            schedule: {
              '0': { x: 0, y: 0, z: 0 },
            },
          },
        ],
        events: [
          {
            id: 'event_1',
            triggerTime: 5.0,
            type: 'patrol',
            repeat: false,
          },
        ],
        investigations: [],
      };

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => mockPack,
      } as Response);

      const result = await loader.loadContentPack('packs/test.json');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.id).toBe('pack_test');
        expect(result.data.npcs.length).toBe(1);
        expect(result.data.events.length).toBe(1);
      }
    });

    it('should validate all nested content', async () => {
      const invalidPack = {
        id: 'pack_invalid',
        name: 'Invalid Pack',
        version: '1.0.0',
        npcs: [
          {
            id: 'npc_invalid',
            // Missing required fields
          },
        ],
        events: [],
        investigations: [],
      };

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => invalidPack,
      } as Response);

      const result = await loader.loadContentPack('packs/invalid.json');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.details).toBeDefined();
      }
    });
  });

  describe('batch loading', () => {
    it('should load multiple NPCs', async () => {
      const mockNpc1: NpcDefinition = {
        id: 'npc_1',
        name: 'NPC 1',
        color: [1, 0, 0],
        speed: 1.0,
        schedule: {
          '0': { x: 0, y: 0, z: 0 },
        },
      };

      const mockNpc2: NpcDefinition = {
        id: 'npc_2',
        name: 'NPC 2',
        color: [0, 1, 0],
        speed: 2.0,
        schedule: {
          '0': { x: 0, y: 0, z: 0 },
        },
      };

      (global.fetch as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockNpc1,
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockNpc2,
        } as Response);

      const results = await loader.loadNpcs(['npcs/1.json', 'npcs/2.json']);

      expect(results.length).toBe(2);
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(true);
    });

    it('should handle mixed success/failure in batch', async () => {
      const mockNpc: NpcDefinition = {
        id: 'npc_valid',
        name: 'Valid NPC',
        color: [1, 0, 0],
        speed: 1.0,
        schedule: {
          '0': { x: 0, y: 0, z: 0 },
        },
      };

      (global.fetch as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockNpc,
        } as Response)
        .mockResolvedValueOnce({
          ok: false,
          status: 404,
          statusText: 'Not Found',
        } as Response);

      const results = await loader.loadNpcs(['npcs/valid.json', 'npcs/missing.json']);

      expect(results.length).toBe(2);
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(false);
    });
  });

  describe('convenience functions', () => {
    it('should use correct base URL', () => {
      const customLoader = new ContentLoader('/custom-path');
      expect(customLoader).toBeDefined();
    });

    it('should strip trailing slash from base URL', async () => {
      const loaderWithSlash = new ContentLoader('/data/');
      
      const mockNpc: NpcDefinition = {
        id: 'npc_test',
        name: 'Test',
        color: [1, 0, 0],
        speed: 1.0,
        schedule: {
          '0': { x: 0, y: 0, z: 0 },
        },
      };

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => mockNpc,
      } as Response);

      await loaderWithSlash.loadNpc('test.json');

      // Should not have double slash
      expect(global.fetch).toHaveBeenCalledWith('/data/test.json');
    });
  });
});

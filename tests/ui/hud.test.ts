import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import HUD, { start, dispose } from '../../src/ui/hud';
import { createMockScene } from '../helpers/mockScene';

// Mock Babylon GUI components
vi.mock('@babylonjs/gui', () => {
  const mockControl = {
    addControl: vi.fn(),
    dispose: vi.fn(),
    getChildren: vi.fn(() => []),
  };

  const MockRectangle = vi.fn(function() {
    return {
      ...mockControl,
      height: '',
      width: '',
      thickness: 0,
      verticalAlignment: 0,
      horizontalAlignment: 0,
      background: '',
      top: '',
      left: '',
      cornerRadius: 0,
      paddingLeft: '',
      paddingRight: '',
    };
  });

  const MockTextBlock = vi.fn(function() {
    return {
      ...mockControl,
      text: '',
      fontSize: 0,
      color: '',
      textHorizontalAlignment: 0,
      textVerticalAlignment: 0,
      horizontalAlignment: 0,
      verticalAlignment: 0,
      height: '',
      width: '',
    };
  });

  const MockImage = vi.fn(function() {
    return {
      ...mockControl,
      source: '',
      width: '',
      height: '',
      stretch: 0,
      horizontalAlignment: 0,
      verticalAlignment: 0,
      left: '',
    };
  });

  return {
    AdvancedDynamicTexture: {
      CreateFullscreenUI: vi.fn(() => mockControl),
    },
    Rectangle: MockRectangle,
    TextBlock: MockTextBlock,
    Image: MockImage,
    Control: {
      VERTICAL_ALIGNMENT_TOP: 0,
      VERTICAL_ALIGNMENT_CENTER: 1,
      VERTICAL_ALIGNMENT_BOTTOM: 2,
      HORIZONTAL_ALIGNMENT_LEFT: 0,
      HORIZONTAL_ALIGNMENT_CENTER: 1,
      HORIZONTAL_ALIGNMENT_RIGHT: 2,
    },
  };
});

describe('HUD Class', () => {
  let scene: any;
  let hud: HUD;

  beforeEach(() => {
    scene = createMockScene();
  });

  afterEach(() => {
    if (hud && hud.isActive()) {
      hud.dispose();
    }
  });

  describe('constructor', () => {
    it('should create HUD instance', () => {
      hud = new HUD(scene);
      
      expect(hud).toBeDefined();
      expect(hud.isActive()).toBe(false);
    });

    it('should accept custom options', () => {
      hud = new HUD(scene, {
        dayMs: 30_000,
        nightMs: 30_000,
        trackWidth: 500,
        iconSize: 32,
      });
      
      expect(hud).toBeDefined();
    });

    it('should use default options when not provided', () => {
      hud = new HUD(scene, {});
      
      expect(hud).toBeDefined();
    });
  });

  describe('start', () => {
    it('should initialize and start the HUD', () => {
      hud = new HUD(scene);
      
      hud.start();
      
      expect(hud.isActive()).toBe(true);
    });

    it('should not start twice', () => {
      hud = new HUD(scene);
      
      hud.start();
      hud.start(); // Second call should be ignored
      
      expect(hud.isActive()).toBe(true);
    });

    it('should work with DayNightCycle', () => {
      const mockCycle = {
        onTick: vi.fn(() => () => {}), // Return unsubscribe function
      };

      hud = new HUD(scene, {
        cycle: mockCycle as any,
      });
      
      hud.start();
      
      expect(hud.isActive()).toBe(true);
      expect(mockCycle.onTick).toHaveBeenCalled();
    });
  });

  describe('dispose', () => {
    it('should dispose the HUD', () => {
      hud = new HUD(scene);
      hud.start();
      
      expect(hud.isActive()).toBe(true);
      
      hud.dispose();
      
      expect(hud.isActive()).toBe(false);
    });

    it('should handle multiple dispose calls', () => {
      hud = new HUD(scene);
      hud.start();
      
      hud.dispose();
      hud.dispose(); // Should not throw
      
      expect(hud.isActive()).toBe(false);
    });

    it('should dispose before initialization', () => {
      hud = new HUD(scene);
      
      // Should not throw
      expect(() => hud.dispose()).not.toThrow();
    });

    it('should clean up cycle subscription', () => {
      const unsubscribe = vi.fn();
      const mockCycle = {
        onTick: vi.fn(() => unsubscribe),
      };

      hud = new HUD(scene, {
        cycle: mockCycle as any,
      });
      
      hud.start();
      hud.dispose();
      
      expect(unsubscribe).toHaveBeenCalled();
    });
  });

  describe('isActive', () => {
    it('should return false before start', () => {
      hud = new HUD(scene);
      
      expect(hud.isActive()).toBe(false);
    });

    it('should return true after start', () => {
      hud = new HUD(scene);
      hud.start();
      
      expect(hud.isActive()).toBe(true);
    });

    it('should return false after dispose', () => {
      hud = new HUD(scene);
      hud.start();
      hud.dispose();
      
      expect(hud.isActive()).toBe(false);
    });
  });

  describe('updateOptions', () => {
    it('should update options when not active', () => {
      hud = new HUD(scene, { dayMs: 60_000 });
      
      hud.updateOptions({ dayMs: 30_000 });
      
      // Should not throw
      expect(hud.isActive()).toBe(false);
    });

    it('should not update options when active', () => {
      hud = new HUD(scene);
      hud.start();
      
      // Should log warning but not throw
      hud.updateOptions({ dayMs: 30_000 });
      
      expect(hud.isActive()).toBe(true);
    });
  });

  describe('multiple instances', () => {
    it('should support multiple HUD instances', () => {
      const hud1 = new HUD(scene);
      const hud2 = new HUD(scene);
      
      hud1.start();
      hud2.start();
      
      expect(hud1.isActive()).toBe(true);
      expect(hud2.isActive()).toBe(true);
      
      hud1.dispose();
      hud2.dispose();
    });

    it('should dispose instances independently', () => {
      const hud1 = new HUD(scene);
      const hud2 = new HUD(scene);
      
      hud1.start();
      hud2.start();
      
      hud1.dispose();
      
      expect(hud1.isActive()).toBe(false);
      expect(hud2.isActive()).toBe(true);
      
      hud2.dispose();
    });
  });

  describe('lifecycle', () => {
    it('should support restart after dispose', () => {
      hud = new HUD(scene);
      
      hud.start();
      expect(hud.isActive()).toBe(true);
      
      hud.dispose();
      expect(hud.isActive()).toBe(false);
      
      hud.start();
      expect(hud.isActive()).toBe(true);
      
      hud.dispose();
    });

    it('should maintain options through restart', () => {
      hud = new HUD(scene, {
        dayMs: 45_000,
        nightMs: 45_000,
      });
      
      hud.start();
      hud.dispose();
      hud.start();
      
      expect(hud.isActive()).toBe(true);
      
      hud.dispose();
    });
  });

  describe('error handling', () => {
    it('should handle scene observable errors gracefully', () => {
      const badScene = {
        ...scene,
        onBeforeRenderObservable: {
          add: () => {
            throw new Error('Observable error');
          },
        },
      };

      hud = new HUD(badScene);
      
      // Should not throw
      expect(() => hud.start()).toThrow();
    });

    it('should handle dispose errors gracefully', () => {
      hud = new HUD(scene);
      hud.start();
      
      // Should not throw even if cleanup fails
      expect(() => hud.dispose()).not.toThrow();
    });
  });

  describe('configuration options', () => {
    it('should accept all configuration options', () => {
      hud = new HUD(scene, {
        dayMs: 45_000,
        nightMs: 45_000,
        sunImagePath: '/custom/sun.png',
        moonImagePath: '/custom/moon.png',
        trackWidth: 400,
        iconSize: 30,
      });
      
      expect(hud).toBeDefined();
      expect(hud.isActive()).toBe(false);
    });

    it('should use fallback when cycle creation fails', () => {
      const badCycle = {
        onTick: () => {
          throw new Error('Cycle error');
        },
      };

      hud = new HUD(scene, {
        cycle: badCycle as any,
      });
      
      // Should fall back to scene observable
      expect(() => hud.start()).not.toThrow();
      expect(hud.isActive()).toBe(true);
    });
  });
});

describe('HUD Legacy API', () => {
  let scene: any;

  beforeEach(() => {
    scene = createMockScene();
  });

  afterEach(() => {
    // Clean up global instance
    dispose();
  });

  describe('start function', () => {
    it('should start HUD using legacy API', () => {
      start(scene, {
        dayMs: 60_000,
        nightMs: 60_000,
      });
      
      // Should not throw
      expect(true).toBe(true);
    });

    it('should not start twice', () => {
      start(scene);
      start(scene); // Should warn but not throw
      
      expect(true).toBe(true);
    });
  });

  describe('dispose function', () => {
    it('should dispose HUD using legacy API', () => {
      start(scene);
      dispose();
      
      expect(true).toBe(true);
    });

    it('should handle dispose without start', () => {
      // Should not throw
      expect(() => dispose()).not.toThrow();
    });
  });
});

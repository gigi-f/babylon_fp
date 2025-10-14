/**
 * Mock Scene for testing
 * Provides a lightweight Scene mock without requiring full Babylon.js initialization
 */

export interface MockScene {
  meshes: any[];
  onBeforeRenderObservable: {
    add: (callback: () => void) => { remove: () => void };
    remove: (observer: any) => void;
  };
  getEngine: () => MockEngine;
  dispose: () => void;
}

export interface MockEngine {
  getDeltaTime: () => number;
}

export function createMockScene(): MockScene {
  const observers: any[] = [];
  
  return {
    meshes: [],
    onBeforeRenderObservable: {
      add: (callback: () => void) => {
        const observer = { callback };
        observers.push(observer);
        return {
          remove: () => {
            const index = observers.indexOf(observer);
            if (index > -1) observers.splice(index, 1);
          },
        };
      },
      remove: (observer: any) => {
        const index = observers.indexOf(observer);
        if (index > -1) observers.splice(index, 1);
      },
    },
    getEngine: () => createMockEngine(),
    dispose: () => {
      observers.length = 0;
    },
  };
}

export function createMockEngine(): MockEngine {
  return {
    getDeltaTime: () => 16.67, // ~60 FPS
  };
}

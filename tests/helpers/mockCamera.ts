/**
 * Mock Camera for testing
 * Provides a lightweight Camera mock for controller tests
 */

export interface MockCamera {
  position: { x: number; y: number; z: number };
  rotation: { x: number; y: number; z: number };
  getScene: () => any;
  getDirection: (axis: any) => { x: number; y: number; z: number };
}

export function createMockCamera(): MockCamera {
  return {
    position: { x: 0, y: 1.7, z: -5 },
    rotation: { x: 0, y: 0, z: 0 },
    getScene: () => ({
      getEngine: () => ({
        getDeltaTime: () => 16.67,
      }),
    }),
    getDirection: (axis: any) => {
      // Simple mock - return forward or right based on rotation
      return { x: 0, y: 0, z: 1 };
    },
  };
}

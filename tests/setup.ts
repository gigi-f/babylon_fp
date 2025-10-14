/**
 * Vitest setup file
 * Runs before all tests to configure the testing environment
 */

// Mock HTMLCanvasElement if needed for Babylon.js tests
if (typeof HTMLCanvasElement === 'undefined') {
  global.HTMLCanvasElement = class HTMLCanvasElement {} as any;
}

// Mock WebGL context if needed
if (typeof WebGLRenderingContext === 'undefined') {
  global.WebGLRenderingContext = class WebGLRenderingContext {} as any;
}

// Suppress Babylon.js console warnings in tests
const originalWarn = console.warn;
console.warn = (...args: any[]) => {
  const message = args[0]?.toString() || '';
  // Filter out known Babylon.js warnings that are noise in tests
  if (message.includes('BabylonJS') || message.includes('WebGL')) {
    return;
  }
  originalWarn.apply(console, args);
};

/**
 * Test utilities and helper functions
 */

/**
 * Wait for a certain number of milliseconds
 * Useful for testing async operations
 */
export function wait(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Run a function and measure its execution time
 */
export function measureTime(fn: () => void): number {
  const start = performance.now();
  fn();
  return performance.now() - start;
}

/**
 * Create a spy function that tracks calls
 */
export function createSpy<T extends (...args: any[]) => any>(): T & {
  calls: any[][];
  callCount: number;
  reset: () => void;
} {
  const calls: any[][] = [];
  
  const spy = ((...args: any[]) => {
    calls.push(args);
  }) as any;
  
  Object.defineProperty(spy, 'calls', {
    get: () => calls,
  });
  
  Object.defineProperty(spy, 'callCount', {
    get: () => calls.length,
  });
  
  spy.reset = () => {
    calls.length = 0;
  };
  
  return spy;
}

/**
 * Assert that a value is close to expected (for floating point comparison)
 */
export function assertClose(actual: number, expected: number, tolerance = 0.001): void {
  const diff = Math.abs(actual - expected);
  if (diff > tolerance) {
    throw new Error(`Expected ${actual} to be close to ${expected} (tolerance: ${tolerance}), but difference was ${diff}`);
  }
}

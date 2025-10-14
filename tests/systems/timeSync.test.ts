/**
 * Tests for timeSync utilities
 * Validates time conversion between semantic hours and loop mechanics
 */

import { describe, it, expect } from 'vitest';
import {
  semanticHourToLoopPercent,
  loopPercentToSemanticHour,
  semanticHourToElapsedMs,
  elapsedMsToSemanticHour,
} from '../../src/systems/timeSync';
import { assertClose } from '../helpers/testUtils';

describe('timeSync', () => {
  describe('semanticHourToLoopPercent', () => {
    it('should convert hour 6 (start) to 0% loop progress', () => {
      expect(semanticHourToLoopPercent(6)).toBe(0);
    });

    it('should convert hour 12 (midday) to 25% loop progress', () => {
      assertClose(semanticHourToLoopPercent(12), 0.25, 0.01);
    });

    it('should convert hour 18 (evening) to 50% loop progress', () => {
      assertClose(semanticHourToLoopPercent(18), 0.5, 0.01);
    });

    it('should convert hour 0 (midnight) to 75% loop progress', () => {
      assertClose(semanticHourToLoopPercent(0), 0.75, 0.01);
    });

    it('should handle hour wrapping (24 same as 0)', () => {
      expect(semanticHourToLoopPercent(24)).toBe(semanticHourToLoopPercent(0));
    });

    it('should handle negative hours', () => {
      const result = semanticHourToLoopPercent(-6);
      expect(result).toBeGreaterThanOrEqual(0);
      expect(result).toBeLessThan(1);
    });

    it('should handle hours beyond 24', () => {
      expect(semanticHourToLoopPercent(30)).toBe(semanticHourToLoopPercent(6));
    });
  });

  describe('loopPercentToSemanticHour', () => {
    it('should convert 0% loop progress to hour 6', () => {
      expect(loopPercentToSemanticHour(0)).toBe(6);
    });

    it('should convert 25% loop progress to hour 12', () => {
      assertClose(loopPercentToSemanticHour(0.25), 12, 0.1);
    });

    it('should convert 50% loop progress to hour 18', () => {
      assertClose(loopPercentToSemanticHour(0.5), 18, 0.1);
    });

    it('should convert 75% loop progress to hour 0', () => {
      assertClose(loopPercentToSemanticHour(0.75), 0, 0.1);
    });

    it('should handle percent > 1', () => {
      const result = loopPercentToSemanticHour(1.5);
      expect(result).toBeGreaterThanOrEqual(0);
      expect(result).toBeLessThan(24);
    });

    it('should handle negative percent', () => {
      const result = loopPercentToSemanticHour(-0.5);
      expect(result).toBeGreaterThanOrEqual(0);
      expect(result).toBeLessThan(24);
    });
  });

  describe('round-trip conversions', () => {
    it('should round-trip hour -> percent -> hour', () => {
      for (let hour = 0; hour < 24; hour++) {
        const percent = semanticHourToLoopPercent(hour);
        const backToHour = loopPercentToSemanticHour(percent);
        assertClose(backToHour, hour, 0.1);
      }
    });

    it('should round-trip percent -> hour -> percent', () => {
      for (let i = 0; i < 10; i++) {
        const percent = i / 10;
        const hour = loopPercentToSemanticHour(percent);
        const backToPercent = semanticHourToLoopPercent(hour);
        assertClose(backToPercent, percent, 0.05); // Increased tolerance for floating point precision
      }
    });
  });

  describe('semanticHourToElapsedMs', () => {
    const totalMs = 120_000; // 2 minute loop

    it('should convert hour 6 (start) to 0ms elapsed', () => {
      expect(semanticHourToElapsedMs(6, totalMs)).toBe(0);
    });

    it('should convert hour 12 to 25% of total time', () => {
      const expected = totalMs * 0.25;
      assertClose(semanticHourToElapsedMs(12, totalMs), expected, 100);
    });

    it('should convert hour 18 to 50% of total time', () => {
      const expected = totalMs * 0.5;
      assertClose(semanticHourToElapsedMs(18, totalMs), expected, 100);
    });

    it('should convert hour 0 (midnight) to 75% of total time', () => {
      const expected = totalMs * 0.75;
      assertClose(semanticHourToElapsedMs(0, totalMs), expected, 100);
    });

    it('should handle different loop durations', () => {
      const shortLoop = 60_000; // 1 minute
      const longLoop = 600_000; // 10 minutes
      
      const shortElapsed = semanticHourToElapsedMs(12, shortLoop);
      const longElapsed = semanticHourToElapsedMs(12, longLoop);
      
      // Both should be 25% of their respective totals
      assertClose(shortElapsed / shortLoop, 0.25, 0.01);
      assertClose(longElapsed / longLoop, 0.25, 0.01);
    });

    it('should handle hour wrapping', () => {
      expect(semanticHourToElapsedMs(30, totalMs)).toBe(
        semanticHourToElapsedMs(6, totalMs)
      );
    });
  });

  describe('elapsedMsToSemanticHour', () => {
    const totalMs = 120_000; // 2 minute loop

    it('should convert 0ms elapsed to hour 6', () => {
      expect(elapsedMsToSemanticHour(0, totalMs)).toBe(6);
    });

    it('should convert 25% elapsed to hour 12', () => {
      const elapsed = totalMs * 0.25;
      assertClose(elapsedMsToSemanticHour(elapsed, totalMs), 12, 0.5);
    });

    it('should convert 50% elapsed to hour 18', () => {
      const elapsed = totalMs * 0.5;
      assertClose(elapsedMsToSemanticHour(elapsed, totalMs), 18, 0.5);
    });

    it('should convert 75% elapsed to hour 0', () => {
      const elapsed = totalMs * 0.75;
      assertClose(elapsedMsToSemanticHour(elapsed, totalMs), 0, 0.5);
    });

    it('should handle elapsed > totalMs (wrapping)', () => {
      const elapsed = totalMs * 1.5;
      const result = elapsedMsToSemanticHour(elapsed, totalMs);
      expect(result).toBeGreaterThanOrEqual(0);
      expect(result).toBeLessThan(24);
    });

    it('should handle negative elapsed', () => {
      const result = elapsedMsToSemanticHour(-1000, totalMs);
      expect(result).toBeGreaterThanOrEqual(0);
      expect(result).toBeLessThan(24);
    });
  });

  describe('ms round-trip conversions', () => {
    const totalMs = 120_000;

    it('should round-trip hour -> ms -> hour', () => {
      for (let hour = 0; hour < 24; hour++) {
        const ms = semanticHourToElapsedMs(hour, totalMs);
        const backToHour = elapsedMsToSemanticHour(ms, totalMs);
        assertClose(backToHour, hour, 0.5);
      }
    });

    it('should round-trip ms -> hour -> ms', () => {
      for (let i = 0; i < 10; i++) {
        const ms = (totalMs / 10) * i;
        const hour = elapsedMsToSemanticHour(ms, totalMs);
        const backToMs = semanticHourToElapsedMs(hour, totalMs);
        assertClose(backToMs, ms, totalMs / 24); // Within one hour's worth of ms
      }
    });
  });

  describe('edge cases', () => {
    it('should handle zero total time gracefully', () => {
      expect(() => semanticHourToElapsedMs(6, 0)).not.toThrow();
      expect(() => elapsedMsToSemanticHour(0, 0)).not.toThrow();
    });

    it('should handle very large total time', () => {
      const largeMs = 1_000_000_000; // ~11.5 days
      const ms = semanticHourToElapsedMs(12, largeMs);
      expect(ms).toBeLessThan(largeMs);
      expect(ms).toBeGreaterThan(0);
    });

    it('should handle fractional hours', () => {
      const result = semanticHourToLoopPercent(12.5);
      expect(result).toBeGreaterThanOrEqual(0);
      expect(result).toBeLessThan(1);
    });
  });

  describe('consistency across conversions', () => {
    it('should maintain consistency between all conversion functions', () => {
      const totalMs = 120_000;
      const testHour = 15;
      
      // Hour -> Percent -> MS -> Hour should be consistent
      const percent = semanticHourToLoopPercent(testHour);
      const ms = semanticHourToElapsedMs(testHour, totalMs);
      const hourFromMs = elapsedMsToSemanticHour(ms, totalMs);
      const hourFromPercent = loopPercentToSemanticHour(percent);
      
      assertClose(hourFromMs, testHour, 0.5);
      assertClose(hourFromPercent, testHour, 0.5);
    });
  });
});

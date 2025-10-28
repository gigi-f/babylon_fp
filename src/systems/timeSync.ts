// src/systems/timeSync.ts
/**
 * timeSync - mapping between semantic clock hours and loop percent/elapsed
 *
 * Semantic convention: 0..23 hours where 6 == loop start (loopPercent 0).
 */
const HOURS = 24;

export function semanticHourToLoopPercent(hour: number): number {
  const h = ((hour % HOURS) + HOURS) % HOURS;
  return ((h - 6 + HOURS) % HOURS) / HOURS;
}

export function loopPercentToSemanticHour(loopPercent: number): number {
  const raw = ((loopPercent % 1) + 1) % 1;
  return (raw * HOURS + 6) % HOURS;
}

export function semanticHourToElapsedMs(hour: number, totalMs: number): number {
  const msPerHour = totalMs / HOURS;
  const h = ((hour % HOURS) + HOURS) % HOURS;
  const idx = (h - 6 + HOURS) % HOURS;
  return idx * msPerHour;
}

export function elapsedMsToSemanticHour(elapsedMs: number, totalMs: number): number {
  const normalized = ((elapsedMs % totalMs) + totalMs) % totalMs;
  const msPerHour = totalMs / HOURS;
  const idx = Math.floor(normalized / msPerHour);
  return (idx + 6) % HOURS;
}
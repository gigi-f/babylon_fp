import DayNightCycle, { DayNightState } from "./dayNightCycle";
import LoopManager from "./loopManager";
import { semanticHourToElapsedMs } from "./timeSync";

/**
 * HourlyCycle
 *
 * - Breaks the Day/Night loop into 24 equal "hours" (chunks).
 * - Each hour is 1/24 of the entire day+night cycle (percent of loop).
 * - Designed to be used alongside DayNightCycle and LoopManager:
 *   * subscribe to DayNightCycle.onTick(...) and receive hour boundaries/updates
 *   * schedule LoopManager events at specific hours using seconds-for-hour helpers
 */

export const HOURS = 24;
export const PERCENT_PER_HOUR = 1 / HOURS;

export type HourInfo = {
  hourIndex: number; // 0..23
  hourProgress: number; // 0..1 progress inside the hour
  loopPercent: number; // 0..1 progress inside entire loop (day+night)
  elapsedMsIntoHour: number;
  elapsedSecIntoHour: number;
};

/**
 * Convert elapsedInLoop (ms) -> loop percent (0..1)
 */
export function loopPercentFromElapsed(elapsedInLoop: number, totalMs: number): number {
  // normalize to [0,totalMs)
  const raw = elapsedInLoop % totalMs;
  return raw < 0 ? (raw + totalMs) / totalMs : raw / totalMs;
}

/**
 * Compute HourInfo given elapsedInLoop (ms) and total loop length (ms).
 */
export function hourInfoFromElapsed(elapsedInLoop: number, totalMs: number): HourInfo {
  const loopPercent = loopPercentFromElapsed(elapsedInLoop, totalMs);
  const floatHour = loopPercent * HOURS;
  let hourIndex = Math.floor(floatHour) % HOURS;
  if (hourIndex < 0) hourIndex += HOURS;
  const hourProgress = floatHour - Math.floor(floatHour);

  const msPerHour = totalMs / HOURS;
  const elapsedMsInHour = hourProgress * msPerHour;
  const elapsedSecIntoHour = Math.floor(elapsedMsInHour / 1000);

  return {
    hourIndex,
    hourProgress,
    loopPercent,
    elapsedMsIntoHour: elapsedMsInHour,
    elapsedSecIntoHour,
  };
}

/**
 * Milliseconds from loop start for the given semantic hour (0..23).
 *
 * Semantic convention: hour 6 == loop start (loopPercent 0).
 * Delegate to shared timeSync so other systems (NPCs, LoopManager scheduling)
 * use the same mapping.
 */
export function elapsedMsForHour(hourIndex: number, totalMs: number): number {
  return semanticHourToElapsedMs(hourIndex, totalMs);
}

/**
 * Seconds from loop start for the given semantic hour (0..23)
 */
export function secondsForHour(hourIndex: number, totalMs: number): number {
  return Math.floor(elapsedMsForHour(hourIndex, totalMs) / 1000);
}

/**
 * HourlyCycle class
 *
 * - Subscribes to a DayNightCycle instance (via onTick) and computes hour boundaries.
 * - Notifies continuous subscribers on every tick and notifies hour-subscribers
 *   once when a new hour begins.
 * - Helper to schedule events with LoopManager at specific hours.
 *
 * NOTE: Because DayNightCycle keeps its timing internals private, HourlyCycle
 * requires the caller to provide totalMs (dayMs + nightMs) when constructing.
 * This keeps the HourlyCycle module independent and testable.
 */
export class HourlyCycle {
  private cycle: DayNightCycle;
  private totalMs: number;
  private subscribers: Array<(info: HourInfo, state: DayNightState) => void> = [];
  private hourSubscribers: Array<(hourIndex: number, state: DayNightState) => void> = [];
  private currentHour = -1;
  private unsubscribeCycle: (() => void) | null = null;
  // last computed HourInfo from the most recent onTick; used by external systems to bootstrap state
  private lastInfo: HourInfo | null = null;

  constructor(cycle: DayNightCycle, totalMs: number) {
    this.cycle = cycle;
    this.totalMs = totalMs;
    this.unsubscribeCycle = this.cycle.onTick((s) => this._onTick(s));
  }

  dispose() {
    if (this.unsubscribeCycle) {
      this.unsubscribeCycle();
      this.unsubscribeCycle = null;
    }
    this.subscribers = [];
    this.hourSubscribers = [];
  }

  private _onTick(state: DayNightState) {
    const info = hourInfoFromElapsed(state.elapsedInLoop, this.totalMs);
    // store lastInfo so external systems can query current loopPercent immediately
    this.lastInfo = info;
 
    // continuous subscribers receive updates every tick
    for (const sub of this.subscribers.slice()) {
      try {
        sub(info, state);
      } catch {}
    }
 
    // detect hour boundary and notify hour-subscribers once per hour change
    if (info.hourIndex !== this.currentHour) {
      this.currentHour = info.hourIndex;
      for (const sub of this.hourSubscribers.slice()) {
        try {
          sub(info.hourIndex, state);
        } catch {}
      }
    }
  }

  /**
   * Subscribe to continuous hour/tick updates.
   * Returns an unsubscribe function.
   */
  onTick(cb: (info: HourInfo, state: DayNightState) => void) {
    this.subscribers.push(cb);
    return () => {
      const i = this.subscribers.indexOf(cb);
      if (i >= 0) this.subscribers.splice(i, 1);
    };
  }

  /**
   * Subscribe to hour-start events (fires once when the hour index changes).
   * Returns an unsubscribe function.
   */
  onHour(cb: (hourIndex: number, state: DayNightState) => void) {
    this.hourSubscribers.push(cb);
    return () => {
      const i = this.hourSubscribers.indexOf(cb);
      if (i >= 0) this.hourSubscribers.splice(i, 1);
    };
  }
 
  /**
   * Return the last computed HourInfo (or null if none yet).
   * External systems can call this immediately after constructing HourlyCycle
   * to bootstrap their state to the current loop position.
   */
  getLastInfo(): HourInfo | null {
    return this.lastInfo;
  }

  /**
   * Schedule an event on a LoopManager at the given hour index.
   *
   * - hourIndex: 0..23
   * - callback: scene callback used by LoopManager
   * - opts.repeat: if true, the event will repeat
   * - opts.intervalHours: number of hours between repeats (if repeat true)
   */
  scheduleAtHour(
    loopManager: LoopManager,
    hourIndex: number,
    callback: (scene: any) => void,
    opts?: { repeat?: boolean; intervalHours?: number }
  ) {
    const timeSec = secondsForHour(hourIndex, this.totalMs);
    if (opts?.repeat && typeof opts.intervalHours === "number") {
      const intervalSec = secondsForHour(opts.intervalHours, this.totalMs);
      loopManager.scheduleEvent(`hourly_${hourIndex}_${Date.now()}`, timeSec, callback, {
        repeat: true,
        intervalSec,
      });
    } else {
      loopManager.scheduleEvent(`hourly_${hourIndex}_${Date.now()}`, timeSec, callback);
    }
  }
}

export default HourlyCycle;
import { Scene, DirectionalLight, Vector3, Color3, Nullable } from "@babylonjs/core";

/**
 * Exposed state each tick
 */
export type DayNightState = {
  now: number;
  elapsedInLoop: number;
  isDay: boolean;
  dayProgress: number; // 0..1 during day (meaningful only when isDay true)
  nightProgress: number; // 0..1 during night (meaningful only when isDay false)
  displaySec: number; // seconds into current day/night period
};

/**
 * Options for the cycle and lighting.
 */
export type DayNightOptions = {
  dayMs?: number;
  nightMs?: number;
  sunIntensity?: number;
  moonIntensity?: number;
  sunColor?: Color3;
  moonColor?: Color3;
};

/**
 * DayNightCycle
 *
 * - Manages a day/night loop (timing) and updates two DirectionalLights (sun & moon).
 * - Provides a simple onTick(callback) subscription so other systems (HUD) can synchronize visuals.
 */
export default class DayNightCycle {
  private scene: Scene;
  private dayMs: number;
  private nightMs: number;
  private totalMs: number;
  private sun: DirectionalLight;
  private moon: DirectionalLight;
  private startTimestamp = Date.now();
  private frameObserver: Nullable<() => void> = null;
  private subscribers: Array<(s: DayNightState) => void> = [];
  private sunBaseIntensity: number;
  private moonBaseIntensity: number;
  private sunColor: Color3;
  private moonColor: Color3;

  constructor(scene: Scene, options?: DayNightOptions) {
    this.scene = scene;
    this.dayMs = options?.dayMs ?? 60_000;
    this.nightMs = options?.nightMs ?? 60_000;
    this.totalMs = this.dayMs + this.nightMs;
    this.sunBaseIntensity = options?.sunIntensity ?? 1.2;
    this.moonBaseIntensity = options?.moonIntensity ?? 0.35;
    this.sunColor = options?.sunColor ?? new Color3(1, 0.95, 0.85);
    this.moonColor = options?.moonColor ?? new Color3(0.8, 0.85, 1.0);

    // create directional lights
    this.sun = new DirectionalLight("sun_light", new Vector3(0, -1, 0), this.scene);
    this.sun.diffuse = this.sunColor;
    this.sun.specular = this.sunColor;
    this.sun.intensity = 0;

    this.moon = new DirectionalLight("moon_light", new Vector3(0, -1, 0), this.scene);
    this.moon.diffuse = this.moonColor;
    this.moon.specular = this.moonColor;
    this.moon.intensity = 0;

    // start update loop
    this.frameObserver = (() => {
      const obs = (this.scene as any).onBeforeRenderObservable.add(() => this._onFrame());
      return () => {
        try {
          (this.scene as any).onBeforeRenderObservable.remove(obs);
        } catch {}
      };
    })();
  }

  dispose() {
    if (this.frameObserver) {
      this.frameObserver();
      this.frameObserver = null;
    }
    try {
      this.sun.dispose();
    } catch {}
    try {
      this.moon.dispose();
    } catch {}
    this.subscribers = [];
  }

  onTick(cb: (s: DayNightState) => void) {
    this.subscribers.push(cb);
    return () => {
      const i = this.subscribers.indexOf(cb);
      if (i >= 0) this.subscribers.splice(i, 1);
    };
  }

  getLights() {
    return { sun: this.sun, moon: this.moon };
  }

  private _onFrame() {
    const now = Date.now();
    const elapsedInLoop = (now - this.startTimestamp) % this.totalMs;
    const isDay = elapsedInLoop < this.dayMs;
    const dayProgress = isDay ? elapsedInLoop / this.dayMs : 0;
    const nightProgress = !isDay ? (elapsedInLoop - this.dayMs) / this.nightMs : 0;
    const displaySec = Math.floor((isDay ? elapsedInLoop : (elapsedInLoop - this.dayMs)) / 1000);

    // Sun: angle from 0..PI (sunrise -> noon -> sunset)
    const sunAngle = Math.PI * dayProgress; // meaningful during day
    // position on unit semicircle
    const sunX = Math.cos(sunAngle);
    const sunY = Math.sin(sunAngle); // 0..1..0
    const sunDir = new Vector3(-sunX, -sunY, 0); // point downward toward scene
    this.sun.direction = sunDir;
    // intensity scales with sin(angle) (0..1..0) with small smoothing
    const sunIntensity = Math.max(0, this.sunBaseIntensity * (Math.sin(sunAngle) * 0.9 + 0.1));
    this.sun.intensity = isDay ? sunIntensity : 0;

    // Moon: angle for night (0..PI) but opposite of sun (so when sun is down moon rises)
    const moonAngle = Math.PI * nightProgress; // 0..PI during night
    const moonX = Math.cos(moonAngle);
    const moonY = Math.sin(moonAngle);
    const moonDir = new Vector3(-moonX, -moonY, 0);
    this.moon.direction = moonDir;
    const moonIntensity = Math.max(0, this.moonBaseIntensity * (Math.sin(moonAngle) * 0.9 + 0.1));
    this.moon.intensity = !isDay ? moonIntensity : 0;

    const state: DayNightState = {
      now,
      elapsedInLoop,
      isDay,
      dayProgress,
      nightProgress,
      displaySec,
    };

    // notify subscribers
    for (const sub of this.subscribers.slice()) {
      try {
        sub(state);
      } catch {}
    }
  }
}
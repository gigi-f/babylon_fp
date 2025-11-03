import { Scene, DirectionalLight, Vector3, Color3, Nullable } from "@babylonjs/core";
import CelestialBody from "./celestialBody";
import { DEFAULT_SUN_COLOR, DEFAULT_MOON_COLOR, DEFAULT_DIRECTION_DOWN, DEFAULT_CELESTIAL_RADIUS, DEFAULT_CELESTIAL_PZ } from "./sharedConstants";
 
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
  private pausedTimestamp: number | null = null; // Track when pause started
  private accumulatedPauseTime = 0; // Total time spent paused
  private frameObserver: Nullable<() => void> = null;
  private subscribers: Array<(s: DayNightState) => void> = [];
  private sunBaseIntensity: number;
  private moonBaseIntensity: number;
  private sunColor: Color3;
  private moonColor: Color3;
  // visible 2D sun/moon bodies (billboarded planes handled by CelestialBody)
  private sunBody: CelestialBody | null = null;
  private moonBody: CelestialBody | null = null;
  private lastState: DayNightState | null = null;

  constructor(scene: Scene, options?: DayNightOptions) {
    this.scene = scene;
    this.dayMs = options?.dayMs ?? 60_000;
    this.nightMs = options?.nightMs ?? 60_000;
    this.totalMs = this.dayMs + this.nightMs;
    this.sunBaseIntensity = options?.sunIntensity ?? 1.2;
    this.moonBaseIntensity = options?.moonIntensity ?? 0.35;
    this.sunColor = options?.sunColor ?? DEFAULT_SUN_COLOR;
    this.moonColor = options?.moonColor ?? DEFAULT_MOON_COLOR;

    // create directional lights
    this.sun = new DirectionalLight("sun_light", DEFAULT_DIRECTION_DOWN, this.scene);
    this.sun.diffuse = this.sunColor;
    this.sun.specular = this.sunColor;
    this.sun.intensity = 0;
 
    this.moon = new DirectionalLight("moon_light", DEFAULT_DIRECTION_DOWN, this.scene);
    this.moon.diffuse = this.moonColor;
    this.moon.specular = this.moonColor;
    this.moon.intensity = 0;

    // create celestial body for sun (billboarded 2D sprite managed by helper)
    try {
      this.sunBody = new CelestialBody(this.scene, {
        name: "sun",
        dtSize: 256,
        innerColor: "#FFF7CF",
        midColor: "#ffd16677",
        outerColor: "#ffee8e17",
        initialPosition: new Vector3(0, 20, 30),
        initialSize: 2,
      });
    } catch {}
 
    // create celestial body for moon (billboarded 2D sprite managed by helper)
    try {
      this.moonBody = new CelestialBody(this.scene, {
        name: "moon",
        dtSize: 192,
        innerColor: "#F0F4FF",
        midColor: "#CCD9FF",
        outerColor: "#99AEDD",
        initialPosition: new Vector3(0, 20, -30),
        initialSize: 2,
      });
    } catch {}
 
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
    try {
      if (this.sunBody) this.sunBody.dispose();
    } catch {}
    try {
      if (this.moonBody) this.moonBody.dispose();
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

  /**
   * Pause the day/night cycle. Time progression stops.
   */
  pause() {
    if (this.pausedTimestamp === null) {
      this.pausedTimestamp = Date.now();
    }
  }

  /**
   * Resume the day/night cycle from pause.
   */
  resume() {
    if (this.pausedTimestamp !== null) {
      // Add the time spent paused to accumulated pause time
      this.accumulatedPauseTime += Date.now() - this.pausedTimestamp;
      this.pausedTimestamp = null;
    }
  }

  private _onFrame() {
    // If paused, don't update the cycle
    if (this.pausedTimestamp !== null) {
      return;
    }
    
    const now = Date.now();
    // Subtract accumulated pause time to freeze the cycle during pauses
    const adjustedElapsed = now - this.startTimestamp - this.accumulatedPauseTime;
    const elapsedInLoop = adjustedElapsed % this.totalMs;
    const isDay = elapsedInLoop < this.dayMs;
    const dayProgress = isDay ? elapsedInLoop / this.dayMs : 0;
    const nightProgress = !isDay ? (elapsedInLoop - this.dayMs) / this.nightMs : 0;
    const displaySec = Math.floor((isDay ? elapsedInLoop : (elapsedInLoop - this.dayMs)) / 1000);

    // Sun: angle from 0..PI (sunrise -> noon -> sunset)
    const sunAngle = Math.PI * dayProgress; // meaningful during day
    // position on unit semicircle (x: right->left, y: up)
    const sunX = Math.cos(sunAngle);
    const sunY = Math.sin(sunAngle); // 0..1..0
    const sunDir = new Vector3(-sunX, -sunY, 0); // point downward toward scene
    this.sun.direction = sunDir;
    // visual factor based on sun height: 0 at sunrise/sunset, 1 at noon
    const sunVisual = Math.max(0, Math.sin(sunAngle));
    // intensity scalar with boost near horizon so rising sun is ~2x brighter than previous behaviour
    let sunScalar = sunVisual * 0.9 + 0.1; // original 0.1..1.0
    sunScalar = sunScalar * (1 + (1 - sunVisual)); // ~2x when sunVisual==0, 1x at top
    const sunIntensity = Math.max(0, this.sunBaseIntensity * sunScalar);
    this.sun.intensity = isDay ? sunIntensity : 0;
 
    // Update sun visual using CelestialBody helper (delegate brightness/scale/alpha mapping into helper)
    if (this.sunBody) {
      try {
        const radius = DEFAULT_CELESTIAL_RADIUS; // distance from scene center
        const px = sunX * radius;
        const py = sunY * radius - 10; // lift above horizon
        const pz = DEFAULT_CELESTIAL_PZ;
        const position = new Vector3(px, py, pz);
        const baseEm = new Color3(1, 0.95, 0.6);
        const visible = isDay && sunVisual > 0.01;
        // pass sunVisual (0..1) and let CelestialBody map it to size/alpha/emissive using its tuning params
        this.sunBody.updateVisual(position, sunVisual, baseEm, visible);
      } catch {}
    }
 
    // Moon: angle for night (0..PI) but opposite of sun (so when sun is down moon rises)
    const moonAngle = Math.PI * nightProgress; // 0..PI during night
    const moonX = Math.cos(moonAngle);
    const moonY = Math.sin(moonAngle);
    const moonDir = new Vector3(-moonX, -moonY, 0);
    this.moon.direction = moonDir;
    // visual factor for moon height
    const moonVisual = Math.max(0, Math.sin(moonAngle));
    // intensity scalar with boost near horizon (twice as bright at ascent)
    let moonScalar = moonVisual * 0.9 + 0.1;
    moonScalar = moonScalar * (1 + (1 - moonVisual));
    const moonIntensity = Math.max(0, this.moonBaseIntensity * moonScalar);
    this.moon.intensity = !isDay ? moonIntensity : 0;
    // Update moon visual using CelestialBody helper
    if (this.moonBody) {
      try {
        const radius = DEFAULT_CELESTIAL_RADIUS;
        const px = moonX * radius;
        const py = moonY * radius - 10;
        const pz = DEFAULT_CELESTIAL_PZ;
        const position = new Vector3(px, py, pz);
        const riseColor = new Color3(1.0, 0.6, 0.2); // warm harvest-orange (used at horizon)
        const baseMoon = new Color3(0.7, 0.75, 0.9); // default bluish moon (used at zenith)
        // mixed base color (caller expects CelestialBody to handle brightness mapping)
        const mixedBase = riseColor.scale(1 - moonVisual).add(baseMoon.scale(moonVisual));
        const visible = !isDay && moonVisual > 0.01;
        this.moonBody.updateVisual(position, moonVisual, mixedBase, visible);
      } catch {}
    }

    const state: DayNightState = {
      now,
      elapsedInLoop,
      isDay,
      dayProgress,
      nightProgress,
      displaySec,
    };

    this.lastState = state;

    // notify subscribers
    for (const sub of this.subscribers.slice()) {
      try {
        sub(state);
      } catch {}
    }
  }

  getLastState(): DayNightState | null {
    return this.lastState;
  }
}
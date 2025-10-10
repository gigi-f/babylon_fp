import { Scene, MeshBuilder, StandardMaterial, Color3, Vector3 } from "@babylonjs/core";
import { DEFAULT_CRIME_COLOR } from "./sharedConstants";

export type LoopEvent = {
  id: string;
  timeSec: number;
  callback: (scene: Scene) => void;
  repeat?: boolean;
  intervalSec?: number;
  active?: boolean;
};

export class LoopManager {
  scene: Scene;
  loopDuration: number;
  timeScale: number;
  elapsed: number;
  events: LoopEvent[];
  running: boolean;

  constructor(scene: Scene, loopDurationSec = 120, timeScale = 1) {
    this.scene = scene;
    this.loopDuration = loopDurationSec;
    this.timeScale = timeScale;
    this.elapsed = 0;
    this.events = [];
    this.running = false;
  }

  start() {
    this.running = true;
  }

  stop() {
    this.running = false;
  }

  reset() {
    this.elapsed = 0;
    for (const e of this.events) {
      e.active = true;
    }
  }

  update(deltaSec: number) {
    if (!this.running) return;
    const scaled = deltaSec * this.timeScale;
    this.elapsed += scaled;

    // loop wrap
    if (this.elapsed >= this.loopDuration) {
      this.reset();
    }

    // check events
    for (const e of this.events) {
      if (!e.active) continue;
      if (this.elapsed >= e.timeSec) {
        try {
          e.callback(this.scene);
        } catch (err) {
          console.error("LoopEvent callback error", err);
        }
        if (e.repeat && e.intervalSec) {
          e.timeSec += e.intervalSec;
        } else {
          e.active = false;
        }
      }
    }
  }

  scheduleEvent(
    id: string,
    timeSec: number,
    callback: (scene: Scene) => void,
    opts?: { repeat?: boolean; intervalSec?: number }
  ) {
    this.events.push({
      id,
      timeSec,
      callback,
      repeat: opts?.repeat,
      intervalSec: opts?.intervalSec,
      active: true,
    });
  }

  removeEvent(id: string) {
    this.events = this.events.filter((e) => e.id !== id);
  }

  clearEvents() {
    this.events = [];
  }
}

// Simple sample staged event creator
export function stagedCrimeAt(scene: Scene, pos = { x: 0, y: 0.5, z: 0 }) {
  return (s: Scene) => {
    // create a visible marker (low-fi red sphere) that represents the crime
    const sph = MeshBuilder.CreateSphere(`crime_${Date.now()}`, { diameter: 0.4 }, s);
    sph.position = new Vector3(pos.x, pos.y, pos.z);
    const mat = new StandardMaterial(`crimeMat_${Date.now()}`, s);
    mat.diffuseColor = DEFAULT_CRIME_COLOR;
    sph.material = mat;
    // auto-remove after a short time so scene stays clean
    setTimeout(() => {
      try {
        sph.dispose();
      } catch {}
    }, 15_000);
  };
}

export default LoopManager;
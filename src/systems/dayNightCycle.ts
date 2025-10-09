import { Scene, DirectionalLight, Vector3, Color3, MeshBuilder, StandardMaterial, DynamicTexture, Mesh, Nullable } from "@babylonjs/core";

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
  // visible 2D sun in the 3D world (billboarded plane)
  private sunMesh: Mesh | null = null;
  private sunMaterial: StandardMaterial | null = null;
  // visible moon mesh (billboarded plane) and material
  private moonMesh: Mesh | null = null;
  private moonMaterial: StandardMaterial | null = null;

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

    // create a billboarded plane to visualize the sun in world space (not HUD)
    try {
      this.sunMesh = MeshBuilder.CreatePlane("sun_plane", { size: 2 }, this.scene);
      this.sunMaterial = new StandardMaterial("sun_mat", this.scene);
      // create a simple yellow/orange circle using a DynamicTexture so the sun is a 2D circle sprite
      try {
        const DT_SIZE = 256;
        const dt = new DynamicTexture("sun_dt", { width: DT_SIZE, height: DT_SIZE }, this.scene, false);
        const ctx = dt.getContext();
        // transparent background
        ctx.clearRect(0, 0, DT_SIZE, DT_SIZE);
        // radial gradient for warm sun
        const cx = DT_SIZE / 2;
        const cy = DT_SIZE / 2;
        const r = DT_SIZE * 0.45;
        const grad = ctx.createRadialGradient(cx, cy, r * 0.05, cx, cy, r);
        grad.addColorStop(0, "#FFF7CF");
        grad.addColorStop(0.6, "#FFD166");
        grad.addColorStop(1, "#FF7A18");
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fill();
        // leave outside area transparent
        dt.update();
        // assign as diffuse texture and enable alpha so the square canvas is transparent
        (this.sunMaterial as StandardMaterial).diffuseTexture = dt;
        try { (this.sunMaterial!.diffuseTexture as any).hasAlpha = true; } catch {}
        (this.sunMaterial as StandardMaterial).useAlphaFromDiffuseTexture = true;
        // emissive tint for extra brightness while keeping rounded alpha
        this.sunMaterial.emissiveColor = new Color3(1, 0.95, 0.6);
        this.sunMaterial.diffuseColor = new Color3(0, 0, 0);
        this.sunMaterial.specularColor = new Color3(0, 0, 0);
        (this.sunMaterial as any).disableLighting = true;
        this.sunMaterial.backFaceCulling = true;
      } catch {
        // fallback: plain emissive color
        this.sunMaterial.emissiveColor = new Color3(1, 0.85, 0.35);
        (this.sunMaterial as any).disableLighting = true;
      }
      this.sunMesh.material = this.sunMaterial;
      // always face the camera
      (this.sunMesh as any).billboardMode = Mesh.BILLBOARDMODE_ALL;
      this.sunMesh.position = new Vector3(0, 20, 30);
      this.sunMesh.isVisible = false;
    } catch {}
 
    // create a billboarded plane to visualize the moon in world space (bluish-gray)
    try {
      this.moonMesh = MeshBuilder.CreatePlane("moon_plane", { size: 2 }, this.scene);
      this.moonMaterial = new StandardMaterial("moon_mat", this.scene);
      try {
        const DT_SIZE_M = 192;
        const dtm = new DynamicTexture("moon_dt", { width: DT_SIZE_M, height: DT_SIZE_M }, this.scene, false);
        const ctxm = dtm.getContext();
        // transparent background
        ctxm.clearRect(0, 0, DT_SIZE_M, DT_SIZE_M);
        const cxm = DT_SIZE_M / 2;
        const cym = DT_SIZE_M / 2;
        const rm = DT_SIZE_M * 0.45;
        const gradm = ctxm.createRadialGradient(cxm, cym, rm * 0.05, cxm, cym, rm);
        gradm.addColorStop(0, "#F0F4FF");
        gradm.addColorStop(0.6, "#CCD9FF");
        gradm.addColorStop(1, "#99AEDD");
        ctxm.fillStyle = gradm;
        ctxm.beginPath();
        ctxm.arc(cxm, cym, rm, 0, Math.PI * 2);
        ctxm.fill();
        dtm.update();
        (this.moonMaterial as StandardMaterial).diffuseTexture = dtm;
        try { (this.moonMaterial!.diffuseTexture as any).hasAlpha = true; } catch {}
        (this.moonMaterial as StandardMaterial).useAlphaFromDiffuseTexture = true;
        this.moonMaterial.emissiveColor = new Color3(0.7, 0.75, 0.9);
        this.moonMaterial.diffuseColor = new Color3(0, 0, 0);
        this.moonMaterial.specularColor = new Color3(0, 0, 0);
        (this.moonMaterial as any).disableLighting = true;
        this.moonMaterial.backFaceCulling = true;
      } catch {
        this.moonMaterial!.emissiveColor = new Color3(0.7, 0.75, 0.9);
        (this.moonMaterial as any).disableLighting = true;
      }
      this.moonMesh.material = this.moonMaterial;
      (this.moonMesh as any).billboardMode = Mesh.BILLBOARDMODE_ALL;
      this.moonMesh.position = new Vector3(0, 20, -30);
      this.moonMesh.isVisible = false;
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
      if (this.sunMaterial) this.sunMaterial.dispose();
    } catch {}
    try {
      if (this.sunMesh) this.sunMesh.dispose();
    } catch {}
    try {
      if (this.moonMaterial) this.moonMaterial.dispose();
    } catch {}
    try {
      if (this.moonMesh) this.moonMesh.dispose();
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
 
    // Position the visible sun mesh in world space so it travels east->west overhead.
    if (this.sunMesh) {
      try {
        const radius = 60; // distance from scene center
        // place sun along a large semicircular arc in X/Y; keep Z in front of scene so camera sees it.
        const px = sunX * radius;
        const py = sunY * radius - 10; // lift above horizon
        const pz = 30; // in front of scene center (adjust if needed)
        this.sunMesh.position = new Vector3(px, py, pz);
        // scale sun so it is larger near the horizon and smaller at the top
        const minSize = 2;
        const maxSize = 8;
        const size = minSize + (maxSize - minSize) * (1 - sunVisual); // larger at horizon
        this.sunMesh.scaling = new Vector3(size, size, size);
        // make sun visible only during day and when above horizon
        this.sunMesh.isVisible = isDay && sunVisual > 0.01;
        // make emissive brightness follow sunVisual but ensure ~2x brightness at horizon vs previous
        try {
          const baseEm = new Color3(1, 0.95, 0.6);
          // previous horizon emissive ~0.25; use 0.5 at horizon and 1.0 at top
          const emissiveScale = 0.5 + 0.5 * sunVisual;
          this.sunMaterial!.emissiveColor = baseEm.scale(emissiveScale *10);
          // slightly vary overall alpha so edges blend more at lower brightness
          (this.sunMaterial as any).alpha = 0.35 + 0.65 * sunVisual * 10;
        } catch {}
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
    // position visible moon mesh in world space (mirrors sun arc)
    if (this.moonMesh) {
      try {
        const radius = 60;
        const px = moonX * radius;
        const py = moonY * radius - 10;
        const pz = 30;
        this.moonMesh.position = new Vector3(px, py, pz);
        // scale moon so it's larger near the horizon and smaller at the top
        const minM = 2;
        const maxM = 8;
        const msize = minM + (maxM - minM) * (1 - moonVisual); // larger at horizon
        this.moonMesh.scaling = new Vector3(msize, msize, msize);
        this.moonMesh.isVisible = !isDay && moonVisual > 0.01;
        try {
          // color transition: orange at rise -> bluish at top
          const riseColor = new Color3(1.0, 0.6, 0.2); // warm harvest-orange
          const baseMoon = new Color3(0.7, 0.75, 0.9); // default bluish moon
          const mixed = riseColor.scale(1 - moonVisual).add(baseMoon.scale(moonVisual));
          // emissive scale: ensure ~0.5 at horizon -> 1.0 at top
          const emissiveScale = 0.5 + 0.5 * moonVisual;
          this.moonMaterial!.emissiveColor = mixed.scale(emissiveScale * 10);
          (this.moonMaterial as any).alpha = 0.25 + 0.75 * moonVisual * 10;
        } catch {}
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

    // notify subscribers
    for (const sub of this.subscribers.slice()) {
      try {
        sub(state);
      } catch {}
    }
  }
}
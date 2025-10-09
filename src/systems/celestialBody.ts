/*
CelestialBody: modular helper to create and update a billboarded 2D celestial sprite (sun/moon).

Enhancement:
- Move brightness/scale/alpha logic into this module so callers only pass a "visual factor"
  (0..1 where 0 = horizon, 1 = zenith). The instance supports a brightnessBoost parameter
  to tweak horizon-brightness globally per celestial object.
*/
import { Scene, MeshBuilder, StandardMaterial, DynamicTexture, Mesh, Color3, Vector3 } from "@babylonjs/core";

export type CelestialInitOptions = {
  name?: string;
  dtSize?: number;
  innerColor?: string;
  midColor?: string;
  outerColor?: string;
  initialSize?: number;
  initialPosition?: Vector3;
  // multiplier applied to computed emissive scale to make the body brighter/dimmer at all heights.
  brightnessBoost?: number;
  // default min/max visual size (units)
  minSize?: number;
  maxSize?: number;
  // default alpha range at horizon -> zenith
  alphaMin?: number;
  alphaMax?: number;
};

export default class CelestialBody {
  private scene: Scene;
  public mesh: Mesh;
  private material: StandardMaterial;
  private dt: DynamicTexture | null = null;

  // tunable parameters that control how visualFactor maps to size/alpha/emissive
  private brightnessBoost: number;
  private minSize: number;
  private maxSize: number;
  private alphaMin: number;
  private alphaMax: number;

  constructor(scene: Scene, opts?: CelestialInitOptions) {
    this.scene = scene;
    const name = opts?.name ?? "celestial";
    const dtSize = opts?.dtSize ?? 256;

    // store visual tuning parameters (defaults chosen to match previous behaviour)
    this.brightnessBoost = opts?.brightnessBoost ?? 100.0;
    this.minSize = opts?.minSize ?? (opts?.initialSize ?? 2);
    this.maxSize = opts?.maxSize ?? 8;
    // Alpha is the brightness of the celestial body
    this.alphaMin = (this.brightnessBoost * 0.5) * (opts?.alphaMin ?? 0.25);
    this.alphaMax = this.brightnessBoost * (opts?.alphaMax ?? 1.0);

    this.mesh = MeshBuilder.CreatePlane(`${name}_plane`, { size: 2 }, scene);
    this.material = new StandardMaterial(`${name}_mat`, scene);

    try {
      this.dt = new DynamicTexture(`${name}_dt`, { width: dtSize, height: dtSize }, scene, false);
      const ctx = this.dt.getContext();
      // transparent background
      ctx.clearRect(0, 0, dtSize, dtSize);

      const cx = dtSize / 2;
      const cy = dtSize / 2;
      const r = dtSize * 0.45;
      const grad = ctx.createRadialGradient(cx, cy, r * 0.05, cx, cy, r);
      grad.addColorStop(0, opts?.innerColor ?? "#FFF7CF");
      grad.addColorStop(0.6, opts?.midColor ?? "#ffd16675");
      grad.addColorStop(1, opts?.outerColor ?? "#ff781815");
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
      this.dt.update();

      this.material.diffuseTexture = this.dt;
      try { (this.material.diffuseTexture as any).hasAlpha = true; } catch {}
      this.material.useAlphaFromDiffuseTexture = true;

      this.material.emissiveColor = new Color3(1, 1, 1);
      this.material.diffuseColor = new Color3(0, 0, 0);
      this.material.specularColor = new Color3(0, 0, 0);
      (this.material as any).disableLighting = true;
      this.material.backFaceCulling = true;
    } catch {
      this.material.emissiveColor = new Color3(1, 1, 1);
      (this.material as any).disableLighting = true;
    }

    this.mesh.material = this.material;
    (this.mesh as any).billboardMode = Mesh.BILLBOARDMODE_ALL;
    if (opts?.initialPosition) this.mesh.position = opts.initialPosition;
    if (opts?.initialSize) this.mesh.scaling = new Vector3(opts.initialSize, opts.initialSize, opts.initialSize);
    this.mesh.isVisible = false;
  }

  /**
   * Generic setter that accepts fully computed visual parameters.
   * (kept for compatibility)
   */
  update(position: Vector3, size: number, emissive: Color3, alpha: number, visible: boolean) {
    try {
      this.mesh.position = position;
      this.mesh.scaling = new Vector3(size, size, size);
      this.material.emissiveColor = emissive;
      (this.material as any).alpha = alpha;
      this.mesh.isVisible = visible;
    } catch {}
  }

  /**
   * updateVisual: map a single visualFactor -> size/alpha/emissive using the instance tuning parameters.
   * - visualFactor: 0..1 where 0 = horizon (sunrise/sunset), 1 = zenith (noon)
   * - baseColor: the "color" to use for emissive at zenith; horizon will be warmed by blending when caller chooses
   * - position: world position
   * - visible: whether to show the mesh
   */
  updateVisual(position: Vector3, visualFactor: number, baseColor: Color3, visible: boolean) {
    try {
      // clamp
      const vf = Math.min(1, Math.max(0, visualFactor));

      // size: larger at horizon (visualFactor==0) and smaller at zenith (visualFactor==1)
      const size = this.minSize + (this.maxSize - this.minSize) * (1 - vf);

      // emissive scale maps from 0.5..1.0 (previously) then we multiply by brightnessBoost
      const emissiveScale = (0.5 + 0.5 * vf) * this.brightnessBoost;
      const emissive = baseColor.scale(emissiveScale);

      // alpha linear interpolation from alphaMin (horizon) to alphaMax (zenith)
      const alpha = this.alphaMin + (this.alphaMax - this.alphaMin) * vf;

      this.mesh.position = position;
      this.mesh.scaling = new Vector3(size, size, size);
      this.material.emissiveColor = emissive;
      (this.material as any).alpha = alpha;
      this.mesh.isVisible = visible;
    } catch {}
  }

  dispose() {
    try { this.mesh.dispose(); } catch {}
    try { if (this.material) this.material.dispose(); } catch {}
    try { if (this.dt) (this.dt as any).dispose(); } catch {}
  }
}
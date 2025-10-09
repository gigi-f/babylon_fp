// CelestialBody: modular helper to create and update a billboarded 2D celestial sprite (sun/moon)
import { Scene, MeshBuilder, StandardMaterial, DynamicTexture, Mesh, Color3, Vector3 } from "@babylonjs/core";

export type CelestialInitOptions = {
  name?: string;
  dtSize?: number;
  innerColor?: string;
  midColor?: string;
  outerColor?: string;
  initialSize?: number;
  initialPosition?: Vector3;
};

export default class CelestialBody {
  private scene: Scene;
  public mesh: Mesh;
  private material: StandardMaterial;
  private dt: DynamicTexture | null = null;

  constructor(scene: Scene, opts?: CelestialInitOptions) {
    this.scene = scene;
    const name = opts?.name ?? "celestial";
    const dtSize = opts?.dtSize ?? 256;

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
      grad.addColorStop(0.6, opts?.midColor ?? "#FFD166");
      grad.addColorStop(1, opts?.outerColor ?? "#FF7A18");
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

  update(position: Vector3, size: number, emissive: Color3, alpha: number, visible: boolean) {
    try {
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
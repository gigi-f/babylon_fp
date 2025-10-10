import { Scene, MeshBuilder, StandardMaterial, Color3, Vector3, TransformNode, SpotLight, Nullable } from "@babylonjs/core";

export type StreetLampOptions = {
  poleHeight?: number;
  poleRadius?: number;
  headSize?: number;
  headOffset?: Vector3;
  coneAngle?: number;
  intensity?: number;
  color?: Color3;
};

const lampColor = new Color3(1, 0.6, 0.8)

export default class StreetLamp {
  private scene: Scene;
  private root: TransformNode;
  private pole: any;
  private head: any;
  private neck: any;
  private bulbMat: StandardMaterial | null = null;
  private spot: SpotLight | null = null;
  private options: StreetLampOptions;
  private cycleUnsub: Nullable<() => void> = null;

  constructor(scene: Scene, position: Vector3, options?: StreetLampOptions) {
    this.scene = scene;
    this.options = options ?? {};
    const poleHeight = this.options.poleHeight ?? 3.0;
    const poleRadius = this.options.poleRadius ?? 0.06;
    const headSize = this.options.headSize ?? 0.22;
    const headOffset = this.options.headOffset ?? new Vector3(0, -0.1, 0);
    const color = this.options.color ?? lampColor;
    const coneAngle = this.options.coneAngle ?? Math.PI / 4;
    const intensity = this.options.intensity ?? 2.5;

    this.root = new TransformNode("streetlamp_root", this.scene);
    this.root.position = position.clone();

    // pole
    try {
      this.pole = MeshBuilder.CreateCylinder("lamp_pole", { height: poleHeight, diameterTop: poleRadius, diameterBottom: poleRadius }, this.scene);
      this.pole.parent = this.root;
      this.pole.position = new Vector3(0, poleHeight / 2, 0);
      const poleMat = new StandardMaterial("lamp_pole_mat", this.scene);
      poleMat.diffuseColor = new Color3(0.15, 0.15, 0.15);
      this.pole.material = poleMat;
      try { this.pole.checkCollisions = false; } catch {}
    } catch {}

    // neck + head / bulb (curved neck so lamp shines down in front of post)
    try {
      // build a simple curved path for the neck (local coordinates under root)
      const neckRadius = Math.max(0.02, poleRadius * 0.9);
      const neckDepth = 0.5 + (headSize * 0.8); // forward offset from pole top
      const neckDrop = 0.2; // how far the head hangs below the pole top
      const points: Vector3[] = [];
      // create a smooth curve using a few sample points (quarter-arc like)
      const samples = 6;
      for (let i = 0; i <= samples; i++) {
        const t = i / samples; // 0..1
        // interpolate along an arc: x stays 0, z goes from 0 -> neckDepth, y goes from poleHeight -> poleHeight - neckDrop
        const z = Math.sin(t * Math.PI * 0.5) * neckDepth;
        const y = poleHeight - (1 - Math.cos(t * Math.PI * 0.5)) * neckDrop;
        points.push(new Vector3(0, y, z));
      }
      this.neck = MeshBuilder.CreateTube("lamp_neck", { path: points, radius: neckRadius, updatable: false }, this.scene);
      this.neck.parent = this.root;
      const neckMat = new StandardMaterial("lamp_neck_mat", this.scene);
      neckMat.diffuseColor = new Color3(0.15, 0.15, 0.15);
      this.neck.material = neckMat;
    } catch {}

    // head / bulb placed at end of neck
    try {
      this.head = MeshBuilder.CreateSphere("lamp_head", { diameter: headSize }, this.scene);
      this.head.parent = this.root;
      // position at last neck point if neck exists, otherwise default above pole
      try {
        if (this.neck && typeof (this.neck as any).getBoundingInfo === "function") {
          // using the points we created above: end point roughly at (0, poleHeight - neckDrop, neckDepth)
          // reuse same math to be deterministic
          const endZ = Math.sin(1 * Math.PI * 0.5) * (0.5 + (headSize * 0.8));
          const endY = poleHeight - (1 - Math.cos(1 * Math.PI * 0.5)) * 0.2;
          this.head.position = new Vector3(0, endY + (headOffset.y ?? 0), endZ + (headOffset.z ?? 0));
        } else {
          this.head.position = new Vector3(0, poleHeight + headOffset.y, headOffset.z ?? 0);
        }
      } catch {
        this.head.position = new Vector3(0, poleHeight + headOffset.y, headOffset.z ?? 0);
      }
      this.bulbMat = new StandardMaterial("lamp_bulb_mat", this.scene);
      this.bulbMat.emissiveColor = color.scale(0); // start off
      this.bulbMat.diffuseColor = new Color3(0.15, 0.04, 0.03);
      this.head.material = this.bulbMat;
    } catch {}

    // spot light (cone) positioned at head and pointing mostly downward
    try {
      // initial spot position; will be kept synced each frame to head world position
      const spotPos = this.root.position.add(this.head ? this.head.position : new Vector3(0, poleHeight, 0));
      // direction points downward with a tiny forward bias so the cone lights area in front of post
      const dir = new Vector3(0, -1, 0.05).normalize();
      this.spot = new SpotLight("lamp_spot", spotPos, dir, coneAngle, 2, this.scene);
      this.spot.diffuse = color;
      this.spot.specular = color;
      this.spot.intensity = 0;
      try { this.spot.parent = this.root; } catch {}
      // keep light position and direction synced with head each frame
      this.scene.onBeforeRenderObservable.add(() => {
        try {
          if (!this.head) return;
          // head is local to root; compute world position for the spot
          const headWorld = this.root.getAbsolutePosition().add(this.head.position);
          if (this.spot) {
            this.spot.position = headWorld;
            // recompute direction to point roughly down from head (in world space)
            const down = new Vector3(-0.8, -1, -0.8).normalize();
            this.spot.direction = down;
          }
        } catch {}
      });
    } catch {}
  }

  attachToCycle(cycle: any) {
    if (!cycle || typeof cycle.onTick !== "function") return;
    // unsubscribe previous if any
    try { if (this.cycleUnsub) { this.cycleUnsub(); this.cycleUnsub = null; } } catch {}
    this.cycleUnsub = cycle.onTick((s: any) => {
      try {
        const isDay = s.isDay;
        if (isDay) {
          this.setLightOn(false);
        } else {
          // night intensity may vary with nightProgress to emulate dimming during early/late night
          const nightFactor = Math.max(0.15, s.nightProgress ?? 1);
          const target = (this.options.intensity ?? 5) * nightFactor;
          this.setLightOn(true, target);
        }
      } catch {}
    });
  }

  setLightOn(on: boolean, intensity?: number) {
    try {
      if (this.spot) {
        this.spot.intensity = on ? (intensity ?? this.options.intensity ?? 2.5) : 0;
      }
      if (this.bulbMat) {
        this.bulbMat.emissiveColor = on ? (this.options.color ?? lampColor).scale(0.6) : new Color3(0, 0, 0);
      }
    } catch {}
  }

  dispose() {
    try { if (this.cycleUnsub) { this.cycleUnsub(); this.cycleUnsub = null; } } catch {}
    try { if (this.spot) this.spot.dispose(); } catch {}
    try { if (this.head) this.head.dispose(); } catch {}
    try { if (this.pole) this.pole.dispose(); } catch {}
    try { if (this.root) this.root.dispose(); } catch {}
  }
}
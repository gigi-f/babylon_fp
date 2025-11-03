import { Scene, MeshBuilder, StandardMaterial, Color3, Vector3, TransformNode, SpotLight, Nullable } from "@babylonjs/core";
import { DEFAULT_POLE_COLOR, DEFAULT_BULB_DIFFUSE } from "./sharedConstants";
 
export type StreetLampOptions = {
  poleHeight?: number;
  poleRadius?: number;
  headSize?: number;
  headOffset?: Vector3;
  coneAngle?: number;
  intensity?: number;
  color?: Color3;
};
 
const DEFAULT_LAMP_COLOR = new Color3(1, 0.86, 0.6);
const DEFAULT_SPOT_DIRECTION = new Vector3(0, -1, 0.15).normalize();
const DEFAULT_SPOT_RANGE = 18;
const DEFAULT_SPOT_EXPONENT = 1.1;

export default class StreetLamp {
  private scene: Scene;
  private root: TransformNode;
  private base: any;
  private pole: any;
  private arm: any;
  private head: any;
  private diffuser: any;
  private headNode: TransformNode | null = null;
  private structuralMat: StandardMaterial | null = null;
  private headMat: StandardMaterial | null = null;
  private spot: SpotLight | null = null;
  private options: StreetLampOptions;
  private cycleUnsub: Nullable<() => void> = null;
  private static nextId = 0;

  constructor(scene: Scene, position: Vector3, options?: StreetLampOptions) {
    this.scene = scene;
    this.options = options ?? {};
    const poleHeight = this.options.poleHeight ?? 3.2;
    const poleThickness = this.options.poleRadius ? this.options.poleRadius * 2 : 0.12;
    const armLength = 1.2;
    const armThickness = 0.1;
    const headWidth = 0.32;
    const headDepth = 0.46;
    const headThickness = 0.12;
    const headDrop = 0.25;
    const baseSize = 0.4;
    const baseHeight = 0.18;
    const coneAngle = this.options.coneAngle ?? (Math.PI / 5);
    const color = this.options.color ?? DEFAULT_LAMP_COLOR;

    const uniqueId = StreetLamp.nextId++;
    const baseName = `streetlamp_${uniqueId}`;

    this.root = new TransformNode(`${baseName}_root`, this.scene);
    this.root.position = position.clone();

    this.structuralMat = new StandardMaterial(`${baseName}_structure_mat`, this.scene);
    this.structuralMat.diffuseColor = DEFAULT_POLE_COLOR;
    this.structuralMat.specularColor = new Color3(0.05, 0.05, 0.05);

    const baseHeightOffset = baseHeight / 2;

    try {
      this.base = MeshBuilder.CreateBox(
        `${baseName}_base`,
        {
          width: baseSize,
          depth: baseSize,
          height: baseHeight,
        },
        this.scene
      );
      this.base.parent = this.root;
      this.base.position = new Vector3(0, baseHeightOffset, 0);
      this.base.material = this.structuralMat;
    } catch {}

    try {
      this.pole = MeshBuilder.CreateBox(
        `${baseName}_pole`,
        {
          width: poleThickness,
          depth: poleThickness,
          height: poleHeight,
        },
        this.scene
      );
      this.pole.parent = this.root;
      this.pole.position = new Vector3(0, baseHeight + poleHeight / 2, 0);
      this.pole.material = this.structuralMat;
    } catch {}

    const armY = baseHeight + poleHeight - (armThickness / 2);
    const armLengthOffset = armLength / 2;

    try {
      this.arm = MeshBuilder.CreateBox(
        `${baseName}_arm`,
        {
          width: armLength,
          height: armThickness,
          depth: poleThickness,
        },
        this.scene
      );
      this.arm.parent = this.root;
      this.arm.position = new Vector3(armLengthOffset, armY, 0);
      this.arm.material = this.structuralMat;
    } catch {}

    const headY = baseHeight + poleHeight - headDrop;
    const headPosition = new Vector3(armLength, headY, 0);

    this.headNode = new TransformNode(`${baseName}_head_node`, this.scene);
    this.headNode.parent = this.root;
    this.headNode.position = headPosition;

    this.headMat = new StandardMaterial(`${baseName}_head_mat`, this.scene);
    this.headMat.diffuseColor = DEFAULT_BULB_DIFFUSE;
    this.headMat.emissiveColor = Color3.Black();
    this.headMat.alpha = 0.95;

    try {
      this.head = MeshBuilder.CreateBox(
        `${baseName}_head`,
        {
          width: headWidth,
          height: headThickness,
          depth: headDepth,
        },
        this.scene
      );
      this.head.parent = this.headNode;
      this.head.position = new Vector3(0, -headThickness / 2, 0);
      this.head.material = this.headMat;
    } catch {}

    try {
      this.diffuser = MeshBuilder.CreateBox(
        `${baseName}_diffuser`,
        {
          width: headWidth * 0.9,
          height: headThickness * 0.6,
          depth: headDepth * 0.92,
        },
        this.scene
      );
      this.diffuser.parent = this.headNode;
      this.diffuser.position = new Vector3(0, -headThickness, 0);
      this.diffuser.material = this.headMat;
    } catch {}

    try {
      this.spot = new SpotLight(
        `${baseName}_spot`,
        new Vector3(0, -headThickness, 0),
        DEFAULT_SPOT_DIRECTION.clone(),
        coneAngle,
        DEFAULT_SPOT_EXPONENT,
        this.scene
      );
      this.spot.parent = this.headNode;
      this.spot.diffuse = color;
      this.spot.specular = color;
      this.spot.intensity = 0;
      this.spot.range = DEFAULT_SPOT_RANGE;
      this.spot.angle = coneAngle;
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
        this.spot.intensity = on ? (intensity ?? this.options.intensity ?? 4.5) : 0;
      }
      if (this.headMat) {
        this.headMat.emissiveColor = on ? (this.options.color ?? DEFAULT_LAMP_COLOR).scale(0.8) : Color3.Black();
      }
    } catch {}
  }

  dispose() {
    try { if (this.cycleUnsub) { this.cycleUnsub(); this.cycleUnsub = null; } } catch {}
    try { if (this.spot) this.spot.dispose(); } catch {}
    try { if (this.diffuser) this.diffuser.dispose(); } catch {}
    try { if (this.head) this.head.dispose(); } catch {}
    try { if (this.arm) this.arm.dispose(); } catch {}
    try { if (this.pole) this.pole.dispose(); } catch {}
    try { if (this.base) this.base.dispose(); } catch {}
    try { if (this.headNode) this.headNode.dispose(); } catch {}
    try { if (this.headMat) this.headMat.dispose(); } catch {}
    try { if (this.structuralMat) this.structuralMat.dispose(); } catch {}
    try { if (this.root) this.root.dispose(); } catch {}
  }
}
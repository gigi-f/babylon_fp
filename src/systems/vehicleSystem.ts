import { Scene } from "@babylonjs/core/scene";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { PBRMaterial } from "@babylonjs/core/Materials/PBR/pbrMaterial";
import { Material } from "@babylonjs/core/Materials/material";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { SpotLight } from "@babylonjs/core/Lights/spotLight";
import { PointLight } from "@babylonjs/core/Lights/pointLight";
import type { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh";

import type { ISystem } from "./SystemManager";
import type { MapBuilder, VehicleDefinition } from "./mapBuilder";
import HourlyCycle from "./hourlyCycle";
import DayNightCycle, { DayNightState } from "./dayNightCycle";
import { Logger } from "../utils/logger";

const logger = Logger.create("VehicleSystem");

const HEADLIGHT_COLOR = new Color3(1, 0.97, 0.9);
const BRAKE_LIGHT_COLOR = new Color3(1, 0.18, 0.18);
const BRAKE_LIGHT_SPECULAR = new Color3(0.6, 0, 0);
const HEADLIGHT_RANGE = 18;
const BRAKE_LIGHT_RANGE = 5;

interface VehiclePathSegment {
  start: Vector3;
  end: Vector3;
  length: number;
  direction: Vector3;
}

interface VehiclePathState {
  segments: VehiclePathSegment[];
  cumulative: number[];
  totalLength: number;
}

interface VehicleInstance {
  definition: VehicleDefinition;
  root: TransformNode;
  body: Mesh;
  materials: Material[];
  pathState?: VehiclePathState;
  lights?: VehicleLights;
}

interface Headlight {
  light: SpotLight;
  localPosition: Vector3;
}

interface BrakeLight {
  light: PointLight;
  localPosition: Vector3;
}

interface VehicleLights {
  headlights: Headlight[];
  brakeLights: BrakeLight[];
}

/**
 * Simple vehicle system that instantiates vehicle meshes based on map data.
 * Future iterations will animate along road graphs and manage seat occupancy.
 */
export class VehicleSystem implements ISystem {
  private readonly vehicles = new Map<string, VehicleInstance>();
  private hourlyCycle?: HourlyCycle;
  private hourlyCycleUnsub?: () => void;
  private loopDurationSec = 120;
  private currentLoopPercent = 0;
  private manualLoopTimeSec = 0;
  private dayNightCycle?: DayNightCycle;
  private dayNightUnsub?: () => void;
  private dayNightState?: DayNightState;

  constructor(
    private readonly scene: Scene,
    private readonly mapBuilder: MapBuilder,
    private readonly npcSystem?: any // Optional NpcSystem reference
  ) {
    this.initialize();
  }

  /**
   * Set NPC system reference after construction (for dependency resolution)
   */
  setNpcSystem(npcSystem: any): void {
    (this as any).npcSystem = npcSystem;
  }

  setCycle(hourlyCycle: HourlyCycle, totalLoopMs: number): void {
    if (this.hourlyCycleUnsub) {
      try {
        this.hourlyCycleUnsub();
      } catch {}
      this.hourlyCycleUnsub = undefined;
    }

    this.hourlyCycle = hourlyCycle;
    const totalSeconds = Math.max(0.1, totalLoopMs / 1000);
    this.loopDurationSec = totalSeconds;

    const info = hourlyCycle.getLastInfo();
    if (info) {
      this.currentLoopPercent = info.loopPercent;
      this.manualLoopTimeSec = this.currentLoopPercent * this.loopDurationSec;
    } else {
      this.currentLoopPercent = 0;
      this.manualLoopTimeSec = 0;
    }

    this.hourlyCycleUnsub = hourlyCycle.onTick((tickInfo) => {
      this.currentLoopPercent = tickInfo.loopPercent;
      this.manualLoopTimeSec = this.currentLoopPercent * this.loopDurationSec;
    });

    this.rebuildAllVehiclePaths();
  }

  setDayNightCycle(dayNightCycle: DayNightCycle): void {
    if (this.dayNightUnsub) {
      try {
        this.dayNightUnsub();
      } catch {}
      this.dayNightUnsub = undefined;
    }

    this.dayNightCycle = dayNightCycle ?? undefined;

    if (!dayNightCycle) {
      this.dayNightState = undefined;
      this.refreshAllVehicleLightIntensities();
      return;
    }

    const lastState = dayNightCycle.getLastState();
    if (lastState) {
      this.dayNightState = lastState;
    }
    this.refreshAllVehicleLightIntensities();

    this.dayNightUnsub = dayNightCycle.onTick((state) => {
      try {
        this.dayNightState = state;
        this.refreshAllVehicleLightIntensities();
      } catch {}
    });
  }

  /**
   * Update vehicle positions to follow NPCs that are in them
   */
  update(deltaSeconds: number): void {
    if (!this.hourlyCycle && this.loopDurationSec > 0) {
      this.manualLoopTimeSec = (this.manualLoopTimeSec + deltaSeconds) % this.loopDurationSec;
      this.currentLoopPercent = this.manualLoopTimeSec / this.loopDurationSec;
    }

    const followerVehicles: VehicleInstance[] = [];

    for (const vehicle of this.vehicles.values()) {
      if (vehicle.pathState) {
        this.updateVehicleAlongPath(vehicle);
      } else {
        followerVehicles.push(vehicle);
      }
    }

    if (!this.npcSystem || followerVehicles.length === 0) {
      return;
    }

    try {
      for (const vehicle of followerVehicles) {
        let foundNpc: any = null;

        for (const npc of this.npcSystem.npcs) {
          if (npc.inVehicle && npc.currentVehicleId === vehicle.definition.id) {
            foundNpc = npc;
            break;
          }
        }

        if (foundNpc) {
          const offset = 0.2;
          vehicle.root.position.x = foundNpc.root.position.x;
          vehicle.root.position.y = foundNpc.root.position.y;
          vehicle.root.position.z = foundNpc.root.position.z + offset;
          vehicle.root.rotation.y = foundNpc.root.rotation.y;
        }
      }
    } catch {
      // Swallow errors to avoid spamming logs during runtime updates
    }
  }

  dispose(): void {
    if (this.hourlyCycleUnsub) {
      try {
        this.hourlyCycleUnsub();
      } catch {}
      this.hourlyCycleUnsub = undefined;
    }

    if (this.dayNightUnsub) {
      try {
        this.dayNightUnsub();
      } catch {}
      this.dayNightUnsub = undefined;
    }

    for (const vehicle of this.vehicles.values()) {
      this.disposeVehicleLights(vehicle);
      try {
        vehicle.body.dispose(false, true);
      } catch {}
      for (const material of vehicle.materials) {
        try {
          material.dispose();
        } catch {}
      }
      try {
        vehicle.root.dispose();
      } catch {}
    }
    this.vehicles.clear();
    logger.info("VehicleSystem disposed");
  }

  private initialize(): void {
    const vehicleDefinitions = this.mapBuilder.getVehicles();
    if (!vehicleDefinitions.length) {
      logger.info("No vehicles defined in map data");
      return;
    }

    for (const vehicleDef of vehicleDefinitions) {
      this.spawnVehicle(vehicleDef);
    }

    logger.info("VehicleSystem initialized", { count: this.vehicles.size });
  }

  private spawnVehicle(def: VehicleDefinition): void {
    if (!def?.id) {
      logger.warn("Skipping vehicle with missing id", { def });
      return;
    }

    if (this.vehicles.has(def.id)) {
      logger.warn("Vehicle id already exists, skipping duplicate", { id: def.id });
      return;
    }

    if (!def.position) {
      logger.warn("Vehicle is missing position", { id: def.id });
      return;
    }

    const root = new TransformNode(`vehicle_${def.id}_root`, this.scene);
    root.position = new Vector3(def.position.x, def.position.y, def.position.z);
    root.rotation = new Vector3(0, this.degToRad(def.rotation ?? 0), 0);

    const color = this.resolveColor(def);
    const { body, materials } = this.createVehicleMesh(def, root, color);

    const instance: VehicleInstance = {
      definition: def,
      root,
      body,
      materials,
    };

    const lights = this.createVehicleLights(def.id, root);
    if (lights) {
      instance.lights = lights;
    }

    const pathState = this.createPathState(def);
    if (pathState) {
      instance.pathState = pathState;
      this.updateVehicleAlongPath(instance);
    } else {
      this.updateVehicleLights(instance, root.rotation.y);
    }

    this.vehicles.set(def.id, instance);
    logger.debug("Vehicle spawned", { id: def.id, type: def.type, position: def.position });
  }

  private createVehicleMesh(def: VehicleDefinition, root: TransformNode, baseColor: Color3): { body: Mesh; materials: Material[] } {
    const materials: Material[] = [];

    const bodyMaterial = new PBRMaterial(`vehicle_${def.id}_body_mat`, this.scene);
    bodyMaterial.albedoColor = baseColor;
    bodyMaterial.metallic = 0.78;
    bodyMaterial.roughness = 0.28;
    bodyMaterial.environmentIntensity = 0.85;
    bodyMaterial.clearCoat.isEnabled = true;
    bodyMaterial.clearCoat.intensity = 0.55;
    bodyMaterial.clearCoat.roughness = 0.04;
    materials.push(bodyMaterial);

    const accentMaterial = new PBRMaterial(`vehicle_${def.id}_accent_mat`, this.scene);
    accentMaterial.albedoColor = Color3.Lerp(baseColor, Color3.White(), 0.28);
    accentMaterial.metallic = 0.82;
    accentMaterial.roughness = 0.22;
    accentMaterial.environmentIntensity = 0.8;
    materials.push(accentMaterial);

    const glassMaterial = new PBRMaterial(`vehicle_${def.id}_glass_mat`, this.scene);
    glassMaterial.albedoColor = new Color3(0.25, 0.38, 0.48);
    glassMaterial.alpha = 0.55;
    glassMaterial.metallic = 1;
    glassMaterial.roughness = 0.05;
    glassMaterial.environmentIntensity = 1.1;
    glassMaterial.backFaceCulling = false;
    materials.push(glassMaterial);

    const tireMaterial = new PBRMaterial(`vehicle_${def.id}_tire_mat`, this.scene);
    tireMaterial.albedoColor = new Color3(0.05, 0.05, 0.05);
    tireMaterial.metallic = 0.12;
    tireMaterial.roughness = 0.9;
    tireMaterial.environmentIntensity = 0.4;
    materials.push(tireMaterial);

    const rimMaterial = new PBRMaterial(`vehicle_${def.id}_rim_mat`, this.scene);
    rimMaterial.albedoColor = new Color3(0.82, 0.83, 0.86);
    rimMaterial.metallic = 0.92;
    rimMaterial.roughness = 0.18;
    rimMaterial.environmentIntensity = 0.9;
    materials.push(rimMaterial);

    const headlightMaterial = new StandardMaterial(`vehicle_${def.id}_headlight_mat`, this.scene);
    headlightMaterial.diffuseColor = HEADLIGHT_COLOR;
    headlightMaterial.emissiveColor = HEADLIGHT_COLOR.scale(1.8);
    headlightMaterial.specularColor = Color3.Black();
    materials.push(headlightMaterial);

    const brakeMaterial = new StandardMaterial(`vehicle_${def.id}_brake_light_mat`, this.scene);
    brakeMaterial.diffuseColor = BRAKE_LIGHT_COLOR;
    brakeMaterial.emissiveColor = BRAKE_LIGHT_COLOR.scale(1.6);
    brakeMaterial.specularColor = Color3.Black();
    materials.push(brakeMaterial);

    const bodyHeight = 0.46;
    const body = MeshBuilder.CreateBox(
      `vehicle_${def.id}_chassis`,
      {
        width: 1.86,
        height: bodyHeight,
        depth: 3.6,
      },
      this.scene
    ) as Mesh;
    body.parent = root;
    body.position = new Vector3(0, bodyHeight / 2 + 0.34, 0);
    body.material = bodyMaterial;
    body.checkCollisions = true;
    body.receiveShadows = true;
    body.alwaysSelectAsActiveMesh = true;
    body.metadata = {
      vehicleId: def.id,
      vehicleType: def.type,
      capacity: def.capacity ?? null,
    };

    const attach = (mesh: AbstractMesh, material: Material, receiveShadows = true) => {
      mesh.parent = body;
      mesh.material = material;
      mesh.checkCollisions = false;
      mesh.isPickable = false;
      mesh.receiveShadows = receiveShadows;
    };

    const undertray = MeshBuilder.CreateBox(
      `vehicle_${def.id}_undertray`,
      {
        width: 1.92,
        height: 0.12,
        depth: 3.5,
      },
      this.scene
    );
    attach(undertray, accentMaterial, false);
    undertray.position = new Vector3(0, -bodyHeight / 2 + 0.04, 0);

    const hood = MeshBuilder.CreateBox(
      `vehicle_${def.id}_hood`,
      {
        width: 1.78,
        height: 0.32,
        depth: 1.25,
      },
      this.scene
    );
    attach(hood, accentMaterial);
    hood.position = new Vector3(0, 0.28, 1.05);
    hood.rotation.x = -Math.PI / 16;

    const canopy = MeshBuilder.CreateBox(
      `vehicle_${def.id}_canopy`,
      {
        width: 1.6,
        height: 0.62,
        depth: 2.1,
      },
      this.scene
    );
    attach(canopy, glassMaterial, false);
    canopy.position = new Vector3(0, 0.55, -0.15);

    const canopyFrame = MeshBuilder.CreateBox(
      `vehicle_${def.id}_canopy_frame`,
      {
        width: 1.62,
        height: 0.08,
        depth: 2.22,
      },
      this.scene
    );
    attach(canopyFrame, accentMaterial);
    canopyFrame.position = new Vector3(0, 0.86, -0.15);

    const splitter = MeshBuilder.CreateBox(
      `vehicle_${def.id}_splitter`,
      {
        width: 1.92,
        height: 0.08,
        depth: 0.52,
      },
      this.scene
    );
    attach(splitter, accentMaterial, false);
    splitter.position = new Vector3(0, -0.14, 1.62);

    const diffuser = MeshBuilder.CreateBox(
      `vehicle_${def.id}_diffuser`,
      {
        width: 1.92,
        height: 0.12,
        depth: 0.64,
      },
      this.scene
    );
    attach(diffuser, accentMaterial, false);
    diffuser.position = new Vector3(0, -0.1, -1.68);

    const stripeLeft = MeshBuilder.CreateBox(
      `vehicle_${def.id}_stripe_left`,
      {
        width: 0.04,
        height: 0.24,
        depth: 3.3,
      },
      this.scene
    );
    attach(stripeLeft, accentMaterial);
    stripeLeft.position = new Vector3(0.95, 0.18, -0.05);

    const stripeRight = stripeLeft.clone(`vehicle_${def.id}_stripe_right`);
    if (stripeRight) {
      attach(stripeRight, accentMaterial);
      stripeRight.position.x = -0.95;
    }

    const headlightBar = MeshBuilder.CreateBox(
      `vehicle_${def.id}_headlight_bar`,
      {
        width: 1.28,
        height: 0.16,
        depth: 0.08,
      },
      this.scene
    );
    attach(headlightBar, headlightMaterial, false);
    headlightBar.position = new Vector3(0, 0.3, 1.78);

    const tailLightBar = MeshBuilder.CreateBox(
      `vehicle_${def.id}_tail_light_bar`,
      {
        width: 1.32,
        height: 0.18,
        depth: 0.08,
      },
      this.scene
    );
    attach(tailLightBar, brakeMaterial, false);
    tailLightBar.position = new Vector3(0, 0.42, -1.78);

    const fin = MeshBuilder.CreateBox(
      `vehicle_${def.id}_roof_fin`,
      {
        width: 0.22,
        height: 0.28,
        depth: 0.6,
      },
      this.scene
    );
    attach(fin, accentMaterial);
    fin.position = new Vector3(0, 1.02, -0.55);

    const wheelOffsets = [
      new Vector3(-0.72, -0.28, 1.24),
      new Vector3(0.72, -0.28, 1.24),
      new Vector3(-0.72, -0.28, -1.24),
      new Vector3(0.72, -0.28, -1.24),
    ];

    wheelOffsets.forEach((offset, index) => {
      const wheel = MeshBuilder.CreateCylinder(
        `vehicle_${def.id}_wheel_${index}`,
        {
          diameter: 0.78,
          height: 0.35,
          tessellation: 28,
        },
        this.scene
      );
      attach(wheel, tireMaterial);
      wheel.rotation.z = Math.PI / 2;
      wheel.position = offset.clone();
      wheel.receiveShadows = true;

      const rim = MeshBuilder.CreateCylinder(
        `vehicle_${def.id}_rim_${index}`,
        {
          diameter: 0.48,
          height: 0.08,
          tessellation: 16,
        },
        this.scene
      );
      rim.parent = wheel;
      rim.material = rimMaterial;
      rim.rotation.z = Math.PI / 2;
      rim.checkCollisions = false;
      rim.isPickable = false;
      rim.receiveShadows = true;

      const hub = MeshBuilder.CreateCylinder(
        `vehicle_${def.id}_hub_${index}`,
        {
          diameter: 0.16,
          height: 0.1,
          tessellation: 12,
        },
        this.scene
      );
      hub.parent = wheel;
      hub.material = rimMaterial;
      hub.rotation.z = Math.PI / 2;
      hub.checkCollisions = false;
      hub.isPickable = false;
      hub.receiveShadows = true;
    });

    const uniqueMaterials = Array.from(new Set(materials));
    return { body, materials: uniqueMaterials };
  }

  private rebuildAllVehiclePaths(): void {
    for (const vehicle of this.vehicles.values()) {
      const state = this.createPathState(vehicle.definition);
      vehicle.pathState = state ?? undefined;
      if (vehicle.pathState) {
        this.updateVehicleAlongPath(vehicle);
      }
      this.updateVehicleLights(vehicle, vehicle.root.rotation.y);
    }
  }

  private createPathState(def: VehicleDefinition): VehiclePathState | null {
    if (!def.path || def.path.length < 2) {
      return null;
    }

    const points = def.path.map((node) => new Vector3(node.x, node.y ?? 0, node.z));
    if (points.length < 2) {
      return null;
    }

    const first = points[0];
    const last = points[points.length - 1];
    if (!this.vectorsApproximatelyEqual(first, last)) {
      points.push(first.clone());
    }

    const segments: VehiclePathSegment[] = [];
    const cumulative: number[] = [0];
    let totalLength = 0;

    for (let i = 0; i < points.length - 1; i++) {
      const start = points[i];
      const end = points[i + 1];
      const delta = end.subtract(start);
      const length = delta.length();

      if (length <= 0.0001) {
        continue;
      }

      const direction = delta.normalize();
      segments.push({ start: start.clone(), end: end.clone(), length, direction });
      totalLength += length;
      cumulative.push(totalLength);
    }

    if (!segments.length || totalLength <= 0.0001) {
      return null;
    }

    if (cumulative.length !== segments.length + 1) {
      cumulative.length = segments.length + 1;
      cumulative[0] = 0;
      let running = 0;
      for (let i = 0; i < segments.length; i++) {
        running += segments[i].length;
        cumulative[i + 1] = running;
      }
    }

    return { segments, cumulative, totalLength };
  }

  private updateVehicleAlongPath(vehicle: VehicleInstance): void {
    if (!vehicle.pathState) {
      return;
    }

    const progress = this.getVehicleProgress(vehicle.definition);
    const sample = this.samplePath(
      vehicle.pathState,
      progress,
      !!vehicle.definition.reverse,
      vehicle.definition.laneOffset ?? 0
    );
    vehicle.root.position.copyFrom(sample.position);
    vehicle.root.rotation.y = sample.heading;
    this.updateVehicleLights(vehicle, sample.heading);
  }

  private getVehicleProgress(def: VehicleDefinition): number {
    let progress = this.currentLoopPercent;

    if (def.reverse) {
      progress = 1 - progress;
    }

    if (typeof def.loopOffset === "number") {
      progress += def.loopOffset;
    }

    progress %= 1;
    if (progress < 0) {
      progress += 1;
    }

    return progress;
  }

  private samplePath(
    state: VehiclePathState,
    progress: number,
    reverse: boolean,
    laneOffsetDistance: number
  ): { position: Vector3; heading: number } {
    if (state.totalLength <= 0 || !state.segments.length) {
      const fallback = state.segments[0]?.start.clone() ?? Vector3.Zero();
      return { position: fallback, heading: 0 };
    }

    let normalized = progress % 1;
    if (normalized < 0) {
      normalized += 1;
    }

    let distance = normalized * state.totalLength;
    const { segments, cumulative } = state;

    for (let i = 0; i < segments.length; i++) {
      const segStart = cumulative[i];
      const segEnd = cumulative[i + 1];
      if (distance <= segEnd || i === segments.length - 1) {
        const denom = segEnd - segStart;
        const t = denom <= 0 ? 0 : (distance - segStart) / denom;
        const position = Vector3.Lerp(segments[i].start, segments[i].end, t);
        const direction = reverse ? segments[i].direction.scale(-1) : segments[i].direction;
        position.y = segments[i].start.y + (segments[i].end.y - segments[i].start.y) * t;
        const adjustedPosition = this.applyLaneOffset(position, direction, laneOffsetDistance);
        const heading = Math.atan2(direction.x, direction.z);
        return { position: adjustedPosition, heading };
      }
    }

    const lastSeg = segments[segments.length - 1];
    const dir = reverse ? lastSeg.direction.scale(-1) : lastSeg.direction;
    const fallbackPos = this.applyLaneOffset(lastSeg.end.clone(), dir, laneOffsetDistance);
    fallbackPos.y = lastSeg.end.y;
    return {
      position: fallbackPos,
      heading: Math.atan2(dir.x, dir.z),
    };
  }

  private applyLaneOffset(position: Vector3, forward: Vector3, laneOffsetDistance: number): Vector3 {
    if (laneOffsetDistance <= 0) {
      return position;
    }

    if (forward.lengthSquared() <= 0.000001) {
      return position;
    }

    const lateral = forward.cross(Vector3.Up());
    if (lateral.lengthSquared() <= 0.000001) {
      return position;
    }

    const offset = lateral.normalize().scale(laneOffsetDistance);
    position.addInPlace(offset);
    return position;
  }

  private updateVehicleLights(vehicle: VehicleInstance, heading: number): void {
    if (!vehicle.lights) {
      return;
    }

    try {
      vehicle.root.computeWorldMatrix(true);
    } catch {}

    const world = vehicle.root.getWorldMatrix();
    const forward = this.forwardFromHeading(heading);
    const headDirection = this.computeHeadlightDirection(forward);

    for (const headlight of vehicle.lights.headlights) {
      try {
        const worldPosition = Vector3.TransformCoordinates(headlight.localPosition, world);
        headlight.light.position.copyFrom(worldPosition);
        headlight.light.direction.copyFrom(headDirection);
      } catch {}
    }

    for (const brake of vehicle.lights.brakeLights) {
      try {
        const worldPosition = Vector3.TransformCoordinates(brake.localPosition, world);
        brake.light.position.copyFrom(worldPosition);
      } catch {}
    }

    this.applyLightIntensities(vehicle);
  }

  private forwardFromHeading(heading: number): Vector3 {
    const sin = Math.sin(heading);
    const cos = Math.cos(heading);
    const forward = new Vector3(sin, 0, cos);
    return forward.normalize();
  }

  private computeHeadlightDirection(forward: Vector3): Vector3 {
    const dir = new Vector3(forward.x, forward.y - 0.25, forward.z);
    return dir.normalize();
  }

  private applyLightIntensities(vehicle: VehicleInstance): void {
    if (!vehicle.lights) {
      return;
    }

    const headlightIntensity = this.computeHeadlightIntensity();
    const brakeIntensity = this.computeBrakeLightIntensity();

    for (const headlight of vehicle.lights.headlights) {
      headlight.light.intensity = headlightIntensity;
    }

    for (const brake of vehicle.lights.brakeLights) {
      brake.light.intensity = brakeIntensity;
    }
  }

  private computeHeadlightIntensity(): number {
    if (!this.dayNightState) {
      return 0;
    }

    if (this.dayNightState.isDay) {
      return 0;
    }

    const progress = Math.max(0.2, this.dayNightState.nightProgress ?? 1);
    const base = 5.5;
    const boost = 3.0 * progress;
    return base + boost;
  }

  private computeBrakeLightIntensity(): number {
    const state = this.dayNightState;
    if (!state) {
      return 0.9;
    }

    return state.isDay ? 0.9 : 1.6;
  }

  private refreshAllVehicleLightIntensities(): void {
    for (const vehicle of this.vehicles.values()) {
      this.applyLightIntensities(vehicle);
    }
  }

  private createVehicleLights(id: string, root: TransformNode): VehicleLights | null {
    const headlights: Headlight[] = [];
    const brakeLights: BrakeLight[] = [];

    try {
      root.computeWorldMatrix(true);
      const basePosition = root.getAbsolutePosition();
      const baseDirection = new Vector3(0, -0.2, 1).normalize();
      const headOffsets = [
        new Vector3(-0.45, 0.6, 1.5),
        new Vector3(0.45, 0.6, 1.5),
      ];

      headOffsets.forEach((offset, index) => {
        try {
          const light = new SpotLight(
            `vehicle_${id}_head_${index}`,
            basePosition.clone(),
            baseDirection.clone(),
            Math.PI / 6,
            2,
            this.scene
          );
          light.diffuse = HEADLIGHT_COLOR;
          light.specular = HEADLIGHT_COLOR;
          light.intensity = 0;
          light.range = HEADLIGHT_RANGE;
          light.exponent = 1.4;
          headlights.push({ light, localPosition: offset.clone() });
        } catch (error) {
          logger.warn("Failed to create headlight", { id, index, error });
        }
      });

      const brakeOffsets = [
        new Vector3(-0.45, 0.55, -1.5),
        new Vector3(0.45, 0.55, -1.5),
      ];

      brakeOffsets.forEach((offset, index) => {
        try {
          const light = new PointLight(
            `vehicle_${id}_brake_${index}`,
            basePosition.clone(),
            this.scene
          );
          light.diffuse = BRAKE_LIGHT_COLOR;
          light.specular = BRAKE_LIGHT_SPECULAR;
          light.intensity = 0;
          light.range = BRAKE_LIGHT_RANGE;
          brakeLights.push({ light, localPosition: offset.clone() });
        } catch (error) {
          logger.warn("Failed to create brake light", { id, index, error });
        }
      });
    } catch (error) {
      logger.warn("Failed to initialize vehicle lights", { id, error });
    }

    if (!headlights.length && !brakeLights.length) {
      return null;
    }

    return { headlights, brakeLights };
  }

  private disposeVehicleLights(vehicle: VehicleInstance): void {
    if (!vehicle.lights) {
      return;
    }

    for (const headlight of vehicle.lights.headlights) {
      try {
        headlight.light.dispose();
      } catch {}
    }

    for (const brake of vehicle.lights.brakeLights) {
      try {
        brake.light.dispose();
      } catch {}
    }

    vehicle.lights = undefined;
  }

  private vectorsApproximatelyEqual(a: Vector3, b: Vector3, epsilon = 0.0001): boolean {
    return Math.abs(a.x - b.x) <= epsilon && Math.abs(a.y - b.y) <= epsilon && Math.abs(a.z - b.z) <= epsilon;
  }

  private resolveColor(def: VehicleDefinition): Color3 {
    if (def.color) {
      const color = this.parseHexColor(def.color);
      if (color) {
        return color;
      }
    }

    return this.getFallbackColor(def.type);
  }

  private parseHexColor(hex: string): Color3 | null {
    const normalized = hex.trim().replace("#", "");
    if (!/^([0-9a-fA-F]{6})$/.test(normalized)) {
      logger.warn("Invalid vehicle color, falling back to default", { hex });
      return null;
    }

    const r = parseInt(normalized.slice(0, 2), 16) / 255;
    const g = parseInt(normalized.slice(2, 4), 16) / 255;
    const b = parseInt(normalized.slice(4, 6), 16) / 255;
    return new Color3(r, g, b);
  }

  private getFallbackColor(type: string): Color3 {
    switch (type) {
      case "police":
        return new Color3(0.1, 0.2, 0.8);
      case "taxi":
        return new Color3(0.95, 0.8, 0.2);
      case "delivery":
        return new Color3(0.9, 0.4, 0.1);
      default:
        return new Color3(0.8, 0.8, 0.8);
    }
  }

  private degToRad(value: number): number {
    return (value * Math.PI) / 180;
  }
}

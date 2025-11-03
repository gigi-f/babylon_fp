import { Scene } from "@babylonjs/core/scene";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
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
  body: AbstractMesh;
  material: StandardMaterial;
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
      vehicle.body.dispose(false, true);
      vehicle.material.dispose();
      vehicle.root.dispose();
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

    const body = MeshBuilder.CreateBox(
      `vehicle_${def.id}_body`,
      {
        width: 1.6,
        height: 1.2,
        depth: 3.2,
      },
      this.scene
    );
    body.parent = root;
    body.position = new Vector3(0, 0.6, 0);
    body.metadata = {
      vehicleId: def.id,
      vehicleType: def.type,
      capacity: def.capacity ?? null,
    };
    body.checkCollisions = true;

    const material = new StandardMaterial(`vehicle_${def.id}_mat`, this.scene);
    material.diffuseColor = this.resolveColor(def);
    material.specularColor = Color3.Black();
    body.material = material;

    // Simple roof for quick readability
    const roof = MeshBuilder.CreateBox(
      `vehicle_${def.id}_roof`,
      {
        width: 1.4,
        height: 0.4,
        depth: 1.6,
      },
      this.scene
    );
    roof.parent = body;
    roof.position = new Vector3(0, 0.7, -0.6);
    roof.material = material;

    const instance: VehicleInstance = {
      definition: def,
      root,
      body,
      material,
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

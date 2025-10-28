import { Scene } from "@babylonjs/core/scene";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import type { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh";

import type { ISystem } from "./SystemManager";
import type { MapBuilder, VehicleDefinition } from "./mapBuilder";
import { Logger } from "../utils/logger";

const logger = Logger.create("VehicleSystem");

interface VehicleInstance {
  definition: VehicleDefinition;
  root: TransformNode;
  body: AbstractMesh;
  material: StandardMaterial;
}

/**
 * Simple vehicle system that instantiates vehicle meshes based on map data.
 * Future iterations will animate along road graphs and manage seat occupancy.
 */
export class VehicleSystem implements ISystem {
  private readonly vehicles = new Map<string, VehicleInstance>();
  private vehicleToNpc = new Map<string, { npcId: string; npcName: string }>();

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

  /**
   * Update vehicle positions to follow NPCs that are in them
   */
  update(_deltaSeconds: number): void {
    if (!this.npcSystem) return;

    try {
      // Clear previous associations
      this.vehicleToNpc.clear();

      // Build vehicle-NPC associations from active NPC schedules
      for (const npc of this.npcSystem.npcs) {
        if (!npc.schedule) continue;

        // Get the current position (which includes active waypoint data)
        const currentPos = this.npcSystem.positionForLoopPercent?.(npc, this.npcSystem.currentLoopPercent?.());

        if (currentPos && currentPos.vehicleId) {
          this.vehicleToNpc.set(currentPos.vehicleId, {
            npcId: npc.id,
            npcName: npc.name,
          });
        }
      }

      // Update vehicle positions to match their NPCs
      for (const [vehicleId, vehicle] of this.vehicles) {
        const npcInfo = this.vehicleToNpc.get(vehicleId);

        if (npcInfo) {
          // Find the NPC in the system
          const npc = this.npcSystem.npcs.find((n: any) => n.id === npcInfo.npcId);
          if (npc && npc.mesh) {
            // Position vehicle at NPC location with slight offset for visibility
            const offset = 0.2; // Small offset so we can see the NPC inside
            vehicle.root.position.x = npc.mesh.position.x;
            vehicle.root.position.y = npc.mesh.position.y;
            vehicle.root.position.z = npc.mesh.position.z + offset;

            // Optional: Match NPC rotation if needed
            if (npc.mesh.rotation) {
              vehicle.root.rotation.y = npc.mesh.rotation.y;
            }
          }
        }
      }
    } catch (error) {
      // Silently fail to avoid spamming logs
    }
  }

  dispose(): void {
    for (const vehicle of this.vehicles.values()) {
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

    this.vehicles.set(def.id, instance);
    logger.debug("Vehicle spawned", { id: def.id, type: def.type, position: def.position });
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

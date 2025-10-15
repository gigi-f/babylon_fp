import { Scene } from "@babylonjs/core/scene";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { PhysicsImpostor } from "@babylonjs/core/Physics/physicsImpostor";
import { Logger } from "../utils/logger";

const logger = Logger.create("MapBuilder");

/**
 * Tile types that can be placed in the map
 */
export type TileType = 
  | "wall" 
  | "floor" 
  | "door" 
  | "window" 
  | "npc-spawn" 
  | "player-spawn";

/**
 * Map tile definition
 */
export interface MapTile {
  type: TileType;
  position: {
    x: number;
    y: number;
    z: number;
  };
  gridPosition: {
    x: number;
    y: number;
  };
  rotation?: number; // Rotation in degrees (0, 90, 180, 270)
}

/**
 * Spawn point definition
 */
export interface SpawnPoint {
  x: number;
  y: number;
  z: number;
  rotation?: number; // Rotation in degrees (0, 90, 180, 270)
  npcId?: string;
}

/**
 * Map data structure
 */
export interface MapData {
  metadata: {
    gridSize: number;
    cellSize: number;
    worldSize: number;
    version: string;
  };
  buildings: MapTile[];
  spawns: {
    player: SpawnPoint[];
    npcs: SpawnPoint[];
  };
}

/**
 * Building configuration options
 */
export interface BuildingConfig {
  cellSize?: number;
  wallHeight?: number;
  wallThickness?: number;
  doorHeight?: number;
  doorWidth?: number;
  windowHeight?: number;
  windowWidth?: number;
}

/**
 * MapBuilder - Loads and builds 3D structures from 2D map data
 */
export class MapBuilder {
  private scene: Scene;
  private config: Required<BuildingConfig>;
  private materials: Map<string, StandardMaterial> = new Map();
  private mapData: MapData | null = null;

  constructor(scene: Scene, config: Partial<BuildingConfig> = {}) {
    this.scene = scene;
    
    // Default configuration
    this.config = {
      cellSize: config.cellSize ?? 2,
      wallHeight: config.wallHeight ?? 3.0,
      wallThickness: config.wallThickness ?? 1.0,
      doorHeight: config.doorHeight ?? 2.2,
      doorWidth: config.doorWidth ?? 1.0,
      windowHeight: config.windowHeight ?? 1.5,
      windowWidth: config.windowWidth ?? 1.2,
    };

    this.initMaterials();
  }

  /**
   * Initialize materials for different tile types
   */
  private initMaterials(): void {
    // Wall material
    const wallMat = new StandardMaterial("wallMat", this.scene);
    wallMat.diffuseColor = new Color3(0.7, 0.7, 0.7);
    this.materials.set("wall", wallMat);

    // Floor material
    const floorMat = new StandardMaterial("floorMat", this.scene);
    floorMat.diffuseColor = new Color3(0.8, 0.75, 0.65);
    this.materials.set("floor", floorMat);

    // Door material
    const doorMat = new StandardMaterial("doorMat", this.scene);
    doorMat.diffuseColor = new Color3(0.55, 0.27, 0.07);
    this.materials.set("door", doorMat);

    // Window material
    const windowMat = new StandardMaterial("windowMat", this.scene);
    windowMat.diffuseColor = new Color3(0.53, 0.81, 0.92);
    windowMat.alpha = 0.5;
    this.materials.set("window", windowMat);
  }

  /**
   * Load and build map from JSON data
   */
  async loadMap(mapData: MapData): Promise<void> {
    logger.info("Loading map", { 
      gridSize: mapData.metadata.gridSize,
      buildings: mapData.buildings.length,
      playerSpawns: mapData.spawns.player.length,
      npcSpawns: mapData.spawns.npcs.length
    });

    // Store map data for later access
    this.mapData = mapData;

    // Build structures
    for (const tile of mapData.buildings) {
      this.buildTile(tile);
    }

    logger.info("Map loaded successfully");
  }

  /**
   * Load map from JSON file
   */
  async loadMapFromFile(filePath: string): Promise<void> {
    try {
      const response = await fetch(filePath);
      if (!response.ok) {
        throw new Error(`Failed to load map: ${response.statusText}`);
      }
      const mapData: MapData = await response.json();
      await this.loadMap(mapData);
    } catch (error) {
      logger.error("Failed to load map file", { filePath, error });
      throw error;
    }
  }

  /**
   * Build a single tile based on its type
   */
  private buildTile(tile: MapTile): void {
    const pos = new Vector3(tile.position.x, tile.position.y, tile.position.z);
    const rotation = tile.rotation || 0;

    switch (tile.type) {
      case "wall":
        this.buildWall(pos, rotation);
        break;
      case "floor":
        this.buildFloor(pos);
        break;
      case "door":
        this.buildDoor(pos, rotation);
        break;
      case "window":
        this.buildWindow(pos, rotation);
        break;
      default:
        logger.warn("Unknown tile type", { type: tile.type });
    }
  }

  /**
   * Build a wall segment
   */
  private buildWall(position: Vector3, rotation: number = 0): void {
    const wall = MeshBuilder.CreateBox(
      `wall_${position.x}_${position.z}`,
      {
        width: this.config.cellSize,
        height: this.config.wallHeight,
        depth: this.config.wallThickness,
      },
      this.scene
    );

    wall.position = position.add(new Vector3(0, this.config.wallHeight / 2, 0));
    wall.rotation.y = (rotation * Math.PI) / 180; // Convert degrees to radians
    wall.material = this.materials.get("wall")!;

    // Add physics
    wall.physicsImpostor = new PhysicsImpostor(
      wall,
      PhysicsImpostor.BoxImpostor,
      { mass: 0, restitution: 0 },
      this.scene
    );
  }

  /**
   * Build a floor tile
   */
  private buildFloor(position: Vector3): void {
    const floor = MeshBuilder.CreateBox(
      `floor_${position.x}_${position.z}`,
      {
        width: this.config.cellSize,
        height: 0.1,
        depth: this.config.cellSize,
      },
      this.scene
    );

    floor.position = position.add(new Vector3(0, 0.05, 0));
    floor.material = this.materials.get("floor")!;

    // Add physics
    floor.physicsImpostor = new PhysicsImpostor(
      floor,
      PhysicsImpostor.BoxImpostor,
      { mass: 0, restitution: 0.1 },
      this.scene
    );
  }

  /**
   * Build a door
   */
  private buildDoor(position: Vector3, rotation: number = 0): void {
    const door = MeshBuilder.CreateBox(
      `door_${position.x}_${position.z}`,
      {
        width: this.config.cellSize,
        height: this.config.doorHeight,
        depth: this.config.wallThickness,
      },
      this.scene
    );

    door.position = position.add(new Vector3(0, this.config.doorHeight / 2, 0));
    door.rotation.y = (rotation * Math.PI) / 180; // Convert degrees to radians
    door.material = this.materials.get("door")!;

    // Add metadata for door interaction
    door.metadata = {
      isDoor: true,
      isOpen: false,
    };

    // Add physics (initially blocking)
    door.physicsImpostor = new PhysicsImpostor(
      door,
      PhysicsImpostor.BoxImpostor,
      { mass: 0, restitution: 0 },
      this.scene
    );
  }

  /**
   * Build a window
   */
  private buildWindow(position: Vector3, rotation: number = 0): void {
    const window = MeshBuilder.CreateBox(
      `window_${position.x}_${position.z}`,
      {
        width: this.config.cellSize,
        height: this.config.windowHeight,
        depth: this.config.wallThickness,
      },
      this.scene
    );

    // Windows are placed higher than doors
    const windowYOffset = this.config.wallHeight - this.config.windowHeight - 0.5;
    window.position = position.add(
      new Vector3(0, windowYOffset + this.config.windowHeight / 2, 0)
    );
    window.rotation.y = (rotation * Math.PI) / 180; // Convert degrees to radians
    window.material = this.materials.get("window")!;

    // Windows block movement
    window.physicsImpostor = new PhysicsImpostor(
      window,
      PhysicsImpostor.BoxImpostor,
      { mass: 0, restitution: 0 },
      this.scene
    );
  }

  /**
   * Get player spawn points from map data
   */
  getPlayerSpawns(): SpawnPoint[] {
    if (!this.mapData) {
      logger.warn("No map data loaded, returning empty player spawns");
      return [];
    }
    return this.mapData.spawns.player;
  }

  /**
   * Get NPC spawn points from map data
   */
  getNPCSpawns(): SpawnPoint[] {
    if (!this.mapData) {
      logger.warn("No map data loaded, returning empty NPC spawns");
      return [];
    }
    return this.mapData.spawns.npcs;
  }

  /**
   * Dispose of all resources
   */
  dispose(): void {
    this.materials.forEach((mat) => mat.dispose());
    this.materials.clear();
  }
}

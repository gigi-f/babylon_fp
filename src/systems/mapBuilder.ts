import { Scene } from "@babylonjs/core/scene";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { PhysicsImpostor } from "@babylonjs/core/Physics/physicsImpostor";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { Logger } from "../utils/logger";
import {
  GRID_CELL_SIZE,
  WALL_HEIGHT,
  WALL_THICKNESS,
  WALL_WIDTH,
  DOOR_HEIGHT,
  DOOR_WIDTH,
  WINDOW_HEIGHT,
  WINDOW_WIDTH,
} from "../config/worldConstants";

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
  schedule?: Record<string, { x: number; y: number; z: number }>; // Schedule from map editor
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
  wallWidth?: number;
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
    
    // Default configuration using shared world constants
    this.config = {
      cellSize: config.cellSize ?? GRID_CELL_SIZE,
      wallHeight: config.wallHeight ?? WALL_HEIGHT,
      wallThickness: config.wallThickness ?? WALL_THICKNESS,
      wallWidth: config.wallWidth ?? WALL_WIDTH,
      doorHeight: config.doorHeight ?? DOOR_HEIGHT,
      doorWidth: config.doorWidth ?? DOOR_WIDTH,
      windowHeight: config.windowHeight ?? WINDOW_HEIGHT,
      windowWidth: config.windowWidth ?? WINDOW_WIDTH,
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

    // Roof material (red)
    const roofMat = new StandardMaterial("roofMat", this.scene);
    roofMat.diffuseColor = new Color3(0.8, 0.2, 0.2); // Red color
    this.materials.set("roof", roofMat);

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
        width: this.config.wallWidth,
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
   * Build a floor tile (and corresponding roof tile)
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

    // Create roof tile above the floor (at wall height)
    const roof = MeshBuilder.CreateBox(
      `roof_${position.x}_${position.z}`,
      {
        width: this.config.cellSize,
        height: 0.5, // Short height as specified
        depth: this.config.cellSize,
      },
      this.scene
    );

    // Position at top of walls (WALL_HEIGHT = 3.0)
    roof.position = position.add(new Vector3(0, WALL_HEIGHT + 0.25, 0)); // +0.25 = half of roof height
    roof.material = this.materials.get("roof")!;

    // Add physics to roof so it's solid
    roof.physicsImpostor = new PhysicsImpostor(
      roof,
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
        width: this.config.doorWidth, // Use doorWidth (2 units) not cellSize
        height: this.config.doorHeight,
        depth: this.config.wallThickness * 0.5, // Make door thinner (half wall thickness)
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
   * Build a window (wall with glass inset)
   */
  private buildWindow(position: Vector3, rotation: number = 0): void {
    // Create a parent transform node to group all window parts
    const windowGroup = new TransformNode(`window_${position.x}_${position.z}`, this.scene);
    windowGroup.position = position.add(new Vector3(0, this.config.wallHeight / 2, 0));
    windowGroup.rotation.y = (rotation * Math.PI) / 180;

    // Calculate window opening position (slightly higher than center)
    const windowYOffset = this.config.wallHeight - this.config.windowHeight - 0.5;
    const windowCenterY = windowYOffset + this.config.windowHeight / 2 - this.config.wallHeight / 2;

    // Create wall sections around the window opening
    const wallMaterial = this.materials.get("wall")!;

    // Bottom section (below window)
    const bottomHeight = windowYOffset;
    if (bottomHeight > 0.1) {
      const bottomWall = MeshBuilder.CreateBox(
        `window_bottom_${position.x}_${position.z}`,
        {
          width: this.config.wallWidth,
          height: bottomHeight,
          depth: this.config.wallThickness,
        },
        this.scene
      );
      bottomWall.position = new Vector3(0, -this.config.wallHeight / 2 + bottomHeight / 2, 0);
      bottomWall.parent = windowGroup;
      bottomWall.material = wallMaterial;
    }

    // Top section (above window)
    const topHeight = this.config.wallHeight - windowYOffset - this.config.windowHeight;
    if (topHeight > 0.1) {
      const topWall = MeshBuilder.CreateBox(
        `window_top_${position.x}_${position.z}`,
        {
          width: this.config.wallWidth,
          height: topHeight,
          depth: this.config.wallThickness,
        },
        this.scene
      );
      topWall.position = new Vector3(0, this.config.wallHeight / 2 - topHeight / 2, 0);
      topWall.parent = windowGroup;
      topWall.material = wallMaterial;
    }

    // Left section (beside window)
    const sideWidth = (this.config.wallWidth - this.config.windowWidth) / 2;
    if (sideWidth > 0.1) {
      const leftWall = MeshBuilder.CreateBox(
        `window_left_${position.x}_${position.z}`,
        {
          width: sideWidth,
          height: this.config.windowHeight,
          depth: this.config.wallThickness,
        },
        this.scene
      );
      leftWall.position = new Vector3(-this.config.wallWidth / 2 + sideWidth / 2, windowCenterY, 0);
      leftWall.parent = windowGroup;
      leftWall.material = wallMaterial;
    }

    // Right section (beside window)
    if (sideWidth > 0.1) {
      const rightWall = MeshBuilder.CreateBox(
        `window_right_${position.x}_${position.z}`,
        {
          width: sideWidth,
          height: this.config.windowHeight,
          depth: this.config.wallThickness,
        },
        this.scene
      );
      rightWall.position = new Vector3(this.config.wallWidth / 2 - sideWidth / 2, windowCenterY, 0);
      rightWall.parent = windowGroup;
      rightWall.material = wallMaterial;
    }

    // Create the glass window in the opening
    const glassWindow = MeshBuilder.CreateBox(
      `window_glass_${position.x}_${position.z}`,
      {
        width: this.config.windowWidth,
        height: this.config.windowHeight,
        depth: this.config.wallThickness * 0.3, // Thinner glass pane
      },
      this.scene
    );
    glassWindow.position = new Vector3(0, windowCenterY, 0);
    glassWindow.parent = windowGroup;
    glassWindow.material = this.materials.get("window")!;

    // Add physics to the entire window group (blocks movement)
    // Use a box impostor the size of the full wall
    const physicsBox = MeshBuilder.CreateBox(
      `window_physics_${position.x}_${position.z}`,
      {
        width: this.config.wallWidth,
        height: this.config.wallHeight,
        depth: this.config.wallThickness,
      },
      this.scene
    );
    physicsBox.position = windowGroup.position.clone();
    physicsBox.rotation.y = windowGroup.rotation.y;
    physicsBox.isVisible = false; // Invisible collision box
    physicsBox.physicsImpostor = new PhysicsImpostor(
      physicsBox,
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

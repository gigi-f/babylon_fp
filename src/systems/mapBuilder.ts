import { Scene } from "@babylonjs/core/scene";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { Vector3, Matrix } from "@babylonjs/core/Maths/math.vector";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { PhysicsImpostor } from "@babylonjs/core/Physics/physicsImpostor";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { Logger } from "../utils/logger";
import StreetLamp from "./streetLamp";
import type DayNightCycle from "./dayNightCycle";
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
  | "road"
  | "cobblestone-path"
  | "door" 
  | "window" 
  | "street-lamp"
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
 * Vehicle route waypoint definition
 */
export interface VehiclePathNode {
  x: number;
  y?: number;
  z: number;
  /** Optional time offset in seconds relative to vehicle start */
  timeOffset?: number;
  /** Optional reference to a named road node for semantic routing */
  roadNode?: string;
}

/**
 * Vehicle definition
 */
export interface VehicleDefinition {
  id: string;
  type: string;
  position: {
    x: number;
    y: number;
    z: number;
  };
  rotation?: number;
  /** Optional display color encoded as hex string (#RRGGBB) */
  color?: string;
  /** Seats available for NPCs */
  capacity?: number;
  /** Desired travel speed in world units per second */
  speed?: number;
  /** Optional procedural route */
  path?: VehiclePathNode[];
  /** Fractional starting offset along the loop (0..1) */
  loopOffset?: number;
  /** When true, traverse the path in reverse (counter-clockwise) */
  reverse?: boolean;
  /** Lateral offset in world units to keep vehicles in their lane (measured to the right of travel) */
  laneOffset?: number;
}

type PathSegmentData = {
  segments: Array<{ start: Vector3; end: Vector3; length: number; direction: Vector3 }>;
  cumulative: number[];
  totalLength: number;
};

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
  vehicles?: VehicleDefinition[];
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
  private streetLamps: StreetLamp[] = [];
  private perimeterStreetLamps: StreetLamp[] = [];
  private dayNightCycle?: DayNightCycle;
  private centralPlazaNodes: Array<{ dispose(): void }> = [];

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

  setDayNightCycle(cycle: DayNightCycle | null): void {
    this.dayNightCycle = cycle ?? undefined;
    const lamps = new Set<StreetLamp>([
      ...this.streetLamps,
      ...this.perimeterStreetLamps,
    ]);

    if (!this.dayNightCycle) {
      for (const lamp of lamps) {
        try {
          lamp.setLightOn(false);
        } catch {}
      }
      return;
    }

    for (const lamp of lamps) {
      this.attachLampToCycle(lamp);
    }
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

    // Road material - darker asphalt tone
    const roadMat = new StandardMaterial("roadMat", this.scene);
    roadMat.diffuseColor = new Color3(0.15, 0.15, 0.15);
    this.materials.set("road", roadMat);

    // Cobblestone path material - muted gray-beige
    const cobbleMat = new StandardMaterial("cobbleMat", this.scene);
    cobbleMat.diffuseColor = new Color3(0.6, 0.57, 0.5);
    this.materials.set("cobblestone-path", cobbleMat);

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
      npcSpawns: mapData.spawns.npcs.length,
      vehicles: mapData.vehicles?.length ?? 0
    });

  this.disposeAllStreetLamps();
  this.disposeCentralPlaza();
    // Store map data for later access
    this.mapData = {
      ...mapData,
      vehicles: mapData.vehicles ?? [],
      spawns: mapData.spawns ?? { player: [], npcs: [] },
      buildings: mapData.buildings ?? [],
    };

    // Create default perimeter structures (walls, ground gap, interior road)
  this.buildDefaultPerimeter();
  this.buildCentralPlaza();

    // Build structures
    for (const tile of this.mapData.buildings) {
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
      case "road":
        this.buildRoad(pos, rotation);
        break;
      case "cobblestone-path":
        this.buildCobblestonePath(pos, rotation);
        break;
      case "door":
        this.buildDoor(tile);
        break;
      case "window":
        this.buildWindow(pos, rotation);
        break;
      case "street-lamp":
        this.buildStreetLamp(pos);
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
   * Build a ground surface such as a road or cobblestone path
   */
  private buildSurfaceTile(
    meshPrefix: string,
    position: Vector3,
    widthCells: number,
    depthCells: number,
    materialKey: "road" | "cobblestone-path",
    height: number = 0.1,
    rotation: number = 0
  ): void {
    const surface = MeshBuilder.CreateBox(
      `${meshPrefix}_${position.x}_${position.z}`,
      {
        width: this.config.cellSize * widthCells,
        height,
        depth: this.config.cellSize * depthCells,
      },
      this.scene
    );

    surface.position = position.add(new Vector3(0, height / 2, 0));
    surface.rotation.y = (rotation * Math.PI) / 180;
    surface.material = this.materials.get(materialKey)!;

    surface.physicsImpostor = new PhysicsImpostor(
      surface,
      PhysicsImpostor.BoxImpostor,
      { mass: 0, restitution: 0.05 },
      this.scene
    );
  }

  /**
   * Build a four-by-four road segment
   */
  private buildRoad(position: Vector3, rotation: number = 0): void {
    this.buildSurfaceTile("road", position, 4, 4, "road", 0.08, rotation);
  }

  /**
   * Build a two-by-two cobblestone path segment
   */
  private buildCobblestonePath(position: Vector3, rotation: number = 0): void {
    this.buildSurfaceTile("cobble", position, 2, 2, "cobblestone-path", 0.08, rotation);
  }

  /**
   * Build a door
   */
  private buildDoor(tile: MapTile): void {
    const rotation = ((tile.rotation ?? 0) % 360 + 360) % 360;
    const rotationRad = (rotation * Math.PI) / 180;
    const position = new Vector3(tile.position.x, tile.position.y, tile.position.z);
    const doorCenter = position.add(new Vector3(0, this.config.doorHeight / 2, 0));
    const isXAxisDoor = rotation === 0 || rotation === 180;
    const neighborDelta = isXAxisDoor ? { dx: 1, dy: 0 } : { dx: 0, dy: 1 };
    const hasPositiveNeighbor = this.hasAdjacentDoor(tile, neighborDelta);
    const hasNegativeNeighbor = this.hasAdjacentDoor(tile, { dx: -neighborDelta.dx, dy: -neighborDelta.dy });

    let hingeSide: "negative" | "positive" = "negative";
    if (hasNegativeNeighbor && !hasPositiveNeighbor) {
      hingeSide = "positive";
    } else if (hasPositiveNeighbor && !hasNegativeNeighbor) {
      hingeSide = "negative";
    }

    let swingDirection = 1;
    if (hasPositiveNeighbor !== hasNegativeNeighbor) {
      swingDirection = hingeSide === "negative" ? -1 : 1;
    }

    const halfWidth = this.config.doorWidth / 2;
    const doorOffset = isXAxisDoor
      ? new Vector3(hingeSide === "negative" ? halfWidth : -halfWidth, 0, 0)
      : new Vector3(0, 0, hingeSide === "negative" ? halfWidth : -halfWidth);

    const hingeOffset = Vector3.TransformCoordinates(doorOffset, Matrix.RotationY(rotationRad));
    const hinge = new TransformNode(`door_hinge_${tile.gridPosition.x}_${tile.gridPosition.y}`, this.scene);
    hinge.position = doorCenter.subtract(hingeOffset);
    hinge.rotation.y = rotationRad;

    const door = MeshBuilder.CreateBox(
      `door_${tile.gridPosition.x}_${tile.gridPosition.y}`,
      {
        width: this.config.doorWidth,
        height: this.config.doorHeight,
        depth: this.config.wallThickness * 0.5,
      },
      this.scene
    );

    door.parent = hinge;
    door.position = doorOffset;
    door.material = this.materials.get("door")!;

    // Attach metadata describing hinge behaviour so the DoorSystem can animate correctly
    door.metadata = {
      isDoor: true,
      isOpen: false,
      swingDirection,
      closedRotation: rotationRad,
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

  private buildDefaultPerimeter(): void {
    if (!this.mapData) {
      return;
    }

    const gridSize = this.mapData.metadata.gridSize;
    if (gridSize < 2) {
      return;
    }

    const gapWidth = 1;
  const intendedRoadWidth = 8;
    const interiorExtent = gridSize - 2 * (gapWidth + 1);
    const roadWidth = Math.min(intendedRoadWidth, Math.max(0, interiorExtent));

    const occupied = new Set<string>();
    for (const tile of this.mapData.buildings) {
      if (tile.gridPosition) {
        occupied.add(this.makeGridKey(tile.gridPosition.x, tile.gridPosition.y));
      }
    }

    // Outer perimeter walls
    for (let x = 0; x < gridSize; x++) {
      this.buildPerimeterWallSegment(x, 0, 0, occupied);
      this.buildPerimeterWallSegment(x, gridSize - 1, 0, occupied);
    }
    for (let y = 1; y < gridSize - 1; y++) {
      this.buildPerimeterWallSegment(0, y, 90, occupied);
      this.buildPerimeterWallSegment(gridSize - 1, y, 90, occupied);
    }

    if (gridSize < 3) {
      return;
    }

    const horizontalSpan = gridSize - 2;
    if (horizontalSpan > 0) {
      this.buildPerimeterFloorStrip("perimeter_gap_top", 1, 1, horizontalSpan, 1);
      this.buildPerimeterFloorStrip("perimeter_gap_bottom", 1, gridSize - 2, horizontalSpan, 1);
    }

    const verticalSpan = gridSize - 4;
    if (verticalSpan > 0) {
      this.buildPerimeterFloorStrip("perimeter_gap_left", 1, 2, 1, verticalSpan);
      this.buildPerimeterFloorStrip("perimeter_gap_right", gridSize - 2, 2, 1, verticalSpan);
    }

    if (roadWidth <= 0) {
      return;
    }

    const roadLength = gridSize - 2 * (gapWidth + 1);
    if (roadLength <= 0) {
      return;
    }

    const topRoadStartY = gapWidth + 1;
    const bottomRoadStartY = gridSize - roadWidth - gapWidth - 1;
    const leftRoadStartX = gapWidth + 1;
    const rightRoadStartX = gridSize - roadWidth - gapWidth - 1;

    this.buildPerimeterRoadStrip("perimeter_road_top", leftRoadStartX, topRoadStartY, roadLength, roadWidth);
    this.buildPerimeterRoadStrip("perimeter_road_bottom", leftRoadStartX, bottomRoadStartY, roadLength, roadWidth);

    const verticalRoadHeight = bottomRoadStartY - (topRoadStartY + roadWidth);
    if (verticalRoadHeight <= 0) {
      return;
    }

    this.buildPerimeterRoadStrip("perimeter_road_left", leftRoadStartX, topRoadStartY + roadWidth, roadWidth, verticalRoadHeight);
    this.buildPerimeterRoadStrip("perimeter_road_right", rightRoadStartX, topRoadStartY + roadWidth, roadWidth, verticalRoadHeight);

    const pathNodes = this.createPerimeterPathNodes(
      leftRoadStartX,
      rightRoadStartX,
      topRoadStartY,
      bottomRoadStartY,
      roadWidth
    );

    if (pathNodes) {
      const segmentData = this.computePathSegments(pathNodes);
      if (segmentData) {
        this.ensurePerimeterVehicles(pathNodes, segmentData, roadWidth);
        this.ensurePerimeterStreetLamps(segmentData, roadWidth);
      }
    }
  }

  private buildCentralPlaza(): void {
    if (!this.mapData) {
      return;
    }

    const cellSize = this.mapData.metadata.cellSize ?? this.config.cellSize;
    const plazaSizeCells = 54;
    const plazaSize = plazaSizeCells * cellSize;
    const plazaHalf = plazaSize / 2;
    const contentRadius = plazaHalf + cellSize * 12;

    const hasCustomContent = this.mapData.buildings.some((tile) => {
      const pos = tile.position;
      if (!pos) {
        return false;
      }
      return (
        Math.abs(pos.x) <= contentRadius &&
        Math.abs(pos.z) <= contentRadius
      );
    });

    if (hasCustomContent) {
      return;
    }

    const cobbleMat = this.materials.get("cobblestone-path") ?? this.materials.get("floor");
    try {
      const plaza = MeshBuilder.CreateGround(
        "central_plaza_ground",
        { width: plazaSize, height: plazaSize },
        this.scene
      );
      plaza.position = new Vector3(0, 0.02, 0);
      if (cobbleMat) {
        plaza.material = cobbleMat;
      }
      plaza.checkCollisions = false;
      this.centralPlazaNodes.push(plaza);
    } catch {}
  }


  private buildPerimeterWallSegment(
    gridX: number,
    gridY: number,
    rotation: number,
    occupied: Set<string>
  ): void {
    const key = this.makeGridKey(gridX, gridY);
    if (occupied.has(key)) {
      return;
    }

    const position = this.gridToWorld(gridX, gridY);
    this.buildWall(position, rotation);
  }

  private buildPerimeterFloorStrip(
    name: string,
    startX: number,
    startY: number,
    widthCells: number,
    heightCells: number
  ): void {
    if (!this.mapData || widthCells <= 0 || heightCells <= 0) {
      return;
    }

    const center = this.gridRectToWorld(startX, startY, widthCells, heightCells);
    const cellSize = this.mapData.metadata.cellSize ?? this.config.cellSize;
    const mesh = MeshBuilder.CreateGround(
      `${name}_${startX}_${startY}`,
      { width: widthCells * cellSize, height: heightCells * cellSize },
      this.scene
    );

    mesh.position = center;
    mesh.position.y = 0.01;
    mesh.material = this.materials.get("floor")!;
    mesh.checkCollisions = false;
  }

  private buildPerimeterRoadStrip(
    name: string,
    startX: number,
    startY: number,
    widthCells: number,
    heightCells: number
  ): void {
    if (!this.mapData || widthCells <= 0 || heightCells <= 0) {
      return;
    }

    const center = this.gridRectToWorld(startX, startY, widthCells, heightCells);
    const cellSize = this.mapData.metadata.cellSize ?? this.config.cellSize;
    const mesh = MeshBuilder.CreateGround(
      `${name}_${startX}_${startY}`,
      { width: widthCells * cellSize, height: heightCells * cellSize },
      this.scene
    );

    mesh.position = center;
    mesh.position.y = 0.005;
    mesh.material = this.materials.get("road")!;
    mesh.checkCollisions = false;
  }

  private createPerimeterPathNodes(
    leftRoadStartX: number,
    rightRoadStartX: number,
    topRoadStartY: number,
    bottomRoadStartY: number,
    roadWidth: number
  ): Vector3[] | null {
    if (!this.mapData || roadWidth <= 0) {
      return null;
    }

    const centerOffset = roadWidth / 2 - 0.5;
    const topY = topRoadStartY + centerOffset;
    const bottomY = bottomRoadStartY + centerOffset;
    const leftX = leftRoadStartX + centerOffset;
    const rightX = rightRoadStartX + centerOffset;

    const gridPoints = [
      { x: leftX, y: topY },
      { x: rightX, y: topY },
      { x: rightX, y: bottomY },
      { x: leftX, y: bottomY },
    ];

    const worldPoints = gridPoints.map((point) => this.gridToWorld(point.x, point.y));
    if (!worldPoints.length) {
      return null;
    }

    worldPoints.forEach((vec) => {
      vec.y = 0;
    });

    const first = worldPoints[0].clone();
    worldPoints.push(first);
    return worldPoints;
  }

  private ensurePerimeterVehicles(
    pathNodes: Vector3[],
    segmentData: PathSegmentData,
    roadWidth: number
  ): void {
    if (!this.mapData || pathNodes.length < 2) {
      return;
    }

    if (!segmentData) {
      return;
    }

    const laneOffsetDistance = this.computeLaneOffsetDistance(roadWidth);
    if (!this.mapData.vehicles) {
      this.mapData.vehicles = [];
    }

    const existingIds = new Set(this.mapData.vehicles.map((vehicle) => vehicle.id));
    const pathDefinition = pathNodes.map((node) => ({ x: node.x, y: node.y, z: node.z }));

    const vehicleConfigs = [
      { id: "perimeter_cw_1", color: "#ff8a65", loopOffset: 0, reverse: false, type: "delivery" },
      { id: "perimeter_cw_2", color: "#29b6f6", loopOffset: 0.5, reverse: false, type: "compact" },
      { id: "perimeter_ccw_1", color: "#66bb6a", loopOffset: 0.25, reverse: true, type: "taxi" },
      { id: "perimeter_ccw_2", color: "#ab47bc", loopOffset: 0.75, reverse: true, type: "compact" },
    ];

    for (const config of vehicleConfigs) {
      if (existingIds.has(config.id)) {
        continue;
      }

      const directionalOffset = config.reverse ? -laneOffsetDistance : laneOffsetDistance;
      const sample = this.samplePathPosition(
        segmentData,
        config.loopOffset,
        config.reverse,
        directionalOffset
      );
      const definition: VehicleDefinition = {
        id: config.id,
        type: config.type,
        position: {
          x: sample.position.x,
          y: sample.position.y,
          z: sample.position.z,
        },
        rotation: sample.headingDeg,
        color: config.color,
        speed: 3,
        path: pathDefinition,
        loopOffset: config.loopOffset,
        reverse: config.reverse,
        laneOffset: directionalOffset,
      };

      this.mapData.vehicles.push(definition);
    }
  }

  private ensurePerimeterStreetLamps(segmentData: PathSegmentData, roadWidth: number): void {
    if (!this.mapData) {
      return;
    }

    this.disposePerimeterStreetLamps();

    const cellSize = this.mapData.metadata.cellSize ?? this.config.cellSize;
    const spacingCells = 10;
    const spacingDistance = Math.max(cellSize * 2, spacingCells * cellSize);
    const lateralOffsetCells = Math.max(roadWidth / 2 + 0.6, 1.2);
    const lateralOffset = lateralOffsetCells * cellSize;
    const totalLength = segmentData.totalLength;
    if (totalLength <= 0) {
      return;
    }

    const usedPositions: Vector3[] = [];
    const minSpacing = spacingDistance * 0.6;
    const minSpacingSq = minSpacing * minSpacing;

    const placeLamp = (fraction: number) => {
      const normalized = ((fraction % 1) + 1) % 1;
      const sample = this.samplePathPosition(segmentData, normalized, false, 0);
      if (!sample) {
        return;
      }

      const headingRad = (sample.headingDeg * Math.PI) / 180;
      const forward = new Vector3(Math.sin(headingRad), 0, Math.cos(headingRad));
      if (forward.lengthSquared() <= 0.0001) {
        return;
      }

      const outward = Vector3.Up().cross(forward);
      if (outward.lengthSquared() <= 0.0001) {
        return;
      }

      outward.normalize();
      const worldPosition = sample.position.add(outward.scale(lateralOffset));
      worldPosition.y = 0;

      if (usedPositions.some((existing) => Vector3.DistanceSquared(existing, worldPosition) < minSpacingSq)) {
        return;
      }

      this.createManagedStreetLamp(worldPosition);
      usedPositions.push(worldPosition.clone());
    };

    let distance = spacingDistance * 0.5;
    while (distance < totalLength) {
      placeLamp(distance / totalLength);
      distance += spacingDistance;
    }

    if (usedPositions.length < 4) {
      [0, 0.25, 0.5, 0.75].forEach(placeLamp);
    }
  }

  private computeLaneOffsetDistance(roadWidthCells: number): number {
    if (!this.mapData) {
      return 0;
    }

    if (roadWidthCells <= 2) {
      return 0;
    }

    const cellSize = this.mapData.metadata.cellSize ?? this.config.cellSize;
    const halfWidth = roadWidthCells / 2;
    const maxOffsetCells = Math.max(0, halfWidth - 0.5);
    const desiredOffsetCells = Math.min(roadWidthCells / 4, maxOffsetCells);
    return desiredOffsetCells * cellSize;
  }

  private computePathSegments(points: Vector3[]): PathSegmentData | null {
    if (points.length < 2) {
      return null;
    }

    const segments: Array<{ start: Vector3; end: Vector3; length: number; direction: Vector3 }> = [];
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

  private samplePathPosition(
    segmentData: PathSegmentData,
    loopOffset: number,
    reverse: boolean,
    laneOffsetDistance: number
  ): { position: Vector3; headingDeg: number } {
    if (segmentData.totalLength <= 0 || !segmentData.segments.length) {
      const fallback = segmentData.segments[0]?.start.clone() ?? Vector3.Zero();
      fallback.y = 0;
      return { position: fallback, headingDeg: 0 };
    }

    let progress = loopOffset % 1;
    if (progress < 0) {
      progress += 1;
    }

    let distance = progress * segmentData.totalLength;
    const { segments, cumulative } = segmentData;

    for (let i = 0; i < segments.length; i++) {
      const segStart = cumulative[i];
      const segEnd = cumulative[i + 1];
      if (distance <= segEnd || i === segments.length - 1) {
        const denom = segEnd - segStart;
        const t = denom <= 0 ? 0 : (distance - segStart) / denom;
        const position = Vector3.Lerp(segments[i].start, segments[i].end, t);
        position.y = 0;
        const forward = reverse ? segments[i].direction.scale(-1) : segments[i].direction;
        const heading = Math.atan2(forward.x, forward.z);
        const adjustedPosition = this.applyLaneOffset(position, forward, laneOffsetDistance);
        return { position: adjustedPosition, headingDeg: (heading * 180) / Math.PI };
      }
    }

    const lastSeg = segments[segments.length - 1];
    const dir = reverse ? lastSeg.direction.scale(-1) : lastSeg.direction;
    const adjustedFallback = this.applyLaneOffset(lastSeg.end.clone(), dir, laneOffsetDistance);
    return {
      position: adjustedFallback,
      headingDeg: (Math.atan2(dir.x, dir.z) * 180) / Math.PI,
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
    const adjusted = position.add(offset);
    adjusted.y = position.y;
    return adjusted;
  }

  private makeGridKey(x: number, y: number): string {
    return `${x},${y}`;
  }

  private gridToWorld(gridX: number, gridY: number): Vector3 {
    if (!this.mapData) {
      return Vector3.Zero();
    }

    const cellSize = this.mapData.metadata.cellSize ?? this.config.cellSize;
    const half = this.mapData.metadata.gridSize / 2;
    const worldX = (gridX - half + 0.5) * cellSize;
    const worldZ = (gridY - half + 0.5) * cellSize;
    return new Vector3(worldX, 0, worldZ);
  }

  private worldToGrid(position: Vector3): { x: number; y: number } {
    if (!this.mapData) {
      return { x: 0, y: 0 };
    }

    const cellSize = this.mapData.metadata.cellSize ?? this.config.cellSize;
    const half = this.mapData.metadata.gridSize / 2;
    const gridX = Math.round(position.x / cellSize + half - 0.5);
    const gridY = Math.round(position.z / cellSize + half - 0.5);
    return { x: gridX, y: gridY };
  }

  private gridRectToWorld(
    startX: number,
    startY: number,
    widthCells: number,
    heightCells: number
  ): Vector3 {
    const centerX = startX + widthCells / 2 - 0.5;
    const centerY = startY + heightCells / 2 - 0.5;
    return this.gridToWorld(centerX, centerY);
  }

  private hasAdjacentDoor(tile: MapTile, delta: { dx: number; dy: number }): boolean {
    if (!this.mapData || !tile.gridPosition) {
      return false;
    }

    const rotation = ((tile.rotation ?? 0) % 360 + 360) % 360;
    const targetX = tile.gridPosition.x + delta.dx;
    const targetY = tile.gridPosition.y + delta.dy;

    return this.mapData.buildings.some((other) => {
      if (other === tile || other.type !== "door" || !other.gridPosition) {
        return false;
      }
      if (other.gridPosition.x !== targetX || other.gridPosition.y !== targetY) {
        return false;
      }
      const otherRotation = ((other.rotation ?? 0) % 360 + 360) % 360;
      return otherRotation === rotation;
    });
  }

  /**
   * Build a street lamp at the specified grid position
   */
  private buildStreetLamp(position: Vector3): void {
    const lamp = new StreetLamp(this.scene, position);
    this.attachLampToCycle(lamp);
    this.streetLamps.push(lamp);
  }

  private createManagedStreetLamp(position: Vector3): void {
    try {
      const lamp = new StreetLamp(this.scene, position.clone());
      this.attachLampToCycle(lamp);
      this.streetLamps.push(lamp);
      this.perimeterStreetLamps.push(lamp);
    } catch (error) {
      logger.warn("Failed to create perimeter street lamp", { position, error });
    }
  }

  private attachLampToCycle(lamp: StreetLamp): void {
    if (!this.dayNightCycle) {
      lamp.setLightOn(false);
      return;
    }

    try {
      lamp.attachToCycle(this.dayNightCycle);
      const state = this.dayNightCycle.getLastState();
      if (state) {
        lamp.setLightOn(!state.isDay);
      }
    } catch {}
  }

  private disposeAllStreetLamps(): void {
    if (!this.streetLamps.length && !this.perimeterStreetLamps.length) {
      return;
    }

    const uniqueLamps = new Set<StreetLamp>([
      ...this.streetLamps,
      ...this.perimeterStreetLamps,
    ]);

    for (const lamp of uniqueLamps) {
      try {
        lamp.dispose();
      } catch {}
    }

    this.streetLamps = [];
    this.perimeterStreetLamps = [];
  }

  private disposePerimeterStreetLamps(): void {
    if (!this.perimeterStreetLamps.length) {
      return;
    }

    const removal = new Set(this.perimeterStreetLamps);
    for (const lamp of this.perimeterStreetLamps) {
      try {
        lamp.dispose();
      } catch {}
    }
    this.perimeterStreetLamps = [];
    if (this.streetLamps.length && removal.size) {
      this.streetLamps = this.streetLamps.filter((lamp) => !removal.has(lamp));
    }
  }

  private disposeCentralPlaza(): void {
    if (!this.centralPlazaNodes.length) {
      return;
    }

    for (const node of this.centralPlazaNodes) {
      try {
        node.dispose();
      } catch {}
    }
    this.centralPlazaNodes = [];
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
   * Get vehicle definitions from map data
   */
  getVehicles(): VehicleDefinition[] {
    if (!this.mapData) {
      logger.warn("No map data loaded, returning empty vehicles");
      return [];
    }
    return this.mapData.vehicles ?? [];
  }

  /**
   * Dispose of all resources
   */
  dispose(): void {
    this.disposeAllStreetLamps();
    this.disposeCentralPlaza();
    this.materials.forEach((mat) => mat.dispose());
    this.materials.clear();
  }
}

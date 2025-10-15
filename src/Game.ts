import { Engine } from "@babylonjs/core/Engines/engine";
import { Scene } from "@babylonjs/core/scene";
import { FreeCamera } from "@babylonjs/core/Cameras/freeCamera";
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Color3, Color4 } from "@babylonjs/core/Maths/math.color";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { PhysicsImpostor } from "@babylonjs/core/Physics/physicsImpostor";
import { CannonJSPlugin } from "@babylonjs/core/Physics/Plugins/cannonJSPlugin";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import * as CANNON from "cannon-es";

import { FirstPersonController } from "./controllers/firstPersonController";
import { LoopManager } from "./systems/loopManager";
import DayNightCycle from "./systems/dayNightCycle";
import DoorSystem from "./systems/doorSystem";
import { HourlyCycle } from "./systems/hourlyCycle";
import { NpcSystem } from "./systems/npcSystem";
import { SystemManager } from "./systems/SystemManager";
import HUD from "./ui/hud";
import { Logger } from "./utils/logger";
import { registerDebugShortcuts } from "./debug/debugControls";
import { GameConfig, DEFAULT_CONFIG, createConfig } from "./config/gameConfig";
import { ContentLoader } from "./content/ContentLoader";
import type { LoopEventDefinition } from "./content/schemas";

const logger = Logger.create("Game");

/**
 * Main Game class that encapsulates all game state and systems.
 * 
 * Benefits:
 * - No global state pollution
 * - Testable (can create multiple instances)
 * - Clear lifecycle (init, start, dispose)
 * - Centralized configuration
 * 
 * Usage:
 *   const game = new Game(canvas, config);
 *   await game.init();
 *   game.start();
 *   // ... later
 *   game.dispose();
 */
export class Game {
  // Core Babylon.js objects
  private engine: Engine;
  private scene: Scene;
  private camera: FreeCamera;
  private light: HemisphericLight;
  
  // Game systems
  private systemManager: SystemManager;
  private fpController: FirstPersonController;
  private loopManager: LoopManager;
  private dayNightCycle: DayNightCycle;
  private doorSystem: DoorSystem;
  private hourlyCycle: HourlyCycle;
  private npcSystem: NpcSystem;
  private hud: HUD;
  private contentLoader: ContentLoader;
  
  // State
  private isRunning = false;
  private config: GameConfig;

  constructor(
    private canvas: HTMLCanvasElement,
    config: Partial<GameConfig> = {}
  ) {
    // Merge with defaults
    this.config = createConfig(config);

    logger.info("Game instance created", { config: this.config });

    // Create engine with preserveDrawingBuffer for screenshot support
    // This prevents WebGL from clearing the drawing buffer after each frame,
    // which is required for canvas.toDataURL() and Tools.CreateScreenshot()
    // to capture actual rendered content instead of blank/black images.
    // Performance impact is negligible on modern GPUs (~2-4 MB extra memory).
    this.engine = new Engine(this.canvas, true, {
      preserveDrawingBuffer: true, // Required for photo capture feature
      stencil: true,
    });
    
    // Create scene
    this.scene = new Scene(this.engine);
    this.scene.clearColor = new Color4(0.02, 0.04, 0.12, 1.0); // night sky
    
    // Will be initialized in init()
    this.camera = null!;
    this.light = null!;
    this.systemManager = null!;
    this.fpController = null!;
    this.loopManager = null!;
    this.dayNightCycle = null!;
    this.doorSystem = null!;
    this.hourlyCycle = null!;
    this.npcSystem = null!;
    this.hud = null!;
    this.contentLoader = null!;
  }

  /**
   * Initialize all game systems and load assets.
   * Must be called before start().
   */
  async init(): Promise<void> {
    logger.info("Initializing game...");

    // Setup physics
    this.initPhysics();

    // Setup camera (position will be updated after world loads)
    this.initCamera();

    // Setup lighting
    this.initLighting();

    // Initialize content loader
    this.contentLoader = new ContentLoader('/data');

    // Create simple ground
    this.createGround();

    // Setup player
    this.initPlayer();

    // Initialize systems
    this.initSystems();

    // Setup day/night cycle and ambient lighting
    await this.setupDayNightCycle();

    // Start HUD
    this.initHUD();

    // Setup debug shortcuts
    this.initDebugShortcuts();

    logger.info("Game initialization complete");
  }

  /**
   * Start the game render loop.
   * Must call init() first.
   */
  start(): void {
    if (this.isRunning) {
      logger.warn("Game already running");
      return;
    }

    logger.info("Starting game loop");
    this.isRunning = true;

    // Start time loop
    this.loopManager.start();

    // Run render loop
    this.engine.runRenderLoop(() => {
      const deltaSeconds = this.engine.getDeltaTime() / 1000;
      
      // Update all systems
      this.systemManager.update(deltaSeconds);
      
      // Update player movement
      this.fpController.update();
      
      // Render
      this.scene.render();
      
      // Update FPS in title
      document.title = `Babylon FP — ${this.engine.getFps().toFixed(0)} FPS`;
    });

    // Handle window resize
    window.addEventListener("resize", this.onResize);
  }

  /**
   * Stop the game and clean up all resources.
   */
  dispose(): void {
    logger.info("Disposing game");

    this.isRunning = false;

    // Remove event listeners
    window.removeEventListener("resize", this.onResize);

    // Dispose systems
    if (this.systemManager) {
      this.systemManager.dispose();
    }

    // Dispose HUD
    if (this.hud) {
      this.hud.dispose();
    }

    // Dispose Babylon.js objects
    if (this.scene) {
      this.scene.dispose();
    }
    if (this.engine) {
      this.engine.dispose();
    }

    logger.info("Game disposed");
  }

  /**
   * Get the Babylon.js scene for debugging or advanced use.
   */
  getScene(): Scene {
    return this.scene;
  }

  /**
   * Get the system manager for accessing individual systems.
   */
  getSystemManager(): SystemManager {
    return this.systemManager;
  }

  // =====================
  // Private Init Methods
  // =====================

  private initPhysics(): void {
    const gravityVector = new Vector3(0, -9.81, 0);
    const physicsPlugin = new CannonJSPlugin(true, 10, CANNON);
    this.scene.enablePhysics(gravityVector, physicsPlugin);
    logger.debug("Physics initialized");
  }

  private initCamera(): void {
    this.camera = new FreeCamera("camera1", new Vector3(0, 1.7, -5), this.scene);
    this.camera.setTarget(new Vector3(0, 1.7, 0));
    this.camera.attachControl(this.canvas, true);
    this.camera.applyGravity = true;
    this.camera.checkCollisions = true;
    this.camera.ellipsoid = new Vector3(0.5, 0.85, 0.5);
    this.camera.minZ = 0.1;
    logger.debug("Camera initialized");
  }

  private initLighting(): void {
    this.light = new HemisphericLight("light1", new Vector3(0, 1, 0), this.scene);
    this.light.intensity = 0.12; // start with night intensity
    logger.debug("Lighting initialized");
  }

  /**
   * Create a simple 500x500 green ground
   */
  private createGround(): void {
    const ground = MeshBuilder.CreateGround(
      "ground",
      { width: 500, height: 500 },
      this.scene
    );
    
    // Create green material
    const groundMaterial = new StandardMaterial("groundMat", this.scene);
    groundMaterial.diffuseColor = new Color3(0.2, 0.8, 0.3); // Green color
    ground.material = groundMaterial;
    
    // Add physics
    ground.physicsImpostor = new PhysicsImpostor(
      ground,
      PhysicsImpostor.BoxImpostor,
      { mass: 0, restitution: 0.1 },
      this.scene
    );
    
    logger.debug("Ground created: 500x500 green floor");
  }

  /**
   * Load NPCs from JSON files using ContentLoader
   * Currently disabled - no NPCs in the world
   */
  private async loadNpcsFromJson(): Promise<void> {
    // NPCs have been removed from the world
    logger.info("NPC loading skipped - world reset to empty state");
  }

  private initPlayer(): void {
    // Create invisible player collider
    const playerCollider = MeshBuilder.CreateSphere(
      "playerCollider",
      { diameter: 1.5 },
      this.scene
    );
    playerCollider.position = new Vector3(0, 1.7, -5);
    playerCollider.isVisible = false;
    playerCollider.physicsImpostor = new PhysicsImpostor(
      playerCollider,
      PhysicsImpostor.SphereImpostor,
      { mass: 1, friction: 0.5, restitution: 0 },
      this.scene
    );

    // Create first-person controller
    this.fpController = new FirstPersonController(
      this.camera,
      this.canvas,
      { speed: 3, mouseSensitivity: 0.002, physicsMesh: playerCollider }
    );

    logger.debug("Player initialized");
  }

  private initSystems(): void {
    // Create system manager
    this.systemManager = new SystemManager(this.scene);

    // Create and register loop manager
    this.loopManager = new LoopManager(this.scene, this.config.loop.durationSec, this.config.loop.timeScale);
    this.systemManager.register("loopManager", this.loopManager);

    // Create and register door system
    this.doorSystem = new DoorSystem(this.scene, this.camera);
    this.systemManager.register("doorSystem", this.doorSystem);

    logger.debug("Systems initialized");
  }

  private async setupDayNightCycle(): Promise<void> {
    // Create day/night cycle
    this.dayNightCycle = new DayNightCycle(this.scene, {
      dayMs: this.config.dayNight.dayMs,
      nightMs: this.config.dayNight.nightMs,
      sunIntensity: this.config.dayNight.sunIntensity,
      moonIntensity: this.config.dayNight.moonIntensity,
    });

    // Create hourly cycle
    this.hourlyCycle = new HourlyCycle(
      this.dayNightCycle,
      this.config.dayNight.dayMs + this.config.dayNight.nightMs
    );

    // Create NPC system
    this.npcSystem = new NpcSystem(this.scene, this.hourlyCycle);
    
    // Load NPCs from JSON
    await this.loadNpcsFromJson();

    // Street lamps removed - world reset to empty state

    // Sync ambient light to day/night cycle
    this.dayNightCycle.onTick((state: any) => {
      try {
        const base = 0.12;
        const amplitude = 1.0 - base;
        const nightSky = { r: 0.02, g: 0.04, b: 0.12 };
        const daySky = { r: 0.53, g: 0.81, b: 0.92 };
        let skyFactor = 0;

        if (state.isDay) {
          const p = Math.max(0, Math.min(1, state.dayProgress));
          let brightnessNorm = 0;

          if (p <= 0.1) {
            const t = p / 0.1;
            brightnessNorm = 0.9 * Math.sqrt(t);
          } else if (p <= 0.5) {
            const t = (p - 0.1) / 0.4;
            brightnessNorm = 0.9 + (1.0 - 0.9) * t;
          } else if (p <= 0.9) {
            const t = (p - 0.5) / 0.4;
            brightnessNorm = 1.0 - (1.0 - 0.9) * t;
          } else {
            const t = (p - 0.9) / 0.1;
            brightnessNorm = 0.9 * (1.0 - t);
          }

          brightnessNorm = Math.max(0, Math.min(1, brightnessNorm));
          this.light.intensity = base + amplitude * brightnessNorm;
          skyFactor = brightnessNorm;
        } else {
          const p = Math.max(0, Math.min(1, state.nightProgress));
          let moonNorm = 0;

          if (p <= 0.1) {
            const t = p / 0.1;
            moonNorm = 0.9 * Math.sqrt(t);
          } else if (p <= 0.5) {
            const t = (p - 0.1) / 0.4;
            moonNorm = 0.9 + (1.0 - 0.9) * t;
          } else if (p <= 0.9) {
            const t = (p - 0.5) / 0.4;
            moonNorm = 1.0 - (1.0 - 0.9) * t;
          } else {
            const t = (p - 0.9) / 0.1;
            moonNorm = 0.9 * (1.0 - t);
          }

          moonNorm = Math.max(0, Math.min(1, moonNorm));
          const nightMax = 0.3;
          this.light.intensity = base + (nightMax - base) * moonNorm;
          skyFactor = 0;
        }

        const r = nightSky.r * (1 - skyFactor) + daySky.r * skyFactor;
        const g = nightSky.g * (1 - skyFactor) + daySky.g * skyFactor;
        const b = nightSky.b * (1 - skyFactor) + daySky.b * skyFactor;
        this.scene.clearColor = new Color4(r, g, b, 1.0);
      } catch (error) {
        logger.warn("Day/night cycle tick error", { error });
      }
    });

    logger.debug("Day/night cycle setup complete");
  }

  private initHUD(): void {
    this.hud = new HUD(this.scene, {
      dayMs: this.config.dayNight.dayMs,
      nightMs: this.config.dayNight.nightMs,
      sunImagePath: "/assets/ui/sun.png",
      moonImagePath: "/assets/ui/moon.png",
      cycle: this.dayNightCycle,
    });
    this.hud.start();
    logger.debug("HUD initialized");
  }

  private initDebugShortcuts(): void {
    try {
      registerDebugShortcuts();
      logger.debug("Debug shortcuts registered");
    } catch (error) {
      logger.warn("Failed to register debug shortcuts", { error });
    }
  }

  private onResize = (): void => {
    this.engine.resize();
  };
}

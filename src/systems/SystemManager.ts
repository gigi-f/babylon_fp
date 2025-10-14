import type { Scene } from "@babylonjs/core/scene";
import { Logger } from "../utils/logger";

const logger = Logger.create("SystemManager");

/**
 * Base interface that all managed systems should implement.
 * Systems with update loops should implement update().
 * Systems that need cleanup should implement dispose().
 */
export interface ISystem {
  /** Optional: called every frame with delta time in seconds */
  update?(deltaSeconds: number): void;
  /** Optional: cleanup resources when system is destroyed */
  dispose?(): void;
}

/**
 * Centralized manager for all game systems.
 * Handles registration, update propagation, and cleanup.
 * 
 * Benefits:
 * - Single source of truth for active systems
 * - Easy to add/remove systems dynamically
 * - Centralized lifecycle management
 * - Testable system composition
 */
export class SystemManager {
  private systems = new Map<string, ISystem>();
  private updateSystems: Array<{ name: string; system: ISystem }> = [];

  constructor(private scene: Scene) {
    logger.info("SystemManager initialized");
  }

  /**
   * Register a new system with a unique name.
   * Systems with an update() method are automatically added to the update loop.
   */
  register(name: string, system: ISystem): void {
    if (this.systems.has(name)) {
      logger.warn(`System '${name}' already registered, replacing`, { name });
    }

    this.systems.set(name, system);
    
    // Add to update list if it has an update method
    if (typeof system.update === "function") {
      this.updateSystems.push({ name, system });
      logger.debug(`System '${name}' registered with update loop`, { name });
    } else {
      logger.debug(`System '${name}' registered (no update)`, { name });
    }
  }

  /**
   * Get a registered system by name.
   * Returns undefined if not found.
   */
  get<T extends ISystem>(name: string): T | undefined {
    return this.systems.get(name) as T | undefined;
  }

  /**
   * Check if a system is registered.
   */
  has(name: string): boolean {
    return this.systems.has(name);
  }

  /**
   * Unregister a system and dispose it if it has a dispose method.
   */
  unregister(name: string): void {
    const system = this.systems.get(name);
    if (!system) {
      logger.warn(`System '${name}' not found, cannot unregister`, { name });
      return;
    }

    // Remove from update list
    this.updateSystems = this.updateSystems.filter((s) => s.name !== name);

    // Dispose if possible
    if (typeof system.dispose === "function") {
      try {
        system.dispose();
        logger.debug(`System '${name}' disposed`, { name });
      } catch (error) {
        logger.error(`Failed to dispose system '${name}'`, { name, error });
      }
    }

    this.systems.delete(name);
    logger.info(`System '${name}' unregistered`, { name });
  }

  /**
   * Update all systems that have an update() method.
   * Called once per frame.
   */
  update(deltaSeconds: number): void {
    for (const { name, system } of this.updateSystems) {
      try {
        system.update!(deltaSeconds);
      } catch (error) {
        logger.error(`System '${name}' update failed`, { name, deltaSeconds, error });
      }
    }
  }

  /**
   * Dispose all systems and clear the registry.
   * Called when shutting down the game.
   */
  dispose(): void {
    logger.info("Disposing all systems", { count: this.systems.size });

    // Dispose in reverse registration order (safer for dependencies)
    const systemNames = Array.from(this.systems.keys()).reverse();
    for (const name of systemNames) {
      this.unregister(name);
    }

    this.systems.clear();
    this.updateSystems = [];
  }

  /**
   * Get all registered system names.
   */
  getSystemNames(): string[] {
    return Array.from(this.systems.keys());
  }

  /**
   * Get count of registered systems.
   */
  getSystemCount(): number {
    return this.systems.size;
  }
}

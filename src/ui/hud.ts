/**
 * HUD - Heads-Up Display
 * 
 * Displays game time, day/night state, and time indicator on screen.
 * Refactored to class-based architecture for better encapsulation and testability.
 */

import { Scene } from "@babylonjs/core";
import { AdvancedDynamicTexture, Rectangle, Image, TextBlock, Control } from "@babylonjs/gui";
import DayNightCycle, { DayNightState } from "../systems/dayNightCycle";
import HourlyCycle from "../systems/hourlyCycle";
import { Logger } from "../utils/logger";

const logger = Logger.create('HUD');

/**
 * Configuration options for the HUD
 */
export interface HUDOptions {
  /** Day duration in milliseconds */
  dayMs?: number;
  /** Night duration in milliseconds */
  nightMs?: number;
  /** Path to sun image */
  sunImagePath?: string;
  /** Path to moon image */
  moonImagePath?: string;
  /** DayNightCycle instance for synchronization */
  cycle?: DayNightCycle;
  /** Track width in pixels */
  trackWidth?: number;
  /** Icon size in pixels */
  iconSize?: number;
}

/**
 * HUD class for managing the heads-up display
 */
export class HUD {
  private scene: Scene;
  private options: Required<Omit<HUDOptions, 'cycle'>> & Pick<HUDOptions, 'cycle'>;
  
  // UI elements
  private ui: AdvancedDynamicTexture | null = null;
  private container: Rectangle | null = null;
  private timerText: TextBlock | null = null;
  private stateText: TextBlock | null = null;
  private pauseText: TextBlock | null = null;
  private trackRect: Rectangle | null = null;
  private sunImage: Image | null = null;
  private sunFallback: Rectangle | null = null;
  private moonImage: Image | null = null;
  private moonFallback: Rectangle | null = null;
  
  // State
  private startTimestamp: number = Date.now();
  private onBeforeRenderObserver: any = null;
  private hourlyCycle: HourlyCycle | null = null;
  private isInitialized: boolean = false;

  constructor(scene: Scene, options: HUDOptions = {}) {
    this.scene = scene;
    
    // Merge with defaults
    this.options = {
      dayMs: options.dayMs ?? 60_000,
      nightMs: options.nightMs ?? 60_000,
      sunImagePath: options.sunImagePath ?? "/assets/ui/sun.png",
      moonImagePath: options.moonImagePath ?? "/assets/ui/moon.png",
      trackWidth: options.trackWidth ?? 360,
      iconSize: options.iconSize ?? 28,
      cycle: options.cycle,
    };

    logger.debug('HUD created', { options: this.options });
  }

  /**
   * Initialize and start the HUD
   */
  start(): void {
    if (this.isInitialized) {
      logger.warn('HUD already initialized');
      return;
    }

    this.startTimestamp = Date.now();
    
    this.createUI();
    this.setupCycleSubscription();
    
    this.isInitialized = true;
    logger.info('HUD started');
  }

  /**
   * Create all UI elements
   */
  private createUI(): void {
    this.ui = AdvancedDynamicTexture.CreateFullscreenUI("HUD");

    // Top bar container
    this.container = new Rectangle("hud_container");
    this.container.height = "72px";
    this.container.thickness = 0;
    this.container.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
    this.container.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
    this.container.background = "rgba(0,0,0,0.12)";
    this.container.width = "100%";
    this.ui.addControl(this.container);

    // Timer text (left)
    this.timerText = new TextBlock("hud_timer");
    this.timerText.text = "0:00";
    this.timerText.color = "white";
    this.timerText.fontSize = 20;
    this.timerText.width = "120px";
    this.timerText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    this.timerText.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    this.timerText.paddingLeft = "12px";
    this.container.addControl(this.timerText);

    // Track (center)
    this.trackRect = new Rectangle("hud_track");
    this.trackRect.width = `${this.options.trackWidth}px`;
    this.trackRect.height = "8px";
    this.trackRect.background = "rgba(255,255,255,0.12)";
    this.trackRect.thickness = 0;
    this.trackRect.cornerRadius = 4;
    this.trackRect.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
    this.trackRect.verticalAlignment = Control.VERTICAL_ALIGNMENT_CENTER;
    this.container.addControl(this.trackRect);

    // Sun image with fallback
    this.createSunIcon();
    
    // Moon image with fallback
    this.createMoonIcon();

    // State text (right)
    this.stateText = new TextBlock("hud_state");
    this.stateText.text = "Day";
    this.stateText.color = "white";
    this.stateText.fontSize = 18;
    this.stateText.width = "120px";
    this.stateText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
    this.stateText.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
    this.stateText.paddingRight = "12px";
    this.container.addControl(this.stateText);

    // Pause indicator (center, initially hidden)
    this.pauseText = new TextBlock("hud_pause");
    this.pauseText.text = "⏸ PAUSED";
    this.pauseText.color = "white";
    this.pauseText.fontSize = 32;
    this.pauseText.fontWeight = "bold";
    this.pauseText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
    this.pauseText.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
    this.pauseText.verticalAlignment = Control.VERTICAL_ALIGNMENT_CENTER;
    this.pauseText.top = "100px"; // Below the top bar
    this.pauseText.shadowColor = "black";
    this.pauseText.shadowBlur = 10;
    this.pauseText.shadowOffsetX = 2;
    this.pauseText.shadowOffsetY = 2;
    this.pauseText.isVisible = false;
    this.ui.addControl(this.pauseText);
  }

  /**
   * Create sun icon with image and fallback
   */
  private createSunIcon(): void {
    const size = this.options.iconSize;
    const initialLeft = -this.options.trackWidth / 2 - size;

    // Sun image
    this.sunImage = new Image("hud_sun", this.options.sunImagePath);
    this.sunImage.width = `${size}px`;
    this.sunImage.height = `${size}px`;
    this.sunImage.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
    this.sunImage.verticalAlignment = Control.VERTICAL_ALIGNMENT_CENTER;
    this.sunImage.isPointerBlocker = false;
    this.sunImage.left = `${initialLeft}px`;
    this.trackRect!.addControl(this.sunImage);

    // Sun fallback (circle)
    this.sunFallback = new Rectangle("hud_sun_fallback");
    this.sunFallback.width = `${size}px`;
    this.sunFallback.height = `${size}px`;
    this.sunFallback.cornerRadius = size / 2;
    this.sunFallback.background = "#FFD166";
    this.sunFallback.thickness = 0;
    this.sunFallback.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
    this.sunFallback.verticalAlignment = Control.VERTICAL_ALIGNMENT_CENTER;
    this.sunFallback.isVisible = false;
    this.trackRect!.addControl(this.sunFallback);

    // Setup image load handlers
    this.setupImageHandlers(this.sunImage, this.sunFallback);
  }

  /**
   * Create moon icon with image and fallback
   */
  private createMoonIcon(): void {
    const size = this.options.iconSize;
    const initialLeft = -this.options.trackWidth / 2 - size;

    // Moon image
    this.moonImage = new Image("hud_moon", this.options.moonImagePath);
    this.moonImage.width = `${size}px`;
    this.moonImage.height = `${size}px`;
    this.moonImage.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
    this.moonImage.verticalAlignment = Control.VERTICAL_ALIGNMENT_CENTER;
    this.moonImage.isPointerBlocker = false;
    this.moonImage.left = `${initialLeft}px`;
    this.moonImage.isVisible = false;
    this.trackRect!.addControl(this.moonImage);

    // Moon fallback (circle)
    this.moonFallback = new Rectangle("hud_moon_fallback");
    this.moonFallback.width = `${size}px`;
    this.moonFallback.height = `${size}px`;
    this.moonFallback.cornerRadius = size / 2;
    this.moonFallback.background = "#AAB7FF";
    this.moonFallback.thickness = 0;
    this.moonFallback.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
    this.moonFallback.verticalAlignment = Control.VERTICAL_ALIGNMENT_CENTER;
    this.moonFallback.isVisible = false;
    this.trackRect!.addControl(this.moonFallback);

    // Setup image load handlers
    this.setupImageHandlers(this.moonImage, this.moonFallback);
  }

  /**
   * Setup image load/error handlers
   */
  private setupImageHandlers(image: Image, fallback: Rectangle): void {
    try {
      (image as any).onImageLoadedObservable?.addOnce(() => {
        image.isVisible = true;
        fallback.isVisible = false;
        logger.debug('Image loaded successfully', { name: image.name });
      });
      
      (image as any).onImageErrorObservable?.addOnce(() => {
        image.isVisible = false;
        fallback.isVisible = true;
        logger.warn('Image load failed, using fallback', { name: image.name });
      });
    } catch (e) {
      // If observables not present, use fallback
      image.isVisible = false;
      fallback.isVisible = true;
      logger.warn('Image observables not available, using fallback', { name: image.name });
    }
  }

  /**
   * Setup cycle subscription for time updates
   */
  private setupCycleSubscription(): void {
    if (this.options.cycle) {
      this.setupCycleBasedUpdates();
    } else {
      this.setupFallbackUpdates();
    }
  }

  /**
   * Setup updates using DayNightCycle
   */
  private setupCycleBasedUpdates(): void {
    const cycle = this.options.cycle!;
    const totalMs = this.options.dayMs + this.options.nightMs;

    try {
      // Use HourlyCycle for better time display
      this.hourlyCycle = new HourlyCycle(cycle, totalMs);
      
      this.onBeforeRenderObserver = this.hourlyCycle.onTick((info, state) => {
        this.updateWithHourlyCycle(info, state);
      });
      
      logger.debug('Using HourlyCycle for updates');
    } catch (e) {
      logger.warn('Failed to create HourlyCycle, trying direct subscription', { error: e });
      
      try {
        // Fallback to direct cycle subscription
        this.onBeforeRenderObserver = cycle.onTick((state: DayNightState) => {
          this.updateWithDayNightState(state);
        });
        
        logger.debug('Using direct cycle subscription for updates');
      } catch (e2) {
        logger.warn('Failed to subscribe to cycle, using scene observable', { error: e2 });
        
        // Final fallback to scene observable
        this.setupFallbackUpdates();
      }
    }
  }

  /**
   * Setup fallback updates using scene observable
   */
  private setupFallbackUpdates(): void {
    const totalMs = this.options.dayMs + this.options.nightMs;
    
    this.onBeforeRenderObserver = this.scene.onBeforeRenderObservable.add(() => {
      const now = Date.now();
      const elapsedInLoop = (now - this.startTimestamp) % totalMs;
      const isDay = elapsedInLoop < this.options.dayMs;
      
      // Format timer
      const displayMs = isDay ? elapsedInLoop : elapsedInLoop - this.options.dayMs;
      const displaySec = Math.floor(displayMs / 1000);
      const mm = Math.floor(displaySec / 60);
      const ss = displaySec % 60;
      
      this.timerText!.text = `${mm}:${ss.toString().padStart(2, "0")}`;
      this.stateText!.text = isDay ? "Day" : "Night";
      
      // Update icon positions
      if (isDay) {
        const dayProgress = elapsedInLoop / this.options.dayMs;
        this.updateDayIcon(dayProgress);
      } else {
        const nightProgress = (elapsedInLoop - this.options.dayMs) / this.options.nightMs;
        this.updateNightIcon(nightProgress);
      }
    });
    
    logger.debug('Using fallback scene-based updates');
  }

  /**
   * Update HUD with HourlyCycle info
   */
  private updateWithHourlyCycle(info: any, state: DayNightState): void {
    const isDay = state.isDay;
    
    // Compute 12-hour time (6:00 AM start)
    const hour24 = ((6 + info.hourIndex) % 24 + 24) % 24;
    const displayHour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
    const ampm = hour24 < 12 ? "AM" : "PM";
    const mmVal = Math.floor(info.hourProgress * 60);
    
    this.timerText!.text = `${displayHour12}:${mmVal.toString().padStart(2, "0")} ${ampm}`;
    this.stateText!.text = isDay ? "Day" : "Night";
    
    // Update icon positions
    if (isDay) {
      this.updateDayIcon(state.dayProgress);
    } else {
      this.updateNightIcon(state.nightProgress);
    }
  }

  /**
   * Update HUD with DayNightState
   */
  private updateWithDayNightState(state: DayNightState): void {
    const isDay = state.isDay;
    const mm = Math.floor(state.displaySec / 60);
    
    this.timerText!.text = `${mm}`;
    this.stateText!.text = isDay ? "Day" : "Night";
    
    // Update icon positions
    if (isDay) {
      this.updateDayIcon(state.dayProgress);
    } else {
      this.updateNightIcon(state.nightProgress);
    }
  }

  /**
   * Update day icon position
   */
  private updateDayIcon(progress: number): void {
    const leftPx = progress * this.options.trackWidth - this.options.trackWidth / 2;
    const ctrl = this.sunImage?.isVisible ? this.sunImage! : this.sunFallback!;
    
    ctrl.left = `${leftPx}px`;
    this.sunImage!.isVisible = true;
    this.sunFallback!.isVisible = !this.sunImage!.isVisible;
    this.moonImage!.isVisible = false;
    this.moonFallback!.isVisible = false;
  }

  /**
   * Update night icon position
   */
  private updateNightIcon(progress: number): void {
    const leftPx = progress * this.options.trackWidth - this.options.trackWidth / 2;
    const ctrl = this.moonImage?.isVisible ? this.moonImage! : this.moonFallback!;
    
    ctrl.left = `${leftPx}px`;
    this.moonImage!.isVisible = true;
    this.moonFallback!.isVisible = !this.moonImage!.isVisible;
    this.sunImage!.isVisible = false;
    this.sunFallback!.isVisible = false;
  }

  /**
   * Stop and dispose the HUD
   */
  dispose(): void {
    if (!this.isInitialized) {
      return;
    }

    logger.debug('Disposing HUD');

    // Dispose hourly cycle
    if (this.hourlyCycle) {
      try {
        this.hourlyCycle.dispose();
      } catch (e) {
        logger.warn('Error disposing hourlyCycle', { error: e });
      }
      this.hourlyCycle = null;
    }

    // Remove observer
    if (this.onBeforeRenderObserver) {
      try {
        if (this.scene?.onBeforeRenderObservable && 
            typeof (this.scene as any).onBeforeRenderObservable.remove === 'function') {
          this.scene.onBeforeRenderObservable.remove(this.onBeforeRenderObserver);
        } else if (typeof this.onBeforeRenderObserver === 'function') {
          // Unsubscribe function from cycle
          this.onBeforeRenderObserver();
        }
      } catch (e) {
        logger.warn('Error removing observer', { error: e });
      }
      this.onBeforeRenderObserver = null;
    }

    // Dispose UI
    if (this.ui) {
      try {
        this.ui.getChildren().forEach((c) => this.ui!.removeControl(c));
        this.ui.dispose();
      } catch (e) {
        logger.warn('Error disposing UI', { error: e });
      }
    }

    // Clear references
    this.ui = null;
    this.container = null;
    this.timerText = null;
    this.stateText = null;
    this.trackRect = null;
    this.sunImage = null;
    this.sunFallback = null;
    this.moonImage = null;
    this.moonFallback = null;
    
    this.isInitialized = false;
    logger.info('HUD disposed');
  }

  /**
   * Check if HUD is initialized
   */
  isActive(): boolean {
    return this.isInitialized;
  }

  /**
   * Show or hide the pause indicator
   */
  setPauseVisible(visible: boolean): void {
    if (this.pauseText) {
      this.pauseText.isVisible = visible;
    }
  }

  /**
   * Update HUD options (requires restart)
   */
  updateOptions(options: Partial<HUDOptions>): void {
    if (this.isInitialized) {
      logger.warn('Cannot update options while HUD is active. Dispose first.');
      return;
    }
    
    Object.assign(this.options, options);
    logger.debug('HUD options updated', { options: this.options });
  }
}

// Legacy function-based API for backward compatibility
let globalHUDInstance: HUD | null = null;

/**
 * @deprecated Use `new HUD(scene, options).start()` instead
 */
export function start(scene: Scene, options?: HUDOptions): void {
  if (globalHUDInstance) {
    logger.warn('HUD already started via legacy API');
    return;
  }
  
  globalHUDInstance = new HUD(scene, options);
  globalHUDInstance.start();
}

/**
 * @deprecated Use `hud.dispose()` instead
 */
export function dispose(): void {
  if (globalHUDInstance) {
    globalHUDInstance.dispose();
    globalHUDInstance = null;
  }
}

export default HUD;

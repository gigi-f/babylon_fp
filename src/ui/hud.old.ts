import { Scene } from "@babylonjs/core";
import { AdvancedDynamicTexture, Rectangle, Image, TextBlock, Control } from "@babylonjs/gui";
import DayNightCycle, { DayNightState } from "../systems/dayNightCycle";
import HourlyCycle from "../systems/hourlyCycle";
 
type HUDOptions = {
  dayMs?: number;
  nightMs?: number;
  sunImagePath?: string;
  moonImagePath?: string;
  cycle?: DayNightCycle;
};

// Default durations for testing: 1 minute day + 1 minute night = 2 minute loop.
// Change DAY_MS_DEFAULT and NIGHT_MS_DEFAULT here for quicker/longer tests.
const DAY_MS_DEFAULT = 60_000;
const NIGHT_MS_DEFAULT = 60_000;

let ui: AdvancedDynamicTexture | null = null;
let container: Rectangle | null = null;
let timerText: TextBlock | null = null;
let stateText: TextBlock | null = null;
let trackRect: Rectangle | null = null;
let sunImage: Image | null = null;
let sunFallback: Rectangle | null = null;
let moonImage: Image | null = null;
let moonFallback: Rectangle | null = null;
let startTimestamp = Date.now();
let onBeforeRenderObserver: any = null;
let sceneRef: Scene | null = null;
let hourlyCycle: HourlyCycle | null = null;

export function start(scene: Scene, options?: HUDOptions) {
  if (ui) return; // already started
  sceneRef = scene;
  const DAY_MS = options?.dayMs ?? DAY_MS_DEFAULT;
  const NIGHT_MS = options?.nightMs ?? NIGHT_MS_DEFAULT;
  const TOTAL_MS = DAY_MS + NIGHT_MS;
  const sunImagePath = options?.sunImagePath ?? "/assets/ui/sun.png";
  const moonImagePath = options?.moonImagePath ?? "/assets/ui/moon.png";

  startTimestamp = Date.now();

  ui = AdvancedDynamicTexture.CreateFullscreenUI("HUD");

  // top bar container
  container = new Rectangle("hud_container");
  container.height = "72px";
  container.thickness = 0;
  container.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
  container.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
  container.background = "rgba(0,0,0,0.12)";
  container.width = "100%";
  ui.addControl(container);

  // left: timer
  timerText = new TextBlock("hud_timer");
  timerText.text = "0:00";
  timerText.color = "white";
  timerText.fontSize = 20;
  timerText.width = "120px";
  timerText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
  timerText.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
  timerText.paddingLeft = "12px";
  container.addControl(timerText);

  // center: track with sun
  const TRACK_WIDTH = 360; // px - adjust if needed
  const TRACK_HEIGHT = 8;
  trackRect = new Rectangle("hud_track");
  trackRect.width = `${TRACK_WIDTH}px`;
  trackRect.height = `${TRACK_HEIGHT}px`;
  trackRect.background = "rgba(255,255,255,0.12)";
  trackRect.thickness = 0;
  trackRect.cornerRadius = 4;
  trackRect.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
  trackRect.verticalAlignment = Control.VERTICAL_ALIGNMENT_CENTER;
  container.addControl(trackRect);

  // sun size
  const SUN_SIZE = 28;

  // create sun image with fallback
  sunImage = new Image("hud_sun", sunImagePath);
  sunImage.width = `${SUN_SIZE}px`;
  sunImage.height = `${SUN_SIZE}px`;
  sunImage.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
  sunImage.verticalAlignment = Control.VERTICAL_ALIGNMENT_CENTER;
  sunImage.isPointerBlocker = false;
  sunImage.left = `${-TRACK_WIDTH / 2 - SUN_SIZE}px`;
  trackRect.addControl(sunImage);

  // fallback circle (hidden by default)
  sunFallback = new Rectangle("hud_sun_fallback");
  sunFallback.width = `${SUN_SIZE}px`;
  sunFallback.height = `${SUN_SIZE}px`;
  sunFallback.cornerRadius = SUN_SIZE / 2;
  sunFallback.background = "#FFD166";
  sunFallback.thickness = 0;
  sunFallback.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
  sunFallback.verticalAlignment = Control.VERTICAL_ALIGNMENT_CENTER;
  sunFallback.isVisible = false;
  trackRect.addControl(sunFallback);

  // create moon image with fallback
  moonImage = new Image("hud_moon", moonImagePath);
  moonImage.width = `${SUN_SIZE}px`;
  moonImage.height = `${SUN_SIZE}px`;
  moonImage.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
  moonImage.verticalAlignment = Control.VERTICAL_ALIGNMENT_CENTER;
  moonImage.isPointerBlocker = false;
  moonImage.left = `${-TRACK_WIDTH / 2 - SUN_SIZE}px`;
  moonImage.isVisible = false;
  trackRect.addControl(moonImage);

  moonFallback = new Rectangle("hud_moon_fallback");
  moonFallback.width = `${SUN_SIZE}px`;
  moonFallback.height = `${SUN_SIZE}px`;
  moonFallback.cornerRadius = SUN_SIZE / 2;
  moonFallback.background = "#AAB7FF";
  moonFallback.thickness = 0;
  moonFallback.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
  moonFallback.verticalAlignment = Control.VERTICAL_ALIGNMENT_CENTER;
  moonFallback.isVisible = false;
  trackRect.addControl(moonFallback);
  
  // world-space sun is handled by the DayNightCycle system (rendered in 3D), not the HUD.

  // right: day/night label
  stateText = new TextBlock("hud_state");
  stateText.text = "Day";
  stateText.color = "white";
  stateText.fontSize = 18;
  stateText.width = "120px";
  stateText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
  stateText.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
  stateText.paddingRight = "12px";
  container.addControl(stateText);

  // Attempt to detect image load failure to show fallback.
  // Image control exposes onImageLoadedObservable and onImageErrorObservable in Babylon GUI.
  try {
    (sunImage as any).onImageLoadedObservable?.addOnce(() => {
      sunImage!.isVisible = true;
      sunFallback!.isVisible = false;
    });
    (sunImage as any).onImageErrorObservable?.addOnce(() => {
      sunImage!.isVisible = false;
      sunFallback!.isVisible = true;
    });

    (moonImage as any).onImageLoadedObservable?.addOnce(() => {
      moonImage!.isVisible = true;
      moonFallback!.isVisible = false;
    });
    (moonImage as any).onImageErrorObservable?.addOnce(() => {
      moonImage!.isVisible = false;
      moonFallback!.isVisible = true;
    });
  } catch (e) {
    // If observables not present, use fallback
    sunImage.isVisible = false;
    sunFallback.isVisible = true;
    moonImage.isVisible = false;
    moonFallback.isVisible = true;
  }

  // If a DayNightCycle is provided prefer subscription so HUD visuals are in sync.
  if (options?.cycle) {
    const cycle = options.cycle!;
    // create hourly cycle helper (24 equal chunks) and subscribe to it
    try {
      hourlyCycle = new HourlyCycle(cycle, TOTAL_MS);
      // hourlyCycle.onTick returns an unsubscribe function — store it in onBeforeRenderObserver for disposal
      onBeforeRenderObserver = hourlyCycle.onTick((info, state) => {
        const isDay = state.isDay;
        // compute wall-clock style time where loop start == 6:00 AM
        const hour24 = ((6 + info.hourIndex) % 24 + 24) % 24;
        const displayHour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
        const ampm = hour24 < 12 ? "AM" : "PM";
        const mmVal = Math.floor(info.hourProgress * 60);
        timerText!.text = `${displayHour12}:${mmVal.toString().padStart(2, "0")} ${ampm}`;
        stateText!.text = isDay ? "Day" : "Night";
        const TRACK_WIDTH = parseFloat((trackRect!.width as string).replace("px", "")) || 360;
        const SUN_SIZE = 28;

        if (isDay) {
          // track sun along HUD track
          const leftPx = state.dayProgress * TRACK_WIDTH - TRACK_WIDTH / 2;
          const ctrl = sunImage?.isVisible ? sunImage! : sunFallback!;
          ctrl.left = `${leftPx}px`;
          sunImage!.isVisible = true;
          sunFallback!.isVisible = !sunImage!.isVisible;
          moonImage!.isVisible = false;
          moonFallback!.isVisible = false;
        } else {
          // HUD: night mode — hide the HUD sun indicator and show moon along the track.
          const leftPx = state.nightProgress * TRACK_WIDTH - TRACK_WIDTH / 2;
          const ctrl = moonImage?.isVisible ? moonImage! : moonFallback!;
          ctrl.left = `${leftPx}px`;
          moonImage!.isVisible = true;
          moonFallback!.isVisible = !moonImage!.isVisible;
          sunImage!.isVisible = false;
          sunFallback!.isVisible = false;
        }
      });
    } catch (e) {
      // fallback to subscribing directly to cycle if HourlyCycle instantiation fails
      onBeforeRenderObserver = cycle.onTick((state: DayNightState) => {
        const isDay = state.isDay;
        const mm = Math.floor(state.displaySec / 60);
        timerText!.text = `${mm}`;
        stateText!.text = isDay ? "Day" : "Night";
        const TRACK_WIDTH = parseFloat((trackRect!.width as string).replace("px", "")) || 360;

        if (isDay) {
          const leftPx = state.dayProgress * TRACK_WIDTH - TRACK_WIDTH / 2;
          const ctrl = sunImage?.isVisible ? sunImage! : sunFallback!;
          ctrl.left = `${leftPx}px`;
          sunImage!.isVisible = true;
          sunFallback!.isVisible = !sunImage!.isVisible;
          moonImage!.isVisible = false;
          moonFallback!.isVisible = false;
        } else {
          const leftPx = state.nightProgress * TRACK_WIDTH - TRACK_WIDTH / 2;
          const ctrl = moonImage?.isVisible ? moonImage! : moonFallback!;
          ctrl.left = `${leftPx}px`;
          moonImage!.isVisible = true;
          moonFallback!.isVisible = !moonImage!.isVisible;
          sunImage!.isVisible = false;
          sunFallback!.isVisible = false;
        }
      });
    }
  } else {
    // fallback: use scene.onBeforeRenderObservable as before
    onBeforeRenderObserver = scene.onBeforeRenderObservable.add(() => {
      const now = Date.now();
      const elapsedInLoop = (now - startTimestamp) % TOTAL_MS;
      const isDay = elapsedInLoop < DAY_MS;
      // format timer: during day show 0:00 -> 1:00; during night show 0:00 -> 1:00
      const displayMs = isDay ? elapsedInLoop : elapsedInLoop - DAY_MS;
      const displaySec = Math.floor(displayMs / 1000);
      const mm = Math.floor(displaySec / 60);
      const ss = displaySec % 60;
      timerText!.text = `${mm}:${ss.toString().padStart(2, "0")}`;
      stateText!.text = isDay ? "Day" : "Night";
 
      // sun/moon movement
      if (isDay) {
        // sun visible, moon hidden
        const dayProgress = elapsedInLoop / DAY_MS; // 0..1
        const leftPx = dayProgress * TRACK_WIDTH - TRACK_WIDTH / 2;
        const ctrl = sunImage?.isVisible ? sunImage! : sunFallback!;
        ctrl.left = `${leftPx}px`;
        sunImage!.isVisible = true;
        sunFallback!.isVisible = !sunImage!.isVisible;
        moonImage!.isVisible = false;
        moonFallback!.isVisible = false;
      } else {
        // moon visible, sun hidden
        const nightProgress = (elapsedInLoop - DAY_MS) / NIGHT_MS; // 0..1
        const leftPx = nightProgress * TRACK_WIDTH - TRACK_WIDTH / 2;
        const ctrl = moonImage?.isVisible ? moonImage! : moonFallback!;
        ctrl.left = `${leftPx}px`;
        moonImage!.isVisible = true;
        moonFallback!.isVisible = !moonImage!.isVisible;
        sunImage!.isVisible = false;
        sunFallback!.isVisible = false;
      }
    });
  }
    
}

export function dispose() {
  if (!ui) return;
  try {
    if (hourlyCycle) {
      try { hourlyCycle.dispose(); } catch {}
      hourlyCycle = null;
    }
    if (onBeforeRenderObserver) {
      try {
        // if observer is a Babylon observable callback token previously added, remove it
        if (sceneRef && (sceneRef as any).onBeforeRenderObservable && typeof (sceneRef as any).onBeforeRenderObservable.remove === "function") {
          (sceneRef as any).onBeforeRenderObservable.remove(onBeforeRenderObserver);
        } else if (typeof onBeforeRenderObserver === "function") {
          // unsubscribe function returned by HourlyCycle.onTick or DayNightCycle.onTick
          try { (onBeforeRenderObserver as any)(); } catch {}
        }
      } catch {}
    }
  } catch {}
  try {
    ui.getChildren().forEach((c) => ui!.removeControl(c));
    ui.dispose();
  } catch {}
  ui = null;
  container = null;
  timerText = null;
  stateText = null;
  trackRect = null;
  sunImage = null;
  sunFallback = null;
  moonImage = null;
  moonFallback = null;
  startTimestamp = Date.now();
  onBeforeRenderObserver = null;
  sceneRef = null;
}

export default { start, dispose };
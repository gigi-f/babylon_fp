import { Scene } from "@babylonjs/core";
import { AdvancedDynamicTexture, Rectangle, Image, TextBlock, Control } from "@babylonjs/gui";

type HUDOptions = {
  dayMs?: number;
  nightMs?: number;
  sunImagePath?: string;
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
let startTimestamp = Date.now();
let onBeforeRenderObserver: any = null;
let sceneRef: Scene | null = null;

export function start(scene: Scene, options?: HUDOptions) {
  if (ui) return; // already started
  sceneRef = scene;
  const DAY_MS = options?.dayMs ?? DAY_MS_DEFAULT;
  const NIGHT_MS = options?.nightMs ?? NIGHT_MS_DEFAULT;
  const TOTAL_MS = DAY_MS + NIGHT_MS;
  const sunImagePath = options?.sunImagePath ?? "/assets/ui/sun.png";

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
  // initially position off-left
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
  } catch (e) {
    // If observables not present, use fallback
    sunImage.isVisible = false;
    sunFallback.isVisible = true;
  }

  // update loop using scene.onBeforeRenderObservable
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

    // sun movement only during day
    if (isDay) {
      const dayProgress = elapsedInLoop / DAY_MS; // 0..1
      const leftPx = dayProgress * TRACK_WIDTH - TRACK_WIDTH / 2;
      // move sun smoothly
      const ctrl = sunImage?.isVisible ? sunImage! : sunFallback!;
      ctrl.left = `${leftPx}px`;
      // ensure visibility
      if (sunImage && sunImage.isVisible) {
        sunFallback!.isVisible = false;
      } else if (sunFallback) {
        sunFallback.isVisible = true;
      }
    } else {
      // hide/move sun off-screen during night
      const offLeft = -TRACK_WIDTH / 2 - SUN_SIZE * 2;
      if (sunImage) sunImage.left = `${offLeft}px`;
      if (sunFallback) sunFallback.left = `${offLeft}px`;
      if (sunImage) sunImage.isVisible = false;
      if (sunFallback) sunFallback.isVisible = false;
    }
    
  });
}

export function dispose() {
  if (!ui) return;
  try {
    if (sceneRef && onBeforeRenderObserver) {
      sceneRef.onBeforeRenderObservable.remove(onBeforeRenderObserver);
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
  startTimestamp = Date.now();
  onBeforeRenderObserver = null;
  sceneRef = null;
}

export default { start, dispose };
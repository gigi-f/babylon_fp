import { Tools } from "@babylonjs/core";
import PhotoStack from "../ui/photoStack";
import { savePhoto } from "../systems/photoSystem";

/**
 * Debugging shortcuts (keyboard) for development tools
 * Register with registerDebugShortcuts() which returns a dispose function.
 */
export function registerDebugShortcuts(): () => void {
  let listener = (e: KeyboardEvent) => {
    try {
      const key = e.key;

      // Time-skip (existing behaviour)
      if (key.toLowerCase() === "t") {
        const cycle = (window as any).dayNightCycle;
        if (!cycle) return;
        const now = Date.now();
        // Safely read internals (debug-only, uses `any`)
        const totalMs =
          (cycle as any).totalMs ??
          (((cycle as any).dayMs ?? 60000) + ((cycle as any).nightMs ?? 60000));
        const dayMs = (cycle as any).dayMs ?? 60000;
        const startTs = (cycle as any).startTimestamp ?? now;
        const elapsedInLoop = (now - startTs) % totalMs;
        const isDayNow = elapsedInLoop < dayMs;

        if (isDayNow) {
          // jump to start of night
          (cycle as any).startTimestamp = now - dayMs;
        } else {
          // jump to start of day
          (cycle as any).startTimestamp = now;
        }
        return;
      }

      // Snapshot: press "[" to capture the render canvas and show in a modal
      if (key === "[") {
        try {
          const canvas = document.getElementById("renderCanvas") as HTMLCanvasElement | null;
          if (!canvas) return;

          const engine = (window as any).engine;
          const camera = (window as any).camera ?? (window as any).scene?.activeCamera;

          const showModal = (dataUrl: string) => {
            try {
              const overlay = document.createElement("div");
              overlay.style.position = "fixed";
              overlay.style.left = "0";
              overlay.style.top = "0";
              overlay.style.width = "100%";
              overlay.style.height = "100%";
              overlay.style.display = "flex";
              overlay.style.alignItems = "center";
              overlay.style.justifyContent = "center";
              overlay.style.background = "rgba(0,0,0,0.65)";
              overlay.style.zIndex = "9999";
              overlay.style.cursor = "zoom-out";
              overlay.setAttribute("role", "dialog");
              overlay.setAttribute("aria-modal", "true");

              const img = document.createElement("img");
              img.src = dataUrl;
              img.alt = "Snapshot";
              img.style.maxWidth = "90%";
              img.style.maxHeight = "90%";
              img.style.boxShadow = "0 8px 40px rgba(0,0,0,0.6)";
              img.style.border = "4px solid rgba(255,255,255,0.95)";
              img.style.borderRadius = "4px";
              overlay.appendChild(img);

              // Setup removal handlers (click overlay or press Escape)
              let escHandler: (ev: KeyboardEvent) => void;
              const removeOverlay = () => {
                try {
                  if (overlay.parentNode) document.body.removeChild(overlay);
                  window.removeEventListener("keydown", escHandler);
                } catch {}
              };
              escHandler = (ev: KeyboardEvent) => {
                if (ev.key === "Escape") removeOverlay();
              };

              overlay.addEventListener("click", removeOverlay);
              window.addEventListener("keydown", escHandler);

              document.body.appendChild(overlay);
            } catch {}
          };

          // Prefer Babylon Tools.CreateScreenshot when available (handles WebGL readback correctly)
          try {
            if (typeof (Tools as any).CreateScreenshot === "function" && engine && camera) {
              // Tools.CreateScreenshot(engine, camera, sizeOrOptions, callback)
              const sizeOptions = { width: canvas.width, height: canvas.height };
              try {
                (Tools as any).CreateScreenshot(engine, camera, sizeOptions, (dataUrl: string) => {
                  if (dataUrl) showModal(dataUrl);
                });
                return;
              } catch {
                // fallback to numeric size overload
                try {
                  const size = Math.max(canvas.width, canvas.height);
                  (Tools as any).CreateScreenshot(engine, camera, size, (dataUrl: string) => {
                    if (dataUrl) showModal(dataUrl);
                  });
                  return;
                } catch {}
              }
            }
          } catch {}

          // Fallback: use canvas.toDataURL if Tools not available or failed
          try {
            const fallback = canvas.toDataURL("image/png");
            showModal(fallback);
          } catch {}
        } catch {}
      }
    } catch {}
  };

  window.addEventListener("keydown", listener);
  return () => {
    try {
      window.removeEventListener("keydown", listener);
    } catch {}
  };
}

/**
 * Take a square "polaroid" photo from the render canvas.
 * - Prefers Tools.CreateScreenshot when available (reads full canvas then crops/zooms).
 * - Falls back to reading canvas.toDataURL and cropping + zooming center region.
 * - Adds the resulting photo as a thumbnail with timestamp to a right-side vertical stack.
 * - Keeps the modal UI available and uses it when a thumbnail is clicked.
 */
export async function takePolaroid(): Promise<void> {
  try {
    const canvas = document.getElementById("renderCanvas") as HTMLCanvasElement | null;
    if (!canvas) return;
    const engine = (window as any).engine;
    const camera = (window as any).camera ?? (window as any).scene?.activeCamera;

    // Modal preview (kept for later per-user request)
    const showModal = (dataUrl: string) => {
      try {
        const overlay = document.createElement("div");
        overlay.style.position = "fixed";
        overlay.style.left = "0";
        overlay.style.top = "0";
        overlay.style.width = "100%";
        overlay.style.height = "100%";
        overlay.style.display = "flex";
        overlay.style.alignItems = "center";
        overlay.style.justifyContent = "center";
        overlay.style.background = "rgba(0,0,0,0.65)";
        overlay.style.zIndex = "10001";
        overlay.style.cursor = "zoom-out";
        overlay.setAttribute("role", "dialog");
        overlay.setAttribute("aria-modal", "true");

        const img = document.createElement("img");
        img.src = dataUrl;
        img.alt = "Polaroid";
        img.style.maxWidth = "90%";
        img.style.maxHeight = "90%";
        img.style.boxShadow = "0 12px 60px rgba(0,0,0,0.6)";
        img.style.border = "8px solid rgba(255,255,255,0.95)";
        img.style.borderRadius = "6px";
        overlay.appendChild(img);

        let escHandler: (ev: KeyboardEvent) => void;
        const removeOverlay = () => {
          try {
            if (overlay.parentNode) document.body.removeChild(overlay);
            window.removeEventListener("keydown", escHandler);
          } catch {}
        };
        escHandler = (ev: KeyboardEvent) => {
          if (ev.key === "Escape") removeOverlay();
        };

        overlay.addEventListener("click", removeOverlay);
        window.addEventListener("keydown", escHandler);

        document.body.appendChild(overlay);
      } catch {}
    };

    // Helper: add photo to right-hand vertical stack as thumbnail + timestamp.
    const addToStack = (dataUrl: string) => {
      try {
        // Prefer centralized photo system which handles persistence + UI.
        try {
          if ((window as any).photoSystem?.savePhoto) {
            try { (window as any).photoSystem.savePhoto(dataUrl); return; } catch {}
          }
          // Also support local import if available
          try { savePhoto(dataUrl); return; } catch {}
          // Try dynamic import as a last resort
          try {
            import("../systems/photoSystem").then((m) => { try { m.savePhoto(dataUrl); } catch {} });
            return;
          } catch {}
        } catch {}
    
        // Fallback UI: create container if missing
        let stack = document.getElementById("polaroid_stack") as HTMLDivElement | null;
        if (!stack) {
          stack = document.createElement("div");
          stack.id = "polaroid_stack";
          stack.style.position = "fixed";
          stack.style.right = "12px";
          stack.style.top = "12px";
          stack.style.width = "160px";
          stack.style.maxHeight = "calc(100vh - 24px)";
          stack.style.overflowY = "auto";
          stack.style.display = "flex";
          stack.style.flexDirection = "column";
          stack.style.gap = "12px";
          stack.style.zIndex = "10000";
          stack.style.pointerEvents = "auto";
          document.body.appendChild(stack);
        }
    
        // Create card
        const card = document.createElement("div");
        card.style.display = "flex";
        card.style.flexDirection = "column";
        card.style.alignItems = "center";
        card.style.background = "rgba(255,255,255,0.02)";
        card.style.padding = "6px";
        card.style.borderRadius = "6px";
        card.style.boxShadow = "0 6px 18px rgba(0,0,0,0.35)";
        card.style.cursor = "pointer";
    
        // Thumbnail image (square)
        const thumb = document.createElement("img");
        thumb.src = dataUrl;
        thumb.alt = "Polaroid thumbnail";
        thumb.style.width = "140px";
        thumb.style.height = "140px";
        thumb.style.objectFit = "cover";
        thumb.style.border = "4px solid rgba(255,255,255,0.95)";
        thumb.style.borderRadius = "4px";
        thumb.style.display = "block";
        card.appendChild(thumb);
    
        // Timestamp
        const ts = document.createElement("div");
        ts.textContent = new Date().toLocaleString();
        ts.style.fontSize = "11px";
        ts.style.color = "white";
        ts.style.opacity = "0.9";
        ts.style.marginTop = "6px";
        ts.style.textAlign = "center";
        card.appendChild(ts);
    
        // Click to open modal (kept for future)
        card.addEventListener("click", (ev) => {
          try {
            showModal(dataUrl);
          } catch {}
        });
    
        // Prepend newest to top
        if (stack.firstChild) {
          stack.insertBefore(card, stack.firstChild);
        } else {
          stack.appendChild(card);
        }
      } catch {}
    };

    // Zoom factor (1.5 => ~50% more zoomed)
    const ZOOM = 1.5;

    // Prefer Babylon Tools.CreateScreenshot when available — request full canvas then crop and zoom.
    try {
      if (typeof (Tools as any).CreateScreenshot === "function" && engine && camera) {
        try {
          const fullSizeOptions = { width: canvas.width, height: canvas.height };
          (Tools as any).CreateScreenshot(engine, camera, fullSizeOptions, (dataUrl: string) => {
            if (!dataUrl) return;
            const img = new Image();
            img.onload = () => {
              try {
                // base square size (height for landscape, width for portrait)
                let baseSize = img.height;
                if (img.width < img.height) baseSize = img.width;
                // compute crop region smaller by zoom factor and center it
                const cropSize = Math.max(1, Math.round(baseSize / ZOOM));
                const cropSx = Math.round((img.width - cropSize) / 2);
                const cropSy = Math.round((img.height - cropSize) / 2);
                const off = document.createElement("canvas");
                off.width = baseSize;
                off.height = baseSize;
                const ctx = off.getContext("2d");
                if (ctx) {
                  // draw the cropped smaller region and upscale to the output square
                  ctx.drawImage(img, cropSx, cropSy, cropSize, cropSize, 0, 0, baseSize, baseSize);
                  const out = off.toDataURL("image/png");
                  addToStack(out);
                }
              } catch {}
            };
            img.onerror = () => {
              try { addToStack(dataUrl); } catch {}
            };
            img.src = dataUrl;
          });
          return;
        } catch {
          // fall through to canvas.toDataURL fallback
        }
      }
    } catch {}

    // Fallback: use canvas.toDataURL then crop + zoom (center) so final image is ~50% more zoomed
    try {
      const fullData = canvas.toDataURL("image/png");
      await new Promise<void>((resolve) => {
        const img = new Image();
        img.onload = () => {
          try {
            // base square size equals image height when landscape, otherwise width
            let baseSize = img.height;
            if (img.width < img.height) baseSize = img.width;
            // compute crop region smaller by zoom factor and center it
            const cropSize = Math.max(1, Math.round(baseSize / ZOOM));
            const cropSx = Math.round((img.width - cropSize) / 2);
            const cropSy = Math.round((img.height - cropSize) / 2);
            const off = document.createElement("canvas");
            off.width = baseSize;
            off.height = baseSize;
            const ctx = off.getContext("2d");
            if (ctx) {
              ctx.drawImage(img, cropSx, cropSy, cropSize, cropSize, 0, 0, baseSize, baseSize);
              const out = off.toDataURL("image/png");
              addToStack(out);
            }
          } catch {}
          resolve();
        };
        img.onerror = () => resolve();
        img.src = fullData;
      });
    } catch {}
  } catch {}
}

// expose helper on window for easy consumption by input handlers
try {
  (window as any).takePolaroid = takePolaroid;
} catch {}
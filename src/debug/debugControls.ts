import { Tools } from "@babylonjs/core";

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
 * - Prefers Tools.CreateScreenshot when available (passes square width/height).
 * - Falls back to reading canvas.toDataURL and cropping center square.
 * - Shows the result in the same modal UI used by the debugger snapshot.
 */
export async function takePolaroid(): Promise<void> {
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

    // Prefer Babylon Tools.CreateScreenshot when available — request full canvas then crop by height.
    // Using a full-canvas readback then cropping prevents distortion that occurs when forcing a square render.
    try {
      if (typeof (Tools as any).CreateScreenshot === "function" && engine && camera) {
        try {
          const fullSizeOptions = { width: canvas.width, height: canvas.height };
          (Tools as any).CreateScreenshot(engine, camera, fullSizeOptions, (dataUrl: string) => {
            if (!dataUrl) return;
            // crop so square is based on image height: center horizontally, crop left/right
            const img = new Image();
            img.onload = () => {
              try {
                let size = img.height;
                let sx = Math.floor((img.width - size) / 2);
                let sy = 0;
                // If the image is portrait (width < height) fall back to center-crop by width
                if (img.width < img.height) {
                  size = img.width;
                  sx = 0;
                  sy = Math.floor((img.height - size) / 2);
                }
                const off = document.createElement("canvas");
                off.width = size;
                off.height = size;
                const ctx = off.getContext("2d");
                if (ctx) {
                  ctx.drawImage(img, sx, sy, size, size, 0, 0, size, size);
                  const out = off.toDataURL("image/png");
                  showModal(out);
                }
              } catch {}
            };
            img.onerror = () => {
              // On error, fall back to using raw data URL directly
              try { showModal(dataUrl); } catch {}
            };
            img.src = dataUrl;
          });
          return;
        } catch {
          // fall through to canvas.toDataURL fallback
        }
      }
    } catch {}

    // Fallback: use canvas.toDataURL + crop such that the square uses the image height (cut left/right)
    try {
      const fullData = canvas.toDataURL("image/png");
      await new Promise<void>((resolve) => {
        const img = new Image();
        img.onload = () => {
          try {
            let size = img.height;
            let sx = Math.floor((img.width - size) / 2);
            let sy = 0;
            if (img.width < img.height) {
              // portrait orientation -> center-crop by width instead
              size = img.width;
              sx = 0;
              sy = Math.floor((img.height - size) / 2);
            }
            const off = document.createElement("canvas");
            off.width = size;
            off.height = size;
            const ctx = off.getContext("2d");
            if (ctx) {
              ctx.drawImage(img, sx, sy, size, size, 0, 0, size, size);
              const out = off.toDataURL("image/png");
              showModal(out);
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
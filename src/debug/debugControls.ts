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
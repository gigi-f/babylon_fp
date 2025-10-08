// Debugging shortcuts (keyboard) for development tools
// Register with registerDebugShortcuts() which returns a dispose function.

export function registerDebugShortcuts(): () => void {
  let listener = (e: KeyboardEvent) => {
    try {
      if (e.key.toLowerCase() === "t") {
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
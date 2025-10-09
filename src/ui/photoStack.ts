/**
 * Photo stack UI (right-side)
 * Exports addPhotoToStack(dataUrl) to append a thumbnail + timestamp.
 * The panel is fixed to the right-bottom, black background, height = 33vh,
 * header text "Photo Evidence", and photo list justified to the bottom.
 */

export function addPhotoToStack(dataUrl: string) {
  try {
    // Create panel if missing
    let panel = document.getElementById("polaroid_panel") as HTMLDivElement | null;
    if (!panel) {
      panel = document.createElement("div");
      panel.id = "polaroid_panel";
      panel.style.position = "fixed";
      panel.style.right = "12px";
      panel.style.bottom = "12px";
      panel.style.width = "180px";
      panel.style.height = "33vh";
      panel.style.background = "black";
      panel.style.color = "white";
      panel.style.padding = "8px";
      panel.style.boxSizing = "border-box";
      panel.style.borderRadius = "8px";
      panel.style.boxShadow = "0 8px 30px rgba(0,0,0,0.6)";
      panel.style.zIndex = "10000";
      panel.style.display = "flex";
      panel.style.flexDirection = "column";
      panel.style.pointerEvents = "auto";
      panel.style.overflow = "hidden";

      // Header
      const header = document.createElement("div");
      header.textContent = "Photo Evidence";
      header.style.fontSize = "13px";
      header.style.fontWeight = "600";
      header.style.marginBottom = "6px";
      header.style.textAlign = "center";
      panel.appendChild(header);

      // Stack container (photos grow towards bottom)
      const stack = document.createElement("div");
      stack.id = "polaroid_stack";
      stack.style.flex = "1 1 auto";
      stack.style.display = "flex";
      stack.style.flexDirection = "column";
      stack.style.justifyContent = "flex-end"; // keep items anchored to bottom
      stack.style.gap = "8px";
      stack.style.overflowY = "auto";
      panel.appendChild(stack);

      document.body.appendChild(panel);
    }

    const stack = document.getElementById("polaroid_stack") as HTMLDivElement | null;
    if (!stack) return;

    // Card
    const card = document.createElement("div");
    card.style.display = "flex";
    card.style.flexDirection = "column";
    card.style.alignItems = "center";
    card.style.background = "rgba(255,255,255,0.02)";
    card.style.padding = "6px";
    card.style.borderRadius = "6px";
    card.style.width = "100%";
    card.style.boxSizing = "border-box";
    card.style.cursor = "pointer";

    // Thumbnail (square)
    const thumb = document.createElement("img");
    thumb.src = dataUrl;
    thumb.alt = "Polaroid thumbnail";
    thumb.style.width = "100%";
    thumb.style.height = "auto";
    thumb.style.aspectRatio = "1 / 1";
    thumb.style.objectFit = "cover";
    thumb.style.border = "3px solid rgba(255,255,255,0.95)";
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

    // Click opens modal preview (keep modal code elsewhere)
    card.addEventListener("click", () => {
      try {
        const event = new CustomEvent("polaroid:open", { detail: { dataUrl } });
        window.dispatchEvent(event);
      } catch {}
    });

    // Append to stack so newest appear at bottom (anchor is bottom)
    stack.appendChild(card);

    // Keep scroll scrolled to bottom after adding
    try {
      stack.scrollTop = stack.scrollHeight;
    } catch {}
  } catch {}
}

export default { addPhotoToStack };
/**
 * Photo stack UI (right-side)
 * Exports addPhotoToStack(dataUrl) to append a thumbnail + timestamp.
 * The panel is fixed to the right-bottom, black background, height = 33vh,
 * header text "Photo Evidence", and photo list justified to the bottom.
 *
 * Clicking the panel header opens a gallery modal showing all saved photos
 * in a vertical-scrollable grid. Clicking a photo inside the modal will
 * dispatch the "polaroid:open" event with the photo's dataUrl (full screen).
 */

import { getPhotos } from "../systems/photoSystem";

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
      header.style.cursor = "pointer";
      // Open gallery on header click
      header.addEventListener("click", (ev) => {
        try {
          ev.stopPropagation();
          openGalleryModal();
        } catch {}
      });
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

    // Clicking a small stack thumbnail opens the gallery (so user can see the grid)
    card.addEventListener("click", (ev) => {
      try {
        ev.stopPropagation();
        openGalleryModal();
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

/**
 * Build and show a gallery modal that lists all photos in a vertical-scrollable grid.
 * Each image inside the modal, when clicked, dispatches "polaroid:open" with detail { dataUrl }.
 */
function openGalleryModal() {
  try {
    // overlay
    const overlay = document.createElement("div");
    overlay.style.position = "fixed";
    overlay.style.left = "0";
    overlay.style.top = "0";
    overlay.style.width = "100%";
    overlay.style.height = "100%";
    overlay.style.display = "flex";
    overlay.style.alignItems = "center";
    overlay.style.justifyContent = "center";
    overlay.style.background = "rgba(0,0,0,0.75)";
    overlay.style.zIndex = "10001";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");

    // Container (constrained height, scrollable)
    const container = document.createElement("div");
    container.style.width = "80%";
    container.style.maxWidth = "960px";
    container.style.height = "80%";
    container.style.background = "rgba(20,20,20,0.98)";
    container.style.borderRadius = "8px";
    container.style.padding = "16px";
    container.style.boxSizing = "border-box";
    container.style.overflowY = "auto";
    container.style.display = "flex";
    container.style.flexDirection = "column";
    container.style.gap = "12px";

    // Title row with close
    const titleRow = document.createElement("div");
    titleRow.style.display = "flex";
    titleRow.style.justifyContent = "space-between";
    titleRow.style.alignItems = "center";
    const title = document.createElement("div");
    title.textContent = "Photo Evidence";
    title.style.color = "white";
    title.style.fontSize = "16px";
    title.style.fontWeight = "700";
    titleRow.appendChild(title);
    const closeBtn = document.createElement("button");
    closeBtn.textContent = "Close";
    closeBtn.style.background = "transparent";
    closeBtn.style.color = "white";
    closeBtn.style.border = "1px solid rgba(255,255,255,0.08)";
    closeBtn.style.padding = "6px 10px";
    closeBtn.style.borderRadius = "6px";
    closeBtn.style.cursor = "pointer";
    closeBtn.addEventListener("click", () => {
      try {
        if (overlay.parentNode) document.body.removeChild(overlay);
        window.removeEventListener("keydown", escHandler);
      } catch {}
    });
    titleRow.appendChild(closeBtn);
    container.appendChild(titleRow);

    // Grid
    const grid = document.createElement("div");
    grid.style.display = "grid";
    grid.style.gridTemplateColumns = "repeat(auto-fill, minmax(140px, 1fr))";
    grid.style.gap = "12px";

    // Populate photos from photoSystem if available
    let photos: Array<{ dataUrl: string }> = [];
    try {
      const sysPhotos = getPhotos();
      if (Array.isArray(sysPhotos) && sysPhotos.length > 0) {
        photos = sysPhotos.map((p: any) => ({ dataUrl: p.dataUrl }));
      }
    } catch {}

    // Fallback: collect existing imgs shown in the stack
    if (photos.length === 0) {
      try {
        const stackImgs = Array.from(document.querySelectorAll("#polaroid_stack img"));
        for (const imgEl of stackImgs) {
          try {
            const src = (imgEl as HTMLImageElement).src;
            if (src) photos.push({ dataUrl: src });
          } catch {}
        }
      } catch {}
    }

    // If still empty, show placeholder
    if (photos.length === 0) {
      const empty = document.createElement("div");
      empty.textContent = "No photos yet.";
      empty.style.color = "white";
      empty.style.opacity = "0.9";
      container.appendChild(empty);
    } else {
      for (const p of photos) {
        try {
          const cell = document.createElement("div");
          cell.style.display = "flex";
          cell.style.flexDirection = "column";
          cell.style.alignItems = "center";
          const img = document.createElement("img");
          img.src = p.dataUrl;
          img.alt = "Photo";
          img.style.width = "100%";
          img.style.height = "auto";
          img.style.aspectRatio = "1 / 1";
          img.style.objectFit = "cover";
          img.style.border = "3px solid rgba(255,255,255,0.06)";
          img.style.borderRadius = "6px";
          img.style.cursor = "pointer";
          img.addEventListener("click", (ev) => {
            try {
              ev.stopPropagation();
              const event = new CustomEvent("polaroid:open", { detail: { dataUrl: p.dataUrl } });
              window.dispatchEvent(event);
            } catch {}
          });
          cell.appendChild(img);
          grid.appendChild(cell);
        } catch {}
      }
      container.appendChild(grid);
    }

    overlay.appendChild(container);

    // Close on backdrop click
    overlay.addEventListener("click", (ev) => {
      try {
        if (ev.target === overlay && overlay.parentNode) document.body.removeChild(overlay);
      } catch {}
    });

    // Close on Escape
    let escHandler: (ev: KeyboardEvent) => void;
    escHandler = (ev: KeyboardEvent) => {
      try {
        if (ev.key === "Escape" && overlay.parentNode) document.body.removeChild(overlay);
      } catch {}
    };
    window.addEventListener("keydown", escHandler);

    document.body.appendChild(overlay);
  } catch {}
}

export default { addPhotoToStack };
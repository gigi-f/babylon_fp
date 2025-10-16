import { FreeCamera, Vector3, Ray } from "@babylonjs/core";

export type FPControllerOptions = {
  speed?: number;
  gravity?: number;
  physicsMesh?: any; // optional mesh with a physicsImpostor
  invertMouse?: boolean;       // invert horizontal & vertical mouse axes
  mouseSensitivity?: number;   // override default sensitivity
};

export class FirstPersonController {
  camera: FreeCamera;
  canvas: HTMLCanvasElement;
  speed: number;
  inputMap: Record<string, boolean>;
  disposed = false;
  enabled = true; // Allow disabling the controller (e.g., when paused)
  velocity: Vector3 = new Vector3(0, 0, 0);
  gravity: number;
  groundTolerance = 0.05;
  // mouse / pointer state
  mouseSensitivity = 0.007;
  lastMouseX: number | null = null;
  lastMouseY: number | null = null;
  isPointerLocked = true;
  invertMouse = true;
  physicsMesh?: any;
  // polaroid camera state: raised when true (right-click toggles), left-click takes a photo when raised
  polaroidRaised: boolean = false;
  // DOM viewfinder element shown when polaroid is raised
  viewfinderElement: HTMLDivElement | null = null;
  // bound resize handler so it can be removed on dispose
  updateViewfinderSize = () => {
    try {
      if (!this.viewfinderElement) return;
      // align viewfinder to the canvas area so it visually matches the camera framing
      const rect = this.canvas.getBoundingClientRect();
      const cw = rect.width || window.innerWidth;
      const ch = rect.height || window.innerHeight;
      // compute base size (height-based crop for landscape, width for portrait)
      const baseSize = cw >= ch ? ch : cw;
      // the user requested the viewfinder to be 50% of the previous size
      const size = Math.round(baseSize * 0.5);
      const left = rect.left + (cw - size) / 2;
      const top = rect.top + (ch - size) / 2;
      this.viewfinderElement.style.width = `${size}px`;
      this.viewfinderElement.style.height = `${size}px`;
      // Position using viewport coordinates — viewfinder was created with position: fixed
      this.viewfinderElement.style.left = `${Math.round(left)}px`;
      this.viewfinderElement.style.top = `${Math.round(top)}px`;
      this.viewfinderElement.style.transform = `none`;
    } catch {}
  };

  constructor(camera: FreeCamera, canvas: HTMLCanvasElement, options?: FPControllerOptions) {
    this.camera = camera;
    this.canvas = canvas;
    this.speed = options?.speed ?? 3.5;
    this.inputMap = {};
    this.gravity = options?.gravity ?? -9.81;
    this.physicsMesh = options?.physicsMesh;
    this.mouseSensitivity = options?.mouseSensitivity ?? this.mouseSensitivity;
    this.invertMouse = options?.invertMouse ?? this.invertMouse;

    // disable built-in gravity to manage manually
    try { (this.camera as any).applyGravity = false; } catch {}

    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);

    // allow mouse look without requiring a click by listening globally
    window.addEventListener("pointerlockchange", this.onPointerLockChange);
    window.addEventListener("mousemove", this.onMouseMove);

    // still allow explicit pointer lock on click
    this.canvas.addEventListener("click", this.requestPointerLock);
    // prevent context menu when interacting with the canvas (we use right-click for polaroid)
    this.canvas.addEventListener("contextmenu", (ev) => {
      try {
        if (ev.target === this.canvas) ev.preventDefault();
      } catch {}
    });
    // generic action mapping: pointer events handled below (left/right)
    this.canvas.addEventListener("pointerdown", this.onPointerDown);
  }

  onKeyDown = (ev: KeyboardEvent) => {
    this.inputMap[ev.key.toLowerCase()] = true;
  };

  onKeyUp = (ev: KeyboardEvent) => {
    this.inputMap[ev.key.toLowerCase()] = false;
  };

  requestPointerLock = () => {
    if (this.canvas.requestPointerLock) this.canvas.requestPointerLock();
  };

  onPointerLockChange = () => {
    this.isPointerLocked = document.pointerLockElement === this.canvas;
    if (!this.isPointerLocked) {
      this.lastMouseX = null;
      this.lastMouseY = null;
    }
  };

  onMouseMove = (ev: MouseEvent) => {
    // Skip mouse look if controller is disabled
    if (!this.enabled) {
      return;
    }
    
    // Pointer-locked movement provides movementX/Y; otherwise fallback to clientX/Y deltas
    // compute inversion sign (applies to both axes when enabled)
    const inv = this.invertMouse ? -1 : 1;

    if (this.isPointerLocked) {
      const mx = (ev as any).movementX || 0;
      const my = (ev as any).movementY || 0;
      this.camera.rotation.y -= mx * this.mouseSensitivity * inv;
      this.camera.rotation.x -= my * this.mouseSensitivity * inv;
    } else {
      if (this.lastMouseX === null || this.lastMouseY === null) {
        this.lastMouseX = ev.clientX;
        this.lastMouseY = ev.clientY;
        return;
      }
      const dx = ev.clientX - this.lastMouseX;
      const dy = ev.clientY - this.lastMouseY;
      this.lastMouseX = ev.clientX;
      this.lastMouseY = ev.clientY;
      this.camera.rotation.y -= dx * this.mouseSensitivity * inv;
      this.camera.rotation.x -= dy * this.mouseSensitivity * inv;
    }

    // clamp pitch to avoid flipping
    const maxPitch = Math.PI / 2 - 0.01;
    this.camera.rotation.x = Math.max(-maxPitch, Math.min(maxPitch, this.camera.rotation.x));
  };

  isGrounded(scene: any): { grounded: boolean; groundY?: number } {
    const ellipsoidY = (this.camera as any).ellipsoid?.y ?? 1.0;
    const origin = this.camera.position.clone();
    const rayLength = ellipsoidY + 0.6;
    const ray = new Ray(origin, new Vector3(0, -1, 0), rayLength);
    const pick = scene.pickWithRay(ray, (m: any) => !!m && (m.isPickable !== false));
    if (pick && pick.hit && pick.pickedPoint) {
      const groundY = pick.pickedPoint.y;
      const distance = origin.y - groundY;
      if (distance <= ellipsoidY + this.groundTolerance) {
        return { grounded: true, groundY };
      }
    }
    return { grounded: false };
  }

  update() {
    // Skip updates if controller is disabled (e.g., when game is paused)
    if (!this.enabled) {
      return;
    }
    
    const scene = this.camera.getScene();
    const engine = scene.getEngine();
    const dt = Math.max(0.001, engine.getDeltaTime() / 1000);

    // horizontal movement input (world-space flattened)
    const forwardRaw = this.camera.getDirection(new Vector3(0, 0, 1));
    const rightRaw = this.camera.getDirection(new Vector3(1, 0, 0));
    const forward = new Vector3(forwardRaw.x, 0, forwardRaw.z).normalize();
    const right = new Vector3(rightRaw.x, 0, rightRaw.z).normalize();

    let moveX = 0;
    let moveZ = 0;
    if (this.inputMap["w"]) moveZ += 1;
    if (this.inputMap["s"]) moveZ -= 1;
    if (this.inputMap["a"]) moveX -= 1;
    if (this.inputMap["d"]) moveX += 1;

    const horiz = forward.scale(moveZ).add(right.scale(moveX));
    const horizLen = horiz.length();
    const speedPerSec = this.speed;
    const horizVelocity = horizLen > 0 ? horiz.normalize().scale(speedPerSec) : new Vector3(0, 0, 0);

    // If a physics mesh with an impostor is provided, drive the impostor for collisions
    if (this.physicsMesh && (this.physicsMesh as any).physicsImpostor) {
      try {
        const impostor = (this.physicsMesh as any).physicsImpostor;
        const currentVel = (impostor.getLinearVelocity && impostor.getLinearVelocity()) || new Vector3(0, 0, 0);
        // preserve vertical velocity from physics engine (gravity handled by physics)
        const targetVel = new Vector3(horizVelocity.x, currentVel.y, horizVelocity.z);
        impostor.setLinearVelocity(targetVel);
        // sync camera above the physics collider
        const ellipsoidY = (this.camera as any).ellipsoid?.y ?? 1.0;
        const physPos = (this.physicsMesh as any).position;
        this.camera.position.copyFrom(physPos.add(new Vector3(0, ellipsoidY, 0)));
      } catch {
        // fallback if physics methods unavailable
      }
      return;
    }

    // Fallback: manual gravity + moveWithCollisions
    this.velocity.y += this.gravity * dt;
    this.velocity.y = Math.max(this.velocity.y, -50);

    const desired = new Vector3(horizVelocity.x * dt, this.velocity.y * dt, horizVelocity.z * dt);

    const camAny = this.camera as any;
    if (typeof camAny.moveWithCollisions === "function") {
      camAny.moveWithCollisions(desired);
    } else {
      this.camera.position.addInPlace(new Vector3(desired.x, 0, desired.z));
      this.camera.position.y += desired.y;
    }

    const ground = this.isGrounded(scene);
    if (ground.grounded && ground.groundY !== undefined) {
      const ellipsoidY = (this.camera as any).ellipsoid?.y ?? 1.0;
      this.camera.position.y = ground.groundY + ellipsoidY;
      this.velocity.y = 0;
    }
  }

  onPointerDown = (ev: PointerEvent) => {
    try {
      // Only treat pointer events targeting the canvas as gameplay actions (avoids GUI clicks on other DOM elements)
      if (ev.target !== this.canvas) return;

      // Right button toggles polaroid raised/lowered
      if (ev.button === 2) {
        this.polaroidRaised = !this.polaroidRaised;
        try {
          // change cursor to indicate camera raised
          document.body.style.cursor = this.polaroidRaised ? "crosshair" : "";
          if (this.polaroidRaised) {
            // create a viewfinder overlay matching final square crop
            try {
              // remove existing first to avoid duplicates
              if (this.viewfinderElement) {
                try { document.body.removeChild(this.viewfinderElement); } catch {}
                this.viewfinderElement = null;
              }
              const vf = document.createElement("div");
              vf.id = "polaroid_viewfinder";
              vf.style.position = "fixed";
              vf.style.zIndex = "9998";
              vf.style.pointerEvents = "none"; // allow clicks to pass through to canvas
              vf.style.boxSizing = "border-box";
              vf.style.border = "3px solid rgba(255,255,255,0.95)";
              vf.style.borderRadius = "6px";
              vf.style.boxShadow = "0 8px 30px rgba(0,0,0,0.6), inset 0 0 0 2px rgba(0,0,0,0.12)";
              this.viewfinderElement = vf;
              document.body.appendChild(vf);
              // initial sizing and attach resize listener
              this.updateViewfinderSize();
              window.addEventListener("resize", this.updateViewfinderSize);
            } catch {}
          } else {
            // remove viewfinder
            try {
              if (this.viewfinderElement && this.viewfinderElement.parentNode) {
                document.body.removeChild(this.viewfinderElement);
              }
              this.viewfinderElement = null;
              try { window.removeEventListener("resize", this.updateViewfinderSize); } catch {}
            } catch {}
          }
        } catch {}
        return;
      }

      // Left button:
      if (ev.button === 0) {
        if (this.polaroidRaised) {
          // If polaroid camera is raised, take a square polaroid photo using global helper if available
          try {
            const fn = (window as any).takePolaroid;
            if (typeof fn === "function") {
              try { fn(); } catch {}
              return;
            }
          } catch {}
          // fallback: emit action if polaroid helper not available
        }

        // Normal gameplay action (left click)
        try {
          window.dispatchEvent(new Event("action"));
        } catch {}
      }
    } catch {}
  };

  /**
   * Enable the controller (allows movement and looking)
   */
  enable() {
    this.enabled = true;
  }

  /**
   * Disable the controller (freezes movement and looking)
   * Also exits pointer lock to show the cursor
   */
  disable() {
    this.enabled = false;
    // Exit pointer lock to show cursor
    if (document.pointerLockElement) {
      try {
        document.exitPointerLock();
      } catch (e) {
        console.warn("Could not exit pointer lock:", e);
      }
    }
  }

  dispose() {
    if (this.disposed) return;
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    window.removeEventListener("pointerlockchange", this.onPointerLockChange);
    window.removeEventListener("mousemove", this.onMouseMove);
    this.canvas.removeEventListener("click", this.requestPointerLock);
    this.canvas.removeEventListener("pointerdown", this.onPointerDown);
    this.disposed = true;
  }
}

export function createFirstPersonController(camera: FreeCamera, canvas: HTMLCanvasElement, options?: FPControllerOptions) {
  return new FirstPersonController(camera, canvas, options);
}
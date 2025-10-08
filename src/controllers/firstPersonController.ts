import { FreeCamera, Vector3 } from "@babylonjs/core";

export type FPControllerOptions = {
  speed?: number;
};

export class FirstPersonController {
  camera: FreeCamera;
  canvas: HTMLCanvasElement;
  speed: number;
  inputMap: Record<string, boolean>;
  disposed = false;

  constructor(camera: FreeCamera, canvas: HTMLCanvasElement, options?: FPControllerOptions) {
    this.camera = camera;
    this.canvas = canvas;
    this.speed = options?.speed ?? 0.12;
    this.inputMap = {};

    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);

    // Pointer lock on click for immersive mouse look
    this.canvas.addEventListener("click", this.requestPointerLock);
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

  update() {
    const forward = this.camera.getDirection(new Vector3(0, 0, 1));
    const right = this.camera.getDirection(new Vector3(1, 0, 0));
    let move = new Vector3(0, 0, 0);
    if (this.inputMap["w"]) move = move.add(forward.scale(this.speed));
    if (this.inputMap["s"]) move = move.subtract(forward.scale(this.speed));
    if (this.inputMap["a"]) move = move.subtract(right.scale(this.speed));
    if (this.inputMap["d"]) move = move.add(right.scale(this.speed));

    if (!move.equalsWithEpsilon(Vector3.Zero())) {
      // Use engine collision helper if available, otherwise apply position directly
      const camAny = this.camera as any;
      if (typeof camAny.moveWithCollisions === "function") {
        camAny.moveWithCollisions(move);
      } else {
        this.camera.position.addInPlace(move);
      }
    }
  }

  dispose() {
    if (this.disposed) return;
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    this.canvas.removeEventListener("click", this.requestPointerLock);
    this.disposed = true;
  }
}

export function createFirstPersonController(camera: FreeCamera, canvas: HTMLCanvasElement, options?: FPControllerOptions) {
  return new FirstPersonController(camera, canvas, options);
}
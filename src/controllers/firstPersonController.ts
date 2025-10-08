import { FreeCamera, Vector3, Ray } from "@babylonjs/core";

export type FPControllerOptions = {
  speed?: number;
  gravity?: number;
};

export class FirstPersonController {
  camera: FreeCamera;
  canvas: HTMLCanvasElement;
  speed: number;
  inputMap: Record<string, boolean>;
  disposed = false;
  velocity: Vector3 = new Vector3(0, 0, 0);
  gravity: number;
  groundTolerance = 0.05;

  constructor(camera: FreeCamera, canvas: HTMLCanvasElement, options?: FPControllerOptions) {
    this.camera = camera;
    this.canvas = canvas;
    this.speed = options?.speed ?? 3.5;
    this.inputMap = {};
    this.gravity = options?.gravity ?? -9.81;

    // disable built-in gravity to manage manually
    try { (this.camera as any).applyGravity = false; } catch {}

    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
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
    const scene = this.camera.getScene();
    const engine = scene.getEngine();
    const dt = Math.max(0.001, engine.getDeltaTime() / 1000);

    // horizontal movement input
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
    const horizMove = horizLen > 0 ? horiz.normalize().scale(speedPerSec * dt) : Vector3.Zero();

    // gravity integration
    this.velocity.y += this.gravity * dt;
    this.velocity.y = Math.max(this.velocity.y, -50);

    // desired displacement
    const desired = new Vector3(horizMove.x, this.velocity.y * dt, horizMove.z);

    const camAny = this.camera as any;
    if (typeof camAny.moveWithCollisions === "function") {
      camAny.moveWithCollisions(desired);
    } else {
      this.camera.position.addInPlace(new Vector3(desired.x, 0, desired.z));
      this.camera.position.y += desired.y;
    }

    // ground check and snap
    const ground = this.isGrounded(scene);
    if (ground.grounded && ground.groundY !== undefined) {
      const ellipsoidY = (this.camera as any).ellipsoid?.y ?? 1.0;
      this.camera.position.y = ground.groundY + ellipsoidY;
      this.velocity.y = 0;
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
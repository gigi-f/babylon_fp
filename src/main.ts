import { Engine, Scene, HemisphericLight, Vector3, Color3, Color4, MeshBuilder, FreeCamera, StandardMaterial, PhysicsImpostor, TransformNode } from "@babylonjs/core";
import "@babylonjs/loaders";
import { createFirstPersonController } from "./controllers/firstPersonController";
import LoopManager, { stagedCrimeAt } from "./systems/loopManager";
import HUD from "./ui/hud";
import * as CANNON from "cannon-es";
import { CannonJSPlugin } from "@babylonjs/core/Physics/Plugins/cannonJSPlugin";
import DoorSystem, { DoorMetadata } from "./systems/doorSystem";
import DayNightCycle from "./systems/dayNightCycle";
import { registerDebugShortcuts } from "./debug/debugControls";
 
const canvas = document.getElementById("renderCanvas") as HTMLCanvasElement;
const engine = new Engine(canvas, true);
const scene = new Scene(engine);
scene.collisionsEnabled = true;
// enable physics early so impostors attach correctly
scene.enablePhysics(new Vector3(0, -9.81, 0), new CannonJSPlugin(true, 10, (CANNON as any)));
 
// Camera - simple low-fi first-person
const camera = new FreeCamera("fp_cam", new Vector3(0, 1.7, -5), scene);
camera.attachControl(canvas, true);
camera.speed = 0.09;
camera.ellipsoid = new Vector3(0.5, 1.0, 0.5);
camera.checkCollisions = true;
camera.applyGravity = true;
camera.keysUp = [];
camera.keysDown = [];
camera.keysLeft = [];
camera.keysRight = [];
 
// Light
const light = new HemisphericLight("hemi", new Vector3(0, 1, 0), scene);
light.intensity = 0.9;
 
  // Ground
 const ground = MeshBuilder.CreateGround("ground", { width: 50, height: 50 }, scene);
 ground.checkCollisions = true;
 const groundMat = new StandardMaterial("groundMat", scene);
 groundMat.diffuseColor = new Color3(0.2, 0.25, 0.2);
 ground.material = groundMat;
 // Add physics impostor so player collider rests on the ground — use PlaneImpostor for a stable floor
 ground.physicsImpostor = new PhysicsImpostor(ground, PhysicsImpostor.PlaneImpostor, { mass: 0, friction: 0.6, restitution: 0 }, scene);
 
 // Create a simple low-poly building the player can walk inside
function createBuilding(x: number, z: number, col: Color3) {
  const mat = new StandardMaterial(`mat_building_${x}_${z}`, scene);
  mat.diffuseColor = col;
  mat.specularColor = Color3.Black();
 
  // floor (thin box)
  const floor = MeshBuilder.CreateBox(`b_floor_${x}_${z}`, { width: 6, height: 0.2, depth: 6 }, scene);
  floor.position = new Vector3(x, 0.1, z);
  floor.checkCollisions = true;
  floor.material = mat;
  floor.physicsImpostor = new PhysicsImpostor(floor, PhysicsImpostor.BoxImpostor, { mass: 0, friction: 0.6, restitution: 0 }, scene);
 
  // walls (four walls, front has a doorway gap)
  const wallHeight = 2.6;
  const wallThickness = 0.2;
  const half = 3; // half-width/depth
  // back wall
  const back = MeshBuilder.CreateBox(`b_back_${x}_${z}`, { width: 6, height: wallHeight, depth: wallThickness }, scene);
  back.position = new Vector3(x, wallHeight / 2, z - half);
  back.material = mat;
  back.checkCollisions = true;
  back.physicsImpostor = new PhysicsImpostor(back, PhysicsImpostor.BoxImpostor, { mass: 0, friction: 0.6 }, scene);
 
  // left wall
  const left = MeshBuilder.CreateBox(`b_left_${x}_${z}`, { width: wallThickness, height: wallHeight, depth: 6 }, scene);
  left.position = new Vector3(x - half, wallHeight / 2, z);
  left.material = mat;
  left.checkCollisions = true;
  left.physicsImpostor = new PhysicsImpostor(left, PhysicsImpostor.BoxImpostor, { mass: 0, friction: 0.6 }, scene);
 
  // right wall
  const right = MeshBuilder.CreateBox(`b_right_${x}_${z}`, { width: wallThickness, height: wallHeight, depth: 6 }, scene);
  right.position = new Vector3(x + half, wallHeight / 2, z);
  right.material = mat;
  right.checkCollisions = true;
  right.physicsImpostor = new PhysicsImpostor(right, PhysicsImpostor.BoxImpostor, { mass: 0, friction: 0.6 }, scene);
 
  // front wall split to create a doorway in center
  const frontLeft = MeshBuilder.CreateBox(`b_frontL_${x}_${z}`, { width: 2.2, height: wallHeight, depth: wallThickness }, scene);
  frontLeft.position = new Vector3(x - 1.9, wallHeight / 2, z + half);
  frontLeft.material = mat;
  frontLeft.checkCollisions = true;
  frontLeft.physicsImpostor = new PhysicsImpostor(frontLeft, PhysicsImpostor.BoxImpostor, { mass: 0, friction: 0.6 }, scene);
 
  const frontRight = MeshBuilder.CreateBox(`b_frontR_${x}_${z}`, { width: 2.2, height: wallHeight, depth: wallThickness }, scene);
  frontRight.position = new Vector3(x + 1.9, wallHeight / 2, z + half);
  frontRight.material = mat;
  frontRight.checkCollisions = true;
  frontRight.physicsImpostor = new PhysicsImpostor(frontRight, PhysicsImpostor.BoxImpostor, { mass: 0, friction: 0.6 }, scene);
 
  // optional roof
  const roof = MeshBuilder.CreateBox(`b_roof_${x}_${z}`, { width: 6.2, height: 0.2, depth: 6.2 }, scene);
  roof.position = new Vector3(x, wallHeight + 0.1, z);
  roof.material = mat;
  roof.checkCollisions = false;
 
  return { floor, back, left, right, frontLeft, frontRight, roof };
}
 
// Remove cube field and create a single building at origin
createBuilding(0, 0, new Color3(0.7, 0.65, 0.6));
 
/*
  Create an interactable door placed in the front doorway.
  Metadata: { isDoor: true, isOpen: false }
  Use a pivot so rotation opens naturally around the left edge.
*/
const doorWidth = 1.6;
const doorHeight = 2.0;
const doorDepth = 0.12;
const door = MeshBuilder.CreateBox("door_main", { width: doorWidth, height: doorHeight, depth: doorDepth }, scene);
// place door centered in the doorway slightly inset
door.position = new Vector3(0, doorHeight / 2, 3);
// simple material so door is visible
const doorMat = new StandardMaterial("doorMat", scene);
doorMat.diffuseColor = new Color3(0.55, 0.35, 0.25);
door.material = doorMat;
// metadata for door system
(door as any).metadata = { isDoor: true, isOpen: false } as DoorMetadata;
// set pivot to left edge so rotation behaves like a hinged door
try {
  (door as any).setPivotPoint(new Vector3(-doorWidth / 2, 0, 0));
} catch {}
 
 // physics already enabled above
 
// create an invisible physics collider for the player and sync camera to it
const playerCollider = MeshBuilder.CreateSphere("player_collider", { diameter: 1 }, scene);
playerCollider.isVisible = false;
playerCollider.position = camera.position.add(new Vector3(0, 1, 0));
playerCollider.physicsImpostor = new PhysicsImpostor(playerCollider, PhysicsImpostor.SphereImpostor, { mass: 1, friction: 0.0, restitution: 0 }, scene);
 
// Controller (pass physics mesh so controller drives physics)
const fpController = createFirstPersonController(camera, canvas, { speed: 5, physicsMesh: playerCollider });
 
  // Basic movement forwarded to controller
 function updateMovement() {
   fpController.update();
 }
 
 // Simple UI: show FPS in title
const loop = new LoopManager(scene, 120, 1);
loop.start();
 // schedule a sample staged crime 5s into the loop
loop.scheduleEvent("crime1", 5, stagedCrimeAt(scene, { x: 0, y: 0.5, z: 0 }));
 
 // Start day/night cycle and HUD.
 // Create a reusable DayNightCycle and let HUD subscribe to it for synchronized visuals.
 const cycle = new DayNightCycle(scene, { dayMs: 60_000, nightMs: 60_000, sunIntensity: 1.2, moonIntensity: 0.35 });
 (window as any).dayNightCycle = cycle;
 try {
   const disposeDebug = registerDebugShortcuts();
   (window as any).debugDispose = disposeDebug;
 } catch {}

  // Sync ambient hemispheric light to cycle for smooth transitions (non-linear curve).
  cycle.onTick((s) => {
    try {
      const base = 0.12; // minimum ambient
      const amplitude = 1.0 - base; // scale so max = 1.0
      // define sky colors (night -> day). Mid-day will be a bright light blue.
      const nightSky = { r: 0.02, g: 0.04, b: 0.12 };
      const daySky = { r: 0.53, g: 0.81, b: 0.92 }; // bright light blue at midday
      let skyFactor = 0;
 
      if (s.isDay) {
        const p = Math.max(0, Math.min(1, s.dayProgress)); // 0..1
        let brightnessNorm = 0; // normalized 0..1 brightness curve
        // Piecewise curve:
        // 0..0.1 -> quickly rise to 0.9
        // 0.1..0.5 -> gentle rise 0.9 -> 1.0 (noon)
        // 0.5..0.9 -> gentle fall 1.0 -> 0.9
        // 0.9..1.0 -> fall 0.9 -> 0.0 (sunset)
        if (p <= 0.1) {
          // ease-out to 0.9
          const t = p / 0.1;
          brightnessNorm = 0.9 * Math.sqrt(t);
        } else if (p <= 0.5) {
          const t = (p - 0.1) / 0.4;
          brightnessNorm = 0.9 + (1.0 - 0.9) * t;
        } else if (p <= 0.9) {
          const t = (p - 0.5) / 0.4;
          brightnessNorm = 1.0 - (1.0 - 0.9) * t;
        } else {
          const t = (p - 0.9) / 0.1;
          brightnessNorm = 0.9 * (1.0 - t); // goes to 0 at p=1
        }
        // clamp
        brightnessNorm = Math.max(0, Math.min(1, brightnessNorm));
        light.intensity = base + amplitude * brightnessNorm;
        skyFactor = brightnessNorm;
      } else {
        // Night curve mirrors day but scaled: moon max is 30% of day's max brightness (absolute intensity 0.3)
        const p = Math.max(0, Math.min(1, s.nightProgress)); // 0..1
        let moonNorm = 0;
        if (p <= 0.1) {
          const t = p / 0.1;
          moonNorm = 0.9 * Math.sqrt(t);
        } else if (p <= 0.5) {
          const t = (p - 0.1) / 0.4;
          moonNorm = 0.9 + (1.0 - 0.9) * t;
        } else if (p <= 0.9) {
          const t = (p - 0.5) / 0.4;
          moonNorm = 1.0 - (1.0 - 0.9) * t;
        } else {
          const t = (p - 0.9) / 0.1;
          moonNorm = 0.9 * (1.0 - t);
        }
        moonNorm = Math.max(0, Math.min(1, moonNorm));
        const nightMax = 0.3; // absolute intensity at moon peak
        light.intensity = base + (nightMax - base) * moonNorm;
        skyFactor = 0; // keep skyColor as night
      }
 
      // interpolate sky color between nightSky and daySky using skyFactor
      const r = nightSky.r * (1 - skyFactor) + daySky.r * skyFactor;
      const g = nightSky.g * (1 - skyFactor) + daySky.g * skyFactor;
      const b = nightSky.b * (1 - skyFactor) + daySky.b * skyFactor;
      scene.clearColor = new Color4(r, g, b, 1.0);
    } catch {}
  });

 // HUD reads cycle to position sun/moon and display timer
 HUD.start(scene, { dayMs: 60_000, nightMs: 60_000, sunImagePath: "/assets/ui/sun.png", moonImagePath: "/assets/ui/moon.png", cycle });
 
 // Instantiate DoorSystem (handles prompt, toggles, and blocker setup)
 const doorSystem = new DoorSystem(scene, camera);
 (window as any).doorSystem = doorSystem;
 
engine.runRenderLoop(() => {
  // update loop with delta seconds
  loop.update(engine.getDeltaTime() / 1000);
  updateMovement();
  scene.render();
  document.title = `Babylon FP — ${engine.getFps().toFixed(0)} FPS`;
});
 
// Resize
window.addEventListener("resize", () => engine.resize());
 
// Export for debugging
(window as any).scene = scene;
(window as any).engine = engine;
(window as any).camera = camera;
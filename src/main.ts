import { Engine, Scene, HemisphericLight, Vector3, Color3, MeshBuilder, FreeCamera, StandardMaterial, PhysicsImpostor } from "@babylonjs/core";
import "@babylonjs/loaders";
import { createFirstPersonController } from "./controllers/firstPersonController";
import LoopManager, { stagedCrimeAt } from "./systems/loopManager";
import * as CANNON from "cannon-es";
import { CannonJSPlugin } from "@babylonjs/core/Physics/Plugins/cannonJSPlugin";

const canvas = document.getElementById("renderCanvas") as HTMLCanvasElement;
const engine = new Engine(canvas, true);
const scene = new Scene(engine);
scene.collisionsEnabled = true;
// enable physics early so impostors attach correctly
scene.enablePhysics(new Vector3(0, -9.81, 0), new CannonJSPlugin(true, 10, (CANNON as any)));

// Camera - simple low-fi first-person
const camera = new FreeCamera("fp_cam", new Vector3(0, 1.7, -5), scene);
camera.attachControl(canvas, true);
camera.speed = 0.12;
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
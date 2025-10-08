import { Engine, Scene, HemisphericLight, Vector3, Color3, MeshBuilder, FreeCamera, StandardMaterial, PhysicsImpostor } from "@babylonjs/core";
import "@babylonjs/loaders";
import { createFirstPersonController } from "./controllers/firstPersonController";
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

// Create a simple low-poly environment
function createBox(x: number, z: number, col: Color3) {
  const box = MeshBuilder.CreateBox(`box_${x}_${z}`, { size: 1 }, scene);
  box.position = new Vector3(x, 0.5, z);
  box.checkCollisions = true;
  const mat = new StandardMaterial(`mat_box_${x}_${z}`, scene);
  mat.diffuseColor = col;
  mat.specularColor = Color3.Black();
  box.material = mat;

  // add static physics body so player collides
  box.physicsImpostor = new PhysicsImpostor(box, PhysicsImpostor.BoxImpostor, { mass: 0, friction: 0.5, restitution: 0 }, scene);
  return box;
}

for (let i = -6; i <= 6; i += 2) {
  for (let j = -6; j <= 6; j += 2) {
    createBox(i, j, new Color3(Math.random() * 0.6 + 0.2, Math.random() * 0.6 + 0.1, Math.random() * 0.6 + 0.1));
  }
}

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
engine.runRenderLoop(() => {
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
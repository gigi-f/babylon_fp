import { Engine, Scene, HemisphericLight, Vector3, Color3, Color4, MeshBuilder, FreeCamera, StandardMaterial, PhysicsImpostor, TransformNode, MirrorTexture, Plane } from "@babylonjs/core";
import "@babylonjs/loaders";
import { createFirstPersonController } from "./controllers/firstPersonController";
import { loadModel } from "./systems/assetPipeline";
import LoopManager, { stagedCrimeAt } from "./systems/loopManager";
import HUD from "./ui/hud";
import * as CANNON from "cannon-es";
import { CannonJSPlugin } from "@babylonjs/core/Physics/Plugins/cannonJSPlugin";
import DoorSystem, { DoorMetadata } from "./systems/doorSystem";
import DayNightCycle from "./systems/dayNightCycle";
import StreetLamp from "./systems/streetLamp";
import { registerDebugShortcuts } from "./debug/debugControls";
import HourlyCycle from "./systems/hourlyCycle";
import NpcSystem from "./systems/npcSystem";
 
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
// reduce near plane to avoid immediate intersection with player collider (helps clipping)
try { camera.minZ = 0.1; } catch {}
 
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
 
 // Create a planar mirror on the interior wall (uses MirrorTexture to render a planar reflection).
 // The mirror will include the player visual once it's loaded.
 let mirrorTex: MirrorTexture | null = null;
 // Mirror mesh handle must be visible to later code (rotation sync); declare here.
 let mirror: any = null;
 // Dedicated layer mask for the player-visual so we can exclude it from the main camera
 const PLAYER_LAYER = 1 << 28;
 try {
   const mirrorMat = new StandardMaterial("mirror_mat", scene);
   try {
     // MirrorTexture(size, scene, useMips)
     mirrorTex = new MirrorTexture("mirror_rt", 512, scene, true);
     // mirror plane faces the +Z direction (plane normal pointing toward camera)
     mirrorTex.mirrorPlane = new Plane(0, 0, -1, 0);
     // we'll populate renderList after player model loads
     mirrorMat.reflectionTexture = mirrorTex as any;
     mirrorMat.disableLighting = false;
     mirrorMat.reflectionTexture!.level = 1.0;
   } catch (e) {
     // If MirrorTexture isn't available or fails, leave mirrorTex null and continue
     console.warn("[Main] MirrorTexture setup failed:", e);
     mirrorTex = null;
   }

   mirror = MeshBuilder.CreatePlane("mirror_plane", { width: 1.2, height: 1.6 }, scene);
   // place mirror on the building's inner wall (slightly inset)
   mirror.position = new Vector3(0, 1.2, 2.98);
   mirror.rotation = new Vector3(0, Math.PI, 0); // face towards -Z (player)
   mirror.material = mirrorMat;
   mirror.isPickable = false;
 } catch (e) {
   console.warn("[Main] failed to create mirror:", e);
   mirrorTex = null;
 }

 // Load player visual model (rahul.glb) and attach to the player collider so it follows the player's physics.
 // This model is primarily for mirror reflections and future cutscenes; it won't affect first-person collision.
 try {
   loadModel(scene, "/assets/3d/painted_rahul/", "rahul.glb")
     .then((meshes) => {
       try {
         const root = new TransformNode("player_visual_root", scene);
         for (const m of meshes) {
           try {
             // parent mesh under root so transformations are centralized
             m.setParent(root);
             // be conservative: avoid interfering with gameplay picking
             try { m.isPickable = false; } catch {}
             try { (m as any).receiveShadows = true; } catch {}
           } catch {}
         }

         // Parent the visual root to the physics collider so it follows the player's position/rotation.
         root.parent = playerCollider;

         // Offset so the model's eyes roughly align with the camera height.
         // Camera is at ~1.7m; collider origin is at player's feet — adjust down by ~1.0m
         root.position = new Vector3(0, -1.0, 0);
         root.scaling = new Vector3(1, 1, 1);

         // Keep a global handle for debugging and cutscene control
         try { (window as any).playerVisual = root; } catch {}
         console.log("[Main] player model rahul.glb loaded and attached");

         // Ensure the player visual yaw follows where the player is looking.
         // When the player is looking at the mirror, make the visual face the mirror so
         // the reflection shows the front of the model. Otherwise align to camera yaw.
         try {
           const syncVisualYaw = () => {
             try {
               if (!root || !camera) return;
               // If mirror exists, check whether camera is looking toward it.
               if (typeof mirror !== "undefined" && mirror && typeof mirror.getAbsolutePosition === "function") {
                 try {
                   const toMirror = mirror.getAbsolutePosition().subtract(root.getAbsolutePosition());
                   // Avoid zero-length vectors
                   if (toMirror.length() <= 0.0001) {
                     root.rotation.y = camera.rotation?.y ?? root.rotation.y;
                     return;
                   }
                 
                 } catch {}
               }
               // Default: copy camera yaw so visual matches player's facing direction.
               root.rotation.y = camera.rotation?.y ?? root.rotation.y;
             } catch {}
           };
           // Update immediately and then each frame
           try { syncVisualYaw(); } catch {}
           const rotObs = scene.onBeforeRenderObservable.add(() => {
             try { syncVisualYaw(); } catch {}
           });
           try { (window as any).playerVisualRotObserver = rotObs; } catch {}
         } catch (e) {
           console.warn("[Main] failed to setup playerVisual rotation sync:", e);
         }

         // Add loaded meshes to mirror render list so the player appears in the planar reflection.
         // Only add real mesh objects (avoid TransformNode or non-mesh items) to prevent renderer errors.
         try {
           if (mirrorTex && Array.isArray((mirrorTex as any).renderList)) {
             const candidateMeshes = (typeof (root as any).getChildMeshes === "function" ? (root as any).getChildMeshes() : meshes) || [];
             // Exclude player meshes from main camera by assigning them to PLAYER_LAYER,
             // then explicitly add them to the mirror renderList so the mirror still sees them.
             for (const cm of candidateMeshes) {
               try {
                 // quick duck-type check for Mesh: presence of vertex data accessor
                 if (cm && typeof (cm as any).getVerticesData === "function") {
                   try {
                     // set mesh layer so main camera won't render it
                     (cm as any).layerMask = PLAYER_LAYER;
                   } catch {}
                   // add to mirror render list
                   (mirrorTex as any).renderList!.push(cm);
                 }
               } catch {}
             }
             // Ensure the main camera excludes the PLAYER_LAYER (safety: do not overwrite other bits)
             try {
               camera.layerMask = (typeof camera.layerMask === "number") ? (camera.layerMask & ~PLAYER_LAYER) : camera.layerMask;
             } catch {}
             // If MirrorTexture exposes an internal mirrorCamera, ensure it will render the PLAYER_LAYER too.
             try {
               const mcam = (mirrorTex as any).mirrorCamera || (mirrorTex as any).activeCamera;
               if (mcam && typeof mcam.layerMask === "number") {
                 mcam.layerMask = mcam.layerMask | PLAYER_LAYER;
               }
             } catch {}
           }
         } catch (e) {
           console.warn("[Main] failed to add player visual to mirror renderList or configure layers:", e);
         }
       } catch (e) {
         console.warn("[Main] error attaching player model:", e);
       }
     })
     .catch((err) => {
       console.warn("[Main] failed to load player model rahul.glb:", err);
     });
 } catch (e) {
   console.warn("[Main] loadModel invocation failed:", e);
 }
 
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
 
 // Example streetlamp(s) — modular and reusable. Place more by creating additional instances.
 try {
   const lamp1 = new StreetLamp(scene, new Vector3(3.6, 0, 2.7));
   lamp1.attachToCycle(cycle);
   // expose for debugging and potential future management
   (window as any).streetLamps = (window as any).streetLamps || [];
   (window as any).streetLamps.push(lamp1);
 } catch (e) {
   console.warn("[Main] failed to create street lamp:", e);
 }

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
 
   // Hourly helper + NPC system: create hourly cycle wrapper and a simple NPC to verify visibility
   try {
     // totalMs matches DayNightCycle dayMs + nightMs used above (60_000 + 60_000)
     const hourly = new HourlyCycle(cycle, 60_000 + 60_000);
     const npcSystem = new NpcSystem(scene, hourly);
     (window as any).npcSystem = npcSystem;
 
     // sample NPC schedule: 6am (inside), 9am (out front), 12pm (side)
     npcSystem.createNpc(
       "alice",
       {
         6: new Vector3(0, 0, 0),   // inside building (floor center)
         9: new Vector3(0, 0, 4),   // out front of building
         12: new Vector3(2, 0, 4),  // side of building
       },
       { color: new Color3(0.8, 0.7, 0.6), size: 0.6 }
     );
   } catch (e) {
     console.warn("[Main] failed to create NPC system:", e);
   }
 
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
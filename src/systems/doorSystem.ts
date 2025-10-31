import {
  Scene,
  FreeCamera,
  AbstractMesh,
  Vector3,
  Animation,
  TransformNode,
  Nullable,
  Observer,
  MeshBuilder,
  PhysicsImpostor,
  Mesh,
} from "@babylonjs/core";
import { AdvancedDynamicTexture, TextBlock } from "@babylonjs/gui";
import { Logger } from "../utils/logger";

const logger = Logger.create("DoorSystem");
 
/**
 * Metadata shape attached to door meshes.
 */
export type DoorMetadata = {
  isDoor: true;
  isOpen: boolean;
  isAnimating?: boolean;
  // optional runtime blocker mesh created by the system
  blocker?: AbstractMesh;
  swingDirection?: number;
  closedRotation?: number;
};
 
/**
 * DoorSystem
 *
 * - Displays a screen-space "open door" label above any closed door the player is near and looking at.
 * - Listens for a global "action" event (window) and toggles any door the player is looking at within range.
 * - Creates an invisible physics blocker so closed doors prevent player passage.
 * - Logs debug events (detection, prompt show/hide, actions, animation start/end).
 */
export default class DoorSystem {
  private scene: Scene;
  private camera: FreeCamera;
  private ui: AdvancedDynamicTexture;
  private label: TextBlock;
  private onFrameObserver: Nullable<Observer<Scene>> = null;
  private actionListener: (ev: Event) => void;
  private currentDoor: Nullable<AbstractMesh> = null;
  private readonly range = 2.5; // units (per requirement)
  private animFrameRate = 60;
  private animDurationSec = 0.3;
 
  constructor(scene: Scene, camera: FreeCamera) {
    this.scene = scene;
    this.camera = camera;
 
    logger.debug("Initializing DoorSystem", { 
      collisionsEnabled: this.scene.collisionsEnabled, 
      cameraCheckCollisions: !!(this.camera as any).checkCollisions 
    });
 
    // Create a dedicated fullscreen UI for door prompts so HUD usage is independent.
    this.ui = AdvancedDynamicTexture.CreateFullscreenUI("door_ui");
    this.label = new TextBlock("door_prompt");
    this.label.text = "";
    this.label.color = "white";
    this.label.fontSize = 18;
    this.label.isVisible = false;
    this.label.isPointerBlocker = false;
    this.ui.addControl(this.label);
 
    // frame update
    this.onFrameObserver = this.scene.onBeforeRenderObservable.add(() => this.onFrame());
 
    // action handler - toggle when appropriate
    this.actionListener = (ev: Event) => {
      logger.debug("Action event received");
      this.onAction();
    };
    window.addEventListener("action", this.actionListener);
  }
 
  dispose() {
    try {
      if (this.onFrameObserver) {
        this.scene.onBeforeRenderObservable.remove(this.onFrameObserver);
      }
    } catch {}
    try {
      this.ui.getChildren().forEach((c) => this.ui.removeControl(c));
      this.ui.dispose();
    } catch {}
    window.removeEventListener("action", this.actionListener);
    this.currentDoor = null;
  }
 
  private onFrame() {
    // find nearest door in range that is closed and not animating, and check if camera is roughly looking at it
    const cameraPos = this.camera.position;
    let foundDoor: Nullable<AbstractMesh> = null;
 
    for (const m of this.scene.meshes) {
      const md = (m.metadata || {}) as Partial<DoorMetadata>;
      if (!md.isDoor) continue;
 
      // skip if open or animating
      if (md.isOpen) continue;
      if (md.isAnimating) continue;
 
      const doorPos = m.getAbsolutePosition();
      const dist = Vector3.Distance(cameraPos, doorPos);
      if (dist > this.range) continue;
 
      // check forward ray hit (short range)
      const ray = this.camera.getForwardRay(this.range);
      const pick = this.scene.pickWithRay(ray, (mesh) => !!mesh && mesh === m);
      if (pick && pick.hit && pick.pickedMesh === m) {
        foundDoor = m;
        logger.debug("Door detected in range", { name: m.name, distance: dist.toFixed(2) });
        break;
      }
    }
 
    if (foundDoor) {
      if (this.currentDoor !== foundDoor) {
        logger.debug("Showing prompt for door", { name: foundDoor.name });
      }
      this.currentDoor = foundDoor;
      this.showLabelAbove(foundDoor, "open door");
    } else {
      if (this.currentDoor) {
        logger.debug("Hiding prompt");
      }
      this.currentDoor = null;
      // unlink from any mesh
      try {
        (this.label as any).linkWithMesh(null);
      } catch {}
      this.label.isVisible = false;
    }
  }
 
  private showLabelAbove(door: AbstractMesh, text: string) {
    this.label.text = text;
    // Use GUI's linkWithMesh so the label follows the mesh in screen space.
    try {
      (this.label as any).linkWithMesh(door);
      // offset upwards so it hovers above the door
      (this.label as any).linkOffsetY = -40;
    } catch {
      // If linkWithMesh not available for some reason, fallback to simple visibility
    }
    this.label.isVisible = true;
  }
 
  private onAction() {
    // If we're currently showing a door prompt and have a currentDoor, attempt to toggle it.
    if (!this.currentDoor) {
      logger.debug("Action: no current door");
      return;
    }
 
    // Confirm the player is still looking at the door via a forward raycast
    const ray = this.camera.getForwardRay(this.range);
    const pick = this.scene.pickWithRay(ray);
    if (!pick || !pick.hit || !pick.pickedMesh) {
      logger.debug("Action: raycast missed");
      return;
    }
    const picked = pick.pickedMesh;
    if (picked !== this.currentDoor) {
      logger.debug("Action: picked different mesh", { pickedName: picked?.name });
      return;
    }
 
    const meta = (this.currentDoor.metadata || {}) as DoorMetadata;
    // runtime assertion - convert to logger
    if (meta.isDoor !== true) {
      logger.warn("Sanity check failed: mesh missing isDoor metadata", { name: this.currentDoor.name });
    }
    if (meta.isAnimating) {
      logger.debug("Action ignored: door animating");
      return; // ignore while animating
    }
 
    logger.info("Toggling door", { name: this.currentDoor.name });
    this.toggleDoor(this.currentDoor);
  }
 
  private toggleDoor(door: AbstractMesh) {
    // Ensure metadata exists
    if (!door.metadata) door.metadata = {};
    const meta = door.metadata as DoorMetadata;
    meta.isAnimating = true;
 
    // ensure door is collidable for both visual/engine collision checks
    try {
      door.checkCollisions = true;
    } catch {}
 
    // Door hinge is expected to be the parent TransformNode (created by author).
    let hinge = door.parent as Nullable<TransformNode>;
    if (!hinge) {
      // If no hinge, create a hinge at the door's left edge (best-effort)
      const doorWorldPos = door.getAbsolutePosition();
      // left edge offset in local X (assumes door local +X points right)
      const bbox = door.getBoundingInfo().boundingBox;
      const halfWidth = (bbox.maximumWorld.x - bbox.minimumWorld.x) / 2;
      hinge = new TransformNode(`${door.name}_hinge`, this.scene);
      hinge.position = new Vector3(doorWorldPos.x - halfWidth, doorWorldPos.y, doorWorldPos.z);
      // reparent door so rotation occurs around hinge
      door.setParent(hinge);
      logger.debug("Created hinge for door", { name: door.name, position: hinge.position.asArray() });
    }
 
    const actualHinge = hinge as TransformNode;
    if (meta.closedRotation === undefined) {
      meta.closedRotation = actualHinge.rotation.y;
    }
    if (!meta.swingDirection || meta.swingDirection === 0) {
      meta.swingDirection = 1;
    }
 
    // Ensure blocker exists (in metadata) - blocker is an invisible static physics box used to block player's physics collider
    if (!meta.blocker) {
      // size from bounding box (world)
      const minW = door.getBoundingInfo().boundingBox.minimumWorld;
      const maxW = door.getBoundingInfo().boundingBox.maximumWorld;
      const size = maxW.subtract(minW);
      const blocker = MeshBuilder.CreateBox(`${door.name}_blocker`, { width: size.x, height: size.y, depth: size.z }, this.scene);
      blocker.isVisible = false;
      blocker.checkCollisions = true;
      blocker.position = door.getAbsolutePosition();
      // create static physics impostor so it blocks the player's physics sphere
      try {
        blocker.physicsImpostor = new PhysicsImpostor(blocker, PhysicsImpostor.BoxImpostor, { mass: 0, friction: 0.6 }, this.scene);
      } catch (e) {
        logger.warn("Blocker physics creation failed", { error: e });
      }
      meta.blocker = blocker;
      logger.debug("Created blocker for door", { name: door.name });
    } else {
      // ensure blocker is positioned at door when closed
      try {
        meta.blocker.position = door.getAbsolutePosition();
      } catch {}
    }
 
    const wasOpen = !!meta.isOpen;
    const isOpening = !wasOpen;
    logger.debug("Animation start", { name: door.name, opening: isOpening });
 
    // If opening, we allow passage during animation by disabling the blocker physics at start
    if (isOpening && meta.blocker && meta.blocker.physicsImpostor) {
      try {
        meta.blocker.physicsImpostor.dispose();
        meta.blocker.physicsImpostor = undefined as any;
        logger.debug("Blocker disabled for opening");
      } catch {}
    }
 
    // animation: rotate hinge around Y by +/- 90 degrees relative to current hinge rotation
    const start = actualHinge.rotation.y;
    const swingDir = meta.swingDirection || 1;
    if (meta.closedRotation === undefined) {
      meta.closedRotation = meta.isOpen ? start - swingDir * (Math.PI / 2) : start;
    }
    const closedAngle = meta.closedRotation;
    const openAngle = closedAngle + swingDir * (Math.PI / 2);
    const target = wasOpen ? closedAngle : openAngle;
 
    const totalFrames = Math.ceil(this.animFrameRate * this.animDurationSec);
    const anim = new Animation(
      `${door.name}_open_anim`,
      "rotation.y",
      this.animFrameRate,
      Animation.ANIMATIONTYPE_FLOAT,
      Animation.ANIMATIONLOOPMODE_CONSTANT
    );
 
    const keys = [
      { frame: 0, value: start },
      { frame: totalFrames, value: target },
    ];
    anim.setKeys(keys);
    actualHinge.animations = actualHinge.animations || [];
    actualHinge.animations.push(anim);
 
    // Start animation and handle completion
    const onAnimationDone = () => {
      try {
        // toggle open flag
        meta.isOpen = !wasOpen;
      } catch {}
      meta.isAnimating = false;
      // Hide label if now open (we only show when closed)
      this.label.isVisible = !meta.isOpen;
      try {
        (this.label as any).linkWithMesh(null);
      } catch {}
 
      // If we just closed the door, ensure blocker physics exists and is correctly positioned
      if (!meta.isOpen && meta.blocker) {
        try {
          meta.blocker.position = door.getAbsolutePosition();
          if (!meta.blocker.physicsImpostor) {
            meta.blocker.physicsImpostor = new PhysicsImpostor(meta.blocker, PhysicsImpostor.BoxImpostor, { mass: 0, friction: 0.6 }, this.scene);
          }
          logger.debug("Blocker enabled after close");
        } catch (e) {
          logger.warn("Failed to enable blocker after close", { error: e });
        }
      }
 
      // If we just opened, ensure blocker is not blocking
      if (meta.isOpen && meta.blocker && meta.blocker.physicsImpostor) {
        try {
          meta.blocker.physicsImpostor.dispose();
          meta.blocker.physicsImpostor = undefined as any;
          logger.debug("Blocker disabled after open");
        } catch {}
      }
 
      logger.debug("Animation end", { name: door.name, isOpen: !!meta.isOpen });
    };
 
    this.scene.beginAnimation(actualHinge, 0, totalFrames, false, 1, () => {
      // remove animation from hinge to avoid duplicates when toggling repeatedly
      try {
        actualHinge.animations = (actualHinge.animations || []).filter((a) => a !== anim);
      } catch {}
      onAnimationDone();
    });
  }
}
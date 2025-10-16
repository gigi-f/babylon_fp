import { Scene, TransformNode, MeshBuilder, StandardMaterial, Color3, Vector3, AbstractMesh, DynamicTexture } from "@babylonjs/core";
import HourlyCycle, { HourInfo } from "./hourlyCycle";
import { semanticHourToLoopPercent } from "./timeSync";
import type { NpcDefinition, ScheduleEntry } from "../content/schemas";

/**
 * NPC schedule:
 * - maps hourIndex (0..23) -> destination Vector3 in world space
 * - NPC position is interpolated smoothly along the loop between defined schedule points.
 */
export type NpcSchedule = Record<number, Vector3>;

export type NpcOptions = {
  name?: string;
  color?: Color3;
  size?: number;
  // optional visible root offset
  offset?: Vector3;
};

export class NPC {
  public root: TransformNode;
  public body: AbstractMesh;
  public name: string;
  public size: number;
  public color: Color3;
  public schedule: NpcSchedule;
  private lastPos: Vector3;
  private bobPhaseOffset: number;
  private leftArm?: AbstractMesh;
  private rightArm?: AbstractMesh;
  private leftLeg?: AbstractMesh;
  private rightLeg?: AbstractMesh;
 
  constructor(scene: Scene, name: string, schedule: NpcSchedule, opts?: NpcOptions) {
    this.name = name;
    this.schedule = { ...schedule }; // shallow copy
    this.size = opts?.size ?? 0.6;
    this.color = opts?.color ?? new Color3(0.9, 0.8, 0.6);
 
    this.root = new TransformNode(`npc_${name}_root`, scene);
    if (opts?.offset) this.root.position = opts.offset.clone();
 
    // Create Minecraft-style humanoid NPC
    this.buildMinecraftStyleNPC(scene, name);
 
    this.body = this.root.getChildMeshes()[0] as AbstractMesh;
    this.lastPos = this.root.position.clone();
    this.bobPhaseOffset = Math.random() * Math.PI * 2;
  }

  /**
   * Build a Minecraft-style NPC with head, body, arms, and legs
   */
  private buildMinecraftStyleNPC(scene: Scene, name: string): void {
    const blockSize = this.size;
    
    // Shirt material (torso and arms - use base color)
    const shirtMat = new StandardMaterial(`npc_mat_${name}_shirt`, scene);
    shirtMat.diffuseColor = this.color;
    
    // Pants material (legs - darker shade of base color)
    const pantsMat = new StandardMaterial(`npc_mat_${name}_pants`, scene);
    // Make pants darker by multiplying RGB by 0.6
    pantsMat.diffuseColor = new Color3(
      this.color.r * 0.6,
      this.color.g * 0.6,
      this.color.b * 0.6
    );
    
    // Create torso (main body block)
    const torsoWidth = blockSize * 0.8;
    const torsoHeight = blockSize * 1.2;
    const torsoDepth = blockSize * 0.4;
    
    // Raise the entire NPC higher to prevent floor sinking
    const heightOffset = blockSize * 1.0; // Lift NPC up by 1.0 * blockSize
    
    const torso = MeshBuilder.CreateBox(
      `npc_${name}_torso`,
      { width: torsoWidth, height: torsoHeight, depth: torsoDepth },
      scene
    );
    torso.parent = this.root;
    torso.position = new Vector3(0, heightOffset + torsoHeight / 2, 0);
    torso.material = shirtMat;
    
    // Create head with face texture
    const headSize = blockSize * 0.8;
    const head = MeshBuilder.CreateBox(
      `npc_${name}_head`,
      { width: headSize, height: headSize, depth: headSize },
      scene
    );
    head.parent = this.root;
    head.position = new Vector3(0, heightOffset + torsoHeight + headSize / 2, 0);
    
    // Create face texture
    const faceMat = new StandardMaterial(`npc_mat_${name}_face`, scene);
    const faceTexture = new DynamicTexture(`npc_face_${name}`, 64, scene);
    const ctx = faceTexture.getContext();
    
    // Draw a simple face (eyes, nose, mouth) on the texture
    ctx.fillStyle = this.color.toHexString();
    ctx.fillRect(0, 0, 64, 64);
    
    // Eyes (two black rectangles)
    ctx.fillStyle = '#000000';
    ctx.fillRect(16, 20, 8, 8); // left eye
    ctx.fillRect(40, 20, 8, 8); // right eye
    
    // Nose (small brown rectangle in center)
    ctx.fillStyle = '#8B4513';
    ctx.fillRect(28, 32, 8, 6);
    
    // Mouth (dark line)
    ctx.fillStyle = '#000000';
    ctx.fillRect(20, 45, 24, 3);
    
    faceTexture.update();
    faceMat.diffuseTexture = faceTexture;
    head.material = faceMat;
    
    // Create arms
    const armWidth = blockSize * 0.3;
    const armHeight = torsoHeight * 0.8;
    const armDepth = blockSize * 0.3;
    
    // Left arm
    this.leftArm = MeshBuilder.CreateBox(
      `npc_${name}_leftArm`,
      { width: armWidth, height: armHeight, depth: armDepth },
      scene
    );
    this.leftArm.parent = this.root;
    this.leftArm.position = new Vector3(
      -(torsoWidth / 2 + armWidth / 2),
      heightOffset + torsoHeight * 0.7,
      0
    );
    this.leftArm.material = shirtMat;
    
    // Right arm
    this.rightArm = MeshBuilder.CreateBox(
      `npc_${name}_rightArm`,
      { width: armWidth, height: armHeight, depth: armDepth },
      scene
    );
    this.rightArm.parent = this.root;
    this.rightArm.position = new Vector3(
      torsoWidth / 2 + armWidth / 2,
      heightOffset + torsoHeight * 0.7,
      0
    );
    this.rightArm.material = shirtMat;
    
    // Create legs
    const legWidth = blockSize * 0.35;
    const legHeight = torsoHeight * 0.9;
    const legDepth = blockSize * 0.35;
    
    // Left leg
    this.leftLeg = MeshBuilder.CreateBox(
      `npc_${name}_leftLeg`,
      { width: legWidth, height: legHeight, depth: legDepth },
      scene
    );
    this.leftLeg.parent = this.root;
    this.leftLeg.position = new Vector3(
      -torsoWidth / 4,
      heightOffset - legHeight / 2,
      0
    );
    this.leftLeg.material = pantsMat;
    
    // Right leg
    this.rightLeg = MeshBuilder.CreateBox(
      `npc_${name}_rightLeg`,
      { width: legWidth, height: legHeight, depth: legDepth },
      scene
    );
    this.rightLeg.parent = this.root;
    this.rightLeg.position = new Vector3(
      torsoWidth / 4,
      heightOffset - legHeight / 2,
      0
    );
    this.rightLeg.material = pantsMat;
  }
 
  /**
   * Smoothly update NPC toward a new target position, rotate to face movement direction,
   * and apply a small walking bob while moving.
   */
  public updateTo(target: Vector3) {
    try {
      const smoothing = 0.15; // interpolation factor (0..1)
      const cur = this.lastPos;
      const dx = target.x - cur.x;
      const dz = target.z - cur.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
 
      // new base (without bob)
      const nx = cur.x + dx * smoothing;
      const nz = cur.z + dz * smoothing;
      const nyBase = target.y;
 
      // simple bobbing animation tied to wall-clock time
      const t = Date.now() / 300;
      const bobAmp = Math.min(0.04, 0.04 * (dist > 0.001 ? 1 : 0)); // only bob when moving
      const bob = Math.sin(t + this.bobPhaseOffset) * bobAmp;
 
      // apply final position (include bob on Y)
      this.root.position = new Vector3(nx, nyBase + bob, nz);
 
      // rotate to face movement direction if moving
      if (dist > 0.001) {
        // angle so 0 points toward +Z; atan2 expects (x, z) to compute yaw
        const angle = Math.atan2(dx, dz);
        this.root.rotation.y = angle;
        
        // Animate arms and legs swinging while walking
        this.animateLimbs(t, dist);
      } else {
        // Reset limbs to idle position when not moving
        this.resetLimbs();
      }
 
      // store last base position (without bob)
      this.lastPos = new Vector3(nx, nyBase, nz);
    } catch {}
  }

  /**
   * Animate arms and legs with a swinging motion while walking
   */
  private animateLimbs(time: number, distance: number): void {
    if (!this.leftArm || !this.rightArm || !this.leftLeg || !this.rightLeg) return;
    
    const swingSpeed = 2.0; // How fast limbs swing
    const armSwingAmp = 0.3; // Arm swing amplitude in radians
    const legSwingAmp = 0.4; // Leg swing amplitude in radians
    
    // Only animate if actually moving
    const isMoving = distance > 0.001 ? 1 : 0;
    
    // Arm swing (opposite arms swing opposite directions)
    const armSwing = Math.sin(time * swingSpeed) * armSwingAmp * isMoving;
    this.leftArm.rotation.x = armSwing;
    this.rightArm.rotation.x = -armSwing;
    
    // Leg swing (opposite legs swing opposite directions)
    const legSwing = Math.sin(time * swingSpeed) * legSwingAmp * isMoving;
    this.leftLeg.rotation.x = legSwing;
    this.rightLeg.rotation.x = -legSwing;
  }

  /**
   * Reset limbs to idle position
   */
  private resetLimbs(): void {
    if (!this.leftArm || !this.rightArm || !this.leftLeg || !this.rightLeg) return;
    
    // Smoothly return to idle position
    const resetSpeed = 0.1;
    this.leftArm.rotation.x *= (1 - resetSpeed);
    this.rightArm.rotation.x *= (1 - resetSpeed);
    this.leftLeg.rotation.x *= (1 - resetSpeed);
    this.rightLeg.rotation.x *= (1 - resetSpeed);
  }
 
  dispose() {
    try { if (this.body) this.body.dispose(); } catch {}
    try { if (this.leftArm) this.leftArm.dispose(); } catch {}
    try { if (this.rightArm) this.rightArm.dispose(); } catch {}
    try { if (this.leftLeg) this.leftLeg.dispose(); } catch {}
    try { if (this.rightLeg) this.rightLeg.dispose(); } catch {}
    try { if (this.root) this.root.dispose(); } catch {}
  }
}

/**
 * NPCSystem
 *
 * - Create simple NPCs (composed of primitive meshes).
 * - Accepts schedules (hour -> position) and will interpolate NPC world position
 *   between scheduled points as the HourlyCycle advances.
 * - Subscribes to HourlyCycle.onTick to update NPC positions every tick.
 */
export class NpcSystem {
  private scene: Scene;
  private cycle: HourlyCycle;
  private npcs: NPC[] = [];
  private unsubscribeTick: (() => void) | null = null;

  constructor(scene: Scene, cycle: HourlyCycle) {
    this.scene = scene;
    this.cycle = cycle;
    // subscribe to hourly tick updates
    this.unsubscribeTick = this.cycle.onTick((info: HourInfo, _state: any) => this._onTick(info));
  }

  createNpc(name: string, schedule: NpcSchedule, opts?: NpcOptions): NPC {
    const npc = new NPC(this.scene, name, schedule, opts);
    // initialize position immediately
    const initialPos = this.positionForLoopPercent(this.currentLoopPercent(), npc.schedule);
    if (initialPos) npc.root.position = initialPos;
    this.npcs.push(npc);
    return npc;
  }

  /**
   * Create an NPC from a JSON definition
   * 
   * @param definition - NPC definition loaded from JSON
   * @returns Created NPC instance
   * 
   * @example
   * ```typescript
   * const result = await contentLoader.loadNpc('npcs/baker.json');
   * if (result.success) {
   *   const npc = npcSystem.createNpcFromDefinition(result.data);
   * }
   * ```
   */
  createNpcFromDefinition(definition: NpcDefinition): NPC {
    // Convert JSON schedule format to NpcSchedule
    const schedule = this.convertScheduleEntryToNpcSchedule(definition.schedule);
    
    // Convert color array to Color3
    const color = new Color3(definition.color[0], definition.color[1], definition.color[2]);
    
    // Create NPC with converted data
    return this.createNpc(definition.name, schedule, {
      name: definition.name,
      color: color,
      size: definition.speed * 0.3, // Use speed to vary NPC size slightly
    });
  }

  /**
   * Convert JSON ScheduleEntry format to NpcSchedule format
   * 
   * JSON format: { "0": {x, y, z}, "30": {x, y, z} }  // times in seconds
   * NpcSchedule format: { 0: Vector3, 6: Vector3 }    // times in hours
   */
  public convertScheduleEntryToNpcSchedule(scheduleEntry: ScheduleEntry): NpcSchedule {
    const schedule: NpcSchedule = {};
    
    for (const [timeStr, position] of Object.entries(scheduleEntry)) {
      // Parse time (in seconds from JSON) and convert to hours
      const timeInSeconds = parseFloat(timeStr);
      const timeInHours = Math.floor(timeInSeconds / 3600) % 24; // 3600 seconds per hour
      
      // Convert position to Vector3
      const vec = new Vector3(position.x, position.y, position.z);
      
      schedule[timeInHours] = vec;
    }
    
    return schedule;
  }

  removeNpc(npc: NPC) {
    const i = this.npcs.indexOf(npc);
    if (i >= 0) {
      this.npcs.splice(i, 1);
      npc.dispose();
    }
  }

  dispose() {
    try {
      if (this.unsubscribeTick) { this.unsubscribeTick(); this.unsubscribeTick = null; }
    } catch {}
    for (const n of this.npcs) {
      try { n.dispose(); } catch {}
    }
    this.npcs = [];
  }

  // called on every HourlyCycle.onTick
  private _onTick(info: HourInfo) {
    const loopPercent = info.loopPercent; // 0..1 across entire day+night
    for (const npc of this.npcs) {
      const pos = this.positionForLoopPercent(loopPercent, npc.schedule);
      if (pos) {
        // smoothly update NPC to the computed position (handles rotation and bob)
        try { npc.updateTo(pos); } catch {}
      }
    }
  }

  // compute current loop percent by peeking last tick info if available.
  // fallback returns 0.
  private currentLoopPercent(): number {
    try {
      const last = (this.cycle as any).getLastInfo ? (this.cycle as any).getLastInfo() : null;
      return last?.loopPercent ?? 0;
    } catch {
      return 0;
    }
  }

  /**
   * Interpolate NPC position based on schedule and loopPercent.
   *
   * - schedule: map hourIndex -> Vector3
   * - loopPercent: 0..1 across full cycle
   *
   * Algorithm:
   *  - convert scheduled hours to sorted array of {percent, pos}
   *  - find previous (p) and next (n) scheduled points surrounding loopPercent (wrap-around allowed)
   *  - compute t = (loopPercent - p.percent) / (n.percent - p.percent) (modulo 1)
   *  *  - return lerp(p.pos, n.pos, t)
   */
  private positionForLoopPercent(loopPercent: number, schedule: NpcSchedule): Vector3 | null {
    const entries: { percent: number; pos: Vector3 }[] = [];
    for (const kStr of Object.keys(schedule)) {
      const k = parseInt(kStr, 10);
      if (Number.isNaN(k) || k < 0 || k > 23) continue;
      // map semantic hour (0..23, where 6 == loop start) into loopPercent (0..1)
      entries.push({ percent: semanticHourToLoopPercent(k), pos: schedule[k] });
    }
    if (entries.length === 0) return null;

    // sort by percent ascending
    entries.sort((a, b) => a.percent - b.percent);

    // if exact match
    for (const e of entries) {
      if (Math.abs(e.percent - loopPercent) < 1e-9) return e.pos.clone();
    }

    // find previous and next with wrap
    let prev = entries[entries.length - 1];
    let next = entries[0];
    for (let i = 0; i < entries.length; i++) {
      const e = entries[i];
      if (e.percent > loopPercent) {
        next = e;
        prev = i === 0 ? entries[entries.length - 1] : entries[i - 1];
        break;
      }
    }

    // compute delta across wrap if necessary
    let span = next.percent - prev.percent;
    if (span <= 0) span += 1; // wrap-around

    let offset = loopPercent - prev.percent;
    if (offset < 0) offset += 1; // wrap
    const t = span === 0 ? 0 : Math.min(1, Math.max(0, offset / span));

    // linear interpolation
    const lerp = (a: Vector3, b: Vector3, tt: number) => {
      return new Vector3(
        a.x + (b.x - a.x) * tt,
        a.y + (b.y - a.y) * tt,
        a.z + (b.z - a.z) * tt
      );
    };

    return lerp(prev.pos, next.pos, t);
  }
}

export default NpcSystem;
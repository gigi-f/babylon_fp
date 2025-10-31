import { Scene, TransformNode, Mesh, MeshBuilder, StandardMaterial, Color3, Vector3, AbstractMesh, DynamicTexture } from "@babylonjs/core";
import HourlyCycle, { HourInfo } from "./hourlyCycle";
import { semanticHourToLoopPercent } from "./timeSync";
import type { NpcDefinition, ScheduleEntry } from "../content/schemas";

/**
 * NPC schedule:
 * - maps hourIndex (0..23) -> destination Vector3 in world space
 * - NPC position is interpolated smoothly along the loop between defined schedule points.
 */
export type NpcSchedule = Record<number, Vector3 | { x: number; y: number; z: number; vehicleId?: string; vehicleAction?: string; inVehicle?: boolean }>;

export type NpcOptions = {
  name?: string;
  color?: Color3;
  size?: number;
  shirtColor?: Color3;
  pantsColor?: Color3;
  faceData?: string; // Base64 data URL from face editor
  hatColor?: Color3; // Hat base color
  hatFaceData?: string; // Base64 data URL for hat front design
  // optional visible root offset
  offset?: Vector3;
};

export class NPC {
  public root: TransformNode;
  public body: AbstractMesh;
  public name: string;
  public size: number;
  public color: Color3;
  public shirtColor: Color3;
  public pantsColor: Color3;
  public schedule: NpcSchedule;
  public inVehicle: boolean = false;
  public currentVehicleId?: string;
  private faceData?: string;
  private hatColor?: Color3;
  private hatFaceData?: string;
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
    this.shirtColor = opts?.shirtColor ?? this.color;
    this.pantsColor = opts?.pantsColor ?? new Color3(
      this.shirtColor.r * 0.6,
      this.shirtColor.g * 0.6,
      this.shirtColor.b * 0.6
    );
    this.faceData = opts?.faceData;
    this.hatColor = opts?.hatColor;
    this.hatFaceData = opts?.hatFaceData;
 
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
  shirtMat.diffuseColor = this.shirtColor;
    
    // Pants material (legs - darker shade of base color)
    const pantsMat = new StandardMaterial(`npc_mat_${name}_pants`, scene);
    // Make pants darker by multiplying RGB by 0.6
    pantsMat.diffuseColor = this.pantsColor;
    
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
    
      // Create head with base skin color
      const headSize = blockSize * 0.8;
      const headMat = new StandardMaterial(`npc_mat_${name}_head`, scene);
      headMat.diffuseColor = this.color;

      const head = MeshBuilder.CreateBox(
        `npc_${name}_head`,
        {
          width: headSize,
          height: headSize,
          depth: headSize,
        },
        scene
      );
      head.parent = this.root;
      head.position = new Vector3(0, heightOffset + torsoHeight + headSize / 2, 0);
      head.material = headMat;

      // Create face texture and apply it to a plane mounted to the front of the head
      const faceTexture = new DynamicTexture(`npc_face_${name}`, 128, scene);
      
      // Check if custom face data is provided
      if (this.faceData) {
        // Load custom face from data URL
        const img = new Image();
        img.onload = () => {
          const faceCtx = faceTexture.getContext();
          faceCtx.drawImage(img, 0, 0, 128, 128);
          faceTexture.update();
        };
        img.onerror = () => {
          console.warn(`Failed to load custom face for NPC "${name}", using default`);
          this.createDefaultFace(faceTexture);
        };
        img.src = this.faceData;
      } else {
        // Use default hard-coded face
        this.createDefaultFace(faceTexture);
      }

      const faceMat = new StandardMaterial(`npc_mat_${name}_face`, scene);
      faceMat.diffuseTexture = faceTexture;
      faceMat.specularColor = Color3.Black();
      faceMat.backFaceCulling = true;

      const facePlane = MeshBuilder.CreatePlane(
        `npc_${name}_facePlane`,
        { size: headSize, sideOrientation: Mesh.DOUBLESIDE },
        scene
      );
      facePlane.parent = head;
      facePlane.position = new Vector3(0, 0, headSize / 2 + 0.02);
      facePlane.scaling = new Vector3(0.94, 0.94, 1);
      facePlane.isPickable = false;
      facePlane.material = faceMat;

      // Create hat if hat color is specified
      if (this.hatColor) {
        const hatHeight = headSize * 0.5;
        const hatWidth = headSize * 1.1;
        const hatDepth = headSize * 1.1;
        
        // Hat material
        const hatMat = new StandardMaterial(`npc_mat_${name}_hat`, scene);
        hatMat.diffuseColor = this.hatColor;
        
        // Create hat box
        const hat = MeshBuilder.CreateBox(
          `npc_${name}_hat`,
          {
            width: hatWidth,
            height: hatHeight,
            depth: hatDepth,
          },
          scene
        );
        hat.parent = this.root;
        hat.position = new Vector3(0, heightOffset + torsoHeight + headSize + hatHeight / 2, 0);
        hat.material = hatMat;
        
        // Create hat front design if specified
        if (this.hatFaceData) {
          const hatFaceTexture = new DynamicTexture(`npc_hat_face_${name}`, 128, scene);
          
          const img = new Image();
          img.onload = () => {
            const hatFaceCtx = hatFaceTexture.getContext();
            hatFaceCtx.drawImage(img, 0, 0, 128, 128);
            hatFaceTexture.update();
          };
          img.onerror = () => {
            console.warn(`Failed to load custom hat design for NPC "${name}"`);
          };
          img.src = this.hatFaceData;
          
          const hatFaceMat = new StandardMaterial(`npc_mat_${name}_hat_face`, scene);
          hatFaceMat.diffuseTexture = hatFaceTexture;
          hatFaceMat.specularColor = Color3.Black();
          hatFaceMat.backFaceCulling = true;
          hatFaceMat.emissiveColor = new Color3(0.2, 0.2, 0.2); // Slight glow for visibility
          
          const hatFacePlane = MeshBuilder.CreatePlane(
            `npc_${name}_hatFacePlane`,
            { size: hatWidth * 0.9, sideOrientation: Mesh.DOUBLESIDE },
            scene
          );
          hatFacePlane.parent = hat;
          hatFacePlane.position = new Vector3(0, 0, hatDepth / 2 + 0.01);
          hatFacePlane.scaling = new Vector3(1, hatHeight / hatWidth, 1);
          hatFacePlane.isPickable = false;
          hatFacePlane.material = hatFaceMat;
        }
      }
    
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
   * Create default hardcoded face on the provided texture
   */
  private createDefaultFace(faceTexture: DynamicTexture): void {
    const faceCtx = faceTexture.getContext();

    // Fill with skin color
    faceCtx.fillStyle = this.color.toHexString();
    faceCtx.fillRect(0, 0, 128, 128);

    // Draw eyes (black rectangles)
    faceCtx.fillStyle = '#000000';
    faceCtx.fillRect(32, 40, 16, 16);  // Left eye
    faceCtx.fillRect(80, 40, 16, 16);  // Right eye

    // Draw nose (brown rectangle)
    faceCtx.fillStyle = '#8B4513';
    faceCtx.fillRect(56, 64, 16, 12);

    // Draw mouth (black line)
    faceCtx.fillStyle = '#000000';
    faceCtx.fillRect(40, 90, 48, 6);

    faceTexture.update();
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
        
        // Animate arms and legs swinging while walking (unless in vehicle)
        if (!this.inVehicle) {
          this.animateLimbs(t, dist);
        }
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
    
    // Log schedule info for debugging
    const scheduleHours = Object.keys(schedule).sort((a, b) => parseInt(a) - parseInt(b));
    console.log(
      `📋 NPC "${name}" created with schedule:`,
      scheduleHours.map(h => {
        const pos = schedule[parseInt(h)];
        return `${String(parseInt(h)).padStart(2, '0')}:00 @ (${pos.x.toFixed(1)}, ${pos.z.toFixed(1)})`;
      }).join(' → ')
    );
    
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
    
    // Convert colors
    const color = new Color3(definition.color[0], definition.color[1], definition.color[2]);
    const shirtColor = definition.shirtColor
      ? new Color3(definition.shirtColor[0], definition.shirtColor[1], definition.shirtColor[2])
      : undefined;
    const pantsColor = definition.pantsColor
      ? new Color3(definition.pantsColor[0], definition.pantsColor[1], definition.pantsColor[2])
      : undefined;
    
    // Create NPC with converted data
    return this.createNpc(definition.name, schedule, {
      name: definition.name,
      color: color,
      size: definition.speed * 0.3, // Use speed to vary NPC size slightly
      shirtColor,
      pantsColor,
    });
  }

  /**
   * Convert JSON ScheduleEntry format to NpcSchedule format
   * 
   * JSON format: { "0": {x, y, z}, "30": {x, y, z} }  // times in seconds
   * NpcSchedule format: { 0: Vector3, 6: Vector3 }    // times in hours (can be fractional)
   */
  public convertScheduleEntryToNpcSchedule(scheduleEntry: ScheduleEntry): NpcSchedule {
    const schedule: NpcSchedule = {};
    
    for (const [timeStr, position] of Object.entries(scheduleEntry)) {
      // Parse time (in seconds from JSON) and convert to hours (preserving fractional hours)
      const timeInSeconds = parseFloat(timeStr);
      const timeInHours = timeInSeconds / 3600; // Keep fractional hours for precision
      
      // Preserve the full object with vehicle metadata
      const posObj = position as any;
      const entry: any = {
        x: posObj.x,
        y: posObj.y,
        z: posObj.z,
      };
      
      // Add vehicle metadata if present
      if (posObj.vehicleId) entry.vehicleId = posObj.vehicleId;
      if (posObj.vehicleAction) entry.vehicleAction = posObj.vehicleAction;
      if (posObj.inVehicle !== undefined) entry.inVehicle = posObj.inVehicle;
      
      // Use fractional hours as key to preserve all waypoints
      schedule[timeInHours] = entry;
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
        // Convert to Vector3 for positioning
        const vec = new Vector3(pos.x, pos.y, pos.z);
        // smoothly update NPC to the computed position (handles rotation and bob)
        try { npc.updateTo(vec); } catch {}
        
        // Log waypoint arrivals (when NPC reaches scheduled waypoint)
        this.logWaypointIfReached(info, npc, loopPercent);
        
        // Check if NPC should enter/exit vehicle based on waypoint data
        this.checkVehicleTransition(npc, pos);
      }
    }
  }

  /**
   * Log a message whenever an NPC reaches a scheduled waypoint
   */
  private logWaypointIfReached(info: HourInfo, npc: NPC, loopPercent: number): void {
    try {
      const schedule = npc.schedule;
      const entries: { hour: number; percent: number; pos: any }[] = [];
      
      for (const kStr of Object.keys(schedule)) {
        const k = parseFloat(kStr); // Use parseFloat to support fractional hours
        if (Number.isNaN(k) || k < 0 || k > 24) continue;
        entries.push({ 
          hour: k, 
          percent: semanticHourToLoopPercent(k), 
          pos: schedule[k] as any
        });
      }
      
      if (entries.length === 0) return;
      
      // Sort by percent
      entries.sort((a, b) => a.percent - b.percent);
      
      // Check if we're very close to any waypoint (within 2% of loop)
      const threshold = 0.02;
      for (let i = 0; i < entries.length; i++) {
        const entry = entries[i];
        const distance = Math.abs(entry.percent - loopPercent);
        
        // Handle wrap-around case
        const wrapDistance = Math.min(distance, 1 - distance);
        
        if (wrapDistance < threshold) {
          // Check if we haven't logged this waypoint recently
          const logKey = `${npc.name}_waypoint_${i}`;
          if (!this.lastWaypointLog) this.lastWaypointLog = {};
          
          const lastLogTime = this.lastWaypointLog[logKey];
          const currentTime = Date.now();
          
          // Only log once per waypoint per 5 seconds to avoid spam
          if (!lastLogTime || currentTime - lastLogTime > 5000) {
            // Convert hour (fractional) to HH:MM format
            const hours = Math.floor(entry.hour);
            const minutes = Math.round((entry.hour % 1) * 60);
            const timeString = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
            
            // Calculate grid position (inverse of world-to-grid conversion)
            const GRID_SIZE = 100;
            const CELL_SIZE = 1;
            const gridX = Math.round((entry.pos.x / CELL_SIZE) + GRID_SIZE / 2);
            const gridZ = Math.round((entry.pos.z / CELL_SIZE) + GRID_SIZE / 2);
            
            // Check vehicle status
            const posObj = entry.pos as any;
            const vehicleStatus = posObj.inVehicle ? ' 🚗 [in vehicle: true]' : '';
            
            // Log the waypoint arrival
            console.log(
              `🚶 [${timeString}] NPC "${npc.name}" reached waypoint ${i + 1}/${entries.length} ` +
              `at grid (${gridX}, ${gridZ}) | world (${entry.pos.x.toFixed(1)}, ${entry.pos.z.toFixed(1)})${vehicleStatus}`
            );
            
            this.lastWaypointLog[logKey] = currentTime;
          }
        }
      }
    } catch (error) {
      // Silently fail to avoid spam if logging fails
    }
  }

  /**
   * Track last waypoint log times to avoid spam
   */
  private lastWaypointLog: { [key: string]: number } = {};

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
   * Check if NPC should enter or exit vehicle based on waypoint metadata
   */
  private checkVehicleTransition(npc: NPC, posData: any): void {
    try {
      if (!posData) return;

      const hasVehicleId = !!posData.vehicleId;
      const shouldBeInVehicle = posData.inVehicle === true;

      // If waypoint has vehicleAction "enter", mark NPC as in vehicle
      if (posData.vehicleAction === "enter" && posData.vehicleId) {
        npc.inVehicle = true;
        npc.currentVehicleId = posData.vehicleId;
      }

      // If waypoint has vehicleAction "exit", mark NPC as not in vehicle
      if (posData.vehicleAction === "exit") {
        npc.inVehicle = false;
        npc.currentVehicleId = undefined;
      }

      // Alternatively, if inVehicle is explicitly set in metadata
      if (shouldBeInVehicle && hasVehicleId) {
        npc.inVehicle = true;
        npc.currentVehicleId = posData.vehicleId;
      }
    } catch {
      // Silently fail
    }
  }

  /**
   * Interpolate NPC position based on schedule and loopPercent.
   *
   * - schedule: map hourIndex -> Vector3 or position object with metadata
   * - loopPercent: 0..1 across full cycle
   *
   * Algorithm:
   *  - convert scheduled hours to sorted array of {percent, pos}
   *  - find previous (p) and next (n) scheduled points surrounding loopPercent (wrap-around allowed)
   *  - compute t = (loopPercent - p.percent) / (n.percent - p.percent) (modulo 1)
   *  *  - return lerp(p.pos, n.pos, t)
   */
  private positionForLoopPercent(loopPercent: number, schedule: NpcSchedule): any {
    const entries: { percent: number; pos: any }[] = [];
    for (const kStr of Object.keys(schedule)) {
      const k = parseFloat(kStr); // Use parseFloat to support fractional hours
      if (Number.isNaN(k) || k < 0 || k > 24) continue;
      // map semantic hour (0..24, where 6 == loop start) into loopPercent (0..1)
      entries.push({ percent: semanticHourToLoopPercent(k), pos: schedule[k] });
    }
    if (entries.length === 0) return null;

    // sort by percent ascending
    entries.sort((a, b) => a.percent - b.percent);

    // if exact match, return the exact waypoint (preserves metadata)
    for (const e of entries) {
      if (Math.abs(e.percent - loopPercent) < 1e-9) {
        const result = { ...e.pos };
        if (result.x === undefined) result.x = (e.pos as Vector3).x;
        if (result.y === undefined) result.y = (e.pos as Vector3).y;
        if (result.z === undefined) result.z = (e.pos as Vector3).z;
        return result;
      }
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
    const lerp = (a: any, b: any, tt: number) => {
      const aX = a.x ?? (a as Vector3).x;
      const aY = a.y ?? (a as Vector3).y;
      const aZ = a.z ?? (a as Vector3).z;
      const bX = b.x ?? (b as Vector3).x;
      const bY = b.y ?? (b as Vector3).y;
      const bZ = b.z ?? (b as Vector3).z;

      return {
        x: aX + (bX - aX) * tt,
        y: aY + (bY - aY) * tt,
        z: aZ + (bZ - aZ) * tt,
      };
    };

    return lerp(prev.pos, next.pos, t);
  }
}

export default NpcSystem;
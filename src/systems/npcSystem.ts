import { Scene, TransformNode, MeshBuilder, StandardMaterial, Color3, Vector3, AbstractMesh } from "@babylonjs/core";
import HourlyCycle, { HourInfo } from "./hourlyCycle";
import { semanticHourToLoopPercent } from "./timeSync";

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
 
  constructor(scene: Scene, name: string, schedule: NpcSchedule, opts?: NpcOptions) {
    this.name = name;
    this.schedule = { ...schedule }; // shallow copy
    this.size = opts?.size ?? 0.6;
    this.color = opts?.color ?? new Color3(0.9, 0.8, 0.6);
 
    this.root = new TransformNode(`npc_${name}_root`, scene);
    if (opts?.offset) this.root.position = opts.offset.clone();
 
    // simple body: a box (torso) + sphere (head)
    const mat = new StandardMaterial(`npc_mat_${name}`, scene);
    mat.diffuseColor = this.color;
 
    const torso = MeshBuilder.CreateBox(`npc_${name}_torso`, { size: this.size }, scene);
    torso.parent = this.root;
    torso.position = new Vector3(0, this.size / 2, 0);
    torso.material = mat;
 
    const head = MeshBuilder.CreateSphere(`npc_${name}_head`, { diameter: this.size * 0.6 }, scene);
    head.parent = this.root;
    head.position = new Vector3(0, this.size * 1.1, 0);
    head.material = mat;
 
    // add a small nose so facing is visually clear
    try {
      const nose = MeshBuilder.CreateBox(`npc_${name}_nose`, { size: this.size * 0.12 }, scene);
      nose.parent = head;
      // place nose in front of head (front assumed -Z)
      nose.position = new Vector3(0, 0, -this.size * 0.35);
      nose.material = mat;
    } catch {}
 
    this.body = torso;
    this.lastPos = this.root.position.clone();
    this.bobPhaseOffset = Math.random() * Math.PI * 2;
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
      }
 
      // store last base position (without bob)
      this.lastPos = new Vector3(nx, nyBase, nz);
    } catch {}
  }
 
  dispose() {
    try { if (this.body) this.body.dispose(); } catch {}
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
import * as THREE from 'three';
import {
  TICK_RATE,
  activeEffects,
  activeGrabBox,
  activeHitboxes,
  blendPose,
  characterOf,
  hurtboxes,
  plantedBoneSegments,
  vec2,
  type BoneId,
  type FighterState,
  type GameEvent,
  type MatchState,
  type Rect,
  type SkeletonDef,
  type StageDef,
} from '../../core';
import type { GameView, SessionView } from '../../ports';
import { disposeScene } from './dispose-scene';
import { bodyParts } from './body-layout';
import { dodgeMotion, lerpAngle, ROLL_PIVOT } from './dodge-motion';
import { BOX_COLORS, hurtboxColor } from './debug-colors';
import { EffectLayer, type Emitter } from './effect-layer';
import { dustFor } from './dust';
import { burstFor, type Burst } from './hit-effects';
import { ObjectLayer } from './object-layer';
import { buildScenery, type Scenery } from './scenery';

import { fighterModel, PLAYER_COLORS } from './fighter-model';
import {
  CAMERA,
  followCamera,
  frameFighters,
  keepInView,
  placeCamera,
  restingFrame,
  type CameraFrame,
} from './match-camera';

const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

/** Game frames the camera keeps a KO's burst in view (#48), as Smash lingers on the blast. */
const KO_LINGER_FRAMES = 45;

/** How far in front of the body an effect on it burns, so the body does not hide it. */
const EFFECT_DEPTH = 0.35;

export interface ThreeViewOptions {
  /**
   * How many pixels at the top of the screen something drawn over the match covers (the HUD).
   * The camera keeps the fighters below it.
   */
  readonly coveredTop?: () => number;
}

interface FighterVisual {
  readonly root: THREE.Group;
  readonly parts: ReadonlyMap<BoneId, THREE.Object3D>;
  /** Every material of the body, flashed while invulnerable and tinted in hitstun. */
  readonly materials: readonly THREE.MeshStandardMaterial[];
  readonly skeleton: SkeletonDef;
  /** Debug overlay: one sphere per active hitbox or grab box, grown as moves need more. */
  readonly hitboxes: THREE.Mesh<THREE.SphereGeometry, THREE.MeshBasicMaterial>[];
  /** Debug overlay: one shape per hurtbox, in world space. */
  readonly hurtboxes: ReadonlyMap<BoneId, THREE.Mesh>;
  /** Shared by the fighter's hurtboxes, recoloured while it is invulnerable. */
  readonly hurtboxMaterial: THREE.MeshBasicMaterial;
}

/** Debug overlay material, drawn on top of the body so it stays readable. */
const overlay = (color: number): THREE.MeshBasicMaterial =>
  new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.45, depthTest: false });

/**
 * Draws the match with Three.js. Read-only: it never changes game state, it only
 * turns a `SessionView` into pixels. Gameplay is on the x/y plane; z is depth for looks.
 */
export class ThreeView implements GameView {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(CAMERA.fov, 16 / 9, 0.1, 200);
  private readonly fighters = new Map<number, FighterVisual>();
  private cameraFrame: CameraFrame;
  /** The (fractional) match frame of the last drawing, to ease the camera by elapsed time. */
  private lastFrame: number | null = null;
  /** Share of the screen height the HUD covers, and the half second it was last measured in. */
  private hudShare = 0;
  private hudCheck: number | null = null;
  private readonly scenery: Scenery;
  private readonly effects: EffectLayer;
  private readonly objects: ObjectLayer;
  /** Reused every drawing, so the render loop makes no garbage for it. */
  private readonly emitters: Emitter[] = [];
  /** Sparks and KO bursts from events (#48) and dust (#151) since the last drawing. */
  private readonly bursts: Burst[] = [];
  /** Where the latest KO burst is and how many game frames the camera still keeps it in view. */
  private koFocus: { area: Rect; frames: number } | null = null;
  /** The state the dust (#151) was last read from, so a drawing spanning frames misses none. */
  private dustSeen: MatchState | null = null;
  private showBoxes = false;

  constructor(
    private readonly container: HTMLElement,
    private readonly stage: StageDef,
    private readonly options: ThreeViewOptions = {},
  ) {
    this.cameraFrame = restingFrame(stage.blastZone);
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    container.appendChild(this.renderer.domElement);

    placeCamera(this.camera, this.cameraFrame);
    this.scenery = buildScenery(this.scene, stage);
    this.effects = new EffectLayer(this.scene);
    this.objects = new ObjectLayer(this.scene);
    this.resize(container.clientWidth, container.clientHeight);
  }

  render(view: SessionView): void {
    const { previous, current, alpha } = view;
    // The same in-between moment the fighters are drawn at; stops when the match does.
    const frame = previous.frame + (current.frame - previous.frame) * alpha;
    this.scenery.update(frame / TICK_RATE);
    const elapsed = this.lastFrame === null ? 0 : Math.max(frame - this.lastFrame, 0);
    this.lastFrame = frame;
    const bodies: Rect[] = [];
    const emitters = this.emitters;
    emitters.length = 0;
    for (const fighter of current.fighters) {
      const before = previous.fighters[fighter.slot] ?? fighter;
      const body = this.updateFighter(fighter, before, alpha, current.frame, emitters);
      if (body) bodies.push(body);
    }
    this.addDust(current);
    this.objects.update(previous.objects, current.objects, alpha);
    for (const object of current.objects) {
      const at = object.effect === undefined ? undefined : this.objects.drawnAt(object.id);
      if (object.effect === undefined || !at) continue;
      emitters.push({ effect: object.effect, x: at.x, y: at.y, depth: 0 });
    }
    this.effects.update(emitters, this.bursts, elapsed);
    this.bursts.length = 0;
    // The camera keeps a fresh KO's burst in view, though the fighter respawned at once.
    if (this.koFocus) {
      bodies.push(this.koFocus.area);
      this.koFocus.frames -= elapsed;
      if (this.koFocus.frames <= 0) this.koFocus = null;
    }
    this.updateCamera(bodies, frame, elapsed);
    this.renderer.render(this.scene, this.camera);
  }

  /**
   * Hears a match event (#48): a hit sprays sparks where it landed, a KO bursts where the
   * fighter left. Events come from the session, so none is missed when several game frames pass
   * between two drawings.
   */
  handleEvent(event: GameEvent): void {
    const burst = burstFor(event);
    if (burst) this.bursts.push(burst);
    if (event.type !== 'ko') return;
    const { x, y } = event.position;
    const area = { left: x - 1, right: x + 1, bottom: y - 1, top: y + 1 };
    this.koFocus = { area, frames: KO_LINGER_FRAMES };
  }

  /** Puffs dust (#151) for what fighters did since the dust was last read. */
  private addDust(current: MatchState): void {
    const seen = this.dustSeen;
    if (seen?.frame === current.frame) return;
    this.dustSeen = current;
    if (!seen) return;
    for (const fighter of current.fighters) {
      const before = seen.fighters.find((f) => f.slot === fighter.slot);
      const puff = before && dustFor(before, fighter);
      if (puff) this.bursts.push(puff);
    }
  }

  /** Turns the debug overlay of hurtboxes and attack hitboxes on or off. */
  setShowBoxes(on: boolean): void {
    this.showBoxes = on;
  }

  resize(width: number, height: number): void {
    this.hudCheck = null;
    this.camera.aspect = width / Math.max(height, 1);
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  /** Frees GPU memory and the WebGL context; the app creates a new view for every match. */
  dispose(): void {
    this.objects.dispose();
    disposeScene(this.scene);
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    this.renderer.domElement.remove();
  }

  private visualFor(slot: number, characterId: string): FighterVisual {
    const existing = this.fighters.get(slot);
    if (existing) return existing;

    const color = PLAYER_COLORS[slot % PLAYER_COLORS.length] ?? 0xffffff;
    const { root, parts, materials, skeleton } = fighterModel(characterId, color);

    const hurtboxes = new Map<BoneId, THREE.Mesh>();
    const hurtboxMaterial = overlay(BOX_COLORS.hurtbox);
    for (const bone of skeleton.bones) {
      const geometry =
        bone.shape === 'ball'
          ? new THREE.SphereGeometry(bone.radius, 12, 8)
          : new THREE.CapsuleGeometry(
              bone.radius,
              Math.max(bone.length - bone.radius * 2, 0.01),
              4,
              10,
            );
      const mesh = new THREE.Mesh(geometry, hurtboxMaterial);
      mesh.visible = false;
      mesh.renderOrder = 1;
      hurtboxes.set(bone.id, mesh);
      this.scene.add(mesh);
    }

    this.scene.add(root);

    const visual = {
      root,
      parts,
      materials,
      skeleton,
      hitboxes: [],
      hurtboxes,
      hurtboxMaterial,
    };
    this.fighters.set(slot, visual);
    return visual;
  }

  private updateFighter(
    fighter: FighterState,
    before: FighterState,
    alpha: number,
    frame: number,
    /** Gets the effects the fighter's move shows this moment (#47). */
    emitters: Emitter[],
  ): Rect | undefined {
    const visual = this.visualFor(fighter.slot, fighter.characterId);
    const eliminated = fighter.action === 'eliminated';
    visual.root.visible = !eliminated;
    if (eliminated) {
      for (const mesh of visual.hitboxes) mesh.visible = false;
      for (const mesh of visual.hurtboxes.values()) mesh.visible = false;
      return;
    }

    // Do not interpolate across a respawn teleport: a KO counted a fall in between.
    const teleported = fighter.falls !== before.falls;
    const t = teleported ? 1 : alpha;
    const x = lerp(before.position.x, fighter.position.x, t);
    const y = lerp(before.position.y, fighter.position.y, t);
    // A dodge moves the body beyond its pose (`dodge-motion.ts`): out of the stage plane, in a
    // somersault around its middle, or in a spin.
    const from = dodgeMotion(before);
    const to = dodgeMotion(fighter);
    const depth = lerp(from.depth, to.depth, t);
    const spin = lerpAngle(from.spin, to.spin, t);
    visual.root.position.set(
      x + ROLL_PIVOT * Math.sin(spin),
      y + ROLL_PIVOT * (1 - Math.cos(spin)),
      depth,
    );
    visual.root.rotation.set(0, lerpAngle(from.yaw, to.yaw, t), spin);
    // Mirror rather than turn around, so the near limbs stay near the camera either way.
    visual.root.scale.x = fighter.facing;

    // Core eases the pose each frame; between frames the view interpolates like the position.
    // Planting keeps the feet on the ground when the stance bends the knees.
    const pose = teleported ? fighter.pose : blendPose(before.pose, fighter.pose, t);
    const position = vec2(x, y);
    for (const part of bodyParts(plantedBoneSegments(visual.skeleton, pose, vec2(0, 0), 1))) {
      const mesh = visual.parts.get(part.bone);
      mesh?.position.set(part.x, part.y, part.depth);
      mesh?.rotation.set(0, 0, part.angle);
    }

    for (const material of visual.materials) {
      material.opacity = fighter.invulnerableFrames > 0 && frame % 8 < 4 ? 0.35 : 1;
      material.emissive.setHex(fighter.action === 'hitstun' ? 0x662222 : 0x000000);
    }

    // The move's effects burn where core puts them on the in-between body.
    for (const { effect, position: at } of activeEffects({ ...fighter, position, pose })) {
      emitters.push({ effect, x: at.x, y: at.y, depth: depth + EFFECT_DEPTH });
    }

    // Core's own hurtboxes for the in-between body, so the overlay sits on what is drawn.
    visual.hurtboxMaterial.color.setHex(hurtboxColor(fighter));
    for (const box of hurtboxes({ ...fighter, position, pose })) {
      const mesh = visual.hurtboxes.get(box.bone);
      if (!mesh) continue;
      mesh.visible = this.showBoxes;
      // At the body's depth, so the overlay follows a sidestep out of the stage plane.
      mesh.position.set((box.start.x + box.end.x) / 2, (box.start.y + box.end.y) / 2, depth);
      mesh.rotation.set(0, 0, Math.atan2(-(box.end.x - box.start.x), box.end.y - box.start.y));
    }

    // Red hitboxes, and a purple grab box (#159) while a grab can catch.
    const grabBox = this.showBoxes ? activeGrabBox(fighter) : undefined;
    const boxes = [
      ...(this.showBoxes ? activeHitboxes(fighter) : []).map((box) => ({
        ...box,
        color: BOX_COLORS.hitbox,
      })),
      ...(grabBox ? [{ ...grabBox, color: BOX_COLORS.grab }] : []),
    ];
    while (visual.hitboxes.length < boxes.length) {
      const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 16), overlay(BOX_COLORS.hitbox));
      mesh.renderOrder = 2;
      visual.hitboxes.push(mesh);
      this.scene.add(mesh);
    }
    visual.hitboxes.forEach((mesh, index) => {
      const box = boxes[index];
      mesh.visible = box !== undefined;
      if (!box) return;
      mesh.position.set(box.center.x, box.center.y, 0);
      mesh.scale.setScalar(box.radius);
      mesh.material.color.setHex(box.color);
    });

    // The body box where it is drawn, for the camera.
    const { width, height } = characterOf(fighter.characterId).stats;
    return { left: x - width / 2, right: x + width / 2, bottom: y, top: y + height };
  }

  /**
   * Smash-style camera (`match-camera.ts`): frames every fighter still in the game where it is
   * drawn this moment, and glides there at the same pace whatever the refresh rate.
   */
  private updateCamera(bodies: readonly Rect[], frame: number, elapsed: number): void {
    // Measuring the HUD makes the browser lay out the page, so twice a second is enough.
    const check = Math.floor(frame / 30);
    if (check !== this.hudCheck) {
      this.hudCheck = check;
      const height = this.container.clientHeight;
      this.hudShare = height > 0 ? (this.options.coveredTop?.() ?? 0) / height : 0;
    }
    const target = frameFighters(bodies, this.stage.blastZone, this.camera.aspect, this.hudShare);
    // Easing by elapsed game frames: a paused match (no frames) holds the camera still.
    // Then backing off at once wherever gliding would lose a fighter launched fast.
    this.cameraFrame = keepInView(
      followCamera(this.cameraFrame, target, elapsed),
      bodies,
      this.camera.aspect,
      this.hudShare,
    );
    placeCamera(this.camera, this.cameraFrame);
  }
}

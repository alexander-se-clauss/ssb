import * as THREE from 'three';
import {
  FIGHTER,
  HUMANOID,
  TICK_RATE,
  activeHitboxes,
  blendPose,
  hurtboxes,
  plantedBoneSegments,
  vec2,
  type BoneId,
  type FighterState,
  type StageDef,
} from '../../core';
import type { GameView, SessionView } from '../../ports';
import { disposeScene } from './dispose-scene';
import { bodyParts } from './body-layout';
import { BOX_COLORS, hurtboxColor } from './debug-colors';
import { buildScenery, type Scenery } from './scenery';

export const PLAYER_COLORS = [0xe94f4f, 0x4f8fe9, 0x4fd18b, 0xf2c14e] as const;

const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

interface FighterVisual {
  readonly root: THREE.Group;
  readonly parts: ReadonlyMap<BoneId, THREE.Mesh>;
  /** The player's colour, and a darker shade for the limbs on the far side. */
  readonly materials: readonly THREE.MeshStandardMaterial[];
  /** Debug overlay: one sphere per active hitbox, grown as moves need more. */
  readonly hitboxes: THREE.Mesh[];
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
  private readonly camera = new THREE.PerspectiveCamera(40, 16 / 9, 0.1, 200);
  private readonly fighters = new Map<number, FighterVisual>();
  private readonly cameraTarget = new THREE.Vector3(0, 2, 22);
  private readonly scenery: Scenery;
  private showBoxes = false;

  constructor(
    private readonly container: HTMLElement,
    stage: StageDef,
  ) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    container.appendChild(this.renderer.domElement);

    this.camera.position.copy(this.cameraTarget);
    this.scenery = buildScenery(this.scene, stage);
    this.resize(container.clientWidth, container.clientHeight);
  }

  render(view: SessionView): void {
    const { previous, current, alpha } = view;
    // The same in-between moment the fighters are drawn at; stops when the match does.
    const frame = previous.frame + (current.frame - previous.frame) * alpha;
    this.scenery.update(frame / TICK_RATE);
    for (const fighter of current.fighters) {
      const before = previous.fighters[fighter.slot] ?? fighter;
      this.updateFighter(fighter, before, alpha, current.frame);
    }
    this.updateCamera(current.fighters);
    this.renderer.render(this.scene, this.camera);
  }

  /** Turns the debug overlay of hurtboxes and attack hitboxes on or off. */
  setShowBoxes(on: boolean): void {
    this.showBoxes = on;
  }

  resize(width: number, height: number): void {
    this.camera.aspect = width / Math.max(height, 1);
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  /** Frees GPU memory and the WebGL context; the app creates a new view for every match. */
  dispose(): void {
    disposeScene(this.scene);
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    this.renderer.domElement.remove();
  }

  private visualFor(slot: number): FighterVisual {
    const existing = this.fighters.get(slot);
    if (existing) return existing;

    const color = PLAYER_COLORS[slot % PLAYER_COLORS.length] ?? 0xffffff;
    const near = new THREE.MeshStandardMaterial({ color, roughness: 0.5, transparent: true });
    const far = near.clone();
    far.color.multiplyScalar(0.65);

    const root = new THREE.Group();
    const parts = new Map<BoneId, THREE.Mesh>();
    for (const bone of HUMANOID.bones) {
      // Drawn exactly as thick as the hurtbox, so what you see is what can be hit.
      const { radius } = bone;
      const geometry =
        bone.shape === 'ball'
          ? new THREE.SphereGeometry(radius, 16, 12)
          : new THREE.CapsuleGeometry(radius, Math.max(bone.length - radius * 2, 0.01), 6, 12);
      const mesh = new THREE.Mesh(geometry, bone.id.endsWith('Back') ? far : near);
      mesh.castShadow = true;
      parts.set(bone.id, mesh);
      root.add(mesh);
    }

    // An eye on the front of the head shows which way the fighter faces.
    const eye = new THREE.Mesh(
      new THREE.SphereGeometry(0.05, 10, 10),
      new THREE.MeshStandardMaterial({ color: 0xffffff }),
    );
    eye.position.set(0.12, 0.03, 0.08);
    parts.get('head')?.add(eye);

    const hurtboxes = new Map<BoneId, THREE.Mesh>();
    const hurtboxMaterial = overlay(BOX_COLORS.hurtbox);
    for (const bone of HUMANOID.bones) {
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
      materials: [near, far],
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
  ): void {
    const visual = this.visualFor(fighter.slot);
    const eliminated = fighter.action === 'eliminated';
    visual.root.visible = !eliminated;
    if (eliminated) {
      for (const mesh of visual.hitboxes) mesh.visible = false;
      for (const mesh of visual.hurtboxes.values()) mesh.visible = false;
      return;
    }

    // Do not interpolate across a respawn teleport.
    const teleported = Math.abs(fighter.position.y - before.position.y) > 2;
    const t = teleported ? 1 : alpha;
    visual.root.position.set(
      lerp(before.position.x, fighter.position.x, t),
      lerp(before.position.y, fighter.position.y, t),
      0,
    );
    // Mirror rather than turn around, so the near limbs stay near the camera either way.
    visual.root.scale.x = fighter.facing;

    // Core eases the pose each frame; between frames the view interpolates like the position.
    // Planting keeps the feet on the ground when the stance bends the knees.
    const pose = teleported ? fighter.pose : blendPose(before.pose, fighter.pose, t);
    const position = vec2(visual.root.position.x, visual.root.position.y);
    for (const part of bodyParts(plantedBoneSegments(HUMANOID, pose, vec2(0, 0), 1))) {
      const mesh = visual.parts.get(part.bone);
      mesh?.position.set(part.x, part.y, part.depth);
      mesh?.rotation.set(0, 0, part.angle);
    }

    for (const material of visual.materials) {
      material.opacity = fighter.invulnerableFrames > 0 && frame % 8 < 4 ? 0.35 : 1;
      material.emissive.setHex(fighter.action === 'hitstun' ? 0x662222 : 0x000000);
    }

    // Core's own hurtboxes for the in-between body, so the overlay sits on what is drawn.
    visual.hurtboxMaterial.color.setHex(hurtboxColor(fighter));
    for (const box of hurtboxes({ ...fighter, position, pose })) {
      const mesh = visual.hurtboxes.get(box.bone);
      if (!mesh) continue;
      mesh.visible = this.showBoxes;
      mesh.position.set((box.start.x + box.end.x) / 2, (box.start.y + box.end.y) / 2, 0);
      mesh.rotation.set(0, 0, Math.atan2(-(box.end.x - box.start.x), box.end.y - box.start.y));
    }

    const hitboxes = this.showBoxes ? activeHitboxes(fighter) : [];
    while (visual.hitboxes.length < hitboxes.length) {
      const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 16), overlay(BOX_COLORS.hitbox));
      mesh.renderOrder = 2;
      visual.hitboxes.push(mesh);
      this.scene.add(mesh);
    }
    visual.hitboxes.forEach((mesh, index) => {
      const hitbox = hitboxes[index];
      mesh.visible = hitbox !== undefined;
      if (!hitbox) return;
      mesh.position.set(hitbox.center.x, hitbox.center.y, 0);
      mesh.scale.setScalar(hitbox.radius);
    });
  }

  /** Smash-style camera: frame every fighter still in the game, zooming out as they spread. */
  private updateCamera(fighters: readonly FighterState[]): void {
    const alive = fighters.filter((f) => f.action !== 'eliminated');
    if (alive.length > 0) {
      const xs = alive.map((f) => f.position.x);
      const ys = alive.map((f) => f.position.y + FIGHTER.height / 2);
      const minX = Math.min(...xs);
      const maxX = Math.max(...xs);
      const minY = Math.min(...ys);
      const maxY = Math.max(...ys);
      const spread = Math.max(maxX - minX, (maxY - minY) * 1.6, 8);
      this.cameraTarget.set(
        THREE.MathUtils.clamp((minX + maxX) / 2, -8, 8),
        THREE.MathUtils.clamp((minY + maxY) / 2 + 1, -1, 7),
        THREE.MathUtils.clamp(spread * 1.3 + 6, 16, 40),
      );
    }
    this.camera.position.lerp(this.cameraTarget, 0.08);
    this.camera.lookAt(this.camera.position.x, this.camera.position.y - 1, 0);
  }
}

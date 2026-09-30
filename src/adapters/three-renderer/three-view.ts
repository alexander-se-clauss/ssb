import * as THREE from 'three';
import { FIGHTER, activeHitbox, type FighterState, type StageDef } from '../../core';
import type { GameView, SessionView } from '../../ports';

export const PLAYER_COLORS = [0xe94f4f, 0x4f8fe9, 0x4fd18b, 0xf2c14e] as const;

const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

interface FighterVisual {
  readonly root: THREE.Group;
  readonly body: THREE.Mesh<THREE.CapsuleGeometry, THREE.MeshStandardMaterial>;
  readonly hitbox: THREE.Mesh<THREE.SphereGeometry, THREE.MeshBasicMaterial>;
}

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

  constructor(
    private readonly container: HTMLElement,
    stage: StageDef,
  ) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    container.appendChild(this.renderer.domElement);

    this.scene.background = new THREE.Color(0x1b2140);
    this.scene.fog = new THREE.Fog(0x1b2140, 30, 80);
    this.camera.position.copy(this.cameraTarget);

    this.addLights();
    this.addStage(stage);
    this.resize(container.clientWidth, container.clientHeight);
  }

  render(view: SessionView): void {
    const { previous, current, alpha } = view;
    for (const fighter of current.fighters) {
      const before = previous.fighters[fighter.slot] ?? fighter;
      this.updateFighter(fighter, before, alpha, current.frame);
    }
    this.updateCamera(current.fighters);
    this.renderer.render(this.scene, this.camera);
  }

  resize(width: number, height: number): void {
    this.camera.aspect = width / Math.max(height, 1);
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  dispose(): void {
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }

  private addLights(): void {
    this.scene.add(new THREE.HemisphereLight(0xbfd4ff, 0x2a2238, 1.2));
    const sun = new THREE.DirectionalLight(0xffffff, 2);
    sun.position.set(6, 14, 10);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { left: -12, right: 12, top: 12, bottom: -6 });
    this.scene.add(sun);
  }

  private addStage(stage: StageDef): void {
    for (const platform of stage.platforms) {
      const { left, right, bottom, top } = platform.bounds;
      const depth = platform.passThrough ? 2 : 4;
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(right - left, top - bottom, depth),
        new THREE.MeshStandardMaterial({
          color: platform.passThrough ? 0x9aa7c7 : 0x5c6b8a,
          roughness: 0.8,
        }),
      );
      mesh.position.set((left + right) / 2, (top + bottom) / 2, 0);
      mesh.receiveShadow = true;
      mesh.castShadow = !platform.passThrough;
      this.scene.add(mesh);
    }
  }

  private visualFor(slot: number): FighterVisual {
    const existing = this.fighters.get(slot);
    if (existing) return existing;

    const color = PLAYER_COLORS[slot % PLAYER_COLORS.length] ?? 0xffffff;
    const radius = FIGHTER.width / 2;
    const body = new THREE.Mesh(
      new THREE.CapsuleGeometry(radius, FIGHTER.height - radius * 2, 8, 16),
      new THREE.MeshStandardMaterial({ color, roughness: 0.5, transparent: true }),
    );
    body.position.y = FIGHTER.height / 2;
    body.castShadow = true;

    const eye = new THREE.Mesh(
      new THREE.SphereGeometry(0.12, 12, 12),
      new THREE.MeshStandardMaterial({ color: 0xffffff }),
    );
    eye.position.set(radius * 0.8, FIGHTER.height * 0.75, 0.15);

    const hitbox = new THREE.Mesh(
      new THREE.SphereGeometry(1, 16, 16),
      new THREE.MeshBasicMaterial({ color: 0xffe066, transparent: true, opacity: 0.55 }),
    );
    hitbox.visible = false;

    const root = new THREE.Group();
    root.add(body, eye);
    this.scene.add(root, hitbox);

    const visual = { root, body, hitbox };
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
      visual.hitbox.visible = false;
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
    visual.root.rotation.y = fighter.facing === 1 ? 0 : Math.PI;

    const material = visual.body.material;
    material.opacity = fighter.invulnerableFrames > 0 && frame % 8 < 4 ? 0.35 : 1;
    material.emissive.setHex(fighter.action === 'hitstun' ? 0x662222 : 0x000000);

    const hitbox = activeHitbox(fighter);
    visual.hitbox.visible = hitbox !== null;
    if (hitbox) {
      visual.hitbox.position.set(hitbox.center.x, hitbox.center.y, 0);
      visual.hitbox.scale.setScalar(hitbox.radius);
    }
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

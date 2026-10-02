import * as THREE from 'three';
import { POSES } from '../../core';
import { disposeScene } from './dispose-scene';
import { PLAYER_COLORS } from './fighter-model';
import {
  DAIS_RADIUS,
  DAIS_TOP,
  addRuins,
  glowPlane,
  glowTexture,
  showcaseFighter,
  stoneDais,
} from './firelit-set';
import { FrameBudget } from './frame-budget';
import { platformX, rowCameraDistance } from './lobby-layout';

/** What stands on one player's platform; `characterId` null leaves the platform dark. */
export interface PlatformStand {
  readonly characterId: string | null;
  readonly ready: boolean;
}

const FOV = 30;
const FIGHTER_SCALE = 2.7;
/** An open slot's rune ring: cold stone, barely lit. */
const UNLIT_RUNE = 0x3a2c20;

interface Platform {
  readonly rune: THREE.MeshBasicMaterial;
  readonly light: THREE.SpotLight;
  readonly pool: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
  fighter: THREE.Group | undefined;
  shown: PlatformStand | undefined;
}

/**
 * Character select as a set: one stone platform per player slot in a row, lined up with the
 * nameplates below. A joined player's platform lights up in their colour with their fighter on
 * it, striking a pose once they are ready; an open slot stays dark. The picture changes only when a
 * stand does, and it is drawn within a frame budget, like the menu backdrop.
 */
export class LobbyScene {
  private readonly renderer = new THREE.WebGLRenderer({
    antialias: true,
    preserveDrawingBuffer: true,
  });
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 200);
  private readonly glow = glowTexture();
  private readonly fog = new THREE.FogExp2(0x0b0705, 0.02);
  private readonly platforms: Platform[] = [];
  private readonly budget = new FrameBudget();
  private readonly probe = new Uint8Array(4);
  private changed = true;

  constructor(container: HTMLElement) {
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.domElement.className = 'lobby-scene';
    this.renderer.domElement.setAttribute('aria-hidden', 'true');
    container.prepend(this.renderer.domElement);
    this.scene.background = new THREE.Color(0x070504);
    this.scene.fog = this.fog;
    this.scene.add(new THREE.HemisphereLight(0x6f86a8, 0x140a04, 0.35));
    addRuins(this.scene, this.glow);

    // One warm key light over the whole row casts the shadows.
    const key = new THREE.DirectionalLight(0xffd2a0, 0.9);
    key.position.set(-6, 16, 12);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    Object.assign(key.shadow.camera, { left: -16, right: 16, top: 10, bottom: -6 });
    key.shadow.bias = -0.0005;
    this.scene.add(key);

    for (let slot = 0; slot < PLAYER_COLORS.length; slot++) {
      const x = platformX(slot);
      const rune = new THREE.MeshBasicMaterial({ color: UNLIT_RUNE });
      const dais = stoneDais(rune, DAIS_RADIUS * 0.85);
      dais.position.x = x;
      // The player's colour, from a lamp above and in front of the platform.
      const light = new THREE.SpotLight(PLAYER_COLORS[slot], 0, 40, 0.4, 0.6, 1.2);
      light.position.set(x, 13, 7);
      light.target.position.set(x, 1.5, 0);
      // And a pool of it spilling over the floor around the platform.
      const pool = glowPlane(this.glow, PLAYER_COLORS[slot] ?? 0xffffff, 14, 0);
      pool.rotation.x = -Math.PI / 2;
      pool.position.set(x, -0.28, 1);
      this.scene.add(dais, light, light.target, pool);
      this.platforms.push({ rune, light, pool, fighter: undefined, shown: undefined });
    }

    this.resize(container.clientWidth, container.clientHeight);
  }

  /** Puts each player's stand on their platform; unchanged stands keep their fighter. */
  show(stands: readonly PlatformStand[]): void {
    this.platforms.forEach((platform, slot) => {
      const stand = stands[slot] ?? { characterId: null, ready: false };
      const before = platform.shown;
      if (before?.characterId === stand.characterId && before.ready === stand.ready) return;
      platform.shown = stand;
      this.changed = true;
      if (platform.fighter) {
        this.scene.remove(platform.fighter);
        disposeScene(platform.fighter);
        platform.fighter = undefined;
      }
      const color = PLAYER_COLORS[slot] ?? 0xffffff;
      const joined = stand.characterId !== null;
      platform.rune.color.setHex(joined ? color : UNLIT_RUNE);
      platform.light.intensity = !joined ? 0 : stand.ready ? 900 : 500;
      platform.pool.material.opacity = !joined ? 0 : stand.ready ? 0.5 : 0.3;
      if (stand.characterId === null) return;
      // The left pair faces right and the right pair left, all turned a little to the camera.
      const facing = slot < 2 ? 1 : -1;
      const { holder } = showcaseFighter(
        stand.characterId,
        color,
        stand.ready ? POSES.forwardSmash : POSES.idle,
        FIGHTER_SCALE,
        facing,
      );
      holder.position.set(platformX(slot), DAIS_TOP, 0);
      holder.rotation.y = -0.45 * facing;
      this.scene.add(holder);
      platform.fighter = holder;
    });
  }

  /** Called every frame; draws when a stand changed, as often as the frame budget allows. */
  render(now: number): void {
    if (!this.budget.shouldDraw(now, { animated: this.changed, changed: false })) return;
    this.changed = false;
    if (!this.budget.measuring) {
      this.renderer.render(this.scene, this.camera);
      this.budget.drew(now);
      return;
    }
    const start = performance.now();
    this.renderer.render(this.scene, this.camera);
    // Reading one pixel waits until the GPU has finished, so the time covers the whole drawing.
    const gl = this.renderer.getContext();
    gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, this.probe);
    this.budget.drew(now, performance.now() - start);
  }

  resize(width: number, height: number): void {
    this.camera.aspect = width / Math.max(height, 1);
    const distance = rowCameraDistance(FOV, this.camera.aspect);
    // Put the platform tops just above the nameplates: about 65% of the way down, or 80% on a
    // portrait screen, where the row is small and the nameplates sit low.
    const halfHeight = Math.tan(((FOV / 2) * Math.PI) / 180) * distance;
    const lookY = DAIS_TOP + (this.camera.aspect < 1 ? 0.6 : 0.3) * halfHeight;
    // The haze thickens with nearness, so the fighters stay clear and the ruins fade, however
    // far back a narrow screen puts the camera.
    this.fog.density = 0.55 / distance;
    this.camera.position.set(0, lookY + 2, distance);
    this.camera.lookAt(0, lookY, 0);
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
    this.changed = true;
  }

  dispose(): void {
    disposeScene(this.scene);
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    this.renderer.domElement.remove();
  }
}

import * as THREE from 'three';
import { POSES } from '../../core';
import { disposeScene } from './dispose-scene';
import { emberHeight } from './ember-drift';
import { FrameBudget } from './frame-budget';
import {
  DAIS_TOP,
  addRuins,
  beamTexture,
  glowPlane,
  glowTexture,
  showcaseFighter,
  stoneDais,
} from './firelit-set';

const EMBERS = 420;
const EMBER_BAND = { bottom: -1, top: 12 } as const;
/** Where the fighter stands: right of the menu list, which sits on the left. */
const DAIS = new THREE.Vector3(5, 0, -1);

/**
 * The firelit set behind the title and the menus: a fighter on a stone platform in a spotlight,
 * with fog, drifting embers and broken pillars in the distance. Purely decorative and
 * independent of the simulation; one scene stays alive while the player moves between menus.
 */
export class MenuBackdrop {
  // The drawing buffer is kept, so the screen wipe can copy the last picture without a new one.
  private readonly renderer = new THREE.WebGLRenderer({
    antialias: true,
    preserveDrawingBuffer: true,
  });
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(32, 1, 0.1, 200);
  private readonly reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  /** A soft round spot, shared by the glows, the smoke and the embers. */
  private readonly glow = glowTexture();
  private readonly embers: THREE.Points;
  private readonly emberStarts: Float32Array;
  private readonly budget = new FrameBudget();
  private readonly probe = new Uint8Array(4);
  /** The picture no longer fits the canvas, e.g. after a resize. */
  private changed = true;
  private started: number | undefined;

  constructor(container: HTMLElement) {
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.domElement.className = 'menu-backdrop';
    this.renderer.domElement.setAttribute('aria-hidden', 'true');
    container.prepend(this.renderer.domElement);
    this.scene.background = new THREE.Color(0x070504);
    this.scene.fog = new THREE.FogExp2(0x0b0705, 0.045);
    this.scene.add(new THREE.HemisphereLight(0x6f86a8, 0x140a04, 0.35));

    addRuins(this.scene, this.glow);
    this.addDais();
    this.addFighter();
    this.addLights();
    this.addSmoke();
    const { points, starts } = this.makeEmbers();
    this.embers = points;
    this.emberStarts = starts;
    this.scene.add(points);

    this.resize(container.clientWidth, container.clientHeight);
    this.render(performance.now());
  }

  /** An octagonal stone platform with a glowing rune ring. */
  private addDais(): void {
    const dais = stoneDais(new THREE.MeshBasicMaterial({ color: 0xff8a2a }));
    dais.position.copy(DAIS);
    this.scene.add(dais);
  }

  /** The game's own fighter body, held in a forward smash towards the menu. */
  private addFighter(): void {
    const { holder } = showcaseFighter('capsule', 0xb8332a, POSES.forwardSmash, 2.7, -1);
    holder.position.set(DAIS.x, DAIS_TOP, DAIS.z);
    holder.rotation.y = -0.6;
    this.scene.add(holder);
  }

  private addLights(): void {
    const key = new THREE.SpotLight(0xffb36b, 160, 80, 0.35, 0.6, 1.2);
    key.position.set(DAIS.x + 3, 12, DAIS.z + 7);
    key.target.position.set(DAIS.x, 1, DAIS.z);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.bias = -0.0005;
    // Short reach, so the cold rim light ends at the fighter instead of pooling on the floor.
    const rim = new THREE.SpotLight(0x5fb6ff, 500, 12, 0.12, 0.6, 1.2);
    rim.position.set(DAIS.x + 3, 6, DAIS.z - 8);
    rim.target.position.set(DAIS.x, 3.2, DAIS.z);
    this.scene.add(key, key.target, rim, rim.target);

    // The spotlight's cone, visible in the haze.
    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.3, 3.6, 16, 48, 1, true),
      new THREE.MeshBasicMaterial({
        map: beamTexture(),
        color: 0xffb36b,
        transparent: true,
        opacity: 0.08,
        side: THREE.DoubleSide,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    beam.position.set(DAIS.x, 8, DAIS.z);
    this.scene.add(beam);
  }

  /** Low smoke drifting over the ground. */
  private addSmoke(): void {
    for (let i = 0; i < 14; i++) {
      const puff = glowPlane(this.glow, 0x3a2a20, 10 + (i % 4) * 3, 0.18);
      puff.material.blending = THREE.NormalBlending;
      puff.position.set(-16 + i * 2.4, 0.6 + (i % 3) * 0.4, (i % 5) - 4);
      this.scene.add(puff);
    }
  }

  private makeEmbers(): { points: THREE.Points; starts: Float32Array } {
    const positions = new Float32Array(EMBERS * 3);
    const starts = new Float32Array(EMBERS);
    // A fixed seed: the same scatter every time, so screenshots stay comparable.
    let seed = 7;
    const random = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < EMBERS; i++) {
      positions[i * 3] = (random() - 0.5) * 40;
      starts[i] = EMBER_BAND.bottom + random() * (EMBER_BAND.top - EMBER_BAND.bottom);
      positions[i * 3 + 1] = starts[i] ?? 0;
      positions[i * 3 + 2] = -4 + (random() - 0.5) * 24;
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const points = new THREE.Points(
      geometry,
      new THREE.PointsMaterial({
        color: 0xff8a2a,
        size: 0.14,
        map: this.glow,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    return { points, starts };
  }

  /** Called every frame; draws when the picture changed or the frame budget allows motion. */
  render(now: number): void {
    this.started ??= now;
    const animated = !this.reducedMotion.matches;
    if (!this.budget.shouldDraw(now, { animated, changed: this.changed })) return;
    this.changed = false;
    const seconds = animated ? (now - this.started) / 1000 : 0;
    const position = this.embers.geometry.getAttribute('position');
    for (let i = 0; i < EMBERS; i++) {
      // Each ember rises at its own pace, between 0.3 and 0.8 units a second.
      const speed = 0.3 + (i % 11) * 0.05;
      position.setY(i, emberHeight(this.emberStarts[i] ?? 0, speed, seconds, EMBER_BAND));
    }
    position.needsUpdate = true;
    // Portrait screens have no room beside the list, so the fighter stands low, below it.
    const narrow = this.camera.aspect < 1;
    const sway = Math.sin(seconds * 0.15) * 0.3;
    if (narrow) {
      this.camera.position.set(DAIS.x + sway, 4, 26);
      this.camera.lookAt(DAIS.x, 6.5, DAIS.z);
    } else {
      this.camera.position.set(-1 + sway, 2.8, 16);
      this.camera.lookAt(1.5, 2.6, 0);
    }
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

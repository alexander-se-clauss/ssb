import * as THREE from 'three';
import { POSES } from '../../core';
import { disposeScene } from './dispose-scene';
import { fighterModel, poseFighter, PLAYER_COLORS } from './fighter-model';

interface PodiumFighter {
  readonly slot: number;
  readonly place: number;
  readonly characterId: string;
}

const MEDALS = [0xe9b94f, 0xb9c8db, 0xb67a4d, 0x425571] as const;

/** A still victory ceremony, using the same skeleton and body geometry as the match renderer. */
export class ResultsScene {
  private readonly renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
  private readonly observer: ResizeObserver;
  private readonly width: number;

  constructor(
    private readonly container: HTMLElement,
    fighters: readonly PodiumFighter[],
  ) {
    this.width = fighters.length * 2.35 + 1.5;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.2;
    this.renderer.domElement.setAttribute('aria-hidden', 'true');
    container.append(this.renderer.domElement);
    this.scene.add(new THREE.HemisphereLight(0xcbdfff, 0x182338, 2.8));
    const sun = new THREE.DirectionalLight(0xffe3b4, 4);
    sun.position.set(-4, 8, 6);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    Object.assign(sun.shadow.camera, { left: -8, right: 8, top: 8, bottom: -8 });
    this.scene.add(sun);
    const rim = new THREE.DirectionalLight(0x8ebfff, 3);
    rim.position.set(4, 4, -4);
    this.scene.add(rim);

    // Place the winner between second and third, with a fourth step on the outside.
    const arranged = [...fighters];
    const first = arranged[0];
    const second = arranged[1];
    if (first && second) [arranged[0], arranged[1]] = [second, first];
    arranged.forEach((fighter, index) => {
      const x = (index - (fighters.length - 1) / 2) * 2.35;
      const height = [2.7, 1.85, 1.05, 0.55][fighter.place - 1] ?? 0.55;
      const color = MEDALS[fighter.place - 1] ?? MEDALS[3];
      const group = new THREE.Group();
      group.position.x = x;
      const material = new THREE.MeshStandardMaterial({ color, metalness: 0.72, roughness: 0.28 });
      const step = new THREE.Mesh(new THREE.BoxGeometry(2.25, height, 2), material);
      step.position.y = height / 2;
      step.castShadow = step.receiveShadow = true;
      group.add(step);
      const cap = new THREE.Mesh(new THREE.BoxGeometry(2.32, 0.12, 2.08), material);
      cap.position.y = height + 0.06;
      cap.receiveShadow = true;
      group.add(cap);
      this.number(group, fighter.place, height);
      if (fighter.place === 1) this.laurel(group, height);
      const model = this.fighter(fighter.slot);
      model.position.y = height + 0.12;
      model.rotation.y = -0.25;
      model.userData['characterId'] = fighter.characterId;
      group.add(model);
      this.scene.add(group);
    });
    const floor = new THREE.Mesh(
      new THREE.CylinderGeometry(this.width * 0.65, this.width * 0.65, 0.18, 64),
      new THREE.MeshStandardMaterial({ color: 0x142235, metalness: 0.5, roughness: 0.45 }),
    );
    floor.position.y = -0.12;
    floor.receiveShadow = true;
    this.scene.add(floor);
    for (const radius of [this.width * 0.52, this.width * 0.62]) {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(radius, 0.018, 8, 96),
        new THREE.MeshBasicMaterial({ color: 0x7896b6 }),
      );
      ring.rotation.x = Math.PI / 2;
      ring.position.y = -0.02;
      this.scene.add(ring);
    }
    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(container);
    this.resize();
  }

  private number(group: THREE.Group, place: number, height: number): void {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 256;
    const context = canvas.getContext('2d');
    if (!context) return;
    context.fillStyle = '#142033';
    context.font = '900 190px Arial';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(String(place), 128, 138);
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(0.95, Math.min(0.95, height * 0.85)),
      new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(canvas), transparent: true }),
    );
    mesh.position.set(0, height / 2, 1.012);
    group.add(mesh);
  }

  private laurel(group: THREE.Group, height: number): void {
    const material = new THREE.MeshStandardMaterial({
      color: 0xffe39a,
      metalness: 0.7,
      roughness: 0.32,
    });
    for (const side of [-1, 1]) {
      const branch = new THREE.Mesh(
        new THREE.TorusGeometry(0.72, 0.025, 6, 36, Math.PI * 0.75),
        material,
      );
      branch.position.set(0, height / 2 + 0.03, 1.04);
      branch.rotation.z = side < 0 ? Math.PI * 0.85 : Math.PI * 1.4;
      group.add(branch);
      for (let i = 0; i < 7; i++) {
        const angle = -Math.PI / 2 + i * 0.32;
        const leaf = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8), material);
        leaf.scale.set(0.09, 0.19, 0.035);
        leaf.position.set(side * Math.cos(angle) * 0.74, height / 2 + Math.sin(angle) * 0.74, 1.08);
        leaf.rotation.z = side * (0.45 - i * 0.22);
        group.add(leaf);
      }
    }
  }

  private fighter(slot: number): THREE.Group {
    const model = fighterModel(PLAYER_COLORS[slot % PLAYER_COLORS.length] ?? 0xffffff);
    poseFighter(model, POSES.idle);
    model.root.scale.setScalar(1.15);
    return model.root;
  }

  resize(): void {
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    if (!width || !height) return;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    // Fit both podium width and fighter height, including on narrow portrait screens.
    const distance = Math.max(
      10,
      this.width / (2 * Math.tan(THREE.MathUtils.degToRad(17.5)) * this.camera.aspect),
    );
    this.camera.position.set(0.8, 2.4 + distance * 0.22, distance);
    this.camera.lookAt(0, 2.4, 0);
    this.renderer.setSize(width, height);
    this.render();
  }

  render(): void {
    this.renderer.render(this.scene, this.camera);
  }

  dispose(): void {
    this.observer.disconnect();
    disposeScene(this.scene);
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    this.renderer.domElement.remove();
  }
}

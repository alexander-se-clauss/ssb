import * as THREE from 'three';
import { HUMANOID, POSES, plantedBoneSegments, vec2, type Pose } from '../../core';
import { bodyParts } from './body-layout';
import { disposeScene } from './dispose-scene';
import { rockGeometry } from './scenery/common';

/** A posed illustration, independent of the simulation and alive only on the title screen. */
export class TitleScene {
  private readonly renderer = new THREE.WebGLRenderer({ antialias: true });
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
  private readonly sparks = new THREE.Group();
  private readonly reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  private started: number | undefined;

  constructor(container: HTMLElement) {
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.25;
    this.renderer.domElement.className = 'title-scene';
    this.renderer.domElement.setAttribute('aria-hidden', 'true');
    container.prepend(this.renderer.domElement);
    this.scene.background = new THREE.Color(0x090d1d);
    this.scene.fog = new THREE.FogExp2(0x090d1d, 0.025);
    this.addAtmosphere();
    this.scene.add(new THREE.HemisphereLight(0xb8d8ff, 0x211023, 2));
    this.light(0xffd5aa, 35, -3, 7, 5);
    this.light(0x47baff, 65, 7, 5, -3);
    this.light(0xff5a35, 45, 0, 3, 3);
    const sun = new THREE.DirectionalLight(0xffead7, 3);
    sun.position.set(-3, 10, 8);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    Object.assign(sun.shadow.camera, { left: -12, right: 12, top: 12, bottom: -12 });
    sun.shadow.bias = -0.001;
    this.scene.add(sun);

    // A floating stone arena with luminous rings and fractured rock below the floor.
    const arena = new THREE.Group();
    arena.position.set(2.5, -1.2, 0);
    const floor = new THREE.Mesh(
      new THREE.CylinderGeometry(6, 6, 0.45, 64),
      new THREE.MeshStandardMaterial({ color: 0x343e52, metalness: 0.55, roughness: 0.48 }),
    );
    floor.receiveShadow = true;
    arena.add(floor);
    const rock = new THREE.Mesh(
      rockGeometry(5.9, 1.3, 3.6, 0.25, 17, 14),
      new THREE.MeshStandardMaterial({ color: 0x192237, roughness: 0.9, flatShading: true }),
    );
    rock.position.y = -2;
    arena.add(rock);
    for (const radius of [5.8, 4.9, 2.8]) {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(radius, 0.024, 8, 96),
        new THREE.MeshBasicMaterial({ color: radius === 5.8 ? 0x70d9ff : 0x657c98 }),
      );
      ring.rotation.x = Math.PI / 2;
      ring.position.y = 0.24;
      arena.add(ring);
    }
    this.scene.add(arena);

    this.fighter(0xf35b3d, POSES.jab, 0.4, -0.95, 1, 2.55, -0.12);
    this.fighter(0x3d9fff, POSES.jab3, 4.7, 0.4, -1, 2.55, 0.12);

    // Small gold streaks hold the instant of contact in the otherwise still illustration.
    const contact = new THREE.Group();
    contact.position.set(2.7, 1.5, 0.6);
    for (let i = 0; i < 16; i++) {
      const angle = i * 2.4;
      const radius = 0.16 + (i % 4) * 0.13;
      const streak = new THREE.Mesh(
        new THREE.BoxGeometry(0.014, 0.08 + (i % 3) * 0.06, 0.014),
        new THREE.MeshBasicMaterial({ color: i % 3 === 0 ? 0xffffff : 0xffce79 }),
      );
      streak.position.set(Math.cos(angle) * radius, Math.sin(angle) * radius, 0);
      streak.rotation.z = angle - Math.PI / 2;
      contact.add(streak);
    }
    this.scene.add(contact);

    // A sweeping arc behind the fighters, like the wake of an aerial attack.
    for (let i = 0; i < 3; i++) {
      const arc = new THREE.Mesh(
        new THREE.TorusGeometry(4.1 + i * 0.12, 0.025 - i * 0.007, 8, 100, Math.PI * 1.25),
        new THREE.MeshBasicMaterial({
          color: 0x80cfff,
          transparent: true,
          opacity: 0.35 - i * 0.09,
        }),
      );
      arc.position.set(3.7, 2.1, -1.5);
      arc.rotation.set(0.15, -0.35, -0.6);
      this.scene.add(arc);
    }

    for (let i = 0; i < 90; i++) {
      const spark = new THREE.Mesh(
        new THREE.OctahedronGeometry(i % 5 === 0 ? 0.04 : 0.018),
        new THREE.MeshBasicMaterial({ color: i % 3 === 0 ? 0x7dcfff : 0xffbf70 }),
      );
      spark.position.set(
        Math.sin(i * 17.3) * 13,
        Math.cos(i * 8.7) * 7 + 3,
        -4 + Math.sin(i * 3.2) * 5,
      );
      this.sparks.add(spark);
    }
    this.scene.add(this.sparks);
    this.resize(container.clientWidth, container.clientHeight);
    this.render(performance.now());
  }

  private light(color: number, intensity: number, x: number, y: number, z: number): void {
    const light = new THREE.PointLight(color, intensity, 30, 1.5);
    light.position.set(x, y, z);
    this.scene.add(light);
  }

  private addAtmosphere(): void {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 128;
    const context = canvas.getContext('2d');
    if (!context) return;
    const gradient = context.createRadialGradient(64, 64, 0, 64, 64, 64);
    gradient.addColorStop(0, 'rgba(255,255,255,0.6)');
    gradient.addColorStop(0.35, 'rgba(255,255,255,0.18)');
    gradient.addColorStop(1, 'rgba(255,255,255,0)');
    context.fillStyle = gradient;
    context.fillRect(0, 0, 128, 128);
    const map = new THREE.CanvasTexture(canvas);
    for (const [color, x, y] of [
      [0xff6633, 0, 2],
      [0x248bff, 7, 4],
    ] as const) {
      const glow = new THREE.Mesh(
        new THREE.PlaneGeometry(18, 18),
        new THREE.MeshBasicMaterial({
          map,
          color,
          transparent: true,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
          opacity: 0.45,
        }),
      );
      glow.position.set(x, y, -7);
      this.scene.add(glow);
    }
  }

  private fighter(
    color: number,
    pose: Pose,
    x: number,
    y: number,
    facing: 1 | -1,
    scale: number,
    rotation: number,
  ): void {
    const root = new THREE.Group();
    root.position.set(x, y, 0);
    root.scale.set(scale * facing, scale, scale);
    root.rotation.z = rotation;
    const material = new THREE.MeshStandardMaterial({ color, metalness: 0.35, roughness: 0.32 });
    const dark = material.clone();
    dark.color.multiplyScalar(0.58);
    for (const part of bodyParts(plantedBoneSegments(HUMANOID, pose, vec2(0, 0), 1))) {
      const bone = HUMANOID.bones.find((b) => b.id === part.bone);
      if (!bone) continue;
      const geometry =
        bone.shape === 'ball'
          ? new THREE.SphereGeometry(bone.radius, 32, 24)
          : new THREE.CapsuleGeometry(
              bone.radius,
              Math.max(bone.length - bone.radius * 2, 0.01),
              8,
              16,
            );
      const mesh = new THREE.Mesh(geometry, part.bone.endsWith('Back') ? dark : material);
      mesh.position.set(part.x, part.y, part.depth);
      mesh.rotation.z = part.angle;
      mesh.castShadow = true;
      root.add(mesh);
      if (part.bone === 'head') {
        const eye = new THREE.Mesh(
          new THREE.SphereGeometry(0.035, 12, 8),
          new THREE.MeshBasicMaterial({ color: 0xffffff }),
        );
        eye.position.set(0.12, 0.04, 0.105);
        mesh.add(eye);
      }
    }
    this.scene.add(root);
  }

  render(now: number): void {
    this.started ??= now;
    const seconds = this.reducedMotion.matches ? 0 : (now - this.started) / 1000;
    const narrow = this.camera.aspect < 1;
    this.camera.position.set(
      (narrow ? 2.5 : 0) + Math.sin(seconds * 0.15) * 0.15,
      4.8,
      narrow ? 23 : 20,
    );
    this.camera.lookAt(narrow ? 2.5 : 0, narrow ? 0.3 : 1.6, 0);
    this.sparks.position.y = Math.sin(seconds * 0.3) * 0.3;
    this.sparks.rotation.y = seconds * 0.012;
    this.renderer.render(this.scene, this.camera);
  }

  resize(width: number, height: number): void {
    this.camera.aspect = width / Math.max(height, 1);
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  dispose(): void {
    disposeScene(this.scene);
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    this.renderer.domElement.remove();
  }
}

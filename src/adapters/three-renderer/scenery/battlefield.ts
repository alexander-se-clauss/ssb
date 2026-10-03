import * as THREE from 'three';
import type { StageDef } from '../../../core';
import { skyAt } from './cycles';
import { MAIN_BLOCK_DEPTH, addLights, rockGeometry, setRgb, skyDome, type Scenery } from './common';
import { seededRandom } from './noise';
import { rock, stoneTiles, worldUvs } from './textures';

const SKY = /* glsl */ `
  float h = dir.y;
  vec3 sky = mix(uHorizon, uZenith, smoothstep(0.0, 0.55, h));

  float sun = max(dot(dir, uSunDir), 0.0);
  sky += uGlow * (pow(sun, 6.0) * 0.35 + smoothstep(0.9986, 0.9994, sun) * 1.5);
  float moon = max(dot(dir, normalize(vec3(-0.55, 0.2, -1.0))), 0.0);
  sky += vec3(0.85, 0.9, 1.0) * uStars * (smoothstep(0.99975, 0.9999, moon) + pow(moon, 40.0) * 0.15);
  sky += vec3(stars(dir, uTime)) * uStars * smoothstep(-0.02, 0.15, h);

  // Streaks of cloud above the horizon, drifting sideways.
  vec2 cuv = vec2(atan(dir.x, -dir.z) * 2.5 + uTime * 0.006, h * 9.0);
  float c = fbm(cuv * vec2(1.0, 1.6));
  float band = smoothstep(0.02, 0.12, h) * (1.0 - smoothstep(0.25, 0.5, h));
  sky = mix(sky, uCloud * (0.75 + 0.35 * c), smoothstep(0.5, 0.75, c) * band * 0.85);

  // The sea of clouds the stage floats over.
  if (h < 0.0) {
    vec2 suv = dir.xz / max(-h, 0.02) * 0.35 + vec2(uTime * 0.02, 0.0);
    float s = fbm(suv);
    vec3 sea = mix(uHorizon * 0.6, uCloud, smoothstep(0.35, 0.8, s));
    sky = mix(sky, sea, 1.0 - smoothstep(-0.06, 0.0, h));
  }
  gl_FragColor = vec4(sky, 1.0);
`;

/** Battlefield-style, as in Melee: a floating stone island over a sea of clouds, with a day/night sky. */
export const battlefieldScenery = (scene: THREE.Scene, stage: StageDef): Scenery => {
  const random = seededRandom(7);
  const stoneMap = stoneTiles();
  const rockMap = rock();
  const stone = new THREE.MeshStandardMaterial({
    map: stoneMap,
    bumpMap: stoneMap,
    bumpScale: 3,
    roughness: 0.85,
  });
  const ledgeStone = stone.clone();
  ledgeStone.color.setHex(0xdfe6ff);
  const earth = new THREE.MeshStandardMaterial({
    map: rockMap,
    roughness: 0.95,
    flatShading: true,
  });
  const glow = new THREE.MeshBasicMaterial({ color: 0x9fe3ff, transparent: true, opacity: 0.7 });

  for (const platform of stage.platforms) {
    const { left, right, bottom, top } = platform.bounds;
    const width = right - left;
    const middle = (left + right) / 2;

    if (platform.passThrough) {
      // Thin stone ledges with a soft glowing rim underneath, like Melee's.
      const slab = new THREE.Mesh(
        worldUvs(new THREE.BoxGeometry(width, 0.24, 2.4).translate(middle, top - 0.12, 0), 4),
        ledgeStone,
      );
      slab.castShadow = true;
      slab.receiveShadow = true;
      const rim = new THREE.Mesh(new THREE.BoxGeometry(width - 0.2, 0.04, 2.2), glow);
      rim.position.set(middle, top - 0.26, 0);
      scene.add(slab, rim);
      continue;
    }

    // The floor: stone blocks matching the collision box, then rock tapering far below it.
    const floor = new THREE.Mesh(
      worldUvs(
        new THREE.BoxGeometry(width + 0.1, 0.5, MAIN_BLOCK_DEPTH).translate(middle, top - 0.25, 0),
        4,
      ),
      stone,
    );
    floor.receiveShadow = true;
    floor.castShadow = true;

    const bodyHeight = top - 0.5 - bottom;
    const body = new THREE.Mesh(
      worldUvs(rockGeometry(width / 2 / 1.03, width / 2 - 0.4, bodyHeight, 0.03, 3, 14), 6),
      earth,
    );
    body.scale.z = 2.4 / (width / 2);
    body.position.set(middle, bottom + bodyHeight / 2, 0);

    // Below the collision box the rock sits behind the fighters' plane, so a fighter under the
    // stage is drawn in front of it rather than inside it.
    const underside = new THREE.Mesh(
      worldUvs(rockGeometry(width / 2 - 0.4, 0.5, 5.5, 0.12, 5, 12), 6),
      earth,
    );
    underside.scale.z = 1.3 / (width / 2 - 0.4);
    underside.position.set(middle, bottom - 2.75, -1.6);
    scene.add(floor, body, underside);

    for (let i = 0; i < 6; i++) {
      const length = 0.8 + random() * 1.6;
      const spike = new THREE.Mesh(rockGeometry(0.35, 0.02, length, 0.1, 50 + i, 6), earth);
      const x = middle + (random() - 0.5) * width * 0.6;
      const depthBelow = (1 - Math.abs(x - middle) / (width / 2)) * 4.5;
      spike.position.set(x, bottom - depthBelow - length / 2 + 0.3, -1.2 - random());
      scene.add(spike);
    }
  }

  // Smaller islands floating far away, gently bobbing; the fog fades them into the sky.
  const islands: { mesh: THREE.Mesh; y: number; phase: number; turn: number }[] = [];
  for (let i = 0; i < 10; i++) {
    const side = i % 2 === 0 ? -1 : 1;
    const radius = 1.5 + random() * 3;
    const mesh = new THREE.Mesh(
      worldUvs(rockGeometry(radius, 0.2, radius * 1.4, 0.15, 100 + i, 9), 6),
      earth,
    );
    const y = -5 + random() * 16;
    mesh.position.set(side * (14 + random() * 55), y, -50 - random() * 40);
    islands.push({ mesh, y, phase: random() * Math.PI * 2, turn: random() * Math.PI });
    scene.add(mesh);
  }

  const uniforms = {
    uTime: { value: 0 },
    uZenith: { value: new THREE.Color() },
    uHorizon: { value: new THREE.Color() },
    uGlow: { value: new THREE.Color() },
    uCloud: { value: new THREE.Color() },
    uStars: { value: 0 },
    uSunDir: { value: new THREE.Vector3() },
  };
  scene.add(skyDome(uniforms, SKY));
  const fog = new THREE.Fog(0xffffff, 35, 110);
  scene.fog = fog;

  const { fill, sun } = addLights(scene, 0xbfd4ff, 0x4a3a40);
  const white = new THREE.Color(0xffffff);
  const glowColor = new THREE.Color();

  const update = (seconds: number): void => {
    const look = skyAt(seconds);
    uniforms.uTime.value = seconds;
    setRgb(uniforms.uZenith.value, look.zenith);
    setRgb(uniforms.uHorizon.value, look.horizon);
    setRgb(uniforms.uGlow.value, look.glow);
    setRgb(uniforms.uCloud.value, look.cloud);
    uniforms.uStars.value = look.stars;
    uniforms.uSunDir.value.set(0.55, look.sunHeight, -1).normalize();

    setRgb(fog.color, look.horizon);
    // Light follows the sky, but never so dark or tinted that fighters lose their colours.
    setRgb(fill.color, look.zenith).lerp(white, 0.6);
    setRgb(glowColor, look.glow);
    sun.color.copy(white).lerp(glowColor, 0.35);
    sun.intensity = 1.6 + 0.6 * (1 - look.stars);

    for (const island of islands) {
      island.mesh.position.y = island.y + Math.sin(seconds * 0.4 + island.phase) * 0.6;
      island.mesh.rotation.y = island.turn + seconds * 0.05;
    }
  };
  update(0);
  return { update };
};

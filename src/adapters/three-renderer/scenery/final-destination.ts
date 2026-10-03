import * as THREE from 'three';
import type { StageDef } from '../../../core';
import { destinationAt } from './cycles';
import { MAIN_BLOCK_DEPTH, addLights, skyDome, type Scenery } from './common';
import { seededRandom } from './noise';
import { circuitGlow, darkPanels, worldUvs } from './textures';

const SKY = /* glsl */ `
  vec3 col = vec3(0.008, 0.008, 0.03);
  float st = stars(dir, uTime);

  if (uWarp > 0.001) {
    // Light streaks rushing past along lanes around the centre of view.
    float fwd = max(-dir.z, 0.05);
    vec2 p = dir.xy / fwd;
    float r = length(p);
    float lanes = 72.0;
    float a = (atan(p.y, p.x) / 6.2831853 + 0.5) * lanes;
    float seed = hash12(vec2(floor(a), 3.0));
    float travel = fract(0.12 / (r + 0.03) + seed * 7.0 - uTime * (0.5 + seed));
    float streak = smoothstep(0.0, 0.03, travel) * (1.0 - smoothstep(0.03, 0.25, travel));
    streak *= (1.0 - smoothstep(0.05, 0.3, abs(fract(a) - 0.5))) * smoothstep(0.08, 0.6, r);
    vec3 tint = mix(vec3(0.3, 0.55, 1.0), vec3(0.85, 0.4, 1.0), seed);
    vec3 warp = tint * streak * 1.6 + vec3(0.55, 0.65, 1.0) * exp(-r * 4.0) * 0.7;
    warp += vec3(0.08, 0.03, 0.2) * (1.0 - smoothstep(0.0, 1.5, r));
    col += (warp + st * 0.3) * uWarp;
  }

  if (uNebula > 0.001) {
    // Slowly churning clouds of gas, with domain-warped noise.
    vec2 uv = vec2(atan(dir.x, -dir.z), dir.y) * 2.0;
    vec2 q = vec2(fbm(uv + uTime * 0.012), fbm(uv + vec2(5.2, 1.3) - uTime * 0.009));
    float n = fbm(uv * 1.3 + 2.5 * q);
    vec3 neb = mix(vec3(0.03, 0.01, 0.1), vec3(0.55, 0.13, 0.6), smoothstep(0.3, 0.72, n));
    neb = mix(neb, vec3(0.2, 0.6, 0.95), smoothstep(0.5, 0.9, q.x * n * 1.7));
    col += (neb + st) * uNebula;
  }

  if (uPlanet > 0.001) {
    // Aurora curtains above a large banded planet.
    float az = atan(dir.x, -dir.z);
    float wave = sin(az * 5.0 + uTime * 0.3 + fbm(vec2(az * 2.0, uTime * 0.05)) * 4.0) * 0.06;
    float rays = 0.5 + 0.5 * noise(vec2(az * 40.0, uTime * 0.4));
    vec3 pl = vec3(st);
    pl += vec3(0.1, 0.9, 0.55) * exp(-pow((dir.y - 0.22 - wave) / 0.07, 2.0)) * rays * 0.7;
    pl += vec3(0.55, 0.2, 0.85) * exp(-pow((dir.y - 0.33 - wave) / 0.06, 2.0)) * rays * 0.35;

    vec3 centre = normalize(vec3(-0.4, -0.5, -1.0));
    vec3 tangent = normalize(cross(centre, vec3(0.0, 1.0, 0.0)));
    vec3 bitangent = cross(tangent, centre);
    float radius = 0.4;
    vec2 disc = vec2(dot(dir, tangent), dot(dir, bitangent)) / sin(radius);
    float edge = dot(disc, disc);
    if (dot(dir, centre) > 0.0 && edge < 1.0) {
      vec3 normal = vec3(disc, sqrt(1.0 - edge));
      float light = max(dot(normal, normalize(vec3(-0.6, 0.6, 0.5))), 0.0);
      float bands = fbm(vec2(disc.y * 7.0, disc.x * 1.2 + uTime * 0.01));
      vec3 surface = mix(vec3(0.15, 0.25, 0.65), vec3(0.55, 0.6, 0.95), bands);
      pl = surface * (0.04 + light * 0.75) + vec3(0.3, 0.7, 1.0) * pow(1.0 - normal.z, 3.0) * 0.5;
    } else {
      float halo = max(1.0 - (sqrt(edge) - 1.0) * 4.0, 0.0);
      pl += vec3(0.25, 0.55, 1.0) * halo * halo * 0.35 * step(0.0, dot(dir, centre));
    }
    col += pl * uPlanet;
  }

  gl_FragColor = vec4(col, 1.0);
`;

/** Final Destination-style, as in Melee: one dark, glowing platform drifting through space. */
export const finalDestinationScenery = (scene: THREE.Scene, stage: StageDef): Scenery => {
  const random = seededRandom(13);
  const panelMap = darkPanels();
  const glowMap = circuitGlow();
  const floorMaterial = new THREE.MeshStandardMaterial({
    map: panelMap,
    color: 0xe4e8ff,
    metalness: 0.3,
    roughness: 0.4,
  });
  const hullMaterial = new THREE.MeshStandardMaterial({
    map: panelMap,
    emissiveMap: glowMap,
    emissive: 0x66ccff,
    emissiveIntensity: 1,
    metalness: 0.6,
    roughness: 0.35,
  });
  const edgeMaterial = new THREE.MeshBasicMaterial({ color: 0x8fe8ff });
  const seamMaterial = new THREE.LineBasicMaterial({
    color: 0x9b7bff,
    transparent: true,
    opacity: 0.8,
  });
  const coreMaterial = new THREE.MeshBasicMaterial({ color: 0xd08bff });
  const cores: THREE.Mesh[] = [];

  for (const platform of stage.platforms) {
    const { left, right, bottom, top } = platform.bounds;
    const width = right - left;
    const middle = (left + right) / 2;
    const depth = platform.passThrough ? 2 : MAIN_BLOCK_DEPTH;

    const floor = new THREE.Mesh(
      worldUvs(new THREE.BoxGeometry(width, 0.35, depth).translate(middle, top - 0.175, 0), 4),
      floorMaterial,
    );
    floor.receiveShadow = true;
    floor.castShadow = true;
    // A bright line along the front and back of the floor's edge.
    const front = new THREE.Mesh(new THREE.BoxGeometry(width, 0.05, 0.05), edgeMaterial);
    front.position.set(middle, top - 0.02, depth / 2);
    const back = front.clone();
    back.position.z = -depth / 2;
    scene.add(floor, front, back);
    if (platform.passThrough) continue;

    const hullHeight = top - 0.35 - bottom;
    const hull = new THREE.Mesh(
      worldUvs(
        new THREE.BoxGeometry(width - 0.3, hullHeight, depth - 0.3).translate(
          middle,
          bottom + hullHeight / 2,
          0,
        ),
        6,
      ),
      hullMaterial,
    );
    hull.receiveShadow = true;

    // The tapered keel under the stage, behind the fighters' plane like Battlefield's rock.
    const half = width / 2 - 0.15;
    const profile = new THREE.Shape()
      .moveTo(-half, 0)
      .lineTo(half, 0)
      .lineTo(half * 0.62, -1.4)
      .lineTo(half * 0.3, -3)
      .lineTo(half * 0.1, -4.2)
      .lineTo(-half * 0.1, -4.2)
      .lineTo(-half * 0.3, -3)
      .lineTo(-half * 0.62, -1.4)
      .closePath();
    const keelGeometry = new THREE.ExtrudeGeometry(profile, {
      depth: 2.6,
      bevelEnabled: true,
      bevelThickness: 0.15,
      bevelSize: 0.15,
      bevelSegments: 1,
    }).translate(middle, bottom, -3);
    keelGeometry.computeVertexNormals();
    const keel = new THREE.Mesh(worldUvs(keelGeometry, 6), hullMaterial);
    const seams = new THREE.LineSegments(new THREE.EdgesGeometry(keelGeometry, 20), seamMaterial);

    const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.45), coreMaterial);
    core.position.set(middle, bottom - 4.6, -1.7);
    cores.push(core);
    scene.add(hull, keel, seams, core);
  }

  // Rings of light turning slowly far behind the stage.
  const rings: THREE.Mesh[] = [];
  for (let i = 0; i < 3; i++) {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(10 + i * 7, 0.08 + i * 0.04, 6, 96),
      new THREE.MeshBasicMaterial({
        color: i === 1 ? 0xb07bff : 0x5fd0ff,
        transparent: true,
        opacity: 0.35,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        fog: false,
      }),
    );
    ring.position.set(0, 2, -45 - i * 8);
    rings.push(ring);
    scene.add(ring);
  }

  // Motes of light drifting upwards around and behind the stage.
  const MOTES = 260;
  const RISE = 30;
  const start = new Float32Array(MOTES * 3);
  for (let i = 0; i < MOTES; i++) {
    start[i * 3] = (random() - 0.5) * 70;
    start[i * 3 + 1] = random() * RISE;
    start[i * 3 + 2] = -6 - random() * 40;
  }
  const moteGeometry = new THREE.BufferGeometry();
  moteGeometry.setAttribute('position', new THREE.BufferAttribute(start.slice(), 3));
  const motes = new THREE.Points(
    moteGeometry,
    new THREE.PointsMaterial({
      color: 0x9fdcff,
      size: 0.18,
      transparent: true,
      opacity: 0.8,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  scene.add(motes);

  const uniforms = {
    uTime: { value: 0 },
    uWarp: { value: 1 },
    uNebula: { value: 0 },
    uPlanet: { value: 0 },
  };
  scene.add(skyDome(uniforms, SKY));
  scene.fog = new THREE.Fog(0x070718, 40, 120);

  addLights(scene, 0xaebcff, 0x2a1e40);
  const underglow = new THREE.PointLight(0xb07bff, 25, 14);
  underglow.position.set(0, -4, 1.5);
  scene.add(underglow);

  const update = (seconds: number): void => {
    const look = destinationAt(seconds);
    uniforms.uTime.value = seconds;
    uniforms.uWarp.value = look.warp;
    uniforms.uNebula.value = look.nebula;
    uniforms.uPlanet.value = look.planet;

    const pulse = 0.5 + 0.5 * Math.sin(seconds * 2);
    hullMaterial.emissiveIntensity = 0.35 + 0.35 * pulse;
    underglow.intensity = 15 + 20 * pulse;
    for (const core of cores) {
      core.rotation.y = seconds * 1.2;
      core.scale.setScalar(0.9 + 0.2 * pulse);
    }
    rings.forEach((ring, i) => {
      ring.rotation.x = seconds * (0.05 + i * 0.03);
      ring.rotation.y = seconds * (0.04 - i * 0.02);
    });

    const positions = moteGeometry.getAttribute('position');
    const rise = seconds * 0.8;
    for (let i = 0; i < MOTES; i++) {
      const y = (start[i * 3 + 1] ?? 0) + rise * (0.5 + (i % 7) / 7);
      positions.setY(i, (y % RISE) - 10);
    }
    positions.needsUpdate = true;
  };
  update(0);
  return { update };
};

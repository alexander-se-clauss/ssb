import * as THREE from 'three';
import type { Rgb } from './cycles';
import { jitter } from './noise';

/** A stage's look: platforms, backdrop and lights, animated by the view every frame. */
export interface Scenery {
  /** `seconds` is match time, so the background pauses with the game. */
  update(seconds: number): void;
}

/** Sets a colour from sRGB components, as picked in a colour picker. */
export const setRgb = (color: THREE.Color, [r, g, b]: Rgb): THREE.Color =>
  color.setRGB(r, g, b, THREE.SRGBColorSpace);

/** The key light that casts the fighters' shadows, plus a soft sky and ground fill. */
export const addLights = (
  scene: THREE.Scene,
  sky: number,
  ground: number,
): { fill: THREE.HemisphereLight; sun: THREE.DirectionalLight } => {
  const fill = new THREE.HemisphereLight(sky, ground, 1.2);
  scene.add(fill);
  const sun = new THREE.DirectionalLight(0xffffff, 2);
  sun.position.set(6, 14, 10);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.bias = -0.0005;
  Object.assign(sun.shadow.camera, { left: -12, right: 12, top: 12, bottom: -6 });
  scene.add(sun);
  return { fill, sun };
};

/**
 * A lumpy, low-poly rock: a cone or cylinder whose side vertices are pushed in and out.
 * The top stays flat so it can sit under a floor. Flat-shaded, so every facet catches light.
 */
export const rockGeometry = (
  radiusTop: number,
  radiusBottom: number,
  height: number,
  roughness: number,
  seed: number,
  segments = 10,
): THREE.BufferGeometry => {
  const geometry = new THREE.CylinderGeometry(radiusTop, radiusBottom, height, segments, 5);
  const position = geometry.getAttribute('position');
  for (let i = 0; i < position.count; i++) {
    const [x, y, z] = [position.getX(i), position.getY(i), position.getZ(i)];
    if (y > height / 2 - 0.001) continue;
    const push = 1 + jitter(x, y, z, seed) * roughness;
    position.setXYZ(i, x * push, y + jitter(z, x, y, seed + 1) * roughness * 0.6, z * push);
  }
  const flat = geometry.toNonIndexed();
  geometry.dispose();
  flat.computeVertexNormals();
  return flat;
};

/** Hash-based value noise and fbm for the background shaders. */
export const GLSL_NOISE = /* glsl */ `
  float hash12(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * 0.1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
  }
  float hash13(vec3 p3) {
    p3 = fract(p3 * 0.1031);
    p3 += dot(p3, p3.zyx + 31.32);
    return fract((p3.x + p3.y) * p3.z);
  }
  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash12(i), hash12(i + vec2(1.0, 0.0)), u.x),
               mix(hash12(i + vec2(0.0, 1.0)), hash12(i + vec2(1.0, 1.0)), u.x), u.y);
  }
  float fbm(vec2 p) {
    float sum = 0.0;
    float amplitude = 0.5;
    for (int i = 0; i < 5; i++) {
      sum += noise(p) * amplitude;
      p = p * 2.03 + vec2(1.7, 9.2);
      amplitude *= 0.5;
    }
    return sum;
  }
  // Points of light on the sky, twinkling over time.
  float stars(vec3 dir, float time) {
    vec3 p = dir * 220.0;
    vec3 cell = floor(p);
    float h = hash13(cell);
    if (h < 0.992) return 0.0;
    float d = length(fract(p) - 0.5);
    float twinkle = 0.6 + 0.4 * sin(time * (1.0 + h * 4.0) + h * 80.0);
    return smoothstep(0.35, 0.0, d) * twinkle * (h - 0.992) * 125.0;
  }
`;

/**
 * A sphere around the whole scene, painted by a fragment shader from the view direction.
 * `fragment` gets `vec3 dir` (normalised, from the camera) and must set `gl_FragColor`.
 */
export const skyDome = (
  uniforms: Record<string, THREE.IUniform>,
  fragment: string,
): THREE.Mesh<THREE.SphereGeometry, THREE.ShaderMaterial> => {
  const material = new THREE.ShaderMaterial({
    uniforms,
    side: THREE.BackSide,
    depthWrite: false,
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vec4 world = modelMatrix * vec4(position, 1.0);
        vDir = world.xyz - cameraPosition;
        gl_Position = projectionMatrix * viewMatrix * world;
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec3 vDir;
      ${Object.entries(uniforms)
        .map(([name, uniform]) => `uniform ${glslType(uniform.value)} ${name};`)
        .join('\n')}
      ${GLSL_NOISE}
      void main() {
        vec3 dir = normalize(vDir);
        ${fragment}
        #include <colorspace_fragment>
      }
    `,
  });
  const dome = new THREE.Mesh(new THREE.SphereGeometry(150, 48, 24), material);
  dome.renderOrder = -1;
  dome.frustumCulled = false;
  return dome;
};

const glslType = (value: unknown): string => {
  if (value instanceof THREE.Color || value instanceof THREE.Vector3) return 'vec3';
  if (value instanceof THREE.Vector2) return 'vec2';
  return 'float';
};

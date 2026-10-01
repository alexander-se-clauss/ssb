import * as THREE from 'three';
import { seededRandom, tilingFbm } from './noise';

/**
 * Textures painted on a canvas at load time: no image files to download or license.
 * Every texture tiles, so it can repeat across surfaces of any size (see `worldUvs`).
 */

const SIZE = 256;

const paint = (draw: (ctx: CanvasRenderingContext2D) => void, srgb = true): THREE.Texture => {
  const canvas = document.createElement('canvas');
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext('2d');
  if (ctx) draw(ctx);
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.anisotropy = 4;
  if (srgb) texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
};

/** Multiplies every pixel by tiling noise, for a weathered, non-flat look. */
const grain = (ctx: CanvasRenderingContext2D, seed: number, strength: number, period = 8): void => {
  const image = ctx.getImageData(0, 0, SIZE, SIZE);
  const { data } = image;
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const n = tilingFbm((x / SIZE) * period, (y / SIZE) * period, period, seed);
      const shade = 1 + (n - 0.5) * strength;
      const i = (y * SIZE + x) * 4;
      data[i] = (data[i] ?? 0) * shade;
      data[i + 1] = (data[i + 1] ?? 0) * shade;
      data[i + 2] = (data[i + 2] ?? 0) * shade;
    }
  }
  ctx.putImageData(image, 0, 0);
};

/** Battlefield's floor: cut stone blocks in staggered rows, with dark joints. Covers 4x4 units. */
export const stoneTiles = (): THREE.Texture =>
  paint((ctx) => {
    const random = seededRandom(11);
    const rows = 4;
    const height = SIZE / rows;
    ctx.fillStyle = '#2b2d38';
    ctx.fillRect(0, 0, SIZE, SIZE);
    for (let row = 0; row < rows; row++) {
      const offset = row % 2 === 0 ? 0 : SIZE / 4;
      for (let col = -1; col < 2; col++) {
        const x = offset + col * (SIZE / 2);
        const light = 118 + random() * 30;
        ctx.fillStyle = `rgb(${light}, ${light + 4}, ${light + 18})`;
        ctx.fillRect(x + 3, row * height + 3, SIZE / 2 - 6, height - 6);
        // Bevel: a lit top edge and a shaded bottom edge on every block.
        ctx.fillStyle = 'rgba(255,255,255,0.18)';
        ctx.fillRect(x + 3, row * height + 3, SIZE / 2 - 6, 4);
        ctx.fillStyle = 'rgba(0,0,0,0.22)';
        ctx.fillRect(x + 3, row * height + height - 7, SIZE / 2 - 6, 4);
      }
    }
    // A few cracks.
    ctx.strokeStyle = 'rgba(30,30,40,0.55)';
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 6; i++) {
      let x = random() * SIZE;
      let y = random() * SIZE;
      ctx.beginPath();
      ctx.moveTo(x, y);
      for (let j = 0; j < 5; j++) {
        x += (random() - 0.5) * 24;
        y += random() * 12;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    grain(ctx, 3, 0.45);
  });

/** Earthy rock for the underside of floating islands. Covers 6x6 units. */
export const rock = (): THREE.Texture =>
  paint((ctx) => {
    const image = ctx.createImageData(SIZE, SIZE);
    const { data } = image;
    for (let y = 0; y < SIZE; y++) {
      for (let x = 0; x < SIZE; x++) {
        const n = tilingFbm((x / SIZE) * 6, (y / SIZE) * 6, 6, 21, 5);
        // Horizontal strata, bent by the noise.
        const strata = 0.5 + 0.5 * Math.sin((y / SIZE) * Math.PI * 14 + n * 6);
        const v = 0.55 + (n - 0.5) * 0.9 + strata * 0.12;
        const i = (y * SIZE + x) * 4;
        data[i] = 112 * v;
        data[i + 1] = 98 * v;
        data[i + 2] = 92 * v;
        data[i + 3] = 255;
      }
    }
    ctx.putImageData(image, 0, 0);
  });

/** Final Destination's floor: dark panels with fine grooves. Covers 4x4 units. */
export const darkPanels = (): THREE.Texture =>
  paint((ctx) => {
    ctx.fillStyle = '#1a1d3a';
    ctx.fillRect(0, 0, SIZE, SIZE);
    ctx.strokeStyle = '#0a0b1c';
    ctx.lineWidth = 3;
    ctx.strokeRect(0, 0, SIZE, SIZE);
    ctx.strokeRect(0, 0, SIZE / 2, SIZE / 2);
    ctx.strokeRect(SIZE / 2, SIZE / 2, SIZE / 2, SIZE / 2);
    ctx.strokeStyle = 'rgba(120,140,255,0.12)';
    ctx.lineWidth = 1;
    for (let i = 8; i < SIZE; i += 16) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, SIZE);
      ctx.stroke();
    }
    grain(ctx, 31, 0.35, 4);
  });

/** Glowing circuit lines for Final Destination's sides, as an emissive map. Covers 4x4 units. */
export const circuitGlow = (): THREE.Texture =>
  paint((ctx) => {
    const random = seededRandom(41);
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, SIZE, SIZE);
    ctx.strokeStyle = '#7fe7ff';
    ctx.fillStyle = '#7fe7ff';
    ctx.lineWidth = 2;
    ctx.shadowColor = '#4fc8ff';
    ctx.shadowBlur = 6;
    // Lines run along a 16-pixel grid and turn at right angles, ending in a node.
    for (let i = 0; i < 14; i++) {
      let x = Math.floor(random() * 16) * 16;
      let y = Math.floor(random() * 16) * 16;
      ctx.beginPath();
      ctx.moveTo(x, y);
      for (let j = 0; j < 4; j++) {
        if (j % 2 === 0) x += (Math.floor(random() * 5) - 2) * 16;
        else y += (Math.floor(random() * 5) - 2) * 16;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.fillRect(x - 3, y - 3, 6, 6);
    }
  });

/**
 * Gives a geometry texture coordinates in world units (one texture repeat per `scale` units),
 * picked per face from the axis it faces. Textures then keep their size on any box or rock.
 */
export const worldUvs = (geometry: THREE.BufferGeometry, scale: number): THREE.BufferGeometry => {
  const position = geometry.getAttribute('position');
  const normal = geometry.getAttribute('normal');
  const uvs = new Float32Array(position.count * 2);
  for (let i = 0; i < position.count; i++) {
    const [x, y, z] = [position.getX(i), position.getY(i), position.getZ(i)];
    const [nx, ny, nz] = [
      Math.abs(normal.getX(i)),
      Math.abs(normal.getY(i)),
      Math.abs(normal.getZ(i)),
    ];
    const [u, v] = ny >= nx && ny >= nz ? [x, z] : nx >= nz ? [z, y] : [x, y];
    uvs[i * 2] = u / scale;
    uvs[i * 2 + 1] = v / scale;
  }
  geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  return geometry;
};

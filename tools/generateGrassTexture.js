#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PNG } from "pngjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const OUTPUT_DIR = path.join(__dirname, "../public/textures");
const OUTPUT_FILE = path.join(OUTPUT_DIR, "grass.png");
const SIZE = 256;
const SEED = 0x47524153; // "GRAS"

function ensureOutputDir() {
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }
}

function mulberry32(seed) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function fade(t) {
  return t * t * t * (t * (t * 6 - 15) + 10);
}

function valueNoiseFactory(seed, gridSize) {
  const random = mulberry32(seed);
  const grid = new Array(gridSize + 1)
    .fill(0)
    .map(() => new Array(gridSize + 1).fill(0).map(() => random()));

  return (x, y) => {
    const gx = x * gridSize;
    const gy = y * gridSize;
    const x0 = Math.floor(gx);
    const y0 = Math.floor(gy);
    const x1 = (x0 + 1) % gridSize;
    const y1 = (y0 + 1) % gridSize;
    const xf = gx - x0;
    const yf = gy - y0;

    const v00 = grid[x0][y0];
    const v10 = grid[x1][y0];
    const v01 = grid[x0][y1];
    const v11 = grid[x1][y1];

    const u = fade(xf);
    const v = fade(yf);

    const xInterp1 = lerp(v00, v10, u);
    const xInterp2 = lerp(v01, v11, u);
    return lerp(xInterp1, xInterp2, v);
  };
}

function hslToRgb(h, s, l) {
  if (s === 0) {
    const val = Math.round(l * 255);
    return [val, val, val];
  }

  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const r = hueToRgb(p, q, h + 1 / 3);
  const g = hueToRgb(p, q, h);
  const b = hueToRgb(p, q, h - 1 / 3);
  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}

function hueToRgb(p, q, t) {
  if (t < 0) t += 1;
  if (t > 1) t -= 1;
  if (t < 1 / 6) return p + (q - p) * 6 * t;
  if (t < 1 / 2) return q;
  if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
  return p;
}

async function generateTexture() {
  const coarseNoise = valueNoiseFactory(SEED, 8);
  const midNoise = valueNoiseFactory(SEED ^ 0x1234abcd, 20);
  const fineNoise = valueNoiseFactory(SEED ^ 0x9e3779b9, 40);
  const rng = mulberry32(SEED ^ 0xdeadbeef);

  const png = new PNG({ width: SIZE, height: SIZE });

  const bladeCount = 420;
  const blades = new Array(bladeCount).fill(0).map(() => ({
    x: rng() * SIZE,
    y: rng() * SIZE,
    length: lerp(18, 42, rng()),
    width: lerp(0.6, 1.4, rng()),
    angle: lerp(-Math.PI / 6, Math.PI / 6, rng()),
    brightness: lerp(0.04, 0.12, rng()),
  }));

  const bladeInfluence = new Float32Array(SIZE * SIZE).fill(0);

  for (const blade of blades) {
    const cos = Math.cos(blade.angle);
    const sin = Math.sin(blade.angle);
    const steps = Math.ceil(blade.length);

    for (let i = 0; i < steps; i++) {
      const t = i / steps;
      const px = blade.x + cos * i;
      const py = blade.y - sin * i;
      const radius = blade.width * (1 - t * 0.6);

      const minX = Math.floor(px - radius);
      const maxX = Math.ceil(px + radius);
      const minY = Math.floor(py - radius);
      const maxY = Math.ceil(py + radius);

      for (let sy = minY; sy <= maxY; sy++) {
        const wy = ((sy % SIZE) + SIZE) % SIZE;
        for (let sx = minX; sx <= maxX; sx++) {
          const wx = ((sx % SIZE) + SIZE) % SIZE;
          const dx = sx - px;
          const dy = sy - py;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist <= radius) {
            const falloff = 1 - dist / radius;
            bladeInfluence[wy * SIZE + wx] += falloff * blade.brightness;
          }
        }
      }
    }
  }

  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const idx = (y * SIZE + x) << 2;
      const nx = x / SIZE;
      const ny = y / SIZE;

      const low = coarseNoise(nx, ny);
      const mid = midNoise(nx, ny);
      const high = fineNoise(nx, ny);

      const hue = 0.28 + low * 0.03 - high * 0.02;
      let saturation = 0.55 + low * 0.12 - mid * 0.06;
      let lightness = 0.28 + low * 0.1 + mid * 0.05 - high * 0.04;

      const bladeBoost = bladeInfluence[y * SIZE + x];
      lightness = Math.min(0.6, lightness + bladeBoost);
      saturation = Math.min(0.75, saturation + bladeBoost * 0.6);

      const grain = lerp(-0.012, 0.012, rng());
      lightness = Math.max(0.12, Math.min(0.75, lightness + grain));

      const rgb = hslToRgb(hue, saturation, lightness);
      png.data[idx] = rgb[0];
      png.data[idx + 1] = rgb[1];
      png.data[idx + 2] = rgb[2];
      png.data[idx + 3] = 255;
    }
  }

  ensureOutputDir();

  await new Promise((resolve, reject) => {
    const stream = fs.createWriteStream(OUTPUT_FILE);
    png.pack().pipe(stream);
    stream.on("finish", resolve);
    stream.on("error", reject);
  });

  return OUTPUT_FILE;
}

try {
  const file = await generateTexture();
  console.log(`Generated grass texture at ${file}`);
} catch (err) {
  console.error("Failed to generate grass texture", err);
  process.exit(1);
}

#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PNG } from "pngjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const OUTPUT_DIR = path.join(__dirname, "../public/textures");
const OUTPUT_FILE = path.join(OUTPUT_DIR, "cobblestone.png");
const SIZE = 256;
const STONE_COUNT = 140;
const STONE_RADIUS_MIN = 18;
const STONE_RADIUS_MAX = 34;
const EDGE_SOFTNESS = 0.65;
const SEED = 0x4e554b45; // "NUKE" for deterministic randomness

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

function clamp(v, min, max) {
  return v < min ? min : v > max ? max : v;
}

function generateTexture() {
  const random = mulberry32(SEED);
  const stones = [];

  for (let i = 0; i < STONE_COUNT; i++) {
    stones.push({
      x: random() * SIZE,
      y: random() * SIZE,
      radius: lerp(STONE_RADIUS_MIN, STONE_RADIUS_MAX, random()),
      hue: lerp(30, 45, random()),
      valueShift: lerp(-0.12, 0.18, random()),
    });
  }

  const png = new PNG({ width: SIZE, height: SIZE });

  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      let closest = null;
      let secondClosest = null;

      for (const stone of stones) {
        const dxRaw = Math.abs(x - stone.x);
        const dyRaw = Math.abs(y - stone.y);
        const dx = Math.min(dxRaw, SIZE - dxRaw);
        const dy = Math.min(dyRaw, SIZE - dyRaw);
        const dist = Math.sqrt(dx * dx + dy * dy);
        const n = dist / stone.radius;

        if (!closest || n < closest.n) {
          secondClosest = closest;
          closest = { stone, n, dist };
        } else if (!secondClosest || n < secondClosest.n) {
          secondClosest = { stone, n, dist };
        }
      }

      const mortarFactor = secondClosest ? clamp((secondClosest.n - closest.n) * 1.8, 0, 1) : 1;
      const inStone = closest && closest.n <= 1 + EDGE_SOFTNESS;

      let h = 36;
      let s = 0.18;
      let l = 0.32;

      if (inStone) {
        h = closest.stone.hue + lerp(-2, 2, mulberry32((x + 31) ^ (y << 2))());
        s = 0.22;
        const falloff = clamp(1 - clamp((closest.n - 1) / EDGE_SOFTNESS, 0, 1), 0, 1);
        l = 0.38 + closest.stone.valueShift * falloff;
        l += lerp(-0.03, 0.03, mulberry32((x << 5) ^ (y + 17))());
        l = clamp(l, 0.15, 0.65);
      } else {
        l = 0.24 + mortarFactor * 0.05;
        s = 0.1;
      }

      const noise = lerp(-0.015, 0.015, mulberry32((x * 73856093) ^ (y * 19349663))());
      l = clamp(l + noise, 0, 1);

      const rgb = hslToRgb(h / 360, s, l);
      const idx = (y * SIZE + x) << 2;
      png.data[idx] = rgb[0];
      png.data[idx + 1] = rgb[1];
      png.data[idx + 2] = rgb[2];
      png.data[idx + 3] = 255;
    }
  }

  ensureOutputDir();

  return new Promise((resolve, reject) => {
    const stream = fs.createWriteStream(OUTPUT_FILE);
    png.pack().pipe(stream);
    stream.on("finish", () => resolve(OUTPUT_FILE));
    stream.on("error", reject);
  });
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

try {
  const file = await generateTexture();
  console.log(`Generated cobblestone tile at ${file}`);
} catch (err) {
  console.error("Failed to generate cobblestone texture", err);
  process.exit(1);
}

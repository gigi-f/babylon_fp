#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PNG } from "pngjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const OUTPUT_DIR = path.join(__dirname, "../public/textures");
const OUTPUT_FILE = path.join(OUTPUT_DIR, "perimeter_stone.png");
const SIZE = 256;
const BLOCK_ROWS = 8;
const BLOCK_COLS = 12;
const MORTAR_WIDTH = 2;
const ROUGHNESS = 0.12;
const SEED = 0x534f4e45; // "SONE"

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

function hashNoise(x, y, seed) {
  const rnd = mulberry32((x * 374761393 + y * 668265263) ^ seed);
  return rnd();
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
  ensureOutputDir();
  const png = new PNG({ width: SIZE, height: SIZE });
  const random = mulberry32(SEED);

  const cellWidth = SIZE / BLOCK_COLS;
  const cellHeight = SIZE / BLOCK_ROWS;

  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const c = (y * SIZE + x) << 2;

      const col = Math.floor(x / cellWidth);
      const row = Math.floor(y / cellHeight);

      const mortar =
        x % cellWidth < MORTAR_WIDTH ||
        y % cellHeight < MORTAR_WIDTH ||
        cellWidth - (x % cellWidth) < MORTAR_WIDTH ||
        cellHeight - (y % cellHeight) < MORTAR_WIDTH;

      let hue = 0.08;
      let saturation = 0.08;
      let lightness = mortar ? 0.4 : 0.55;

      if (!mortar) {
        const blockSeed = row * BLOCK_COLS + col;
        const rowOffset = ((row % 2) * cellWidth) / 2;
        const offsetX = x + rowOffset;

        const roughNoise = hashNoise(Math.floor(offsetX), Math.floor(y), SEED + blockSeed);
        const bumpNoise = hashNoise(Math.floor(offsetX / 3), Math.floor(y / 3), SEED ^ blockSeed);
        const variation = hashNoise(col, row, SEED ^ 0x9e3779b9) - 0.5;

        hue += variation * 0.05;
        saturation = 0.1 + variation * 0.08;
        lightness = 0.45 + variation * 0.12;
        lightness += roughNoise * ROUGHNESS - ROUGHNESS / 2;
        lightness += bumpNoise * 0.08 - 0.04;
        lightness = clamp(lightness, 0.22, 0.78);
      } else {
        const noise = hashNoise(x, y, SEED ^ 0xdeadbeef) * 0.04 - 0.02;
        lightness = clamp(lightness + noise, 0.35, 0.6);
      }

      const rgb = hslToRgb(hue, saturation, lightness);
      png.data[c] = rgb[0];
      png.data[c + 1] = rgb[1];
      png.data[c + 2] = rgb[2];
      png.data[c + 3] = 255;
    }
  }

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
  console.log(`Generated perimeter stone texture at ${file}`);
} catch (err) {
  console.error("Failed to generate stone texture", err);
  process.exit(1);
}

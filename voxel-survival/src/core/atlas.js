import { ATLAS_TILE as T, ATLAS_COLUMNS as COLS } from '../config.js';
import { TILE_NAMES } from '../world/blocks.js';

/**
 * Procedurally painted texture atlas.
 *
 * Generating the textures at runtime keeps the project asset-free — there is
 * nothing to download, and every tile is reproducible from the code below.
 *
 * Tiles are consumed two ways: as texture-array layers by the world shader
 * (see createTileLayers) and as a square canvas by the HUD, which needs a 2D
 * drawImage source for its block icons.
 */

const SIZE = T * COLS;

/** Deterministic per-pixel hash in [0,1). */
function h(x, y, salt) {
  let n =
    Math.imul(x + 17, 374761393) ^ Math.imul(y + 31, 668265263) ^ Math.imul(salt + 7, 2246822519);
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}

/** Multiply an [r,g,b] triple, clamped to byte range. */
function shade(rgb, k) {
  return [
    Math.max(0, Math.min(255, rgb[0] * k)),
    Math.max(0, Math.min(255, rgb[1] * k)),
    Math.max(0, Math.min(255, rgb[2] * k)),
  ];
}

/** Base colour plus symmetric per-pixel grain, the workhorse of most tiles. */
function grain(base, x, y, salt, amount) {
  return shade(base, 1 + (h(x, y, salt) - 0.5) * amount);
}

/**
 * Painters keyed by tile name. Each returns [r,g,b] or [r,g,b,a] for one texel.
 * Keeping them as pure (x, y) -> colour functions makes the tiles easy to tweak
 * and impossible to get out of sync with the atlas layout.
 */
const PAINTERS = {
  grass_top: (x, y) => grain([106, 168, 79], x, y, 1, 0.22),

  grass_side: (x, y) => {
    // Ragged boundary between the grass cap and the dirt below.
    const fringe = 3 + Math.floor(h(x, 0, 2) * 3);
    if (y < fringe) return grain([106, 168, 79], x, y, 1, 0.22);
    if (y === fringe) return grain([88, 140, 66], x, y, 3, 0.25);
    return grain([139, 101, 68], x, y, 4, 0.18);
  },

  dirt: (x, y) => grain([139, 101, 68], x, y, 4, 0.22),

  stone: (x, y) => {
    const v = h(x, y, 5);
    const base = grain([136, 136, 136], x, y, 5, 0.14);
    return v > 0.93 ? shade(base, 0.82) : base;
  },

  cobblestone: (x, y) => {
    // Voronoi-ish cells give the mortar lines between cobbles.
    const cell = 4;
    const cx = Math.floor(x / cell);
    const cy = Math.floor(y / cell);
    const jx = (h(cx, cy, 6) - 0.5) * 2.5;
    const jy = (h(cx, cy, 7) - 0.5) * 2.5;
    const dx = x - (cx * cell + cell / 2 + jx);
    const dy = y - (cy * cell + cell / 2 + jy);
    const d = Math.hypot(dx, dy);
    const tone = 110 + h(cx, cy, 8) * 55;
    if (d > cell * 0.62) return grain([72, 72, 72], x, y, 9, 0.2);
    return grain([tone, tone, tone], x, y, 10, 0.16);
  },

  sand: (x, y) => grain([224, 211, 160], x, y, 11, 0.12),

  sandstone: (x, y) => {
    const band = Math.floor(y / 4) % 2 === 0 ? 1.0 : 0.94;
    return shade(grain([217, 201, 143], x, y, 12, 0.1), band);
  },

  sandstone_top: (x, y) => grain([222, 207, 152], x, y, 13, 0.12),

  log_top: (x, y) => {
    // Concentric growth rings around the tile centre.
    const dx = x - 7.5;
    const dy = y - 7.5;
    const d = Math.hypot(dx, dy);
    if (d > 7.2) return grain([90, 68, 40], x, y, 14, 0.2);
    const ring = Math.sin(d * 2.2) * 0.5 + 0.5;
    return grain(shade([170, 132, 82], 0.82 + ring * 0.28), x, y, 15, 0.12);
  },

  log_side: (x, y) => {
    // Vertical bark streaks: noise is sampled per-column so it runs with grain.
    const streak = h(x, Math.floor(y / 6), 16);
    return grain(shade([124, 94, 58], 0.85 + streak * 0.35), x, y, 17, 0.14);
  },

  leaves: (x, y) => {
    const v = h(x, y, 18);
    // Holes keep the leaf colour with zero alpha: a transparent black texel
    // would bleed dark fringes into the lower mip levels.
    if (v > 0.88) return [79, 122, 52, 0];
    return [...grain([79, 122, 52], x, y, 19, 0.35), 255];
  },

  planks: (x, y) => {
    const row = Math.floor(y / 4);
    if (y % 4 === 3) return grain([120, 92, 54], x, y, 20, 0.1); // seam
    const offset = row * 5;
    const streak = h(Math.floor((x + offset) / 3), row, 21);
    return grain(shade([176, 138, 82], 0.9 + streak * 0.22), x, y, 22, 0.1);
  },

  water: (x, y) => {
    const wave = Math.sin((x + y * 0.6) * 0.9) * 0.5 + 0.5;
    return [...grain(shade([58, 111, 216], 0.88 + wave * 0.2), x, y, 23, 0.1), 190];
  },

  snow: (x, y) => grain([240, 245, 250], x, y, 24, 0.07),

  snow_side: (x, y) => {
    const fringe = 4 + Math.floor(h(x, 0, 25) * 2);
    if (y < fringe) return grain([240, 245, 250], x, y, 24, 0.07);
    return grain([139, 101, 68], x, y, 4, 0.18);
  },

  glass: (x, y) => {
    const edge = x === 0 || y === 0 || x === T - 1 || y === T - 1;
    if (edge) return [206, 232, 240, 210];
    // A diagonal highlight reads as a reflection without hiding the view.
    if (x + y === 6 || x + y === 7) return [235, 250, 255, 120];
    return [206, 232, 240, 0];
  },

  lamp: (x, y) => {
    const gx = x % 8;
    const gy = y % 8;
    const core = gx > 1 && gx < 7 && gy > 1 && gy < 7;
    return grain(core ? [255, 226, 160] : [206, 160, 92], x, y, 26, 0.12);
  },

  coal_ore: (x, y) => {
    const blob = h(Math.floor(x / 3), Math.floor(y / 3), 27);
    if (blob > 0.62 && h(x, y, 28) > 0.3) return grain([38, 38, 40], x, y, 29, 0.3);
    return PAINTERS.stone(x, y);
  },

  iron_ore: (x, y) => {
    const blob = h(Math.floor(x / 3), Math.floor(y / 3), 30);
    if (blob > 0.66 && h(x, y, 31) > 0.3) return grain([200, 161, 132], x, y, 32, 0.22);
    return PAINTERS.stone(x, y);
  },

  gravel: (x, y) => {
    const cx = Math.floor(x / 3);
    const cy = Math.floor(y / 3);
    const tone = 110 + h(cx, cy, 33) * 60;
    return grain([tone, tone * 0.95, tone * 0.9], x, y, 34, 0.2);
  },

  cactus_top: (x, y) => {
    const inset = x > 1 && x < T - 2 && y > 1 && y < T - 2;
    return grain(inset ? [95, 158, 74] : [63, 109, 48], x, y, 35, 0.14);
  },

  cactus_side: (x, y) => {
    const ridge = x % 8 === 0 || x % 8 === 7;
    return grain(ridge ? [58, 100, 44] : [79, 138, 58], x, y, 36, 0.14);
  },

  bedrock: (x, y) => {
    const v = h(Math.floor(x / 2), Math.floor(y / 2), 37);
    return grain(shade([70, 70, 74], 0.6 + v * 0.7), x, y, 38, 0.25);
  },

  brick: (x, y) => {
    const row = Math.floor(y / 4);
    const offset = row % 2 === 0 ? 0 : 4;
    const mortar = y % 4 === 3 || (x + offset) % 8 === 7;
    if (mortar) return grain([198, 190, 180], x, y, 39, 0.08);
    return grain([164, 85, 63], x, y, 40, 0.14);
  },
};

/** Number of tiles, i.e. layers in the texture array. */
export const TILE_COUNT = TILE_NAMES.length;

/**
 * Render one tile into RGBA bytes. Pure — no DOM — so tiles can be generated
 * and tested outside a browser.
 * @param {string} name
 * @param {Uint8Array|Uint8ClampedArray} [out]
 * @param {number} [offset]
 */
export function paintTile(name, out = new Uint8Array(T * T * 4), offset = 0) {
  const painter = PAINTERS[name];
  if (!painter) throw new Error(`atlas: no painter for tile "${name}"`);
  for (let y = 0; y < T; y++) {
    for (let x = 0; x < T; x++) {
      const c = painter(x, y);
      const i = offset + (y * T + x) * 4;
      out[i] = c[0];
      out[i + 1] = c[1];
      out[i + 2] = c[2];
      out[i + 3] = c.length > 3 ? c[3] : 255;
    }
  }
  return out;
}

/**
 * All tiles packed back-to-back as texture-array layers, in TILE_NAMES order.
 *
 * A texture array rather than a flat atlas is what makes mipmapping possible:
 * each tile is its own layer, so a lower mip level can never average texels
 * from a neighbouring tile the way an atlas would.
 */
export function createTileLayers() {
  const layerBytes = T * T * 4;
  const data = new Uint8Array(TILE_COUNT * layerBytes);
  TILE_NAMES.forEach((name, index) => paintTile(name, data, index * layerBytes));
  return data;
}

/**
 * The same tiles laid out as a square canvas. Only used for HUD block icons,
 * where a 2D drawImage source is more convenient than a GL texture.
 * @returns {HTMLCanvasElement}
 */
export function createAtlasCanvas() {
  const canvas = document.createElement('canvas');
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.clearRect(0, 0, SIZE, SIZE);

  TILE_NAMES.forEach((name, index) => {
    const image = ctx.createImageData(T, T);
    paintTile(name, image.data, 0);
    ctx.putImageData(image, (index % COLS) * T, Math.floor(index / COLS) * T);
  });

  return canvas;
}

/** Tile bounds in pixels, for drawing HUD icons straight from the atlas. */
export function tileRect(tileIndex) {
  return {
    x: (tileIndex % COLS) * T,
    y: Math.floor(tileIndex / COLS) * T,
    w: T,
    h: T,
  };
}

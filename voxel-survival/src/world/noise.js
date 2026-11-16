/**
 * Deterministic, allocation-free value noise.
 *
 * Everything is derived from integer hashes of the lattice coordinates, so the
 * same seed always yields the same world and chunks can be generated in any
 * order without needing shared state.
 */

/** 32-bit integer hash of a 2D lattice point. Returns a uint32. */
function hash2(x, y, seed) {
  let h = seed ^ Math.imul(x | 0, 0x27d4eb2d) ^ Math.imul(y | 0, 0x165667b1);
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return (h ^ (h >>> 16)) >>> 0;
}

/** 32-bit integer hash of a 3D lattice point. Returns a uint32. */
function hash3(x, y, z, seed) {
  let h =
    seed ^
    Math.imul(x | 0, 0x27d4eb2d) ^
    Math.imul(y | 0, 0x165667b1) ^
    Math.imul(z | 0, 0x1b873593);
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return (h ^ (h >>> 16)) >>> 0;
}

const INV_U32 = 1 / 4294967296;

/** Deterministic pseudo-random value in [0,1) for a 2D integer coordinate. */
export function rand2(x, y, seed) {
  return hash2(x, y, seed) * INV_U32;
}

/** Deterministic pseudo-random value in [0,1) for a 3D integer coordinate. */
export function rand3(x, y, z, seed) {
  return hash3(x, y, z, seed) * INV_U32;
}

/** Quintic fade curve — smoother than smoothstep, no second-derivative seams. */
function fade(t) {
  return t * t * t * (t * (t * 6 - 15) + 10);
}

/** 2D value noise in [0,1). */
export function noise2(x, y, seed) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const tx = fade(x - xi);
  const ty = fade(y - yi);

  const n00 = hash2(xi, yi, seed) * INV_U32;
  const n10 = hash2(xi + 1, yi, seed) * INV_U32;
  const n01 = hash2(xi, yi + 1, seed) * INV_U32;
  const n11 = hash2(xi + 1, yi + 1, seed) * INV_U32;

  const a = n00 + (n10 - n00) * tx;
  const b = n01 + (n11 - n01) * tx;
  return a + (b - a) * ty;
}

/** 3D value noise in [0,1). */
export function noise3(x, y, z, seed) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const zi = Math.floor(z);
  const tx = fade(x - xi);
  const ty = fade(y - yi);
  const tz = fade(z - zi);

  const c000 = hash3(xi, yi, zi, seed) * INV_U32;
  const c100 = hash3(xi + 1, yi, zi, seed) * INV_U32;
  const c010 = hash3(xi, yi + 1, zi, seed) * INV_U32;
  const c110 = hash3(xi + 1, yi + 1, zi, seed) * INV_U32;
  const c001 = hash3(xi, yi, zi + 1, seed) * INV_U32;
  const c101 = hash3(xi + 1, yi, zi + 1, seed) * INV_U32;
  const c011 = hash3(xi, yi + 1, zi + 1, seed) * INV_U32;
  const c111 = hash3(xi + 1, yi + 1, zi + 1, seed) * INV_U32;

  const x00 = c000 + (c100 - c000) * tx;
  const x10 = c010 + (c110 - c010) * tx;
  const x01 = c001 + (c101 - c001) * tx;
  const x11 = c011 + (c111 - c011) * tx;

  const y0 = x00 + (x10 - x00) * ty;
  const y1 = x01 + (x11 - x01) * ty;
  return y0 + (y1 - y0) * tz;
}

/**
 * Fractal Brownian motion over noise2. Result is normalised to [0,1).
 * @param {number} frequency starting frequency in blocks^-1
 */
export function fbm2(x, y, seed, octaves = 4, frequency = 0.01, lacunarity = 2, gain = 0.5) {
  let amp = 1;
  let freq = frequency;
  let sum = 0;
  let norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += amp * noise2(x * freq, y * freq, seed + i * 8831);
    norm += amp;
    amp *= gain;
    freq *= lacunarity;
  }
  return sum / norm;
}

/** Fractal Brownian motion over noise3, normalised to [0,1). */
export function fbm3(x, y, z, seed, octaves = 3, frequency = 0.05, lacunarity = 2, gain = 0.5) {
  let amp = 1;
  let freq = frequency;
  let sum = 0;
  let norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += amp * noise3(x * freq, y * freq, z * freq, seed + i * 6151);
    norm += amp;
    amp *= gain;
    freq *= lacunarity;
  }
  return sum / norm;
}

/**
 * Ridged noise — folds fbm around its midpoint to make sharp crests, which is
 * what gives mountains their characteristic ridgelines.
 */
export function ridge2(x, y, seed, octaves = 4, frequency = 0.01) {
  const n = fbm2(x, y, seed, octaves, frequency);
  return 1 - Math.abs(n * 2 - 1);
}

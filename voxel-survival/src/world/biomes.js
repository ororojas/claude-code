import { SEA_LEVEL } from '../config.js';
import { BLOCK } from './blocks.js';
import { fbm2, ridge2 } from './noise.js';
import { clamp, lerp, smoothstep } from '../core/math.js';

export const BIOME = {
  OCEAN: 0,
  BEACH: 1,
  PLAINS: 2,
  FOREST: 3,
  HILLS: 4,
  DESERT: 5,
  SNOWY: 6,
};

export const BIOME_NAMES = [
  'Ocean',
  'Beach',
  'Plains',
  'Forest',
  'Hills',
  'Desert',
  'Snowy Plains',
];

/**
 * fbm2 averages octaves, so its practical range is roughly [0.2, 0.78] rather
 * than the full unit interval. Stretch it back out so thresholds below can be
 * expressed in intuitive 0..1 terms.
 */
function stretch(v) {
  return clamp((v - 0.22) / 0.56, 0, 1);
}

/** Per-biome surface decoration and tree density. */
export const BIOME_TRAITS = {
  [BIOME.OCEAN]: { surface: BLOCK.SAND, subsurface: BLOCK.SAND, treeDensity: 0 },
  [BIOME.BEACH]: { surface: BLOCK.SAND, subsurface: BLOCK.SAND, treeDensity: 0 },
  [BIOME.PLAINS]: { surface: BLOCK.GRASS, subsurface: BLOCK.DIRT, treeDensity: 0.006 },
  [BIOME.FOREST]: { surface: BLOCK.GRASS, subsurface: BLOCK.DIRT, treeDensity: 0.055 },
  [BIOME.HILLS]: { surface: BLOCK.GRASS, subsurface: BLOCK.DIRT, treeDensity: 0.012 },
  [BIOME.DESERT]: { surface: BLOCK.SAND, subsurface: BLOCK.SANDSTONE, treeDensity: 0.004 },
  [BIOME.SNOWY]: { surface: BLOCK.SNOW, subsurface: BLOCK.DIRT, treeDensity: 0.018 },
};

/**
 * Sample the terrain shape and climate for one world column.
 *
 * Height blends three independent fields:
 *  - `continent` moves whole regions above or below sea level,
 *  - `relief` decides locally how mountainous the terrain is allowed to be,
 *  - `surface`/`ridges` supply the actual bumps, with ridged noise fading in
 *    only on high-relief terrain so plains stay genuinely flat.
 *
 * @returns {{height:number, biome:number, relief:number, temperature:number, humidity:number}}
 */
export function sampleColumn(wx, wz, seed) {
  const continent = stretch(fbm2(wx, wz, seed + 101, 3, 0.0009));
  const hilliness = stretch(fbm2(wx, wz, seed + 211, 3, 0.0016));
  const surface = stretch(fbm2(wx, wz, seed + 307, 5, 0.0075)) * 2 - 1;

  const mountainous = smoothstep(0.45, 0.86, hilliness);
  // Even "flat" biomes keep a few blocks of relief; without it low-hilliness
  // regions collapse into featureless shelves.
  const relief = lerp(6.5, 44, mountainous);

  // Ridged noise only contributes on mountainous terrain, giving crests up top
  // without corrugating the plains.
  const ridges = (ridge2(wx, wz, seed + 401, 4, 0.0042) - 0.5) * 2;
  // High-frequency detail keeps hillsides and shorelines from looking extruded.
  const detail = (stretch(fbm2(wx, wz, seed + 809, 3, 0.021)) * 2 - 1) * 2.4;

  let height =
    SEA_LEVEL +
    5 +
    (continent - 0.38) * 24 +
    surface * relief +
    ridges * relief * 0.45 * mountainous +
    detail;

  // Compress everything below sea level so oceans stay shallow and swimmable
  // instead of opening into unlit trenches.
  if (height < SEA_LEVEL) height = SEA_LEVEL - (SEA_LEVEL - height) * 0.55;

  height = Math.round(clamp(height, 6, 118));

  const temperature = clamp(
    stretch(fbm2(wx, wz, seed + 503, 3, 0.0011)) - (height - SEA_LEVEL) * 0.004,
    0,
    1
  );
  const humidity = stretch(fbm2(wx, wz, seed + 607, 3, 0.0013));

  let biome;
  if (height <= SEA_LEVEL) biome = BIOME.OCEAN;
  else if (height <= SEA_LEVEL + 2) biome = BIOME.BEACH;
  else if (temperature < 0.26) biome = BIOME.SNOWY;
  else if (temperature > 0.62 && humidity < 0.45) biome = BIOME.DESERT;
  else if (mountainous > 0.5) biome = BIOME.HILLS;
  else if (humidity > 0.54) biome = BIOME.FOREST;
  else biome = BIOME.PLAINS;

  return { height, biome, relief: mountainous, temperature, humidity };
}

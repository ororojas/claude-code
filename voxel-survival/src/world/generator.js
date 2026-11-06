import { CHUNK_SIZE, CHUNK_HEIGHT, SEA_LEVEL, BEDROCK_DEPTH } from '../config.js';
import { BLOCK } from './blocks.js';
import { blockIndex } from './chunk.js';
import { BIOME, BIOME_TRAITS, sampleColumn } from './biomes.js';
import { rand2, rand3, fbm3 } from './noise.js';

/** Salts keep independent random decisions from correlating with each other. */
const SALT_TREE = 9001;
const SALT_TREE_SIZE = 9002;
const SALT_ORE = 9003;
const SALT_GRAVEL = 9004;

/** Widest horizontal reach of any structure, in blocks. */
const STRUCTURE_MARGIN = 2;

/**
 * Deterministic tree/cactus placement for a single world column.
 *
 * A column only grows a tree if it is a density candidate *and* has the lowest
 * random value in its 5x5 neighbourhood. That local-minimum test guarantees a
 * minimum spacing without any shared state, so a tree straddling a chunk border
 * is generated identically from either side.
 *
 * @returns {{kind:'oak'|'cactus', height:number}|null}
 */
export function structureAt(wx, wz, seed, biome) {
  const traits = BIOME_TRAITS[biome];
  if (!traits || traits.treeDensity <= 0) return null;

  const r = rand2(wx, wz, seed + SALT_TREE);
  if (r >= traits.treeDensity) return null;

  for (let dz = -2; dz <= 2; dz++) {
    for (let dx = -2; dx <= 2; dx++) {
      if (dx === 0 && dz === 0) continue;
      if (rand2(wx + dx, wz + dz, seed + SALT_TREE) < r) return null;
    }
  }

  const size = rand2(wx, wz, seed + SALT_TREE_SIZE);
  if (biome === BIOME.DESERT) {
    return { kind: 'cactus', height: 2 + Math.floor(size * 3) };
  }
  return { kind: 'oak', height: 4 + Math.floor(size * 3) };
}

/** True where the 3D cave field carves rock away. */
function isCave(wx, wy, wz, seed) {
  // Squashing Y stretches caverns horizontally, which reads as tunnels rather
  // than spherical bubbles.
  const n = fbm3(wx, wy * 1.9, wz, seed + 733, 3, 0.026);
  return n > 0.615;
}

/**
 * Fill a chunk's block array with terrain, caves, ores and structures.
 * Pure function of (chunk coordinates, seed) — no neighbour state required.
 */
export function generateChunk(chunk, seed) {
  const { blocks, originX, originZ } = chunk;
  blocks.fill(BLOCK.AIR);

  // --- Column shape --------------------------------------------------------
  const heights = new Int32Array(CHUNK_SIZE * CHUNK_SIZE);
  const biomes = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE);

  for (let z = 0; z < CHUNK_SIZE; z++) {
    for (let x = 0; x < CHUNK_SIZE; x++) {
      const col = z * CHUNK_SIZE + x;
      const sample = sampleColumn(originX + x, originZ + z, seed);
      heights[col] = sample.height;
      biomes[col] = sample.biome;
    }
  }

  // --- Stone, soil, water --------------------------------------------------
  for (let z = 0; z < CHUNK_SIZE; z++) {
    for (let x = 0; x < CHUNK_SIZE; x++) {
      const col = z * CHUNK_SIZE + x;
      const height = heights[col];
      const traits = BIOME_TRAITS[biomes[col]];
      const wx = originX + x;
      const wz = originZ + z;
      const underwater = height <= SEA_LEVEL;
      const soilDepth = 3 + (rand2(wx, wz, seed + SALT_GRAVEL) < 0.5 ? 1 : 0);

      for (let y = 0; y <= height && y < CHUNK_HEIGHT; y++) {
        let id;
        if (y < BEDROCK_DEPTH) {
          // Ragged bedrock floor, so the world bottom is not a flat plane.
          id = y === 0 || rand3(wx, y, wz, seed + 17) < 0.6 ? BLOCK.BEDROCK : BLOCK.STONE;
        } else if (y === height) {
          id = underwater ? BLOCK.SAND : traits.surface;
        } else if (y > height - soilDepth) {
          id = underwater ? BLOCK.SAND : traits.subsurface;
        } else {
          id = BLOCK.STONE;
        }

        // Carve caves, but leave a solid cap under the surface so the terrain
        // skin (and any water above it) is never breached.
        if (id === BLOCK.STONE && y >= BEDROCK_DEPTH + 1 && y < height - 4) {
          if (isCave(wx, y, wz, seed)) continue;
        }

        if (id === BLOCK.STONE) {
          const ore = rand3(wx, y, wz, seed + SALT_ORE);
          if (y < 52 && ore < 0.009) id = BLOCK.COAL_ORE;
          else if (y < 34 && ore > 0.991) id = BLOCK.IRON_ORE;
          else if (y > 20 && ore > 0.982 && ore < 0.9885) id = BLOCK.GRAVEL;
        }

        blocks[blockIndex(x, y, z)] = id;
      }

      for (let y = height + 1; y <= SEA_LEVEL && y < CHUNK_HEIGHT; y++) {
        blocks[blockIndex(x, y, z)] = BLOCK.WATER;
      }
    }
  }

  // --- Structures ----------------------------------------------------------
  // Iterate a margin beyond the chunk so trees rooted in a neighbour still drop
  // their overhanging canopy blocks into this chunk.
  for (let z = -STRUCTURE_MARGIN; z < CHUNK_SIZE + STRUCTURE_MARGIN; z++) {
    for (let x = -STRUCTURE_MARGIN; x < CHUNK_SIZE + STRUCTURE_MARGIN; x++) {
      const wx = originX + x;
      const wz = originZ + z;
      const inside = x >= 0 && x < CHUNK_SIZE && z >= 0 && z < CHUNK_SIZE;

      const sample = inside
        ? { height: heights[z * CHUNK_SIZE + x], biome: biomes[z * CHUNK_SIZE + x] }
        : sampleColumn(wx, wz, seed);

      if (sample.height <= SEA_LEVEL) continue;
      const structure = structureAt(wx, wz, seed, sample.biome);
      if (!structure) continue;

      if (structure.kind === 'cactus') {
        placeCactus(chunk, x, sample.height + 1, z, structure.height);
      } else {
        placeOak(chunk, x, sample.height + 1, z, structure.height);
      }
    }
  }

  chunk.rebuildHeightmap();
  chunk.generated = true;
  chunk.dirty = true;
}

/** Write a block only if it lands inside the chunk and does not overwrite solids. */
function put(chunk, x, y, z, id, overwrite) {
  if (x < 0 || x >= CHUNK_SIZE || z < 0 || z >= CHUNK_SIZE) return;
  if (y < 0 || y >= CHUNK_HEIGHT) return;
  const i = blockIndex(x, y, z);
  const existing = chunk.blocks[i];
  if (!overwrite && existing !== BLOCK.AIR && existing !== BLOCK.WATER) return;
  chunk.blocks[i] = id;
}

function placeCactus(chunk, x, baseY, z, height) {
  for (let dy = 0; dy < height; dy++) {
    put(chunk, x, baseY + dy, z, BLOCK.CACTUS, true);
  }
}

/**
 * Classic oak silhouette: a bare trunk, two wide canopy layers, a narrow layer
 * and a plus-shaped crown.
 */
function placeOak(chunk, x, baseY, z, height) {
  for (let dy = 0; dy < height; dy++) {
    put(chunk, x, baseY + dy, z, BLOCK.LOG, true);
  }

  const top = baseY + height;
  for (let y = top - 3; y <= top; y++) {
    const radius = y >= top - 1 ? 1 : 2;
    for (let dz = -radius; dz <= radius; dz++) {
      for (let dx = -radius; dx <= radius; dx++) {
        const manhattan = Math.abs(dx) + Math.abs(dz);
        if (radius === 2 && manhattan > 3) continue; // clip the far corners
        if (y === top && manhattan > 1) continue; // crown is a plus
        if (dx === 0 && dz === 0 && y < top) continue; // leave room for the trunk
        put(chunk, x + dx, y, z + dz, BLOCK.LEAVES, false);
      }
    }
  }
}

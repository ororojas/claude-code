import { CHUNK_SIZE, CHUNK_HEIGHT } from '../config.js';
import { BLOCK } from './blocks.js';

/** Blocks per chunk. */
export const CHUNK_VOLUME = CHUNK_SIZE * CHUNK_SIZE * CHUNK_HEIGHT;

/**
 * Flatten local block coordinates. Y is the slowest-varying axis so that a
 * vertical column is strided and horizontal slices are contiguous, which suits
 * the meshing and heightmap loops.
 */
export function blockIndex(x, y, z) {
  return (y * CHUNK_SIZE + z) * CHUNK_SIZE + x;
}

/** Stable map key for a chunk coordinate pair. */
export function chunkKey(cx, cz) {
  return `${cx},${cz}`;
}

/** Floor-divide a world coordinate into a chunk coordinate. */
export function toChunkCoord(w) {
  return Math.floor(w / CHUNK_SIZE);
}

/** World coordinate wrapped into [0, CHUNK_SIZE). */
export function toLocalCoord(w) {
  return ((w % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
}

/**
 * A 16 x 128 x 16 column of blocks plus its render state.
 *
 * `dirty` marks the mesh as stale; the renderer owns `mesh` and disposes GPU
 * buffers when the chunk is unloaded.
 */
export class Chunk {
  constructor(cx, cz) {
    this.cx = cx;
    this.cz = cz;
    this.originX = cx * CHUNK_SIZE;
    this.originZ = cz * CHUNK_SIZE;
    this.blocks = new Uint8Array(CHUNK_VOLUME);
    /** Highest non-air block + 1, per column; speeds up meshing and lighting. */
    this.heightmap = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE);
    this.generated = false;
    this.dirty = true;
    this.mesh = null;
  }

  get(x, y, z) {
    if (y < 0 || y >= CHUNK_HEIGHT) return BLOCK.AIR;
    return this.blocks[blockIndex(x, y, z)];
  }

  set(x, y, z, id) {
    if (y < 0 || y >= CHUNK_HEIGHT) return;
    this.blocks[blockIndex(x, y, z)] = id;
  }

  /** Recompute the per-column heightmap from scratch. */
  rebuildHeightmap() {
    const { blocks, heightmap } = this;
    heightmap.fill(0);
    for (let y = CHUNK_HEIGHT - 1; y >= 0; y--) {
      const yBase = y * CHUNK_SIZE * CHUNK_SIZE;
      for (let z = 0; z < CHUNK_SIZE; z++) {
        const rowBase = yBase + z * CHUNK_SIZE;
        for (let x = 0; x < CHUNK_SIZE; x++) {
          const col = z * CHUNK_SIZE + x;
          if (heightmap[col] === 0 && blocks[rowBase + x] !== BLOCK.AIR) {
            heightmap[col] = y + 1;
          }
        }
      }
    }
  }
}

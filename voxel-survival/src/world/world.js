import { CHUNK_SIZE, CHUNK_HEIGHT, SEA_LEVEL, RENDER_DISTANCE, DATA_DISTANCE } from '../config.js';
import { BLOCK, isSolid } from './blocks.js';
import { Chunk, chunkKey, toChunkCoord, toLocalCoord, blockIndex } from './chunk.js';
import { generateChunk } from './generator.js';
import { buildChunkMesh } from './mesher.js';
import { sampleColumn } from './biomes.js';

/** Chunk offsets sorted nearest-first, so streaming always fills inwards-out. */
function ringOffsets(radius) {
  const offsets = [];
  for (let dz = -radius; dz <= radius; dz++) {
    for (let dx = -radius; dx <= radius; dx++) {
      const d2 = dx * dx + dz * dz;
      if (d2 <= radius * radius) offsets.push([dx, dz, d2]);
    }
  }
  offsets.sort((a, b) => a[2] - b[2]);
  return offsets;
}

const DATA_OFFSETS = ringOffsets(DATA_DISTANCE);
const RENDER_OFFSETS = ringOffsets(RENDER_DISTANCE);
/** Chunks are dropped a little beyond the data radius to avoid thrashing. */
const UNLOAD_DISTANCE = DATA_DISTANCE + 2;

/**
 * Owns every loaded chunk and the streaming state machine.
 *
 * Data is generated one ring wider than the render distance so that meshes
 * always have real neighbours to cull and shade against — without that, chunk
 * borders show seams of missing faces.
 */
export class World {
  /**
   * @param {number} seed
   * @param {{onMesh?:Function, onUnload?:Function}} hooks renderer callbacks
   */
  constructor(seed, hooks = {}) {
    this.seed = seed >>> 0;
    this.chunks = new Map();
    this.onMesh = hooks.onMesh ?? (() => {});
    this.onUnload = hooks.onUnload ?? (() => {});
    this.stats = { generated: 0, meshed: 0 };
    // Bound once so the mesher's inner loop is not re-creating a closure.
    this.sampleBlock = (x, y, z) => this.getBlock(x, y, z);
  }

  getChunk(cx, cz) {
    return this.chunks.get(chunkKey(cx, cz));
  }

  /** Get (or generate) the chunk at these chunk coordinates. */
  ensureChunk(cx, cz) {
    const key = chunkKey(cx, cz);
    let chunk = this.chunks.get(key);
    if (!chunk) {
      chunk = new Chunk(cx, cz);
      generateChunk(chunk, this.seed);
      this.chunks.set(key, chunk);
      this.stats.generated++;
    }
    return chunk;
  }

  /** Block id at world coordinates; air outside the vertical range. */
  getBlock(wx, wy, wz) {
    if (wy < 0 || wy >= CHUNK_HEIGHT) return BLOCK.AIR;
    const chunk = this.chunks.get(chunkKey(toChunkCoord(wx), toChunkCoord(wz)));
    if (!chunk) return BLOCK.AIR;
    return chunk.blocks[blockIndex(toLocalCoord(wx), wy, toLocalCoord(wz))];
  }

  /**
   * Write a block and invalidate every mesh that sampled it. A block on a chunk
   * edge appears in the neighbour's padded mesh region too, so up to four
   * chunks (including the diagonal) must be re-meshed.
   */
  setBlock(wx, wy, wz, id) {
    if (wy < 0 || wy >= CHUNK_HEIGHT) return false;
    const cx = toChunkCoord(wx);
    const cz = toChunkCoord(wz);
    const chunk = this.getChunk(cx, cz);
    if (!chunk) return false;

    const lx = toLocalCoord(wx);
    const lz = toLocalCoord(wz);
    if (chunk.blocks[blockIndex(lx, wy, lz)] === id) return false;

    chunk.blocks[blockIndex(lx, wy, lz)] = id;
    chunk.rebuildHeightmap();
    chunk.dirty = true;

    const dxs = lx === 0 ? [-1] : lx === CHUNK_SIZE - 1 ? [1] : [];
    const dzs = lz === 0 ? [-1] : lz === CHUNK_SIZE - 1 ? [1] : [];
    for (const dx of dxs) this.markDirty(cx + dx, cz);
    for (const dz of dzs) this.markDirty(cx, cz + dz);
    for (const dx of dxs) for (const dz of dzs) this.markDirty(cx + dx, cz + dz);

    return true;
  }

  markDirty(cx, cz) {
    const chunk = this.getChunk(cx, cz);
    if (chunk) chunk.dirty = true;
  }

  /** True once all eight neighbours exist, which meshing requires. */
  neighboursReady(cx, cz) {
    for (let dz = -1; dz <= 1; dz++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dz === 0) continue;
        if (!this.chunks.has(chunkKey(cx + dx, cz + dz))) return false;
      }
    }
    return true;
  }

  /** Build (or rebuild) one chunk's mesh and hand it to the renderer. */
  meshChunk(chunk) {
    const mesh = buildChunkMesh(chunk, this.sampleBlock);
    chunk.dirty = false;
    this.stats.meshed++;
    this.onMesh(chunk, mesh);
  }

  /**
   * Advance streaming for one frame.
   *
   * Generation runs before meshing because a mesh is only correct once its
   * neighbours exist; both share a single time budget so a frame never stalls.
   *
   * @param {number} px player world X
   * @param {number} pz player world Z
   * @param {number} budgetMs
   */
  update(px, pz, budgetMs) {
    const pcx = toChunkCoord(px);
    const pcz = toChunkCoord(pz);
    const start = performance.now();

    // Generation and meshing each get a guaranteed slice. Letting generation
    // consume the whole budget would starve meshing while the outer rings fill
    // in, leaving the player standing in an invisible world.
    const genDeadline = start + budgetMs * 0.55;
    const meshDeadline = start + budgetMs;

    for (const [dx, dz] of DATA_OFFSETS) {
      if (performance.now() >= genDeadline) break;
      const key = chunkKey(pcx + dx, pcz + dz);
      if (!this.chunks.has(key)) this.ensureChunk(pcx + dx, pcz + dz);
    }

    for (const [dx, dz] of RENDER_OFFSETS) {
      if (performance.now() >= meshDeadline) break;
      const cx = pcx + dx;
      const cz = pcz + dz;
      const chunk = this.getChunk(cx, cz);
      if (!chunk || !chunk.dirty) continue;
      if (!this.neighboursReady(cx, cz)) continue;
      this.meshChunk(chunk);
    }

    this.unloadDistant(pcx, pcz);
  }

  unloadDistant(pcx, pcz) {
    for (const [key, chunk] of this.chunks) {
      if (
        Math.abs(chunk.cx - pcx) > UNLOAD_DISTANCE ||
        Math.abs(chunk.cz - pcz) > UNLOAD_DISTANCE
      ) {
        this.onUnload(chunk);
        this.chunks.delete(key);
      }
    }
  }

  /**
   * Generate and mesh everything around a point without a time budget.
   * Used once at startup so the player never drops into an empty world.
   */
  prepareArea(px, pz, radius = 2) {
    const pcx = toChunkCoord(px);
    const pcz = toChunkCoord(pz);
    for (let dz = -radius - 1; dz <= radius + 1; dz++) {
      for (let dx = -radius - 1; dx <= radius + 1; dx++) {
        this.ensureChunk(pcx + dx, pcz + dz);
      }
    }
    for (let dz = -radius; dz <= radius; dz++) {
      for (let dx = -radius; dx <= radius; dx++) {
        const chunk = this.getChunk(pcx + dx, pcz + dz);
        if (chunk && chunk.dirty) this.meshChunk(chunk);
      }
    }
  }

  /**
   * Find a comfortable spawn: dry land above sea level, searched outwards from
   * the origin in a spiral so a seed whose origin lands in the ocean still
   * starts the player on a beach rather than underwater.
   */
  findSpawn() {
    const step = 8;
    for (let radius = 0; radius <= 96; radius++) {
      for (let i = -radius; i <= radius; i++) {
        const candidates =
          radius === 0
            ? [[0, 0]]
            : [
                [i, -radius],
                [i, radius],
                [-radius, i],
                [radius, i],
              ];
        for (const [gx, gz] of candidates) {
          const wx = gx * step;
          const wz = gz * step;
          const { height } = sampleColumn(wx, wz, this.seed);
          if (height > SEA_LEVEL + 1 && height < 96) {
            return { x: wx + 0.5, y: height + 1, z: wz + 0.5 };
          }
        }
      }
    }
    return { x: 0.5, y: SEA_LEVEL + 4, z: 0.5 };
  }

  /** Highest solid block at a column, used to drop the player onto terrain. */
  surfaceHeight(wx, wz) {
    for (let y = CHUNK_HEIGHT - 1; y >= 0; y--) {
      if (isSolid(this.getBlock(wx, y, wz))) return y + 1;
    }
    return SEA_LEVEL;
  }
}

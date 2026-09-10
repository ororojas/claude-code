import { CHUNK_SIZE, CHUNK_HEIGHT } from '../config.js';
import { BLOCK, BLOCKS, BLOCK_TILES, PASS } from './blocks.js';
import { clamp } from '../core/math.js';

// --- Padded neighbourhood ---------------------------------------------------
// Meshing needs one block of context in every direction (for face culling and
// ambient occlusion). Copying that neighbourhood into a flat scratch array once
// turns millions of chunk-boundary lookups into plain array indexing.
const PAD = 1;
const PW = CHUNK_SIZE + PAD * 2; // 18
const PH = CHUNK_HEIGHT + PAD * 2; // 130
const P_STRIDE_Z = PW;
const P_STRIDE_Y = PW * PW;

const padIndex = (px, py, pz) => (py + PAD) * P_STRIDE_Y + (pz + PAD) * P_STRIDE_Z + (px + PAD);

/** Reused across chunks — meshing is single-threaded and synchronous. */
const padded = new Uint8Array(PW * PW * PH);
const skyHeight = new Int16Array(PW * PW);

// --- Cube geometry ----------------------------------------------------------
/**
 * The six faces, wound counter-clockwise when seen from outside the cube so
 * GL_BACK culling keeps the outward side. Corner order matters: the ambient
 * occlusion tables below are derived from it.
 */
const FACES = [
  {
    // +X
    normal: [1, 0, 0],
    corners: [
      [1, 0, 0],
      [1, 1, 0],
      [1, 1, 1],
      [1, 0, 1],
    ],
    uvs: [
      [0, 1],
      [0, 0],
      [1, 0],
      [1, 1],
    ],
    shade: 0.72,
    tile: 2,
  },
  {
    // -X
    normal: [-1, 0, 0],
    corners: [
      [0, 0, 0],
      [0, 0, 1],
      [0, 1, 1],
      [0, 1, 0],
    ],
    uvs: [
      [0, 1],
      [1, 1],
      [1, 0],
      [0, 0],
    ],
    shade: 0.72,
    tile: 2,
  },
  {
    // +Y (top)
    normal: [0, 1, 0],
    corners: [
      [0, 1, 0],
      [0, 1, 1],
      [1, 1, 1],
      [1, 1, 0],
    ],
    uvs: [
      [0, 0],
      [0, 1],
      [1, 1],
      [1, 0],
    ],
    shade: 1.0,
    tile: 0,
  },
  {
    // -Y (bottom)
    normal: [0, -1, 0],
    corners: [
      [0, 0, 0],
      [1, 0, 0],
      [1, 0, 1],
      [0, 0, 1],
    ],
    uvs: [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
    ],
    shade: 0.5,
    tile: 1,
  },
  {
    // +Z
    normal: [0, 0, 1],
    corners: [
      [0, 0, 1],
      [1, 0, 1],
      [1, 1, 1],
      [0, 1, 1],
    ],
    uvs: [
      [0, 1],
      [1, 1],
      [1, 0],
      [0, 0],
    ],
    shade: 0.86,
    tile: 2,
  },
  {
    // -Z
    normal: [0, 0, -1],
    corners: [
      [0, 0, 0],
      [0, 1, 0],
      [1, 1, 0],
      [1, 0, 0],
    ],
    uvs: [
      [1, 1],
      [1, 0],
      [0, 0],
      [0, 1],
    ],
    shade: 0.86,
    tile: 2,
  },
];

/**
 * For every face/vertex pair, the three neighbouring cells that determine that
 * vertex's ambient occlusion, expressed as offsets from the *source* block.
 * Derived from the corner tables so the two never drift apart.
 */
const AO_OFFSETS = (() => {
  // Layout: [face][vertex][side0 xyz, side1 xyz, corner xyz] = 9 values.
  const flat = new Int8Array(6 * 4 * 9);
  FACES.forEach((face, f) => {
    const n = face.normal;
    const tangents = [0, 1, 2].filter((axis) => n[axis] === 0);
    face.corners.forEach((corner, v) => {
      const axisVec = (axis, amount) => [
        axis === 0 ? amount : 0,
        axis === 1 ? amount : 0,
        axis === 2 ? amount : 0,
      ];
      const t0 = axisVec(tangents[0], corner[tangents[0]] === 1 ? 1 : -1);
      const t1 = axisVec(tangents[1], corner[tangents[1]] === 1 ? 1 : -1);
      const base = (f * 4 + v) * 9;
      for (let a = 0; a < 3; a++) {
        flat[base + a] = n[a] + t0[a];
        flat[base + 3 + a] = n[a] + t1[a];
        flat[base + 6 + a] = n[a] + t0[a] + t1[a];
      }
    });
  });
  return flat;
})();

/** Occlusion multiplier for AO levels 0 (darkest) .. 3 (unoccluded). */
const AO_LEVELS = [0.46, 0.66, 0.84, 1.0];

/** How fast skylight decays per block below the terrain surface. */
const SKY_FALLOFF = 0.14;
const SKY_MIN = 0.06;

/**
 * Copy the chunk plus a one-block shell of its neighbours into `padded`.
 * @param {(wx:number,wy:number,wz:number)=>number} sample world block lookup
 */
function fillPadded(chunk, sample) {
  const { blocks, originX, originZ } = chunk;

  // Interior rows copy straight across; each z-row is contiguous in both arrays.
  for (let y = 0; y < CHUNK_HEIGHT; y++) {
    for (let z = 0; z < CHUNK_SIZE; z++) {
      const src = (y * CHUNK_SIZE + z) * CHUNK_SIZE;
      padded.set(blocks.subarray(src, src + CHUNK_SIZE), padIndex(0, y, z));
    }
  }

  // Shell cells fall outside the chunk, so they need real world lookups.
  for (let py = -PAD; py < CHUNK_HEIGHT + PAD; py++) {
    const yEdge = py < 0 || py >= CHUNK_HEIGHT;
    for (let pz = -PAD; pz < CHUNK_SIZE + PAD; pz++) {
      const zEdge = pz < 0 || pz >= CHUNK_SIZE;
      for (let px = -PAD; px < CHUNK_SIZE + PAD; px++) {
        if (!yEdge && !zEdge && px >= 0 && px < CHUNK_SIZE) continue;
        padded[padIndex(px, py, pz)] = sample(originX + px, py, originZ + pz);
      }
    }
  }
}

/** Highest light-blocking block per padded column, used for cheap skylight. */
function buildSkyHeights() {
  skyHeight.fill(0);
  for (let pz = -PAD; pz < CHUNK_SIZE + PAD; pz++) {
    for (let px = -PAD; px < CHUNK_SIZE + PAD; px++) {
      let top = 0;
      for (let py = CHUNK_HEIGHT - 1; py >= 0; py--) {
        const id = padded[padIndex(px, py, pz)];
        if (id !== BLOCK.AIR && BLOCKS[id].blocksLight) {
          top = py + 1;
          break;
        }
      }
      skyHeight[(pz + PAD) * P_STRIDE_Z + (px + PAD)] = top;
    }
  }
}

/**
 * Skylight at a cell: full above the terrain surface, fading with depth beneath
 * it. Cheap enough to run per face while still shading caves, overhangs and the
 * ground under a tree canopy.
 */
function skyAt(px, py, pz) {
  const top = skyHeight[(pz + PAD) * P_STRIDE_Z + (px + PAD)];
  if (py >= top) return 1;
  return clamp(1 - (top - py) * SKY_FALLOFF, SKY_MIN, 1);
}

/** Growable vertex sink; avoids re-allocating a Float32Array per push. */
class VertexSink {
  constructor(initial = 4096) {
    this.data = new Float32Array(initial);
    this.length = 0;
  }

  reserve(floats) {
    if (this.length + floats <= this.data.length) return;
    let size = this.data.length * 2;
    while (size < this.length + floats) size *= 2;
    const next = new Float32Array(size);
    next.set(this.data.subarray(0, this.length));
    this.data = next;
  }

  push(x, y, z, u, v, layer, occ, sky, glow) {
    const d = this.data;
    let i = this.length;
    d[i++] = x;
    d[i++] = y;
    d[i++] = z;
    d[i++] = u;
    d[i++] = v;
    d[i++] = layer;
    d[i++] = occ;
    d[i++] = sky;
    d[i++] = glow;
    this.length = i;
  }

  finish() {
    return this.data.slice(0, this.length);
  }
}

/**
 * Floats per vertex: position(3) + uv(2) + tile layer + occlusion + skylight
 * + glow. UVs are plain 0..1 tile coordinates because each tile is its own
 * texture-array layer.
 */
export const FLOATS_PER_VERTEX = 9;

/**
 * Build the opaque and water vertex buffers for one chunk.
 *
 * @param {import('./chunk.js').Chunk} chunk
 * @param {(wx:number,wy:number,wz:number)=>number} sample world block lookup
 * @returns {{opaque:Float32Array, water:Float32Array}}
 */
export function buildChunkMesh(chunk, sample) {
  fillPadded(chunk, sample);
  buildSkyHeights();

  const opaque = new VertexSink(8192);
  const water = new VertexSink(1024);

  for (let y = 0; y < CHUNK_HEIGHT; y++) {
    for (let z = 0; z < CHUNK_SIZE; z++) {
      for (let x = 0; x < CHUNK_SIZE; x++) {
        const id = padded[padIndex(x, y, z)];
        if (id === BLOCK.AIR) continue;

        const def = BLOCKS[id];
        const sink = def.pass === PASS.WATER ? water : opaque;
        const tiles = BLOCK_TILES[id];

        for (let f = 0; f < 6; f++) {
          const face = FACES[f];
          const nx = x + face.normal[0];
          const ny = y + face.normal[1];
          const nz = z + face.normal[2];

          // The world's floor and ceiling never need faces.
          if (ny < 0 || ny >= CHUNK_HEIGHT) continue;

          const neighbour = padded[padIndex(nx, ny, nz)];
          if (neighbour !== BLOCK.AIR) {
            const nd = BLOCKS[neighbour];
            if (nd.opaque) continue; // hidden by a solid neighbour
            if (neighbour === id && def.selfCull) continue; // shared inner face
          }

          emitFace(sink, face, f, x, y, z, nx, ny, nz, tiles, def);
        }
      }
    }
  }

  return { opaque: opaque.finish(), water: water.finish() };
}

/** True if a padded cell fully occludes light for AO purposes. */
function occludes(px, py, pz) {
  if (py < 0 || py >= CHUNK_HEIGHT) return false;
  const id = padded[padIndex(px, py, pz)];
  return id !== BLOCK.AIR && BLOCKS[id].opaque;
}

// Per-face scratch, reused across calls. emitFace is not re-entrant, and
// allocating six small arrays per face dominated the mesher's cost.
const px = new Float32Array(4);
const py = new Float32Array(4);
const pz = new Float32Array(4);
const uu = new Float32Array(4);
const vv = new Float32Array(4);
const oc = new Float32Array(4);

const QUAD_ORDER = new Uint8Array([0, 1, 2, 0, 2, 3]);
const QUAD_ORDER_FLIPPED = new Uint8Array([1, 2, 3, 1, 3, 0]);

function emitFace(sink, face, faceIndex, x, y, z, nx, ny, nz, tiles, def) {
  const layer = tiles[face.tile];

  const sky = skyAt(nx, ny, nz);
  const glow = def.glow;

  // Water sits slightly below a full block so its surface is visible from the
  // shore and from underneath, matching how the player floats in it.
  let topOffset = 0;
  if (def.pass === PASS.WATER) {
    const above = y + 1 >= CHUNK_HEIGHT ? BLOCK.AIR : padded[padIndex(x, y + 1, z)];
    if (BLOCKS[above].pass !== PASS.WATER) topOffset = -0.12;
  }

  for (let i = 0; i < 4; i++) {
    const corner = face.corners[i];
    px[i] = x + corner[0];
    py[i] = y + corner[1] + (corner[1] === 1 ? topOffset : 0);
    pz[i] = z + corner[2];
    uu[i] = face.uvs[i][0];
    vv[i] = face.uvs[i][1];

    const o = (faceIndex * 4 + i) * 9;
    const s0 = occludes(x + AO_OFFSETS[o], y + AO_OFFSETS[o + 1], z + AO_OFFSETS[o + 2]);
    const s1 = occludes(x + AO_OFFSETS[o + 3], y + AO_OFFSETS[o + 4], z + AO_OFFSETS[o + 5]);
    const cn = occludes(x + AO_OFFSETS[o + 6], y + AO_OFFSETS[o + 7], z + AO_OFFSETS[o + 8]);
    // Two touching sides fully enclose the corner, so the classic AO rule
    // short-circuits to the darkest level regardless of the diagonal.
    const level = s0 && s1 ? 0 : 3 - (s0 ? 1 : 0) - (s1 ? 1 : 0) - (cn ? 1 : 0);
    oc[i] = AO_LEVELS[level] * face.shade;
  }

  sink.reserve(6 * FLOATS_PER_VERTEX);

  // Split the quad along whichever diagonal keeps the darkest corners together;
  // the other diagonal produces a visible gradient seam.
  const order = oc[0] + oc[2] > oc[1] + oc[3] ? QUAD_ORDER : QUAD_ORDER_FLIPPED;

  for (let k = 0; k < 6; k++) {
    const i = order[k];
    sink.push(px[i], py[i], pz[i], uu[i], vv[i], layer, oc[i], sky, glow);
  }
}

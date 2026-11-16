/**
 * World generation, meshing and raycasting checks.
 * These run headlessly — no GPU or DOM required.
 */
import { World } from '../src/world/world.js';
import { Chunk } from '../src/world/chunk.js';
import { generateChunk } from '../src/world/generator.js';
import { buildChunkMesh, FLOATS_PER_VERTEX } from '../src/world/mesher.js';
import { sampleColumn, BIOME_NAMES } from '../src/world/biomes.js';
import { raycast } from '../src/world/raycast.js';
import { BLOCK, BLOCKS, TILE_NAMES } from '../src/world/blocks.js';
import { CHUNK_SIZE, CHUNK_HEIGHT, SEA_LEVEL } from '../src/config.js';

let failures = 0;
const pass = (label, ok, detail = '') => {
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? '  ' + detail : ''}`);
};

const SEED = 1337;

// --- Determinism ------------------------------------------------------------
{
  const a = new Chunk(3, -7);
  const b = new Chunk(3, -7);
  generateChunk(a, SEED);
  generateChunk(b, SEED);
  pass(
    'same seed produces identical chunks',
    a.blocks.every((v, i) => v === b.blocks[i])
  );

  const c = new Chunk(3, -7);
  generateChunk(c, SEED + 1);
  pass('different seed produces different terrain', !c.blocks.every((v, i) => v === a.blocks[i]));
}

// --- Terrain shape ----------------------------------------------------------
{
  let min = Infinity;
  let max = -Infinity;
  const biomes = new Set();
  for (let z = -2000; z < 2000; z += 53) {
    for (let x = -2000; x < 2000; x += 53) {
      const col = sampleColumn(x, z, SEED);
      min = Math.min(min, col.height);
      max = Math.max(max, col.height);
      biomes.add(col.biome);
    }
  }
  pass('terrain stays inside the world', min >= 0 && max < CHUNK_HEIGHT, `range ${min}..${max}`);
  pass('terrain has real vertical variety', max - min > 40, `spread ${max - min}`);
  pass(
    'all biomes are reachable',
    biomes.size === BIOME_NAMES.length,
    `${biomes.size}/${BIOME_NAMES.length}`
  );
}

// --- Chunk invariants -------------------------------------------------------
{
  const chunk = new Chunk(-30, -26);
  generateChunk(chunk, SEED);

  let bedrockFloor = true;
  let floatingWater = false;
  for (let z = 0; z < CHUNK_SIZE; z++) {
    for (let x = 0; x < CHUNK_SIZE; x++) {
      if (chunk.get(x, 0, z) !== BLOCK.BEDROCK) bedrockFloor = false;
      for (let y = SEA_LEVEL + 1; y < CHUNK_HEIGHT; y++) {
        if (chunk.get(x, y, z) === BLOCK.WATER) floatingWater = true;
      }
    }
  }
  pass('world floor is solid bedrock', bedrockFloor);
  pass('no water above sea level', !floatingWater);

  chunk.rebuildHeightmap();
  let heightmapOk = true;
  for (let z = 0; z < CHUNK_SIZE; z++) {
    for (let x = 0; x < CHUNK_SIZE; x++) {
      const h = chunk.heightmap[z * CHUNK_SIZE + x];
      if (h > 0 && chunk.get(x, h - 1, z) === BLOCK.AIR) heightmapOk = false;
      if (h < CHUNK_HEIGHT && chunk.get(x, h, z) !== BLOCK.AIR) heightmapOk = false;
    }
  }
  pass('heightmap matches block data', heightmapOk);
}

// --- Meshing ----------------------------------------------------------------
{
  const world = new World(SEED);
  world.prepareArea(0, 0, 2);

  const chunk = world.getChunk(0, 0);
  const mesh = buildChunkMesh(chunk, (x, y, z) => world.getBlock(x, y, z));

  pass(
    'mesh produces geometry',
    mesh.opaque.length > 0,
    `${mesh.opaque.length / FLOATS_PER_VERTEX} verts`
  );
  pass(
    'vertex count is a whole number of triangles',
    (mesh.opaque.length / FLOATS_PER_VERTEX) % 3 === 0
  );

  let finite = true;
  let uvInRange = true;
  let inBounds = true;
  for (let i = 0; i < mesh.opaque.length; i += FLOATS_PER_VERTEX) {
    for (let j = 0; j < FLOATS_PER_VERTEX; j++) {
      if (!Number.isFinite(mesh.opaque[i + j])) finite = false;
    }
    const [x, y, z, u, v] = mesh.opaque.subarray(i, i + 5);
    if (u < 0 || u > 1 || v < 0 || v > 1) uvInRange = false;
    // Vertices are chunk-local and may sit on the far boundary.
    if (x < 0 || x > CHUNK_SIZE || z < 0 || z > CHUNK_SIZE || y < 0 || y > CHUNK_HEIGHT) {
      inBounds = false;
    }
  }
  pass('all vertex data is finite', finite);
  pass('UVs stay inside the atlas', uvInRange);
  pass('vertices stay inside chunk bounds', inBounds);

  // Meshing must be a pure function of the block data.
  const again = buildChunkMesh(chunk, (x, y, z) => world.getBlock(x, y, z));
  pass(
    'meshing is deterministic',
    again.opaque.every((v, i) => v === mesh.opaque[i])
  );
}

// --- Interior faces must be culled -----------------------------------------
{
  // A solid 16x16x16 block of stone should only produce its outer shell.
  const chunk = new Chunk(0, 0);
  chunk.blocks.fill(BLOCK.AIR);
  for (let y = 1; y <= 16; y++)
    for (let z = 0; z < CHUNK_SIZE; z++)
      for (let x = 0; x < CHUNK_SIZE; x++) chunk.set(x, y, z, BLOCK.STONE);
  chunk.rebuildHeightmap();

  const solid = buildChunkMesh(chunk, (x, y, z) => {
    if (x < 0 || x >= CHUNK_SIZE || z < 0 || z >= CHUNK_SIZE) return BLOCK.AIR;
    return chunk.get(x, y, z);
  });
  const tris = solid.opaque.length / FLOATS_PER_VERTEX / 3;
  // 6 sides x 16x16 quads x 2 triangles, minus the bottom face at y=0 edge.
  pass('interior faces are culled', tris <= 6 * 16 * 16 * 2, `${tris} tris`);
  pass('outer shell is present', tris >= 5 * 16 * 16 * 2, `${tris} tris`);
}

// --- Raycasting -------------------------------------------------------------
{
  const stub = {
    getBlock: (x, y, z) =>
      Math.floor(x) === 5 && Math.floor(y) === 0 && Math.floor(z) === 0 ? BLOCK.STONE : BLOCK.AIR,
  };
  const hit = raycast(stub, [0.5, 0.5, 0.5], [1, 0, 0], 10);
  pass('ray hits the expected block', hit && hit.x === 5 && hit.y === 0 && hit.z === 0);
  pass('ray reports the entry face', hit && hit.nx === -1 && hit.ny === 0 && hit.nz === 0);
  pass('ray reports distance', hit && Math.abs(hit.distance - 4.5) < 1e-6, `d=${hit?.distance}`);

  pass(
    'ray misses when nothing is in range',
    raycast(stub, [0.5, 0.5, 0.5], [1, 0, 0], 3) === null
  );
  pass('ray misses on a different axis', raycast(stub, [0.5, 0.5, 0.5], [0, 1, 0], 10) === null);

  // Diagonal rays must not tunnel through corners.
  const wall = { getBlock: (x) => (Math.floor(x) === 3 ? BLOCK.STONE : BLOCK.AIR) };
  const diag = raycast(wall, [0.5, 0.5, 0.5], [0.707, 0, 0.707], 20);
  pass('diagonal ray stops at the wall', diag && diag.x === 3, `x=${diag?.x}`);
}

// --- Block registry ---------------------------------------------------------
{
  pass(
    'every block has a name and tiles',
    BLOCKS.filter(Boolean).every((b) => b.name && b.top && b.side && b.bottom)
  );
  pass('atlas fits an 8x8 grid', TILE_NAMES.length <= 64, `${TILE_NAMES.length} tiles`);
  pass('water is non-solid', !BLOCKS[BLOCK.WATER].solid);
  pass('bedrock is unbreakable', !Number.isFinite(BLOCKS[BLOCK.BEDROCK].hardness));
}

// --- World edits ------------------------------------------------------------
{
  const world = new World(SEED);
  world.prepareArea(0, 0, 2);
  const y = world.surfaceHeight(0, 0);

  pass(
    'setBlock writes and reads back',
    world.setBlock(0, y, 0, BLOCK.LAMP) && world.getBlock(0, y, 0) === BLOCK.LAMP
  );
  pass('setBlock is a no-op for an unchanged value', world.setBlock(0, y, 0, BLOCK.LAMP) === false);

  // World (8, *, 8) is local (8,8): well inside chunk (0,0).
  world.chunks.forEach((c) => (c.dirty = false));
  world.setBlock(8, y + 1, 8, BLOCK.STONE);
  pass(
    'interior edit dirties one chunk',
    [...world.chunks.values()].filter((c) => c.dirty).length === 1
  );

  // World (0, *, 0) is local (0,0): the corner shared by four chunks' mesh
  // neighbourhoods, so all four must be re-meshed.
  world.chunks.forEach((c) => (c.dirty = false));
  world.setBlock(0, y + 1, 0, BLOCK.STONE);
  pass(
    'corner edit dirties four chunks',
    [...world.chunks.values()].filter((c) => c.dirty).length === 4
  );

  // An edge (not corner) block is shared by exactly two chunks.
  world.chunks.forEach((c) => (c.dirty = false));
  world.setBlock(0, y + 1, 8, BLOCK.STONE);
  pass(
    'edge edit dirties two chunks',
    [...world.chunks.values()].filter((c) => c.dirty).length === 2
  );

  const spawn = world.findSpawn();
  pass('spawn is above sea level', spawn.y > SEA_LEVEL, `y=${spawn.y}`);
}

console.log(failures === 0 ? '\nworld: all checks passed' : `\nworld: ${failures} FAILED`);
process.exitCode = failures === 0 ? 0 : 1;

/**
 * Block registry.
 *
 * Block ids are stored as bytes in chunk arrays, so ids must stay below 256 and
 * must never be renumbered without invalidating saved worlds.
 */

export const BLOCK = {
  AIR: 0,
  GRASS: 1,
  DIRT: 2,
  STONE: 3,
  COBBLESTONE: 4,
  SAND: 5,
  SANDSTONE: 6,
  LOG: 7,
  LEAVES: 8,
  PLANKS: 9,
  WATER: 10,
  SNOW: 11,
  GLASS: 12,
  LAMP: 13,
  COAL_ORE: 14,
  IRON_ORE: 15,
  GRAVEL: 16,
  CACTUS: 17,
  BEDROCK: 18,
  BRICK: 19,
};

/** Render pass a block belongs to. */
export const PASS = { OPAQUE: 0, WATER: 1 };

/**
 * @typedef {object} BlockDef
 * @property {string} name          Display name shown in the HUD.
 * @property {string} top           Atlas tile for the +Y face.
 * @property {string} bottom        Atlas tile for the -Y face.
 * @property {string} side          Atlas tile for the four side faces.
 * @property {boolean} solid        Participates in player collision.
 * @property {boolean} opaque       Hides the neighbouring face touching it.
 * @property {boolean} blocksLight  Casts shade in the skylight heightmap.
 * @property {boolean} selfCull     Hide shared faces between two of this block.
 * @property {boolean} liquid       Swimmable; drains breath.
 * @property {number} pass          PASS.OPAQUE or PASS.WATER.
 * @property {number} glow          Emissive amount, 0..1.
 * @property {number} hardness      Seconds of mining to break.
 * @property {number|null} drop     Block id yielded when broken (null = self).
 * @property {string} color         CSS colour used for HUD swatches.
 */

/** Defaults applied to every entry so definitions stay terse. */
const DEFAULTS = {
  solid: true,
  opaque: true,
  blocksLight: true,
  selfCull: false,
  liquid: false,
  pass: PASS.OPAQUE,
  glow: 0,
  hardness: 0.5,
  drop: null,
  color: '#888888',
};

function def(name, tiles, overrides = {}) {
  const [top, side = top, bottom = top] = tiles;
  return { ...DEFAULTS, name, top, side, bottom, ...overrides };
}

/** Indexed by block id; index 0 is air. */
export const BLOCKS = [];

BLOCKS[BLOCK.AIR] = def('Air', ['air'], {
  solid: false,
  opaque: false,
  blocksLight: false,
  hardness: 0,
  color: 'transparent',
});
BLOCKS[BLOCK.GRASS] = def('Grass Block', ['grass_top', 'grass_side', 'dirt'], {
  hardness: 0.6,
  drop: BLOCK.DIRT,
  color: '#6aa84f',
});
BLOCKS[BLOCK.DIRT] = def('Dirt', ['dirt'], { hardness: 0.5, color: '#8b6544' });
BLOCKS[BLOCK.STONE] = def('Stone', ['stone'], {
  hardness: 1.5,
  drop: BLOCK.COBBLESTONE,
  color: '#8f8f8f',
});
BLOCKS[BLOCK.COBBLESTONE] = def('Cobblestone', ['cobblestone'], {
  hardness: 1.7,
  color: '#7d7d7d',
});
BLOCKS[BLOCK.SAND] = def('Sand', ['sand'], { hardness: 0.5, color: '#e0d3a0' });
BLOCKS[BLOCK.SANDSTONE] = def('Sandstone', ['sandstone_top', 'sandstone', 'sandstone'], {
  hardness: 1.2,
  color: '#d9c98f',
});
BLOCKS[BLOCK.LOG] = def('Oak Log', ['log_top', 'log_side', 'log_top'], {
  hardness: 1.0,
  color: '#8a6a3d',
});
BLOCKS[BLOCK.LEAVES] = def('Oak Leaves', ['leaves'], {
  opaque: false,
  selfCull: true,
  hardness: 0.3,
  color: '#4f7a34',
});
BLOCKS[BLOCK.PLANKS] = def('Oak Planks', ['planks'], { hardness: 0.9, color: '#b08a52' });
BLOCKS[BLOCK.WATER] = def('Water', ['water'], {
  solid: false,
  opaque: false,
  blocksLight: true,
  selfCull: true,
  liquid: true,
  pass: PASS.WATER,
  hardness: Infinity,
  color: '#3a6fd8',
});
BLOCKS[BLOCK.SNOW] = def('Snow Block', ['snow', 'snow_side', 'dirt'], {
  hardness: 0.4,
  color: '#f0f5fa',
});
BLOCKS[BLOCK.GLASS] = def('Glass', ['glass'], {
  opaque: false,
  blocksLight: false,
  selfCull: true,
  hardness: 0.4,
  color: '#bcdfe8',
});
BLOCKS[BLOCK.LAMP] = def('Lamp', ['lamp'], { glow: 1, hardness: 0.4, color: '#ffd98a' });
BLOCKS[BLOCK.COAL_ORE] = def('Coal Ore', ['coal_ore'], { hardness: 2.0, color: '#4a4a4a' });
BLOCKS[BLOCK.IRON_ORE] = def('Iron Ore', ['iron_ore'], { hardness: 2.4, color: '#c8a184' });
BLOCKS[BLOCK.GRAVEL] = def('Gravel', ['gravel'], { hardness: 0.7, color: '#8a8079' });
BLOCKS[BLOCK.CACTUS] = def('Cactus', ['cactus_top', 'cactus_side', 'cactus_top'], {
  hardness: 0.5,
  color: '#4f8a3a',
});
BLOCKS[BLOCK.BEDROCK] = def('Bedrock', ['bedrock'], {
  hardness: Infinity,
  color: '#3a3a3a',
});
BLOCKS[BLOCK.BRICK] = def('Bricks', ['brick'], { hardness: 1.6, color: '#a4553f' });

/** Every atlas tile referenced above, in a stable order. */
export const TILE_NAMES = (() => {
  const seen = new Set();
  for (const b of BLOCKS) {
    if (!b) continue;
    for (const tile of [b.top, b.side, b.bottom]) {
      if (tile !== 'air') seen.add(tile);
    }
  }
  return [...seen];
})();

export const getBlock = (id) => BLOCKS[id] ?? BLOCKS[BLOCK.AIR];
export const isOpaque = (id) => BLOCKS[id] !== undefined && BLOCKS[id].opaque;
export const isSolid = (id) => BLOCKS[id] !== undefined && BLOCKS[id].solid;
export const isLiquid = (id) => BLOCKS[id] !== undefined && BLOCKS[id].liquid;
export const blocksLight = (id) => BLOCKS[id] !== undefined && BLOCKS[id].blocksLight;

/** Block that ends up in the inventory when `id` is mined. */
export function dropOf(id) {
  const b = getBlock(id);
  return b.drop === null ? id : b.drop;
}

/** Blocks the player may place, in hotbar order. */
export const PLACEABLE = [
  BLOCK.GRASS,
  BLOCK.DIRT,
  BLOCK.COBBLESTONE,
  BLOCK.PLANKS,
  BLOCK.LOG,
  BLOCK.SAND,
  BLOCK.GLASS,
  BLOCK.BRICK,
  BLOCK.LAMP,
];

/** Atlas slot for each tile name. Index order matches TILE_NAMES. */
export const TILE_INDEX = new Map(TILE_NAMES.map((name, i) => [name, i]));

/**
 * Per-block atlas indices as [top, bottom, side], precomputed so the mesher
 * never touches strings in its inner loop.
 */
export const BLOCK_TILES = BLOCKS.map((b) =>
  b
    ? [TILE_INDEX.get(b.top) ?? 0, TILE_INDEX.get(b.bottom) ?? 0, TILE_INDEX.get(b.side) ?? 0]
    : [0, 0, 0]
);

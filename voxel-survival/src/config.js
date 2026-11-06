/**
 * Central tuning knobs. Everything that a player or developer might reasonably
 * want to tweak lives here so the rest of the codebase stays free of magic
 * numbers.
 */

// --- World shape -----------------------------------------------------------
export const CHUNK_SIZE = 16; // blocks along X and Z
export const CHUNK_HEIGHT = 128; // blocks along Y
export const SEA_LEVEL = 40;
export const BEDROCK_DEPTH = 3;

// --- Streaming -------------------------------------------------------------
/** Chunks rendered around the player (radius, in chunks). */
export const RENDER_DISTANCE = 6;
/** Data is generated one ring further out so meshes have correct neighbours. */
export const DATA_DISTANCE = RENDER_DISTANCE + 1;
/** Milliseconds per frame the streamer may spend generating/meshing. */
export const STREAM_BUDGET_MS = 6;

// --- Camera ----------------------------------------------------------------
export const FOV = 70 * (Math.PI / 180);
export const NEAR_PLANE = 0.1;
export const FAR_PLANE = 400;

// --- Player ----------------------------------------------------------------
export const PLAYER_WIDTH = 0.6;
export const PLAYER_HEIGHT = 1.8;
export const PLAYER_EYE = 1.62;
export const WALK_SPEED = 4.6;
export const SPRINT_SPEED = 7.0;
export const SNEAK_SPEED = 1.9;
export const FLY_SPEED = 14.0;
export const JUMP_VELOCITY = 8.4;
export const GRAVITY = 26.0;
export const TERMINAL_VELOCITY = 60.0;
export const SWIM_SPEED = 3.2;
export const REACH = 5.5;

// --- Survival --------------------------------------------------------------
export const MAX_HEALTH = 20; // 10 hearts
export const FALL_SAFE_DISTANCE = 3.5; // blocks of free-fall before damage
export const FALL_DAMAGE_PER_BLOCK = 1;
export const MAX_BREATH = 12; // seconds underwater before drowning
export const DROWN_DAMAGE_INTERVAL = 1.0;
export const REGEN_DELAY = 6.0; // seconds without damage before healing
export const REGEN_INTERVAL = 2.5;

// --- Time ------------------------------------------------------------------
/** Real seconds for one full day/night cycle. */
export const DAY_LENGTH = 480;
/** Fraction of the cycle the world starts at (0 = midnight, 0.5 = noon). */
export const START_TIME = 0.3;

// --- Rendering -------------------------------------------------------------
export const FOG_START_RATIO = 0.62; // fraction of render distance
export const ATLAS_TILE = 16; // pixels per texture tile
export const ATLAS_COLUMNS = 8; // tiles per atlas row

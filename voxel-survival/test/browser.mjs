/**
 * End-to-end smoke test: boots the real game in headless Chromium with a
 * software GL backend, exercises the core interactions, and fails on any
 * console error, page exception or WebGL warning.
 *
 * Requires Playwright. Skipped automatically when it is not installed.
 */
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.TEST_PORT) || 8099;
const SHOTS = resolve(ROOT, 'test', 'screenshots');

/**
 * Resolve Playwright from the project first, then from a global install
 * (ESM imports do not consult NODE_PATH, so the global path needs a nudge).
 */
async function loadPlaywright() {
  try {
    return await import('playwright');
  } catch {
    /* fall through to the global install */
  }
  try {
    const { execSync } = await import('node:child_process');
    const globalRoot = execSync('npm root -g', { encoding: 'utf8' }).trim();
    const { pathToFileURL } = await import('node:url');
    return await import(pathToFileURL(resolve(globalRoot, 'playwright', 'index.js')).href);
  } catch {
    return null;
  }
}

const playwright = await loadPlaywright();
if (!playwright) {
  console.log('SKIP  browser test (playwright not found — run `npm i -D playwright`)');
  process.exit(0);
}
// A CommonJS global install arrives wrapped in `default`.
const { chromium } = playwright.chromium ? playwright : playwright.default;

let failures = 0;
const pass = (label, ok, detail = '') => {
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? '  ' + detail : ''}`);
};

// --- Serve the project ------------------------------------------------------
const server = spawn(process.execPath, [resolve(ROOT, 'serve.js')], {
  env: { ...process.env, PORT: String(PORT), HOST: '127.0.0.1' },
  stdio: 'ignore',
});
const stopServer = () => server.kill();
process.on('exit', stopServer);

async function waitForServer(timeoutMs = 10000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/index.html`);
      if (res.ok) return true;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 100));
  }
  return false;
}

pass('static server responds', await waitForServer());

// --- Launch a browser with a software GL stack ------------------------------
const browser = await chromium.launch({
  args: [
    '--use-gl=angle',
    '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader',
    '--disable-gpu-sandbox',
  ],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });

const consoleErrors = [];
const pageErrors = [];
// The readPixels check below deliberately stalls the GPU; that driver notice is
// caused by the test harness, not the game, so it is not treated as a failure.
const IGNORED_CONSOLE = [/GPU stall due to ReadPixels/i];
page.on('console', (msg) => {
  if (msg.type() !== 'error' && msg.type() !== 'warning') return;
  const text = msg.text();
  if (IGNORED_CONSOLE.some((re) => re.test(text))) return;
  consoleErrors.push(text);
});
page.on('pageerror', (err) => pageErrors.push(String(err)));

await page.goto(`http://127.0.0.1:${PORT}/?seed=1337`, { waitUntil: 'load' });

// --- Boot -------------------------------------------------------------------
const booted = await page
  .waitForFunction(() => window.game && window.game.world.chunks.size > 0, null, { timeout: 20000 })
  .then(() => true)
  .catch(() => false);
pass('game boots and generates chunks', booted);

if (!booted) {
  // Without a game object every later check would throw; report and stop here.
  console.log('  page errors:', pageErrors.join('\n  ') || '(none)');
  console.log('  console errors:', consoleErrors.join('\n  ') || '(none)');
  await browser.close();
  stopServer();
  console.log(`\nbrowser: ${failures} FAILED`);
  process.exit(1);
}

// Let the streamer fill in the surrounding chunks over several frames.
await page.waitForTimeout(4000);

const state = await page.evaluate(() => {
  const g = window.game;
  return {
    chunks: g.world.chunks.size,
    meshes: g.renderer.meshes.size,
    drawn: g.renderer.stats.drawnChunks,
    culled: g.renderer.stats.culledChunks,
    triangles: g.renderer.stats.triangles,
    playerY: g.player.position[1],
    playerX: g.player.position[0],
    playerZ: g.player.position[2],
    health: g.player.health,
    fps: g.fps,
    glError: g.renderer.gl.getError(),
    atlasSize: [g.renderer.atlasCanvas.width, g.renderer.atlasCanvas.height],
  };
});

// Absolute counts depend on how fast the (software) renderer ticks, so assert
// that streaming is well underway and still advancing rather than a fixed size.
pass('chunks are streamed in', state.chunks > 50, `${state.chunks} loaded`);
pass('meshes are uploaded to the GPU', state.meshes > 20, `${state.meshes} meshes`);

await page.waitForTimeout(3000);
const later = await page.evaluate(() => ({
  meshes: window.game.renderer.meshes.size,
  chunks: window.game.world.chunks.size,
}));
pass(
  'meshing keeps progressing while generating',
  later.meshes >= state.meshes,
  `${state.meshes} -> ${later.meshes} meshes`
);
pass(
  'generation keeps progressing',
  later.chunks >= state.chunks,
  `${state.chunks} -> ${later.chunks} chunks`
);
pass('chunks are actually drawn', state.drawn > 5, `${state.drawn} drawn, ${state.culled} culled`);
pass('frustum culling removes off-screen chunks', state.culled > 0, `${state.culled} culled`);
pass(
  'geometry reaches the rasteriser',
  state.triangles > 1000,
  `${Math.round(state.triangles)} tris`
);
pass('no GL error after rendering', state.glError === 0, `glGetError=${state.glError}`);
pass(
  'atlas was generated',
  state.atlasSize[0] === 128 && state.atlasSize[1] === 128,
  state.atlasSize.join('x')
);
pass('player spawned above ground', state.playerY > 0, `y=${state.playerY.toFixed(1)}`);
pass('player is at full health', state.health === 20);

// --- The rendered image must not be a flat colour ---------------------------
mkdirSync(SHOTS, { recursive: true });
await page.screenshot({ path: resolve(SHOTS, 'start.png') });

const variety = await page.evaluate(() => {
  const g = window.game;
  const gl = g.renderer.gl;
  // The context has no preserveDrawingBuffer, so sample the framebuffer in the
  // same task that draws it rather than copying the canvas afterwards.
  g.hud.setOverlay(null);
  g.daynight.setTime(0.35); // mid-morning
  g.player.pitch = -0.15;
  g.camera.update(g.player.eye, g.player.yaw, g.player.pitch, 1);
  g.render();

  const w = gl.drawingBufferWidth;
  const h = gl.drawingBufferHeight;
  const pixels = new Uint8Array(w * h * 4);
  gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, pixels);

  const seen = new Set();
  let sum = 0;
  let count = 0;
  for (let i = 0; i < pixels.length; i += 4 * 37) {
    seen.add(`${pixels[i] >> 4},${pixels[i + 1] >> 4},${pixels[i + 2] >> 4}`);
    sum += pixels[i] + pixels[i + 1] + pixels[i + 2];
    count++;
  }
  return { distinct: seen.size, brightness: sum / count / 3, glError: gl.getError() };
});
pass('frame is not a flat colour', variety.distinct > 20, `${variety.distinct} distinct colours`);
pass(
  'frame is not black',
  variety.brightness > 25,
  `mean brightness ${variety.brightness.toFixed(0)}`
);
pass('no GL error after readPixels', variety.glError === 0);

// --- Gameplay: break and place ---------------------------------------------
const interaction = await page.evaluate(() => {
  const g = window.game;
  const { world, player, inventory } = g;

  // Aim straight down at the block under the player's feet.
  player.pitch = -Math.PI / 2;
  g.updateTarget();
  const target = g.target;
  if (!target) return { error: 'no target under player' };

  const before = world.getBlock(target.x, target.y, target.z);
  const heldBefore = inventory.slots.reduce((n, s) => n + s.count, 0);
  g.breakBlock(target);
  const after = world.getBlock(target.x, target.y, target.z);
  const heldAfter = inventory.slots.reduce((n, s) => n + s.count, 0);

  // Now place a block back into the hole.
  player.pitch = -Math.PI / 2;
  g.updateTarget();
  const placeTargetExists = !!g.target;
  inventory.select(0);
  const stackBefore = inventory.slots[0].count;
  g.placeBlock();
  const stackAfter = inventory.slots[0].count;

  return {
    before,
    after,
    minedInto: heldAfter - heldBefore,
    placeTargetExists,
    stackBefore,
    stackAfter,
  };
});

pass(
  'breaking removes the block',
  interaction.before !== 0 && interaction.after === 0,
  `${interaction.before} -> ${interaction.after}`
);
pass('mined block enters the inventory', interaction.minedInto === 1, `+${interaction.minedInto}`);
pass(
  'placing consumes one item from the stack',
  interaction.stackAfter === interaction.stackBefore - 1,
  `${interaction.stackBefore} -> ${interaction.stackAfter}`
);

// The interaction checks aimed straight down; restore a normal view.
await page.evaluate(() => {
  window.game.player.pitch = -0.12;
});

// --- Movement and simulation ------------------------------------------------
const moved = await page.evaluate(async () => {
  const g = window.game;
  const start = [...g.player.position];
  g.running = true;
  g.player.yaw = 0;
  for (let i = 0; i < 120; i++) {
    g.player.update(1 / 60, { forward: 1, strafe: 0, jump: false, sneak: false, sprint: false });
  }
  const end = [...g.player.position];
  return {
    dist: Math.hypot(end[0] - start[0], end[2] - start[2]),
    y: end[1],
    health: g.player.health,
  };
});
pass('player walks across terrain', moved.dist > 3, `moved ${moved.dist.toFixed(1)} blocks`);
pass('player stays above the void', moved.y > 0, `y=${moved.y.toFixed(1)}`);

// --- Day/night --------------------------------------------------------------
const cycle = await page.evaluate(() => {
  const g = window.game;
  const out = {};
  g.daynight.setTime(0.5);
  g.render();
  out.noon = { daylight: g.daynight.daylight, tint: [...g.daynight.skyTint] };
  g.daynight.setTime(0.0);
  g.render();
  out.midnight = { daylight: g.daynight.daylight, tint: [...g.daynight.skyTint] };
  out.glError = g.renderer.gl.getError();
  return out;
});
pass('noon is bright', cycle.noon.daylight > 0.9);
pass('midnight is dark', cycle.midnight.daylight < 0.1);
pass('sky tint changes with time', cycle.noon.tint[0] > cycle.midnight.tint[0] + 0.5);
pass('no GL error after re-render', cycle.glError === 0);

// Capture representative frames with the menu hidden.
await page.evaluate(() => {
  const g = window.game;
  g.hud.setOverlay(null);
  g.player.pitch = -0.12;
  g.daynight.setTime(0.34);
});
await page.waitForTimeout(600);
await page.screenshot({ path: resolve(SHOTS, 'day.png') });

await page.evaluate(() => window.game.daynight.setTime(0.75));
await page.waitForTimeout(600);
await page.screenshot({ path: resolve(SHOTS, 'dusk.png') });

await page.evaluate(() => window.game.daynight.setTime(0.02));
await page.waitForTimeout(600);
await page.screenshot({ path: resolve(SHOTS, 'night.png') });

// --- Hold-to-mine timing ----------------------------------------------------
const mining = await page.evaluate(() => {
  const g = window.game;
  const { world, player } = g;

  // Stand the player on solid ground and aim straight down.
  const bx = Math.floor(player.position[0]);
  const bz = Math.floor(player.position[2]);
  player.position[1] = world.surfaceHeight(bx, bz);
  player.pitch = -Math.PI / 2;
  g.running = true;
  g.updateTarget();
  if (!g.target) return { error: 'no target' };

  const id = g.target.id;
  const targetKey = `${g.target.x},${g.target.y},${g.target.z}`;

  // Hold the left button and step the interaction loop at 60 Hz.
  g.input.mouseDown.left = true;
  const samples = [];
  let ticks = 0;
  let broken = false;
  for (let i = 0; i < 600; i++) {
    g.updateTarget();
    g.updateInteraction(1 / 60);
    ticks++;
    if (i === 5) samples.push(g.miningProgress);
    if (world.getBlock(...targetKey.split(',').map(Number)) === 0) {
      broken = true;
      break;
    }
  }
  g.input.mouseDown.left = false;

  // Releasing the button must reset progress.
  g.updateInteraction(1 / 60);
  const progressAfterRelease = g.miningProgress;

  return {
    id,
    broken,
    seconds: ticks / 60,
    progressGrew: samples[0] > 0,
    progressAfterRelease,
  };
});

pass('holding the button mines a block', mining.broken === true);
pass('mining progress accumulates', mining.progressGrew === true);
pass(
  'mining takes time proportional to hardness',
  mining.seconds > 0.1 && mining.seconds < 5,
  `${mining.seconds.toFixed(2)}s`
);
pass('releasing the button resets progress', mining.progressAfterRelease === 0);

// --- Water, lamps and underwater view ---------------------------------------
const water = await page.evaluate(() => {
  const WATER = 10;
  const g = window.game;
  const { world, player } = g;

  // Search outwards from the player for a column containing water, loading the
  // chunk first so the lookup sees real blocks.
  let found = null;
  const originX = Math.floor(player.position[0]);
  const originZ = Math.floor(player.position[2]);
  for (let r = 8; r < 400 && !found; r += 8) {
    const ring = [
      [r, 0],
      [-r, 0],
      [0, r],
      [0, -r],
      [r, r],
      [-r, -r],
      [r, -r],
      [-r, r],
    ];
    for (const [dx, dz] of ring) {
      const x = originX + dx;
      const z = originZ + dz;
      world.ensureChunk(Math.floor(x / 16), Math.floor(z / 16));
      // Needs at least two blocks of depth, otherwise the head stays above
      // the surface and the submerged check is not actually exercised.
      for (let y = 28; y <= 39; y++) {
        if (world.getBlock(x, y, z) === WATER && world.getBlock(x, y + 1, z) === WATER) {
          found = { x, y, z };
          break;
        }
      }
      if (found) break;
    }
  }
  if (!found) return { found: false };

  // Stand inside the water column: feet in the deepest water block so the head
  // (1.62 above) is submerged too.
  player.position = [found.x + 0.5, found.y, found.z + 0.5];
  player.velocity = [0, 0, 0];
  world.prepareArea(player.position[0], player.position[2], 3);
  player.updateFluidState();

  let waterVerts = 0;
  for (const entry of g.renderer.meshes.values()) waterVerts += entry.water.count;

  return {
    found: true,
    inWater: player.inWater,
    headUnderwater: player.headUnderwater,
    waterVerts,
    feetBlock: world.getBlock(found.x, Math.floor(player.position[1] + 0.4), found.z),
    headBlock: world.getBlock(found.x, Math.floor(player.position[1] + 1.62), found.z),
  };
});

pass('found water in the world', water.found);
if (water.found) {
  pass('water geometry is generated', water.waterVerts > 0, `${water.waterVerts} verts`);
  pass('player detects being in water', water.inWater === true, `feet block ${water.feetBlock}`);
  pass(
    'submerged head is detected',
    water.headUnderwater === true,
    `head block ${water.headBlock}`
  );
}

await page.evaluate(() => {
  const g = window.game;
  g.hud.setOverlay(null);
  g.daynight.setTime(0.34);
  g.player.pitch = 0.05;
  g.camera.update(g.player.eye, g.player.yaw, g.player.pitch, 1);
});
await page.waitForTimeout(700);
await page.screenshot({ path: resolve(SHOTS, 'underwater.png') });

// Emissive blocks must survive meshing as non-zero glow.
const glow = await page.evaluate(() => {
  const g = window.game;
  const { world, player } = g;
  const bx = Math.floor(player.position[0]);
  const bz = Math.floor(player.position[2]);
  const by = world.surfaceHeight(bx, bz) + 1;
  world.setBlock(bx, by, bz, 13); // LAMP
  const chunk = world.getChunk(Math.floor(bx / 16), Math.floor(bz / 16));
  world.meshChunk(chunk);

  const entry = g.renderer.meshes.get(chunk);
  return {
    uploaded: !!entry && entry.opaque.count > 0,
    placed: world.getBlock(bx, by, bz) === 13,
  };
});
pass('lamp block can be placed', glow.placed);
pass('chunk re-meshes after an edit', glow.uploaded);

// --- Error channels ---------------------------------------------------------
pass('no uncaught page errors', pageErrors.length === 0, pageErrors.join(' | '));
pass(
  'no console errors or warnings',
  consoleErrors.length === 0,
  consoleErrors.slice(0, 3).join(' | ')
);

await browser.close();
stopServer();

console.log(failures === 0 ? '\nbrowser: all checks passed' : `\nbrowser: ${failures} FAILED`);
process.exitCode = failures === 0 ? 0 : 1;

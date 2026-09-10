import { REACH, STREAM_BUDGET_MS, PLAYER_HEIGHT, PLAYER_WIDTH } from '../config.js';
import { World } from '../world/world.js';
import { BLOCK, BLOCKS, getBlock, isSolid, dropOf } from '../world/blocks.js';
import { raycast } from '../world/raycast.js';
import { sampleColumn, BIOME_NAMES } from '../world/biomes.js';
import { Renderer } from '../render/renderer.js';
import { Camera } from '../render/camera.js';
import { Input } from '../core/input.js';
import { Player } from './player.js';
import { Inventory } from './inventory.js';
import { DayNight } from './daynight.js';
import { Hud } from '../ui/hud.js';
import { clamp, lerp } from '../core/math.js';

const MOUSE_SENSITIVITY = 0.0022;
/** Seconds between repeats while the place button is held. */
const PLACE_REPEAT = 0.22;
/** Longest frame the simulation will integrate, to survive a tab switch. */
const MAX_FRAME_DT = 0.1;

const HALF_WIDTH = PLAYER_WIDTH / 2;

/**
 * Wires the subsystems together and owns the frame loop.
 *
 * Rendering runs every frame regardless of pause state so the world is visible
 * behind the menus; only simulation is gated on the game being active.
 */
export class Game {
  constructor(canvas, seed) {
    this.canvas = canvas;
    this.seed = seed;

    this.renderer = new Renderer(canvas);
    this.input = new Input(canvas);
    this.camera = new Camera();
    this.daynight = new DayNight();
    this.inventory = new Inventory();

    this.world = new World(seed, {
      onMesh: (chunk, mesh) => this.renderer.uploadChunkMesh(chunk, mesh),
      onUnload: (chunk) => this.renderer.disposeChunkMesh(chunk),
    });

    const spawn = this.world.findSpawn();
    this.world.prepareArea(spawn.x, spawn.z, 2);
    // Drop onto whatever the generator actually produced at the spawn column.
    spawn.y = this.world.surfaceHeight(Math.floor(spawn.x), Math.floor(spawn.z));
    this.player = new Player(this.world, spawn);

    this.hud = new Hud(this.renderer.atlasCanvas);

    this.running = false;
    this.target = null;
    this.miningProgress = 0;
    this.miningTarget = null;
    this.placeCooldown = 0;
    this.fovScale = 1;
    this.announcedDragLook = false;
    this.fps = 60;
    this.frameMs = 0;
    this.lastTime = 0;

    this.bindControls();
  }

  bindControls() {
    const { input, hud } = this;

    input.onLockChange = (locked) => {
      this.running = locked && !this.player.dead;
      if (!locked && !this.player.dead) hud.setOverlay('paused');
      if (locked) {
        hud.setOverlay(null);
        // Drag-look changes how you aim and mine, so say so the first time.
        if (input.dragLook && !this.announcedDragLook) {
          this.announcedDragLook = true;
          hud.showToast('Drag to look · hold E to mine · Q to place', 5000);
        }
      }
    };

    for (let i = 0; i < 9; i++) {
      input.onKey(`Digit${i + 1}`, () => this.inventory.select(i));
    }

    input.onKey('KeyF', () => {
      if (this.player.inWater) return;
      this.player.flying = !this.player.flying;
      if (this.player.flying) this.player.velocity[1] = 0;
      hud.showToast(this.player.flying ? 'Flight enabled' : 'Flight disabled');
    });

    input.onKey('F3', () => hud.toggleDebug());

    // Escape releases a real pointer lock on its own, but in drag-look mode
    // nothing would otherwise pause the game.
    input.onKey('Escape', () => {
      if (this.running && input.dragLook) {
        this.running = false;
        hud.setOverlay('paused');
      }
    });

    document.getElementById('start-button').addEventListener('click', () => this.play());
    document.getElementById('resume-button').addEventListener('click', () => this.play());
    document.getElementById('respawn-button').addEventListener('click', () => {
      this.player.respawn();
      this.hud.setOverlay(null);
      this.play();
    });

    window.addEventListener('resize', () => this.renderer.resize());
  }

  play() {
    this.input.requestPointerLock();
  }

  start() {
    this.hud.setOverlay('start');
    this.lastTime = performance.now();
    const frame = (now) => {
      this.frame(now);
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }

  frame(now) {
    const start = performance.now();
    const dt = Math.min((now - this.lastTime) / 1000, MAX_FRAME_DT);
    this.lastTime = now;

    this.update(dt);
    this.render();

    this.frameMs = performance.now() - start;
    // Exponential moving average keeps the readout stable but responsive.
    if (dt > 0) this.fps = lerp(this.fps, 1 / dt, 0.08);
  }

  update(dt) {
    this.daynight.update(dt);

    if (this.running) {
      this.updateLook();
      this.player.update(dt, this.readMovement());
      this.updateTarget();
      this.updateInteraction(dt);

      if (this.player.dead) {
        this.running = false;
        this.input.releasePointerLock();
        this.hud.setOverlay('death');
      }
    } else {
      // Keep clicks from queuing up while paused.
      this.input.consumeClicks();
      this.input.consumeMouse();
    }

    // Streaming runs even while paused so the world finishes loading behind
    // the menu instead of popping in the moment play starts.
    this.world.update(this.player.position[0], this.player.position[2], STREAM_BUDGET_MS);

    this.updateCamera(dt);
    this.updateHud();
  }

  updateLook() {
    const { dx, dy } = this.input.consumeMouse();
    if (dx || dy) this.player.look(dx, dy, MOUSE_SENSITIVITY);

    const wheel = this.input.consumeWheel();
    if (wheel) this.inventory.scroll(wheel > 0 ? 1 : -1);
  }

  readMovement() {
    const k = (code) => (this.input.isDown(code) ? 1 : 0);
    return {
      forward: k('KeyW') + k('ArrowUp') - k('KeyS') - k('ArrowDown'),
      strafe: k('KeyD') + k('ArrowRight') - k('KeyA') - k('ArrowLeft'),
      jump: this.input.isDown('Space'),
      sneak: this.input.isDown('ShiftLeft') || this.input.isDown('ShiftRight'),
      sprint: this.input.isDown('ControlLeft') || this.input.isDown('ControlRight'),
    };
  }

  /** Cast from the eye along the view direction to find the aimed-at block. */
  updateTarget() {
    const hit = raycast(
      this.world,
      this.player.eye,
      this.player.forward,
      REACH,
      // Water is see-through and not minable, so rays pass straight through it.
      (id) => id !== BLOCK.AIR && !BLOCKS[id].liquid
    );
    this.target = hit ? { ...hit, id: this.world.getBlock(hit.x, hit.y, hit.z) } : null;
  }

  updateInteraction(dt) {
    const clicks = this.input.consumeClicks();
    this.placeCooldown = Math.max(0, this.placeCooldown - dt);

    this.updateMining(dt);

    const placing = this.input.mouseDown.right || this.input.isDown('KeyQ');
    if (clicks.right || (placing && this.placeCooldown === 0)) {
      this.placeBlock();
      this.placeCooldown = PLACE_REPEAT;
    }
  }

  updateMining(dt) {
    // E mirrors the left button so mining stays reachable in drag-look mode,
    // where holding the mouse is already steering the camera.
    const holding = this.input.mouseDown.left || this.input.isDown('KeyE');
    const key = this.target ? `${this.target.x},${this.target.y},${this.target.z}` : null;

    // Moving the crosshair to a different block restarts the dig.
    if (!holding || key === null || key !== this.miningTarget) {
      this.miningTarget = holding ? key : null;
      this.miningProgress = 0;
      if (!holding || key === null) return;
    }

    const def = getBlock(this.target.id);
    if (!Number.isFinite(def.hardness)) {
      this.miningProgress = 0;
      return; // bedrock and water are indestructible
    }

    this.miningProgress += dt / Math.max(def.hardness, 0.05);
    if (this.miningProgress >= 1) {
      this.breakBlock(this.target);
      this.miningProgress = 0;
      this.miningTarget = null;
    }
  }

  breakBlock(target) {
    const id = this.world.getBlock(target.x, target.y, target.z);
    if (id === BLOCK.AIR) return;
    if (!this.world.setBlock(target.x, target.y, target.z, BLOCK.AIR)) return;

    const drop = dropOf(id);
    const stored = this.inventory.give(drop, 1);
    if (stored === 0) this.hud.showToast('Inventory full');
  }

  placeBlock() {
    if (!this.target) return;
    const id = this.inventory.heldBlock;
    if (id === BLOCK.AIR) {
      this.hud.showToast('Nothing to place');
      return;
    }

    const x = this.target.x + this.target.nx;
    const y = this.target.y + this.target.ny;
    const z = this.target.z + this.target.nz;

    const existing = this.world.getBlock(x, y, z);
    if (existing !== BLOCK.AIR && !BLOCKS[existing].liquid) return;
    if (isSolid(id) && this.intersectsPlayer(x, y, z)) return;

    if (this.world.setBlock(x, y, z, id)) this.inventory.takeSelected();
  }

  /** True if a block at these coordinates would overlap the player's box. */
  intersectsPlayer(x, y, z) {
    const [px, py, pz] = this.player.position;
    return (
      x + 1 > px - HALF_WIDTH &&
      x < px + HALF_WIDTH &&
      y + 1 > py &&
      y < py + PLAYER_HEIGHT &&
      z + 1 > pz - HALF_WIDTH &&
      z < pz + HALF_WIDTH
    );
  }

  updateCamera(dt) {
    // A gentle FOV push while sprinting sells the speed change.
    const wanted = this.player.sprinting ? 1.075 : 1;
    this.fovScale = lerp(this.fovScale, wanted, clamp(dt * 8, 0, 1));
    this.camera.resize(this.canvas.width, this.canvas.height);
    this.camera.update(this.player.eye, this.player.yaw, this.player.pitch, this.fovScale);
  }

  updateHud() {
    const p = this.player.position;
    const { biome } = sampleColumn(Math.floor(p[0]), Math.floor(p[2]), this.seed);
    this.hud.update({
      player: this.player,
      inventory: this.inventory,
      daynight: this.daynight,
      target: this.target,
      miningProgress: this.miningProgress,
      biome: BIOME_NAMES[biome],
      fps: this.fps,
      frameMs: this.frameMs,
      drawnChunks: this.renderer.stats.drawnChunks,
      culledChunks: this.renderer.stats.culledChunks,
      loadedChunks: this.world.chunks.size,
      triangles: this.renderer.stats.triangles,
    });
  }

  render() {
    this.renderer.render(
      { camera: this.camera, underwater: this.player.headUnderwater },
      this.daynight,
      this.target
    );
  }
}

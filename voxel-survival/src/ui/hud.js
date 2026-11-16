import { MAX_HEALTH, MAX_BREATH, ATLAS_TILE } from '../config.js';
import { BLOCK, BLOCK_TILES, getBlock } from '../world/blocks.js';
import { HOTBAR_SLOTS } from '../game/inventory.js';
import { tileRect } from '../core/atlas.js';

const HEART_COUNT = MAX_HEALTH / 2;
const BUBBLE_COUNT = 10;
/** Circumference of the mining ring (r = 15), matching the SVG markup. */
const RING_LENGTH = 2 * Math.PI * 15;

const $ = (id) => document.getElementById(id);

/**
 * DOM-based heads-up display.
 *
 * The HUD is plain HTML/CSS rather than drawn into the canvas: it keeps text
 * crisp at any DPI, costs nothing per frame when values do not change, and
 * stays readable as markup. Every update is diffed against the previous value
 * so a steady frame touches the DOM only when something actually changed.
 */
export class Hud {
  constructor(atlasCanvas) {
    this.atlasCanvas = atlasCanvas;
    this.el = {
      hearts: $('hearts'),
      breath: $('breath'),
      hotbar: $('hotbar'),
      heldName: $('held-name'),
      debug: $('debug'),
      clockText: $('clock-text'),
      clockDot: document.querySelector('#clock .dot'),
      ringFill: document.querySelector('#mining-ring .fill'),
      hurt: $('hurt'),
      underwater: $('underwater'),
      toast: $('toast'),
      start: $('start'),
      paused: $('paused'),
      death: $('death'),
      error: $('error'),
      errorMessage: $('error-message'),
      deathCause: $('death-cause'),
    };

    this.prev = {
      health: -1,
      // null, not -1: -1 is a real "hidden" level, and starting equal to it
      // would make the first update skip hiding the bubbles.
      breath: null,
      selected: -1,
      clock: '',
      night: null,
      heldName: '',
      debug: '',
      progress: -1,
      hurt: -1,
      underwater: null,
    };
    this.slotIcons = [];
    this.slotState = [];
    this.toastTimer = null;
    this.nameTimer = null;

    this.buildHearts();
    this.buildBubbles();
    this.buildHotbar();
  }

  buildHearts() {
    this.el.hearts.innerHTML = '';
    this.hearts = [];
    for (let i = 0; i < HEART_COUNT; i++) {
      const heart = document.createElement('div');
      heart.className = 'heart';
      const fill = document.createElement('i');
      heart.appendChild(fill);
      this.el.hearts.appendChild(heart);
      this.hearts.push(fill);
    }
  }

  buildBubbles() {
    this.el.breath.innerHTML = '';
    this.bubbles = [];
    for (let i = 0; i < BUBBLE_COUNT; i++) {
      const bubble = document.createElement('div');
      bubble.className = 'bubble';
      this.el.breath.appendChild(bubble);
      this.bubbles.push(bubble);
    }
  }

  buildHotbar() {
    this.el.hotbar.innerHTML = '';
    for (let i = 0; i < HOTBAR_SLOTS; i++) {
      const slot = document.createElement('div');
      slot.className = 'slot';

      const key = document.createElement('span');
      key.className = 'key';
      key.textContent = String(i + 1);

      const icon = document.createElement('canvas');
      icon.width = ATLAS_TILE;
      icon.height = ATLAS_TILE;

      const count = document.createElement('span');
      count.className = 'count';

      slot.append(key, icon, count);
      this.el.hotbar.appendChild(slot);
      this.slotIcons.push({ slot, icon, count, ctx: icon.getContext('2d') });
      this.slotState.push({ id: -1, count: -1 });
    }
  }

  /** Blit one atlas tile into a slot icon. */
  drawSlotIcon(index, blockId) {
    const { ctx } = this.slotIcons[index];
    ctx.clearRect(0, 0, ATLAS_TILE, ATLAS_TILE);
    if (blockId === BLOCK.AIR) return;
    // Tile index 2 is the side face, which reads best as a small icon.
    const rect = tileRect(BLOCK_TILES[blockId][2]);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(this.atlasCanvas, rect.x, rect.y, rect.w, rect.h, 0, 0, ATLAS_TILE, ATLAS_TILE);
  }

  /**
   * Push current game state into the DOM.
   * @param {object} s see Game#updateHud for the shape
   */
  update(s) {
    this.updateHealth(s.player);
    this.updateBreath(s.player);
    this.updateHotbar(s.inventory);
    this.updateClock(s.daynight);
    this.updateMining(s.miningProgress);
    this.updateEffects(s.player);
    this.updateDebug(s);
  }

  updateHealth(player) {
    if (player.health === this.prev.health) {
      if (player.hurtFlash > 0) this.el.hearts.classList.add('hurt');
      else this.el.hearts.classList.remove('hurt');
      return;
    }
    this.prev.health = player.health;
    for (let i = 0; i < HEART_COUNT; i++) {
      const filled = Math.max(0, Math.min(2, player.health - i * 2)) / 2;
      this.hearts[i].style.width = `${filled * 100}%`;
    }
  }

  updateBreath(player) {
    const shown = player.headUnderwater || player.breath < MAX_BREATH;
    const level = shown ? Math.ceil((player.breath / MAX_BREATH) * BUBBLE_COUNT) : -1;
    if (level === this.prev.breath) return;
    this.prev.breath = level;
    this.el.breath.style.visibility = shown ? 'visible' : 'hidden';
    for (let i = 0; i < BUBBLE_COUNT; i++) {
      this.bubbles[i].classList.toggle('empty', i >= level);
    }
  }

  updateHotbar(inventory) {
    for (let i = 0; i < HOTBAR_SLOTS; i++) {
      const slot = inventory.slots[i];
      const view = this.slotIcons[i];
      const state = this.slotState[i];

      if (state.id !== slot.id) {
        state.id = slot.id;
        this.drawSlotIcon(i, slot.id);
      }
      if (state.count !== slot.count) {
        state.count = slot.count;
        view.count.textContent = slot.count > 1 ? String(slot.count) : '';
        view.slot.classList.toggle('empty', slot.count === 0);
      }
      view.slot.classList.toggle('selected', i === inventory.selected);
    }

    const name = inventory.heldName();
    if (name !== this.prev.heldName) {
      this.prev.heldName = name;
      this.el.heldName.textContent = name;
      this.el.heldName.classList.add('visible');
      clearTimeout(this.nameTimer);
      this.nameTimer = setTimeout(() => this.el.heldName.classList.remove('visible'), 1600);
    }
  }

  updateClock(daynight) {
    if (daynight.clock !== this.prev.clock) {
      this.prev.clock = daynight.clock;
      this.el.clockText.textContent = `${daynight.clock}  ${daynight.phase}`;
    }
    const night = daynight.daylight < 0.4;
    if (night !== this.prev.night) {
      this.prev.night = night;
      this.el.clockDot.classList.toggle('night', night);
    }
  }

  updateMining(progress) {
    const p = Math.max(0, Math.min(1, progress || 0));
    if (Math.abs(p - this.prev.progress) < 0.01) return;
    this.prev.progress = p;
    this.el.ringFill.style.strokeDashoffset = String(RING_LENGTH * (1 - p));
  }

  updateEffects(player) {
    const hurt = Math.min(1, player.hurtFlash / 0.4);
    if (Math.abs(hurt - this.prev.hurt) > 0.02) {
      this.prev.hurt = hurt;
      this.el.hurt.style.opacity = String(hurt);
    }
    if (player.headUnderwater !== this.prev.underwater) {
      this.prev.underwater = player.headUnderwater;
      this.el.underwater.style.opacity = player.headUnderwater ? '1' : '0';
    }
  }

  updateDebug(s) {
    if (this.el.debug.classList.contains('hidden')) return;
    const p = s.player.position;
    const target = s.target
      ? `${getBlock(s.target.id).name} @ ${s.target.x} ${s.target.y} ${s.target.z}`
      : '—';
    const text = [
      `<b>${s.fps.toFixed(0)} fps</b>   ${s.frameMs.toFixed(1)} ms`,
      `xyz     ${p[0].toFixed(1)} ${p[1].toFixed(1)} ${p[2].toFixed(1)}`,
      `chunk   ${Math.floor(p[0] / 16)} ${Math.floor(p[2] / 16)}`,
      `biome   ${s.biome}`,
      `looking ${target}`,
      `chunks  ${s.drawnChunks} drawn / ${s.culledChunks} culled / ${s.loadedChunks} loaded`,
      `tris    ${(s.triangles / 1000).toFixed(1)}k`,
      `time    ${s.daynight.clock} (${s.daynight.phase})`,
      `mode    ${s.player.flying ? 'flying' : s.player.inWater ? 'swimming' : 'walking'}`,
    ].join('\n');
    if (text !== this.prev.debug) {
      this.prev.debug = text;
      this.el.debug.innerHTML = text;
    }
  }

  toggleDebug() {
    this.el.debug.classList.toggle('hidden');
    this.prev.debug = '';
  }

  showToast(message, duration = 1600) {
    this.el.toast.textContent = message;
    this.el.toast.classList.add('visible');
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => this.el.toast.classList.remove('visible'), duration);
  }

  /** @param {'start'|'paused'|'death'|'error'|null} which */
  setOverlay(which) {
    for (const name of ['start', 'paused', 'death', 'error']) {
      this.el[name].classList.toggle('hidden', name !== which);
    }
  }

  showError(message) {
    this.el.errorMessage.textContent = message;
    this.setOverlay('error');
  }
}

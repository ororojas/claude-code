import { BLOCK, PLACEABLE, getBlock } from '../world/blocks.js';

export const HOTBAR_SLOTS = 9;
export const MAX_STACK = 64;

/**
 * A single-row hotbar. Mining fills it, placing drains it — that loop is the
 * survival mechanic, so placement is refused when a stack runs out.
 */
export class Inventory {
  constructor() {
    /** @type {{id:number, count:number}[]} */
    this.slots = Array.from({ length: HOTBAR_SLOTS }, () => ({ id: BLOCK.AIR, count: 0 }));
    this.selected = 0;

    // A small starting kit: enough to start building immediately, not so much
    // that gathering material becomes pointless.
    const kit = [
      [BLOCK.COBBLESTONE, 24],
      [BLOCK.PLANKS, 24],
      [BLOCK.GLASS, 12],
      [BLOCK.LAMP, 6],
    ];
    for (const [id, count] of kit) this.give(id, count);
  }

  get selectedSlot() {
    return this.slots[this.selected];
  }

  /** Block id currently held, or AIR when the slot is empty. */
  get heldBlock() {
    const slot = this.selectedSlot;
    return slot.count > 0 ? slot.id : BLOCK.AIR;
  }

  select(index) {
    if (index >= 0 && index < HOTBAR_SLOTS) this.selected = index;
  }

  /** Cycle the selection; `delta` is in slots, wrapping at both ends. */
  scroll(delta) {
    this.selected = (this.selected + delta + HOTBAR_SLOTS * 8) % HOTBAR_SLOTS;
  }

  /**
   * Add blocks, topping up an existing stack before claiming an empty slot.
   * @returns {number} how many were actually stored
   */
  give(id, count = 1) {
    if (id === BLOCK.AIR || count <= 0) return 0;
    let remaining = count;

    for (const slot of this.slots) {
      if (remaining === 0) break;
      if (slot.id === id && slot.count > 0 && slot.count < MAX_STACK) {
        const room = MAX_STACK - slot.count;
        const moved = Math.min(room, remaining);
        slot.count += moved;
        remaining -= moved;
      }
    }

    for (const slot of this.slots) {
      if (remaining === 0) break;
      if (slot.count === 0) {
        slot.id = id;
        const moved = Math.min(MAX_STACK, remaining);
        slot.count = moved;
        remaining -= moved;
      }
    }

    return count - remaining;
  }

  /** Remove one block from the selected slot. @returns {boolean} success */
  takeSelected() {
    const slot = this.selectedSlot;
    if (slot.count <= 0) return false;
    slot.count--;
    if (slot.count === 0) slot.id = BLOCK.AIR;
    return true;
  }

  /** Human-readable name of the held block, for the HUD. */
  heldName() {
    const id = this.heldBlock;
    return id === BLOCK.AIR ? 'Empty' : getBlock(id).name;
  }

  /** Fill every empty slot with the standard placeable set (creative mode). */
  fillCreative() {
    PLACEABLE.forEach((id, i) => {
      if (i < HOTBAR_SLOTS) this.slots[i] = { id, count: MAX_STACK };
    });
  }
}

import {
  PLAYER_WIDTH,
  PLAYER_HEIGHT,
  PLAYER_EYE,
  WALK_SPEED,
  SPRINT_SPEED,
  SNEAK_SPEED,
  SWIM_SPEED,
  FLY_SPEED,
  JUMP_VELOCITY,
  GRAVITY,
  TERMINAL_VELOCITY,
  MAX_HEALTH,
  FALL_SAFE_DISTANCE,
  FALL_DAMAGE_PER_BLOCK,
  MAX_BREATH,
  DROWN_DAMAGE_INTERVAL,
  REGEN_DELAY,
  REGEN_INTERVAL,
  CHUNK_HEIGHT,
} from '../config.js';
import { isSolid, isLiquid } from '../world/blocks.js';
import { clamp, forwardFromAngles } from '../core/math.js';

const HALF_WIDTH = PLAYER_WIDTH / 2;
/** Nudge used when snapping out of a block, to avoid re-colliding next frame. */
const SKIN = 1e-3;
const MAX_PITCH = Math.PI / 2 - 0.001;

/**
 * The player: a capsule-free axis-aligned box with per-axis collision response,
 * plus the survival state (health, breath, fall damage).
 *
 * `position` is the centre of the box's base — i.e. the point the player is
 * standing on — which makes ground checks and block placement read naturally.
 */
export class Player {
  constructor(world, spawn) {
    this.world = world;
    this.spawn = { ...spawn };
    this.position = [spawn.x, spawn.y, spawn.z];
    this.velocity = [0, 0, 0];
    this.yaw = 0;
    this.pitch = 0;

    this.onGround = false;
    this.inWater = false;
    this.headUnderwater = false;
    this.flying = false;
    this.sprinting = false;

    this.health = MAX_HEALTH;
    this.breath = MAX_BREATH;
    this.timeSinceDamage = Infinity;
    this.regenTimer = 0;
    this.drownTimer = 0;
    this.fallPeak = spawn.y;
    this.dead = false;
    /** Set for one frame when the player takes damage, for the HUD flash. */
    this.hurtFlash = 0;
  }

  /** Camera position: eye height above the feet. */
  get eye() {
    return [this.position[0], this.position[1] + PLAYER_EYE, this.position[2]];
  }

  get forward() {
    return forwardFromAngles(this.yaw, this.pitch);
  }

  bounds() {
    const [x, y, z] = this.position;
    return {
      minX: x - HALF_WIDTH,
      maxX: x + HALF_WIDTH,
      minY: y,
      maxY: y + PLAYER_HEIGHT,
      minZ: z - HALF_WIDTH,
      maxZ: z + HALF_WIDTH,
    };
  }

  look(dx, dy, sensitivity) {
    this.yaw -= dx * sensitivity;
    this.pitch = clamp(this.pitch - dy * sensitivity, -MAX_PITCH, MAX_PITCH);
    // Keep yaw bounded so it never loses float precision in a long session.
    this.yaw = ((((this.yaw + Math.PI) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)) - Math.PI;
  }

  /**
   * @param {number} dt seconds
   * @param {{forward:number, strafe:number, jump:boolean, sneak:boolean, sprint:boolean}} move
   */
  update(dt, move) {
    this.updateFluidState();

    const speed = this.flying
      ? FLY_SPEED
      : this.inWater
        ? SWIM_SPEED
        : move.sneak
          ? SNEAK_SPEED
          : move.sprint && move.forward > 0
            ? SPRINT_SPEED
            : WALK_SPEED;

    this.sprinting = !this.flying && move.sprint && move.forward > 0 && !move.sneak;

    // Movement is horizontal-only: looking up must not slow you down.
    const sin = Math.sin(this.yaw);
    const cos = Math.cos(this.yaw);
    let wishX = -sin * move.forward + cos * move.strafe;
    let wishZ = -cos * move.forward - sin * move.strafe;
    const wishLen = Math.hypot(wishX, wishZ);
    if (wishLen > 1) {
      wishX /= wishLen;
      wishZ /= wishLen;
    }

    if (this.flying) {
      this.velocity[0] = wishX * speed;
      this.velocity[2] = wishZ * speed;
      this.velocity[1] = (move.jump ? 1 : 0) * FLY_SPEED - (move.sneak ? 1 : 0) * FLY_SPEED;
    } else {
      // Snappy ground control, floatier in the air and in water.
      const control = this.onGround ? 1 : this.inWater ? 0.5 : 0.22;
      this.velocity[0] += (wishX * speed - this.velocity[0]) * Math.min(1, control * dt * 14);
      this.velocity[2] += (wishZ * speed - this.velocity[2]) * Math.min(1, control * dt * 14);

      if (this.inWater) {
        // Mild buoyancy plus drag; holding jump swims upward.
        this.velocity[1] += (GRAVITY * 0.25 - GRAVITY) * dt;
        this.velocity[1] *= 0.86;
        if (move.jump) this.velocity[1] = SWIM_SPEED;
      } else {
        this.velocity[1] -= GRAVITY * dt;
        if (move.jump && this.onGround) {
          this.velocity[1] = JUMP_VELOCITY;
          this.onGround = false;
        }
      }
      this.velocity[1] = Math.max(this.velocity[1], -TERMINAL_VELOCITY);
    }

    const wasOnGround = this.onGround;
    this.onGround = false;
    this.moveAxis(0, this.velocity[0] * dt);
    this.moveAxis(2, this.velocity[2] * dt);
    this.moveAxis(1, this.velocity[1] * dt);

    this.updateFallDamage(wasOnGround);
    this.updateSurvival(dt);
  }

  /**
   * Advance one axis and resolve any resulting overlap.
   *
   * Axes are resolved separately (X, then Z, then Y) so that sliding along a
   * wall works: a blocked X move does not cancel the Z component.
   */
  moveAxis(axis, amount) {
    if (amount === 0) return;
    this.position[axis] += amount;

    const b = this.bounds();
    const lo = (v) => Math.floor(v + 1e-6);
    const hi = (v) => Math.ceil(v - 1e-6) - 1;

    let resolved = null;
    for (let bx = lo(b.minX); bx <= hi(b.maxX); bx++) {
      for (let by = lo(b.minY); by <= hi(b.maxY); by++) {
        for (let bz = lo(b.minZ); bz <= hi(b.maxZ); bz++) {
          if (!isSolid(this.world.getBlock(bx, by, bz))) continue;
          // Take the most restrictive snap across every overlapping block.
          if (axis === 0) {
            const p = amount > 0 ? bx - HALF_WIDTH - SKIN : bx + 1 + HALF_WIDTH + SKIN;
            resolved =
              resolved === null ? p : amount > 0 ? Math.min(resolved, p) : Math.max(resolved, p);
          } else if (axis === 1) {
            const p = amount > 0 ? by - PLAYER_HEIGHT - SKIN : by + 1 + SKIN;
            resolved =
              resolved === null ? p : amount > 0 ? Math.min(resolved, p) : Math.max(resolved, p);
          } else {
            const p = amount > 0 ? bz - HALF_WIDTH - SKIN : bz + 1 + HALF_WIDTH + SKIN;
            resolved =
              resolved === null ? p : amount > 0 ? Math.min(resolved, p) : Math.max(resolved, p);
          }
        }
      }
    }

    if (resolved === null) return;
    this.position[axis] = resolved;
    if (axis === 1 && amount < 0) this.onGround = true;
    this.velocity[axis] = 0;
  }

  /** Refresh water flags from the blocks the body and head occupy. */
  updateFluidState() {
    const [x, y, z] = this.position;
    const bx = Math.floor(x);
    const bz = Math.floor(z);
    this.inWater = isLiquid(this.world.getBlock(bx, Math.floor(y + 0.4), bz));
    this.headUnderwater = isLiquid(this.world.getBlock(bx, Math.floor(y + PLAYER_EYE), bz));
    if (this.inWater) this.flying = false;
  }

  /**
   * Fall damage is measured from the highest point of the fall, not from where
   * the player left the ground, so being knocked upward mid-fall still counts.
   */
  updateFallDamage(wasOnGround) {
    if (this.flying || this.inWater) {
      this.fallPeak = this.position[1];
      return;
    }
    if (this.position[1] > this.fallPeak) this.fallPeak = this.position[1];

    if (this.onGround && !wasOnGround) {
      const distance = this.fallPeak - this.position[1];
      if (distance > FALL_SAFE_DISTANCE) {
        this.damage(Math.floor((distance - FALL_SAFE_DISTANCE) * FALL_DAMAGE_PER_BLOCK));
      }
      this.fallPeak = this.position[1];
    }
    if (this.onGround) this.fallPeak = this.position[1];
  }

  updateSurvival(dt) {
    this.hurtFlash = Math.max(0, this.hurtFlash - dt);
    this.timeSinceDamage += dt;

    if (this.headUnderwater) {
      this.breath -= dt;
      if (this.breath <= 0) {
        this.breath = 0;
        this.drownTimer += dt;
        if (this.drownTimer >= DROWN_DAMAGE_INTERVAL) {
          this.drownTimer = 0;
          this.damage(1);
        }
      }
    } else {
      this.breath = Math.min(MAX_BREATH, this.breath + dt * 4);
      this.drownTimer = 0;
    }

    // Void safety net: falling out of the world should not soft-lock the game.
    if (this.position[1] < -8) this.damage(MAX_HEALTH);

    if (!this.dead && this.health < MAX_HEALTH && this.timeSinceDamage > REGEN_DELAY) {
      this.regenTimer += dt;
      if (this.regenTimer >= REGEN_INTERVAL) {
        this.regenTimer = 0;
        this.health = Math.min(MAX_HEALTH, this.health + 1);
      }
    }
  }

  damage(amount) {
    if (this.dead || amount <= 0) return;
    this.health = Math.max(0, this.health - amount);
    this.timeSinceDamage = 0;
    this.regenTimer = 0;
    this.hurtFlash = 0.4;
    if (this.health === 0) this.dead = true;
  }

  respawn() {
    const surface = this.world.surfaceHeight(Math.floor(this.spawn.x), Math.floor(this.spawn.z));
    this.position = [this.spawn.x, Math.min(surface, CHUNK_HEIGHT - 3), this.spawn.z];
    this.velocity = [0, 0, 0];
    this.health = MAX_HEALTH;
    this.breath = MAX_BREATH;
    this.timeSinceDamage = Infinity;
    this.fallPeak = this.position[1];
    this.dead = false;
    this.flying = false;
  }
}

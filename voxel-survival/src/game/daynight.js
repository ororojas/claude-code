import { DAY_LENGTH, START_TIME } from '../config.js';
import { clamp, lerp, smoothstep } from '../core/math.js';

const TAU = Math.PI * 2;

/** Palette keyframes; every colour below is linear RGB in 0..1. */
const SKY_TOP_NIGHT = [0.02, 0.03, 0.1];
const SKY_TOP_DAY = [0.29, 0.52, 0.86];
const SKY_HORIZON_NIGHT = [0.06, 0.07, 0.17];
const SKY_HORIZON_DAY = [0.69, 0.83, 0.96];
const SKY_HORIZON_DUSK = [0.96, 0.52, 0.26];

const LIGHT_NIGHT = [0.16, 0.2, 0.34];
const LIGHT_DAY = [1.0, 0.97, 0.9];
const LIGHT_DUSK = [1.0, 0.7, 0.44];

const SUN_TINT_DAY = [1.0, 0.96, 0.88];
const SUN_TINT_DUSK = [1.0, 0.62, 0.32];

const mix3 = (a, b, t, out) => {
  out[0] = lerp(a[0], b[0], t);
  out[1] = lerp(a[1], b[1], t);
  out[2] = lerp(a[2], b[2], t);
  return out;
};

/**
 * Day/night cycle.
 *
 * `time` runs 0..1 where 0 is midnight and 0.5 is noon. Everything else —
 * sun direction, sky gradient, the tint fed to the world shader, star
 * visibility — is derived from it, so there is a single source of truth.
 */
export class DayNight {
  constructor(startTime = START_TIME) {
    this.time = startTime % 1;
    this.paused = false;

    // Reused output buffers: these are read every frame by the renderer.
    this.sunDir = new Float32Array(3);
    this.skyTop = new Float32Array(3);
    this.skyHorizon = new Float32Array(3);
    this.skyTint = new Float32Array(3);
    this.sunTint = new Float32Array(3);
    this.fogColor = new Float32Array(3);

    this.daylight = 0;
    this.starAmount = 0;
    this.recompute();
  }

  update(dt) {
    if (this.paused) return;
    this.time = (this.time + dt / DAY_LENGTH) % 1;
    this.recompute();
  }

  /** Jump to a specific point in the cycle (0..1). */
  setTime(t) {
    this.time = ((t % 1) + 1) % 1;
    this.recompute();
  }

  recompute() {
    // Sunrise at t=0.25, noon at t=0.5. The Z component tilts the arc so the
    // sun does not travel through the exact zenith.
    const angle = (this.time - 0.25) * TAU;
    const sx = Math.cos(angle);
    const sy = Math.sin(angle);
    const sz = 0.35;
    const len = Math.hypot(sx, sy, sz);
    this.sunDir[0] = sx / len;
    this.sunDir[1] = sy / len;
    this.sunDir[2] = sz / len;

    const elevation = this.sunDir[1];
    // A wide band keeps sunrise and sunset lingering rather than snapping.
    this.daylight = smoothstep(-0.18, 0.42, elevation);
    this.starAmount = clamp(1 - this.daylight * 1.4, 0, 1);

    // "Golden hour" weight: peaks while the sun sits near the horizon.
    const dusk = clamp(1 - Math.abs(elevation) / 0.38, 0, 1) * smoothstep(-0.25, 0.05, elevation);

    mix3(SKY_TOP_NIGHT, SKY_TOP_DAY, this.daylight, this.skyTop);
    mix3(SKY_HORIZON_NIGHT, SKY_HORIZON_DAY, this.daylight, this.skyHorizon);
    mix3(this.skyHorizon, SKY_HORIZON_DUSK, dusk * 0.8, this.skyHorizon);

    mix3(LIGHT_NIGHT, LIGHT_DAY, this.daylight, this.skyTint);
    mix3(this.skyTint, LIGHT_DUSK, dusk * 0.55, this.skyTint);

    mix3(SUN_TINT_DUSK, SUN_TINT_DAY, smoothstep(0.0, 0.35, elevation), this.sunTint);

    // Fog matches the horizon so distant terrain dissolves into the sky.
    this.fogColor.set(this.skyHorizon);
  }

  /** 24-hour clock string for the HUD. */
  get clock() {
    const totalMinutes = Math.floor(this.time * 24 * 60);
    const h = String(Math.floor(totalMinutes / 60)).padStart(2, '0');
    const m = String(totalMinutes % 60).padStart(2, '0');
    return `${h}:${m}`;
  }

  /** Coarse label used by the HUD. */
  get phase() {
    if (this.daylight > 0.85) return 'Day';
    if (this.daylight > 0.15) return this.time < 0.5 ? 'Dawn' : 'Dusk';
    return 'Night';
  }
}

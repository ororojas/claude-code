// European single-zero wheel, clockwise from zero.
export const WHEEL_ORDER = [
  0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10,
  5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26,
];
export const RED = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);
export const colorOf = (n) => (n === 0 ? 'green' : RED.has(n) ? 'red' : 'black');

export const POCKETS = 37;
export const ALPHA = (Math.PI * 2) / POCKETS;
const TAU = Math.PI * 2;

// Units: the ball track wall has radius 1.
export const GEO = {
  rimR: 1.0,
  ballR: 0.026,
  rotorR: 0.74,
  pocketOutR: 0.62,
  pocketInR: 0.47,
  deflR: 0.86,
  deflSize: 0.017,
  deflCount: 8,
  fretHalf: 0.005,
};

export function surfaceHeight(r) {
  if (r >= GEO.rotorR) return 0.06 + Math.min(r - GEO.rotorR, 0.21) * 0.34;
  if (r >= GEO.pocketOutR) return 0.02 + (r - GEO.pocketOutR) * 0.33;
  if (r >= GEO.pocketInR) return 0;
  return 0.04 + (GEO.pocketInR - r) * 0.35;
}

export const deflectorAngle = (j) => ((j + 0.5) * TAU) / GEO.deflCount;

// Rotor-local angle of pocket i's centre. Pockets run clockwise.
export const pocketCenterAngle = (i) => -(i + 0.5) * ALPHA;

export function pocketAt(localAngle) {
  const psi = (((-localAngle) % TAU) + TAU) % TAU;
  return Math.min(POCKETS - 1, Math.floor(psi / ALPHA));
}

const P = {
  gBowl: 4.2,
  gRing: 4.6,
  gPocket: 0.9,
  rollC: 0.3,
  wallMu: 0.016,
  ringDamp: 0.7,
  pocketDamp: 2.6,
  fretE: 0.42,
  fretFric: 0.8,
  deflE: 0.55,
  innerE: 0.35,
  idleWheel: 0.35,
};

const H = 1 / 240;

export class RouletteSim {
  constructor(rng = Math.random) {
    this.rng = rng;
    this.wheelAngle = 0;
    this.wheelVel = P.idleWheel;
    this.ball = null;
    this.state = 'idle';
    this.acc = 0;
    this.t = 0;
    this.onImpact = null;
    this.onDrop = null;
    this.onSettle = null;
  }

  launch(speed = 12.5) {
    const a = this.rng() * TAU;
    const r = GEO.rimR - GEO.ballR;
    const ux = Math.cos(a), uy = Math.sin(a);
    this.ball = {
      x: ux * r, y: uy * r,
      vx: speed * uy, vy: -speed * ux,
      onWall: true, dropped: false, still: 0,
      hop: 0, hv: 0, settled: null,
    };
    this.wheelVel = 2.2 + this.rng() * 0.6;
    this.state = 'spinning';
    this.t = 0;
  }

  update(dt) {
    this.acc += Math.min(dt, 0.1);
    while (this.acc >= H) {
      this.step(H);
      this.acc -= H;
    }
  }

  step(h) {
    const target = this.state === 'spinning' ? 1.1 : P.idleWheel;
    this.wheelVel += (target - this.wheelVel) * (1 - Math.exp(-h / 18));
    this.wheelAngle = (this.wheelAngle + this.wheelVel * h) % TAU;

    const b = this.ball;
    if (!b) return;
    if (b.settled) {
      const s = b.settled;
      s.local += (s.targetLocal - s.local) * (1 - Math.exp(-h * 6));
      s.r += (s.targetR - s.r) * (1 - Math.exp(-h * 6));
      const ang = s.local + this.wheelAngle;
      b.x = Math.cos(ang) * s.r;
      b.y = Math.sin(ang) * s.r;
      b.hv -= 25 * h; b.hop = Math.max(0, b.hop + b.hv * h);
      if (b.hop === 0) b.hv = 0;
      return;
    }
    if (this.state !== 'spinning') return;
    this.t += h;

    const w = this.wheelVel;
    let r = Math.hypot(b.x, b.y);
    const ux = b.x / r, uy = b.y / r;
    const onRotor = r < GEO.rotorR;
    const sx = onRotor ? -w * b.y : 0;
    const sy = onRotor ? w * b.x : 0;

    let g;
    if (r >= GEO.rotorR) g = P.gBowl;
    else if (r >= GEO.pocketOutR) g = P.gRing;
    else if (r >= GEO.pocketInR) g = P.gPocket;
    else g = -P.gRing;
    b.vx -= ux * g * h;
    b.vy -= uy * g * h;

    let rx = b.vx - sx, ry = b.vy - sy;
    const sp = Math.hypot(rx, ry);
    if (sp > 1e-9) {
      let decel = P.rollC;
      if (b.onWall) decel += (P.wallMu * sp * sp) / r;
      let k = Math.max(0, sp - decel * h) / sp;
      if (onRotor) k *= Math.exp(-(r < GEO.pocketOutR ? P.pocketDamp : P.ringDamp) * h);
      rx *= k; ry *= k;
    }
    b.vx = sx + rx;
    b.vy = sy + ry;

    b.x += b.vx * h;
    b.y += b.vy * h;
    this.collide(w);

    b.hv -= 25 * h;
    b.hop += b.hv * h;
    if (b.hop <= 0) { b.hop = 0; b.hv = 0; }

    if (!b.onWall && !b.dropped && this.t > 0.3) {
      b.dropped = true;
      this.onDrop?.();
    }

    r = Math.hypot(b.x, b.y);
    if (r < GEO.pocketOutR + 0.012 && r > GEO.pocketInR) {
      const rel = Math.hypot(b.vx + w * b.y, b.vy - w * b.x);
      b.still = rel < 0.07 ? b.still + h : 0;
      if (b.still > 0.5) this.settle();
    } else {
      b.still = 0;
    }
    if (this.t > 35) this.settle();
  }

  collide(w) {
    const b = this.ball;
    const R = GEO.ballR;
    let r = Math.hypot(b.x, b.y);

    const lim = GEO.rimR - R;
    b.onWall = false;
    if (r >= lim) {
      const ux = b.x / r, uy = b.y / r;
      b.x = ux * lim; b.y = uy * lim;
      const vr = b.vx * ux + b.vy * uy;
      if (vr > 0) {
        b.vx -= vr * ux * 1.1;
        b.vy -= vr * uy * 1.1;
      }
      b.onWall = true;
      r = lim;
    }

    if (Math.abs(r - GEO.deflR) < GEO.deflSize + R + 0.01) {
      const min = R + GEO.deflSize;
      for (let j = 0; j < GEO.deflCount; j++) {
        const a = deflectorAngle(j);
        const cx = Math.cos(a) * GEO.deflR, cy = Math.sin(a) * GEO.deflR;
        const dx = b.x - cx, dy = b.y - cy;
        const d = Math.hypot(dx, dy);
        if (d >= min || d < 1e-9) continue;
        const nx = dx / d, ny = dy / d;
        b.x = cx + nx * min; b.y = cy + ny * min;
        const vn = b.vx * nx + b.vy * ny;
        if (vn < 0) {
          b.vx -= (1 + P.deflE) * vn * nx;
          b.vy -= (1 + P.deflE) * vn * ny;
          const jit = (this.rng() - 0.5) * 0.5 * -vn;
          b.vx += -ny * jit; b.vy += nx * jit;
          b.hv += -vn * 0.6;
          this.onImpact?.(-vn, 'deflector');
        }
      }
    }

    const inner = GEO.pocketInR + R;
    if (r < inner) {
      const ux = b.x / r, uy = b.y / r;
      b.x = ux * inner; b.y = uy * inner;
      const vr = b.vx * ux + b.vy * uy;
      if (vr < 0) {
        b.vx -= (1 + P.innerE) * vr * ux;
        b.vy -= (1 + P.innerE) * vr * uy;
        if (-vr > 0.15) this.onImpact?.(-vr, 'wall');
      }
      r = inner;
    }

    if (r < GEO.pocketOutR + R + 0.006) {
      const local = Math.atan2(b.y, b.x) - this.wheelAngle;
      const k0 = Math.floor(local / ALPHA);
      const min = R + GEO.fretHalf;
      for (let k = k0; k <= k0 + 1; k++) {
        const ang = this.wheelAngle + k * ALPHA;
        const dx = Math.cos(ang), dy = Math.sin(ang);
        const t = Math.min(GEO.pocketOutR, Math.max(GEO.pocketInR, b.x * dx + b.y * dy));
        const cx = dx * t, cy = dy * t;
        const ox = b.x - cx, oy = b.y - cy;
        const d = Math.hypot(ox, oy);
        if (d >= min || d < 1e-9) continue;
        const nx = ox / d, ny = oy / d;
        b.x = cx + nx * min; b.y = cy + ny * min;
        const fvx = -w * b.y, fvy = w * b.x;
        let rvx = b.vx - fvx, rvy = b.vy - fvy;
        const vn = rvx * nx + rvy * ny;
        if (vn < 0) {
          rvx -= (1 + P.fretE) * vn * nx;
          rvy -= (1 + P.fretE) * vn * ny;
          const tx = -ny, ty = nx;
          const vt = rvx * tx + rvy * ty;
          rvx -= vt * (1 - P.fretFric) * tx;
          rvy -= vt * (1 - P.fretFric) * ty;
          b.vx = fvx + rvx; b.vy = fvy + rvy;
          b.hv += -vn * 0.35;
          this.onImpact?.(-vn, 'fret');
        }
      }
    }
  }

  settle() {
    const b = this.ball;
    const r = Math.hypot(b.x, b.y);
    const local = Math.atan2(b.y, b.x) - this.wheelAngle;
    const index = pocketAt(local);
    const target = pocketCenterAngle(index);
    let diff = ((target - local) % TAU + TAU + Math.PI) % TAU - Math.PI;
    b.settled = {
      index,
      number: WHEEL_ORDER[index],
      local,
      targetLocal: local + diff,
      r,
      targetR: (GEO.pocketInR + GEO.pocketOutR) / 2 + 0.01,
    };
    b.vx = b.vy = 0;
    this.state = 'done';
    this.onSettle?.(WHEEL_ORDER[index]);
  }

  ballSpeed() {
    const b = this.ball;
    if (!b || b.settled) return 0;
    return Math.hypot(b.vx, b.vy);
  }

  reset() {
    this.ball = null;
    this.state = 'idle';
  }
}

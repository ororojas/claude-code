// Physics checks for the Proving Ground engine against textbook results.
// Run with: node --test physics-simulators/tests/*.test.js
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const P = require('../real-physics-3d/engine.js');

const { World, MATERIALS, DistanceJoint, BallJoint, math: M } = P;
const g = 9.80665;
const DT = 1 / 60;

function run(world, seconds, each) {
  const n = Math.round(seconds / DT);
  for (let i = 0; i < n; i++) {
    world.step(DT);
    if (each) each(world.time);
  }
}

function near(actual, expected, relTol, label) {
  const err = Math.abs(actual - expected) / Math.max(Math.abs(expected), 1e-9);
  assert.ok(err <= relTol, `${label}: got ${actual.toFixed(5)}, expected ${expected.toFixed(5)} (error ${(err * 100).toFixed(2)}%)`);
}

const noRolling = (m) => ({ ...m, rolling: 0 });

test('free fall in vacuum follows y = y0 - g t^2 / 2', () => {
  const w = new World({ airDensity: 0, substeps: 8 });
  const b = w.createBody({ position: M.v3(0, 20, 0), shapes: [{ type: 'sphere', radius: 0.1 }], material: MATERIALS.steel });
  run(w, 1.5);
  near(20 - b.position.y, 0.5 * g * 1.5 * 1.5, 0.006, 'drop distance');
  near(-b.velocity.y, g * 1.5, 1e-6, 'speed');
});

test('pendulum period matches 2*pi*sqrt(L/g)', () => {
  const w = new World({ airDensity: 0, substeps: 8 });
  const L = 1.5, th = (4 * Math.PI) / 180;
  const bob = w.createBody({
    position: M.v3(L * Math.sin(th), 3 - L * Math.cos(th), 0),
    shapes: [{ type: 'sphere', radius: 0.04 }], material: MATERIALS.steel,
  });
  w.addJoint(new DistanceJoint(w.ground, bob, M.v3(0, 3, 0), bob.position, { mode: 'rod' }));
  const crossings = [];
  let prev = bob.position.x;
  run(w, 13, (t) => {
    const x = bob.position.x;
    if (prev > 0 && x <= 0) crossings.push(t - DT * (x / (x - prev)));
    prev = x;
  });
  const period = (crossings[crossings.length - 1] - crossings[0]) / (crossings.length - 1);
  // finite-amplitude correction (1 + theta^2/16); a 1.5 m bob has a small radius so
  // treating it as a point mass is good to ~0.05%
  near(period, 2 * Math.PI * Math.sqrt(L / g) * (1 + (th * th) / 16), 0.004, 'period');
});

test('sliding block stops after v^2 / (2 mu g)', () => {
  const w = new World({ airDensity: 0 });
  w.addPlane();
  const b = w.createBody({
    position: M.v3(0, 0.1, 0), velocity: M.v3(6, 0, 0),
    shapes: [{ type: 'box', half: M.v3(0.2, 0.1, 0.2) }], material: MATERIALS.wood,
  });
  run(w, 4);
  const mu = Math.sqrt(MATERIALS.wood.friction * MATERIALS.ground.friction);
  near(b.position.x, 36 / (2 * mu * g), 0.02, 'stopping distance');
});

function inclineWorld(deg, rampMaterial = MATERIALS.wood) {
  const th = (deg * Math.PI) / 180;
  const w = new World({ airDensity: 0, substeps: 6 });
  w.createBody({
    type: 'static', quaternion: M.qFromAxisAngle(M.v3(0, 0, 1), -th),
    shapes: [{ type: 'box', half: M.v3(30, 0.5, 3) }], material: rampMaterial,
  });
  const n = M.v3(Math.sin(th), Math.cos(th), 0);
  const along = M.v3(-Math.cos(th) * 8, Math.sin(th) * 8, 0);
  return { w, th, n, along };
}

test('static friction holds a block below the friction angle and lets it slide above', () => {
  // wood on wood: mu = 0.5, friction angle = atan(0.5) = 26.6 degrees
  for (const deg of [22, 32]) {
    const { w, th, n, along } = inclineWorld(deg);
    const b = w.createBody({
      position: M.vadd(along, M.vscale(n, 0.5 + 0.1 + 0.001)), quaternion: M.qFromAxisAngle(M.v3(0, 0, 1), -th),
      shapes: [{ type: 'box', half: M.v3(0.2, 0.1, 0.2) }], material: MATERIALS.wood,
    });
    run(w, 2);
    const speed = M.vlen(b.velocity);
    if (deg < 26.6) assert.ok(speed < 1e-3, `block should stick at ${deg} deg, speed ${speed}`);
    else near(speed / 2, g * (Math.sin(th) - 0.5 * Math.cos(th)), 0.03, `sliding acceleration at ${deg} deg`);
  }
});

test('a solid ball rolls down an incline at 5/7 g sin(theta)', () => {
  const { w, th, n, along } = inclineWorld(18, noRolling(MATERIALS.wood));
  const r = 0.2;
  const b = w.createBody({
    position: M.vadd(along, M.vscale(n, 0.5 + r)), shapes: [{ type: 'sphere', radius: r }],
    material: noRolling(MATERIALS.rubber),
  });
  b.angularDamping = 0;
  run(w, 0.25);
  const v0 = M.vlen(b.velocity);
  run(w, 1.5);
  near((M.vlen(b.velocity) - v0) / 1.5, (5 / 7) * g * Math.sin(th), 0.02, 'rolling acceleration');
  near((M.vlen(b.angularVelocity) * r) / M.vlen(b.velocity), 1, 0.01, 'no slip (w r / v)');
});

test('rolling resistance slows a ball at 5/7 c_rr g', () => {
  const w = new World({ airDensity: 0 });
  w.addPlane({ material: { ...MATERIALS.ground, rolling: 0 } });
  const crr = 0.02;
  const b = w.createBody({
    position: M.v3(0, 0.2, 0), velocity: M.v3(4, 0, 0), angularVelocity: M.v3(0, 0, -20),
    shapes: [{ type: 'sphere', radius: 0.2 }], material: { ...MATERIALS.rubber, rolling: crr },
  });
  b.angularDamping = 0;
  run(w, 0.5);
  const v0 = b.velocity.x;
  run(w, 2);
  near((v0 - b.velocity.x) / 2, (5 / 7) * crr * g, 0.03, 'rolling deceleration');
});

test('restitution sets the bounce height ratio to e^2', () => {
  const w = new World({ airDensity: 0, substeps: 8 });
  w.addPlane();
  const b = w.createBody({ position: M.v3(0, 2.1, 0), shapes: [{ type: 'sphere', radius: 0.1 }], material: noRolling(MATERIALS.rubber) });
  const peaks = [];
  let prevVy = 0;
  run(w, 3, () => {
    if (prevVy > 0 && b.velocity.y <= 0) peaks.push(b.position.y - 0.1);
    prevVy = b.velocity.y;
  });
  const e = MATERIALS.rubber.restitution;
  near(peaks[1] / peaks[0], e * e, 0.06, 'second bounce ratio');
});

test('floating blocks sink to the depth Archimedes predicts', () => {
  for (const key of ['wood', 'ice', 'foam']) {
    const w = new World();
    w.addPlane();
    w.fluids.push({ min: M.v3(-5, 0, -5), max: M.v3(5, 3, 5), density: 1000 });
    const s = 0.4;
    const b = w.createBody({ position: M.v3(0, 2.6, 0), shapes: [{ type: 'box', half: M.v3(s / 2, s / 2, s / 2) }], material: MATERIALS[key] });
    run(w, 14);
    const submerged = (3 - (b.position.y - s / 2)) / s;
    assert.ok(Math.abs(submerged - MATERIALS[key].density / 1000) < 0.02, `${key}: submerged ${submerged.toFixed(3)}`);
  }
  const w = new World();
  w.addPlane();
  w.fluids.push({ min: M.v3(-5, 0, -5), max: M.v3(5, 3, 5), density: 1000 });
  const steel = w.createBody({ position: M.v3(0, 2.5, 0), shapes: [{ type: 'box', half: M.v3(0.2, 0.2, 0.2) }], material: MATERIALS.steel });
  run(w, 6);
  assert.ok(steel.position.y < 0.21, 'steel sinks to the floor');
});

test('falling ball reaches the terminal velocity of quadratic drag', () => {
  const w = new World({ substeps: 4 });
  const r = 0.1;
  const b = w.createBody({ position: M.v3(0, 5000, 0), shapes: [{ type: 'sphere', radius: r }], material: MATERIALS.foam });
  run(w, 40);
  const A = Math.PI * r * r;
  const vt = Math.sqrt((2 * (b.mass - 1.225 * b.volume) * g) / (1.225 * 0.47 * A));
  near(-b.velocity.y, vt, 0.005, 'terminal velocity');
});

test('projectile with air drag matches a fine-step reference integration', () => {
  const w = new World({ substeps: 4 });
  w.addPlane();
  const r = 0.035, v0 = 50, a = Math.PI / 4;
  const b = w.createBody({
    position: M.v3(0, r, 0), velocity: M.v3(v0 * Math.cos(a), v0 * Math.sin(a), 0),
    shapes: [{ type: 'sphere', radius: r }], material: MATERIALS.steel,
  });
  let land = null, prevVy = b.velocity.y;
  run(w, 12, () => {
    if (land === null && prevVy < -1 && b.velocity.y > prevVy + 1) land = b.position.x;
    prevVy = b.velocity.y;
  });
  const k = (0.5 * 1.225 * 0.47 * Math.PI * r * r) / b.mass;
  const lift = (1.225 * b.volume * g) / b.mass;
  let x = 0, y = r, vx = v0 * Math.cos(a), vy = v0 * Math.sin(a);
  const h = 1e-4;
  while (!(y < r && vy < 0)) {
    const s = Math.hypot(vx, vy);
    vx += -k * s * vx * h;
    vy += (-g + lift - k * s * vy) * h;
    x += vx * h;
    y += vy * h;
  }
  near(land, x, 0.005, 'range with drag');
});

test('a helium balloon rises at a couple of metres per second', () => {
  const w = new World();
  const b = w.createBody({ position: M.v3(0, 1, 0), shapes: [{ type: 'sphere', radius: 0.15 }], material: MATERIALS.balloon });
  run(w, 5);
  assert.ok(b.velocity.y > 1.5 && b.velocity.y < 3.5, `rise speed ${b.velocity.y}`);
});

test('spring-mass oscillator has period 2*pi*sqrt(m/k)', () => {
  const w = new World({ gravity: M.v3(0, 0, 0), airDensity: 0 });
  w.enableSleep = false;
  const b = w.createBody({ position: M.v3(1.2, 0, 0), shapes: [{ type: 'sphere', radius: 0.05, mass: 2 }], material: MATERIALS.steel });
  b.angularDamping = 0;
  w.addJoint(new DistanceJoint(w.ground, b, M.v3(0, 0, 0), b.position, { mode: 'spring', length: 1, stiffness: 200 }));
  const crossings = [];
  let prev = 0.2;
  run(w, 8, (t) => {
    const x = b.position.x - 1;
    if (prev > 0 && x <= 0) crossings.push(t - DT * (x / (x - prev)));
    prev = x;
  });
  const period = (crossings[crossings.length - 1] - crossings[0]) / (crossings.length - 1);
  near(period, 2 * Math.PI * Math.sqrt(2 / 200), 0.02, 'spring period');
});

test('a free body conserves energy and angular momentum while it flips about its middle axis', () => {
  const w = new World({ gravity: M.v3(0, 0, 0), airDensity: 0 });
  w.enableSleep = false;
  const b = w.createBody({ shapes: [{ type: 'box', half: M.v3(0.3, 0.15, 0.05) }], material: MATERIALS.steel });
  b.angularDamping = 0;
  b.setAngularVelocity(M.v3(0.01, 6, 0.01));
  const L0 = b.angularMomentum(), E0 = b.kineticEnergy();
  let flips = 0, prev = 1;
  run(w, 20, () => {
    const s = Math.sign(M.m3mulv(b.R, M.v3(0, 1, 0)).y);
    if (s !== prev) { flips++; prev = s; }
  });
  near(b.kineticEnergy(), E0, 0.001, 'kinetic energy');
  assert.ok(M.vlen(M.vsub(b.angularMomentum(), L0)) < 1e-3 * M.vlen(L0), 'angular momentum vector is constant');
  assert.ok(flips >= 4, `expected repeated flips (Dzhanibekov effect), saw ${flips}`);
});

test("Newton's cradle hands the momentum down the row", () => {
  const w = new World({ airDensity: 0, substeps: 8 });
  const r = 0.075, top = 2, gap = 0.006;
  const mat = { ...MATERIALS.steel, restitution: 0.97, friction: 0.05, rolling: 0 };
  const balls = [];
  for (let i = 0; i < 5; i++) {
    const x = (i - 2) * (2 * r + gap);
    const b = w.createBody({ position: M.v3(x, top - 1, 0), shapes: [{ type: 'sphere', radius: r }], material: mat });
    b.canSleep = false;
    w.addJoint(new DistanceJoint(w.ground, b, M.v3(x, top, -0.3), b.position, { mode: 'rod' }));
    w.addJoint(new DistanceJoint(w.ground, b, M.v3(x, top, 0.3), b.position, { mode: 'rod' }));
    balls.push(b);
  }
  const a = (35 * Math.PI) / 180, b0 = balls[0];
  b0.setPosition(M.v3(b0.position.x - Math.sin(a), top - Math.cos(a), 0));
  const impact = Math.sqrt(2 * g * (1 - Math.cos(a)));
  let peak = 0, others = [];
  run(w, 0.9, () => {
    if (balls[4].velocity.x > peak) {
      peak = balls[4].velocity.x;
      others = balls.slice(0, 4).map((b) => Math.abs(b.velocity.x));
    }
  });
  assert.ok(peak > 0.9 * impact, `last ball left at ${peak.toFixed(3)} m/s, impact was ${impact.toFixed(3)}`);
  others.forEach((v, i) => assert.ok(v < 0.06 * impact, `ball ${i} should be nearly still, has ${v.toFixed(3)} m/s`));
});

test('a 12-box stack stands and goes to sleep', () => {
  const w = new World();
  w.addPlane();
  const boxes = [];
  for (let i = 0; i < 12; i++) {
    boxes.push(w.createBody({ position: M.v3(0, 0.25 + i * 0.5, 0), shapes: [{ type: 'box', half: M.v3(0.25, 0.25, 0.25) }], material: MATERIALS.wood }));
  }
  run(w, 6);
  const top = boxes[11];
  assert.ok(Math.hypot(top.position.x, top.position.z) < 0.02, 'top block stays centred');
  assert.ok(top.position.y > 5.75 - 0.02, `top block height ${top.position.y}`);
  assert.ok(boxes.every((b) => b.sleeping), 'whole stack sleeps');
});

test('an 18-layer Jenga tower is stable', () => {
  const w = new World();
  w.addPlane();
  const L = 0.75, H = 0.15, W = 0.25;
  const blocks = [];
  for (let layer = 0; layer < 18; layer++) {
    for (let k = -1; k <= 1; k++) {
      const along = layer % 2 === 0;
      const off = k * (W + 0.002);
      blocks.push(w.createBody({
        position: along ? M.v3(off, H / 2 + layer * H, 0) : M.v3(0, H / 2 + layer * H, off),
        quaternion: along ? M.quat() : M.qFromAxisAngle(M.v3(0, 1, 0), Math.PI / 2),
        shapes: [{ type: 'box', half: M.v3(W / 2, H / 2, L / 2) }], material: MATERIALS.wood,
      }));
    }
  }
  run(w, 5);
  const top = blocks[blocks.length - 2];
  assert.ok(Math.hypot(top.position.x, top.position.z) < 0.01, 'top layer stays put');
  assert.ok(blocks.every((b) => b.sleeping), 'tower sleeps');
});

test('fast projectiles do not tunnel through a thin wall', () => {
  const w = new World({ airDensity: 0, gravity: M.v3(0, 0, 0) });
  w.createBody({ type: 'static', position: M.v3(3, 0, 0), shapes: [{ type: 'box', half: M.v3(0.025, 2, 2) }], material: MATERIALS.concrete });
  const ball = w.createBody({ velocity: M.v3(150, 0, 0), shapes: [{ type: 'sphere', radius: 0.05 }], material: MATERIALS.steel });
  const cube = w.createBody({ position: M.v3(0, 1, 0), velocity: M.v3(150, 0, 0), shapes: [{ type: 'box', half: M.v3(0.05, 0.05, 0.05) }], material: MATERIALS.steel });
  const tilted = w.createBody({ position: M.v3(0, -1, 0), quaternion: M.qFromEuler(0.4, 0.7, 0.2), velocity: M.v3(150, 0, 0), shapes: [{ type: 'box', half: M.v3(0.05, 0.05, 0.05) }], material: MATERIALS.steel });
  run(w, 0.5);
  for (const b of [ball, cube, tilted]) assert.ok(b.position.x < 3, `body ended at x=${b.position.x.toFixed(2)}`);
});

test('overlapping bodies separate gently instead of exploding', () => {
  const w = new World();
  w.addPlane();
  const bodies = [];
  for (let i = 0; i < 6; i++) {
    bodies.push(w.createBody({ position: M.v3(0.05 * i, 0.3, 0.02 * i), shapes: [{ type: 'box', half: M.v3(0.3, 0.3, 0.3) }], material: MATERIALS.wood }));
  }
  let maxSpeed = 0;
  run(w, 3, () => { for (const b of bodies) maxSpeed = Math.max(maxSpeed, M.vlen(b.velocity)); });
  assert.ok(maxSpeed < 8, `max speed ${maxSpeed.toFixed(2)} m/s`);
  for (const b of bodies) assert.ok(Number.isFinite(b.position.y) && b.position.y > 0.2, 'bodies end above the ground');
});

test('removing the bottom block wakes the block resting on it', () => {
  const w = new World();
  w.addPlane();
  const low = w.createBody({ position: M.v3(0, 0.25, 0), shapes: [{ type: 'box', half: M.v3(0.25, 0.25, 0.25) }], material: MATERIALS.wood });
  const high = w.createBody({ position: M.v3(0, 0.75, 0), shapes: [{ type: 'box', half: M.v3(0.25, 0.25, 0.25) }], material: MATERIALS.wood });
  run(w, 3);
  assert.ok(high.sleeping, 'stack asleep');
  w.removeBody(low);
  run(w, 1.5);
  near(high.position.y, 0.25, 0.02, 'upper block lands on the ground');
});

test('a ball joint pendulum keeps its rod length', () => {
  const w = new World({ airDensity: 0 });
  const arm = w.createBody({ position: M.v3(1, 3, 0), shapes: [{ type: 'box', half: M.v3(1, 0.05, 0.05) }], material: MATERIALS.steel });
  w.addJoint(new BallJoint(w.ground, arm, M.v3(0, 3, 0)));
  let worst = 0;
  run(w, 4, () => {
    const tip = arm.toWorld(M.v3(-1, 0, 0));
    worst = Math.max(worst, M.vlen(M.vsub(tip, M.v3(0, 3, 0))));
  });
  assert.ok(worst < 0.005, `joint drift ${worst}`);
});

test('an explosion throws nearby bodies outward', () => {
  const w = new World();
  w.addPlane();
  const near1 = w.createBody({ position: M.v3(1, 0.25, 0), shapes: [{ type: 'box', half: M.v3(0.25, 0.25, 0.25) }], material: MATERIALS.wood });
  const far = w.createBody({ position: M.v3(20, 0.25, 0), shapes: [{ type: 'box', half: M.v3(0.25, 0.25, 0.25) }], material: MATERIALS.wood });
  run(w, 1);
  w.explode(M.v3(0, 0.1, 0), 6, 1);
  assert.ok(near1.velocity.x > 1, 'near body pushed away');
  assert.equal(M.vlen(far.velocity), 0, 'far body untouched');
});

test('a steel hull floats because its ghost volume displaces water', () => {
  const w = new World();
  w.addPlane();
  w.fluids.push({ min: M.v3(-5, 0, -5), max: M.v3(5, 2, 5), density: 1000 });
  const t = 0.01, hx = 0.6, hy = 0.2, hz = 0.3;
  const plate = (half, offset) => ({ type: 'box', half, offset });
  const boat = w.createBody({
    position: M.v3(0, 2.4, 0), material: MATERIALS.steel,
    shapes: [
      plate(M.v3(hx, t / 2, hz), M.v3(0, -hy + t / 2, 0)),
      plate(M.v3(hx, hy, t / 2), M.v3(0, 0, hz - t / 2)),
      plate(M.v3(hx, hy, t / 2), M.v3(0, 0, -hz + t / 2)),
      plate(M.v3(t / 2, hy, hz - t), M.v3(hx - t / 2, 0, 0)),
      plate(M.v3(t / 2, hy, hz - t), M.v3(-hx + t / 2, 0, 0)),
      // the air enclosed by the plates
      { type: 'box', half: M.v3(hx - t, hy - t / 2, hz - t), offset: M.v3(0, t / 2, 0), ghost: true },
    ],
  });
  run(w, 12);
  const draft = 2 - boat.aabb.min.y;
  const expected = boat.mass / (1000 * (2 * hx) * (2 * hz));
  assert.ok(boat.mass > 150 && boat.mass < 200, `hull mass ${boat.mass}`);
  near(draft, expected, 0.04, 'draft');
});

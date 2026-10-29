// Checks for the Ana & Kata 4D engine: hulls, exact volumes, slicing,
// closest points and contact physics.
// Run with: node --test physics-simulators/tests/*.test.js
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../hyperspace-4d/engine4d.js');

const { World4, Body4, Polytope } = E;
const DT = 1 / 60;
const run = (w, seconds, each) => {
  const n = Math.round(seconds / DT);
  for (let i = 0; i < n; i++) { w.step(DT); if (each) each(w); }
};
const near = (a, b, tol, label) => assert.ok(Math.abs(a - b) <= tol, `${label}: got ${a}, expected ${b} ± ${tol}`);
const standardView = (w = 0) => E.viewBasis(E.identity(), [0, 0, 0, w]);
function sliceArea(s) {
  let area = 0;
  for (let i = 0; i < s.positions.length; i += 9) {
    const p = s.positions;
    const a = [p[i + 3] - p[i], p[i + 4] - p[i + 1], p[i + 5] - p[i + 2]];
    const b = [p[i + 6] - p[i], p[i + 7] - p[i + 1], p[i + 8] - p[i + 2]];
    area += 0.5 * Math.hypot(a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]);
  }
  return area;
}

test('regular polytopes have the right vertices, edges and cells', () => {
  const expect = [
    [Polytope.tesseract(1), 16, 32, 8],
    [Polytope.simplex(1), 5, 10, 5],
    [Polytope.orthoplex(1), 8, 24, 16],
    [Polytope.icositetrachoron(1), 24, 96, 24],
    [Polytope.duoprism(3, 4), 12, 24, 7],
  ];
  for (const [P, v, e, c] of expect) {
    assert.equal(P.vertices.length, v, P.name + ' vertices');
    assert.equal(P.edges.length, e, P.name + ' edges');
    assert.equal(P.cells.length, c, P.name + ' cells');
  }
});

test('volumes and second moments are exact', () => {
  const a = Math.sqrt(5 / 2);
  near(Polytope.simplex(1).volume, (Math.sqrt(5) / 96) * a ** 4, 1e-9, '5-cell volume');
  near(Polytope.orthoplex(1).volume, 2 / 3, 1e-9, '16-cell volume');
  near(Polytope.icositetrachoron(1).volume, 2, 1e-9, '24-cell volume');
  near(Polytope.duoprism(3, 4).volume, ((3 * Math.sqrt(3)) / 4) * 2, 1e-9, '3-4 duoprism volume');
  // cross-polytope |x|_1 <= 1 in 4D: <x_i^2> = 2 / ((n+1)(n+2)) = 1/15
  for (const m of Polytope.orthoplex(1).moments) near(m, 1 / 15, 1e-9, '16-cell moment');
  for (const m of Polytope.tesseract(1).moments) near(m, 1 / 12, 1e-12, 'tesseract moment');
});

test('slicing an axis-aligned tesseract at w = 0 gives a cube', () => {
  const b = new Body4({ poly: Polytope.tesseract(2), type: 'static' });
  const s = E.slicePolytope(b, standardView(0.3));
  assert.equal(s.positions.length / 9, 12, 'six square faces, two triangles each');
  near(sliceArea(s), 24, 1e-9, 'surface area of a 2 m cube');
  assert.equal(E.slicePolytope(b, standardView(1.5)).positions.length, 0, 'nothing outside its w range');
});

test('a tesseract turned 45° in the xw plane slices into a longer box', () => {
  const b = new Body4({ poly: Polytope.tesseract(2), type: 'static', rotation: E.planeRotation(0, 3, Math.PI / 4) });
  const s = E.slicePolytope(b, standardView(0));
  near(sliceArea(s), 8 + 16 * Math.SQRT2, 1e-9, 'area of a 2√2 × 2 × 2 box');
});

test('slicing a 16-cell through its centre gives an octahedron', () => {
  const b = new Body4({ poly: Polytope.orthoplex(1), type: 'static' });
  const s = E.slicePolytope(b, standardView(0.0001));
  assert.equal(s.positions.length / 9, 8, 'eight triangles');
  // eight equilateral faces with edge sqrt(2): 8 * (sqrt(3)/4) * 2 = 4 sqrt(3)
  near(sliceArea(s), 4 * Math.sqrt(3), 0.005, 'octahedron area');
});

test('slicing the 24-cell near its centre gives a cuboctahedron-like solid', () => {
  const b = new Body4({ poly: Polytope.icositetrachoron(Math.SQRT2), type: 'static' });
  const s = E.slicePolytope(b, standardView(0.001));
  // 14 faces: 8 triangles and 6 squares, from the 14 cells the slice crosses
  assert.equal(new Set(s.cells).size, 14);
});

test('a hypersphere slices into spheres that shrink with distance', () => {
  const b = new Body4({ radius: 1, type: 'static', position: [0, 0, 0, 0.6] });
  const s = E.sliceSphere(b, standardView(0));
  near(s.radius, 0.8, 1e-12, 'radius sqrt(1 - 0.6^2)');
  assert.equal(E.sliceSphere(b, standardView(-0.5)), null, 'gone beyond its radius');
});

test('GJK finds the closest point on a 4D hull', () => {
  const b = new Body4({ poly: Polytope.orthoplex(1), type: 'static' });
  const r1 = E.closestPointOnHull(b.wv, [2, 0, 0, 0]);
  near(r1.distance, 1, 1e-9, 'distance to the nearest vertex');
  const r2 = E.closestPointOnHull(b.wv, [1, 1, 1, 1]);
  near(r2.distance, 1.5, 1e-9, 'distance to the centre of a tetrahedral cell');
  assert.ok(E.closestPointOnHull(b.wv, [0.1, 0.1, 0, 0]).inside, 'a point inside reports inside');
});

function floorWorld() {
  const w = new World4();
  w.create({ type: 'static', plane: { normal: [0, 1, 0, 0], offset: 0 }, material: { friction: 0.8, restitution: 0.1 } });
  return w;
}

test('a hypersphere comes to rest on the floor', () => {
  const w = floorWorld();
  const b = w.create({ radius: 0.5, position: [0, 2, 0, 0], material: { restitution: 0.1 } });
  run(w, 4);
  near(b.pos[1], 0.5, 0.003, 'rest height');
  assert.ok(b.sleeping, 'falls asleep');
});

test('a tumbling tesseract settles flat on one cell', () => {
  const w = floorWorld();
  let R = E.mulMM(E.planeRotation(0, 1, 0.5), E.planeRotation(1, 3, 0.4));
  R = E.mulMM(R, E.planeRotation(2, 3, 0.3));
  const b = w.create({ poly: Polytope.tesseract(1), position: [0, 2, 0, 0], rotation: R, material: { restitution: 0.2 } });
  run(w, 6);
  const ys = b.wv.map((v) => v[1]).sort((p, q) => p - q);
  near(ys[0], 0, 0.01, 'lowest vertex on the floor');
  // resting on a cubic cell: eight vertices touch the floor
  assert.ok(ys[7] < 0.02, `eight vertices down (eighth at ${ys[7].toFixed(3)})`);
  near(b.pos[1], 0.5, 0.01, 'centre at half the edge length');
});

test('a sliding hypersphere ends up rolling at 3/4 of its speed', () => {
  // for a solid 4-ball the moment in any plane is m r^2 / 3, so rolling
  // without slipping keeps v = v0 / (1 + 1/3)
  const w = floorWorld();
  w.enableSleep = false;
  const b = w.create({ radius: 0.5, position: [0, 0.5, 0, 0], velocity: [4, 0, 0, 0], material: { friction: 0.6, restitution: 0 }, linearDamping: 0, angularDamping: 0 });
  run(w, 3);
  near(b.vel[0], 3, 0.03, 'rolling speed');
  near(-b.B[0] * 0.5, b.vel[0], 0.03, 'contact point at rest (xy spin times r)');
});

test('two equal hyperspheres swap velocities in an elastic head-on hit', () => {
  const w = new World4({ gravity: [0, 0, 0, 0] });
  w.enableSleep = false;
  const m = { restitution: 1, friction: 0 };
  const a = w.create({ radius: 0.5, position: [0, 0, 0, -2], velocity: [0, 0, 0, 3], material: m, linearDamping: 0 });
  const b = w.create({ radius: 0.5, position: [0, 0, 0, 0], material: m, linearDamping: 0 });
  run(w, 1.5);
  near(a.vel[3], 0, 0.05, 'striker stops');
  near(b.vel[3], 3, 0.05, 'target leaves at the striker speed');
});

test('a ball rolls off a platform when it leaves the platform in w', () => {
  // the core mechanic of the game: floors exist only over a range of w
  const w = new World4();
  w.create({ type: 'static', poly: Polytope.box([3, 0.25, 3, 1]), position: [0, -0.25, 0, 0] });
  const ball = w.create({ radius: 0.4, position: [0, 0.4, 0, 0], material: { restitution: 0 } });
  run(w, 1);
  near(ball.pos[1], 0.4, 0.01, 'resting on the platform');
  ball.vel = [0, 0, 0, 2];
  ball.wake();
  run(w, 2);
  assert.ok(ball.pos[1] < -1, `fell past the edge in w (y = ${ball.pos[1].toFixed(2)})`);
});

test('a stack of three tesseracts stands', () => {
  const w = floorWorld();
  const boxes = [0, 1, 2].map((i) => w.create({ poly: Polytope.tesseract(1), position: [0, 0.5 + i * 1.0, 0, 0], material: { restitution: 0 } }));
  run(w, 5);
  const top = boxes[2];
  near(top.pos[1], 2.5, 0.03, 'top height');
  assert.ok(Math.hypot(top.pos[0], top.pos[2], top.pos[3]) < 0.02, 'top stays centred');
  assert.ok(boxes.every((b) => b.sleeping), 'stack sleeps');
});

test('a hypersphere rests on a 16-cell (sphere vs general polytope)', () => {
  const w = new World4();
  w.create({ type: 'static', poly: Polytope.orthoplex(1), position: [0, 0, 0, 0] });
  const ball = w.create({ radius: 0.3, position: [0, 1.5, 0, 0], material: { restitution: 0 } });
  run(w, 3);
  // the top vertex of the 16-cell is at y = 1
  near(ball.pos[1], 1.3, 0.02, 'balanced on the top vertex');
});

test('a moving platform sets a ball rolling at a quarter of its speed and carries a box', () => {
  // A ball on a floor that starts moving rolls: friction speeds the centre up
  // and spins it until the contact point matches the floor. For a solid 4-ball
  // (moment m r^2 / 3) the centre ends at v / (1 + 3) = v / 4.
  const w = new World4();
  w.enableSleep = false;
  const plat = w.create({ type: 'kinematic', poly: Polytope.box([1.5, 0.2, 1.5, 3]), position: [0, -0.2, 0, 0] });
  const ball = w.create({ radius: 0.4, position: [0, 0.4, 0, -0.8], material: { friction: 0.9, restitution: 0 }, linearDamping: 0, angularDamping: 0 });
  const crate = w.create({ poly: Polytope.tesseract(0.5), position: [0, 0.25, 0, 0.8], material: { friction: 0.9, restitution: 0 }, linearDamping: 0 });
  run(w, 0.5);
  plat.vel = [0, 0, 0, 1];
  run(w, 1);
  near(ball.vel[3], 0.25, 0.02, 'ball centre speed');
  near(crate.vel[3], 1, 0.02, 'crate rides at platform speed');
  near(crate.pos[1], 0.25, 0.01, 'crate still on top');
});

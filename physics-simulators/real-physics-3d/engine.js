/*
 * Proving Ground physics engine
 *
 * A small rigid-body engine written for the Proving Ground simulator.
 * Units are SI (metres, kilograms, seconds) and +Y is up.
 *
 * What it does:
 *   - spheres, boxes and compound bodies built from them, plus infinite planes
 *   - SAT box-box contacts with face clipping (up to 4 points per manifold)
 *   - sub-stepped sequential impulses with soft contacts and a relax pass
 *     (the "soft step" scheme from Erin Catto's Solver2D / Box2D v3)
 *   - Coulomb friction (circular cone), restitution, rolling resistance
 *   - implicit gyroscopic integration, so free bodies conserve angular
 *     momentum (tennis-racket flips, precession)
 *   - quadratic aerodynamic drag, wind, buoyancy in air and in water volumes
 *   - ball, rod, rope, spring and grab joints
 *   - island sleeping
 *
 * Works as a browser global (window.Physics3D) or a CommonJS module.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Physics3D = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  // ---------------------------------------------------------------------------
  // Math helpers. Plain {x,y,z} objects keep things readable; the contact
  // solver unpacks them into scalars in its inner loops.
  // ---------------------------------------------------------------------------

  const v3 = (x = 0, y = 0, z = 0) => ({ x, y, z });
  const vcopy = (a) => ({ x: a.x, y: a.y, z: a.z });
  const vadd = (a, b) => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });
  const vsub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
  const vscale = (a, s) => ({ x: a.x * s, y: a.y * s, z: a.z * s });
  const vmad = (a, b, s) => ({ x: a.x + b.x * s, y: a.y + b.y * s, z: a.z + b.z * s });
  const vdot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
  const vcross = (a, b) => ({ x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x });
  const vlen2 = (a) => a.x * a.x + a.y * a.y + a.z * a.z;
  const vlen = (a) => Math.sqrt(a.x * a.x + a.y * a.y + a.z * a.z);
  const vneg = (a) => ({ x: -a.x, y: -a.y, z: -a.z });
  const vlerp = (a, b, t) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t });
  const vnorm = (a) => {
    const l = vlen(a);
    return l > 1e-12 ? { x: a.x / l, y: a.y / l, z: a.z / l } : { x: 0, y: 0, z: 0 };
  };
  const clamp = (x, lo, hi) => (x < lo ? lo : x > hi ? hi : x);
  const isFiniteVec = (a) => Number.isFinite(a.x) && Number.isFinite(a.y) && Number.isFinite(a.z);

  // 3x3 matrices are flat row-major arrays.
  const ZERO3 = Object.freeze({ x: 0, y: 0, z: 0 });
  const M3_ZERO = [0, 0, 0, 0, 0, 0, 0, 0, 0];
  const M3_ID = [1, 0, 0, 0, 1, 0, 0, 0, 1];

  function m3mulv(m, v) {
    return {
      x: m[0] * v.x + m[1] * v.y + m[2] * v.z,
      y: m[3] * v.x + m[4] * v.y + m[5] * v.z,
      z: m[6] * v.x + m[7] * v.y + m[8] * v.z,
    };
  }
  // transpose(m) * v
  function m3tmulv(m, v) {
    return {
      x: m[0] * v.x + m[3] * v.y + m[6] * v.z,
      y: m[1] * v.x + m[4] * v.y + m[7] * v.z,
      z: m[2] * v.x + m[5] * v.y + m[8] * v.z,
    };
  }
  function m3mul(a, b) {
    const r = new Array(9);
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        r[i * 3 + j] = a[i * 3] * b[j] + a[i * 3 + 1] * b[3 + j] + a[i * 3 + 2] * b[6 + j];
      }
    }
    return r;
  }
  const m3transpose = (m) => [m[0], m[3], m[6], m[1], m[4], m[7], m[2], m[5], m[8]];
  const m3add = (a, b) => a.map((x, i) => x + b[i]);
  const m3sub = (a, b) => a.map((x, i) => x - b[i]);
  const m3scale = (a, s) => a.map((x) => x * s);
  const m3skew = (v) => [0, -v.z, v.y, v.z, 0, -v.x, -v.y, v.x, 0];
  function m3inverse(m) {
    const a = m[0], b = m[1], c = m[2], d = m[3], e = m[4], f = m[5], g = m[6], h = m[7], i = m[8];
    const A = e * i - f * h, B = -(d * i - f * g), C = d * h - e * g;
    const det = a * A + b * B + c * C;
    if (Math.abs(det) < 1e-30) return M3_ZERO.slice();
    const k = 1 / det;
    return [
      A * k, -(b * i - c * h) * k, (b * f - c * e) * k,
      B * k, (a * i - c * g) * k, -(a * f - c * d) * k,
      C * k, -(a * h - b * g) * k, (a * e - b * d) * k,
    ];
  }
  // R * M * R^T
  const m3rotate = (R, M) => m3mul(m3mul(R, M), m3transpose(R));

  // Quaternions {x,y,z,w}
  const quat = (x = 0, y = 0, z = 0, w = 1) => ({ x, y, z, w });
  function qmul(a, b) {
    return {
      x: a.w * b.x + a.x * b.w + a.y * b.z - a.z * b.y,
      y: a.w * b.y - a.x * b.z + a.y * b.w + a.z * b.x,
      z: a.w * b.z + a.x * b.y - a.y * b.x + a.z * b.w,
      w: a.w * b.w - a.x * b.x - a.y * b.y - a.z * b.z,
    };
  }
  const qconj = (q) => ({ x: -q.x, y: -q.y, z: -q.z, w: q.w });
  function qnormalize(q) {
    const l = Math.hypot(q.x, q.y, q.z, q.w);
    if (l < 1e-12) return quat();
    return { x: q.x / l, y: q.y / l, z: q.z / l, w: q.w / l };
  }
  function qrotate(q, v) {
    // v' = v + 2w(u x v) + 2u x (u x v)
    const tx = 2 * (q.y * v.z - q.z * v.y);
    const ty = 2 * (q.z * v.x - q.x * v.z);
    const tz = 2 * (q.x * v.y - q.y * v.x);
    return {
      x: v.x + q.w * tx + (q.y * tz - q.z * ty),
      y: v.y + q.w * ty + (q.z * tx - q.x * tz),
      z: v.z + q.w * tz + (q.x * ty - q.y * tx),
    };
  }
  function qFromAxisAngle(axis, angle) {
    const n = vnorm(axis);
    const s = Math.sin(angle / 2);
    return { x: n.x * s, y: n.y * s, z: n.z * s, w: Math.cos(angle / 2) };
  }
  function qFromEuler(x, y, z) {
    // intrinsic X then Y then Z (same convention as three.js 'XYZ')
    const c1 = Math.cos(x / 2), c2 = Math.cos(y / 2), c3 = Math.cos(z / 2);
    const s1 = Math.sin(x / 2), s2 = Math.sin(y / 2), s3 = Math.sin(z / 2);
    return {
      x: s1 * c2 * c3 + c1 * s2 * s3,
      y: c1 * s2 * c3 - s1 * c2 * s3,
      z: c1 * c2 * s3 + s1 * s2 * c3,
      w: c1 * c2 * c3 - s1 * s2 * s3,
    };
  }
  function m3fromQuat(q) {
    const x = q.x, y = q.y, z = q.z, w = q.w;
    const x2 = x + x, y2 = y + y, z2 = z + z;
    const xx = x * x2, xy = x * y2, xz = x * z2, yy = y * y2, yz = y * z2, zz = z * z2;
    const wx = w * x2, wy = w * y2, wz = w * z2;
    return [
      1 - (yy + zz), xy - wz, xz + wy,
      xy + wz, 1 - (xx + zz), yz - wx,
      xz - wy, yz + wx, 1 - (xx + yy),
    ];
  }
  // Orthonormal basis around a unit vector (Duff et al. 2017)
  function orthoBasis(n) {
    const sign = n.z >= 0 ? 1 : -1;
    const a = -1 / (sign + n.z);
    const b = n.x * n.y * a;
    return [
      { x: 1 + sign * n.x * n.x * a, y: sign * b, z: -sign * n.x },
      { x: b, y: sign + n.y * n.y * a, z: -n.y },
    ];
  }

  // ---------------------------------------------------------------------------
  // Materials. Densities in kg/m^3; friction and restitution are typical
  // dry values from engineering tables. Pair values combine as
  // friction = sqrt(a*b), restitution = max(a, b).
  // ---------------------------------------------------------------------------

  const MATERIALS = {
    wood:     { key: 'wood',     name: 'Oak',            density: 700,   friction: 0.50, restitution: 0.38, rolling: 0.010 },
    pine:     { key: 'pine',     name: 'Pine',           density: 500,   friction: 0.45, restitution: 0.35, rolling: 0.010 },
    steel:    { key: 'steel',    name: 'Steel',          density: 7850,  friction: 0.42, restitution: 0.60, rolling: 0.002 },
    rubber:   { key: 'rubber',   name: 'Rubber',         density: 1150,  friction: 0.95, restitution: 0.82, rolling: 0.015 },
    ice:      { key: 'ice',      name: 'Ice',            density: 917,   friction: 0.03, restitution: 0.15, rolling: 0.002 },
    glass:    { key: 'glass',    name: 'Glass',          density: 2500,  friction: 0.50, restitution: 0.55, rolling: 0.003 },
    concrete: { key: 'concrete', name: 'Concrete',       density: 2400,  friction: 0.70, restitution: 0.20, rolling: 0.010 },
    foam:     { key: 'foam',     name: 'Polystyrene foam', density: 30,  friction: 0.60, restitution: 0.25, rolling: 0.020 },
    gold:     { key: 'gold',     name: 'Gold',           density: 19300, friction: 0.40, restitution: 0.25, rolling: 0.003 },
    plastic:  { key: 'plastic',  name: 'ABS plastic',    density: 1050,  friction: 0.35, restitution: 0.60, rolling: 0.006 },
    balloon:  { key: 'balloon',  name: 'Helium balloon', density: 0.37,  friction: 0.40, restitution: 0.55, rolling: 0.020 },
    bowling:  { key: 'bowling',  name: 'Urethane',       density: 1290,  friction: 0.25, restitution: 0.65, rolling: 0.004 },
    maple:    { key: 'maple',    name: 'Hard maple',     density: 900,   friction: 0.30, restitution: 0.55, rolling: 0.005 },
    brick:    { key: 'brick',    name: 'Fired brick',    density: 1900,  friction: 0.60, restitution: 0.20, rolling: 0.010 },
    ground:   { key: 'ground',   name: 'Concrete slab',  density: 2400,  friction: 0.75, restitution: 0.20, rolling: 0.010 },
  };

  // Drag coefficients (Cd) for the two primitive shapes.
  const CD_SPHERE = 0.47;
  const CD_BOX = 1.05;

  // ---------------------------------------------------------------------------
  // Shapes and bodies
  // ---------------------------------------------------------------------------

  let shapeCounter = 0;
  let bodyCounter = 0;

  class Shape {
    constructor(body, def) {
      this.uid = ++shapeCounter;
      this.body = body;
      this.type = def.type;
      this.material = def.material || body.material;
      this.offset = vcopy(def.offset || v3());
      this.localQ = def.rotation ? qnormalize(def.rotation) : null;
      this.localR = this.localQ ? m3fromQuat(this.localQ) : null;
      this.hollow = !!def.hollow;
      // A ghost shape has no mass and never collides, but it displaces fluid
      // (the air-filled inside of a hull).
      this.ghost = !!def.ghost;
      this.userData = def.userData || null;
      this.wpos = v3();
      this.wR = M3_ID;
      this.aabb = { min: v3(), max: v3() };
      this.mass = 0;
      if (this.type === 'sphere') {
        this.radius = def.radius;
        this.volume = (4 / 3) * Math.PI * def.radius ** 3;
        this.bound = def.radius;
      } else if (this.type === 'box') {
        this.half = vcopy(def.half);
        this.volume = 8 * def.half.x * def.half.y * def.half.z;
        this.bound = vlen(def.half);
      } else if (this.type === 'plane') {
        this.normal = vnorm(def.normal || v3(0, 1, 0));
        this.volume = 0;
        this.bound = Infinity;
        this.wN = vcopy(this.normal);
        this.wD = 0;
      } else {
        throw new Error('Unknown shape type ' + def.type);
      }
    }

    inertia(m) {
      if (this.type === 'sphere') {
        const k = (this.hollow ? 2 / 3 : 2 / 5) * m * this.radius * this.radius;
        return [k, 0, 0, 0, k, 0, 0, 0, k];
      }
      if (this.type === 'box') {
        const h = this.half;
        return [
          (m / 3) * (h.y * h.y + h.z * h.z), 0, 0,
          0, (m / 3) * (h.x * h.x + h.z * h.z), 0,
          0, 0, (m / 3) * (h.x * h.x + h.y * h.y),
        ];
      }
      return M3_ZERO.slice();
    }

    updateWorld(body) {
      const R = body.R;
      this.wpos = vadd(body.position, m3mulv(R, this.offset));
      this.wR = this.localR ? m3mul(R, this.localR) : R;
      const p = this.wpos;
      let ex, ey, ez;
      if (this.type === 'sphere') {
        ex = ey = ez = this.radius;
      } else if (this.type === 'box') {
        const m = this.wR, h = this.half;
        ex = Math.abs(m[0]) * h.x + Math.abs(m[1]) * h.y + Math.abs(m[2]) * h.z;
        ey = Math.abs(m[3]) * h.x + Math.abs(m[4]) * h.y + Math.abs(m[5]) * h.z;
        ez = Math.abs(m[6]) * h.x + Math.abs(m[7]) * h.y + Math.abs(m[8]) * h.z;
      } else {
        this.wN = m3mulv(R, this.normal);
        this.wD = vdot(this.wN, p);
        ex = ey = ez = Infinity;
      }
      this.aabb.min.x = p.x - ex; this.aabb.min.y = p.y - ey; this.aabb.min.z = p.z - ez;
      this.aabb.max.x = p.x + ex; this.aabb.max.y = p.y + ey; this.aabb.max.z = p.z + ez;
    }
  }

  class Body {
    constructor(def = {}) {
      this.id = ++bodyCounter;
      this.type = def.type || 'dynamic'; // 'dynamic' | 'static'
      this.name = def.name || '';
      this.material = def.material || MATERIALS.wood;
      this.position = vcopy(def.position || v3());
      this.quaternion = qnormalize(def.quaternion || quat());
      this.velocity = vcopy(def.velocity || v3());
      this.angularVelocity = vcopy(def.angularVelocity || v3());
      this.force = v3();
      this.torque = v3();
      this.linearDamping = def.linearDamping ?? 0;
      this.angularDamping = def.angularDamping ?? 0.01;
      this.gravityScale = def.gravityScale ?? 1;
      this.dragScale = def.dragScale ?? 1;
      this.canSleep = def.canSleep ?? true;
      this.sleeping = false;
      this.sleepTime = 0;
      this.islandId = 0;
      this.userData = def.userData || {};
      this.world = null;
      this.R = m3fromQuat(this.quaternion);
      this.Rc = this.R;
      this.invIW = M3_ZERO.slice();
      this.aabb = { min: v3(), max: v3() };
      this.comLocal = v3();
      this.shapes = [];
      this._wokeAt = -1;
      this._lastGood = null;
      this._setShapes(def.shapes || [], def.density);
    }

    _setShapes(defs, density) {
      const shapes = [];
      let mass = 0, volume = 0, cx = 0, cy = 0, cz = 0;
      for (const d of defs) {
        const s = new Shape(this, d);
        const rho = d.density ?? density ?? s.material.density;
        s.mass = s.ghost ? 0 : d.mass ?? rho * s.volume;
        mass += s.mass;
        volume += s.volume;
        cx += s.offset.x * s.mass;
        cy += s.offset.y * s.mass;
        cz += s.offset.z * s.mass;
        shapes.push(s);
      }
      this.shapes = shapes;
      this.volume = volume;
      const dynamic = this.type === 'dynamic' && mass > 0;
      if (dynamic) {
        const com = v3(cx / mass, cy / mass, cz / mass);
        for (const s of shapes) s.offset = vsub(s.offset, com);
        this.position = vadd(this.position, m3mulv(this.R, com));
        this.comLocal = com;
      }
      let I = M3_ZERO.slice();
      for (const s of shapes) {
        if (s.type === 'plane' || s.ghost) continue;
        let Is = s.inertia(s.mass);
        if (s.localR) Is = m3rotate(s.localR, Is);
        const o = s.offset, o2 = vlen2(o), m = s.mass;
        Is[0] += m * (o2 - o.x * o.x); Is[1] -= m * o.x * o.y; Is[2] -= m * o.x * o.z;
        Is[3] -= m * o.y * o.x; Is[4] += m * (o2 - o.y * o.y); Is[5] -= m * o.y * o.z;
        Is[6] -= m * o.z * o.x; Is[7] -= m * o.z * o.y; Is[8] += m * (o2 - o.z * o.z);
        I = m3add(I, Is);
      }
      this.mass = mass;
      if (dynamic) {
        this.invMass = 1 / mass;
        this.inertia = I;
        this.invInertia = m3inverse(I);
        const tr = (I[0] + I[4] + I[8]) / 3;
        const off = Math.abs(I[1]) + Math.abs(I[2]) + Math.abs(I[5]);
        this.isotropic = Math.abs(I[0] - tr) + Math.abs(I[4] - tr) + Math.abs(I[8] - tr) + off < 1e-6 * tr;
      } else {
        this.invMass = 0;
        this.inertia = M3_ZERO.slice();
        this.invInertia = M3_ZERO.slice();
        this.isotropic = true;
        this.velocity = v3();
        this.angularVelocity = v3();
      }
      let br = 0;
      for (const s of shapes) if (s.type !== 'plane') br = Math.max(br, vlen(s.offset) + s.bound);
      this.boundingRadius = br;
      this.hasPlane = shapes.some((s) => s.type === 'plane');
      this.updateTransform();
      this.updateInertia();
    }

    get isDynamic() { return this.invMass > 0; }

    updateTransform() {
      this.R = m3fromQuat(this.quaternion);
      this.Rc = this.R;
      const a = this.aabb;
      a.min.x = a.min.y = a.min.z = Infinity;
      a.max.x = a.max.y = a.max.z = -Infinity;
      for (const s of this.shapes) {
        s.updateWorld(this);
        const b = s.aabb;
        if (b.min.x < a.min.x) a.min.x = b.min.x;
        if (b.min.y < a.min.y) a.min.y = b.min.y;
        if (b.min.z < a.min.z) a.min.z = b.min.z;
        if (b.max.x > a.max.x) a.max.x = b.max.x;
        if (b.max.y > a.max.y) a.max.y = b.max.y;
        if (b.max.z > a.max.z) a.max.z = b.max.z;
      }
      if (!this.shapes.length) {
        a.min = vcopy(this.position);
        a.max = vcopy(this.position);
      }
    }

    updateInertia() {
      this.invIW = this.invMass > 0 ? m3rotate(this.R, this.invInertia) : M3_ZERO.slice();
    }

    toLocal(p) { return m3tmulv(this.R, vsub(p, this.position)); }
    toWorld(l) { return vadd(this.position, m3mulv(this.R, l)); }

    velocityAt(p) {
      return vadd(this.velocity, vcross(this.angularVelocity, vsub(p, this.position)));
    }

    // Largest speed of any point on the body (used for sleep and margins)
    speedBound() {
      return vlen(this.velocity) + vlen(this.angularVelocity) * this.boundingRadius;
    }

    kineticEnergy() {
      if (!this.invMass) return 0;
      const w = this.angularVelocity;
      const Iw = m3mulv(m3rotate(this.R, this.inertia), w);
      return 0.5 * this.mass * vlen2(this.velocity) + 0.5 * vdot(w, Iw);
    }

    angularMomentum() {
      return m3mulv(m3rotate(this.R, this.inertia), this.angularVelocity);
    }

    setPosition(p) {
      this.position = vcopy(p);
      this.updateTransform();
      this.wake();
    }

    setQuaternion(q) {
      this.quaternion = qnormalize(q);
      this.updateTransform();
      this.updateInertia();
      this.wake();
    }

    setVelocity(v) { this.velocity = vcopy(v); this.wake(); }
    setAngularVelocity(w) { this.angularVelocity = vcopy(w); this.wake(); }

    applyImpulse(J, point) {
      if (!this.invMass) return;
      this.velocity = vmad(this.velocity, J, this.invMass);
      if (point) {
        const r = vsub(point, this.position);
        this.angularVelocity = vadd(this.angularVelocity, m3mulv(this.invIW, vcross(r, J)));
      }
      this.wake();
    }

    applyForce(F, point) {
      this.force = vadd(this.force, F);
      if (point) this.torque = vadd(this.torque, vcross(vsub(point, this.position), F));
    }

    wake() {
      if (this.world) this.world.wakeBody(this);
      else this.sleeping = false;
      this.sleepTime = 0;
    }
  }

  // ---------------------------------------------------------------------------
  // Narrow phase. Every routine returns { normal, points: [{p, s, id}] } with
  // the normal pointing from the first shape to the second, p the midpoint
  // between the two surfaces and s the signed separation (negative = overlap).
  // ---------------------------------------------------------------------------

  function collideSpheres(a, b, margin) {
    const d = vsub(b.wpos, a.wpos);
    const rs = a.radius + b.radius;
    const d2 = vlen2(d);
    if (d2 > (rs + margin) * (rs + margin)) return null;
    const dist = Math.sqrt(d2);
    const n = dist > 1e-9 ? vscale(d, 1 / dist) : v3(0, 1, 0);
    const s = dist - rs;
    const pA = vmad(a.wpos, n, a.radius);
    const pB = vmad(b.wpos, n, -b.radius);
    return { normal: n, points: [{ p: vlerp(pA, pB, 0.5), s, id: 0 }] };
  }

  function collidePlaneSphere(pl, sp, margin) {
    const n = pl.wN;
    const s = vdot(n, sp.wpos) - pl.wD - sp.radius;
    if (s > margin) return null;
    const deep = vmad(sp.wpos, n, -sp.radius);
    return { normal: vcopy(n), points: [{ p: vmad(deep, n, -0.5 * s), s, id: 0 }] };
  }

  function boxVertex(bx, i) {
    const R = bx.wR, h = bx.half, c = bx.wpos;
    const lx = (i & 1 ? 1 : -1) * h.x, ly = (i & 2 ? 1 : -1) * h.y, lz = (i & 4 ? 1 : -1) * h.z;
    return {
      x: c.x + R[0] * lx + R[1] * ly + R[2] * lz,
      y: c.y + R[3] * lx + R[4] * ly + R[5] * lz,
      z: c.z + R[6] * lx + R[7] * ly + R[8] * lz,
    };
  }

  function collidePlaneBox(pl, bx, margin) {
    const n = pl.wN;
    const pts = [];
    let smin = Infinity;
    for (let i = 0; i < 8; i++) {
      const p = boxVertex(bx, i);
      const s = vdot(n, p) - pl.wD;
      if (s <= margin) {
        pts.push({ p: vmad(p, n, -0.5 * s), s, id: i });
        if (s < smin) smin = s;
      }
    }
    if (!pts.length) return null;
    // A fast thin box can bring its far face inside the speculative margin.
    // Drop vertices well above the lowest one so the manifold keeps the
    // face that will actually land.
    let kept = pts;
    if (pts.length > 4) {
      const h = bx.half;
      const cut = smin + Math.min(h.x, h.y, h.z);
      kept = pts.filter((q) => q.s <= cut);
    }
    return { normal: vcopy(n), points: reducePoints(kept) };
  }

  // Box is first, sphere second; normal points from box to sphere.
  function collideBoxSphere(bx, sp, margin) {
    const R = bx.wR, h = bx.half, r = sp.radius;
    const d = vsub(sp.wpos, bx.wpos);
    const lx = R[0] * d.x + R[3] * d.y + R[6] * d.z;
    const ly = R[1] * d.x + R[4] * d.y + R[7] * d.z;
    const lz = R[2] * d.x + R[5] * d.y + R[8] * d.z;
    const qx = clamp(lx, -h.x, h.x), qy = clamp(ly, -h.y, h.y), qz = clamp(lz, -h.z, h.z);
    const dx = lx - qx, dy = ly - qy, dz = lz - qz;
    const dist2 = dx * dx + dy * dy + dz * dz;
    let nl, s;
    let sx = qx, sy = qy, sz = qz;
    if (dist2 > 1e-14) {
      const dist = Math.sqrt(dist2);
      s = dist - r;
      if (s > margin) return null;
      nl = v3(dx / dist, dy / dist, dz / dist);
    } else {
      // Centre is inside the box: leave through the nearest face.
      const ex = h.x - Math.abs(lx), ey = h.y - Math.abs(ly), ez = h.z - Math.abs(lz);
      if (ex <= ey && ex <= ez) {
        nl = v3(lx >= 0 ? 1 : -1, 0, 0); sx = nl.x * h.x; s = -ex - r;
      } else if (ey <= ez) {
        nl = v3(0, ly >= 0 ? 1 : -1, 0); sy = nl.y * h.y; s = -ey - r;
      } else {
        nl = v3(0, 0, lz >= 0 ? 1 : -1); sz = nl.z * h.z; s = -ez - r;
      }
    }
    const n = m3mulv(R, nl);
    const surf = vadd(bx.wpos, m3mulv(R, v3(sx, sy, sz)));
    const deep = vmad(sp.wpos, n, -r);
    return { normal: n, points: [{ p: vlerp(surf, deep, 0.5), s, id: 0 }] };
  }

  function clipPoly(poly, m, o) {
    const out = [];
    const n = poly.length;
    for (let i = 0; i < n; i++) {
      const a = poly[i], b = poly[(i + 1) % n];
      const da = vdot(m, a.p) - o, db = vdot(m, b.p) - o;
      if (da <= 0) out.push(a);
      if ((da <= 0) !== (db <= 0)) {
        const t = da / (da - db);
        out.push({ p: vlerp(a.p, b.p, t), id: a.id * 8 + b.id + 64 });
      }
    }
    return out;
  }

  // Keep at most four points: deepest, farthest from it, then the two that
  // span the largest area.
  function reducePoints(pts) {
    if (pts.length <= 4) return pts;
    let i0 = 0;
    for (let i = 1; i < pts.length; i++) if (pts[i].s < pts[i0].s) i0 = i;
    const p0 = pts[i0].p;
    let i1 = -1, best = -1;
    for (let i = 0; i < pts.length; i++) {
      if (i === i0) continue;
      const d2 = vlen2(vsub(pts[i].p, p0));
      if (d2 > best) { best = d2; i1 = i; }
    }
    const p1 = pts[i1].p;
    let i2 = -1, triN = null;
    best = -1;
    for (let i = 0; i < pts.length; i++) {
      if (i === i0 || i === i1) continue;
      const c = vcross(vsub(p1, p0), vsub(pts[i].p, p0));
      const a = vlen2(c);
      if (a > best) { best = a; i2 = i; triN = c; }
    }
    const p2 = pts[i2].p;
    let i3 = -1;
    best = 1e-12;
    for (let i = 0; i < pts.length; i++) {
      if (i === i0 || i === i1 || i === i2) continue;
      const q = pts[i].p;
      const a01 = vdot(vcross(vsub(p1, p0), vsub(q, p0)), triN);
      const a12 = vdot(vcross(vsub(p2, p1), vsub(q, p1)), triN);
      const a20 = vdot(vcross(vsub(p0, p2), vsub(q, p2)), triN);
      const outside = -Math.min(a01, a12, a20);
      if (outside > best) { best = outside; i3 = i; }
    }
    const out = [pts[i0], pts[i1], pts[i2]];
    if (i3 >= 0) out.push(pts[i3]);
    return out;
  }

  const boxAxes = (R) => [
    { x: R[0], y: R[3], z: R[6] },
    { x: R[1], y: R[4], z: R[7] },
    { x: R[2], y: R[5], z: R[8] },
  ];

  function collideBoxes(A, B, margin) {
    const aAx = boxAxes(A.wR), bAx = boxAxes(B.wR);
    const hA = [A.half.x, A.half.y, A.half.z], hB = [B.half.x, B.half.y, B.half.z];
    const d = vsub(B.wpos, A.wpos);
    const C = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
    const absC = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        C[i][j] = vdot(aAx[i], bAx[j]);
        absC[i][j] = Math.abs(C[i][j]) + 1e-9;
      }
    }
    const dA = [vdot(d, aAx[0]), vdot(d, aAx[1]), vdot(d, aAx[2])];
    const dB = [vdot(d, bAx[0]), vdot(d, bAx[1]), vdot(d, bAx[2])];

    let sepA = -Infinity, idxA = 0;
    for (let i = 0; i < 3; i++) {
      const rB = hB[0] * absC[i][0] + hB[1] * absC[i][1] + hB[2] * absC[i][2];
      const s = Math.abs(dA[i]) - hA[i] - rB;
      if (s > margin) return null;
      if (s > sepA) { sepA = s; idxA = i; }
    }
    let sepB = -Infinity, idxB = 0;
    for (let j = 0; j < 3; j++) {
      const rA = hA[0] * absC[0][j] + hA[1] * absC[1][j] + hA[2] * absC[2][j];
      const s = Math.abs(dB[j]) - hB[j] - rA;
      if (s > margin) return null;
      if (s > sepB) { sepB = s; idxB = j; }
    }
    let sepE = -Infinity, eI = -1, eJ = -1, eAxis = null;
    for (let i = 0; i < 3; i++) {
      const i1 = (i + 1) % 3, i2 = (i + 2) % 3;
      for (let j = 0; j < 3; j++) {
        const j1 = (j + 1) % 3, j2 = (j + 2) % 3;
        const axis = vcross(aAx[i], bAx[j]);
        const L = vlen(axis);
        if (L < 1e-4) continue; // parallel edges are covered by the face axes
        const rA = hA[i1] * absC[i2][j] + hA[i2] * absC[i1][j];
        const rB = hB[j1] * absC[i][j2] + hB[j2] * absC[i][j1];
        const s = (Math.abs(vdot(d, axis)) - rA - rB) / L;
        if (s > margin) return null;
        if (s > sepE) { sepE = s; eI = i; eJ = j; eAxis = vscale(axis, 1 / L); }
      }
    }

    // Prefer faces (stable 4-point manifolds) unless an edge pair is
    // clearly the axis of least penetration.
    const useB = sepB > sepA + 0.001;
    const faceSep = useB ? sepB : sepA;
    if (eAxis && sepE > faceSep + 0.002 + 0.02 * Math.abs(faceSep)) {
      return edgeContact(A, B, aAx, bAx, hA, hB, eI, eJ, eAxis, d);
    }
    if (!useB) return faceContact(A, B, aAx, bAx, hA, hB, idxA, dA[idxA] >= 0 ? 1 : -1, margin, false);
    return faceContact(B, A, bAx, aAx, hB, hA, idxB, dB[idxB] >= 0 ? -1 : 1, margin, true);
  }

  // R is the box owning the reference face, I the incident box.
  function faceContact(R, I, rAx, iAx, hR, hI, axis, sign, margin, flip) {
    const n = vscale(rAx[axis], sign); // reference normal, from R toward I
    let inc = 0, incSign = 1, minDot = Infinity;
    for (let j = 0; j < 3; j++) {
      const dj = vdot(iAx[j], n);
      if (dj < minDot) { minDot = dj; inc = j; incSign = 1; }
      if (-dj < minDot) { minDot = -dj; inc = j; incSign = -1; }
    }
    const fc = vmad(I.wpos, iAx[inc], incSign * hI[inc]);
    const u = iAx[(inc + 1) % 3], w = iAx[(inc + 2) % 3];
    const hu = hI[(inc + 1) % 3], hw = hI[(inc + 2) % 3];
    let poly = [
      { p: vmad(vmad(fc, u, hu), w, hw), id: 0 },
      { p: vmad(vmad(fc, u, -hu), w, hw), id: 1 },
      { p: vmad(vmad(fc, u, -hu), w, -hw), id: 2 },
      { p: vmad(vmad(fc, u, hu), w, -hw), id: 3 },
    ];
    const s1 = rAx[(axis + 1) % 3], s2 = rAx[(axis + 2) % 3];
    const e1 = hR[(axis + 1) % 3], e2 = hR[(axis + 2) % 3];
    const c1 = vdot(R.wpos, s1), c2 = vdot(R.wpos, s2);
    poly = clipPoly(poly, s1, c1 + e1);
    if (poly.length) poly = clipPoly(poly, vneg(s1), -c1 + e1);
    if (poly.length) poly = clipPoly(poly, s2, c2 + e2);
    if (poly.length) poly = clipPoly(poly, vneg(s2), -c2 + e2);
    const refD = vdot(n, R.wpos) + hR[axis];
    const pts = [];
    for (const q of poly) {
      const s = vdot(n, q.p) - refD;
      if (s > margin) continue;
      pts.push({ p: vmad(q.p, n, -0.5 * s), s, id: q.id });
    }
    if (!pts.length) return null;
    return { normal: flip ? vneg(n) : n, points: reducePoints(pts) };
  }

  function edgeContact(A, B, aAx, bAx, hA, hB, i, j, axis, d) {
    const n = vdot(axis, d) < 0 ? vneg(axis) : axis;
    let pA = vcopy(A.wpos);
    for (let k = 0; k < 3; k++) if (k !== i) pA = vmad(pA, aAx[k], (vdot(aAx[k], n) > 0 ? 1 : -1) * hA[k]);
    let pB = vcopy(B.wpos);
    for (let k = 0; k < 3; k++) if (k !== j) pB = vmad(pB, bAx[k], (vdot(bAx[k], n) > 0 ? -1 : 1) * hB[k]);
    const da = aAx[i], db = bAx[j];
    const [qA, qB] = closestOnSegments(pA, da, hA[i], pB, db, hB[j]);
    const sep = vdot(vsub(qB, qA), n);
    return { normal: n, points: [{ p: vlerp(qA, qB, 0.5), s: sep, id: 200 + i * 3 + j }] };
  }

  // Closest points between segments p + s*u (|s| <= hu) and q + t*v (|t| <= hv),
  // u and v unit length (after Ericson, Real-Time Collision Detection 5.1.9).
  function closestOnSegments(p, u, hu, q, v, hv) {
    const r = vsub(p, q);
    const b = vdot(u, v), c = vdot(u, r), f = vdot(v, r);
    const denom = 1 - b * b;
    let s = denom > 1e-9 ? clamp((b * f - c) / denom, -hu, hu) : 0;
    let t = f + b * s;
    if (t < -hv || t > hv) {
      t = clamp(t, -hv, hv);
      s = clamp(t * b - c, -hu, hu);
    }
    return [vmad(p, u, s), vmad(q, v, t)];
  }

  function flipResult(r) {
    if (r) r.normal = vneg(r.normal);
    return r;
  }

  function collideShapes(a, b, margin) {
    const ta = a.type, tb = b.type;
    if (ta === 'sphere') {
      if (tb === 'sphere') return collideSpheres(a, b, margin);
      if (tb === 'box') return flipResult(collideBoxSphere(b, a, margin));
      if (tb === 'plane') return flipResult(collidePlaneSphere(b, a, margin));
    } else if (ta === 'box') {
      if (tb === 'box') return collideBoxes(a, b, margin);
      if (tb === 'sphere') return collideBoxSphere(a, b, margin);
      if (tb === 'plane') return flipResult(collidePlaneBox(b, a, margin));
    } else if (ta === 'plane') {
      if (tb === 'sphere') return collidePlaneSphere(a, b, margin);
      if (tb === 'box') return collidePlaneBox(a, b, margin);
    }
    return null;
  }

  // ---------------------------------------------------------------------------
  // Soft constraint coefficients (Catto, "Solver2D", 2024)
  // ---------------------------------------------------------------------------

  function makeSoft(hertz, zeta, h) {
    if (hertz <= 0) return { biasRate: 0, massScale: 1, impulseScale: 0 };
    const omega = 2 * Math.PI * hertz;
    const a1 = 2 * zeta + h * omega;
    const a2 = h * omega * a1;
    const a3 = 1 / (1 + a2);
    return { biasRate: omega / a1, massScale: a2 * a3, impulseScale: a3 };
  }

  // K = (mA + mB) E - [rA] IA^-1 [rA] - [rB] IB^-1 [rB]
  function pointMassMatrix(A, rA, B, rB) {
    let K = [0, 0, 0, 0, 0, 0, 0, 0, 0];
    const m = (A ? A.invMass : 0) + (B ? B.invMass : 0);
    K[0] = K[4] = K[8] = m;
    if (A && A.invMass) {
      const S = m3skew(rA);
      K = m3sub(K, m3mul(m3mul(S, A.invIW), S));
    }
    if (B && B.invMass) {
      const S = m3skew(rB);
      K = m3sub(K, m3mul(m3mul(S, B.invIW), S));
    }
    return K;
  }

  function applyPairImpulse(A, B, rA, rB, P) {
    if (A.invMass) {
      A.velocity = vmad(A.velocity, P, -A.invMass);
      A.angularVelocity = vsub(A.angularVelocity, m3mulv(A.invIW, vcross(rA, P)));
    }
    if (B.invMass) {
      B.velocity = vmad(B.velocity, P, B.invMass);
      B.angularVelocity = vadd(B.angularVelocity, m3mulv(B.invIW, vcross(rB, P)));
    }
  }

  const relVel = (A, B, rA, rB) =>
    vsub(vadd(B.velocity, vcross(B.angularVelocity, rB)), vadd(A.velocity, vcross(A.angularVelocity, rA)));

  // ---------------------------------------------------------------------------
  // Joints
  // ---------------------------------------------------------------------------

  class BallJoint {
    // Pins a point of bodyA to a point of bodyB (world anchor given once).
    constructor(bodyA, bodyB, anchor, opts = {}) {
      this.kind = 'ball';
      this.bodyA = bodyA;
      this.bodyB = bodyB;
      this.localA = bodyA.toLocal(anchor);
      this.localB = bodyB.toLocal(anchor);
      this.impulse = v3();
      this.collideConnected = !!opts.collideConnected;
      this.userData = opts.userData || {};
    }
    anchors() {
      return [vadd(this.bodyA.position, m3mulv(this.bodyA.Rc, this.localA)), vadd(this.bodyB.position, m3mulv(this.bodyB.Rc, this.localB))];
    }
    prepare(world) { this.soft = world._jointSoft; }
    warmStart() {
      const A = this.bodyA, B = this.bodyB;
      applyPairImpulse(A, B, m3mulv(A.Rc, this.localA), m3mulv(B.Rc, this.localB), this.impulse);
    }
    solve(useBias) {
      const A = this.bodyA, B = this.bodyB;
      const rA = m3mulv(A.Rc, this.localA), rB = m3mulv(B.Rc, this.localB);
      const dv = relVel(A, B, rA, rB);
      let ms = 1, is = 0, bias = v3();
      if (useBias) {
        const C = vsub(vadd(B.position, rB), vadd(A.position, rA));
        bias = vscale(C, this.soft.biasRate);
        ms = this.soft.massScale;
        is = this.soft.impulseScale;
      }
      const Kinv = m3inverse(pointMassMatrix(A, rA, B, rB));
      const imp = vsub(vscale(m3mulv(Kinv, vadd(dv, bias)), -ms), vscale(this.impulse, is));
      this.impulse = vadd(this.impulse, imp);
      applyPairImpulse(A, B, rA, rB, imp);
    }
  }

  class DistanceJoint {
    // mode: 'rod' (fixed length), 'rope' (max length), 'spring' (Hooke's law,
    // stiffness in N/m, damping in N*s/m) or 'bungee' (spring that only pulls)
    constructor(bodyA, bodyB, anchorA, anchorB, opts = {}) {
      this.kind = 'distance';
      this.bodyA = bodyA;
      this.bodyB = bodyB;
      this.localA = bodyA.toLocal(anchorA);
      this.localB = bodyB.toLocal(anchorB);
      this.length = opts.length ?? vlen(vsub(anchorB, anchorA));
      this.mode = opts.mode || 'rod';
      this.stiffness = opts.stiffness ?? 0;
      this.damping = opts.damping ?? 0;
      this.impulse = 0;
      this.collideConnected = !!opts.collideConnected;
      this.userData = opts.userData || {};
      this.tension = 0;
    }
    anchors() {
      return [vadd(this.bodyA.position, m3mulv(this.bodyA.Rc, this.localA)), vadd(this.bodyB.position, m3mulv(this.bodyB.Rc, this.localB))];
    }
    prepare(world, h) {
      this.soft = world._jointSoft;
      this.h = h;
    }
    _frame() {
      const A = this.bodyA, B = this.bodyB;
      const rA = m3mulv(A.Rc, this.localA), rB = m3mulv(B.Rc, this.localB);
      const d = vsub(vadd(B.position, rB), vadd(A.position, rA));
      const L = vlen(d);
      const u = L > 1e-9 ? vscale(d, 1 / L) : v3(0, 1, 0);
      const crA = vcross(rA, u), crB = vcross(rB, u);
      const k = A.invMass + B.invMass + vdot(crA, m3mulv(A.invIW, crA)) + vdot(crB, m3mulv(B.invIW, crB));
      return { rA, rB, L, u, k };
    }
    warmStart() {
      if (!this.impulse) return;
      const f = this._frame();
      applyPairImpulse(this.bodyA, this.bodyB, f.rA, f.rB, vscale(f.u, this.impulse));
    }
    solve(useBias, inv_h) {
      const A = this.bodyA, B = this.bodyB;
      const f = this._frame();
      if (f.k <= 0) return;
      const mass = 1 / f.k;
      const vr = vdot(f.u, relVel(A, B, f.rA, f.rB));
      const C = f.L - this.length;
      let impulse;
      if (this.mode === 'spring' || this.mode === 'bungee') {
        if (this.mode === 'bungee' && C <= 0) {
          // slack cord: release whatever the warm start applied
          if (this.impulse) applyPairImpulse(A, B, f.rA, f.rB, vscale(f.u, -this.impulse));
          this.impulse = 0;
          this.tension = 0;
          return;
        }
        // Convert physical stiffness/damping to soft-constraint coefficients
        const meff = mass;
        const omega = Math.sqrt(this.stiffness / meff);
        const zeta = this.damping / (2 * Math.sqrt(this.stiffness * meff));
        const s = makeSoft(omega / (2 * Math.PI), zeta, this.h);
        impulse = -s.massScale * mass * (vr + s.biasRate * C) - s.impulseScale * this.impulse;
        let next = this.impulse + impulse;
        if (this.mode === 'bungee') next = Math.min(next, 0);
        impulse = next - this.impulse;
        this.impulse = next;
      } else if (this.mode === 'rope') {
        // upper limit only: C_u = length - L >= 0
        const Cu = -C;
        let bias = 0, ms = 1, is = 0;
        if (Cu > 0) bias = Cu * inv_h;
        else if (useBias) { bias = this.soft.biasRate * Cu; ms = this.soft.massScale; is = this.soft.impulseScale; }
        const lim = -this.impulse; // stored as a pulling (negative) impulse
        let li = -ms * mass * (-vr + bias) - is * lim;
        const next = Math.max(0, lim + li);
        li = next - lim;
        this.impulse = -next;
        impulse = -li;
      } else {
        let bias = 0, ms = 1, is = 0;
        if (useBias) { bias = this.soft.biasRate * C; ms = this.soft.massScale; is = this.soft.impulseScale; }
        impulse = -ms * mass * (vr + bias) - is * this.impulse;
        this.impulse += impulse;
      }
      applyPairImpulse(A, B, f.rA, f.rB, vscale(f.u, impulse));
      this.tension = -this.impulse / (this.h || 1);
    }
  }

  class GrabJoint {
    // A soft spring that drags a point on a body toward a moving target.
    constructor(world, body, point, opts = {}) {
      this.kind = 'grab';
      this.bodyA = world.ground;
      this.bodyB = body;
      this.localB = body.toLocal(point);
      this.target = vcopy(point);
      this.hertz = opts.hertz ?? 3.5;
      this.dampingRatio = opts.dampingRatio ?? 0.9;
      this.maxForce = opts.maxForce ?? body.mass * 60 + 200;
      this.angularDrag = opts.angularDrag ?? 4;
      this.impulse = v3();
      this.collideConnected = true;
      this.userData = {};
    }
    anchors() {
      return [vcopy(this.target), vadd(this.bodyB.position, m3mulv(this.bodyB.Rc, this.localB))];
    }
    prepare(world, h) {
      this.soft = makeSoft(this.hertz, this.dampingRatio, h);
      this.maxImpulse = this.maxForce * h;
      this.h = h;
    }
    warmStart() {
      const B = this.bodyB;
      const rB = m3mulv(B.Rc, this.localB);
      B.velocity = vmad(B.velocity, this.impulse, B.invMass);
      B.angularVelocity = vadd(B.angularVelocity, m3mulv(B.invIW, vcross(rB, this.impulse)));
    }
    solve() {
      const B = this.bodyB;
      const rB = m3mulv(B.Rc, this.localB);
      const C = vsub(vadd(B.position, rB), this.target);
      const Cdot = vadd(B.velocity, vcross(B.angularVelocity, rB));
      const Kinv = m3inverse(pointMassMatrix(null, null, B, rB));
      const s = this.soft;
      let imp = vsub(vscale(m3mulv(Kinv, vmad(Cdot, C, s.biasRate)), -s.massScale), vscale(this.impulse, s.impulseScale));
      const old = this.impulse;
      let next = vadd(old, imp);
      const L = vlen(next);
      if (L > this.maxImpulse) next = vscale(next, this.maxImpulse / L);
      imp = vsub(next, old);
      this.impulse = next;
      B.velocity = vmad(B.velocity, imp, B.invMass);
      B.angularVelocity = vadd(B.angularVelocity, m3mulv(B.invIW, vcross(rB, imp)));
      B.angularVelocity = vscale(B.angularVelocity, 1 / (1 + this.h * this.angularDrag));
    }
  }

  // ---------------------------------------------------------------------------
  // World
  // ---------------------------------------------------------------------------

  class World {
    constructor(opts = {}) {
      this.gravity = vcopy(opts.gravity || v3(0, -9.80665, 0));
      this.substeps = opts.substeps ?? 4;
      this.airDensity = opts.airDensity ?? 1.225; // ambient fluid, kg/m^3
      this.wind = v3();
      this.fluids = []; // water volumes: {min, max, density}
      this.bodies = [];
      this.joints = [];
      this.manifolds = new Map();
      this.contactHertz = 60;
      this.contactDampingRatio = 10;
      this.contactPushMaxVelocity = 3;
      this.jointHertz = 60;
      this.jointDampingRatio = 5;
      this.restitutionThreshold = 0.2;
      this.alternateOrder = true;
      this.baseMargin = 0.004;
      this.linearSlop = 0.005;
      this.enableSleep = true;
      this.timeToSleep = 0.5;
      this.sleepThreshold = 0.05;
      this.maxLinearSpeed = 400;
      this.maxAngularSpeed = 400;
      this.enableDrag = true;
      this.enableBuoyancy = true;
      this.time = 0;
      this.stepCount = 0;
      this.impacts = [];
      this.stats = { contacts: 0, points: 0, awake: 0, islands: 0 };
      this._noCollide = new Map();
      this._sleepGroups = new Map();
      this._nextIsland = 1;
      this._bp = [];
      this._planeBodies = [];
      this._active = [];
      this.ground = new Body({ type: 'static', name: 'world' });
      this.ground.world = this;
    }

    // ----- bodies -----------------------------------------------------------

    createBody(def) { return this.addBody(new Body(def)); }

    addBody(b) {
      b.world = this;
      this.bodies.push(b);
      if (b.hasPlane) this._planeBodies.push(b);
      else this._bp.push(b);
      b.updateTransform();
      b.updateInertia();
      return b;
    }

    removeBody(b) {
      const i = this.bodies.indexOf(b);
      if (i < 0) return;
      this.bodies.splice(i, 1);
      const list = b.hasPlane ? this._planeBodies : this._bp;
      const j = list.indexOf(b);
      if (j >= 0) list.splice(j, 1);
      for (const [k, m] of this.manifolds) {
        if (m.bodyA === b || m.bodyB === b) {
          const other = m.bodyA === b ? m.bodyB : m.bodyA;
          if (other.sleeping) this.wakeBody(other);
          this.manifolds.delete(k);
        }
      }
      for (const jn of this.joints.slice()) if (jn.bodyA === b || jn.bodyB === b) this.removeJoint(jn);
      if (b.sleeping) {
        const g = this._sleepGroups.get(b.islandId);
        if (g) {
          const k = g.indexOf(b);
          if (k >= 0) g.splice(k, 1);
        }
      }
      b.world = null;
    }

    clear() {
      for (const b of this.bodies.slice()) this.removeBody(b);
      this.joints = [];
      this.manifolds.clear();
      this._noCollide.clear();
      this._sleepGroups.clear();
      this.fluids = [];
    }

    addPlane(opts = {}) {
      return this.createBody({
        type: 'static',
        name: opts.name || 'ground',
        position: opts.position || v3(0, 0, 0),
        material: opts.material || MATERIALS.ground,
        shapes: [{ type: 'plane', normal: opts.normal || v3(0, 1, 0) }],
      });
    }

    // ----- joints -----------------------------------------------------------

    addJoint(j) {
      this.joints.push(j);
      if (!j.collideConnected) {
        const k = this._pairKey(j.bodyA, j.bodyB);
        this._noCollide.set(k, (this._noCollide.get(k) || 0) + 1);
      }
      this.wakeBody(j.bodyA);
      this.wakeBody(j.bodyB);
      return j;
    }

    removeJoint(j) {
      const i = this.joints.indexOf(j);
      if (i < 0) return;
      this.joints.splice(i, 1);
      if (!j.collideConnected) {
        const k = this._pairKey(j.bodyA, j.bodyB);
        const c = (this._noCollide.get(k) || 1) - 1;
        if (c <= 0) this._noCollide.delete(k);
        else this._noCollide.set(k, c);
      }
      this.wakeBody(j.bodyA);
      this.wakeBody(j.bodyB);
    }

    _pairKey(a, b) { return a.id < b.id ? a.id * 1048576 + b.id : b.id * 1048576 + a.id; }

    // ----- sleeping ---------------------------------------------------------

    wakeBody(b) {
      if (!b) return;
      b.sleepTime = 0;
      if (!b.sleeping) return;
      const group = this._sleepGroups.get(b.islandId);
      const members = group || [b];
      for (const m of members) {
        m.sleeping = false;
        m.sleepTime = 0;
        m._wokeAt = this.stepCount;
      }
      this._sleepGroups.delete(b.islandId);
    }

    wakeAll() { for (const b of this.bodies) this.wakeBody(b); }

    // ----- utilities --------------------------------------------------------

    explode(center, radius = 6, power = 1) {
      const hits = [];
      for (const b of this.bodies) {
        if (!b.invMass) continue;
        const d = vsub(b.position, center);
        const dist = vlen(d);
        if (dist > radius + b.boundingRadius) continue;
        const dir = dist > 1e-6 ? vscale(d, 1 / dist) : v3(0, 1, 0);
        const lift = vnorm(vadd(dir, v3(0, 0.35, 0)));
        const reach = Math.max(0, dist - 0.5 * b.boundingRadius);
        const falloff = Math.max(0, 1 - reach / radius);
        // Blast impulse scales with the area the body presents to the blast.
        const area = Math.PI * b.boundingRadius * b.boundingRadius * 0.6;
        let J = power * 1400 * area * falloff * falloff;
        const dv = J * b.invMass;
        if (dv > 60) J *= 60 / dv;
        const p = vmad(b.position, dir, -0.45 * b.boundingRadius);
        b.applyImpulse(vscale(lift, J), p);
        hits.push(b);
      }
      return hits;
    }

    // ----- stepping ---------------------------------------------------------

    step(dt) {
      if (!(dt > 0)) return;
      const n = Math.max(1, this.substeps | 0);
      const h = dt / n, inv_h = 1 / h;
      this.impacts.length = 0;

      // A joint to an awake body (or a grab) keeps its partner awake.
      for (const j of this.joints) {
        const A = j.bodyA, B = j.bodyB;
        if (!A.sleeping && !B.sleeping) continue;
        if (j.kind === 'grab' || (A.invMass && !A.sleeping) || (B.invMass && !B.sleeping)) {
          this.wakeBody(A);
          this.wakeBody(B);
        }
      }
      for (const b of this.bodies) {
        if (b.invMass > 0 && !b.sleeping) {
          b.updateTransform();
          b.updateInertia();
        }
      }

      // Collision detection can wake sleeping islands, so the moving set is
      // gathered afterwards.
      this._collide(dt);
      const movers = [];
      for (const b of this.bodies) if (b.invMass > 0 && !b.sleeping) movers.push(b);

      const contacts = this._prepareContacts();
      this._jointSoft = makeSoft(this.jointHertz, this.jointDampingRatio, h);
      const joints = [];
      for (const j of this.joints) {
        const A = j.bodyA, B = j.bodyB;
        if (A.sleeping || B.sleeping) continue;
        if (!A.invMass && !B.invMass) continue;
        joints.push(j);
      }
      for (const j of joints) j.prepare(this, h);
      const soft = makeSoft(Math.min(this.contactHertz, 0.25 * inv_h), this.contactDampingRatio, h);
      const staticSoft = makeSoft(Math.min(2 * this.contactHertz, 0.25 * inv_h), this.contactDampingRatio, h);

      for (const b of movers) b._lastGood = { p: vcopy(b.position), q: { ...b.quaternion } };

      for (let i = 0; i < n; i++) {
        this._integrateVelocities(movers, h);
        for (const j of joints) j.warmStart();
        this._warmStart(contacts);
        for (const j of joints) j.solve(true, inv_h);
        this._solveContacts(contacts, true, inv_h, soft, staticSoft);
        this._integratePositions(movers, h);
        for (const j of joints) j.solve(false, inv_h);
        this._solveContacts(contacts, false, inv_h, soft, staticSoft);
      }
      this._restitution(contacts);

      for (const b of movers) {
        const v = b.velocity, w = b.angularVelocity;
        if (!isFiniteVec(b.position) || !isFiniteVec(v) || !isFiniteVec(w) || !Number.isFinite(b.quaternion.w)) {
          // Never let a numerical blow-up poison the scene.
          b.position = b._lastGood.p;
          b.quaternion = b._lastGood.q;
          b.velocity = v3();
          b.angularVelocity = v3();
        }
        const vl = vlen(b.velocity);
        if (vl > this.maxLinearSpeed) b.velocity = vscale(b.velocity, this.maxLinearSpeed / vl);
        const wl = vlen(b.angularVelocity);
        if (wl > this.maxAngularSpeed) b.angularVelocity = vscale(b.angularVelocity, this.maxAngularSpeed / wl);
        b.updateTransform();
        b.updateInertia();
        b.force = v3();
        b.torque = v3();
      }

      this._collectImpacts(contacts);
      this._updateSleep(dt, movers, contacts, joints);
      this.stats.contacts = contacts.length;
      this.stats.points = contacts.reduce((s, m) => s + m.points.length, 0);
      this.stats.awake = movers.length;
      this.time += dt;
      this.stepCount++;
    }

    // ----- collision detection ----------------------------------------------

    _collide(dt) {
      const list = this._bp;
      const half = 0.5 * this.baseMargin;
      for (const b of list) {
        const e = half + (b.invMass > 0 && !b.sleeping ? b.speedBound() * dt : 0);
        b._fat = {
          minx: b.aabb.min.x - e, miny: b.aabb.min.y - e, minz: b.aabb.min.z - e,
          maxx: b.aabb.max.x + e, maxy: b.aabb.max.y + e, maxz: b.aabb.max.z + e,
        };
      }
      // insertion sort keeps the nearly-sorted list cheap frame to frame
      for (let i = 1; i < list.length; i++) {
        const b = list[i];
        const x = b._fat.minx;
        let j = i - 1;
        while (j >= 0 && list[j]._fat.minx > x) { list[j + 1] = list[j]; j--; }
        list[j + 1] = b;
      }
      const fresh = new Map();
      for (let i = 0; i < list.length; i++) {
        const A = list[i], fa = A._fat;
        for (let j = i + 1; j < list.length; j++) {
          const B = list[j], fb = B._fat;
          if (fb.minx > fa.maxx) break;
          if (fb.miny > fa.maxy || fb.maxy < fa.miny || fb.minz > fa.maxz || fb.maxz < fa.minz) continue;
          this._pair(A, B, dt, fresh);
        }
      }
      for (const P of this._planeBodies) {
        for (const B of list) {
          if (!B.invMass || B.sleeping) continue;
          this._pair(P, B, dt, fresh);
        }
      }
      // Dormant pairs keep last frame's manifold so they wake with warm impulses.
      for (const [k, m] of this.manifolds) {
        if (fresh.has(k)) continue;
        const A = m.bodyA, B = m.bodyB;
        const dormA = A.sleeping || !A.invMass || A._wokeAt === this.stepCount;
        const dormB = B.sleeping || !B.invMass || B._wokeAt === this.stepCount;
        if (dormA && dormB && A.world && B.world) fresh.set(k, m);
      }
      this.manifolds = fresh;
    }

    _pair(A, B, dt, fresh) {
      if (!A.invMass && !B.invMass) return;
      const aIdle = A.sleeping || !A.invMass, bIdle = B.sleeping || !B.invMass;
      if (aIdle && bIdle) return;
      if (this._noCollide.size && this._noCollide.has(this._pairKey(A, B))) return;
      const sbA = A.invMass && !A.sleeping ? A.speedBound() : 0;
      const sbB = B.invMass && !B.sleeping ? B.speedBound() : 0;
      const margin = this.baseMargin + (sbA + sbB) * dt;
      for (const sA of A.shapes) {
        if (sA.ghost) continue;
        for (const sB of B.shapes) {
          if (sB.ghost) continue;
          if (sA.type !== 'plane' && sB.type !== 'plane') {
            const a = sA.aabb, b = sB.aabb;
            if (a.min.x > b.max.x + margin || b.min.x > a.max.x + margin ||
                a.min.y > b.max.y + margin || b.min.y > a.max.y + margin ||
                a.min.z > b.max.z + margin || b.min.z > a.max.z + margin) continue;
          } else {
            // plane vs shape: quick reject using the shape AABB
            const pl = sA.type === 'plane' ? sA : sB;
            const o = pl === sA ? sB : sA;
            const nrm = pl.wN, bb = o.aabb;
            const lo = (nrm.x >= 0 ? bb.min.x : bb.max.x) * nrm.x + (nrm.y >= 0 ? bb.min.y : bb.max.y) * nrm.y + (nrm.z >= 0 ? bb.min.z : bb.max.z) * nrm.z;
            if (lo - pl.wD > margin) continue;
          }
          let s1 = sA, s2 = sB;
          if (s1.uid > s2.uid) { s1 = sB; s2 = sA; }
          const res = collideShapes(s1, s2, margin);
          if (!res || !res.points.length) continue;
          const key = s1.uid * 2097152 + s2.uid;
          fresh.set(key, this._updateManifold(key, s1, s2, res, this.manifolds.get(key)));
          const b1 = s1.body, b2 = s2.body;
          if (b1.sleeping || b2.sleeping) {
            const sleeper = b1.sleeping ? b1 : b2;
            const other = sleeper === b1 ? b2 : b1;
            let minS = Infinity;
            for (const p of res.points) if (p.s < minS) minS = p.s;
            const approach = other.speedBound() * dt;
            if (minS < this.linearSlop || approach > minS) this.wakeBody(sleeper);
          }
        }
      }
    }

    _updateManifold(key, sA, sB, res, old) {
      const A = sA.body, B = sB.body;
      const m = old || {
        key, shapeA: sA, shapeB: sB, bodyA: A, bodyB: B,
        normal: res.normal, points: [], rollImpulse: v3(), isNew: true,
      };
      if (old) m.isNew = false;
      const warm = old && vdot(old.normal, res.normal) > 0.95;
      const ext = Math.min(sA.type === 'plane' ? Infinity : sA.bound, sB.type === 'plane' ? Infinity : sB.bound);
      const tol = clamp(0.25 * ext, 0.005, 0.05);
      const tol2 = tol * tol;
      const pts = [];
      for (const rp of res.points) {
        const localA = A.toLocal(rp.p);
        const cp = {
          p: rp.p, s: rp.s, id: rp.id, localA,
          normalImpulse: 0, frictionVec: null, maxNormalImpulse: 0,
        };
        if (warm) {
          let bestD = tol2, best = null;
          for (const op of old.points) {
            if (op._used) continue;
            const dd = vlen2(vsub(op.localA, localA));
            if (dd < bestD) { bestD = dd; best = op; }
          }
          if (best) {
            best._used = true;
            cp.normalImpulse = best.normalImpulse;
            cp.frictionVec = best.frictionVec;
          }
        }
        pts.push(cp);
      }
      m.points = pts;
      m.normal = res.normal;
      if (!warm) m.rollImpulse = v3();
      return m;
    }

    // ----- contact solver ---------------------------------------------------

    _prepareContacts() {
      const out = this._active;
      out.length = 0;
      for (const m of this.manifolds.values()) {
        const A = m.bodyA, B = m.bodyB;
        const aOn = A.invMass > 0 && !A.sleeping, bOn = B.invMass > 0 && !B.sleeping;
        if (!aOn && !bOn) continue;
        if (A.sleeping || B.sleeping) continue;
        const mA = A.invMass, mB = B.invMass, iA = A.invIW, iB = B.invIW;
        const n = m.normal;
        const matA = m.shapeA.material, matB = m.shapeB.material;
        m.friction = Math.sqrt(matA.friction * matB.friction);
        m.restitution = Math.max(matA.restitution, matB.restitution);
        m.isStatic = !mA || !mB;
        const hasSphere = m.shapeA.type === 'sphere' || m.shapeB.type === 'sphere';
        m.rolling = hasSphere ? Math.max(matA.rolling || 0, matB.rolling || 0) : 0;
        if (m.rolling > 0) {
          const ra = m.shapeA.type === 'sphere' ? m.shapeA.radius : Infinity;
          const rb = m.shapeB.type === 'sphere' ? m.shapeB.radius : Infinity;
          m.rollRadius = Math.min(ra, rb);
          const K = m3add(iA, iB);
          m.rollMass = m3inverse(K);
        }
        // friction directions: follow the sliding direction when there is one
        const p0 = m.points[0];
        const dv0 = relVel(A, B, vsub(p0.p, A.position), vsub(p0.p, B.position));
        const vt = vmad(dv0, n, -vdot(dv0, n));
        const vtl = vlen(vt);
        let t1, t2;
        if (vtl > 1e-3) {
          t1 = vscale(vt, 1 / vtl);
          t2 = vcross(n, t1);
        } else {
          [t1, t2] = orthoBasis(n);
        }
        m.t1 = t1;
        m.t2 = t2;
        // How each side's contact point follows its body during the step.
        // Box corners are material points and rotate with the body; on a
        // sphere the contact stays at the bottom while the ball spins, so it
        // only follows the sphere's centre: p = position + Rc*l + d.
        const sphA = m.shapeA.type === 'sphere', sphB = m.shapeB.type === 'sphere';
        for (const cp of m.points) {
          const rA = vsub(cp.p, A.position), rB = vsub(cp.p, B.position);
          cp.rA = rA;
          cp.rB = rB;
          if (sphA) {
            cp.localA = m.shapeA.offset;
            cp.fixedA = vsub(cp.p, m.shapeA.wpos);
          } else {
            cp.localA = m3tmulv(A.R, rA);
            cp.fixedA = ZERO3;
          }
          if (sphB) {
            cp.localB = m.shapeB.offset;
            cp.fixedB = vsub(cp.p, m.shapeB.wpos);
          } else {
            cp.localB = m3tmulv(B.R, rB);
            cp.fixedB = ZERO3;
          }
          cp.baseSeparation = cp.s;
          const rnA = vcross(rA, n), rnB = vcross(rB, n);
          const kN = mA + mB + vdot(rnA, m3mulv(iA, rnA)) + vdot(rnB, m3mulv(iB, rnB));
          cp.normalMass = kN > 0 ? 1 / kN : 0;
          const r1A = vcross(rA, t1), r1B = vcross(rB, t1);
          const k1 = mA + mB + vdot(r1A, m3mulv(iA, r1A)) + vdot(r1B, m3mulv(iB, r1B));
          cp.tangentMass1 = k1 > 0 ? 1 / k1 : 0;
          const r2A = vcross(rA, t2), r2B = vcross(rB, t2);
          const k2 = mA + mB + vdot(r2A, m3mulv(iA, r2A)) + vdot(r2B, m3mulv(iB, r2B));
          cp.tangentMass2 = k2 > 0 ? 1 / k2 : 0;
          cp.relativeVelocity = vdot(n, relVel(A, B, rA, rB));
          cp.maxNormalImpulse = 0;
          cp.tangentImpulse1 = cp.frictionVec ? vdot(cp.frictionVec, t1) : 0;
          cp.tangentImpulse2 = cp.frictionVec ? vdot(cp.frictionVec, t2) : 0;
        }
        out.push(m);
      }
      return out;
    }

    _warmStart(contacts) {
      for (const m of contacts) {
        const A = m.bodyA, B = m.bodyB;
        const n = m.normal, t1 = m.t1, t2 = m.t2;
        for (const cp of m.points) {
          const P = {
            x: n.x * cp.normalImpulse + t1.x * cp.tangentImpulse1 + t2.x * cp.tangentImpulse2,
            y: n.y * cp.normalImpulse + t1.y * cp.tangentImpulse1 + t2.y * cp.tangentImpulse2,
            z: n.z * cp.normalImpulse + t1.z * cp.tangentImpulse1 + t2.z * cp.tangentImpulse2,
          };
          applyPairImpulse(A, B, cp.rA, cp.rB, P);
        }
        if (m.rolling > 0) {
          const L = m.rollImpulse;
          if (A.invMass) A.angularVelocity = vsub(A.angularVelocity, m3mulv(A.invIW, L));
          if (B.invMass) B.angularVelocity = vadd(B.angularVelocity, m3mulv(B.invIW, L));
        }
      }
    }

    _solveContacts(contacts, useBias, inv_h, soft, staticSoft) {
      const pushMax = this.contactPushMaxVelocity;
      for (let c = 0; c < contacts.length; c++) {
        const m = contacts[c];
        const A = m.bodyA, B = m.bodyB;
        const mA = A.invMass, mB = B.invMass;
        const iA = A.invIW, iB = B.invIW;
        let vAx = A.velocity.x, vAy = A.velocity.y, vAz = A.velocity.z;
        let wAx = A.angularVelocity.x, wAy = A.angularVelocity.y, wAz = A.angularVelocity.z;
        let vBx = B.velocity.x, vBy = B.velocity.y, vBz = B.velocity.z;
        let wBx = B.angularVelocity.x, wBy = B.angularVelocity.y, wBz = B.angularVelocity.z;
        const nx = m.normal.x, ny = m.normal.y, nz = m.normal.z;
        const sp = m.isStatic ? staticSoft : soft;
        const RA = A.Rc, RB = B.Rc;
        const pA = A.position, pB = B.position;
        let totalNormal = 0;
        const pts = m.points;
        const np = pts.length;
        // Alternate the sweep direction between the biased and relax passes
        // so the sequential solve does not push the stack one way.
        const rev = !useBias && this.alternateOrder;

        for (let kk = 0; kk < np; kk++) {
          const cp = pts[rev ? np - 1 - kk : kk];
          // current separation from the bodies' current poses
          const la = cp.localA, lb = cp.localB, fa = cp.fixedA, fb = cp.fixedB;
          const ax = pA.x + fa.x + RA[0] * la.x + RA[1] * la.y + RA[2] * la.z;
          const ay = pA.y + fa.y + RA[3] * la.x + RA[4] * la.y + RA[5] * la.z;
          const az = pA.z + fa.z + RA[6] * la.x + RA[7] * la.y + RA[8] * la.z;
          const bx = pB.x + fb.x + RB[0] * lb.x + RB[1] * lb.y + RB[2] * lb.z;
          const by = pB.y + fb.y + RB[3] * lb.x + RB[4] * lb.y + RB[5] * lb.z;
          const bz = pB.z + fb.z + RB[6] * lb.x + RB[7] * lb.y + RB[8] * lb.z;
          const s = (bx - ax) * nx + (by - ay) * ny + (bz - az) * nz + cp.baseSeparation;

          let bias = 0, massScale = 1, impulseScale = 0;
          if (s > 0) {
            bias = s * inv_h; // speculative
          } else if (useBias) {
            bias = Math.max(sp.biasRate * s, -pushMax);
            massScale = sp.massScale;
            impulseScale = sp.impulseScale;
          }
          const rA = cp.rA, rB = cp.rB;
          const dvx = vBx + (wBy * rB.z - wBz * rB.y) - vAx - (wAy * rA.z - wAz * rA.y);
          const dvy = vBy + (wBz * rB.x - wBx * rB.z) - vAy - (wAz * rA.x - wAx * rA.z);
          const dvz = vBz + (wBx * rB.y - wBy * rB.x) - vAz - (wAx * rA.y - wAy * rA.x);
          const vn = dvx * nx + dvy * ny + dvz * nz;
          let impulse = -cp.normalMass * massScale * (vn + bias) - impulseScale * cp.normalImpulse;
          const next = Math.max(cp.normalImpulse + impulse, 0);
          impulse = next - cp.normalImpulse;
          cp.normalImpulse = next;
          if (impulse > cp.maxNormalImpulse) cp.maxNormalImpulse = impulse;
          totalNormal += next;

          const Px = impulse * nx, Py = impulse * ny, Pz = impulse * nz;
          if (mA) {
            vAx -= mA * Px; vAy -= mA * Py; vAz -= mA * Pz;
            const cx = rA.y * Pz - rA.z * Py, cy = rA.z * Px - rA.x * Pz, cz = rA.x * Py - rA.y * Px;
            wAx -= iA[0] * cx + iA[1] * cy + iA[2] * cz;
            wAy -= iA[3] * cx + iA[4] * cy + iA[5] * cz;
            wAz -= iA[6] * cx + iA[7] * cy + iA[8] * cz;
          }
          if (mB) {
            vBx += mB * Px; vBy += mB * Py; vBz += mB * Pz;
            const cx = rB.y * Pz - rB.z * Py, cy = rB.z * Px - rB.x * Pz, cz = rB.x * Py - rB.y * Px;
            wBx += iB[0] * cx + iB[1] * cy + iB[2] * cz;
            wBy += iB[3] * cx + iB[4] * cy + iB[5] * cz;
            wBz += iB[6] * cx + iB[7] * cy + iB[8] * cz;
          }
        }

        // friction (circular Coulomb cone)
        const mu = m.friction;
        const t1 = m.t1, t2 = m.t2;
        for (let kk = 0; kk < np; kk++) {
          const cp = pts[rev ? np - 1 - kk : kk];
          const rA = cp.rA, rB = cp.rB;
          const dvx = vBx + (wBy * rB.z - wBz * rB.y) - vAx - (wAy * rA.z - wAz * rA.y);
          const dvy = vBy + (wBz * rB.x - wBx * rB.z) - vAy - (wAz * rA.x - wAx * rA.z);
          const dvz = vBz + (wBx * rB.y - wBy * rB.x) - vAz - (wAx * rA.y - wAy * rA.x);
          const vt1 = dvx * t1.x + dvy * t1.y + dvz * t1.z;
          const vt2 = dvx * t2.x + dvy * t2.y + dvz * t2.z;
          let l1 = cp.tangentImpulse1 - cp.tangentMass1 * vt1;
          let l2 = cp.tangentImpulse2 - cp.tangentMass2 * vt2;
          const maxF = mu * cp.normalImpulse;
          const mag2 = l1 * l1 + l2 * l2;
          if (mag2 > maxF * maxF) {
            const sc = maxF / Math.sqrt(mag2);
            l1 *= sc;
            l2 *= sc;
          }
          const d1 = l1 - cp.tangentImpulse1, d2 = l2 - cp.tangentImpulse2;
          cp.tangentImpulse1 = l1;
          cp.tangentImpulse2 = l2;
          const Px = t1.x * d1 + t2.x * d2, Py = t1.y * d1 + t2.y * d2, Pz = t1.z * d1 + t2.z * d2;
          if (mA) {
            vAx -= mA * Px; vAy -= mA * Py; vAz -= mA * Pz;
            const cx = rA.y * Pz - rA.z * Py, cy = rA.z * Px - rA.x * Pz, cz = rA.x * Py - rA.y * Px;
            wAx -= iA[0] * cx + iA[1] * cy + iA[2] * cz;
            wAy -= iA[3] * cx + iA[4] * cy + iA[5] * cz;
            wAz -= iA[6] * cx + iA[7] * cy + iA[8] * cz;
          }
          if (mB) {
            vBx += mB * Px; vBy += mB * Py; vBz += mB * Pz;
            const cx = rB.y * Pz - rB.z * Py, cy = rB.z * Px - rB.x * Pz, cz = rB.x * Py - rB.y * Px;
            wBx += iB[0] * cx + iB[1] * cy + iB[2] * cz;
            wBy += iB[3] * cx + iB[4] * cy + iB[5] * cz;
            wBz += iB[6] * cx + iB[7] * cy + iB[8] * cz;
          }
        }

        // rolling resistance: an angular impulse bounded by c_rr * r * N
        if (m.rolling > 0 && totalNormal > 0) {
          const dwx = wBx - wAx, dwy = wBy - wAy, dwz = wBz - wAz;
          const K = m.rollMass;
          const old = m.rollImpulse;
          let lx = old.x - (K[0] * dwx + K[1] * dwy + K[2] * dwz);
          let ly = old.y - (K[3] * dwx + K[4] * dwy + K[5] * dwz);
          let lz = old.z - (K[6] * dwx + K[7] * dwy + K[8] * dwz);
          const maxL = m.rolling * m.rollRadius * totalNormal;
          const l2 = lx * lx + ly * ly + lz * lz;
          if (l2 > maxL * maxL) {
            const sc = maxL / Math.sqrt(l2);
            lx *= sc; ly *= sc; lz *= sc;
          }
          const dx = lx - old.x, dy = ly - old.y, dz = lz - old.z;
          m.rollImpulse = { x: lx, y: ly, z: lz };
          if (mA) {
            wAx -= iA[0] * dx + iA[1] * dy + iA[2] * dz;
            wAy -= iA[3] * dx + iA[4] * dy + iA[5] * dz;
            wAz -= iA[6] * dx + iA[7] * dy + iA[8] * dz;
          }
          if (mB) {
            wBx += iB[0] * dx + iB[1] * dy + iB[2] * dz;
            wBy += iB[3] * dx + iB[4] * dy + iB[5] * dz;
            wBz += iB[6] * dx + iB[7] * dy + iB[8] * dz;
          }
        }

        if (mA) {
          A.velocity = { x: vAx, y: vAy, z: vAz };
          A.angularVelocity = { x: wAx, y: wAy, z: wAz };
        }
        if (mB) {
          B.velocity = { x: vBx, y: vBy, z: vBz };
          B.angularVelocity = { x: wBx, y: wBy, z: wBz };
        }
      }
    }

    _restitution(contacts) {
      const threshold = this.restitutionThreshold;
      for (const m of contacts) {
        if (m.restitution === 0) continue;
        const A = m.bodyA, B = m.bodyB, n = m.normal;
        for (const cp of m.points) {
          if (cp.relativeVelocity > -threshold || cp.maxNormalImpulse === 0) continue;
          const vn = vdot(n, relVel(A, B, cp.rA, cp.rB));
          let impulse = -cp.normalMass * (vn + m.restitution * cp.relativeVelocity);
          const next = Math.max(cp.normalImpulse + impulse, 0);
          impulse = next - cp.normalImpulse;
          cp.normalImpulse = next;
          if (impulse > cp.maxNormalImpulse) cp.maxNormalImpulse = impulse;
          applyPairImpulse(A, B, cp.rA, cp.rB, vscale(n, impulse));
        }
      }
      for (const m of contacts) {
        for (const cp of m.points) {
          cp.frictionVec = vadd(vscale(m.t1, cp.tangentImpulse1), vscale(m.t2, cp.tangentImpulse2));
        }
      }
    }

    // ----- integration ------------------------------------------------------

    _integrateVelocities(movers, h) {
      const g = this.gravity;
      const gmag = vlen(g);
      const up = gmag > 1e-9 ? vscale(g, -1 / gmag) : v3(0, 1, 0);
      for (const b of movers) {
        const im = b.invMass;
        let v = {
          x: b.velocity.x + h * (g.x * b.gravityScale + b.force.x * im),
          y: b.velocity.y + h * (g.y * b.gravityScale + b.force.y * im),
          z: b.velocity.z + h * (g.z * b.gravityScale + b.force.z * im),
        };
        let w = b.angularVelocity;
        // Gyroscopic term, implicit (Catto, GDC 2015): conserves angular
        // momentum for free bodies instead of angular velocity.
        if (!b.isotropic) w = this._gyroscopic(b, w, h);
        w = vadd(w, vscale(m3mulv(b.invIW, b.torque), h));
        b.velocity = v;
        b.angularVelocity = w;
        if (this.enableDrag || this.enableBuoyancy) this._fluidForces(b, h, gmag, up);
        if (b.linearDamping) b.velocity = vscale(b.velocity, 1 / (1 + h * b.linearDamping));
        if (b.angularDamping) b.angularVelocity = vscale(b.angularVelocity, 1 / (1 + h * b.angularDamping));
      }
    }

    // Euler's equations I dw/dt + w x Iw = 0 in body coordinates, solved with
    // the implicit midpoint rule (two Newton steps). Midpoint keeps both the
    // kinetic energy and |L| of a free body, so a spinning T-handle keeps
    // flipping instead of slowly winding down.
    _gyroscopic(b, w, h) {
      const R = b.Rc;
      const I = b.inertia;
      const w1 = m3tmulv(R, w);
      let w2 = w1;
      for (let k = 0; k < 2; k++) {
        const wm = vscale(vadd(w1, w2), 0.5);
        const Iwm = m3mulv(I, wm);
        const g = vadd(m3mulv(I, vsub(w2, w1)), vscale(vcross(wm, Iwm), h));
        const J = m3add(I, m3scale(m3sub(m3mul(m3skew(wm), I), m3skew(Iwm)), 0.5 * h));
        w2 = vsub(w2, m3mulv(m3inverse(J), g));
      }
      return m3mulv(R, w2);
    }

    // Submerged volume and centre of buoyancy of one shape in one water volume
    _submerged(b, s, fl, out) {
      const R = b.Rc;
      const c = vadd(b.position, m3mulv(R, s.offset));
      const top = fl.max.y;
      if (s.type === 'sphere') {
        const r = s.radius;
        if (c.x < fl.min.x || c.x > fl.max.x || c.z < fl.min.z || c.z > fl.max.z) return;
        const depth = clamp(top - (c.y - r), 0, 2 * r);
        if (depth <= 0) return;
        const V = (Math.PI * depth * depth * (3 * r - depth)) / 3;
        out.push({ p: c, V });
        return;
      }
      if (s.type !== 'box') return;
      const SR = s.localR ? m3mul(R, s.localR) : R;
      const h = s.half;
      const N = 3;
      const cellV = s.volume / (N * N * N);
      const ey = (Math.abs(SR[3]) * h.x + Math.abs(SR[4]) * h.y + Math.abs(SR[5]) * h.z) / N;
      for (let i = 0; i < N; i++) {
        const lx = h.x * ((2 * i + 1) / N - 1);
        for (let j = 0; j < N; j++) {
          const ly = h.y * ((2 * j + 1) / N - 1);
          for (let k = 0; k < N; k++) {
            const lz = h.z * ((2 * k + 1) / N - 1);
            const p = {
              x: c.x + SR[0] * lx + SR[1] * ly + SR[2] * lz,
              y: c.y + SR[3] * lx + SR[4] * ly + SR[5] * lz,
              z: c.z + SR[6] * lx + SR[7] * ly + SR[8] * lz,
            };
            if (p.x < fl.min.x || p.x > fl.max.x || p.z < fl.min.z || p.z > fl.max.z || p.y < fl.min.y - ey) continue;
            const frac = clamp((top - p.y) / (2 * ey) + 0.5, 0, 1);
            if (frac > 0) out.push({ p, V: cellV * frac });
          }
        }
      }
    }

    _fluidForces(b, h, gmag, up) {
      const rhoAir = this.airDensity;
      let vSub = 0;
      let rhoSub = rhoAir;
      let dv = v3(), dw = v3();
      // Archimedes in the ambient fluid (matters for balloons, Venus, the sea)
      if (this.enableBuoyancy && rhoAir > 0 && gmag > 0) {
        dv = vmad(dv, up, rhoAir * b.volume * gmag * b.invMass * h);
      }
      if (this.fluids.length && b.volume > 0) {
        const a = b.aabb;
        for (const fl of this.fluids) {
          if (a.max.x < fl.min.x || a.min.x > fl.max.x || a.max.z < fl.min.z || a.min.z > fl.max.z ||
              a.min.y > fl.max.y || a.max.y < fl.min.y) continue;
          const parts = [];
          for (const s of b.shapes) this._submerged(b, s, fl, parts);
          if (!parts.length) continue;
          const extra = fl.density - rhoAir;
          rhoSub = fl.density;
          for (const q of parts) {
            vSub += q.V;
            if (!this.enableBuoyancy || gmag <= 0) continue;
            const F = extra * q.V * gmag;
            const Fv = vscale(up, F);
            dv = vmad(dv, Fv, b.invMass * h);
            dw = vadd(dw, vscale(m3mulv(b.invIW, vcross(vsub(q.p, b.position), Fv)), h));
          }
        }
      }
      b.velocity = vadd(b.velocity, dv);
      b.angularVelocity = vadd(b.angularVelocity, dw);
      if (!this.enableDrag) return;

      const fSub = b.volume > 0 ? clamp(vSub / b.volume, 0, 1) : 0;
      const rho = rhoAir * (1 - fSub) + rhoSub * fSub;
      if (rho <= 0) return;
      const wind = fSub > 0.5 ? v3() : this.wind;
      const vr = vsub(b.velocity, wind);
      const speed = vlen(vr);
      if (speed > 1e-6) {
        const u = vscale(vr, 1 / speed);
        let cdA = 0;
        for (const s of b.shapes) {
          if (s.type === 'sphere') cdA += CD_SPHERE * Math.PI * s.radius * s.radius;
          else if (s.type === 'box') {
            const SR = s.localR ? m3mul(b.Rc, s.localR) : b.Rc;
            const hx = s.half.x, hy = s.half.y, hz = s.half.z;
            const ax = Math.abs(SR[0] * u.x + SR[3] * u.y + SR[6] * u.z);
            const ay = Math.abs(SR[1] * u.x + SR[4] * u.y + SR[7] * u.z);
            const az = Math.abs(SR[2] * u.x + SR[5] * u.y + SR[8] * u.z);
            cdA += CD_BOX * 4 * (hy * hz * ax + hx * hz * ay + hx * hy * az);
          }
        }
        // dv/dt = -c |v| v, integrated implicitly so light objects in water stay stable
        const c = 0.5 * rho * cdA * b.dragScale * b.invMass;
        const vr2 = vscale(vr, 1 / (1 + c * speed * h));
        b.velocity = vadd(vr2, wind);
      }
      // rotational drag: quadratic in air, plus wave-making losses in water
      const wl = vlen(b.angularVelocity);
      if (wl > 1e-6) {
        const L = b.boundingRadius;
        const Iavg = (b.inertia[0] + b.inertia[4] + b.inertia[8]) / 3;
        const kq = (0.5 * rho * 0.02 * L ** 5) / Math.max(Iavg, 1e-9);
        const k = kq * wl + 1.2 * fSub;
        b.angularVelocity = vscale(b.angularVelocity, 1 / (1 + k * h));
      }
      if (fSub > 0 && fSub < 1) {
        // a floating body sheds energy into surface waves; damp heave a little
        const vy = vdot(b.velocity, up);
        b.velocity = vmad(b.velocity, up, -vy * (1 - 1 / (1 + 1.5 * h)));
      }
    }

    _integratePositions(movers, h) {
      for (const b of movers) {
        const v = b.velocity, w = b.angularVelocity, q = b.quaternion;
        b.position = { x: b.position.x + h * v.x, y: b.position.y + h * v.y, z: b.position.z + h * v.z };
        const hw = 0.5 * h;
        b.quaternion = qnormalize({
          x: q.x + hw * (w.x * q.w + w.y * q.z - w.z * q.y),
          y: q.y + hw * (w.y * q.w + w.z * q.x - w.x * q.z),
          z: q.z + hw * (w.z * q.w + w.x * q.y - w.y * q.x),
          w: q.w + hw * (-w.x * q.x - w.y * q.y - w.z * q.z),
        });
        b.Rc = m3fromQuat(b.quaternion);
      }
    }

    // ----- events and sleep -------------------------------------------------

    _collectImpacts(contacts) {
      for (const m of contacts) {
        let speed = 0, impulse = 0, at = null;
        for (const cp of m.points) {
          if (cp.maxNormalImpulse <= 0) continue;
          if (-cp.relativeVelocity > speed) { speed = -cp.relativeVelocity; at = cp.p; }
          impulse += cp.maxNormalImpulse;
        }
        if (speed > 0.4 && at) {
          this.impacts.push({
            point: at, speed, impulse,
            bodyA: m.bodyA, bodyB: m.bodyB,
            materialA: m.shapeA.material, materialB: m.shapeB.material,
          });
        }
      }
    }

    _updateSleep(dt, movers, contacts, joints) {
      if (!this.enableSleep) return;
      for (const b of movers) {
        if (!b.canSleep || b.speedBound() > this.sleepThreshold) b.sleepTime = 0;
        else b.sleepTime += dt;
        b._uf = b;
      }
      const find = (b) => {
        while (b._uf !== b) { b._uf = b._uf._uf; b = b._uf; }
        return b;
      };
      const union = (a, b) => {
        const ra = find(a), rb = find(b);
        if (ra !== rb) rb._uf = ra;
      };
      for (const m of contacts) {
        const A = m.bodyA, B = m.bodyB;
        if (!A.invMass || !B.invMass) continue;
        let touching = false;
        for (const cp of m.points) if (cp.s < this.linearSlop) { touching = true; break; }
        if (touching) union(A, B);
      }
      for (const j of joints) {
        if (j.kind === 'grab') {
          j.bodyB.sleepTime = 0;
          continue;
        }
        if (j.bodyA.invMass && j.bodyB.invMass) union(j.bodyA, j.bodyB);
      }
      const islands = new Map();
      for (const b of movers) {
        const r = find(b);
        let list = islands.get(r);
        if (!list) islands.set(r, (list = []));
        list.push(b);
      }
      this.stats.islands = islands.size;
      for (const list of islands.values()) {
        let minSleep = Infinity;
        for (const b of list) minSleep = Math.min(minSleep, b.sleepTime);
        if (minSleep < this.timeToSleep) continue;
        const id = this._nextIsland++;
        for (const b of list) {
          b.sleeping = true;
          b.islandId = id;
          b.velocity = v3();
          b.angularVelocity = v3();
        }
        this._sleepGroups.set(id, list);
      }
    }
  }

  return {
    World, Body, Shape, BallJoint, DistanceJoint, GrabJoint, MATERIALS,
    math: {
      v3, vcopy, vadd, vsub, vscale, vmad, vdot, vcross, vlen, vlen2, vnorm, vneg, vlerp,
      quat, qmul, qconj, qnormalize, qrotate, qFromAxisAngle, qFromEuler,
      m3fromQuat, m3mulv, m3tmulv, m3mul, m3inverse, m3transpose, m3rotate, clamp,
    },
    _internals: { collideShapes, collideBoxes, makeSoft, reducePoints },
  };
});

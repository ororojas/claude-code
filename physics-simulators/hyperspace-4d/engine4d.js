/*
 * Ana & Kata 4D engine
 *
 * Four-dimensional rigid bodies, convex 4-polytopes and hyperplane slicing.
 * Coordinates are (x, y, z, w). y is up and gravity pulls along -y; the
 * fourth axis w is where "ana" (+w) and "kata" (-w) point.
 *
 * Rotation in 4D happens in planes rather than about axes, so angular
 * velocity is a bivector with six components (xy, xz, xw, yz, yw, zw).
 * A body's orientation is a 4x4 orthogonal matrix.
 *
 * What it does:
 *   - hyperspheres and convex polytopes (any convex hull of a point set,
 *     with fast paths for hyperboxes), static, kinematic or dynamic
 *   - contacts: sphere-sphere, sphere-plane, sphere-box (exact), sphere vs
 *     polytope (GJK), polytope vs plane, polytope vs polytope (sampled)
 *   - sub-stepped sequential impulses with soft contacts, friction and
 *     restitution, island sleeping
 *   - slicing: the 3D cross-section of a polytope or hypersphere by any
 *     hyperplane, as triangles ready to draw
 *
 * Works as a browser global (window.Engine4D) or a CommonJS module.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Engine4D = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  // ---------------------------------------------------------------------------
  // 4-vectors as plain arrays [x, y, z, w]
  // ---------------------------------------------------------------------------
  const v4 = (x = 0, y = 0, z = 0, w = 0) => [x, y, z, w];
  const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2], a[3] + b[3]];
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2], a[3] - b[3]];
  const scale = (a, s) => [a[0] * s, a[1] * s, a[2] * s, a[3] * s];
  const mad = (a, b, s) => [a[0] + b[0] * s, a[1] + b[1] * s, a[2] + b[2] * s, a[3] + b[3] * s];
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3];
  const len = (a) => Math.sqrt(dot(a, a));
  const norm = (a) => {
    const l = len(a);
    return l > 1e-12 ? scale(a, 1 / l) : [0, 0, 0, 0];
  };
  const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t, a[3] + (b[3] - a[3]) * t];
  const clamp = (x, lo, hi) => (x < lo ? lo : x > hi ? hi : x);
  const det3 = (a0, a1, a2, b0, b1, b2, c0, c1, c2) =>
    a0 * (b1 * c2 - b2 * c1) - a1 * (b0 * c2 - b2 * c0) + a2 * (b0 * c1 - b1 * c0);
  // The 4D analogue of the cross product: a vector orthogonal to a, b and c.
  function cross3(a, b, c) {
    return [
      det3(a[1], a[2], a[3], b[1], b[2], b[3], c[1], c[2], c[3]),
      -det3(a[0], a[2], a[3], b[0], b[2], b[3], c[0], c[2], c[3]),
      det3(a[0], a[1], a[3], b[0], b[1], b[3], c[0], c[1], c[3]),
      -det3(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]),
    ];
  }

  // ---------------------------------------------------------------------------
  // 4x4 matrices, row-major. A body's R maps local to world; its columns are
  // the body axes in world coordinates.
  // ---------------------------------------------------------------------------
  const identity = () => [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
  function mulMV(m, v) {
    return [
      m[0] * v[0] + m[1] * v[1] + m[2] * v[2] + m[3] * v[3],
      m[4] * v[0] + m[5] * v[1] + m[6] * v[2] + m[7] * v[3],
      m[8] * v[0] + m[9] * v[1] + m[10] * v[2] + m[11] * v[3],
      m[12] * v[0] + m[13] * v[1] + m[14] * v[2] + m[15] * v[3],
    ];
  }
  function mulMtV(m, v) {
    return [
      m[0] * v[0] + m[4] * v[1] + m[8] * v[2] + m[12] * v[3],
      m[1] * v[0] + m[5] * v[1] + m[9] * v[2] + m[13] * v[3],
      m[2] * v[0] + m[6] * v[1] + m[10] * v[2] + m[14] * v[3],
      m[3] * v[0] + m[7] * v[1] + m[11] * v[2] + m[15] * v[3],
    ];
  }
  function mulMM(a, b) {
    const r = new Array(16);
    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 4; j++) {
        r[i * 4 + j] = a[i * 4] * b[j] + a[i * 4 + 1] * b[4 + j] + a[i * 4 + 2] * b[8 + j] + a[i * 4 + 3] * b[12 + j];
      }
    }
    return r;
  }
  const transpose = (m) => [m[0], m[4], m[8], m[12], m[1], m[5], m[9], m[13], m[2], m[6], m[10], m[14], m[3], m[7], m[11], m[15]];
  const column = (m, j) => [m[j], m[4 + j], m[8 + j], m[12 + j]];
  // Rotation in the plane of axes i and j, turning e_i toward e_j.
  function planeRotation(i, j, angle) {
    const m = identity(), c = Math.cos(angle), s = Math.sin(angle);
    m[i * 4 + i] = c; m[j * 4 + j] = c;
    m[j * 4 + i] = s; m[i * 4 + j] = -s;
    return m;
  }
  // Gram-Schmidt on the columns
  function orthonormalize(m) {
    const cols = [column(m, 0), column(m, 1), column(m, 2), column(m, 3)];
    for (let j = 0; j < 4; j++) {
      let c = cols[j];
      for (let k = 0; k < j; k++) c = mad(c, cols[k], -dot(c, cols[k]));
      cols[j] = norm(c);
    }
    const r = new Array(16);
    for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) r[i * 4 + j] = cols[j][i];
    return r;
  }

  // ---------------------------------------------------------------------------
  // Bivectors [xy, xz, xw, yz, yw, zw]. B_ij > 0 turns e_i toward e_j.
  // ---------------------------------------------------------------------------
  const PAIRS = [[0, 1], [0, 2], [0, 3], [1, 2], [1, 3], [2, 3]];
  const wedge = (a, b) => [
    a[0] * b[1] - a[1] * b[0], a[0] * b[2] - a[2] * b[0], a[0] * b[3] - a[3] * b[0],
    a[1] * b[2] - a[2] * b[1], a[1] * b[3] - a[3] * b[1], a[2] * b[3] - a[3] * b[2],
  ];
  // velocity of a point at offset r on a body turning with bivector B
  const bivApply = (B, r) => [
    -B[0] * r[1] - B[1] * r[2] - B[2] * r[3],
    B[0] * r[0] - B[3] * r[2] - B[4] * r[3],
    B[1] * r[0] + B[3] * r[1] - B[5] * r[3],
    B[2] * r[0] + B[4] * r[1] + B[5] * r[2],
  ];
  const dot6 = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3] + a[4] * b[4] + a[5] * b[5];
  const add6 = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2], a[3] + b[3], a[4] + b[4], a[5] + b[5]];
  const scale6 = (a, s) => [a[0] * s, a[1] * s, a[2] * s, a[3] * s, a[4] * s, a[5] * s];
  function mul6(M, b) {
    const r = [0, 0, 0, 0, 0, 0];
    for (let i = 0; i < 6; i++) {
      let s = 0;
      for (let j = 0; j < 6; j++) s += M[i * 6 + j] * b[j];
      r[i] = s;
    }
    return r;
  }
  function omegaMatrix(B) {
    const m = new Array(16).fill(0);
    PAIRS.forEach(([i, j], p) => {
      m[j * 4 + i] = B[p];
      m[i * 4 + j] = -B[p];
    });
    return m;
  }
  // How R acts on bivectors: T[(ij),(kl)] = R_ik R_jl - R_il R_jk
  function bivectorRotation(R) {
    const T = new Array(36);
    for (let p = 0; p < 6; p++) {
      const [i, j] = PAIRS[p];
      for (let q = 0; q < 6; q++) {
        const [k, l] = PAIRS[q];
        T[p * 6 + q] = R[i * 4 + k] * R[j * 4 + l] - R[i * 4 + l] * R[j * 4 + k];
      }
    }
    return T;
  }

  // ---------------------------------------------------------------------------
  // Convex 4-polytopes
  // ---------------------------------------------------------------------------
  // Facets ("cells") of the convex hull of a small point set, by brute force
  // over 4-subsets. Fine for the few dozen vertices of the shapes used here.
  function hullCells(V) {
    const n = V.length, cells = [], eps = 1e-7;
    for (let a = 0; a < n; a++) {
      for (let b = a + 1; b < n; b++) {
        for (let c = b + 1; c < n; c++) {
          for (let d = c + 1; d < n; d++) {
            let nrm = cross3(sub(V[b], V[a]), sub(V[c], V[a]), sub(V[d], V[a]));
            const l = len(nrm);
            if (l < 1e-9) continue;
            nrm = scale(nrm, 1 / l);
            let off = dot(nrm, V[a]);
            let pos = 0, neg = 0;
            for (let k = 0; k < n; k++) {
              const s = dot(nrm, V[k]) - off;
              if (s > eps) pos++; else if (s < -eps) neg++;
              if (pos && neg) break;
            }
            if (pos && neg) continue;
            if (pos) { nrm = scale(nrm, -1); off = -off; }
            if (cells.some((cl) => dot(cl.n, nrm) > 1 - 1e-9 && Math.abs(cl.d - off) < 1e-7)) continue;
            cells.push({ n: nrm, d: off });
          }
        }
      }
    }
    for (const cl of cells) {
      cl.verts = [];
      for (let k = 0; k < n; k++) if (Math.abs(dot(cl.n, V[k]) - cl.d) < 1e-6) cl.verts.push(k);
    }
    return cells;
  }

  class Polytope {
    // vertices are local coordinates centred on the centroid
    constructor(vertices, opts = {}) {
      this.name = opts.name || 'polytope';
      this.vertices = vertices.map((v) => v.slice());
      this.box = opts.box || null; // half extents for hyperboxes
      this.cells = opts.cells || hullCells(this.vertices);
      const inCell = this.cells.map((c) => new Set(c.verts));
      this.edges = [];
      const nv = this.vertices.length;
      for (let a = 0; a < nv; a++) {
        for (let b = a + 1; b < nv; b++) {
          let shared = 0;
          for (const s of inCell) if (s.has(a) && s.has(b)) shared++;
          if (shared >= 3) this.edges.push([a, b]);
        }
      }
      this.cellEdges = this.cells.map((c, ci) => {
        const s = inCell[ci];
        const list = [];
        this.edges.forEach(([a, b], ei) => { if (s.has(a) && s.has(b)) list.push(ei); });
        return list;
      });
      this.radius = Math.max(...this.vertices.map(len));
      // contact samples: vertices and edge midpoints
      this.samples = this.vertices.concat(this.edges.map(([a, b]) => lerp(this.vertices[a], this.vertices[b], 0.5)));
      if (this.box) {
        const h = this.box;
        this.volume = 16 * h[0] * h[1] * h[2] * h[3];
        this.moments = h.map((x) => (x * x) / 3);
      } else {
        this._integrate();
      }
    }

    // Exact volume and per-unit-mass second moments <x_i^2>: split the
    // polytope into 4-simplices (origin, cell centre, fan of each 2-face) and
    // sum the closed-form simplex integrals.
    _integrate() {
      const V = this.vertices;
      let vol = 0;
      const m = [0, 0, 0, 0];
      const sets = this.cells.map((c) => new Set(c.verts));
      this.cells.forEach((ci, i) => {
        const cc = scale(ci.verts.reduce((a, k) => add(a, V[k]), [0, 0, 0, 0]), 1 / ci.verts.length);
        this.cells.forEach((cj, j) => {
          if (i === j) return;
          const face = ci.verts.filter((k) => sets[j].has(k));
          if (face.length < 3) return;
          const fc = scale(face.reduce((a, k) => add(a, V[k]), [0, 0, 0, 0]), 1 / face.length);
          const u = norm(sub(V[face[0]], fc));
          const w = norm(cross3(ci.n, cj.n, u));
          if (len(w) < 0.5) return;
          const ang = (k) => { const r = sub(V[k], fc); return Math.atan2(dot(r, w), dot(r, u)); };
          face.sort((a, b) => ang(a) - ang(b));
          for (let t = 1; t + 1 < face.length; t++) {
            const S = [[0, 0, 0, 0], cc, V[face[0]], V[face[t]], V[face[t + 1]]];
            const e = [sub(S[1], S[0]), sub(S[2], S[0]), sub(S[3], S[0]), sub(S[4], S[0])];
            const det = dot(e[0], cross3(e[1], e[2], e[3]));
            // the pyramids over each cell's own 2-faces tile the cone from
            // the origin over that cell
            const wgt = Math.abs(det) / 24;
            vol += wgt;
            const sum = S.reduce((a, p) => add(a, p), [0, 0, 0, 0]);
            for (let k = 0; k < 4; k++) {
              let q = sum[k] * sum[k];
              for (const p of S) q += p[k] * p[k];
              m[k] += (wgt / 30) * q;
            }
          }
        });
      });
      this.volume = vol;
      this.moments = m.map((x) => x / vol);
    }

    static box(h, name = 'hyperbox') {
      const V = [];
      for (let i = 0; i < 16; i++) V.push([(i & 1 ? 1 : -1) * h[0], (i & 2 ? 1 : -1) * h[1], (i & 4 ? 1 : -1) * h[2], (i & 8 ? 1 : -1) * h[3]]);
      const cells = [];
      for (let k = 0; k < 4; k++) {
        for (const s of [1, -1]) {
          const n = [0, 0, 0, 0];
          n[k] = s;
          const verts = [];
          V.forEach((v, i) => { if (Math.sign(v[k]) === s) verts.push(i); });
          cells.push({ n, d: h[k], verts });
        }
      }
      return new Polytope(V, { box: h.slice(), cells, name });
    }
    static tesseract(size = 1) { const h = size / 2; return Polytope.box([h, h, h, h], 'tesseract'); }
    // regular 5-cell (4-simplex) with the given circumradius
    static simplex(R = 1) {
      const a = 1 / Math.sqrt(5);
      const raw = [[1, 1, 1, -a], [1, -1, -1, -a], [-1, 1, -1, -a], [-1, -1, 1, -a], [0, 0, 0, 4 * a]];
      const k = R / len(raw[0]);
      return new Polytope(raw.map((v) => scale(v, k)), { name: '5-cell' });
    }
    // regular 16-cell (cross-polytope)
    static orthoplex(R = 1) {
      const V = [];
      for (let k = 0; k < 4; k++) for (const s of [1, -1]) { const v = [0, 0, 0, 0]; v[k] = s * R; V.push(v); }
      return new Polytope(V, { name: '16-cell' });
    }
    // regular 24-cell
    static icositetrachoron(R = 1) {
      const V = [];
      for (let i = 0; i < 4; i++) {
        for (let j = i + 1; j < 4; j++) {
          for (const si of [1, -1]) for (const sj of [1, -1]) {
            const v = [0, 0, 0, 0];
            v[i] = si; v[j] = sj;
            V.push(scale(v, R / Math.SQRT2));
          }
        }
      }
      return new Polytope(V, { name: '24-cell' });
    }
    // p-q duoprism: a p-gon in the xy plane times a q-gon in the zw plane
    static duoprism(p, q, r1 = 1, r2 = 1) {
      const V = [];
      for (let i = 0; i < p; i++) {
        for (let j = 0; j < q; j++) {
          const a = (2 * Math.PI * i) / p, b = (2 * Math.PI * j) / q;
          V.push([r1 * Math.cos(a), r1 * Math.sin(a), r2 * Math.cos(b), r2 * Math.sin(b)]);
        }
      }
      return new Polytope(V, { name: `${p}-${q} duoprism` });
    }
  }

  // ---------------------------------------------------------------------------
  // Closest point on a convex hull to a point (GJK with an exhaustive
  // sub-simplex search, fine for simplices of up to five points)
  // ---------------------------------------------------------------------------
  function solveSmall(A, b, n) {
    // Gaussian elimination with partial pivoting; A is n*n row-major
    const M = A.slice(), x = b.slice();
    for (let c = 0; c < n; c++) {
      let piv = c;
      for (let r = c + 1; r < n; r++) if (Math.abs(M[r * n + c]) > Math.abs(M[piv * n + c])) piv = r;
      if (Math.abs(M[piv * n + c]) < 1e-14) return null;
      if (piv !== c) {
        for (let k = 0; k < n; k++) { const t = M[c * n + k]; M[c * n + k] = M[piv * n + k]; M[piv * n + k] = t; }
        const t = x[c]; x[c] = x[piv]; x[piv] = t;
      }
      for (let r = c + 1; r < n; r++) {
        const f = M[r * n + c] / M[c * n + c];
        if (!f) continue;
        for (let k = c; k < n; k++) M[r * n + k] -= f * M[c * n + k];
        x[r] -= f * x[c];
      }
    }
    for (let c = n - 1; c >= 0; c--) {
      let s = x[c];
      for (let k = c + 1; k < n; k++) s -= M[c * n + k] * x[k];
      x[c] = s / M[c * n + c];
    }
    return x;
  }
  // closest point to the origin in the convex hull of S (|S| <= 5)
  function closestInSimplex(S) {
    let best = null, bestD = Infinity, bestSet = null, bestW = null;
    const n = S.length;
    for (let mask = 1; mask < 1 << n; mask++) {
      const idx = [];
      for (let i = 0; i < n; i++) if (mask & (1 << i)) idx.push(i);
      const p0 = S[idx[0]];
      const k = idx.length - 1;
      let lam = [];
      if (k > 0) {
        const D = idx.slice(1).map((i) => sub(S[i], p0));
        const G = new Array(k * k), rhs = new Array(k);
        for (let a = 0; a < k; a++) {
          rhs[a] = -dot(D[a], p0);
          for (let c = 0; c < k; c++) G[a * k + c] = dot(D[a], D[c]);
        }
        lam = solveSmall(G, rhs, k);
        if (!lam) continue;
      }
      const l0 = 1 - lam.reduce((s, x) => s + x, 0);
      if (l0 < -1e-9 || lam.some((x) => x < -1e-9)) continue;
      let p = scale(p0, l0);
      idx.slice(1).forEach((i, a) => { p = mad(p, S[i], lam[a]); });
      const d = dot(p, p);
      if (d < bestD - 1e-15) { bestD = d; best = p; bestSet = idx; bestW = [l0, ...lam]; }
    }
    return { point: best, set: bestSet, weights: bestW };
  }
  function closestPointOnHull(points, q) {
    const P = points.map((p) => sub(p, q));
    const support = (d) => {
      let bi = 0, bv = -Infinity;
      for (let i = 0; i < P.length; i++) { const v = dot(P[i], d); if (v > bv) { bv = v; bi = i; } }
      return bi;
    };
    let simplex = [0];
    let x = P[0];
    for (let iter = 0; iter < 40; iter++) {
      const dd = dot(x, x);
      if (dd < 1e-18) return { point: q.slice(), distance: 0, inside: true };
      const i = support(scale(x, -1));
      if (dd - dot(x, P[i]) < 1e-10 * Math.max(1, dd) || simplex.includes(i)) break;
      simplex.push(i);
      const res = closestInSimplex(simplex.map((k) => P[k]));
      if (!res.point) break;
      simplex = res.set.map((k) => simplex[k]);
      x = res.point;
      if (simplex.length === 5) return { point: q.slice(), distance: 0, inside: true };
    }
    return { point: add(q, x), distance: len(x), inside: false };
  }

  // ---------------------------------------------------------------------------
  // Bodies
  // ---------------------------------------------------------------------------
  let bodyIds = 0;
  const DEFAULT_MATERIAL = { friction: 0.6, restitution: 0.25, density: 1000 };

  class Body4 {
    constructor(def) {
      this.id = ++bodyIds;
      this.type = def.type || 'dynamic'; // 'dynamic' | 'static' | 'kinematic'
      this.name = def.name || '';
      this.material = { ...DEFAULT_MATERIAL, ...(def.material || {}) };
      this.pos = (def.position || v4()).slice();
      this.R = def.rotation ? orthonormalize(def.rotation) : identity();
      this.vel = (def.velocity || v4()).slice();
      this.B = (def.angularVelocity || [0, 0, 0, 0, 0, 0]).slice();
      this.linearDamping = def.linearDamping ?? 0.02;
      this.angularDamping = def.angularDamping ?? 0.05;
      this.gravityScale = def.gravityScale ?? 1;
      this.userData = def.userData || {};
      this.sleeping = false;
      this.sleepTime = 0;
      this.canSleep = def.canSleep ?? true;
      this.sensor = !!def.sensor; // detects overlap, never pushes
      this.collides = def.collides ?? true;
      if (def.radius != null) {
        this.shape = 'sphere';
        this.radius = def.radius;
        this.volume = (Math.PI * Math.PI / 2) * Math.pow(def.radius, 4);
        this.unitMoments = [1, 1, 1, 1].map(() => (def.radius * def.radius) / 6);
      } else if (def.plane) {
        this.shape = 'plane';
        this.normal = norm(def.plane.normal || [0, 1, 0, 0]);
        this.offset = def.plane.offset || 0;
        this.volume = 0;
        this.unitMoments = [0, 0, 0, 0];
      } else {
        this.shape = 'poly';
        this.poly = def.poly;
        this.volume = def.poly.volume;
        this.unitMoments = def.poly.moments.slice();
      }
      const dynamic = this.type === 'dynamic';
      this.mass = def.mass ?? this.material.density * this.volume;
      this.invMass = dynamic && this.mass > 0 ? 1 / this.mass : 0;
      this.moments = this.unitMoments.map((m) => m * this.mass);
      this.invBodyInertia = PAIRS.map(([i, j]) => (dynamic ? 1 / Math.max(this.moments[i] + this.moments[j], 1e-12) : 0));
      this.IinvW = new Array(36).fill(0);
      this.world = null;
      this.aabb = { min: v4(), max: v4() };
      this.updateWorld();
    }

    get boundRadius() { return this.shape === 'sphere' ? this.radius : this.shape === 'poly' ? this.poly.radius : Infinity; }

    updateWorld() {
      if (this.shape === 'poly') {
        const R = this.R, p = this.pos;
        this.wv = this.poly.vertices.map((v) => add(p, mulMV(R, v)));
        this.wcells = this.poly.cells.map((c) => {
          const n = mulMV(R, c.n);
          return { n, d: c.d + dot(n, p) };
        });
        const mn = [Infinity, Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity, -Infinity];
        for (const v of this.wv) for (let k = 0; k < 4; k++) { if (v[k] < mn[k]) mn[k] = v[k]; if (v[k] > mx[k]) mx[k] = v[k]; }
        this.aabb.min = mn;
        this.aabb.max = mx;
      } else if (this.shape === 'sphere') {
        const r = this.radius;
        this.aabb.min = this.pos.map((x) => x - r);
        this.aabb.max = this.pos.map((x) => x + r);
      } else {
        this.aabb.min = [-Infinity, -Infinity, -Infinity, -Infinity];
        this.aabb.max = [Infinity, Infinity, Infinity, Infinity];
      }
      if (this.invMass) {
        const T = bivectorRotation(this.R);
        const M = new Array(36).fill(0);
        for (let i = 0; i < 6; i++) {
          for (let j = i; j < 6; j++) {
            let s = 0;
            for (let k = 0; k < 6; k++) s += T[i * 6 + k] * this.invBodyInertia[k] * T[j * 6 + k];
            M[i * 6 + j] = M[j * 6 + i] = s;
          }
        }
        this.IinvW = M;
      }
    }

    toWorld(local) { return add(this.pos, mulMV(this.R, local)); }
    toLocal(p) { return mulMtV(this.R, sub(p, this.pos)); }
    velocityAt(p) { return add(this.vel, bivApply(this.B, sub(p, this.pos))); }
    speedBound() {
      return len(this.vel) + Math.sqrt(dot6(this.B, this.B)) * (this.shape === 'sphere' ? this.radius : this.shape === 'poly' ? this.poly.radius : 0);
    }
    kineticEnergy() {
      if (!this.invMass) return 0;
      let e = 0.5 * this.mass * dot(this.vel, this.vel);
      // rotational part in the body frame
      const T = bivectorRotation(this.R);
      const Bb = [0, 0, 0, 0, 0, 0];
      for (let q = 0; q < 6; q++) for (let p = 0; p < 6; p++) Bb[q] += T[p * 6 + q] * this.B[p];
      PAIRS.forEach(([i, j], q) => { e += 0.5 * (this.moments[i] + this.moments[j]) * Bb[q] * Bb[q]; });
      return e;
    }
    applyImpulse(J, point) {
      if (!this.invMass) return;
      this.vel = mad(this.vel, J, this.invMass);
      if (point) this.B = add6(this.B, mul6(this.IinvW, wedge(sub(point, this.pos), J)));
      this.wake();
    }
    wake() {
      if (this.world) this.world.wakeBody(this);
      else this.sleeping = false;
      this.sleepTime = 0;
    }
    setPose(pos, R) {
      this.pos = pos.slice();
      if (R) this.R = orthonormalize(R);
      this.updateWorld();
      this.wake();
    }
  }

  // ---------------------------------------------------------------------------
  // Narrow phase: each test pushes points {p, n, s, id} with n from A to B,
  // p the midpoint between the surfaces and s the signed separation.
  // ---------------------------------------------------------------------------
  function spherePlane(pl, sp, margin, out, flip) {
    const s = dot(pl.normal, sp.pos) - pl.offset - sp.radius;
    if (s > margin) return;
    const deep = mad(sp.pos, pl.normal, -sp.radius);
    const n = flip ? scale(pl.normal, -1) : pl.normal.slice();
    out.push({ p: mad(deep, pl.normal, -0.5 * s), n, s, id: 0 });
  }
  function polyPlane(pl, po, margin, out, flip) {
    const n = flip ? scale(pl.normal, -1) : pl.normal.slice();
    po.wv.forEach((v, i) => {
      const s = dot(pl.normal, v) - pl.offset;
      if (s <= margin) out.push({ p: mad(v, pl.normal, -0.5 * s), n, s, id: i });
    });
  }
  function sphereSphere(a, b, margin, out) {
    const d = sub(b.pos, a.pos);
    const dist = len(d), rs = a.radius + b.radius;
    const s = dist - rs;
    if (s > margin) return;
    const n = dist > 1e-9 ? scale(d, 1 / dist) : [0, 1, 0, 0];
    const pa = mad(a.pos, n, a.radius), pb = mad(b.pos, n, -b.radius);
    out.push({ p: lerp(pa, pb, 0.5), n, s, id: 0 });
  }
  // polytope first, sphere second; normal from the polytope to the sphere
  function polySphere(po, sp, margin, out, flip) {
    const r = sp.radius;
    let n, s, surf;
    if (po.poly.box) {
      const h = po.poly.box;
      const l = po.toLocal(sp.pos);
      const q = l.map((x, k) => clamp(x, -h[k], h[k]));
      const d = sub(l, q);
      const dist = len(d);
      if (dist > 1e-9) {
        s = dist - r;
        if (s > margin) return;
        n = mulMV(po.R, scale(d, 1 / dist));
        surf = po.toWorld(q);
      } else {
        let k = 0, best = Infinity;
        for (let i = 0; i < 4; i++) { const e = h[i] - Math.abs(l[i]); if (e < best) { best = e; k = i; } }
        const nl = [0, 0, 0, 0];
        nl[k] = l[k] >= 0 ? 1 : -1;
        const ql = l.slice();
        ql[k] = nl[k] * h[k];
        n = mulMV(po.R, nl);
        s = -best - r;
        surf = po.toWorld(ql);
      }
    } else {
      const res = closestPointOnHull(po.wv, sp.pos);
      if (!res.inside && res.distance > 1e-9) {
        s = res.distance - r;
        if (s > margin) return;
        n = scale(sub(sp.pos, res.point), 1 / res.distance);
        surf = res.point;
      } else {
        let best = -Infinity, bc = null;
        for (const c of po.wcells) { const e = dot(c.n, sp.pos) - c.d; if (e > best) { best = e; bc = c; } }
        n = bc.n.slice();
        s = best - r;
        surf = mad(sp.pos, n, -best);
      }
    }
    const deep = mad(sp.pos, n, -r);
    out.push({ p: lerp(surf, deep, 0.5), n: flip ? scale(n, -1) : n, s, id: 0 });
  }
  // sampled polytope contact: points of one body found inside the other
  function polyPoly(A, B, margin, out) {
    const probe = (inner, outer, sign, tag) => {
      const samples = inner.poly.samples;
      const centre = inner.pos;
      const tie = 0.002 + 0.01 * Math.min(inner.poly.radius, outer.poly.radius);
      for (let i = 0; i < samples.length; i++) {
        const p = inner.toWorld(samples[i]);
        let best = -Infinity;
        for (const c of outer.wcells) {
          const e = dot(c.n, p) - c.d;
          if (e > best) best = e;
          if (best > margin) break;
        }
        if (best > margin) continue;
        // A point on a corner sits on several faces at once. Of the faces it
        // (nearly) ties on, use the one whose plane the inner body's centre is
        // furthest outside of: the side the inner body is actually on.
        let bc = null, be = 0, bs = -Infinity;
        for (const c of outer.wcells) {
          const e = dot(c.n, p) - c.d;
          if (e < best - tie) continue;
          const side = dot(c.n, centre) - c.d;
          if (side > bs) { bs = side; bc = c; be = e; }
        }
        // contact normal runs from A to B
        const n = sign > 0 ? bc.n.slice() : scale(bc.n, -1);
        out.push({ p: mad(p, bc.n, -0.5 * be), n, s: be, id: tag + i });
      }
    };
    probe(B, A, 1, 0); // points of B inside A: A's outward normal points to B
    probe(A, B, -1, 100000); // points of A inside B
  }

  function collide(A, B, margin, out) {
    const a = A.shape, b = B.shape;
    if (a === 'plane') {
      if (b === 'sphere') return spherePlane(A, B, margin, out, false);
      if (b === 'poly') return polyPlane(A, B, margin, out, false);
      return;
    }
    if (b === 'plane') {
      if (a === 'sphere') return spherePlane(B, A, margin, out, true);
      if (a === 'poly') return polyPlane(B, A, margin, out, true);
      return;
    }
    if (a === 'sphere' && b === 'sphere') return sphereSphere(A, B, margin, out);
    if (a === 'poly' && b === 'sphere') return polySphere(A, B, margin, out, false);
    if (a === 'sphere' && b === 'poly') return polySphere(B, A, margin, out, true);
    if (a === 'poly' && b === 'poly') return polyPoly(A, B, margin, out);
  }

  // ---------------------------------------------------------------------------
  // Soft constraint coefficients (Catto, Solver2D)
  // ---------------------------------------------------------------------------
  function makeSoft(hertz, zeta, h) {
    const omega = 2 * Math.PI * hertz;
    const a1 = 2 * zeta + h * omega;
    const a2 = h * omega * a1;
    const a3 = 1 / (1 + a2);
    return { biasRate: omega / a1, massScale: a2 * a3, impulseScale: a3 };
  }

  // ---------------------------------------------------------------------------
  // World
  // ---------------------------------------------------------------------------
  class World4 {
    constructor(opts = {}) {
      this.gravity = (opts.gravity || [0, -9.81, 0, 0]).slice();
      // 4D scenes are small; extra substeps let the many redundant corner
      // contacts of resting polytopes converge, so stacks settle and sleep
      this.substeps = opts.substeps ?? 8;
      this.bodies = [];
      this.contacts = [];
      this.cache = new Map();
      this.contactHertz = 60;
      this.contactDampingRatio = 10;
      this.pushMax = 3;
      this.margin = 0.01;
      this.restitutionThreshold = 0.4;
      this.enableSleep = true;
      this.sleepThreshold = 0.05;
      this.timeToSleep = 0.6;
      this.time = 0;
      this.sensorHits = [];
    }

    add(body) {
      body.world = this;
      this.bodies.push(body);
      body.updateWorld();
      return body;
    }
    create(def) { return this.add(new Body4(def)); }
    remove(body) {
      const i = this.bodies.indexOf(body);
      if (i >= 0) this.bodies.splice(i, 1);
      for (const c of this.contacts) {
        const other = c.A === body ? c.B : c.B === body ? c.A : null;
        if (other) this.wakeBody(other);
      }
      body.world = null;
    }
    clear() {
      this.bodies = [];
      this.contacts = [];
      this.cache.clear();
    }
    wakeBody(b) {
      if (!b) return;
      b.sleepTime = 0;
      if (!b.sleeping) return;
      const group = b._island || [b];
      for (const m of group) { m.sleeping = false; m.sleepTime = 0; }
    }

    _pairs() {
      const moving = (b) => b.type === 'kinematic' && b.speedBound() > 1e-9;
      const list = this.bodies.filter((b) => b.collides);
      const pairs = [];
      // sweep along x on the 4D bounding boxes
      list.sort((p, q) => p.aabb.min[0] - q.aabb.min[0]);
      for (let i = 0; i < list.length; i++) {
        const A = list[i];
        for (let j = i + 1; j < list.length; j++) {
          const B = list[j];
          if (B.aabb.min[0] > A.aabb.max[0] + 1) break;
          if (!A.invMass && !B.invMass && !(A.sensor || B.sensor)) continue;
          const aIdle = A.sleeping || (!A.invMass && !moving(A)), bIdle = B.sleeping || (!B.invMass && !moving(B));
          if (aIdle && bIdle && !(A.sensor || B.sensor)) continue;
          let overlap = true;
          for (let k = 0; k < 4; k++) {
            if (A.aabb.min[k] > B.aabb.max[k] + 1 || B.aabb.min[k] > A.aabb.max[k] + 1) { overlap = false; break; }
          }
          if (overlap) pairs.push([A, B]);
        }
      }
      return pairs;
    }

    step(dt) {
      if (!(dt > 0)) return;
      const n = Math.max(1, this.substeps | 0), h = dt / n, inv_h = 1 / h;
      const movers = this.bodies.filter((b) => (b.invMass && !b.sleeping) || b.type === 'kinematic');
      for (const b of movers) b.updateWorld();

      // collision detection
      const contacts = [];
      this.sensorHits = [];
      const planes = this.bodies.filter((b) => b.shape === 'plane');
      const pairs = this._pairs();
      for (const P of planes) for (const b of this.bodies) if (b.invMass && !b.sleeping && b.collides) pairs.push([P, b]);
      for (const [A, B] of pairs) {
        const margin = this.margin + (A.speedBound() + B.speedBound()) * dt;
        const pts = [];
        collide(A, B, margin, pts);
        if (!pts.length) continue;
        if (A.sensor || B.sensor) {
          if (pts.some((q) => q.s < 0)) this.sensorHits.push([A, B]);
          continue;
        }
        if (A.sleeping || B.sleeping) {
          const sleeper = A.sleeping ? A : B, other = sleeper === A ? B : A;
          const minS = Math.min(...pts.map((q) => q.s));
          if (minS < 0.005 || other.speedBound() * dt > minS) this.wakeBody(sleeper);
          else continue;
        }
        const key = A.id < B.id ? A.id * 65536 + B.id : B.id * 65536 + A.id;
        const cached = this.cache.get(key);
        for (const q of pts) {
          const c = { A, B, n: q.n, p: q.p, s: q.s, id: q.id, key, normalImpulse: 0, tangent: [0, 0, 0, 0] };
          if (cached) {
            const old = cached.get(q.id);
            if (old && dot(old.n, q.n) > 0.95) {
              c.normalImpulse = old.normalImpulse;
              c.tangent = old.tangent;
            }
          }
          contacts.push(c);
        }
      }
      // bodies woken above join this step
      for (const b of this.bodies) if (b.invMass && !b.sleeping && movers.indexOf(b) < 0) { b.updateWorld(); movers.push(b); }
      const active = contacts.filter((c) => !c.A.sleeping && !c.B.sleeping);

      const soft = makeSoft(Math.min(this.contactHertz, 0.25 * inv_h), this.contactDampingRatio, h);
      for (const c of active) this._prepare(c);

      for (let i = 0; i < n; i++) {
        for (const b of movers) {
          if (!b.invMass) continue;
          b.vel = mad(b.vel, this.gravity, h * b.gravityScale);
          if (b.linearDamping) b.vel = scale(b.vel, 1 / (1 + h * b.linearDamping));
          if (b.angularDamping) b.B = scale6(b.B, 1 / (1 + h * b.angularDamping));
        }
        for (const c of active) this._warm(c);
        for (const c of active) this._solve(c, true, inv_h, soft);
        for (const b of movers) this._integrate(b, h);
        for (const c of active) this._solve(c, false, inv_h, soft);
      }
      for (const c of active) this._restitution(c);

      for (const b of movers) b.updateWorld();
      // keep impulses for warm starting
      this.cache = new Map();
      for (const c of contacts) {
        let m = this.cache.get(c.key);
        if (!m) this.cache.set(c.key, (m = new Map()));
        m.set(c.id, { n: c.n, normalImpulse: c.normalImpulse, tangent: c.tangent });
      }
      this.contacts = contacts;
      this._sleep(dt, movers, active);
      this.time += dt;
    }

    _prepare(c) {
      const { A, B, n } = c;
      c.rA = sub(c.p, A.pos);
      c.rB = sub(c.p, B.pos);
      const rnA = wedge(c.rA, n), rnB = wedge(c.rB, n);
      const k = A.invMass + B.invMass + dot6(rnA, mul6(A.IinvW, rnA)) + dot6(rnB, mul6(B.IinvW, rnB));
      c.normalMass = k > 0 ? 1 / k : 0;
      // anchors for tracking separation within the step; a sphere's contact
      // point follows its centre instead of turning with it
      c.la = A.shape === 'sphere' ? null : A.toLocal(c.p);
      c.lb = B.shape === 'sphere' ? null : B.toLocal(c.p);
      c.fa = A.shape === 'sphere' ? sub(c.p, A.pos) : null;
      c.fb = B.shape === 'sphere' ? sub(c.p, B.pos) : null;
      c.s0 = c.s;
      c.mu = Math.sqrt(A.material.friction * B.material.friction);
      c.e = Math.max(A.material.restitution, B.material.restitution);
      c.relVel = dot(n, sub(B.velocityAt(c.p), A.velocityAt(c.p)));
      c.maxImpulse = 0;
    }
    _anchor(body, local, fixed) {
      if (fixed) return add(body.pos, fixed);
      if (body.shape === 'plane') return null;
      return add(body.pos, mulMV(body.R, local));
    }
    _apply(c, P) {
      const { A, B } = c;
      if (A.invMass) {
        A.vel = mad(A.vel, P, -A.invMass);
        A.B = add6(A.B, scale6(mul6(A.IinvW, wedge(c.rA, P)), -1));
      }
      if (B.invMass) {
        B.vel = mad(B.vel, P, B.invMass);
        B.B = add6(B.B, mul6(B.IinvW, wedge(c.rB, P)));
      }
    }
    _relVel(c) {
      return sub(add(c.B.vel, bivApply(c.B.B, c.rB)), add(c.A.vel, bivApply(c.A.B, c.rA)));
    }
    _warm(c) {
      const P = mad(c.tangent, c.n, c.normalImpulse);
      if (c.normalImpulse || dot(c.tangent, c.tangent)) this._apply(c, P);
    }
    _solve(c, useBias, inv_h, soft) {
      const { A, B, n } = c;
      // current separation from the bodies' current poses
      // both tracked points start at the contact point, so s starts at s0
      const pa = A.shape === 'plane' ? c.p : this._anchor(A, c.la, c.fa);
      const pb = B.shape === 'plane' ? c.p : this._anchor(B, c.lb, c.fb);
      const s = dot(sub(pb, pa), n) + c.s0;
      let bias = 0, ms = 1, is = 0;
      if (s > 0) bias = s * inv_h;
      else if (useBias) {
        bias = Math.max(soft.biasRate * s, -this.pushMax);
        ms = soft.massScale;
        is = soft.impulseScale;
      }
      let dv = this._relVel(c);
      const vn = dot(dv, n);
      let imp = -c.normalMass * ms * (vn + bias) - is * c.normalImpulse;
      const next = Math.max(c.normalImpulse + imp, 0);
      imp = next - c.normalImpulse;
      c.normalImpulse = next;
      if (imp > c.maxImpulse) c.maxImpulse = imp;
      if (imp) this._apply(c, scale(n, imp));

      // friction along the current slip direction, Coulomb-limited
      dv = this._relVel(c);
      const vt = mad(dv, n, -dot(dv, n));
      const vtl = len(vt);
      if (vtl > 1e-9) {
        const t = scale(vt, 1 / vtl);
        const ra = wedge(c.rA, t), rb = wedge(c.rB, t);
        const kt = A.invMass + B.invMass + dot6(ra, mul6(A.IinvW, ra)) + dot6(rb, mul6(B.IinvW, rb));
        if (kt > 0) {
          let nt = mad(c.tangent, t, -vtl / kt);
          nt = mad(nt, n, -dot(nt, n));
          const maxF = c.mu * c.normalImpulse;
          const l = len(nt);
          if (l > maxF) nt = scale(nt, maxF / l);
          const d = sub(nt, c.tangent);
          c.tangent = nt;
          this._apply(c, d);
        }
      }
    }
    _restitution(c) {
      if (c.relVel > -this.restitutionThreshold || c.maxImpulse === 0 || !c.e) return;
      const vn = dot(this._relVel(c), c.n);
      let imp = -c.normalMass * (vn + c.e * c.relVel);
      const next = Math.max(c.normalImpulse + imp, 0);
      imp = next - c.normalImpulse;
      c.normalImpulse = next;
      if (imp) this._apply(c, scale(c.n, imp));
    }
    _integrate(b, h) {
      b.pos = mad(b.pos, b.vel, h);
      if (dot6(b.B, b.B) > 0) {
        const W = omegaMatrix(b.B);
        const WR = mulMM(W, b.R);
        const WWR = mulMM(W, WR);
        const R = b.R.map((x, i) => x + h * WR[i] + 0.5 * h * h * WWR[i]);
        b.R = orthonormalize(R);
      }
    }

    _sleep(dt, movers, contacts) {
      if (!this.enableSleep) return;
      const dyn = movers.filter((b) => b.invMass);
      for (const b of dyn) {
        if (!b.canSleep || b.speedBound() > this.sleepThreshold) b.sleepTime = 0;
        else b.sleepTime += dt;
        b._uf = b;
      }
      const find = (b) => { while (b._uf !== b) { b._uf = b._uf._uf; b = b._uf; } return b; };
      for (const c of contacts) {
        if (c.A.invMass && c.B.invMass && c.s < 0.005) {
          const ra = find(c.A), rb = find(c.B);
          if (ra !== rb) rb._uf = ra;
        }
        // touching something that moves keeps you awake
        if (c.A.type === 'kinematic' && c.A.speedBound() > 1e-9) c.B.sleepTime = 0;
        if (c.B.type === 'kinematic' && c.B.speedBound() > 1e-9) c.A.sleepTime = 0;
      }
      const groups = new Map();
      for (const b of dyn) {
        const r = find(b);
        let g = groups.get(r);
        if (!g) groups.set(r, (g = []));
        g.push(b);
      }
      for (const g of groups.values()) {
        if (g.some((b) => b.sleepTime < this.timeToSleep)) continue;
        for (const b of g) {
          b.sleeping = true;
          b.vel = v4();
          b.B = [0, 0, 0, 0, 0, 0];
          b._island = g;
        }
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Slicing. A view is a hyperplane: points p with dot(p - origin, normal) =
  // offset, and an orthonormal basis e1, e2, e3 inside it. Slice coordinates
  // of a point are (p.e1, p.e2, p.e3).
  // ---------------------------------------------------------------------------
  function viewBasis(V, origin) {
    // V is a 4x4 rotation; its first three columns span the slice, the last
    // column is the slice normal
    return { e1: column(V, 0), e2: column(V, 1), e3: column(V, 2), n: column(V, 3), o: origin.slice() };
  }
  const project = (p, vb) => [dot(p, vb.e1), dot(p, vb.e2), dot(p, vb.e3)];

  // Signed distance range of a body along the view normal
  function depthRange(body, vb) {
    if (body.shape === 'sphere') {
      const d = dot(sub(body.pos, vb.o), vb.n);
      return [d - body.radius, d + body.radius];
    }
    if (body.shape !== 'poly') return [-Infinity, Infinity];
    let lo = Infinity, hi = -Infinity;
    for (const v of body.wv) {
      const d = dot(sub(v, vb.o), vb.n);
      if (d < lo) lo = d;
      if (d > hi) hi = d;
    }
    return [lo, hi];
  }

  // Triangles of the 3D cross-section of a polytope body. Each cell that the
  // hyperplane cuts contributes one convex polygon. Returns flat arrays.
  function slicePolytope(body, vb, offset = 0) {
    const poly = body.poly;
    const wv = body.wv;
    const nv = wv.length;
    const d = new Float64Array(nv);
    for (let i = 0; i < nv; i++) d[i] = dot(sub(wv[i], vb.o), vb.n) - offset;
    const positions = [], normals = [], cells = [], outline = [];
    const edgePoint = new Map();
    poly.cells.forEach((cell, ci) => {
      const nw = mulMV(body.R, cell.n);
      const N = [dot(nw, vb.e1), dot(nw, vb.e2), dot(nw, vb.e3)];
      const Nl = Math.hypot(N[0], N[1], N[2]);
      if (Nl < 1e-6) return; // cell parallel to the slice
      N[0] /= Nl; N[1] /= Nl; N[2] /= Nl;
      const pts = [];
      for (const ei of poly.cellEdges[ci]) {
        const [a, b] = poly.edges[ei];
        const da = d[a], db = d[b];
        if ((da > 0) === (db > 0)) continue;
        let q = edgePoint.get(ei);
        if (!q) {
          const t = da / (da - db);
          q = project(lerp(wv[a], wv[b], t), vb);
          edgePoint.set(ei, q);
        }
        if (!pts.some((x) => Math.abs(x[0] - q[0]) + Math.abs(x[1] - q[1]) + Math.abs(x[2] - q[2]) < 1e-7)) pts.push(q);
      }
      if (pts.length < 3) return;
      const c = [0, 0, 0];
      for (const q of pts) { c[0] += q[0]; c[1] += q[1]; c[2] += q[2]; }
      c[0] /= pts.length; c[1] /= pts.length; c[2] /= pts.length;
      let u = [pts[0][0] - c[0], pts[0][1] - c[1], pts[0][2] - c[2]];
      const ul = Math.hypot(u[0], u[1], u[2]) || 1;
      u = [u[0] / ul, u[1] / ul, u[2] / ul];
      const w = [N[1] * u[2] - N[2] * u[1], N[2] * u[0] - N[0] * u[2], N[0] * u[1] - N[1] * u[0]];
      pts.sort((p, q) => {
        const ap = Math.atan2((p[0] - c[0]) * w[0] + (p[1] - c[1]) * w[1] + (p[2] - c[2]) * w[2], (p[0] - c[0]) * u[0] + (p[1] - c[1]) * u[1] + (p[2] - c[2]) * u[2]);
        const aq = Math.atan2((q[0] - c[0]) * w[0] + (q[1] - c[1]) * w[1] + (q[2] - c[2]) * w[2], (q[0] - c[0]) * u[0] + (q[1] - c[1]) * u[1] + (q[2] - c[2]) * u[2]);
        return ap - aq;
      });
      for (let i = 1; i + 1 < pts.length; i++) {
        positions.push(...pts[0], ...pts[i], ...pts[i + 1]);
        normals.push(...N, ...N, ...N);
        cells.push(ci, ci, ci);
      }
      for (let i = 0; i < pts.length; i++) outline.push(...pts[i], ...pts[(i + 1) % pts.length]);
    });
    return { positions, normals, cells, outline };
  }

  // Cross-section of a hypersphere: a sphere (centre in slice coordinates).
  function sliceSphere(body, vb, offset = 0) {
    const dist = dot(sub(body.pos, vb.o), vb.n) - offset;
    if (Math.abs(dist) >= body.radius) return null;
    return { center: project(body.pos, vb), radius: Math.sqrt(body.radius * body.radius - dist * dist), depth: dist };
  }

  return {
    World4, Body4, Polytope,
    v4, add, sub, scale, mad, dot, len, norm, lerp, cross3, clamp,
    identity, mulMV, mulMtV, mulMM, transpose, column, planeRotation, orthonormalize,
    wedge, bivApply, dot6, omegaMatrix, bivectorRotation, PAIRS,
    closestPointOnHull, viewBasis, project, depthRange, slicePolytope, sliceSphere,
  };
});

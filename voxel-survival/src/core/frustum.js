/**
 * View-frustum culling.
 *
 * The six clip planes are extracted straight from the view-projection matrix
 * (Gribb & Hartmann), which avoids tracking camera basis vectors separately.
 */
export class Frustum {
  constructor() {
    this.planes = new Float32Array(24); // 6 planes x (a, b, c, d)
  }

  /** @param {Float32Array} m column-major view-projection matrix */
  update(m) {
    const p = this.planes;
    // Rows of the matrix, given column-major storage m[col * 4 + row].
    const r0 = [m[0], m[4], m[8], m[12]];
    const r1 = [m[1], m[5], m[9], m[13]];
    const r2 = [m[2], m[6], m[10], m[14]];
    const r3 = [m[3], m[7], m[11], m[15]];

    const set = (i, a, b, c, d) => {
      const len = Math.hypot(a, b, c) || 1;
      p[i * 4] = a / len;
      p[i * 4 + 1] = b / len;
      p[i * 4 + 2] = c / len;
      p[i * 4 + 3] = d / len;
    };

    set(0, r3[0] + r0[0], r3[1] + r0[1], r3[2] + r0[2], r3[3] + r0[3]); // left
    set(1, r3[0] - r0[0], r3[1] - r0[1], r3[2] - r0[2], r3[3] - r0[3]); // right
    set(2, r3[0] + r1[0], r3[1] + r1[1], r3[2] + r1[2], r3[3] + r1[3]); // bottom
    set(3, r3[0] - r1[0], r3[1] - r1[1], r3[2] - r1[2], r3[3] - r1[3]); // top
    set(4, r3[0] + r2[0], r3[1] + r2[1], r3[2] + r2[2], r3[3] + r2[3]); // near
    set(5, r3[0] - r2[0], r3[1] - r2[1], r3[2] - r2[2], r3[3] - r2[3]); // far
  }

  /** True if the axis-aligned box is at least partly inside the frustum. */
  intersectsBox(minX, minY, minZ, maxX, maxY, maxZ) {
    const p = this.planes;
    for (let i = 0; i < 6; i++) {
      const a = p[i * 4];
      const b = p[i * 4 + 1];
      const c = p[i * 4 + 2];
      const d = p[i * 4 + 3];
      // Test the box corner furthest along the plane normal ("positive vertex").
      const vx = a >= 0 ? maxX : minX;
      const vy = b >= 0 ? maxY : minY;
      const vz = c >= 0 ? maxZ : minZ;
      if (a * vx + b * vy + c * vz + d < 0) return false;
    }
    return true;
  }
}

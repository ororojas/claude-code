import { BLOCK } from './blocks.js';

/**
 * Voxel ray traversal (Amanatides & Woo).
 *
 * Steps cell-by-cell along the ray instead of sampling at fixed intervals, so
 * it can never tunnel through a thin wall and always reports the exact face it
 * entered through — which is what block placement needs.
 *
 * @param {{getBlock:(x:number,y:number,z:number)=>number}} world
 * @param {number[]} origin  ray start in world space
 * @param {number[]} dir     normalised direction
 * @param {number} maxDistance
 * @param {(id:number)=>boolean} [hits] which block ids count as a hit
 * @returns {{x,y,z, nx,ny,nz, distance}|null}
 */
export function raycast(world, origin, dir, maxDistance, hits = (id) => id !== BLOCK.AIR) {
  let x = Math.floor(origin[0]);
  let y = Math.floor(origin[1]);
  let z = Math.floor(origin[2]);

  const [dx, dy, dz] = dir;
  const stepX = dx > 0 ? 1 : dx < 0 ? -1 : 0;
  const stepY = dy > 0 ? 1 : dy < 0 ? -1 : 0;
  const stepZ = dz > 0 ? 1 : dz < 0 ? -1 : 0;

  // Distance along the ray to the next cell boundary on each axis.
  const tDeltaX = dx === 0 ? Infinity : Math.abs(1 / dx);
  const tDeltaY = dy === 0 ? Infinity : Math.abs(1 / dy);
  const tDeltaZ = dz === 0 ? Infinity : Math.abs(1 / dz);

  const boundary = (o, i, step) => (step > 0 ? i + 1 - o : o - i);
  let tMaxX = dx === 0 ? Infinity : boundary(origin[0], x, stepX) * tDeltaX;
  let tMaxY = dy === 0 ? Infinity : boundary(origin[1], y, stepY) * tDeltaY;
  let tMaxZ = dz === 0 ? Infinity : boundary(origin[2], z, stepZ) * tDeltaZ;

  let nx = 0;
  let ny = 0;
  let nz = 0;
  let distance = 0;

  // The camera may already be inside a block; test the starting cell first.
  if (hits(world.getBlock(x, y, z))) {
    return { x, y, z, nx: 0, ny: 1, nz: 0, distance: 0 };
  }

  while (distance <= maxDistance) {
    if (tMaxX < tMaxY && tMaxX < tMaxZ) {
      x += stepX;
      distance = tMaxX;
      tMaxX += tDeltaX;
      nx = -stepX;
      ny = 0;
      nz = 0;
    } else if (tMaxY < tMaxZ) {
      y += stepY;
      distance = tMaxY;
      tMaxY += tDeltaY;
      nx = 0;
      ny = -stepY;
      nz = 0;
    } else {
      z += stepZ;
      distance = tMaxZ;
      tMaxZ += tDeltaZ;
      nx = 0;
      ny = 0;
      nz = -stepZ;
    }

    if (distance > maxDistance) break;
    if (hits(world.getBlock(x, y, z))) {
      return { x, y, z, nx, ny, nz, distance };
    }
  }

  return null;
}

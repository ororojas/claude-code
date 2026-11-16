import { FOV, NEAR_PLANE, FAR_PLANE } from '../config.js';
import { mat4, perspective, lookAt, multiply, invert, forwardFromAngles } from '../core/math.js';

/**
 * First-person camera. Holds the matrices the renderer needs and keeps a cached
 * inverse view-projection for the sky shader's ray reconstruction.
 */
export class Camera {
  constructor() {
    this.projection = mat4();
    this.view = mat4();
    this.viewProj = mat4();
    this.invViewProj = mat4();
    this.position = [0, 0, 0];
    this.aspect = 1;
    this.fov = FOV;
  }

  resize(width, height) {
    this.aspect = width / Math.max(1, height);
  }

  /**
   * @param {number[]} eye world-space eye position
   * @param {number} yaw
   * @param {number} pitch
   * @param {number} [fovScale] multiplier used for the sprint FOV kick
   */
  update(eye, yaw, pitch, fovScale = 1) {
    this.position[0] = eye[0];
    this.position[1] = eye[1];
    this.position[2] = eye[2];

    perspective(this.projection, this.fov * fovScale, this.aspect, NEAR_PLANE, FAR_PLANE);

    const f = forwardFromAngles(yaw, pitch);
    const target = [eye[0] + f[0], eye[1] + f[1], eye[2] + f[2]];
    lookAt(this.view, eye, target, [0, 1, 0]);

    multiply(this.viewProj, this.projection, this.view);
    invert(this.invViewProj, this.viewProj);
  }
}

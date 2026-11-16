import {
  CHUNK_SIZE,
  CHUNK_HEIGHT,
  RENDER_DISTANCE,
  FOG_START_RATIO,
  ATLAS_TILE,
} from '../config.js';
import { createContext, createProgram, createTileArrayTexture } from '../core/gl.js';
import {
  CHUNK_VERT,
  CHUNK_FRAG,
  SKY_VERT,
  SKY_FRAG,
  LINE_VERT,
  LINE_FRAG,
} from '../core/shaders.js';
import { createAtlasCanvas, createTileLayers, TILE_COUNT } from '../core/atlas.js';
import { Frustum } from '../core/frustum.js';
import { FLOATS_PER_VERTEX } from '../world/mesher.js';

const BYTES_PER_VERTEX = FLOATS_PER_VERTEX * 4;

/** Unit-cube edges for the block-selection wireframe. */
function buildOutlineVertices() {
  const e = -0.002; // grown a hair so the lines clear the block surface
  const s = 1 - e * 2;
  const c = [
    [0, 0, 0],
    [1, 0, 0],
    [1, 0, 1],
    [0, 0, 1],
    [0, 1, 0],
    [1, 1, 0],
    [1, 1, 1],
    [0, 1, 1],
  ].map(([x, y, z]) => [e + x * s, e + y * s, e + z * s]);

  const edges = [
    [0, 1],
    [1, 2],
    [2, 3],
    [3, 0],
    [4, 5],
    [5, 6],
    [6, 7],
    [7, 4],
    [0, 4],
    [1, 5],
    [2, 6],
    [3, 7],
  ];

  const data = new Float32Array(edges.length * 6);
  edges.forEach(([a, b], i) => data.set([...c[a], ...c[b]], i * 6));
  return data;
}

/**
 * Owns every GPU resource and draws one frame.
 *
 * Chunk meshes live in a Map keyed by the chunk object itself, so unloading a
 * chunk cannot leak its buffers.
 */
export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    const gl = createContext(canvas);
    this.gl = gl;

    this.chunkProgram = createProgram(gl, CHUNK_VERT, CHUNK_FRAG);
    this.skyProgram = createProgram(gl, SKY_VERT, SKY_FRAG);
    this.lineProgram = createProgram(gl, LINE_VERT, LINE_FRAG);

    // The array texture is what the world shader samples; the canvas version of
    // the same tiles is kept only so the HUD can blit block icons.
    this.atlas = createTileArrayTexture(gl, createTileLayers(), ATLAS_TILE, TILE_COUNT);
    this.atlasCanvas = createAtlasCanvas();

    /** @type {Map<object, object>} chunk -> GPU buffers */
    this.meshes = new Map();
    this.frustum = new Frustum();

    // Sky needs a bound VAO even though it sources no attributes.
    this.emptyVao = gl.createVertexArray();

    this.outlineVao = gl.createVertexArray();
    this.outlineVbo = gl.createBuffer();
    gl.bindVertexArray(this.outlineVao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.outlineVbo);
    gl.bufferData(gl.ARRAY_BUFFER, buildOutlineVertices(), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 12, 0);
    gl.bindVertexArray(null);

    gl.enable(gl.CULL_FACE);
    gl.cullFace(gl.BACK);
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    this.stats = { drawnChunks: 0, culledChunks: 0, triangles: 0 };
  }

  /** Resize the drawing buffer to match CSS size and device pixel ratio. */
  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const width = Math.floor(this.canvas.clientWidth * dpr);
    const height = Math.floor(this.canvas.clientHeight * dpr);
    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width;
      this.canvas.height = height;
    }
    return { width, height };
  }

  /** Create or update one chunk's GPU buffers. Called by the world streamer. */
  uploadChunkMesh(chunk, mesh) {
    const gl = this.gl;
    let entry = this.meshes.get(chunk);
    if (!entry) {
      entry = {
        opaque: this.createBufferSet(),
        water: this.createBufferSet(),
      };
      this.meshes.set(chunk, entry);
    }
    this.uploadBufferSet(entry.opaque, mesh.opaque);
    this.uploadBufferSet(entry.water, mesh.water);
  }

  createBufferSet() {
    const gl = this.gl;
    const vao = gl.createVertexArray();
    const vbo = gl.createBuffer();
    gl.bindVertexArray(vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    // aPos(3) aUV(2) aLayer(1) aOcc(1) aSky(1) aGlow(1)
    const layout = [
      [0, 3, 0],
      [1, 2, 12],
      [2, 1, 20],
      [3, 1, 24],
      [4, 1, 28],
      [5, 1, 32],
    ];
    for (const [location, size, offset] of layout) {
      gl.enableVertexAttribArray(location);
      gl.vertexAttribPointer(location, size, gl.FLOAT, false, BYTES_PER_VERTEX, offset);
    }
    gl.bindVertexArray(null);
    return { vao, vbo, count: 0 };
  }

  uploadBufferSet(set, data) {
    const gl = this.gl;
    set.count = data.length / FLOATS_PER_VERTEX;
    gl.bindBuffer(gl.ARRAY_BUFFER, set.vbo);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
  }

  /** Release a chunk's GPU buffers. */
  disposeChunkMesh(chunk) {
    const entry = this.meshes.get(chunk);
    if (!entry) return;
    const gl = this.gl;
    for (const set of [entry.opaque, entry.water]) {
      gl.deleteBuffer(set.vbo);
      gl.deleteVertexArray(set.vao);
    }
    this.meshes.delete(chunk);
  }

  /**
   * Draw one frame.
   * @param {object} view    {camera, underwater}
   * @param {import('../game/daynight.js').DayNight} sky
   * @param {{x:number,y:number,z:number}|null} highlight targeted block
   */
  render(view, sky, highlight) {
    const gl = this.gl;
    const { camera, underwater } = view;
    const { width, height } = this.resize();

    gl.viewport(0, 0, width, height);
    gl.clearColor(sky.fogColor[0], sky.fogColor[1], sky.fogColor[2], 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    this.drawSky(camera, sky, underwater);

    const fogEnd = underwater ? 26 : RENDER_DISTANCE * CHUNK_SIZE * 0.96;
    const fogStart = underwater ? 2 : fogEnd * FOG_START_RATIO;
    this.drawChunks(camera, sky, underwater, fogStart, fogEnd);

    if (highlight) this.drawOutline(camera, highlight);

    this.drawWater(camera, sky, underwater, fogStart, fogEnd);
  }

  drawSky(camera, sky, underwater) {
    const gl = this.gl;
    const p = this.skyProgram;
    gl.useProgram(p);
    gl.disable(gl.DEPTH_TEST);
    gl.depthMask(false);

    gl.uniformMatrix4fv(p.uniforms.uInvViewProj, false, camera.invViewProj);
    gl.uniform3fv(p.uniforms.uCameraPos, camera.position);
    gl.uniform3fv(p.uniforms.uSunDir, sky.sunDir);
    gl.uniform3fv(
      p.uniforms.uSkyTop,
      underwater ? new Float32Array([0.05, 0.2, 0.34]) : sky.skyTop
    );
    gl.uniform3fv(
      p.uniforms.uSkyHorizon,
      underwater ? new Float32Array([0.08, 0.28, 0.42]) : sky.skyHorizon
    );
    gl.uniform3fv(p.uniforms.uSunTint, sky.sunTint);
    gl.uniform1f(p.uniforms.uDaylight, sky.daylight);
    gl.uniform1f(p.uniforms.uStarAmount, underwater ? 0 : sky.starAmount);

    gl.bindVertexArray(this.emptyVao);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.bindVertexArray(null);

    gl.enable(gl.DEPTH_TEST);
    gl.depthMask(true);
  }

  /** Bind the chunk program and set the uniforms shared by both chunk passes. */
  beginChunkPass(camera, sky, underwater, fogStart, fogEnd, alphaCutoff) {
    const gl = this.gl;
    const p = this.chunkProgram;
    gl.useProgram(p);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D_ARRAY, this.atlas);
    gl.uniform1i(p.uniforms.uAtlas, 0);
    gl.uniformMatrix4fv(p.uniforms.uViewProj, false, camera.viewProj);
    gl.uniform3fv(p.uniforms.uCameraPos, camera.position);
    gl.uniform3fv(p.uniforms.uSkyTint, sky.skyTint);
    gl.uniform3fv(
      p.uniforms.uFogColor,
      underwater ? new Float32Array([0.1, 0.3, 0.45]) : sky.fogColor
    );
    gl.uniform1f(p.uniforms.uFogStart, fogStart);
    gl.uniform1f(p.uniforms.uFogEnd, fogEnd);
    gl.uniform1f(p.uniforms.uAlphaCutoff, alphaCutoff);
    gl.uniform1f(p.uniforms.uUnderwater, underwater ? 1 : 0);
    return p;
  }

  drawChunks(camera, sky, underwater, fogStart, fogEnd) {
    const gl = this.gl;
    const p = this.beginChunkPass(camera, sky, underwater, fogStart, fogEnd, 0.5);
    this.frustum.update(camera.viewProj);

    this.stats.drawnChunks = 0;
    this.stats.culledChunks = 0;
    this.stats.triangles = 0;

    for (const [chunk, entry] of this.meshes) {
      if (entry.opaque.count === 0) continue;
      if (!this.chunkVisible(chunk)) {
        this.stats.culledChunks++;
        continue;
      }
      gl.uniform3f(p.uniforms.uChunkOrigin, chunk.originX, 0, chunk.originZ);
      gl.bindVertexArray(entry.opaque.vao);
      gl.drawArrays(gl.TRIANGLES, 0, entry.opaque.count);
      this.stats.drawnChunks++;
      this.stats.triangles += entry.opaque.count / 3;
    }
    gl.bindVertexArray(null);
  }

  drawWater(camera, sky, underwater, fogStart, fogEnd) {
    const gl = this.gl;

    // Collect visible water chunks and draw far-to-near: with depth writes off,
    // painter's order is what keeps overlapping surfaces blending correctly.
    const visible = [];
    for (const [chunk, entry] of this.meshes) {
      if (entry.water.count === 0 || !this.chunkVisible(chunk)) continue;
      const dx = chunk.originX + CHUNK_SIZE / 2 - camera.position[0];
      const dz = chunk.originZ + CHUNK_SIZE / 2 - camera.position[2];
      visible.push({ chunk, entry, d2: dx * dx + dz * dz });
    }
    if (visible.length === 0) return;
    visible.sort((a, b) => b.d2 - a.d2);

    const p = this.beginChunkPass(camera, sky, underwater, fogStart, fogEnd, 0.02);
    gl.enable(gl.BLEND);
    gl.depthMask(false);
    // Water surfaces are visible from below too, so both faces must be drawn.
    gl.disable(gl.CULL_FACE);

    for (const { chunk, entry } of visible) {
      gl.uniform3f(p.uniforms.uChunkOrigin, chunk.originX, 0, chunk.originZ);
      gl.bindVertexArray(entry.water.vao);
      gl.drawArrays(gl.TRIANGLES, 0, entry.water.count);
      this.stats.triangles += entry.water.count / 3;
    }

    gl.bindVertexArray(null);
    gl.enable(gl.CULL_FACE);
    gl.depthMask(true);
    gl.disable(gl.BLEND);
  }

  chunkVisible(chunk) {
    return this.frustum.intersectsBox(
      chunk.originX,
      0,
      chunk.originZ,
      chunk.originX + CHUNK_SIZE,
      CHUNK_HEIGHT,
      chunk.originZ + CHUNK_SIZE
    );
  }

  drawOutline(camera, block) {
    const gl = this.gl;
    const p = this.lineProgram;
    gl.useProgram(p);
    gl.uniformMatrix4fv(p.uniforms.uViewProj, false, camera.viewProj);
    gl.uniform3f(p.uniforms.uOffset, block.x, block.y, block.z);
    gl.uniform4f(p.uniforms.uColor, 0.05, 0.05, 0.07, 0.9);
    gl.bindVertexArray(this.outlineVao);
    gl.drawArrays(gl.LINES, 0, 24);
    gl.bindVertexArray(null);
  }
}

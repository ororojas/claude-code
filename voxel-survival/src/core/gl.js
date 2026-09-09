/**
 * Thin WebGL2 helpers. Deliberately small: just enough to remove the repetitive
 * error-checking boilerplate without hiding what the GL calls actually do.
 */

export function createContext(canvas) {
  const gl = canvas.getContext('webgl2', {
    antialias: false, // crisp voxel edges; MSAA blurs the pixel-art look
    alpha: false,
    depth: true,
    powerPreference: 'high-performance',
  });
  if (!gl) {
    throw new Error(
      'WebGL2 is not available in this browser. Try a recent Chrome, Firefox, Edge or Safari.'
    );
  }
  return gl;
}

function compileShader(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader);
    const kind = type === gl.VERTEX_SHADER ? 'vertex' : 'fragment';
    gl.deleteShader(shader);
    throw new Error(`${kind} shader failed to compile:\n${log}`);
  }
  return shader;
}

/**
 * Compile and link a program, then cache every active uniform location on it.
 * @returns {WebGLProgram & {uniforms: Record<string, WebGLUniformLocation>}}
 */
export function createProgram(gl, vertexSource, fragmentSource) {
  const vs = compileShader(gl, gl.VERTEX_SHADER, vertexSource);
  const fs = compileShader(gl, gl.FRAGMENT_SHADER, fragmentSource);
  const program = gl.createProgram();
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  // Shaders are reference-counted by the program, so they can be released now.
  gl.deleteShader(vs);
  gl.deleteShader(fs);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const log = gl.getProgramInfoLog(program);
    gl.deleteProgram(program);
    throw new Error(`program failed to link:\n${log}`);
  }

  const uniforms = {};
  const count = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS);
  for (let i = 0; i < count; i++) {
    const info = gl.getActiveUniform(program, i);
    uniforms[info.name] = gl.getUniformLocation(program, info.name);
  }
  program.uniforms = uniforms;
  return program;
}

/**
 * Upload block tiles as a 2D texture array — one tile per layer.
 *
 * This is what makes mipmapping usable. With a flat atlas, a lower mip level
 * averages texels across tile borders and bleeds neighbouring blocks into each
 * other; with an array, each layer is mipmapped independently. Mipmaps in turn
 * kill the shimmering moire that nearest-filtered ground shows at grazing
 * angles, while MAG_FILTER stays NEAREST so close-up blocks remain crisp
 * pixel art.
 *
 * @param {WebGL2RenderingContext} gl
 * @param {Uint8Array} data   RGBA bytes, `layers` tiles back to back
 * @param {number} size       tile edge length in pixels
 * @param {number} layers
 */
export function createTileArrayTexture(gl, data, size, layers) {
  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D_ARRAY, texture);
  gl.pixelStorei(gl.UNPACK_ALIGNMENT, 4);
  gl.texImage3D(
    gl.TEXTURE_2D_ARRAY,
    0,
    gl.RGBA8,
    size,
    size,
    layers,
    0,
    gl.RGBA,
    gl.UNSIGNED_BYTE,
    data
  );
  gl.generateMipmap(gl.TEXTURE_2D_ARRAY);

  // NEAREST within a mip level keeps texels crisp and preserves the pixel-art
  // look; LINEAR between levels is what removes the distance shimmer.
  gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MIN_FILTER, gl.NEAREST_MIPMAP_LINEAR);
  gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

  // Anisotropic filtering, where available, is the single biggest win for
  // ground planes viewed at a shallow angle.
  const aniso =
    gl.getExtension('EXT_texture_filter_anisotropic') ||
    gl.getExtension('WEBKIT_EXT_texture_filter_anisotropic');
  if (aniso) {
    const max = gl.getParameter(aniso.MAX_TEXTURE_MAX_ANISOTROPY_EXT);
    gl.texParameterf(gl.TEXTURE_2D_ARRAY, aniso.TEXTURE_MAX_ANISOTROPY_EXT, Math.min(8, max));
  }

  gl.bindTexture(gl.TEXTURE_2D_ARRAY, null);
  return texture;
}

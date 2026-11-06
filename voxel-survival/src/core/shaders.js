/**
 * GLSL ES 3.00 sources.
 *
 * Lighting model, shared by every solid surface:
 *   colour = texel * (ambient + skylight * skyTint) * occlusion + lampGlow
 * where `skylight` is baked per-face by the mesher and `skyTint` swings from a
 * cool night blue to warm sunlight as the day/night cycle advances.
 */

export const CHUNK_VERT = `#version 300 es
precision highp float;

layout(location = 0) in vec3 aPos;
layout(location = 1) in vec2 aUV;
layout(location = 2) in float aLayer;
layout(location = 3) in float aOcc;
layout(location = 4) in float aSky;
layout(location = 5) in float aGlow;

uniform mat4 uViewProj;
uniform vec3 uChunkOrigin;
uniform vec3 uCameraPos;

out vec2 vUV;
// The tile index must not be interpolated across the triangle.
flat out int vLayer;
out float vOcc;
out float vSky;
out float vGlow;
out float vDist;

void main() {
  vec3 world = aPos + uChunkOrigin;
  gl_Position = uViewProj * vec4(world, 1.0);
  vUV = aUV;
  vLayer = int(aLayer);
  vOcc = aOcc;
  vSky = aSky;
  vGlow = aGlow;
  vDist = distance(world, uCameraPos);
}`;

export const CHUNK_FRAG = `#version 300 es
precision highp float;
// GLSL ES 3.00 defines no default precision for sampler2DArray, unlike float.
precision highp sampler2DArray;

in vec2 vUV;
flat in int vLayer;
in float vOcc;
in float vSky;
in float vGlow;
in float vDist;

uniform sampler2DArray uAtlas;
uniform vec3 uSkyTint;
uniform vec3 uFogColor;
uniform float uFogStart;
uniform float uFogEnd;
uniform float uAlphaCutoff;
uniform float uUnderwater;

out vec4 outColor;

const vec3 AMBIENT = vec3(0.13);
const vec3 LAMP_TINT = vec3(1.00, 0.86, 0.62);

void main() {
  vec4 texel = texture(uAtlas, vec3(vUV, float(vLayer)));
  if (texel.a < uAlphaCutoff) discard;

  vec3 lighting = (AMBIENT + uSkyTint * vSky) * vOcc + LAMP_TINT * vGlow;
  vec3 color = texel.rgb * clamp(lighting, 0.0, 1.6);

  // Underwater tints everything and pulls the fog in close.
  if (uUnderwater > 0.5) {
    color = mix(color, vec3(0.12, 0.32, 0.55), 0.45);
  }

  float fog = smoothstep(uFogStart, uFogEnd, vDist);
  color = mix(color, uFogColor, fog);

  outColor = vec4(color, texel.a);
}`;

/**
 * Sky is drawn as a single full-screen triangle generated from gl_VertexID, so
 * it needs no vertex buffer at all. The fragment shader turns each pixel back
 * into a world-space view ray via the inverse view-projection matrix.
 */
export const SKY_VERT = `#version 300 es
precision highp float;

out vec2 vNdc;

void main() {
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  vNdc = p * 2.0 - 1.0;
  gl_Position = vec4(vNdc, 1.0, 1.0);
}`;

export const SKY_FRAG = `#version 300 es
precision highp float;

in vec2 vNdc;

uniform mat4 uInvViewProj;
uniform vec3 uCameraPos;
uniform vec3 uSunDir;
uniform vec3 uSkyTop;
uniform vec3 uSkyHorizon;
uniform vec3 uSunTint;
uniform float uDaylight;
uniform float uStarAmount;

out vec4 outColor;

float hash13(vec3 p) {
  p = fract(p * 0.3183099 + vec3(0.71, 0.113, 0.419));
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}

void main() {
  vec4 far = uInvViewProj * vec4(vNdc, 1.0, 1.0);
  vec3 dir = normalize(far.xyz / far.w - uCameraPos);

  float height = clamp(dir.y * 0.5 + 0.5, 0.0, 1.0);
  vec3 color = mix(uSkyHorizon, uSkyTop, pow(smoothstep(0.0, 1.0, height), 0.7));

  // Stars fade in as the sun sets and are masked below the horizon.
  if (uStarAmount > 0.001 && dir.y > -0.05) {
    vec3 cell = floor(dir * 260.0);
    float star = hash13(cell);
    if (star > 0.9972) {
      float twinkle = 0.45 + 0.55 * hash13(cell + 3.7);
      color += vec3(0.95, 0.96, 1.0) * uStarAmount * twinkle * smoothstep(-0.05, 0.2, dir.y);
    }
  }

  float sunDot = max(dot(dir, uSunDir), 0.0);
  color += uSunTint * pow(sunDot, 1400.0) * 6.0;              // sun disc
  color += uSunTint * pow(sunDot, 6.0) * 0.22 * uDaylight;     // daytime bloom

  float moonDot = max(dot(dir, -uSunDir), 0.0);
  color += vec3(0.86, 0.90, 1.0) * pow(moonDot, 2600.0) * 4.0 * (1.0 - uDaylight);

  outColor = vec4(color, 1.0);
}`;

/** Wireframe outline around the block the player is aiming at. */
export const LINE_VERT = `#version 300 es
precision highp float;

layout(location = 0) in vec3 aPos;

uniform mat4 uViewProj;
uniform vec3 uOffset;

void main() {
  gl_Position = uViewProj * vec4(aPos + uOffset, 1.0);
}`;

export const LINE_FRAG = `#version 300 es
precision highp float;

uniform vec4 uColor;
out vec4 outColor;

void main() {
  outColor = uColor;
}`;

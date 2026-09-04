// CRT shaders adapted from https://labs.cuvii.dev/volume/phosphor?look=electron-sweep

export const vertexSource = `#version 300 es
void main() {
  vec2 p = vec2(gl_VertexID == 2 ? 3.0 : -1.0, gl_VertexID == 1 ? 3.0 : -1.0);
  gl_Position = vec4(p, 0.0, 1.0);
}
`;

export const crtSource = `#version 300 es
precision highp float;
precision highp int;

uniform sampler2D uSource;
uniform vec2 uSourceSize;
uniform float uElapsed;
uniform float uPhase;
uniform float uMotion;
uniform int uWidth;
uniform int uHeight;

out vec4 fragColor;

float hash(float n) {
  return fract(sin(n * 127.1) * 43758.5453);
}

float clamp01(float value) {
  return clamp(value, 0.0, 1.0);
}

vec4 fetchSource(float sx, float sy) {
  int width = int(uSourceSize.x);
  int height = int(uSourceSize.y);
  int ix = clamp(int(trunc(sx)), 0, width - 1);
  int iy = clamp(int(trunc(sy)), 0, height - 1);
  // Canvas uploads are flipped so top-down source coordinates stay identical
  // to the former Canvas2D getImageData sampler.
  vec4 sampleColor = texelFetch(uSource, ivec2(ix, height - 1 - iy), 0);
  // The 2D engine painted the source over an opaque black canvas before
  // getImageData(). Transparent glow pixels therefore arrived as rgb * alpha,
  // not as the unassociated RGB returned by a direct WebGL canvas upload.
  return vec4(sampleColor.rgb * sampleColor.a, 1.0);
}

void main() {
  int x = int(gl_FragCoord.x);
  int y = uHeight - 1 - int(gl_FragCoord.y);
  float sourceY = float(y);
  float wobble = 0.2 * uMotion * sin(uElapsed * 0.09 + float(y) * 0.28);
  float scan = (y - (y / 2) * 2) == 0 ? 1.0 : 1.0 - 0.22;
  float beamY = uPhase * (float(uHeight) + 16.0) - 8.0;
  float beam = clamp01(1.0 - abs(float(y) - beamY) / 3.5);
  float sourceX = float(x) + wobble;

  float r = fetchSource(sourceX + 1.4, sourceY - 1.4 * 0.15).r;
  float g = fetchSource(sourceX, sourceY).g;
  float b = fetchSource(sourceX - 1.4, sourceY + 1.4 * 0.12).b;
  float cover = max(r, max(g, b));

  if (cover < 6.0 / 255.0) {
    fragColor = vec4(0.0);
    return;
  }

  int triad = x - (x / 3) * 3;
  float maskR = triad == 0 ? 1.08 : 0.72;
  float maskG = triad == 1 ? 1.08 : 0.72;
  float maskB = triad == 2 ? 1.08 : 0.72;
  float grainFrame = floor(float(x) * 13.0 + float(y) * 7.0 + uElapsed * 0.08);
  float grain = (hash(grainFrame) - 0.5) * (22.0 / 255.0) * 0.35;
  float lineGain = scan + beam * 0.85;
  float flicker = 0.92 + 0.08 * sin(uElapsed * 0.017) * uMotion;
  vec3 color = vec3(
    r * maskR * lineGain + grain,
    g * maskG * lineGain + grain,
    b * maskB * lineGain + grain
  ) * flicker;
  float alpha = min(1.0, cover * 1.2);

  fragColor = vec4(clamp(color, 0.0, 1.0), alpha);
}
`;

export const blurSource = `#version 300 es
precision highp float;
precision highp int;

uniform sampler2D uSource;
uniform vec2 uDirection;
uniform float uRadius;
uniform int uWidth;
uniform int uHeight;

out vec4 fragColor;

vec4 fetchSource(vec2 p) {
  ivec2 ip = ivec2(round(p));
  ip.x = clamp(ip.x, 0, uWidth - 1);
  ip.y = clamp(ip.y, 0, uHeight - 1);
  vec4 sampleColor = texelFetch(uSource, ip, 0);
  return vec4(sampleColor.rgb * sampleColor.a, sampleColor.a);
}

void main() {
  vec2 p = gl_FragCoord.xy;
  float scale = max(0.4, uRadius * 0.25);
  vec2 nearOffset = uDirection * 1.3846153846 * scale;
  vec2 farOffset = uDirection * 3.2307692308 * scale;
  vec4 color = fetchSource(p) * 0.2270270270;
  color += fetchSource(p + nearOffset) * 0.3162162162;
  color += fetchSource(p - nearOffset) * 0.3162162162;
  color += fetchSource(p + farOffset) * 0.0702702703;
  color += fetchSource(p - farOffset) * 0.0702702703;
  // Bloom targets carry premultiplied light in RGB. Their alpha is kept at
  // one so the vertical pass does not multiply edge coverage a second time.
  fragColor = vec4(color.rgb, 1.0);
}
`;

export const compositeSource = `#version 300 es
precision highp float;
precision highp int;

uniform sampler2D uCrt;
uniform sampler2D uBloom;
uniform int uWidth;
uniform int uHeight;

out vec4 fragColor;

vec4 fetchTarget(sampler2D target, ivec2 p) {
  p.x = clamp(p.x, 0, uWidth - 1);
  p.y = clamp(p.y, 0, uHeight - 1);
  return texelFetch(target, p, 0);
}

void main() {
  ivec2 p = ivec2(gl_FragCoord.xy);
  vec4 crt = fetchTarget(uCrt, p);
  vec3 bloom = fetchTarget(uBloom, p).rgb * 0.26;
  fragColor = vec4(clamp(crt.rgb + bloom, 0.0, 1.0), crt.a);
}
`;

export const outlineSource = `#version 300 es
precision highp float;
uniform sampler2D uSource;
uniform vec2 uSourceSize;
out vec4 fragColor;

void main() {
  vec2 uv = gl_FragCoord.xy / uSourceSize;
  vec4 base = texture(uSource, uv);
  float outline = base.a;
  for (int i = 0; i < 16; i++) {
    float angle = float(i) * 6.2831853 / 16.0;
    vec2 offset = vec2(cos(angle), sin(angle)) * 3.5 / uSourceSize;
    outline = max(outline, texture(uSource, uv + offset).a);
  }
  float white = outline * (1.0 - base.a);
  float alpha = base.a + white;
  fragColor = alpha > 0.0 ? vec4((base.rgb * base.a + vec3(white)) / alpha, alpha) : vec4(0.0);
}`;

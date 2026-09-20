import { COMMON } from "./shaders";

export const KOI_VS = `#version 300 es
layout(location=0) in vec2 aPos;
layout(location=1) in vec2 aLocal;
layout(location=2) in vec2 aTangent;
uniform vec2 uOffset;
out vec2 vLocal;
out vec2 vTangent;
void main(){
  vLocal = aLocal;
  vTangent = aTangent;
  vec2 p = aPos + uOffset;
  gl_Position = vec4(p / vec2(3.0, 1.0) * 2.0 - 1.0, 0.0, 1.0);
}
`;

export const KOI_FS = `#version 300 es
precision highp float;
in vec2 vLocal;
in vec2 vTangent;
uniform int uPalette;
uniform float uSeed;
uniform float uPhase;
uniform bool uShadow;
out vec4 fragColor;
${COMMON}

float bodyWidth(float u){
  float shoulder = mix(0.108, 0.156, smoothstep(0.03, 0.25, u));
  float taper = 1.0 - smoothstep(0.28, 1.04, u);
  float nose = sqrt(max(0.0, 1.0 - pow(clamp((0.065 - u) / 0.065, 0.0, 1.0), 2.0)));
  return (0.016 + shoulder * taper) * nose;
}

vec2 fin(vec2 q, vec2 root, float direction, float spread, float reach, float fork, float rays, float aa){
  vec2 d = q - root;
  float angle = atan(d.y, d.x) - direction;
  angle = atan(sin(angle), cos(angle));
  float across = abs(angle) / spread;
  float radius = reach * pow(max(0.0, 1.0 - across * across), 0.35);
  radius *= 1.0 - fork * exp(-pow(angle / (spread * 0.3), 2.0));
  radius *= 1.0 + 0.025 * sin(angle * rays * 2.0 + uSeed);
  float edge = min(radius - length(d), (1.0 - across) * reach);
  float mask = smoothstep(-aa, aa, edge) * smoothstep(0.0, 0.025, length(d));
  float rib = pow(0.5 + 0.5 * cos(angle * rays), 10.0);
  return vec2(mask, rib);
}

vec4 over(vec4 front, vec4 back){
  return front + back * (1.0 - front.a);
}

vec4 finColor(vec2 f, vec3 tint){
  float alpha = f.x * (0.38 + 0.22 * f.y);
  return vec4(tint * (0.92 + 0.16 * f.y) * alpha, alpha);
}

vec3 skin(vec2 q, float roundness, out vec3 finTint){
  float field = fbm(q * vec2(4.0, 9.0) + uSeed * 29.0);
  float patches = smoothstep(-0.02, 0.05, field);
  vec3 ivory = vec3(0.98, 0.96, 0.88);
  vec3 red = vec3(0.88, 0.19, 0.035);
  vec3 gold = vec3(1.0, 0.65, 0.12);
  vec3 ink = vec3(0.07, 0.09, 0.11);
  finTint = mix(ivory, vec3(0.92, 0.63, 0.35), 0.24);
  if (uPalette == 1){
    vec3 blue = mix(vec3(0.32, 0.49, 0.56), ivory, smoothstep(-0.08, 0.12, field));
    return mix(red, blue, smoothstep(0.45, 0.85, roundness));
  }
  if (uPalette == 2){
    finTint = mix(ivory, gold, 0.45);
    return mix(gold, vec3(1.0, 0.85, 0.42), patches * 0.4);
  }
  if (uPalette == 3) return mix(ivory, ink, smoothstep(0.06, 0.13, field));
  if (uPalette == 4){
    float cap = 1.0 - smoothstep(0.085, 0.11, length((q - vec2(0.135, 0.0)) * vec2(0.8, 1.2)));
    return mix(ivory, red, cap);
  }
  if (uPalette == 5){
    finTint = vec3(0.43, 0.48, 0.50);
    return mix(ink, vec3(0.35, 0.40, 0.43), patches * 0.65);
  }
  return mix(ivory, red, patches);
}

void main(){
  vec2 q = vLocal;
  float aa = max(fwidth(q.y), fwidth(q.x)) * 0.8 + (uShadow ? 0.018 : 0.0);
  float width = bodyWidth(q.x);
  float flank = clamp(q.y / max(width, 0.001), -1.0, 1.0);
  float roundness = sqrt(max(0.0, 1.0 - flank * flank));
  vec3 finTint;
  vec3 base = skin(q, roundness, finTint);
  float tailWave = sin(uPhase - 5.0) * 0.09;
  vec4 color = finColor(fin(q, vec2(0.97, 0.0), tailWave, 0.77, 0.47, 0.29, 35.0, aa), finTint);
  for (int side = 0; side < 2; side++){
    float signY = side == 0 ? -1.0 : 1.0;
    float flap = sin(uPhase * 0.72 + signY * 0.6);
    vec2 pectoral = fin(q, vec2(0.25, signY * 0.11), signY * (1.13 + flap * 0.12), 0.6, 0.235, 0.0, 28.0, aa);
    vec2 pelvic = fin(q, vec2(0.64, signY * 0.055), signY * 0.78, 0.45, 0.13, 0.0, 30.0, aa);
    color = over(finColor(pelvic, finTint), color);
    color = over(finColor(pectoral, finTint), color);
  }

  float body = smoothstep(-aa, aa, width - abs(q.y)) * (1.0 - smoothstep(0.97, 1.01, q.x));
  vec2 tangent = normalize(vTangent);
  vec2 lateral = vec2(-tangent.y, tangent.x);
  vec3 normal = normalize(vec3(lateral * flank + tangent * (0.18 - 0.45 * (1.0 - smoothstep(0.0, 0.18, q.x))), roundness));
  vec3 light = normalize(vec3(-0.45, 0.5, 0.9));
  vec3 halfLight = normalize(light + vec3(0.0, 0.0, 1.0));
  float diffuse = max(0.0, dot(normal, light));
  vec3 lit = base * (0.57 + 0.45 * diffuse);
  lit += vec3(1.0, 0.96, 0.81) * pow(max(0.0, dot(normal, halfLight)), 24.0) * 0.22;

  vec2 scales = q * vec2(29.0, 32.0);
  scales.x += mod(floor(scales.y), 2.0) * 0.5;
  vec2 cell = fract(scales) - 0.5;
  float rim = smoothstep(0.34, 0.47, length(cell * vec2(0.86, 1.0))) * smoothstep(-0.3, 0.1, cell.x);
  float scaleArea = smoothstep(0.22, 0.31, q.x) * (1.0 - smoothstep(0.86, 0.97, q.x)) * roundness;
  float detail = 1.0 - smoothstep(0.018, 0.045, fwidth(q.x));
  lit *= 1.0 - rim * scaleArea * detail * 0.16;
  lit += vec3(0.12, 0.10, 0.065) * (1.0 - rim) * scaleArea * detail * pow(diffuse, 5.0);

  float gill = exp(-pow((q.x - 0.21 - 0.05 * flank * flank) / 0.009, 2.0));
  lit *= 1.0 - 0.24 * gill * smoothstep(0.25, 0.8, abs(flank));
  float dorsal = exp(-pow((q.y - sin(uPhase * 0.3) * 0.015) / 0.012, 2.0)) * smoothstep(0.29, 0.38, q.x) * (1.0 - smoothstep(0.63, 0.75, q.x));
  lit = mix(lit, lit * 0.76 + finTint * 0.2, dorsal * 0.6);
  color = over(vec4(lit * body, body), color);

  vec2 eye = vec2(q.x - 0.08, abs(q.y) - bodyWidth(0.08) * 0.88);
  float eyeMask = 1.0 - smoothstep(0.012 - aa, 0.012 + aa, length(eye * vec2(0.85, 1.0)));
  vec3 eyeColor = mix(vec3(0.035, 0.04, 0.025), vec3(0.83, 0.76, 0.49), smoothstep(0.006, 0.011, length(eye)));
  eyeColor += vec3(0.7) * (1.0 - smoothstep(0.001, 0.004, length(eye - vec2(-0.003, 0.003))));
  color = over(vec4(eyeColor * eyeMask, eyeMask), color);
  if (uShadow) color = vec4(vec3(0.035, 0.10, 0.085) * color.a * 0.24, color.a * 0.24);
  fragColor = color;
}
`;

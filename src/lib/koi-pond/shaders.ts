/**
 * 锦鲤池的 GLSL 源码。池子的世界坐标为 x ∈ [0,3]、y ∈ [0,1]。
 */

export const VS = `#version 300 es
in vec2 aPos;
out vec2 vUv;
void main(){ vUv = aPos * 0.5 + 0.5; gl_Position = vec4(aPos, 0.0, 1.0); }
`;

// 池子的世界坐标: x in [0,3], y in [0,1]  (3:1)
const COMMON = `
#define PI 3.14159265359
#define W 3.0

float hash12(vec2 p){
  vec3 q = fract(vec3(p.xyx) * 0.1031);
  q += dot(q, q.yzx + 33.33);
  return fract((q.x + q.y) * q.z);
}
vec2 hash22(vec2 p){
  vec3 q = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
  q += dot(q, q.yzx + 33.33);
  return fract((q.xx + q.yz) * q.zy);
}
vec3 hash32(vec2 p){
  vec3 q = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
  q += dot(q, q.yxz + 33.33);
  return fract((q.xxy + q.yzz) * q.zyx);
}

// 解析导数梯度噪声: 返回 (值, d/dx, d/dy, 拉普拉斯)
// 二阶导解析可得, 于是焦散不需要额外采样波场
vec4 noised2(vec2 x){
  vec2 p = floor(x), f = fract(x);
  vec2 u   = f*f*f*(f*(f*6.0 - 15.0) + 10.0);
  vec2 du  = 30.0*f*f*(f*(f - 2.0) + 1.0);
  vec2 ddu = 60.0*f*(1.0 + f*(2.0*f - 3.0));
  float a = hash12(p)               * 2.0 - 1.0;
  float b = hash12(p + vec2(1,0))   * 2.0 - 1.0;
  float c = hash12(p + vec2(0,1))   * 2.0 - 1.0;
  float d = hash12(p + vec2(1,1))   * 2.0 - 1.0;
  float k1 = b - a, k2 = c - a, k3 = a - b - c + d;
  float n   = a + k1*u.x + k2*u.y + k3*u.x*u.y;
  vec2  g   = vec2(du.x*(k1 + k3*u.y), du.y*(k2 + k3*u.x));
  float lap = ddu.x*(k1 + k3*u.y) + ddu.y*(k2 + k3*u.x);
  return vec4(n, g, lap);
}

float fbm(vec2 p){
  float s = 0.0, a = 0.5;
  for (int i = 0; i < 4; i++){ s += a * noised2(p).x; p = p*2.03 + 7.1; a *= 0.5; }
  return s;
}

// 0 = 岸边, ~1 = 池心。两轴分别归一, 否则 3:1 画幅里纵向会主导
float shore(vec2 p){ return min(min(p.x, W - p.x) / 0.62, min(p.y, 1.0 - p.y) / 0.34); }
`;

const HEAD =
  `#version 300 es
precision highp float;
precision highp int;
in vec2 vUv;
out vec4 fragColor;
` + COMMON;

/* --- 1) 涟漪仿真: 二维波动方程, 9 点各向同性拉普拉斯算子 --------------- */

export const SIM_FS = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 fragColor;

uniform sampler2D uPrev;      // .r = h(t), .g = h(t-dt)
uniform vec2  uTexel;
uniform vec3  uDrops[12];     // xy = uv, z = 振幅
uniform int   uDropN;
uniform float uDamp;
uniform vec4  uPhys;          // x = c0^2, y = 色散权重, z = 非线性系数, w = 宽算子半径

float H(vec2 uv){ return texture(uPrev, uv).r; }

// 紧凑 9 点: (1/6)[[1,4,1],[4,-20,4],[1,4,1]], 比 5 点算子各向同性得多
float lapCompact(vec2 uv, float c){
  vec2 t = uTexel;
  float l  = H(uv - vec2(t.x, 0.0));
  float r  = H(uv + vec2(t.x, 0.0));
  float u  = H(uv + vec2(0.0, t.y));
  float d  = H(uv - vec2(0.0, t.y));
  float ul = H(uv + vec2(-t.x,  t.y));
  float ur = H(uv + vec2( t.x,  t.y));
  float dl = H(uv + vec2(-t.x, -t.y));
  float dr = H(uv + vec2( t.x, -t.y));
  return (4.0*(l + r + u + d) + (ul + ur + dl + dr) - 20.0*c) / 6.0;
}

// 半径 R 的宽算子。取样点排在圆环上而不是方格上: 环上采样的角向谐波
// 要到 N 阶才出现, 所以 R 取到十几个纹素时涟漪依然是圆的。
// 符号为 4(J0(kR)-1)/R^2, 恒为负 => 无条件稳定, 且对短波响应远弱于长波。
float lapRing(vec2 uv, float R, float c){
  mat2 rot = mat2(0.8660254, 0.5, -0.5, 0.8660254);   // 30 度
  vec2 o = vec2(R, 0.0);
  float s = 0.0;
  for (int i = 0; i < 12; i++){ s += H(uv + uTexel * o); o = rot * o; }
  return 4.0 * (s / 12.0 - c) / (R * R);
}

void main(){
  vec2 uv = vUv;
  float c = texture(uPrev, uv).r;
  float p = texture(uPrev, uv).g;

  // 色散: 紧凑算子对所有波长速度相同(无色散)。宽算子对短波响应弱, 两者混合
  // 等价于给格式指定一条 v(k) 随 k 单调下降的色散关系 —— 长波跑得快, 于是一次
  // 冲激会散开成不断拉长的波列, 长波也才可能"追上"前面的短波。
  float lap = mix(lapCompact(uv, c), lapRing(uv, uPhys.w, c), uPhys.y);

  // 非线性: 浅水波速 c = sqrt(g(H+h)) => c^2 = c0^2 (1 + h/H)。波峰比波谷快,
  // 于是波前变陡, 并且两道涟漪交叠处 h 更大 => 局部更快, 相遇不再是纯叠加。
  // 注意零均值的波列整体并不会加速(sqrt 是凹的, 均值反而略降), "大波追上小波"
  // 是孤立波的性质, 雨滴涟漪不具备。真实池塘 h/H ~ 0.004, 该项几乎为零,
  // 这里刻意放大到能看见的量级。clamp 同时兜住 CFL 上界。
  float c2 = uPhys.x * (1.0 + clamp(uPhys.z * c, -0.5, 0.9));

  float h = 2.0*c - p + c2 * lap;
  h *= uDamp;

  // 边界吸收: 避免涟漪撞到画布边缘反射出方框。吸收带要比 lapRing 的采样
  // 半径更宽, 否则环上取样会落在 CLAMP_TO_EDGE 复制出来的值上。
  vec2 e = min(uv, 1.0 - uv);
  float border = smoothstep(0.0, 0.048, min(e.x * 3.0, e.y));
  h *= mix(0.90, 1.0, border);

  for (int i = 0; i < 12; i++){
    if (i >= uDropN) break;
    vec2 dd = (uv - uDrops[i].xy) * vec2(3.0, 1.0);
    float q = length(dd) / 0.042;
    h += uDrops[i].z * cos(q * 3.2) * exp(-q * q * 0.60);
  }

  fragColor = vec4(h, c, 0.0, 1.0);
}
`;

/* --- 2) 水下场景: 池底 + 锦鲤 + 投影 --------------------------------- */

export const UNDER_FS =
  HEAD +
  `
uniform float uTime;
uniform vec4  uKoiA[8];   // xy = 位置(世界), zw = 朝向
uniform vec4  uKoiB[8];   // x = 半长, y = 尾摆相位, z = 摆幅, w = 配色编号
uniform int   uKoiN;

float voro(vec2 x, out float edge, out vec2 id){
  vec2 n = floor(x), f = fract(x);
  float d1 = 8.0, d2 = 8.0; vec2 mid = n;
  for (int j = -1; j <= 1; j++)
  for (int i = -1; i <= 1; i++){
    vec2 g = vec2(float(i), float(j));
    vec2 o = hash22(n + g);
    vec2 rr = g + 0.13 + 0.74*o - f;
    float d = dot(rr, rr);
    if (d < d1){ d2 = d1; d1 = d; mid = n + g; }
    else if (d < d2){ d2 = d; }
  }
  d1 = sqrt(d1); d2 = sqrt(d2);
  edge = d2 - d1; id = mid;
  return d1;
}

vec3 pondFloor(vec2 p){
  float e1, e2; vec2 id1, id2;
  float d1 = voro(p*2.9 + 3.1, e1, id1);
  float d2 = voro(p*7.4 - 6.4, e2, id2);

  vec3 pale = vec3(0.74, 0.96, 0.80);
  vec3 deep = vec3(0.30, 0.63, 0.62);

  float t1 = hash12(id1*1.31);
  float t2 = hash12(id2*2.17);

  // 水下本来就是散焦的, 石头之间只保留很弱的明暗差, 否则会变成硬边多边形
  vec3 col = mix(deep, pale, 0.30 + 0.44*t1);
  col = mix(col, mix(deep, pale, 0.28 + 0.44*t2), 0.28);

  col *= 0.92 + 0.14*smoothstep(0.70, 0.10, d1);       // 卵石中心偏亮
  col *= 0.95 + 0.08*smoothstep(0.0, 0.14, e1);        // 石缝很淡
  col *= 0.97 + 0.05*smoothstep(0.0, 0.10, e2);
  col *= 0.94 + 0.13*(fbm(p*22.0)*0.5 + 0.5);          // 细沙
  col *= 0.86 + 0.28*(fbm(p*1.25 + 41.0)*0.5 + 0.5);   // 大尺度深浅

  // 边缘的水草 / 藻斑
  float ef = 1.0 - smoothstep(0.05, 1.00, shore(p));
  float alg = smoothstep(0.05, 0.55, fbm(p*3.1 + 9.0)*0.5 + 0.5);
  col = mix(col, vec3(0.11, 0.36, 0.24), ef*ef*alg*0.80);
  col *= mix(1.0, 0.70, ef*ef);

  return col;
}

vec2 koiLocal(int i, vec2 p){
  vec2 c = uKoiA[i].xy, dr = uKoiA[i].zw;
  vec2 d = (p - c) / uKoiB[i].x;
  vec2 q = vec2(dot(d, dr), d.x*(-dr.y) + d.y*dr.x);
  float w = smoothstep(0.9, -1.3, q.x);                 // 越靠尾部摆动越大
  q.y -= sin(q.x*3.2 - uKoiB[i].y) * uKoiB[i].z * w;
  return q;
}

// 体宽剖面 + 尾鳍, aa 控制边缘柔度(投影用大值)
float koiShape(vec2 q, float aa, out float finA){
  float t  = clamp((q.x + 1.0) * 0.5, 0.0, 1.0);
  float wb = 0.235 * pow(max(sin(PI * pow(t, 1.18)), 0.0), 0.52);
  float s  = clamp((-0.80 - q.x) / 0.52, 0.0, 1.0);
  float wt = 0.030 + 0.205 * pow(s, 1.15);
  float gate = smoothstep(-0.70, -0.90, q.x);
  float w = max(wb, wt * gate);

  // 凹口只吃掉中间一小段, 否则整个尾鳍会被切成两根尖刺
  float xEnd = -1.32 + 0.11 * smoothstep(0.10, 0.0, abs(q.y));
  float m = smoothstep(-aa, aa, w - abs(q.y))
          * smoothstep(-aa, aa, q.x - xEnd)
          * smoothstep(-aa, aa, 1.0 - q.x);

  vec2 fp = vec2(q.x - 0.22, abs(q.y) - 0.14);
  float ca = cos(0.80), sa = sin(0.80);
  fp = vec2(ca*fp.x + sa*fp.y, -sa*fp.x + ca*fp.y);
  finA = smoothstep(-0.18, 0.18, 1.0 - length(fp / vec2(0.22, 0.070))) * (1.0 - m);

  return m;
}

void koiPalette(int k, out vec3 base, out vec3 mark, out float th){
  if      (k == 0){ base = vec3(0.97,0.95,0.92); mark = vec3(0.93,0.26,0.08); th =  0.00; }
  else if (k == 1){ base = vec3(0.98,0.47,0.09); mark = vec3(0.99,0.96,0.92); th =  0.26; }
  else if (k == 2){ base = vec3(0.99,0.74,0.19); mark = vec3(0.99,0.90,0.56); th =  0.08; }
  else if (k == 3){ base = vec3(0.96,0.95,0.93); mark = vec3(0.12,0.14,0.17); th =  0.04; }
  else if (k == 4){ base = vec3(0.97,0.95,0.92); mark = vec3(0.95,0.34,0.09); th = -0.07; }
  else            { base = vec3(0.21,0.23,0.27); mark = vec3(0.88,0.90,0.92); th =  0.34; }
}

vec3 koiColor(int pal, vec2 q, float seed){
  vec3 base, mark; float th;
  koiPalette(pal, base, mark, th);
  float pat = fbm(q * vec2(1.7, 2.9) + seed * 13.0);
  vec3 c = mix(base, mark, smoothstep(th - 0.03, th + 0.06, pat));
  if (pal == 4){
    float p2 = fbm(q * vec2(3.1, 4.3) + seed * 7.0 + 21.0);
    c = mix(c, vec3(0.11,0.12,0.15), smoothstep(0.30, 0.42, p2) * 0.85);
  }
  float t  = clamp((q.x + 1.0)*0.5, 0.0, 1.0);
  float wb = max(0.235 * pow(max(sin(PI*pow(t, 1.18)), 0.0), 0.52), 1e-3);
  float rim = abs(q.y) / wb;
  c *= 0.80 + 0.30 * smoothstep(1.05, 0.10, rim);        // 圆身受光
  c += vec3(0.06,0.07,0.07) * smoothstep(0.35, 0.0, rim); // 脊背高光
  c = mix(c, c*0.72 + 0.40, smoothstep(-0.86, -1.25, q.x) * 0.55);  // 尾鳍偏透明
  return c;
}

void main(){
  vec2 p = vUv * vec2(W, 1.0);
  vec3 col = pondFloor(p);
  float cover = 0.0, f;

  // 影子: 同一形状函数, 位置偏移 + 更软的边缘
  float sh = 0.0;
  for (int i = 0; i < 8; i++){
    if (i >= uKoiN) break;
    sh = max(sh, koiShape(koiLocal(i, p - vec2(0.040, 0.052)), 0.13, f));
  }
  col *= 1.0 - 0.36 * sh;

  for (int i = 0; i < 8; i++){
    if (i >= uKoiN) break;
    vec2 q = koiLocal(i, p);
    float m = koiShape(q, 0.030, f);
    vec3 kc = koiColor(int(uKoiB[i].w), q, float(i) + 0.31);
    kc = mix(kc, vec3(0.40, 0.70, 0.68), 0.09);          // 水体带来的雾感
    col = mix(col, kc, m);
    col = mix(col, vec3(0.86, 0.94, 0.95), f * 0.30);    // 半透明胸鳍
    cover = max(cover, max(m, f * 0.5));
  }

  fragColor = vec4(col, cover);
}
`;

/* --- 3) 水面合成 ----------------------------------------------------- */

export const COMP_FS =
  HEAD +
  `
uniform sampler2D uUnder;
uniform sampler2D uRip;
uniform vec2  uRipTexel;
uniform float uCellW;      // 一个仿真格子的世界宽度
uniform float uTime;
uniform vec4  uTune;       // x 环境波幅  y 涟漪权重  z 折射  w 焦散
uniform vec4  uTune2;      // x 反射  y 高光  z 浮萍  w 未用

const vec3 SUN_DIR = vec3(-0.155, -0.105, 0.982);
const vec3 SUN_COL = vec3(1.00, 0.975, 0.915);

/* 环境波场: 域扭曲 + 5 个不同漂移方向的噪声倍频 + 2 道长波涌
   返回 (高度, d/dx, d/dy, 拉普拉斯), 全部解析求得 */
vec4 waveField(vec2 p, float t){
  const vec2 D[5] = vec2[5](
    vec2( 0.94, 0.34), vec2(-0.71, 0.70), vec2( 0.36,-0.93),
    vec2(-0.99,-0.16), vec2( 0.62, 0.79)
  );
  const float S[5] = float[5](0.055, 0.041, 0.068, 0.033, 0.086);

  float w1 = noised2(p*0.85 + vec2( 0.031*t, -0.019*t)).x;
  float w2 = noised2(p*0.79 + vec2(11.3, 7.1) + vec2(-0.024*t, 0.028*t)).x;
  vec2 q = p + vec2(w1, w2) * 0.20;

  vec4 acc = vec4(0.0);
  mat2 m = mat2(1.0, 0.0, 0.0, 1.0);
  mat2 rot = mat2(0.936, 0.352, -0.352, 0.936);
  float amp = 1.0, freq = 2.0, lw = 1.0;

  for (int i = 0; i < 5; i++){
    vec4 n = noised2(q*freq + D[i]*(t*S[i]));
    acc.x  += amp * n.x;
    acc.yz += (amp*freq) * (n.yz * m);          // 行向量乘矩阵 = m^T * grad
    acc.w  += (amp*freq*freq) * n.w * lw;       // 旋转不改变拉普拉斯; lw 给焦散带限
    q = rot * q; m = rot * m;
    freq *= 1.95; amp *= 0.45; lw *= 0.40;
  }

  // 两道缓慢长波, 相位被噪声打乱, 所以波峰不会是直线也不会重复
  vec2  k1 = vec2(0.93, 0.37) * 2.35;
  vec4  n1 = noised2(p*0.55 + vec2(0.021*t, 0.014*t));
  float ph1 = dot(p, k1) - t*0.52 + n1.x*1.35;
  vec2  d1 = k1 + n1.yz*0.55*1.35;
  acc.x  += 0.52*sin(ph1);
  acc.yz += 0.52*cos(ph1)*d1;
  acc.w  -= 0.52*sin(ph1)*dot(d1, d1);

  vec2  k2 = vec2(-0.42, 0.91) * 1.65;
  vec4  n2 = noised2(p*0.47 + vec2(-0.017*t, 0.023*t) + 31.7);
  float ph2 = dot(p, k2) - t*0.38 + n2.x*1.15;
  vec2  d2 = k2 + n2.yz*0.47*1.15;
  acc.x  += 0.44*sin(ph2);
  acc.yz += 0.44*cos(ph2)*d2;
  acc.w  -= 0.44*sin(ph2)*dot(d2, d2);

  return acc;
}

vec3 skyColor(vec3 r, float ef){
  float t = clamp(r.z, 0.0, 1.0);
  vec3 zen = vec3(0.86, 0.97, 1.00);
  vec3 hor = vec3(0.52, 0.72, 0.52);
  vec3 s = mix(hor, zen, smoothstep(0.45, 0.995, t));
  s *= 0.90 + 0.30 * (fbm(r.xy*7.0 + 4.0)*0.5 + 0.5);     // 天空里的云影
  s = mix(s, vec3(0.22, 0.38, 0.24), ef * 0.78);          // 岸边倒映的树影
  return s;
}

// 抖动网格上的小圆点(浮萍 / 花瓣 / 岸边小叶)
float dotLayer(vec2 x, float rad, float thresh, float seed, out vec3 hOut){
  vec2 n = floor(x), f = fract(x);
  float m = 0.0; hOut = vec3(0.0);
  for (int j = -1; j <= 1; j++)
  for (int i = -1; i <= 1; i++){
    vec2 g = vec2(float(i), float(j));
    vec3 h = hash32(n + g + seed);
    if (h.z > thresh) continue;
    float rr = rad * (0.62 + 0.80*h.x);
    float d = length(g + 0.15 + 0.7*h.xy - f);
    float c = smoothstep(rr, rr*0.5, d);
    if (c > m){ m = c; hOut = h; }
  }
  return m;
}

float padDensity(vec2 c){
  float base = 1.0 - smoothstep(0.02, 0.92, shore(c));
  float v = fbm(c*1.9 + 21.0)*0.5 + 0.5;
  return clamp(base * (0.30 + 1.00*v), 0.0, 1.0) * 0.92;
}

// 睡莲叶: 带 V 形缺口的圆盘, 同时给出投影
vec4 lilyPads(vec2 p, vec2 gw, out float shadow){
  const float SC = 3.6;
  vec2 x = p * SC, n = floor(x);
  vec4 acc = vec4(0.0);
  shadow = 0.0;
  for (int j = -1; j <= 1; j++)
  for (int i = -1; i <= 1; i++){
    vec2 id = n + vec2(float(i), float(j));
    vec3 h = hash32(id + 3.7);
    vec2 cen = (id + 0.15 + 0.7*h.xy) / SC;
    if (h.z > padDensity(cen)) continue;

    float rr = mix(0.052, 0.104, fract(h.x*7.31 + h.y*3.17));
    vec2 lp = p - cen - gw*0.004;                          // 随波轻晃
    float dd = length(lp);
    if (dd > rr*1.9) continue;

    float ang = h.y * 6.2831853;
    float a = atan(lp.y, lp.x) - ang;
    a = mod(a + PI, 6.2831853) - PI;
    float rad = rr * (1.0 + 0.035*sin(a*6.0 + h.x*10.0) + 0.018*sin(a*13.0 + 2.0));

    shadow = max(shadow, smoothstep(-0.034, 0.034, rad*0.96 - length(lp - vec2(0.022, 0.028))));

    float mask = smoothstep(-0.0035, 0.0035, rad - dd) * smoothstep(0.06, 0.15, abs(a));
    if (mask <= 0.001) continue;

    float rn = dd / max(rad, 1e-4);
    vec3 pc = mix(vec3(0.35,0.61,0.23), vec3(0.19,0.42,0.19), fract(h.z*13.7));
    pc *= 0.89 + 0.17*smoothstep(1.0, 0.20, rn);
    pc *= 0.975 + 0.042*sin(a*20.0) * smoothstep(0.15, 1.0, rn);         // 叶脉
    pc *= 0.94 + 0.14*(fbm(lp*70.0)*0.5 + 0.5);                          // 叶面粗糙
    pc = mix(pc, pc*1.10 + vec3(0.03,0.05,0.0), smoothstep(0.90, 1.0, rn));
    pc *= 1.0 + 0.075 * (-lp.x*0.6 - lp.y*0.8) / max(rad, 1e-4);         // 定向受光

    acc = mix(acc, vec4(pc, 1.0), mask);
  }
  return acc;
}

// 莲花: 3 圈花瓣, 每圈在极坐标里用椭圆切出
vec4 lotus(vec2 lp, float sc, vec3 inner, vec3 outer, float seed){
  lp /= sc;
  float r = length(lp);
  if (r > 1.15) return vec4(0.0);
  float a = atan(lp.y, lp.x);
  vec4 o = vec4(0.0);
  for (int ring = 0; ring < 3; ring++){
    float fr = float(ring);
    float n  = 8.0 - fr;
    float rr = 1.0 - fr*0.27;
    float off = fr*0.42 + seed;
    float aa = mod(a + off + PI/n, 6.2831853/n) - PI/n;
    float u = (r - rr*0.52) / (rr*0.55);
    float v = aa * r / (rr*0.30);
    float m = smoothstep(0.10, -0.06, length(vec2(u, v)) - 1.0);
    vec3 c = mix(inner, outer, smoothstep(0.15, 1.05, r/rr));
    c *= 0.78 + 0.16*fr + 0.10*cos(aa*6.0);
    o = mix(o, vec4(c, 1.0), m);
  }
  float cm = smoothstep(0.215, 0.165, r);
  o = mix(o, vec4(vec3(1.00, 0.84, 0.16) * (0.85 + 0.3*hash12(lp*40.0)), 1.0), cm);
  return o;
}

const vec4 FLOWERS[6] = vec4[6](
  vec4(0.145, 0.855, 0.086, 0.0),
  vec4(0.205, 0.500, 0.062, 1.0),
  vec4(2.885, 0.845, 0.078, 0.0),
  vec4(2.915, 0.185, 0.090, 0.0),
  vec4(2.660, 0.245, 0.056, 1.0),
  vec4(1.960, 0.035, 0.050, 0.0)
);

void main(){
  vec2 uv = vUv;
  vec2 p  = uv * vec2(W, 1.0);
  float shr = shore(p);
  float ef = 1.0 - smoothstep(0.03, 1.05, shr);

  /* --- 交互涟漪场: Sobel 梯度 + 9 点拉普拉斯 --- */
  // 仿真纹理分辨率低于画布, 直接用 1 像素步长做二阶差分会把双线性插值的折点放大成噪点
  float sp = 1.8;
  vec2 tx = uRipTexel * sp;
  float cw = uCellW * sp;
  float hc = texture(uRip, uv).r;
  float hl = texture(uRip, uv - vec2(tx.x, 0.0)).r;
  float hr = texture(uRip, uv + vec2(tx.x, 0.0)).r;
  float hu = texture(uRip, uv + vec2(0.0, tx.y)).r;
  float hd = texture(uRip, uv - vec2(0.0, tx.y)).r;
  float ha = texture(uRip, uv + vec2(-tx.x,  tx.y)).r;
  float hb = texture(uRip, uv + vec2( tx.x,  tx.y)).r;
  float he = texture(uRip, uv + vec2(-tx.x, -tx.y)).r;
  float hf = texture(uRip, uv + vec2( tx.x, -tx.y)).r;

  vec2 gRip = vec2((hb + 2.0*hr + hf) - (ha + 2.0*hl + he),
                   (ha + 2.0*hu + hb) - (he + 2.0*hd + hf)) / (8.0 * cw);
  float lapRip = (4.0*(hl + hr + hu + hd) + (ha + hb + he + hf) - 20.0*hc) / (6.0*cw*cw);

  /* --- 环境波 --- */
  vec4 wf = waveField(p, uTime);
  float aA = uTune.x, aR = uTune.y;
  vec2  grad = wf.yz * aA + gRip * aR;
  float lapT = wf.w  * aA + lapRip * aR * 0.58;

  vec3 N = normalize(vec3(-grad, 1.0));

  /* --- 折射: 顶视, 偏移正比于法线倾斜; 三通道轻微色散 --- */
  vec2 off = N.xy * uTune.z * vec2(1.0/W, 1.0);
  vec3 under;
  under.r = texture(uUnder, uv + off*1.07).r;
  under.g = texture(uUnder, uv + off       ).g;
  under.b = texture(uUnder, uv + off*0.93).b;
  float koiCover = texture(uUnder, uv + off).a;

  /* --- 焦散: 光线会聚率 ~ 1 - k*(水面曲率) --- */
  float k = uTune.w;
  vec3 cs = min(max(vec3(1.0) - lapT * k * vec3(1.10, 1.0, 0.90), 0.0), 2.6);
  vec3 caustic = 0.07*cs*cs + 1.20*pow(max(cs - 1.02, 0.0), vec3(1.9));
  caustic = min(caustic, 2.2);
  float causMask = mix(1.0, 0.45, koiCover) * (0.70 + 0.45*(1.0 - ef));
  under += caustic * SUN_COL * causMask * 0.72;

  /* --- 水体吸收 + 散射 --- */
  float depth = mix(1.0, 0.52, ef);
  vec3 absorb = exp(-vec3(0.66, 0.15, 0.21) * depth * 1.15);
  vec3 col = under * absorb + vec3(0.10, 0.52, 0.52) * (1.0 - absorb.g) * 1.15;
  col += vec3(0.08, 0.26, 0.25) * clamp(wf.x*aA*14.0, -0.5, 0.5);   // 波峰的次表面辉光

  /* --- 反射 + 太阳闪光 --- */
  vec3 R = reflect(vec3(0.0, 0.0, -1.0), N);
  float fres = 0.02 + 0.98 * pow(1.0 - N.z, 5.0);
  col = mix(col, skyColor(R, ef), clamp(0.030 + fres*2.6, 0.0, 0.48) * uTune2.x);

  float sd = max(dot(R, SUN_DIR), 0.0);
  float glint = pow(sd, 1600.0)*2.9 + pow(sd, 150.0)*0.13 + pow(sd, 18.0)*0.020;
  col += SUN_COL * glint * (0.26 + fres*4.0) * uTune2.y;

  /* --- 水面漂浮物: 被涟漪推着走 --- */
  vec2 drift = p + vec2(uTime*0.0055, uTime*0.0026) - gRip*0.005;
  vec3 dh;
  float weed = dotLayer(drift*26.0, 0.26, 0.30, 5.0, dh);
  float weedMask = weed * clamp(1.35*ef*(fbm(p*2.6 + 12.0)*0.5 + 0.35) - 0.06, 0.0, 1.0) * uTune2.z;
  vec3 weedCol = mix(vec3(0.38,0.68,0.26), vec3(0.56,0.80,0.31), fract(dh.x*9.1));
  col = mix(col, weedCol * (0.9 + 0.25*fres), smoothstep(0.05, 0.5, weedMask));

  float petal = dotLayer((p - gRip*0.006 + vec2(uTime*0.004, -uTime*0.002))*11.0, 0.13, 0.030, 71.0, dh);
  col = mix(col, mix(vec3(1.0,0.74,0.83), vec3(1.0,0.92,0.94), fract(dh.y*5.7)), petal*0.80);

  /* --- 岸边小叶 --- */
  float shoreM = (1.0 - smoothstep(0.0, 0.40, shr)) * smoothstep(0.25, 0.70, fbm(p*2.2 + 3.0)*0.5 + 0.62);
  float leaf = dotLayer(p*32.0, 0.32, 0.62, 17.0, dh);
  col = mix(col, mix(vec3(0.20,0.46,0.18), vec3(0.42,0.72,0.26), fract(dh.z*11.3)) * (0.8 + 0.4*dh.x),
            smoothstep(0.1, 0.65, leaf*shoreM));

  /* --- 睡莲叶(含投影) + 莲花 --- */
  float padShadow;
  vec4 pads = lilyPads(p, grad, padShadow);
  col *= 1.0 - 0.25 * padShadow * (1.0 - pads.a);
  col = mix(col, pads.rgb, pads.a);

  for (int i = 0; i < 6; i++){
    vec4 F = FLOWERS[i];
    vec2 lp = p - F.xy - grad*0.003;
    if (dot(lp, lp) > F.z*F.z*1.45) continue;
    vec3 inner = F.w > 0.5 ? vec3(1.00, 0.99, 0.97) : vec3(1.00, 0.86, 0.90);
    vec3 outer = F.w > 0.5 ? vec3(0.90, 0.95, 0.99) : vec3(0.98, 0.52, 0.70);
    vec4 fl = lotus(lp, F.z, inner, outer, float(i)*1.7);
    col = mix(col, fl.rgb, fl.a);
  }

  /* --- 调色 --- */
  col *= 1.0 - 0.17 * smoothstep(0.60, 1.30, length((uv - 0.5) * vec2(1.7, 1.0)));
  col = pow(max(col, 0.0) * 1.06, vec3(0.93));
  col += (hash12(gl_FragCoord.xy + uTime) - 0.5) * 0.004;   // 去色带

  fragColor = vec4(col, 1.0);
}
`;

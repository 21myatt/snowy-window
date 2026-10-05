export const snowyWindowVertexShader = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export const snowyWindowFragmentShader = `
  precision highp float;
  varying vec2 vUv;
  uniform float uTime;
  uniform float uInitialDensity;
  uniform float uGrowthSpeed;
  uniform float uNoiseScale;
  uniform float uWipeStrength;
  uniform float uMouthStrength;
  uniform int uBrushCount;
  uniform vec4 uBrushes[32]; // x, y, radius, signed strength

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }
  float noise(vec2 p) {
    vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
      mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0)), f.x), f.y);
  }
  void main() {
    vec2 p = vUv;
    float organic = noise(p * uNoiseScale + vec2(uTime * 0.018, -uTime * 0.012));
    float cells = noise(p * 7.0 - vec2(uTime * 0.006));
    float density = clamp(uInitialDensity + (organic * 0.32 + cells * 0.16 - 0.18) *
      (1.0 - exp(-uTime * uGrowthSpeed)), 0.0, 1.0);
    for (int i = 0; i < 32; i++) {
      if (i >= uBrushCount) break;
      vec4 brush = uBrushes[i];
      float distanceToBrush = distance(p, brush.xy);
      float influence = 1.0 - smoothstep(brush.z * 0.25, brush.z, distanceToBrush);
      density += influence * brush.w;
    }
    density = clamp(density, 0.0, 1.0);
    vec3 fog = mix(vec3(0.88, 0.94, 0.96), vec3(1.0), organic * 0.35);
    gl_FragColor = vec4(fog, density * 0.88);
  }
`;

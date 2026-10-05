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
  uniform float uNoiseScale;
  uniform float uDriftSpeed;
  uniform float uFilmOpacity;
  uniform float uDropletOpacity;
  uniform float uDropletScale;
  uniform float uDropletStretch;
  uniform float uEdgeStrength;
  uniform float uHighlightStrength;
  uniform float uReflectionStrength;
  uniform float uGravity;
  uniform float uTrailStrength;
  uniform vec2 uResolution;
  uniform sampler2D uMask;


  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
      mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0)), f.x), f.y);
  }

  float fbm(vec2 p) {
    float value = 0.0;
    float amplitude = 0.5;
    for (int i = 0; i < 5; i++) {
      value += noise(p) * amplitude;
      p = p * 2.03 + vec2(17.3, 9.1);
      amplitude *= 0.5;
    }
    return value;
  }

  void main() {
    vec2 p = vUv;
    vec2 glassUv = vec2(p.x, p.y * uResolution.y / uResolution.x);
    vec4 maskSample = texture2D(uMask, p);
    float condensation = maskSample.r;
    float wetResidue = maskSample.g;
    float age = max(0.0, uTime - maskSample.b);
    float freshIce = maskSample.a * exp(-age * 2.4) * step(-0.5, maskSample.b);
    float maturity = smoothstep(0.0, 4.0, age);
    float large = fbm(glassUv * uNoiseScale);
    float medium = fbm(p * uDropletScale * 0.42);
    float fine = fbm(vec2(glassUv.x * uDropletScale, glassUv.y * uDropletScale * uDropletStretch));
    float filmNoise = large * 0.55 + medium * 0.30 + fine * 0.15;
    float film = condensation * smoothstep(0.10, 0.72, filmNoise + condensation * 0.35);
    float droplets = condensation * smoothstep(0.48, 0.73, fine + medium * 0.28 + condensation * 0.34);

    float movers = smoothstep(0.76, 0.96, noise(p * uDropletScale * 0.7));
    vec2 trailUv = p + vec2(0.0, -uTime * uDriftSpeed * movers * (0.5 + uGravity));
    float trailNoise = fbm(vec2(trailUv.x * uDropletScale * 0.75, trailUv.y * uDropletScale * 1.8));
    float trails = smoothstep(0.70, 0.92, trailNoise) * droplets * movers * uTrailStrength;
    droplets = clamp(droplets + trails * condensation, 0.0, 1.0);

    vec2 texel = 1.0 / uResolution;
    float left = texture2D(uMask, p - vec2(texel.x, 0.0)).r;
    float right = texture2D(uMask, p + vec2(texel.x, 0.0)).r;
    float down = texture2D(uMask, p - vec2(0.0, texel.y)).r;
    float up = texture2D(uMask, p + vec2(0.0, texel.y)).r;
    vec2 gradient = vec2(right - left, up - down);
    vec3 normal = normalize(vec3(-gradient * 2.0, 1.0));
    vec3 lightDirection = normalize(vec3(-0.38, 0.58, 1.0));
    float specular = pow(max(dot(normal, lightDirection), 0.0), 28.0);
    float edge = smoothstep(0.015, 0.14, length(gradient));
    float fresnel = pow(1.0 - max(normal.z, 0.0), 3.0);

    vec3 clearGlass = vec3(0.78, 0.88, 0.92);
    vec3 filmColor = mix(vec3(0.72, 0.84, 0.89), vec3(0.98, 1.0, 1.0), filmNoise);
    vec3 dropletColor = vec3(0.82, 0.92, 0.96);
    dropletColor += specular * uHighlightStrength * vec3(0.75, 0.9, 1.0);
    dropletColor -= edge * uEdgeStrength * vec3(0.10, 0.14, 0.16);
    vec3 reflection = mix(vec3(0.48, 0.62, 0.72), vec3(0.96, 0.99, 1.0), p.y);
    reflection *= (0.15 + fresnel) * uReflectionStrength;
    vec3 wetHighlight = vec3(0.72, 0.86, 0.92) * wetResidue * (0.25 + specular * 0.75);

    vec3 color = clearGlass;
    color = mix(color, filmColor, film * uFilmOpacity);
    color = mix(color, dropletColor, droplets * uDropletOpacity);
    color += reflection;
    color += wetHighlight;
    color = mix(color * vec3(0.88, 0.95, 1.0), color, maturity);
    color += vec3(0.55, 0.78, 0.9) * freshIce * 0.55;
    float alpha = clamp(film * uFilmOpacity + droplets * uDropletOpacity + wetResidue * 0.12 + freshIce * 0.24, 0.0, 0.92);
    gl_FragColor = vec4(color, alpha);
  }
`;

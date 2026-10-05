/* eslint-disable react/no-unknown-property */
import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { BufferAttribute, BufferGeometry, ShaderMaterial } from "three";

const PARTICLE_COUNT = 140;

const vertexShader = `
  attribute float aSeed;
  attribute float aSize;
  attribute float aSpeed;
  varying float vLife;
  varying float vSeed;
  uniform float uTime;
  uniform float uIntensity;
  uniform float uDepthTravel;
  uniform float uMaxPointSize;
  uniform float uConeXSpread;
  uniform float uConeYSpread;
  uniform float uBurstStart;
  uniform float uLifetimeMin;
  uniform float uLifetimeMax;
  uniform float uSpawnStagger;

  void main() {
    float lifetime = mix(uLifetimeMin, uLifetimeMax, fract(aSeed * 17.13));
    float age = uTime - uBurstStart + fract(aSeed * 29.71) * uSpawnStagger;
    if (age < 0.0 || age > lifetime) {
      gl_Position = vec4(2.0, 2.0, 0.0, 1.0);
      gl_PointSize = 0.0;
      vLife = 2.0;
      vSeed = aSeed;
      return;
    }
    float life = age / lifetime ;
    float burst = smoothstep(0.0, 0.08, life);
    float turbulence = sin(uTime * 2.1 + aSeed * 31.0 + life * 8.0) * 0.045 * life;
    float drift = sin(aSeed * 47.0 + life * 5.0) * 0.065 * life;
    float radialSeedX = fract(aSeed * 19.17) - 0.5;
    float radialSeedY = fract(aSeed * 37.91) - 0.5;
    float coneSpread = life * life;

    vec3 local = position;
    // Start as a small disc at the mouth and expand radially as particles
    // travel toward the camera, producing a cone instead of a ribbon.
    local.x = local.x * 0.18 + radialSeedX * coneSpread * uConeXSpread + turbulence + drift;
    local.y = -0.47 + radialSeedY * coneSpread * uConeYSpread
      + sin(aSeed * 29.0 + uTime * 1.7) * 0.018 * life;
    // ScreenSpaceUI's camera is on +Z looking toward -Z; positive Z moves
    // particles toward the camera.
    local.z += life * uDepthTravel;

    vec4 mvPosition = modelViewMatrix * vec4(local, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    float cameraApproach = 1.0 + life * 7.0;
    gl_PointSize = max(2.0, aSize * cameraApproach * uIntensity * uMaxPointSize);
    vLife = life;
    vSeed = aSeed;
  }
`;

const fragmentShader = `
  precision highp float;
  varying float vLife;
  varying float vSeed;

  void main() {
    float distanceToCenter = distance(gl_PointCoord, vec2(0.5));
    float foregroundBlur = smoothstep(0.35, 1.0, vLife);
    float flake = 1.0 - smoothstep(0.16 + foregroundBlur * 0.16, 0.5, distanceToCenter);
    float fadeIn = smoothstep(0.0, 0.12, vLife);
    float fadeOut = 1.0 - smoothstep(0.72, 1.0, vLife);
    float brightness = 0.72 + fract(vSeed * 23.4) * 0.28;
    vec3 color = mix(vec3(0.7, 0.88, 1.0), vec3(1.0), brightness);
    gl_FragColor = vec4(color, flake * fadeIn * fadeOut * mix(0.7, 0.42, foregroundBlur));
  }
`;

const createGeometry = () => {
  const geometry = new BufferGeometry();
  const positions = new Float32Array(PARTICLE_COUNT * 3);
  const seeds = new Float32Array(PARTICLE_COUNT);
  const sizes = new Float32Array(PARTICLE_COUNT);
  const speeds = new Float32Array(PARTICLE_COUNT);
  for (let index = 0; index < PARTICLE_COUNT; index += 1) {
    const offset = index * 3;
    positions[offset] = (Math.random() - 0.5) * 0.16;
    positions[offset + 1] = 0.5;
    positions[offset + 2] = 0;
    seeds[index] = Math.random();
    sizes[index] = 0.012 + Math.random() * 0.028;
    speeds[index] = 0.65 + Math.random() * 0.7;
  }
  geometry.setAttribute("position", new BufferAttribute(positions, 3));
  geometry.setAttribute("aSeed", new BufferAttribute(seeds, 1));
  geometry.setAttribute("aSize", new BufferAttribute(sizes, 1));
  geometry.setAttribute("aSpeed", new BufferAttribute(speeds, 1));
  return geometry;
};

export const MouthSnowParticles = ({
  intensity,
  visible,
  depthTravel,
  coneXSpread,
  coneYSpread,
  burstId,
  lifetimeMin,
  lifetimeMax,
  spawnStagger,
}: {
  intensity: number;
  visible: boolean;
  depthTravel: number;
  coneXSpread: number;
  coneYSpread: number;
  burstId: number;
  lifetimeMin: number;
  lifetimeMax: number;
  spawnStagger: number;
}) => {
  const geometry = useMemo(createGeometry, []);
  const material = useMemo(
    () =>
      new ShaderMaterial({
        transparent: true,
        depthWrite: false,
        uniforms: {
          uTime: { value: 0 },
          uIntensity: { value: 0 },
          uDepthTravel: { value: depthTravel },
          uMaxPointSize: { value: 60 },
          uConeXSpread: { value: coneXSpread },
          uConeYSpread: { value: coneYSpread },
          uBurstStart: { value: -100 },
          uLifetimeMin: { value: lifetimeMin },
          uLifetimeMax: { value: lifetimeMax },
          uSpawnStagger: { value: spawnStagger },
        },
        vertexShader,
        fragmentShader,
      }),
    [coneXSpread, coneYSpread, depthTravel, lifetimeMax, lifetimeMin, spawnStagger],
  );
  const lastBurstId = useRef(0);
  useFrame(({ clock }) => {
    material.uniforms.uTime.value = clock.elapsedTime;
    material.uniforms.uIntensity.value = intensity;
    if (burstId > 0 && burstId !== lastBurstId.current) {
      lastBurstId.current = burstId;
      material.uniforms.uBurstStart.value = clock.elapsedTime;
    }
    material.uniforms.uLifetimeMin.value = lifetimeMin;
    material.uniforms.uLifetimeMax.value = lifetimeMax;
    material.uniforms.uSpawnStagger.value = spawnStagger;
  });
  return (
    <points
      visible={visible}
      geometry={geometry}
      material={material}
      frustumCulled={false}
    />
  );
};

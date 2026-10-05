/* eslint-disable react/no-unknown-property */
import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { ScreenSpaceUI, ScreenTransform, XRModel } from "@vincentt-xr/sdk";
import { useFaceInfo, getFaceBlendshape, FACE_LANDMARK_INDICES, FaceTracker, HandTracker } from "@vincentt-xr/sdk/tracking";
import { useXRModel } from "@vincentt-xr/sdk/low-level";
import { Vector4 } from "three";
import { SNOWY_WINDOW_CONFIG } from "./snowyWindowConfig";
import { handBrushes, mouthBrush, type Brush, type Point } from "./SnowyWindowInteraction";
import { snowyWindowFragmentShader, snowyWindowVertexShader } from "./SnowyWindowShader";

const MAX_BRUSHES = 32;

export const SnowyWindowExperience = () => {
  const materialRef = useRef<any>(null);
  const handModel = useXRModel<{ coordinates?: { left?: Point[]; right?: Point[] } }>(XRModel.HAND_TRACKER, { targetFps: SNOWY_WINDOW_CONFIG.tracking.targetFps });
  const face = useFaceInfo({ targetFps: SNOWY_WINDOW_CONFIG.tracking.targetFps, holdMs: 180 });
  const faceRef = useRef(face); faceRef.current = face;
  useFrame(({ clock }) => {
    const material = materialRef.current;
    if (!material) return;
    const model = handModel.node;
    const hands = [model?.coordinates?.left, model?.coordinates?.right].filter((hand): hand is Point[] => Boolean(hand));
    const bounds = hands.map((hand) => ({ minX: Math.min(...hand.map((p) => p.x)), minY: Math.min(...hand.map((p) => p.y)), maxX: Math.max(...hand.map((p) => p.x)), maxY: Math.max(...hand.map((p) => p.y)) }));
    const currentFace = faceRef.current;
    const mouthIndex = FACE_LANDMARK_INDICES["face.mouthCenter"];
    const mouthPoint = currentFace?.landmarks[mouthIndex];
    const open = Boolean(currentFace && getFaceBlendshape(currentFace, "jawOpen") >= SNOWY_WINDOW_CONFIG.mouth.jawOpenThreshold);
    const brushes: Brush[] = [
      ...handBrushes(hands, bounds, { ...SNOWY_WINDOW_CONFIG.hand, strength: -SNOWY_WINDOW_CONFIG.condensation.wipeStrength }),
      ...mouthBrush(mouthPoint ?? null, open, SNOWY_WINDOW_CONFIG.mouth.refillRadius, SNOWY_WINDOW_CONFIG.condensation.mouthRefillStrength),
    ].slice(0, MAX_BRUSHES);
    material.uniforms.uTime.value = clock.elapsedTime;
    material.uniforms.uBrushCount.value = brushes.length;
    brushes.forEach((brush, index) => material.uniforms.uBrushes.value[index].set(brush.x, brush.y, brush.radius, brush.mode === "wipe" ? brush.strength : Math.abs(brush.strength)));
  });
  return <>
    <FaceTracker />
    <HandTracker />
    <ScreenSpaceUI depth={0.02}>
      <ScreenTransform anchors={{ left: -1, right: 1, top: 1, bottom: -1 }}>
        <mesh name="snowyCondensation" renderOrder={2000} ref={(node) => { materialRef.current = node?.material; }}>
          <planeGeometry args={[1, 1]} />
          <shaderMaterial
            transparent
            depthWrite={false}
            uniforms={{
              uTime: { value: 0 }, uInitialDensity: { value: SNOWY_WINDOW_CONFIG.condensation.initialDensity },
              uGrowthSpeed: { value: SNOWY_WINDOW_CONFIG.condensation.growthSpeed }, uNoiseScale: { value: SNOWY_WINDOW_CONFIG.condensation.noiseScale },
              uWipeStrength: { value: SNOWY_WINDOW_CONFIG.condensation.wipeStrength }, uMouthStrength: { value: SNOWY_WINDOW_CONFIG.condensation.mouthRefillStrength },
              uBrushCount: { value: 0 }, uBrushes: { value: Array.from({ length: MAX_BRUSHES }, () => new Vector4()) },
            }}
            vertexShader={snowyWindowVertexShader}
            fragmentShader={snowyWindowFragmentShader}
          />
        </mesh>
      </ScreenTransform>
    </ScreenSpaceUI>
  </>;
};

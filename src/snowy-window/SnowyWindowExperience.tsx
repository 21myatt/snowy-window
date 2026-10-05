/* eslint-disable react/no-unknown-property */
import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { ScreenSpaceUI, ScreenTransform, XRModel } from "@vincentt-xr/sdk";
import { useFaceInfo, getFaceBlendshape, FACE_LANDMARK_INDICES, FaceTracker, HandTracker } from "@vincentt-xr/sdk/tracking";
import { useXRModelNode, type XRModelNodeHandTracking } from "@vincentt-xr/sdk/low-level";
import { Vector4 } from "three";
import { SNOWY_WINDOW_CONFIG } from "./snowyWindowConfig";
import { SnowyWindowInteractionEngine, type Brush } from "./SnowyWindowInteraction";
import { snowyWindowFragmentShader, snowyWindowVertexShader } from "./SnowyWindowShader";
import { CondensationMaskSimulation } from "./CondensationMaskSimulation";

const MAX_BRUSHES = 32;

export const SnowyWindowExperience = () => {
  const materialRef = useRef<any>(null);
  const handModel = useXRModelNode<XRModelNodeHandTracking>(XRModel.HAND_TRACKER);
  const face = useFaceInfo({ targetFps: SNOWY_WINDOW_CONFIG.tracking.targetFps, holdMs: 180 });
  const faceRef = useRef(face); faceRef.current = face;
  const interactionEngine = useRef(new SnowyWindowInteractionEngine({
    ...SNOWY_WINDOW_CONFIG.hand,
    strength: -SNOWY_WINDOW_CONFIG.condensation.wipeStrength,
  })).current;
  const simulation = useMemo(() => new CondensationMaskSimulation(SNOWY_WINDOW_CONFIG.condensation.initialDensity), []);
  const lastDebugLog = useRef(0);
  useFrame(({ clock }) => {
    const material = materialRef.current;
    if (!material) return;
    const model = handModel;
    const trackedHands = (model?.hands ?? []).map((hand) => ({
      points: hand.coordinates,
      gesture: hand.gesture,
      handedness: hand.handedness,
    })).filter((hand) => hand.points && hand.points.length >= 21);
    const hands = trackedHands.map((hand) => hand.points!.map(({ x, y }) => ({ x, y })));
    const currentFace = faceRef.current;
    const mouthIndex = FACE_LANDMARK_INDICES["face.mouthCenter"];
    const mouthPoint = currentFace?.landmarks[mouthIndex];
    const open = Boolean(currentFace && getFaceBlendshape(currentFace, "jawOpen") >= SNOWY_WINDOW_CONFIG.mouth.jawOpenThreshold);
    const brushes: Brush[] = [
      ...interactionEngine.createHandBrushes(hands, trackedHands.map((hand) => hand.gesture)),
      ...interactionEngine.createMouthBrush(mouthPoint ?? null, open, SNOWY_WINDOW_CONFIG.mouth.refillRadius, SNOWY_WINDOW_CONFIG.condensation.mouthRefillStrength),
    ].slice(0, MAX_BRUSHES);
    simulation.update(1 / SNOWY_WINDOW_CONFIG.tracking.targetFps, clock.elapsedTime, brushes, {
      growthSpeed: SNOWY_WINDOW_CONFIG.condensation.growthSpeed,
      wipeStrength: SNOWY_WINDOW_CONFIG.condensation.wipeStrength,
      mouthRefillStrength: SNOWY_WINDOW_CONFIG.condensation.mouthRefillStrength,
    });
    if (clock.elapsedTime - lastDebugLog.current >= 0.5) {
      lastDebugLog.current = clock.elapsedTime;
      // Required runtime diagnostics; throttled to two messages per second.
      // eslint-disable-next-line no-console
      console.log("[snowy-window] tracking", {
        palmHands: trackedHands.filter((hand) => hand.gesture?.toLowerCase() === "open_palm").length,
        palmStates: trackedHands.map((hand) => ({ handedness: hand.handedness ?? "unknown", gesture: hand.gesture ?? "none" })),
        secondFingertip: hands.map((hand) => hand[8] ?? null),
        mouthOpen: open,
      });
    }
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
              uMask: { value: simulation.texture },
            }}
            vertexShader={snowyWindowVertexShader}
            fragmentShader={snowyWindowFragmentShader}
          />
        </mesh>
      </ScreenTransform>
    </ScreenSpaceUI>
  </>;
};

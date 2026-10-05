/* eslint-disable react/no-unknown-property */
import { useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { ScreenSpaceUI, ScreenTransform, XRModel } from "@vincentt-xr/sdk";
import { useFaceInfo, getFaceBlendshape, FACE_LANDMARK_INDICES, FaceTracker, HandTracker } from "@vincentt-xr/sdk/tracking";
import { useXRModelNode, type XRModelNodeHandTracking } from "@vincentt-xr/sdk/low-level";
import { Vector2, Vector4 } from "three";
import { SNOWY_WINDOW_CONFIG } from "./snowyWindowConfig";
import { faceToUv, SnowyWindowInteractionEngine, type Brush } from "./SnowyWindowInteraction";
import { snowyWindowFragmentShader, snowyWindowVertexShader } from "./SnowyWindowShader";
import { MouthSnowParticles } from "./MouthSnowParticles";
import { CondensationMaskSimulation } from "./CondensationMaskSimulation";

const MAX_BRUSHES = 32;

export const SnowyWindowExperience = () => {
  const materialRef = useRef<any>(null);
  const previousMouthAction = useRef(false);
  const burstStartedAt = useRef(-Infinity);
  const burstId = useRef(0);
  const nextAutoRefillAt = useRef(0);
  const autoRefillStartedAt = useRef(-Infinity);
  const lastMouthUv = useRef<{ x: number; y: number } | null>(null);
  const [mouthEmitter, setMouthEmitter] = useState({ visible: false, intensity: 0, burstId: 0, left: -0.1, right: 0.1, top: 0.2, bottom: -0.2 });
  const handModel = useXRModelNode<XRModelNodeHandTracking>(XRModel.HAND_TRACKER);
  const face = useFaceInfo({ targetFps: SNOWY_WINDOW_CONFIG.tracking.targetFps, holdMs: 60 });
  const faceRef = useRef(face); faceRef.current = face;
  const interactionEngine = useRef(new SnowyWindowInteractionEngine({
    ...SNOWY_WINDOW_CONFIG.hand,
    strength: -SNOWY_WINDOW_CONFIG.condensation.wipeStrength,
  })).current;
  const simulation = useMemo(() => new CondensationMaskSimulation(SNOWY_WINDOW_CONFIG.condensation.initialDensity), []);
  useFrame(({ clock }, delta) => {
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
    const upperLip = currentFace?.landmarks[mouthIndex];
    const lowerLip = currentFace?.landmarks[14];
    const mouthPoint = upperLip && lowerLip
      ? { x: (upperLip.x + lowerLip.x) / 2, y: (upperLip.y + lowerLip.y) / 2 }
      : upperLip;
    const jawOpen = Boolean(currentFace && getFaceBlendshape(currentFace, "jawOpen") >= SNOWY_WINDOW_CONFIG.mouth.jawOpenThreshold);
    const pucker = Boolean(
      currentFace
      && getFaceBlendshape(currentFace, "mouthPucker") >= SNOWY_WINDOW_CONFIG.mouth.puckerThreshold
      && getFaceBlendshape(currentFace, "mouthFunnel") >= 0.35,
    );
    const open = jawOpen || pucker;
    if (open && !previousMouthAction.current) {
      burstStartedAt.current = clock.elapsedTime;
      burstId.current += 1;
    }
    previousMouthAction.current = open;
    const burstActive = open && clock.elapsedTime - burstStartedAt.current <= SNOWY_WINDOW_CONFIG.mouth.burstDuration;
    const mouthUv = mouthPoint ? faceToUv(mouthPoint) : null;
    if (mouthUv) lastMouthUv.current = mouthUv;
    const autoCenter = mouthUv ?? lastMouthUv.current;
    const autoRefillTriggered = Boolean(autoCenter && clock.elapsedTime >= nextAutoRefillAt.current);
    if (autoRefillTriggered) {
      nextAutoRefillAt.current = clock.elapsedTime + SNOWY_WINDOW_CONFIG.mouth.autoRefillInterval;
      autoRefillStartedAt.current = clock.elapsedTime;
    }
    const autoRefillActive = Boolean(
      autoCenter
      && clock.elapsedTime - autoRefillStartedAt.current <= SNOWY_WINDOW_CONFIG.mouth.autoRefillDuration,
    );
    const autoBrushes: Brush[] = [];
    if (autoCenter && autoRefillActive) {
      autoBrushes.push({
        ...autoCenter,
        radius: SNOWY_WINDOW_CONFIG.mouth.autoRefillRadius,
        strength: SNOWY_WINDOW_CONFIG.mouth.autoRefillStrength,
        mode: "refill",
      });
    }
    const brushes: Brush[] = [
      ...interactionEngine.createHandBrushes(hands, trackedHands.map((hand) => hand.gesture)),
      ...autoBrushes,
    ].slice(0, MAX_BRUSHES);
    simulation.update(delta, clock.elapsedTime, brushes, {
      growthSpeed: SNOWY_WINDOW_CONFIG.condensation.growthSpeed,
      wipeStrength: SNOWY_WINDOW_CONFIG.condensation.wipeStrength,
      mouthRefillStrength: SNOWY_WINDOW_CONFIG.condensation.mouthRefillStrength,
      brushSoftness: SNOWY_WINDOW_CONFIG.hand.brushSoftness,
      wipeResidue: SNOWY_WINDOW_CONFIG.condensation.wipeResidue,
      wipeDisplacement: SNOWY_WINDOW_CONFIG.condensation.wipeDisplacement,
      wipeResidueDrySpeed: SNOWY_WINDOW_CONFIG.condensation.wipeResidueDrySpeed,
      wipeClearThreshold: SNOWY_WINDOW_CONFIG.condensation.wipeClearThreshold,
      wipeGrowthDelay: SNOWY_WINDOW_CONFIG.condensation.wipeGrowthDelay,
    });
    material.uniforms.uTime.value = clock.elapsedTime;
    const halfWidth = SNOWY_WINDOW_CONFIG.mouth.emitterWidth / 2;
    const bottom = mouthUv ? mouthUv.y * 2 - 1 : -1;
    const centerX = mouthUv ? mouthUv.x * 2 - 1 : 0;
    const nextEmitter = {
      visible: Boolean(burstActive && mouthUv),
      intensity: pucker ? 1.0 : 0.78,
      burstId: burstId.current,
      left: centerX - halfWidth,
      right: centerX + halfWidth,
      bottom,
      top: bottom + SNOWY_WINDOW_CONFIG.mouth.emitterHeight,
    };
    setMouthEmitter((previous) => {
      if (Math.abs(previous.left - nextEmitter.left) < 0.002 && Math.abs(previous.bottom - nextEmitter.bottom) < 0.002 && previous.visible === nextEmitter.visible && previous.intensity === nextEmitter.intensity && previous.burstId === nextEmitter.burstId) return previous;
      return nextEmitter;
    });
    if (autoCenter) {
      material.uniforms.uFrostBloom.value.set(
        autoCenter.x,
        autoCenter.y,
        autoRefillStartedAt.current,
        SNOWY_WINDOW_CONFIG.mouth.frostBloomRadius,
      );
      material.uniforms.uFrostBloomStrength.value = SNOWY_WINDOW_CONFIG.mouth.frostBloomStrength;
    }
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
              uTime: { value: 0 }, uNoiseScale: { value: SNOWY_WINDOW_CONFIG.condensation.noiseScale },
              uDriftSpeed: { value: SNOWY_WINDOW_CONFIG.condensation.driftSpeed },
              uFilmOpacity: { value: SNOWY_WINDOW_CONFIG.condensation.filmOpacity },
              uDropletOpacity: { value: SNOWY_WINDOW_CONFIG.condensation.dropletOpacity },
              uDropletScale: { value: SNOWY_WINDOW_CONFIG.condensation.dropletScale },
              uDropletStretch: { value: SNOWY_WINDOW_CONFIG.condensation.dropletStretch },
              uEdgeStrength: { value: SNOWY_WINDOW_CONFIG.condensation.edgeStrength },
              uHighlightStrength: { value: SNOWY_WINDOW_CONFIG.condensation.highlightStrength },
              uReflectionStrength: { value: SNOWY_WINDOW_CONFIG.condensation.reflectionStrength },
              uGravity: { value: SNOWY_WINDOW_CONFIG.condensation.gravity },
              uTrailStrength: { value: SNOWY_WINDOW_CONFIG.condensation.trailStrength },
              uResolution: { value: new Vector2(SNOWY_WINDOW_CONFIG.canvas.width, SNOWY_WINDOW_CONFIG.canvas.height) },
              uMask: { value: simulation.texture },
              uFrostBloom: { value: new Vector4(0.5, 0.5, -100, SNOWY_WINDOW_CONFIG.mouth.frostBloomRadius) },
              uFrostBloomStrength: { value: 0 },
            }}
            vertexShader={snowyWindowVertexShader}
            fragmentShader={snowyWindowFragmentShader}
          />
        </mesh>
      </ScreenTransform>
      <ScreenTransform anchors={{ left: mouthEmitter.left, right: mouthEmitter.right, top: mouthEmitter.top, bottom: mouthEmitter.bottom }}>
        <MouthSnowParticles
          intensity={mouthEmitter.visible ? mouthEmitter.intensity : 0}
          visible={mouthEmitter.visible}
          depthTravel={SNOWY_WINDOW_CONFIG.mouth.particleDepthTravel}
          coneXSpread={SNOWY_WINDOW_CONFIG.mouth.particleConeXSpread}
          coneYSpread={SNOWY_WINDOW_CONFIG.mouth.particleConeYSpread}
          burstId={mouthEmitter.burstId}
          lifetimeMin={SNOWY_WINDOW_CONFIG.mouth.particleLifetimeMin}
          lifetimeMax={SNOWY_WINDOW_CONFIG.mouth.particleLifetimeMax}
          spawnStagger={SNOWY_WINDOW_CONFIG.mouth.particleSpawnStagger}
        />
      </ScreenTransform>
    </ScreenSpaceUI>
  </>;
};

/* eslint-disable react/no-unknown-property */
import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { ScreenSpaceUI, ScreenTransform, XRModel } from "@vincentt-xr/sdk";
import { HandTracker, useFaceAction, useFaceInfo } from "@vincentt-xr/sdk/tracking";
import { useXRModelNode, type XRModelNodeHandTracking } from "@vincentt-xr/sdk/low-level";
import { ShaderMaterial, Vector2 } from "three";
import { SNOWY_WINDOW_CONFIG } from "./snowyWindowConfig";
import { SnowyWindowInteractionEngine } from "./SnowyWindowInteraction";
import { snowyWindowFragmentShader, snowyWindowVertexShader } from "./SnowyWindowShader";
import { CrystalGrowthSimulation } from "./CrystalGrowthSimulation";


export const SnowyWindowExperience = () => {
  const materialRef = useRef<ShaderMaterial | null>(null);
  const nextAutoRefillAt = useRef<number>(SNOWY_WINDOW_CONFIG.autoRefill.interval);
  const handModel = useXRModelNode<XRModelNodeHandTracking>(XRModel.HAND_TRACKER);
  const face = useFaceInfo({ active: true });
  const mouthOpen = useFaceAction(face, "mouthOpen");
  const interactionEngine = useRef(new SnowyWindowInteractionEngine({
    ...SNOWY_WINDOW_CONFIG.hand,
    strength: -1,
  })).current;
  const simulation = useMemo(() => new CrystalGrowthSimulation(SNOWY_WINDOW_CONFIG.condensation.initialDensity), []);

  const uniforms = useMemo(() => ({
              uTime: { value: 0 },
              uNoiseScale: { value: SNOWY_WINDOW_CONFIG.condensation.noiseScale },
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
              uResolution: { value: new Vector2(simulation.width, simulation.height) },
              uMask: { value: simulation.texture },
  }), [simulation]);

  useEffect(() => () => simulation.dispose(), [simulation]);

  useFrame(({ clock }, delta) => {
    const material = materialRef.current;
    if (!material) return;
    const trackedHands = (handModel?.hands ?? []).map((hand) => ({
      points: hand.coordinates,
      gesture: hand.gesture,
    })).filter((hand) => hand.points && hand.points.length >= 21);
    const hands = trackedHands.map((hand) => hand.points!.map(({ x, y }) => ({ x, y })));
    const brushes = interactionEngine.createHandBrushes(hands, trackedHands.map((hand) => hand.gesture));
    const mouth = face?.landmarks?.[13];
    if (mouthOpen.active && mouth) {
      brushes.push({
        x: mouth.x,
        y: 1 - mouth.y,
        radius: SNOWY_WINDOW_CONFIG.face.breathRadius,
        strength: -SNOWY_WINDOW_CONFIG.face.breathStrength,
        mode: "wipe",
      });
    }
    const handIsWiping = brushes.some((brush) => brush.mode === "wipe");

    if (handIsWiping) {
      simulation.cancelAutoRefill();
      nextAutoRefillAt.current = clock.elapsedTime + SNOWY_WINDOW_CONFIG.autoRefill.interval;
    } else if (clock.elapsedTime >= nextAutoRefillAt.current) {
      nextAutoRefillAt.current = clock.elapsedTime + SNOWY_WINDOW_CONFIG.autoRefill.interval;
      simulation.startAutoRefill(SNOWY_WINDOW_CONFIG.autoRefill.seedCount);
    }
    simulation.update(delta, brushes, {
      wipeStrength: SNOWY_WINDOW_CONFIG.condensation.wipeStrength,
      wipeResidue: SNOWY_WINDOW_CONFIG.condensation.wipeResidue,
      wipeDisplacement: SNOWY_WINDOW_CONFIG.condensation.wipeDisplacement,
      wipeResidueDrySpeed: SNOWY_WINDOW_CONFIG.condensation.wipeResidueDrySpeed,
      wipeClearThreshold: SNOWY_WINDOW_CONFIG.condensation.wipeClearThreshold,
      wipeGrowthDelay: SNOWY_WINDOW_CONFIG.condensation.wipeGrowthDelay,
      growthRate: SNOWY_WINDOW_CONFIG.autoRefill.growthRate,
    });
    material.uniforms.uTime.value = simulation.elapsedTime;
    // The SDK's render passes can reuse the bound material between frames.
    // Explicitly upload time so new-ice highlights age on the GPU as well.
    material.uniformsNeedUpdate = true;
  });

  return <>
    <HandTracker />
    <ScreenSpaceUI depth={0.02}>
      <ScreenTransform anchors={{ left: -1, right: 1, top: 1, bottom: -1 }}>
        <mesh name="snowyCondensation" renderOrder={2000} >
          <planeGeometry args={[1, 1]} />
          <shaderMaterial
            ref={materialRef}
            transparent
            depthWrite={false}
            uniforms={uniforms}
            vertexShader={snowyWindowVertexShader}
            fragmentShader={snowyWindowFragmentShader}
          />
        </mesh>
      </ScreenTransform>
    </ScreenSpaceUI>
  </>;
};

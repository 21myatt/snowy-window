export const SNOWY_WINDOW_CONFIG = {
  canvas: { width: 720, height: 1280 },
  condensation: {
    initialDensity: 0.78,
    noiseScale: 3.2,
    driftSpeed: 0.018,
    wipeStrength: 7,
    wipeDisplacement: 0.48,
    wipeResidue: 0.12,
    wipeResidueDrySpeed: 0.95,
    wipeClearThreshold: 0.015,
    wipeGrowthDelay: 0.8,
    filmOpacity: 0.28,
    dropletOpacity: 0.48,
    dropletScale: 34,
    dropletStretch: 1.8,
    edgeStrength: 0.22,
    highlightStrength: 0.38,
    reflectionStrength: 0.12,
    gravity: 0.008,
    trailStrength: 0.16,
  },
  hand: {
    boundingBoxRadius: 0.075,
    palmRadiusMultiplier: 2.8,
    fingertipRadius: 0.055,
    pinchDistance: 0.12,
    singleFingerExtensionRatio: 1.12,
    frostStrength: 1,
  },
  face: {
    breathRadius: 0.13,
    breathStrength: 0.9,
  },
  autoRefill: {
    growthRate: 3.6,
    interval: 2,
    seedCount: 5,
  },
} as const;

export type SnowyWindowConfig = typeof SNOWY_WINDOW_CONFIG;

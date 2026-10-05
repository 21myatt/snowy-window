export const SNOWY_WINDOW_CONFIG = {
  canvas: { width: 720, height: 1280 },
  condensation: {
    initialDensity: 0.78,
    growthSpeed: 0.035,
    noiseScale: 3.2,
    driftSpeed: 0.018,
    wipeStrength: 1.15,
    mouthRefillStrength: 0.72,
  },
  hand: {
    boundingBoxRadius: 0.13,
    fingertipRadius: 0.055,
    brushSoftness: 0.72,
  },
  mouth: {
    jawOpenThreshold: 0.42,
    refillRadius: 0.12,
    smoothing: 0.18,
  },
  tracking: { targetFps: 24 },
} as const;

export type SnowyWindowConfig = typeof SNOWY_WINDOW_CONFIG;

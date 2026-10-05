export type Point = { x: number; y: number };
export type Brush = Point & { radius: number; strength: number; mode: "wipe" | "refill" };
export type HandBounds = { minX: number; minY: number; maxX: number; maxY: number };
export type HandGesture = "open_palm" | "closed_fist" | string | undefined;

const clamp = (value: number) => Math.min(1, Math.max(0, value));

/** SDK tracking coordinates are normalized to -1..1 with +y up. */
export const toUv = (point: Point): Point => ({
  x: clamp((point.x + 1) / 2),
  // Shader UVs have their origin at the bottom; the SDK hand point uses NDC
  // with +y up, so this keeps the tracked point visually aligned.
  y: clamp((point.y + 1) / 2),
});

export const palmCenter = (hand: Point[]): Point | null => {
  const palmPoints = [hand[0], hand[5], hand[9], hand[13], hand[17]].filter(
    (point): point is Point => Boolean(point),
  );
  if (palmPoints.length === 0) return null;
  return {
    x: palmPoints.reduce((sum, point) => sum + point.x, 0) / palmPoints.length,
    y: palmPoints.reduce((sum, point) => sum + point.y, 0) / palmPoints.length,
  };
};

const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
const FINGERTIPS = [4, 8, 12, 16, 20] as const;
const FINGER_JOINTS = [3, 6, 10, 14, 18] as const;

export const extendedFingerIndices = (hand: Point[], ratio: number): number[] => {
  const wrist = hand[0];
  if (!wrist) return [];
  return FINGERTIPS.filter((tipIndex, fingerIndex) => {
    const tip = hand[tipIndex];
    const joint = hand[FINGER_JOINTS[fingerIndex]];
    return Boolean(tip && joint && distance(tip, wrist) > distance(joint, wrist) * ratio);
  });
};

export const handBrushes = (
  hands: Point[][],
  gestures: HandGesture[],
  config: { boundingBoxRadius: number; palmRadiusMultiplier: number; fingertipRadius: number; singleFingerExtensionRatio: number; strength: number },
): Brush[] => {
  const result: Brush[] = hands.flatMap((hand, handIndex) => {
    const center = palmCenter(hand);
    if (!center) return [];
    const gesture = gestures[handIndex]?.toLowerCase();
    if (gesture === "open_palm") {
      return [{ ...toUv(center), radius: config.boundingBoxRadius * config.palmRadiusMultiplier, strength: config.strength, mode: "wipe" as const }];
    }
    const extended = extendedFingerIndices(hand, config.singleFingerExtensionRatio);
    if (extended.length !== 1) return [];
    const tip = hand[extended[0]];
    return tip ? [{ ...toUv(tip), radius: config.fingertipRadius, strength: config.strength, mode: "wipe" as const }] : [];
  });
  return result;
};

export const mouthBrush = (
  mouth: Point | null,
  open: boolean,
  radius: number,
  strength: number,
): Brush[] => (mouth && open ? [{ ...toUv(mouth), radius, strength, mode: "refill" }] : []);

/** Object-oriented boundary for the interaction domain; React only adapts SDK data into it. */
export class SnowyWindowInteractionEngine {
  constructor(private readonly config: { boundingBoxRadius: number; palmRadiusMultiplier: number; fingertipRadius: number; singleFingerExtensionRatio: number; strength: number }) {}

  createHandBrushes(hands: Point[][], gestures: HandGesture[]): Brush[] {
    return handBrushes(hands, gestures, this.config);
  }

  // The class owns both interaction paths; this method intentionally delegates
  // to the stateless mouth mapping while preserving one feature boundary.
  // eslint-disable-next-line class-methods-use-this
  createMouthBrush(mouth: Point | null, open: boolean, radius: number, strength: number): Brush[] {
    return mouthBrush(mouth, open, radius, strength);
  }
}

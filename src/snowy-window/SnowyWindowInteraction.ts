export type Point = { x: number; y: number };
export type Brush = Point & { radius: number; strength: number; mode: "wipe" | "refill"; velocity?: Point; from?: Point };
export type HandBounds = { minX: number; minY: number; maxX: number; maxY: number };
export type HandGesture = "open_palm" | "closed_fist" | string | undefined;
export type HandPoseState = "palm" | `finger:${number}` | "none";

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

export const classifyHand = (hand: Point[], gesture: HandGesture, ratio: number): HandPoseState => {
  if (gesture?.toLowerCase() === "open_palm") return "palm";
  const extended = extendedFingerIndices(hand, ratio);
  return extended.length === 1 ? `finger:${extended[0]}` : "none";
};

export const handBrushes = (
  hands: Point[][],
  gestures: HandGesture[],
  config: { boundingBoxRadius: number; palmRadiusMultiplier: number; fingertipRadius: number; singleFingerExtensionRatio: number; strength: number; brushSoftness?: number },
): Brush[] => {
  const result: Brush[] = hands.flatMap((hand, handIndex) => {
    const center = palmCenter(hand);
    if (!center) return [];
    const state = classifyHand(hand, gestures[handIndex], config.singleFingerExtensionRatio);
    if (state === "palm") {
      return [{ ...toUv(center), radius: config.boundingBoxRadius * config.palmRadiusMultiplier, strength: config.strength, mode: "wipe" as const }];
    }
    if (state === "none") return [];
    const tip = hand[Number(state.slice("finger:".length))];
    return tip ? [{ ...toUv(tip), radius: config.fingertipRadius, strength: config.strength, mode: "wipe" as const }] : [];
  });
  return result;
};

/** Object-oriented boundary for the interaction domain; React only adapts SDK data into it. */
export class SnowyWindowInteractionEngine {
  private readonly previous = new Map<number, { state: HandPoseState; point: Point }>();

  constructor(private readonly config: { boundingBoxRadius: number; palmRadiusMultiplier: number; fingertipRadius: number; singleFingerExtensionRatio: number; strength: number; brushSoftness?: number }) {}

  createHandBrushes(hands: Point[][], gestures: HandGesture[]): Brush[] {
    const brushes: Brush[] = [];
    hands.forEach((hand, handIndex) => {
      const center = palmCenter(hand);
      const state = classifyHand(hand, gestures[handIndex], this.config.singleFingerExtensionRatio);
      if (!center || state === "none") {
        this.previous.delete(handIndex);
        return;
      }
      const current = handBrushes([hand], [gestures[handIndex]], this.config)[0];
      if (!current) {
        this.previous.delete(handIndex);
        return;
      }
      const previous = this.previous.get(handIndex);
      if (previous && previous.state === state) {
        const distanceBetween = Math.hypot(current.x - previous.point.x, current.y - previous.point.y);
        const velocity = { x: current.x - previous.point.x, y: current.y - previous.point.y };
        // A capsule represents the entire stroke once. Reject jumps from reacquisition.
        brushes.push({ ...current, from: distanceBetween < 0.35 ? previous.point : undefined, velocity });
      } else {
        brushes.push(current);
      }
      this.previous.set(handIndex, { state, point: { x: current.x, y: current.y } });
    });
    Array.from(this.previous.keys()).forEach((index) => {
      if (index >= hands.length) this.previous.delete(index);
    });
    return brushes;
  }

}

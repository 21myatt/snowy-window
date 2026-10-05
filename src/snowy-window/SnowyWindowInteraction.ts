export type Point = { x: number; y: number };
export type Brush = Point & { radius: number; strength: number; mode: "wipe" | "refill" };
export type HandBounds = { minX: number; minY: number; maxX: number; maxY: number };

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

export const handBrushes = (
  hands: Point[][],
  bounds: Array<{ minX: number; minY: number; maxX: number; maxY: number }>,
  config: { boundingBoxRadius: number; fingertipRadius: number; strength: number },
): Brush[] => {
  const result: Brush[] = hands.flatMap((hand, handIndex) => {
    const center = palmCenter(hand);
    if (!center) return [];
    // The bounds keep the broad brush tied to the detected hand; the center is
    // deliberately computed from palm joints so extended fingers cannot pull it.
    const box = bounds[handIndex];
    return [{
      ...toUv(center),
      radius: config.boundingBoxRadius * (box ? 1 : 0.8),
      strength: config.strength,
      mode: "wipe" as const,
    }];
  });
  hands.forEach((hand) => {
    // Only the second fingertip in the brief: MediaPipe index-finger tip = 8.
    const secondFingertip = hand[8];
    if (secondFingertip) result.push({ ...toUv(secondFingertip), radius: config.fingertipRadius, strength: config.strength, mode: "wipe" });
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
  constructor(private readonly config: { boundingBoxRadius: number; fingertipRadius: number; strength: number }) {}

  createHandBrushes(hands: Point[][], bounds: HandBounds[]): Brush[] {
    return handBrushes(hands, bounds, this.config);
  }

  // The class owns both interaction paths; this method intentionally delegates
  // to the stateless mouth mapping while preserving one feature boundary.
  // eslint-disable-next-line class-methods-use-this
  createMouthBrush(mouth: Point | null, open: boolean, radius: number, strength: number): Brush[] {
    return mouthBrush(mouth, open, radius, strength);
  }
}

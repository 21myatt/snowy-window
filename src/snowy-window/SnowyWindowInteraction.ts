export type Point = { x: number; y: number };
export type Brush = Point & { radius: number; strength: number; mode: "wipe" | "refill" };
export type HandBounds = { minX: number; minY: number; maxX: number; maxY: number };

const clamp = (value: number) => Math.min(1, Math.max(0, value));

/** SDK tracking coordinates are normalized to -1..1 with +y up. */
export const toUv = (point: Point): Point => ({
  x: clamp((point.x + 1) / 2),
  y: clamp((1 - point.y) / 2),
});

export const handBrushes = (
  hands: Point[][],
  bounds: Array<{ minX: number; minY: number; maxX: number; maxY: number }>,
  config: { boundingBoxRadius: number; fingertipRadius: number; strength: number },
): Brush[] => {
  const result: Brush[] = bounds.map((box) => ({
    ...toUv({ x: (box.minX + box.maxX) / 2, y: (box.minY + box.maxY) / 2 }),
    radius: config.boundingBoxRadius,
    strength: config.strength,
    mode: "wipe",
  }));
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

export type Point = { x: number; y: number };
export type Brush = Point & { radius: number; strength: number; mode: "wipe" | "refill" };

const clamp = (value: number) => Math.min(1, Math.max(0, value));

export const toUv = (point: Point): Point => ({ x: clamp(point.x), y: clamp(1 - point.y) });

export const handBrushes = (
  hands: Point[][],
  bounds: Array<{ minX: number; minY: number; maxX: number; maxY: number }>,
  config: { boundingBoxRadius: number; fingertipRadius: number; strength: number },
): Brush[] => {
  const result: Brush[] = bounds.map((box) => ({
    x: clamp((box.minX + box.maxX) / 2),
    y: clamp(1 - (box.minY + box.maxY) / 2),
    radius: config.boundingBoxRadius,
    strength: config.strength,
    mode: "wipe",
  }));
  hands.forEach((hand) => {
    // MediaPipe's five fingertip indices in the 21-point hand model.
    [4, 8, 12, 16, 20].forEach((index) => {
      const point = hand[index];
      if (point) result.push({ ...toUv(point), radius: config.fingertipRadius, strength: config.strength, mode: "wipe" });
    });
  });
  return result;
};

export const mouthBrush = (
  mouth: Point | null,
  open: boolean,
  radius: number,
  strength: number,
): Brush[] => (mouth && open ? [{ ...toUv(mouth), radius, strength, mode: "refill" }] : []);

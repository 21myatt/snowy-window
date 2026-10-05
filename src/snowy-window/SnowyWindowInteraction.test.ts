import { describe, expect, it } from "vitest";
import { handBrushes, mouthBrush, toUv } from "./SnowyWindowInteraction";

describe("snowy window interaction mapping", () => {
  it("converts top-left tracking coordinates to shader UV coordinates", () => {
    expect(toUv({ x: -0.5, y: 0.2 })).toEqual({ x: 0.25, y: 0.4 });
    expect(toUv({ x: -1, y: 2 })).toEqual({ x: 0, y: 0 });
  });

  it("creates one broad palm wipe and one second-fingertip wipe per hand", () => {
    const hand = Array.from({ length: 21 }, (_, index) => ({ x: index / 20, y: index / 20 }));
    const brushes = handBrushes([hand], [{ minX: 0.1, minY: 0.2, maxX: 0.5, maxY: 0.8 }], {
      boundingBoxRadius: 0.13,
      fingertipRadius: 0.05,
      strength: -1,
    });
    expect(brushes).toHaveLength(2);
    expect(brushes.every((brush) => brush.mode === "wipe")).toBe(true);
  });

  it("refills only while the mouth is open and a mouth point exists", () => {
    expect(mouthBrush({ x: 0.4, y: 0.3 }, true, 0.1, 0.7)).toHaveLength(1);
    expect(mouthBrush({ x: 0.4, y: 0.3 }, false, 0.1, 0.7)).toHaveLength(0);
    expect(mouthBrush(null, true, 0.1, 0.7)).toHaveLength(0);
  });
});

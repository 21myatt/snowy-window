import { describe, expect, it } from "vitest";
import { extendedFingerIndices, handBrushes, mouthBrush, palmCenter, SnowyWindowInteractionEngine, toUv } from "./SnowyWindowInteraction";

describe("snowy window interaction mapping", () => {
  it("converts top-left tracking coordinates to shader UV coordinates", () => {
    expect(toUv({ x: -0.5, y: 0.2 })).toEqual({ x: 0.25, y: 0.6 });
    expect(toUv({ x: -1, y: 2 })).toEqual({ x: 0, y: 1 });
  });

  it("creates one broad palm wipe and one second-fingertip wipe per hand", () => {
    const hand = Array.from({ length: 21 }, (_, index) => ({ x: index / 20, y: index / 20 }));
    const brushes = handBrushes([hand], ["open_palm"], {
      boundingBoxRadius: 0.13,
      palmRadiusMultiplier: 1.25,
      fingertipRadius: 0.05,
      singleFingerExtensionRatio: 1.12,
      strength: -1,
    });
    expect(brushes).toHaveLength(1);
    expect(brushes.every((brush) => brush.mode === "wipe")).toBe(true);
  });

  it("activates only the one extended finger when the palm is not open", () => {
    const hand = Array.from({ length: 21 }, () => ({ x: 0, y: 0 }));
    hand[0] = { x: 0, y: 0 };
    hand[8] = { x: 0, y: 1 }; hand[6] = { x: 0, y: 0.5 };
    const brushes = handBrushes([hand], ["closed_fist"], {
      boundingBoxRadius: 0.13, palmRadiusMultiplier: 1.25, fingertipRadius: 0.05,
      singleFingerExtensionRatio: 1.12, strength: -1,
    });
    expect(extendedFingerIndices(hand, 1.12)).toEqual([8]);
    expect(brushes).toHaveLength(1);
    expect(brushes[0].radius).toBe(0.05);
  });

  it("does not wipe for ambiguous multi-finger poses", () => {
    const hand = Array.from({ length: 21 }, () => ({ x: 0, y: 0 }));
    [4, 8].forEach((tip) => { hand[tip] = { x: 0, y: 1 }; });
    [3, 6].forEach((joint) => { hand[joint] = { x: 0, y: 0.5 }; });
    expect(handBrushes([hand], ["closed_fist"], {
      boundingBoxRadius: 0.13, palmRadiusMultiplier: 1.25, fingertipRadius: 0.05,
      singleFingerExtensionRatio: 1.12, strength: -1,
    })).toHaveLength(0);
  });

  it("interpolates a continuous trail while the same hand state moves", () => {
    const engine = new SnowyWindowInteractionEngine({
      boundingBoxRadius: 0.13, palmRadiusMultiplier: 1.25, fingertipRadius: 0.05,
      singleFingerExtensionRatio: 1.12, strength: -1,
    });
    const first = Array.from({ length: 21 }, () => ({ x: 0, y: 0 }));
    first[8] = { x: 0, y: 1 }; first[6] = { x: 0, y: 0.5 };
    const second = first.map((point) => ({ ...point }));
    second[8] = { x: 1, y: 1 };
    expect(engine.createHandBrushes([first], ["closed_fist"])).toHaveLength(1);
    expect(engine.createHandBrushes([second], ["closed_fist"]).length).toBeGreaterThan(1);
  });

  it("centers the palm brush on wrist and MCP joints, not fingertip extension", () => {
    const hand = Array.from({ length: 21 }, () => ({ x: 0.8, y: 0.8 }));
    hand[0] = { x: -0.2, y: -0.2 };
    [5, 9, 13, 17].forEach((index) => { hand[index] = { x: -0.1, y: -0.1 }; });
    const center = palmCenter(hand);
    expect(center?.x).toBeCloseTo(-0.12);
    expect(center?.y).toBeCloseTo(-0.12);
  });

  it("refills only while the mouth is open and a mouth point exists", () => {
    expect(mouthBrush({ x: 0.4, y: 0.3 }, true, 0.1, 0.7)).toHaveLength(1);
    expect(mouthBrush({ x: 0.4, y: 0.3 }, false, 0.1, 0.7)).toHaveLength(0);
    expect(mouthBrush(null, true, 0.1, 0.7)).toHaveLength(0);
  });
});

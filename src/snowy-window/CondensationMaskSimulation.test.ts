import { describe, expect, it } from "vitest";
import { CondensationMaskSimulation } from "./CondensationMaskSimulation";

const config = {
  growthSpeed: 0,
  wipeStrength: 10,
  mouthRefillStrength: 1,
  brushSoftness: 0.72,
  wipeResidue: 1,
  wipeDisplacement: 0.18,
  wipeResidueDrySpeed: 0.5,
  wipeClearThreshold: 0.015,
  wipeGrowthDelay: 0.8,
};

describe("condensation wipe simulation", () => {
  it("allows a contacted pixel to become completely clear", () => {
    const simulation = new CondensationMaskSimulation(1);
    const brush = { x: 0.5, y: 0.5, radius: 0.2, strength: -1, mode: "wipe" as const };
    for (let i = 0; i < 8; i += 1) simulation.update(1 / 24, i / 24, [brush], config);
    expect(simulation.getPixel(64, 64).condensation).toBe(0);
  });

  it("leaves wet residue that dries without restoring condensation", () => {
    const simulation = new CondensationMaskSimulation(1);
    const brush = { x: 0.5, y: 0.5, radius: 0.2, strength: -1, mode: "wipe" as const };
    for (let i = 0; i < 8; i += 1) simulation.update(1 / 24, i / 24, [brush], config);
    const wet = simulation.getPixel(64, 64);
    expect(wet.residue).toBeGreaterThan(0);
    for (let i = 1; i < 80; i += 1) simulation.update(1 / 24, i / 24, [], config);
    const dry = simulation.getPixel(64, 64);
    expect(dry.residue).toBeLessThan(wet.residue);
    expect(dry.condensation).toBe(0);
  });

  it("refills condensation without creating wipe residue", () => {
    const simulation = new CondensationMaskSimulation(0);
    const brush = { x: 0.5, y: 0.5, radius: 0.2, strength: 1, mode: "refill" as const };
    simulation.update(1, 0, [brush], config);
    const pixel = simulation.getPixel(64, 64);
    expect(pixel.condensation).toBeGreaterThan(0);
    expect(pixel.residue).toBe(0);
  });
});

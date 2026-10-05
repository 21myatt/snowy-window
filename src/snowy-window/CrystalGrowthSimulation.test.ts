import { describe, expect, it } from "vitest";
import { CrystalGrowthSimulation } from "./CrystalGrowthSimulation";
import { SNOWY_WINDOW_CONFIG } from "./snowyWindowConfig";

const config = { ...SNOWY_WINDOW_CONFIG.condensation, growthRate: SNOWY_WINDOW_CONFIG.autoRefill.growthRate };
const brush = { x: 0.5, y: 0.5, radius: 0.2, strength: -1, mode: "wipe" as const };
const advance = (s: CrystalGrowthSimulation, seconds: number, fps = 60) => {
  for (let i = 0; i < seconds * fps; i += 1) s.update(1 / fps, [], config);
};

describe("persistent crystalline growth", () => {
  it("clears contact, erases ice age and leaves water which dries", () => {
    const s = new CrystalGrowthSimulation(0.78, 64, 64);
    for (let i = 0; i < 20; i += 1) s.update(1 / 60, [brush], config);
    const wet = s.getPixel(32, 32);
    expect(wet.condensation).toBe(0);
    expect(wet.frozen).toBe(0);
    expect(wet.birthTime).toBe(-100);
    expect(wet.residue).toBeGreaterThan(0);
    advance(s, 2);
    expect(s.getPixel(32, 32).residue).toBeLessThan(wet.residue);
    expect(s.getPixel(32, 32).condensation).toBe(0);
    expect(s.getPixel(0, 0).condensation).toBeCloseTo(0.78);
  });

  it("draws persistent frost that remains until wiped", () => {
    const s = new CrystalGrowthSimulation(0, 64, 64);
    const frost = { x: 0.5, y: 0.5, radius: 0.2, strength: 1, mode: "refill" as const };
    s.update(1 / 60, [frost], config);
    expect(s.getPixel(32, 32).frozen).toBe(1);
    s.update(1 / 60, [], config);
    expect(s.getPixel(32, 32).frozen).toBe(1);
    for (let i = 0; i < 20; i += 1) s.update(1 / 60, [brush], config);
    expect(s.getPixel(32, 32).frozen).toBe(0);
  });

  it("clears the whole swept path, not only its endpoints", () => {
    const s = new CrystalGrowthSimulation(0.78, 64, 64);
    s.update(1 / 60, [{ ...brush, x: 0.8, from: { x: 0.2, y: 0.5 }, radius: 0.08 }], config);
    expect(s.getPixel(32, 32).condensation).toBe(0);
    expect(s.getPixel(32, 10).condensation).toBeCloseTo(0.78);
  });

  it("only grows adjoining pixels and records their individual birth times", () => {
    const s = new CrystalGrowthSimulation(0, 32, 32);
    s.startAutoRefill(1);
    const before = Array.from({ length: 1024 }, (_, i) => s.getPixel(i % 32, Math.floor(i / 32)).frozen);
    s.update(1 / 60, [], config);
    for (let y = 0; y < 32; y += 1) for (let x = 0; x < 32; x += 1) {
      const p = s.getPixel(x, y);
      if (p.frozen && !before[y * 32 + x]) {
        let touching = false;
        for (let dy = -1; dy <= 1; dy += 1) for (let dx = -1; dx <= 1; dx += 1) {
          if (x + dx >= 0 && x + dx < 32 && y + dy >= 0 && y + dy < 32) touching ||= before[(y + dy) * 32 + x + dx] > 0;
        }
        expect(touching).toBe(true);
        expect(p.birthTime).toBeCloseTo(1 / 60);
      }
    }
    advance(s, 90);
    expect(Array.from({ length: 1024 }, (_, i) => s.getPixel(i % 32, Math.floor(i / 32)).frozen).filter(Boolean).length).toBeGreaterThan(1000);
  });

  it("matches at 30, 60, and 120 render FPS", () => {
    const simulations = [30, 60, 120].map(fps => {
      const s = new CrystalGrowthSimulation(0, 32, 32);
      s.startAutoRefill(3);
      advance(s, 2, fps);
      return s;
    });
    for (let y = 0; y < 32; y += 1) for (let x = 0; x < 32; x += 1) {
      expect(simulations[0].getPixel(x, y)).toEqual(simulations[1].getPixel(x, y));
      expect(simulations[2].getPixel(x, y)).toEqual(simulations[1].getPixel(x, y));
    }
  });

  it("stops growing when interrupted, then can resume", () => {
    const s = new CrystalGrowthSimulation(0, 32, 32);
    s.startAutoRefill(2);
    advance(s, 0.5);
    s.cancelAutoRefill();
    const data = new Float32Array(s.texture.image.data as Float32Array);
    advance(s, 2);
    expect(s.texture.image.data).toEqual(data);
    s.startAutoRefill(2);
    advance(s, 2);
    expect(s.texture.image.data).not.toEqual(data);
  });
});

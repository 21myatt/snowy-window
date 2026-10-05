import { ClampToEdgeWrapping, DataTexture, FloatType, LinearFilter, RGFormat } from "three";
import type { Brush } from "./SnowyWindowInteraction";

export class CondensationMaskSimulation {
  readonly texture: DataTexture;

  private readonly size = 128;

  private readonly pixels: Float32Array;

  private readonly growthHold: Float32Array;

  constructor(initialDensity: number) {
    this.pixels = new Float32Array(this.size * this.size * 2);
    this.growthHold = new Float32Array(this.size * this.size);
    for (let index = 0; index < this.size * this.size; index += 1) this.pixels[index * 2] = initialDensity;
    this.texture = new DataTexture(this.pixels, this.size, this.size, RGFormat, FloatType);
    this.texture.minFilter = LinearFilter;
    this.texture.magFilter = LinearFilter;
    this.texture.wrapS = ClampToEdgeWrapping;
    this.texture.wrapT = ClampToEdgeWrapping;
    this.texture.needsUpdate = true;
  }

  update(deltaSeconds: number, elapsedSeconds: number, brushes: Brush[], config: { growthSpeed: number; wipeStrength: number; mouthRefillStrength: number; brushSoftness: number; wipeResidue: number; wipeDisplacement: number; wipeResidueDrySpeed: number; wipeClearThreshold: number; wipeGrowthDelay: number }): void {
    const growth = config.growthSpeed * deltaSeconds;
    const next = new Float32Array(this.pixels);
    for (let y = 0; y < this.size; y += 1) {
      for (let x = 0; x < this.size; x += 1) {
        const index = (y * this.size + x) * 2;
        const uvX = (x + 0.5) / this.size;
        const uvY = (y + 0.5) / this.size;
        const seed = Math.sin((uvX * 12.9898 + uvY * 78.233 + elapsedSeconds * 0.18)) * 43758.5453;
        const organicGrowth = growth * (0.35 + (seed - Math.floor(seed)) * 0.65);
        const pixelIndex = y * this.size + x;
        this.growthHold[pixelIndex] = Math.max(0, this.growthHold[pixelIndex] - deltaSeconds);
        const residue = this.pixels[index + 1];
        next[index] = this.growthHold[pixelIndex] > 0 ? this.pixels[index] : Math.min(1, this.pixels[index] + organicGrowth * (1 - residue));
        next[index + 1] = Math.max(0, residue - deltaSeconds * config.wipeResidueDrySpeed);
        brushes.forEach((brush) => {
          const distance = Math.hypot(uvX - brush.x, uvY - brush.y);
          const normalized = distance / Math.max(brush.radius, 0.0001);
          const softness = Math.max(0.05, config.brushSoftness);
          const influence = Math.max(0, 1 - normalized) ** (1 / softness);
          const amount = influence * deltaSeconds * Math.abs(brush.strength);
          if (brush.mode === "wipe") {
            next[index] = Math.max(0, next[index] - amount * config.wipeStrength);
            next[index + 1] = Math.min(1, next[index + 1] + amount * config.wipeResidue);
            this.growthHold[pixelIndex] = Math.max(this.growthHold[pixelIndex], config.wipeGrowthDelay);
            const velocity = brush.velocity ?? { x: 0, y: 0 };
            const speed = Math.hypot(velocity.x, velocity.y);
            if (speed > 0.0001) {
              const sideX = uvX + (-velocity.y / speed) * brush.radius * 0.8;
              const sideY = uvY + (velocity.x / speed) * brush.radius * 0.8;
              if (Math.hypot(sideX - brush.x, sideY - brush.y) < brush.radius * 1.25) next[index + 1] = Math.min(1, next[index + 1] + amount * config.wipeDisplacement * 0.35);
            }
          } else {
            const refillRate = config.mouthRefillStrength * influence;
            next[index] = Math.min(1, next[index] + (1 - next[index]) * (1 - Math.exp(-refillRate * deltaSeconds)));
          }
        });
        if (next[index] < config.wipeClearThreshold) next[index] = 0;
      }
    }
    this.pixels.set(next);
    this.texture.needsUpdate = true;
  }

  getPixel(x: number, y: number): { condensation: number; residue: number } {
    const index = (Math.max(0, Math.min(this.size - 1, y)) * this.size + Math.max(0, Math.min(this.size - 1, x))) * 2;
    return { condensation: this.pixels[index], residue: this.pixels[index + 1] };
  }

  dispose(): void {
    this.texture.dispose();
  }
}

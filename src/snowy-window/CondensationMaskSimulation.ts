import { DataTexture, RedFormat, FloatType, LinearFilter, ClampToEdgeWrapping } from "three";
import type { Brush } from "./SnowyWindowInteraction";

export class CondensationMaskSimulation {
  readonly texture: DataTexture;

  private readonly size = 128;

  private readonly pixels: Float32Array;

  constructor(initialDensity: number) {
    this.pixels = new Float32Array(this.size * this.size).fill(initialDensity);
    this.texture = new DataTexture(this.pixels, this.size, this.size, RedFormat, FloatType);
    this.texture.minFilter = LinearFilter;
    this.texture.magFilter = LinearFilter;
    this.texture.wrapS = ClampToEdgeWrapping;
    this.texture.wrapT = ClampToEdgeWrapping;
    this.texture.needsUpdate = true;
  }

  update(deltaSeconds: number, elapsedSeconds: number, brushes: Brush[], config: { growthSpeed: number; wipeStrength: number; mouthRefillStrength: number }): void {
    const growth = config.growthSpeed * deltaSeconds;
    for (let y = 0; y < this.size; y += 1) {
      for (let x = 0; x < this.size; x += 1) {
        const index = y * this.size + x;
        const uvX = (x + 0.5) / this.size;
        const uvY = (y + 0.5) / this.size;
        const seed = Math.sin((uvX * 12.9898 + uvY * 78.233 + elapsedSeconds * 0.18)) * 43758.5453;
        const organicGrowth = growth * (0.35 + (seed - Math.floor(seed)) * 0.65);
        this.pixels[index] = Math.min(1, this.pixels[index] + organicGrowth);
        brushes.forEach((brush) => {
          const distance = Math.hypot(uvX - brush.x, uvY - brush.y);
          const influence = Math.max(0, 1 - distance / Math.max(brush.radius, 0.0001));
          const amount = influence * influence * deltaSeconds;
          if (brush.mode === "wipe") this.pixels[index] = Math.max(0, this.pixels[index] - amount * config.wipeStrength * Math.abs(brush.strength));
          else this.pixels[index] = Math.min(1, this.pixels[index] + amount * config.mouthRefillStrength * Math.abs(brush.strength));
        });
      }
    }
    this.texture.needsUpdate = true;
  }

  dispose(): void {
    this.texture.dispose();
  }
}

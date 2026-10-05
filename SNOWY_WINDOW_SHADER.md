# Snowy Window shader

The persistent 256 × 456 RGBA float texture stores condensation, wet residue,
freezing time, and ice occupancy. `CrystalGrowthSimulation` advances a stochastic
eight-neighbor Eden model at 60 fixed steps per second, inspired by Jingwen's
Buffer A in `vtt-asssets-libs/test.md`. CPU double buffering keeps the update
independent of scan direction and render frame rate; no GPU readback is needed.

An open palm or one extended fingertip wipes an aspect-correct swept capsule.
Motion clears immediately; stationary contact clears progressively. Soft margins
and displaced water remain at the stroke edge, then dry. Wiping erases the local
crystal state and birth time and pauses freezing. Two seconds after contact ends,
five seeds nucleate in cleared glass; ice also grows inward from surviving frost.
Growth continues until the cleared glass freezes and thickens, without rings,
preconnected seed bridges, or a timed cutoff.

The fragment shader uses each pixel's freezing age for a pale traveling highlight
and gradual maturation. Procedural film, droplets, and subtle streaks remain
translucent over the camera. This is stylized glass shading, not optical camera
refraction. The reference's opaque background and lightning cracks are omitted.

Validation: `npm test -- src/snowy-window`, `npm run typecheck`, `npm run lint`,
and `npm run build`. Run `node scripts/qa-snowy-window.mjs` for a standalone visual
fixture at http://127.0.0.1:5179, using the same simulation and shader over a
high-contrast background. Its timeline makes wipe/refill states repeatable without
camera permission. Real hand tracking still needs an on-device preview.

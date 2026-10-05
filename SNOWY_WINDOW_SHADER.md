# Snowy Window shader

The condensation mask is simulated in the fragment shader. Noise and drifting
cellular fields create slow organic fog growth. Wipe brushes subtract density;
mouth brushes add density locally. The shader receives a bounded brush array so
tracking remains outside React state and the render path stays frame-oriented.

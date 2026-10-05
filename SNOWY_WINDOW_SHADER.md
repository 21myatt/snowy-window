# Snowy Window shader

The condensation mask is maintained as a persistent low-resolution `DataTexture`
simulation and displayed through a WebGL fragment shader. Noise and drifting
cellular fields create slow organic fog growth. Wipe brushes subtract density;
mouth brushes add density locally. The shader receives the persistent mask while
tracking remains outside React state and the render path stays frame-oriented.

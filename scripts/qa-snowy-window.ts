// Standalone visual fixture: production shader + simulation without camera permission.
import * as THREE from "three";
import { CrystalGrowthSimulation } from "../src/snowy-window/CrystalGrowthSimulation";
import { snowyWindowFragmentShader, snowyWindowVertexShader } from "../src/snowy-window/SnowyWindowShader";
import { SNOWY_WINDOW_CONFIG as config } from "../src/snowy-window/snowyWindowConfig";

const renderer = new THREE.WebGLRenderer({ alpha: true, preserveDrawingBuffer: true });
renderer.setSize(360, 640);
document.querySelector("#glass")!.appendChild(renderer.domElement);
const scene = new THREE.Scene();
const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 2);
camera.position.z = 1;
const uniforms: Record<string, THREE.IUniform> = {};
Object.entries(config.condensation).forEach(([key, value]) => {
  uniforms[`u${key[0].toUpperCase()}${key.slice(1)}`] = { value };
});
uniforms.uTime = { value: 0 };
uniforms.uResolution = { value: new THREE.Vector2(256, 456) };
uniforms.uMask = { value: null };
const material = new THREE.ShaderMaterial({ uniforms, vertexShader: snowyWindowVertexShader, fragmentShader: snowyWindowFragmentShader, transparent: true, depthWrite: false });
scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material));
let simulation: CrystalGrowthSimulation;
const settings = { ...config.condensation, growthRate: config.autoRefill.growthRate };
let last = 0;
let simTime = 0;
let playing = false;
let started = false;
let live = false;
let pointer: { x: number; y: number } | null = null;
let previousPointer: { x: number; y: number } | null = null;
let lastContact = 0;
let brushRadius = 0.19;
function reset() {
  simulation?.dispose();
  simulation = new CrystalGrowthSimulation(config.condensation.initialDensity);
  uniforms.uMask.value = simulation.texture;
  simTime = 0;
  started = false;
  lastContact = 0;
}
function step() {
  const t = simTime;
  const next = t + 1 / 60;
  const point = (s: number) => ({ x: 0.2 + s * 0.6, y: 0.48 + Math.sin(s * Math.PI * 2) * 0.12 });
  const brushes = t < 1 ? [{ ...point(next), from: point(t), radius: 0.19, strength: -1, mode: "wipe" as const }] : [];
  if (t >= 3 && !started) { simulation.startAutoRefill(config.autoRefill.seedCount); started = true; }
  simulation.update(1 / 60, brushes, settings);
  simTime = next;
}
function render() {
  uniforms.uTime.value = simulation.elapsedTime;
  renderer.render(scene, camera);
  document.querySelector("#time")!.textContent = `${simTime.toFixed(2)}s`;
}
function seek(seconds: number) {
  live = false;
  playing = false;
  reset();
  for (let i = 0; i < Math.round(seconds * 60); i += 1) step();
  render();
  return stats();
}
function stats() {
  let clear = 0; let frozen = 0;
  for (let y = 0; y < simulation.height; y += 1) for (let x = 0; x < simulation.width; x += 1) {
    const p = simulation.getPixel(x, y);
    if (p.condensation < 0.015) clear += 1;
    frozen += p.frozen;
  }
  return { time: simTime, clear, frozen, growing: simulation.isGrowing, programs: renderer.info.programs?.map(p => p.diagnostics) };
}
function compareSettled() {
  seek(20);
  const gl = renderer.getContext();
  const settled = new Uint8Array(360 * 640 * 4);
  gl.readPixels(0, 0, 360, 640, gl.RGBA, gl.UNSIGNED_BYTE, settled);
  const original = new CrystalGrowthSimulation(config.condensation.initialDensity);
  uniforms.uMask.value = original.texture;
  // Compare at identical shader time, so animated droplets cannot skew the result.
  renderer.render(scene, camera);
  const initial = new Uint8Array(settled.length);
  gl.readPixels(0, 0, 360, 640, gl.RGBA, gl.UNSIGNED_BYTE, initial);
  let maxChannelDifference = 0;
  let changedChannels = 0;
  settled.forEach((value, i) => {
    maxChannelDifference = Math.max(maxChannelDifference, Math.abs(value - initial[i]));
    if (value !== initial[i]) changedChannels += 1;
  });
  uniforms.uMask.value = simulation.texture;
  original.dispose();
  render();
  return { maxChannelDifference, changedChannels, totalChannels: settled.length };
}
Object.assign(window, { frostQA: { seek, stats, compareSettled } });
document.querySelectorAll<HTMLButtonElement>("button[data-time]").forEach(b => { b.onclick = () => seek(Number(b.dataset.time)); });
document.querySelector<HTMLButtonElement>("#play")!.onclick = () => { reset(); playing = true; };
document.querySelector<HTMLButtonElement>("#palm")!.onclick = () => { reset(); live = true; playing = false; brushRadius = 0.19; };
document.querySelector<HTMLButtonElement>("#finger")!.onclick = () => { reset(); live = true; playing = false; brushRadius = config.hand.fingertipRadius; };
const pointFromEvent = (e: PointerEvent) => {
  const r = renderer.domElement.getBoundingClientRect();
  return { x: (e.clientX - r.left) / r.width, y: 1 - (e.clientY - r.top) / r.height };
};
renderer.domElement.style.touchAction = "none";
renderer.domElement.onpointerdown = e => {
  live = true; playing = false;
  pointer = pointFromEvent(e); previousPointer = pointer;
  renderer.domElement.setPointerCapture(e.pointerId);
};
renderer.domElement.onpointermove = e => { if (pointer) pointer = pointFromEvent(e); };
renderer.domElement.onpointerup = renderer.domElement.onpointercancel = () => { pointer = null; previousPointer = null; };
reset(); render();
renderer.setAnimationLoop((now: number) => {
  if (live) {
    const delta = Math.min((now - last) / 1000, 0.05);
    const brushes = pointer ? [{ ...pointer, from: previousPointer ?? pointer, radius: brushRadius, strength: -1, mode: "wipe" as const }] : [];
    if (pointer) { simulation.cancelAutoRefill(); lastContact = simTime; }
    else if (simTime - lastContact >= config.autoRefill.interval) simulation.startAutoRefill(config.autoRefill.seedCount);
    simulation.update(delta, brushes, settings);
    previousPointer = pointer;
    simTime += delta;
    render(); last = now;
    return;
  }
  if (playing && now - last >= 1000 / 60) { step(); render(); last = now; }
});

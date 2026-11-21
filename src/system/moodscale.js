// Mood scale (Very unpleasant .. Very pleasant) and the flower that mirrors it. One source of truth: the scale value v (1..7).
// Everything the flower does is a function of t = (v - 1) / 6, so label, slider position and drawing can never disagree.
export const SCALE = ["Very unpleasant", "Unpleasant", "Slightly unpleasant", "Neutral", "Slightly pleasant", "Pleasant", "Very pleasant"];
export const STEPS = SCALE.length;
export const labelOf = (v) => SCALE[Math.round(v) - 1] || null;
export const valueOf = (label) => { const i = SCALE.indexOf(label); return i < 0 ? null : i + 1; };
export const tOf = (v) => (Math.min(STEPS, Math.max(1, v)) - 1) / (STEPS - 1);
// Pointer x inside a track [left, left+width] -> nearest step. Clamped, so every step is reachable and nothing is out of range.
export const stepAt = (x, left, width) => 1 + Math.round(Math.min(1, Math.max(0, (x - left) / Math.max(1, width))) * (STEPS - 1));

const lerp = (a, b, t) => a + (b - a) * t, cl = (x) => Math.min(1, Math.max(0, x));
const hex = (c) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16)), rgb = (a) => "#" + a.map((v) => Math.round(v).toString(16).padStart(2, "0")).join("");
const mix = (a, b, t) => rgb(hex(a).map((v, i) => lerp(v, hex(b)[i], t)));
const ramp = (st, t) => (t < 0.5 ? mix(st[0], st[1], t * 2) : mix(st[1], st[2], (t - 0.5) * 2));
// Warm and cool stops. The colour-blind set uses Okabe-Ito; shape (bud -> bloom) always carries the meaning as well.
const PET = { std: ["#7d8fb8", "#d3c29c", "#ee9d58"], cb: ["#0072B2", "#CC79A7", "#E69F00"] }, CEN = { std: ["#6f6a7e", "#9a7f4a", "#f2c14e"], cb: ["#003a5c", "#8a5a76", "#F0E442"] };

// Geometry as a pure function of t: open (bud -> bloom), droop (head hangs at the low end), petal size, colours.
export function flowerParams(t, { cb = false, muted = false } = {}) {
  t = cl(t); const open = t * t * (3 - 2 * t), droop = 1 - t, k = cb ? "cb" : "std";
  let pet = ramp(PET[k], t), cen = ramp(CEN[k], t); if (muted) { pet = mix(pet, "#b9b4a6", 0.72); cen = mix(cen, "#8c8878", 0.7); }
  const L = lerp(15, 50, open);
  return { t, open, droop, L, W: lerp(7, 18, open), o: L * lerp(0.42, 0.52, open), tilt: 38 * droop, hx: 100 + 34 * droop, hy: 96 + 26 * droop, pet, inner: mix(pet, "#ffffff", 0.28), edge: mix(pet, "#2d2a1f", 0.35), cen, cr: lerp(7, 11, open) };
}
export function flowerSVG(t, o = {}) {
  const p = flowerParams(t, o), f = (n) => n.toFixed(2), petal = (a, s, fill) => `<ellipse cx="0" cy="${f(-p.o * s)}" rx="${f(p.W * s)}" ry="${f((p.L * s) / 2)}" fill="${fill}" stroke="${p.edge}" stroke-opacity=".35" stroke-width="1.1" transform="rotate(${a})"/>`;
  let outer = "", inner = ""; for (let i = 0; i < 8; i++) { outer += petal(i * 45, 1, p.pet); inner += petal(i * 45 + 22.5, 0.68, p.inner); }
  const stem = "#5d7a52", sy = p.hy + 14;
  return `<svg viewBox="0 0 200 220" width="100%" height="100%" aria-hidden="true" focusable="false">
<path d="M100 214Q100 ${f(150 - 10 * p.droop)} ${f(p.hx)} ${f(sy)}" fill="none" stroke="${stem}" stroke-width="5" stroke-linecap="round"/>
<ellipse cx="${f(100 - 16)}" cy="176" rx="16" ry="6" fill="${stem}" opacity=".9" transform="rotate(${f(-28 + 14 * p.droop)} 84 176)"/>
<ellipse cx="${f(100 + 17)}" cy="190" rx="15" ry="5.5" fill="${stem}" opacity=".8" transform="rotate(${f(24 - 10 * p.droop)} 117 190)"/>
<g transform="translate(${f(p.hx)} ${f(p.hy)}) rotate(${f(p.tilt)})">${outer}${inner}<circle r="${f(p.cr)}" fill="${p.cen}"/></g></svg>`;
}
export function flowerEl(t, size = 40, o = {}) {
  const e = document.createElement("span"); e.className = "ic flw"; e.setAttribute("aria-hidden", "true");
  e.style.width = e.style.height = size + "px"; e.innerHTML = flowerSVG(t, o); return e;
}

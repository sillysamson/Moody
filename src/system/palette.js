// Accent colour system (pure, no DOM; unit-tested). One hue + chroma in, a complete light AND dark palette out, in OKLCH, so lightness is
// perceptually even for every hue. It overrides the same CSS variables tokens.css defines (--bg --s1 --s2 --s3 --tx --mu --pr --on ...), so
// navigation, controls, cards, highlights and focus states all follow. Foreground colours are derived and contrast is ENFORCED, not assumed.
// "moss" is the shipped hand-tuned palette: it generates nothing, so the stylesheet values stay untouched (the app's original identity).
const cl = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lin = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4), gam = (c) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);
const hex2 = (v) => Math.round(cl(v) * 255).toString(16).padStart(2, "0");

// OKLCH -> linear sRGB (Ottosson). Out of gamut channels are not clamped here so callers can test gamut.
function toLinear(L, C, H) {
  const a = C * Math.cos((H * Math.PI) / 180), b = C * Math.sin((H * Math.PI) / 180);
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3, m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3, s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s, -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s];
}
const inGamut = (rgb) => rgb.every((v) => v >= -0.0005 && v <= 1.0005);
// Hex for an OKLCH colour; if it is outside sRGB, chroma is reduced (lightness and hue kept), which is what keeps a "yellow at L .49" from clipping.
export function hex(L, C, H) {
  H = ((H % 360) + 360) % 360; let lo = 0, hi = C, rgb = toLinear(L, C, H);
  if (!inGamut(rgb)) { for (let i = 0; i < 24; i++) { const mid = (lo + hi) / 2; inGamut(toLinear(L, mid, H)) ? (lo = mid) : (hi = mid); } rgb = toLinear(L, lo, H); }
  return "#" + rgb.map((v) => hex2(gam(cl(v)))).join("");
}
export function toOklch(h) {
  const [r, g, b] = [1, 3, 5].map((i) => lin(parseInt(h.slice(i, i + 2), 16) / 255));
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b), m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b), s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s, B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  return { L, C: Math.hypot(A, B), H: ((Math.atan2(B, A) * 180) / Math.PI + 360) % 360 };
}
const luminance = (h) => { const [r, g, b] = [1, 3, 5].map((i) => lin(parseInt(h.slice(i, i + 2), 16) / 255)); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
export const contrast = (a, b) => { const x = luminance(a), y = luminance(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
const rgba = (h, a) => `rgba(${[1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)).join(",")},${a})`;

// Move lightness (dir -1 darker / +1 lighter) until `min` contrast holds against every colour in `on`.
function ensure(L, C, H, on, min, dir) {
  let c = hex(L, C, H);
  for (let i = 0; i < 100 && on.some((o) => contrast(c, o) < min); i++) { L = cl(L + dir * 0.01); c = hex(L, C, H); }
  return c;
}

export const PRESETS = [
  { id: "moss", name: "Moss", h: 140, c: 0.073 },
  { id: "terracotta", name: "Terracotta", h: 42, c: 0.115 },
  { id: "rose", name: "Rose", h: 8, c: 0.1 },
  { id: "ochre", name: "Ochre", h: 85, c: 0.1 },
  { id: "teal", name: "Teal", h: 190, c: 0.085 },
  { id: "ocean", name: "Ocean", h: 245, c: 0.1 },
  { id: "lavender", name: "Lavender", h: 300, c: 0.09 },
  { id: "graphite", name: "Graphite", h: 260, c: 0.02 },
];
export const DEFAULT_ACCENT = { id: "moss", h: 200, c: 0.09 }; // h/c are only read when id is "custom" (a hue 0-360 and a vividness 0.02-0.14)
// accent pref -> { h, c } or null (null = the stylesheet palette). Corrupt saved values fall back to the default instead of throwing.
// 1.7 Dynamic Color: the wallpaper accent (Android 12+) arrives as {h,c}; until it does, or where it is unsupported, "wallpaper" falls back to the shipped moss palette.
let WP = null;
export const setWallpaper = (hc) => { WP = hc && Number.isFinite(hc.h) && Number.isFinite(hc.c) ? hc : null; };
export const hasWallpaper = () => !!WP;
// "#rrggbb" -> {h, c} in OKLCH (chroma is clamped to the range the accent system accepts so a very vivid wallpaper cannot break contrast tuning)
export function hexToHC(hx) {
  const v = [1, 3, 5].map((i) => lin(parseInt(hx.slice(i, i + 2), 16) / 255)), [r, g, b] = v;
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b), m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b), s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const a = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s, bb = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  return { h: (((Math.atan2(bb, a) * 180) / Math.PI) + 360) % 360, c: cl(Math.hypot(a, bb), 0.02, 0.14) };
}
export function resolveAccent(a) {
  if (a && a.id === "wallpaper") return WP;
  if (a && a.id === "custom" && Number.isFinite(a.h) && Number.isFinite(a.c)) return { h: ((a.h % 360) + 360) % 360, c: cl(a.c, 0.02, 0.14) };
  const p = a && PRESETS.find((x) => x.id === a.id);
  return !p || p.id === "moss" ? null : { h: p.h, c: p.c };
}

// One mode of the palette. `hi` = high-contrast setting.
function mode(dark, h, c, hi) {
  const n = (L, k) => hex(L, k, h);
  const bg = n(dark ? 0.204 : 0.935, dark ? 0.017 : 0.021), s1 = n(dark ? 0.249 : 0.974, dark ? 0.02 : 0.014), s2 = n(dark ? 0.304 : 0.929, dark ? 0.025 : 0.025), s3 = n(dark ? 0.357 : 0.895, dark ? 0.034 : 0.031);
  const surf = [bg, s1, s2, s3], dir = dark ? 1 : -1;
  const tx = ensure(dark ? 0.93 : 0.29, dark ? 0.019 : 0.033, h, surf, hi ? 10 : 9, dir);
  const mu = ensure(dark ? 0.75 : 0.48, 0.04, h, surf, hi ? 7 : 4.5, dir);
  const pr = ensure(dark ? 0.8 : 0.49, c * (dark ? 0.95 : 1), h, [s1, s2, bg], hi ? 7 : 4.5, dir);
  const on = ensure(dark ? 0.23 : 0.97, 0.025, h, [pr], 4.5, -dir); // text on a --pr button; moves away from --pr until it reads
  const h2 = h + 150, ter = ensure(dark ? 0.78 : 0.58, c * 1.5, h2, [s1], 3, dir);
  return {
    "--bg": bg, "--s1": s1, "--s2": s2, "--s3": s3, "--tx": tx, "--mu": mu, "--pr": pr, "--on": on,
    "--prs": rgba(pr, dark ? 0.18 : 0.14), "--ter": ter, "--ters": rgba(ter, dark ? 0.18 : 0.14),
    "--line": rgba(tx, hi ? 0.55 : dark ? 0.1 : 0.14), "--float": rgba(s1, 0.74), "--glass-fill": rgba(s1, 0.5), "--float-solid": n(dark ? 0.27 : 0.955, dark ? 0.022 : 0.018),
    "--scrim": dark ? "rgba(0,0,0,.55)" : rgba(hex(0.27, 0.03, h), 0.42),
    "--b1": rgba(hex(dark ? 0.4 : 0.8, 0.07 + (dark ? 0 : 0.02), h), dark ? 0.55 : 0.5), "--b2": rgba(hex(dark ? 0.4 : 0.8, 0.07, h2), 0.4), "--b3": rgba(hex(dark ? 0.42 : 0.88, 0.07, h + 70), dark ? 0.35 : 0.45),
  };
}
// -> { "--pr": "light-dark(#..., #...)", ... }, or {} for the stylesheet palette.
export function cssVars(accent, contrastPref = "standard") {
  const r = resolveAccent(accent); if (!r) return {};
  const L = mode(false, r.h, r.c, contrastPref === "high"), D = mode(true, r.h, r.c, contrastPref === "high"), out = {};
  for (const k in L) out[k] = `light-dark(${L[k]},${D[k]})`;
  return out;
}
export const VARS = ["--bg", "--s1", "--s2", "--s3", "--tx", "--mu", "--pr", "--on", "--prs", "--ter", "--ters", "--line", "--float", "--glass-fill", "--float-solid", "--scrim", "--b1", "--b2", "--b3"];
// Swatch colours for the picker (what the accent looks like as a button in each mode).
export const swatch = (accent, dark) => { const r = resolveAccent(accent); return r ? mode(dark, r.h, r.c, false)["--pr"] : dark ? "#a8c79b" : "#4a6b43"; };
export const modes = (accent, contrastPref = "standard") => { const r = resolveAccent(accent); return r ? { light: mode(false, r.h, r.c, contrastPref === "high"), dark: mode(true, r.h, r.c, contrastPref === "high") } : null; };

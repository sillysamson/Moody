// Background treatments (1.5). ONE renderer serves the live app layer (#bgfx, fixed, behind everything) and the Settings previews (inside a frame),
// so a preview is exactly what Apply produces. All five are static layers: nothing animates and nothing repaints while scrolling or on touch,
// so they cost nothing per frame and never touch the glass nav's backdrop-filter. Colours derive from the active palette (--bg, --pr), so they follow
// the accent and both appearances; the CSS lives in styles/main.css (".bgl").
import { get } from "../core/store.js";
export const BGS = [["aura", "Aura"], ["photo", "Blurred photo"], ["sea", "Seascape"], ["paper", "Paper"], ["graphite", "Graphite"]];
export const BLUR = { min: 0, max: 40 };
const KEY = "interception.bgphoto"; // kept out of the main data blob so every commit does not rewrite a few hundred KB
let photo; // undefined = not read yet, null = none
export function loadPhoto() {
  if (photo !== undefined) return photo;
  try { const p = JSON.parse(localStorage.getItem(KEY) || "null"); photo = p && typeof p.url === "string" && p.url.startsWith("data:image/") && Number.isFinite(p.g) ? p : null; } catch { photo = null; }
  return photo;
}
export function savePhoto(p) { try { localStorage.setItem(KEY, JSON.stringify(p)); photo = p; return true; } catch { return false; } }
export function removePhoto() { try { localStorage.removeItem(KEY); } catch {} photo = null; }

// File -> { url (jpeg data URL, long side <= 960px), g (mean tone 0..1, sRGB encoded) }. A blurred background needs no more pixels than this.
export async function readPhoto(file) {
  const bmp = await createImageBitmap(file), k = Math.min(1, 960 / Math.max(bmp.width, bmp.height)), w = Math.max(1, Math.round(bmp.width * k)), h = Math.max(1, Math.round(bmp.height * k));
  const c = document.createElement("canvas"); c.width = w; c.height = h; c.getContext("2d").drawImage(bmp, 0, 0, w, h);
  const s = document.createElement("canvas"); s.width = s.height = 8; const sx = s.getContext("2d"); sx.drawImage(c, 0, 0, 8, 8);
  const d = sx.getImageData(0, 0, 8, 8).data; let sum = 0; for (let i = 0; i < 64; i++) sum += (d[i * 4] * 0.299 + d[i * 4 + 1] * 0.587 + d[i * 4 + 2] * 0.114) / 255;
  bmp.close && bmp.close();
  return { url: c.toDataURL("image/jpeg", 0.8), g: sum / 64 };
}

// ---- readability of a photo background (pure, unit-tested) ----
const lin = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
const Y = ([r, g, b]) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
const ratio = (a, b) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
// Smallest veil (share of the page colour laid over the photo) at which text of colour `text` reads on a photo of average tone `g`. rgb arrays 0..255.
// Guaranteed for the photo's average tone; blur evens out local variation but cannot remove a very bright or dark spot.
export function veilFor(g, bg, text, min = 4.8) {
  const p = g * 255;
  for (let v = 0.55; v < 0.95; v += 0.01) if (ratio(Y(bg.map((c) => v * c + (1 - v) * p)), Y(text)) >= min) return +v.toFixed(2);
  return 0.95;
}
const rgbOf = (css) => (css.match(/[\d.]+/g) || [0, 0, 0]).slice(0, 3).map(Number);
const probe = (v) => { const e = document.createElement("i"); e.style.cssText = "position:fixed;visibility:hidden;color:var(" + v + ")"; document.body.append(e); const c = rgbOf(getComputedStyle(e).color); e.remove(); return c; };

// ---- adaptive glass (1.6) ----
// Tone (0..1) of what sits behind the glass, estimated from the background LAYER (photo average blended with the veil, or the page colour), never
// from the glass itself, so there is no feedback loop. It only changes when the background, theme or accent changes (the layers are static), and
// the bucket has hysteresis so a value near a threshold cannot flip back and forth.
export function glassTone(tone, prev = "") {
  const hi = prev === "bright" ? 0.61 : 0.66, lo = prev === "dim" ? 0.39 : 0.34;
  return tone > hi ? "bright" : tone < lo ? "dim" : "";
}
export const toneBehind = (g, veil, dark) => { const base = dark ? 0.06 : 0.93; return g == null ? base : veil * base + (1 - veil) * g; };

// ---- seascape: single hue, layered, quiet ----
let sid = 0;
const m = (p) => `color-mix(in oklab,var(--pr) ${p}%,var(--bg))`, ld = (a, b) => `light-dark(${a},${b})`;
function seaSVG() {
  const u = "s" + ++sid, W = (d, a, b) => `<path d="${d}" style="fill:${ld(m(a), m(b))}"/>`, wave = (y, A) => `M0 ${y} Q50 ${y - A} 100 ${y} T200 ${y} T300 ${y} T400 ${y} V800 H0Z`;
  return `<svg viewBox="0 0 400 800" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false"><defs>
<linearGradient id="${u}k" x1="0" y1="0" x2="0" y2="1"><stop offset="0" style="stop-color:${ld("color-mix(in oklab,var(--pr) 2%,var(--s1))", m(1.5))}"/><stop offset="1" style="stop-color:${ld(m(6), m(9))}"/></linearGradient>
<radialGradient id="${u}g"><stop offset="0" style="stop-color:${ld("color-mix(in oklab,var(--pr) 12%,white)", m(28))};stop-opacity:.75"/><stop offset="1" style="stop-color:${ld(m(9), m(8))};stop-opacity:0"/></radialGradient></defs>
<rect width="400" height="800" fill="url(#${u}k)"/><circle cx="265" cy="310" r="170" fill="url(#${u}g)"/>
<rect y="344" width="400" height="460" style="fill:${ld(m(5), m(8))}"/>
${W(wave(372, 7), 7, 7)}${W(wave(425, 11), 8.8, 5.6)}${W(wave(500, 15), 10.2, 4.2)}${W(wave(600, 20), 11.4, 3)}${W(wave(715, 24), 12.3, 1.8)}
<g fill="none" stroke-width="1" style="stroke:color-mix(in oklab,var(--bg) 55%,transparent)"><path d="M20 446q40-6 80 0t80 0"/><path d="M200 524q50-8 100 0t90 0"/><path d="M-10 636q60-10 120 0t110 0"/></g>
<rect y="330" width="400" height="60" style="fill:url(#${u}h)"/><linearGradient id="${u}h" x1="0" y1="0" x2="0" y2="1"><stop offset="0" style="stop-color:var(--bg);stop-opacity:0"/><stop offset=".5" style="stop-color:var(--bg);stop-opacity:.35"/><stop offset="1" style="stop-color:var(--bg);stop-opacity:0"/></linearGradient></svg>`;
}

let key = "";
// Fill a .bgl element. spec = { id, blur }; ph = the photo to use ({url, g}) or null. Returns the id actually shown (a photo background
// without a photo falls back to aura rather than an empty screen).
export function paint(el, spec, ph, { force = false } = {}) {
  const id = spec.id === "photo" && !ph ? "aura" : BGS.some((b) => b[0] === spec.id) ? spec.id : "aura";
  const blur = Math.min(BLUR.max, Math.max(BLUR.min, Number(spec.blur) || 0));
  const veil = id === "photo" ? veilFor(ph.g, probe("--bg"), probe("--mu")) : 0;
  const k = [id, blur, veil, ph && ph.url.length, ph && ph.g].join("|");
  if (!force && el._k === k) return id; el._k = k;
  el.className = "bgl"; el.dataset.bg = id; el.style.setProperty("--bgblur", blur + "px"); el.style.setProperty("--veil", String(veil));
  el.replaceChildren();
  if (id === "sea") el.insertAdjacentHTML("afterbegin", seaSVG());
  if (id === "photo") { const d = document.createElement("div"); d.className = "ph"; d.style.backgroundImage = `url("${ph.url}")`; el.append(d); }
  return id;
}

// The live layer. Called from prefs.apply(), so it follows theme / accent / contrast / background changes.
export function applyBg() {
  const root = document.documentElement; let el = document.getElementById("bgfx");
  if (!el) { el = document.createElement("div"); el.id = "bgfx"; el.setAttribute("aria-hidden", "true"); document.body.prepend(el); }
  const p = get().prefs.bg || {}; const ph = p.id === "photo" ? loadPhoto() : null; root.dataset.bg = paint(el, p, ph);
  const dark = root.dataset.theme ? root.dataset.theme === "dark" : typeof matchMedia !== "undefined" && matchMedia("(prefers-color-scheme: dark)").matches;
  const b = glassTone(toneBehind(root.dataset.bg === "photo" && ph ? ph.g : null, parseFloat(el.style.getPropertyValue("--veil")) || 0, dark), root.dataset.glass || "");
  b ? (root.dataset.glass = b) : root.removeAttribute("data-glass");
}

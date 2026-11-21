// Liquid Glass material. The refraction model follows the supplied reference (dashersw/liquid-glass-js, container.js):
//   shape SDF (rounded rect / circle / pill), refraction = normal * (edge*e^(-d*edgeD) + rim*e^(-d*rimD) [+ base]) + corner boost
//   + a small perpendicular ripple, then blur and a top-white / bottom-grey tint. Parameters live in T.glass (system/tokens.js).
// Transport differs on purpose: the reference snapshots the page with html2canvas and draws it with WebGL. A snapshot goes stale while
// the page scrolls and costs a full-page capture, so here the same lens is baked into an SVG displacement map and applied as a live
// backdrop-filter (compositor, always current). Chromium WebView renders it; anything else gets blur + tint from CSS (.glass), and
// reduced-transparency / high-contrast get a solid fill.
// Lens idea from Shu Ding's liquid-glass (MIT).
import { T } from "../system/tokens.js";
const NS = "http://www.w3.org/2000/svg", XL = "http://www.w3.org/1999/xlink";
const ok = typeof navigator !== "undefined" && /Chrome|Edg\//.test(navigator.userAgent) && !/OPR\/|Firefox|CriOS|FxiOS/.test(navigator.userAgent);
const cache = new Map(), CACHE_MAX = 16, CACHE_PX = 700000, CH = [["r", 1], ["g", 0], ["b", -1]]; // channel, sign of its scale offset
let defs, n = 0;

// Signed distance (negative inside) and outward normal for a rounded rect of half-size (hw,hh) and corner radius r.
// r = hh gives a pill, r = hw = hh a circle: the same function covers all three reference shapes.
export function sdf(px, py, hw, hh, r) {
  const sx = px < 0 ? -1 : 1, sy = py < 0 ? -1 : 1, qx = Math.abs(px) - hw + r, qy = Math.abs(py) - hh + r;
  const ox = Math.max(qx, 0), oy = Math.max(qy, 0), len = Math.hypot(ox, oy);
  const d = len + Math.min(Math.max(qx, qy), 0) - r;
  let nx, ny;
  if (len > 1e-6) { nx = (ox / len) * sx; ny = (oy / len) * sy; } else if (qx > qy) { nx = sx; ny = 0; } else { nx = 0; ny = sy; }
  return { d, nx, ny };
}

// Offset (px) the lens applies at depth `d` px inside the edge. Pure; unit-tested.
export function lens(d, cornerN, depthFrac, G = T.glass) {
  const rim = Math.exp(-d * G.rim[1]);
  const mag = G.edge[0] * Math.exp(-d * G.edge[1]) + G.rim[0] * rim + Math.exp(-cornerN * 0.3) * G.corner;
  return { mag: mag * G.ref, rip: Math.sin(depthFrac * 25) * G.ripple * rim * G.ref };
}

export function build(w, h, r, G = T.glass) {
  const key = `${w}x${h}x${r}`;
  const hit = cache.get(key);
  if (hit) { cache.delete(key); cache.set(key, hit); return hit; } // refresh recency
  r = Math.min(r, w / 2, h / 2);
  const c = document.createElement("canvas"); c.width = w; c.height = h;
  const g = c.getContext("2d"), img = g.createImageData(w, h), raw = new Float32Array(w * h * 2), mn = Math.min(w, h), capPx = G.cap * mn;
  let m = 1e-6;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const px = x + 0.5 - w / 2, py = y + 0.5 - h / 2, s = sdf(px, py, w / 2, h / 2, r), depth = Math.max(-s.d, 0);
    const fx = (x + 0.5) / w, fy = (y + 0.5) / h, cornerN = Math.max(Math.min(fx, 1 - fx), Math.min(fy, 1 - fy)) * mn;
    const L = lens(depth, cornerN, depth / mn, G), tot = capPx * Math.tanh(L.mag / capPx), i = (y * w + x) * 2;
    raw[i] = s.nx * tot - s.ny * L.rip; raw[i + 1] = s.ny * tot + s.nx * L.rip; // perpendicular = (-ny, nx)
    m = Math.max(m, Math.abs(raw[i]), Math.abs(raw[i + 1]));
  }
  for (let i = 0; i < w * h; i++) {
    const o = i * 4;
    img.data[o] = (raw[i * 2] / (2 * m) + 0.5) * 255; img.data[o + 1] = (raw[i * 2 + 1] / (2 * m) + 0.5) * 255; img.data[o + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  const v = { href: c.toDataURL(), scale: 2 * m, px: w * h }; cache.set(key, v); trim(); return v;
}
// Bounded memory: evict least-recently-used maps. Safe while in use, because a live filter holds its own copy of the href.
function trim() { let tot = 0; for (const e of cache.values()) tot += e.px; for (const k of cache.keys()) { if (cache.size <= CACHE_MAX && tot <= CACHE_PX) break; tot -= cache.get(k).px; cache.delete(k); } }
export const cacheSize = () => cache.size;

// Quality tiers, lowered by system/perf.js when frames are measured to be slow. 0 = refraction with chromatic aberration (3 displacement passes),
// 1 = refraction only (1 pass), 2 = blur + tint (no SVG filter). Legibility and layout are identical in every tier.
let level = 0; const live = new Set();
export const glassLevel = () => level;
export function setGlassLevel(l) { l = Math.max(0, Math.min(2, l | 0)); if (l === level) return; level = l; for (const u of live) u(); }

// r: corner radius in px (use Infinity for a pill / circle: it is clamped to half the shortest side).
export function glass(el, r = T.radius.lg) {
  el.classList.add("glass");
  if (!ok || (typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-transparency: reduce)").matches)) return el;
  if (!defs) {
    const s = document.createElementNS(NS, "svg");
    s.setAttribute("width", "0"); s.setAttribute("height", "0"); s.style.cssText = "position:fixed;pointer-events:none";
    defs = document.createElementNS(NS, "defs"); s.append(defs); document.body.append(s);
  }
  const id = "lg" + ++n, f = document.createElementNS(NS, "filter"), im = document.createElementNS(NS, "feImage"), dms = [];
  f.setAttribute("id", id); f.setAttribute("filterUnits", "userSpaceOnUse"); f.setAttribute("color-interpolation-filters", "sRGB");
  f.setAttribute("x", "0"); f.setAttribute("y", "0"); im.setAttribute("result", "m"); f.append(im);
  // Chromatic aberration: the backdrop is displaced three times, once per colour channel, with scales that differ by +-ca. The displacement map is
  // already ~0 at the centre and largest at curved edges, so the red/blue separation follows the refraction: strongest at the rim, none in the middle.
  for (const [c, k] of CH) {
    const dm = document.createElementNS(NS, "feDisplacementMap"), cm = document.createElementNS(NS, "feColorMatrix");
    dm.setAttribute("in", "SourceGraphic"); dm.setAttribute("in2", "m"); dm.setAttribute("xChannelSelector", "R"); dm.setAttribute("yChannelSelector", "G"); dm.setAttribute("result", "d" + c); dm._k = k;
    cm.setAttribute("in", "d" + c); cm.setAttribute("type", "matrix"); cm.setAttribute("result", "c" + c);
    cm.setAttribute("values", c === "r" ? "1 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 1 0" : c === "g" ? "0 0 0 0 0 0 1 0 0 0 0 0 0 0 0 0 0 0 1 0" : "0 0 0 0 0 0 0 0 0 0 0 1 0 0 0 0 0 0 1 0");
    dms.push(dm); f.append(dm, cm);
  }
  const rg = document.createElementNS(NS, "feComposite"), all = document.createElementNS(NS, "feComposite");
  rg.setAttribute("in", "cr"); rg.setAttribute("in2", "cg"); rg.setAttribute("operator", "arithmetic"); rg.setAttribute("k2", "1"); rg.setAttribute("k3", "1"); rg.setAttribute("result", "rg");
  all.setAttribute("in", "rg"); all.setAttribute("in2", "cb"); all.setAttribute("operator", "arithmetic"); all.setAttribute("k2", "1"); all.setAttribute("k3", "1");
  f.append(rg, all); defs.append(f);
  // Lite filter: one displacement pass, no per-channel split.
  const lf = document.createElementNS(NS, "filter"), lim = document.createElementNS(NS, "feImage"), ldm = document.createElementNS(NS, "feDisplacementMap");
  lf.setAttribute("id", id + "l"); lf.setAttribute("filterUnits", "userSpaceOnUse"); lf.setAttribute("color-interpolation-filters", "sRGB"); lf.setAttribute("x", "0"); lf.setAttribute("y", "0");
  lim.setAttribute("result", "m"); ldm.setAttribute("in", "SourceGraphic"); ldm.setAttribute("in2", "m"); ldm.setAttribute("xChannelSelector", "R"); ldm.setAttribute("yChannelSelector", "G");
  lf.append(lim, ldm); defs.append(lf);
  const base = `blur(${T.glass.blur * 0.5}px) saturate(${T.glass.sat})`;
  let size = null;
  const upd = () => {
    if (level >= 2) { el.style.backdropFilter = ""; return; } // CSS .glass supplies blur + tint
    if (!size) { size = measure(); if (!size) return; }
    el.style.backdropFilter = `url(#${id}${level ? "l" : ""}) ${base}`;
  };
  const measure = () => {
    const w = Math.round(el.offsetWidth), h = Math.round(el.offsetHeight);
    if (!w || !h || w * h > T.glass.maxArea) return null;
    const { href, scale } = build(w, h, Math.min(r, h / 2, w / 2));
    for (const a of [f, im, lf, lim]) { a.setAttribute("width", w); a.setAttribute("height", h); }
    for (const a of [im, lim]) { a.setAttribute("href", href); a.setAttributeNS(XL, "href", href); }
    for (const dm of dms) dm.setAttribute("scale", scale * (1 + dm._k * T.glass.ca));
    ldm.setAttribute("scale", scale);
    return { w, h };
  };
  // Remeasure only when the box really changes size (observers also fire once on attach and on pure position changes).
  const ro = new ResizeObserver(() => { const w = Math.round(el.offsetWidth), h = Math.round(el.offsetHeight); if (!size || size.w !== w || size.h !== h) { size = null; upd(); } });
  ro.observe(el); live.add(upd);
  el._lg = () => { ro.disconnect(); live.delete(upd); f.remove(); lf.remove(); };
  return el;
}

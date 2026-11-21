// Shared-element (container transform) system. A panel starts as the source element (same rect, radius,
// colour, content) and a single spring-driven progress value p morphs it to its destination.
// The same p drives the reverse transition, drag-to-dismiss and interruption.
import { h } from "../ui/dom.js";
import { spring } from "./motion.js";
import { T } from "./tokens.js";
import { app } from "../core/app.js";
import { haptic } from "./haptics.js";
const cl = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x)), lerp = (a, b, t) => a + (b - a) * t, seg = (p, a, b) => cl((p - a) / (b - a));
const stack = [], hidden = new Set();
let uidn = 0;
export const find = (sid) => [...document.querySelectorAll("[data-sid]")].find((e) => e.dataset.sid === sid);
const rect = (e) => { const r = e.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; };
export const reapply = () => hidden.forEach((s) => { const e = find(s); if (e) e.style.visibility = "hidden"; });
export const refreshPanels = () => stack.forEach((p) => p.update());
export const inset = (side) => { const e = h("div", { style: `position:fixed;${side}:0;left:0;height:var(--sa${side[0]});visibility:hidden` }); document.body.append(e); const v = e.offsetHeight; e.remove(); return v; };
addEventListener("popstate", () => { const top = stack[stack.length - 1]; if (top) top.doClose(); });
addEventListener("keydown", (e) => { if (e.key === "Escape" && stack.length && !document.querySelector("dialog[open]")) stack[stack.length - 1].close(); });

export function openPanel({ sid, render, mode = "full", label = "", onClose }) {
  if (stack.some((q) => q.sid === sid)) return null;
  const id = ++uidn, src = find(sid), vw = innerWidth, vh = innerHeight, W = Math.min(vw - 20, 560);
  let R0 = src ? rect(src) : { x: vw / 2 - 40, y: vh / 2 - 40, w: 80, h: 80 };
  const cs = src ? getComputedStyle(src) : null;
  const alpha = cs ? (/^rgba\(.*,\s*([\d.]+)\)$/.exec(cs.backgroundColor) || [0, 1])[1] : 0, glassSrc = !!(src && src.classList.contains("glass"));
  const solid = cs && !glassSrc && !/^rgba\(0, 0, 0, 0\)$|^transparent$/.test(cs.backgroundColor) && Number(alpha) >= 0.95;
  const rad = cs ? cs.borderTopLeftRadius : "", r0 = rad.endsWith("%") ? (parseFloat(rad) / 100) * Math.min(R0.w, R0.h) : parseFloat(rad) || T.radius.lg;
  const ghost = src ? src.cloneNode(true) : null;
  if (ghost) { ghost.removeAttribute("id"); ghost.removeAttribute("data-sid"); /* the clone must not duplicate the source's id (the header Add button has one) */ ghost.setAttribute("aria-hidden", "true"); ghost.setAttribute("inert", ""); ghost.classList.add("sxg"); /* not "ghost": that is also a button style (btn ghost) */ ghost.style.width = R0.w + "px"; ghost.style.height = R0.h + "px";
    if (glassSrc) { ghost.classList.add("gx"); const bf = (cs.backdropFilter || "").replace(/url\([^)]*\)\s*/, "").trim() || "none"; ghost.style.backdropFilter = bf; ghost.style.webkitBackdropFilter = bf; } }
  const ctx = { close: () => req(), update: () => { if (closing) return; const st = inner.scrollTop; inner.replaceChildren(render(ctx)); inner.scrollTop = st; } };
  const inner = h("div", { class: "pin" }), scrim = h("div", { class: "scrim" }), bgf = h("div", { class: "bgf" }), grab = h("div", { class: "grab" }, h("i"));
  const panel = h("div", { class: "panel", role: "dialog", "aria-modal": "true", "aria-label": label, tabindex: "-1" }, bgf, ghost, inner, grab);
  inner.append(render(ctx));
  panel.style.setProperty("--r0", r0 + "px"); if (solid) panel.style.background = cs.backgroundColor; else if (glassSrc) panel.style.background = "transparent";
  const layer = h("div", { class: "layer" }, scrim, panel);
  inner.style.width = W + "px"; panel.style.cssText += `;visibility:hidden;left:0;top:0;width:${W}px;height:auto`;
  document.body.append(layer);
  const sat = inset("top"), sab = inset("bottom"), nat = inner.scrollHeight;
  const H = mode === "sheet" ? Math.min(nat + 8, vh - 80 - sat) : vh - 20 - sat - sab;
  const R1 = { x: (vw - W) / 2, y: mode === "sheet" ? vh - 10 - sab - H : 10 + sat, w: W, h: H };
  inner.style.height = H + "px"; panel.style.visibility = "";

  // Window resize / rotation / fold: recompute the destination rectangle (same code path as the first layout) and redraw from the current progress, so nothing goes stale or out of bounds.
  let rz = 0;
  const relayout = () => { if (closing) return; const vw2 = innerWidth, vh2 = innerHeight, W2 = Math.min(vw2 - 20, 560), a = inset("top"), b = inset("bottom"), H2 = mode === "sheet" ? Math.min(R1.h, vh2 - 80 - a) : vh2 - 20 - a - b;
    Object.assign(R1, { x: (vw2 - W2) / 2, y: mode === "sheet" ? vh2 - 10 - b - H2 : 10 + a, w: W2, h: H2 }); inner.style.width = W2 + "px"; inner.style.height = H2 + "px"; if (!anim) draw(p); };
  const onResize = () => { cancelAnimationFrame(rz); rz = requestAnimationFrame(relayout); };
  addEventListener("resize", onResize);
  let p = 0, anim = null, closing = false, drag = null, pendV = 0, missing = false;
  hidden.add(sid); if (src) src.style.visibility = "hidden";
  const draw = (x) => {
    p = x;
    if (closing) { const e = find(sid); if (e) { R0 = rect(e); e.style.visibility = "hidden"; missing = false; } else missing = true; }
    const s = panel.style;
    s.setProperty("--p", x.toFixed(4));
    s.left = lerp(R0.x, R1.x, x) + "px"; s.top = lerp(R0.y, R1.y, x) + "px"; s.width = lerp(R0.w, R1.w, x) + "px"; s.height = lerp(R0.h, R1.h, x) + "px";
    s.opacity = missing ? cl(x * 2) : 1;
    bgf.style.opacity = cl(x * 2.2); inner.style.opacity = seg(x, 0.3, 0.75); inner.style.pointerEvents = x > 0.9 ? "" : "none";
    if (ghost) ghost.style.opacity = 1 - seg(x, 0, 0.28);
    scrim.style.opacity = cl(x); grab.style.opacity = seg(x, 0.6, 1);
  };
  const finish = () => {
    removeEventListener("resize", onResize); cancelAnimationFrame(rz); layer.remove(); const i = stack.findIndex((q) => q.id === id); if (i >= 0) stack.splice(i, 1);
    const top = stack[stack.length - 1]; if (top) top.layer.inert = false;
    hidden.delete(sid); const e = find(sid); if (e) { e.style.visibility = ""; e.focus && e.focus({ preventScroll: true }); }
    if (!stack.length) document.getElementById("root").inert = false;
  };
  const go = (to, v0) => {
    const from = anim ? anim.x : p, v = v0 !== undefined ? v0 : anim ? anim.v : 0;
    anim && anim.stop();
    anim = spring({ from, to, v, ...T.spring.sheet }, draw, () => { anim = null; if (to === 0) finish(); });
  };
  const doClose = () => { if (closing) return; closing = true; haptic("nav"); onClose && onClose(); app.refresh(); go(0, pendV || undefined); };
  const req = () => { if (closing) return; if (history.state && history.state.ip === id) history.back(); else doClose(); };

  scrim.addEventListener("click", req);
  grab.addEventListener("pointerdown", (e) => { if (closing) return; anim && anim.stop(); anim = null; drag = { y0: e.clientY, p0: p, span: Math.max(160, R1.h * 0.55), ly: e.clientY, lt: e.timeStamp, v: 0 }; grab.setPointerCapture(e.pointerId); });
  grab.addEventListener("pointermove", (e) => {
    if (!drag) return;
    const dt = e.timeStamp - drag.lt; if (dt > 0) { drag.v = (e.clientY - drag.ly) / dt; drag.ly = e.clientY; drag.lt = e.timeStamp; }
    draw(cl(drag.p0 - (e.clientY - drag.y0) / drag.span, 0, 1.03));
    const past = p < 0.72; if (past !== drag.past) { if (drag.past !== undefined) haptic("select"); drag.past = past; } // one tick when the release would dismiss / keep
  });
  const end = () => { if (!drag) return; const d = drag; drag = null; const v0 = (-d.v * 1000) / d.span; if (p < 0.72 || d.v > 0.6) { pendV = v0; req(); } else go(1, v0); };
  grab.addEventListener("pointerup", end); grab.addEventListener("pointercancel", end);

  const below = stack[stack.length - 1]; if (below) below.layer.inert = true; /* a panel opened from a panel: the lower one is unreachable while this is open */
  stack.push({ id, sid, layer, update: ctx.update, doClose, close: req });
  document.getElementById("root").inert = true;
  history.pushState({ ip: id }, "");
  draw(0); go(1, 0); panel.focus({ preventScroll: true });
  return { close: req };
}

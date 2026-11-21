import { get } from "../core/store.js";
import { T } from "./tokens.js";
import { frame } from "./perf.js";
export const reduced = () => {
  const m = get().prefs.motion;
  return m === "on" || (m !== "off" && typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches);
};
// Damped spring. Starts from the current value AND velocity, so it can be interrupted and retargeted.
export function spring({ from, to, v = 0, k = 280, c = 30, m = 1 }, step, done) {
  if (reduced()) { step(to); done && done(); return { x: to, v: 0, stop() {} }; }
  let dead = false, raf = 0, last = performance.now(), first = true;
  const ctl = { x: from, v, stop() { dead = true; cancelAnimationFrame(raf); } };
  const tick = (t) => {
    if (dead) return;
    const gap = t - last; first ? (first = false) : frame(gap); // measured gap feeds the quality governor
    const dt = Math.min(Math.max(gap / 1000, 0), 1 / 20); last = t;
    const n = Math.max(1, Math.ceil(dt * 120)), hh = dt / n; // 2 substeps at 60 fps (was 4); stable for this stiffness
    for (let i = 0; i < n; i++) { ctl.v += ((-k * (ctl.x - to) - c * ctl.v) / m) * hh; ctl.x += ctl.v * hh; }
    step(ctl.x);
    if (Math.abs(ctl.x - to) < 0.0008 && Math.abs(ctl.v) < 0.01) { ctl.x = to; ctl.v = 0; step(to); dead = true; done && done(); return; }
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);
  return ctl;
}
let cur;
// dir: +1 enters from the right, -1 from the left (so Back is the same motion reversed), 0 = rise in place.
export function enter(el, dir = 0) {
  if (reduced()) return;
  cur && cur.cancel();
  cur = el.animate([{ opacity: 0, transform: dir ? `translateX(${dir * 28}px)` : "translateY(10px)" }, { opacity: 1, transform: "none" }], { duration: T.dur.component, easing: T.ease });
}
export function pop(el) {
  if (reduced()) return;
  el.animate([{ transform: "scale(.88)" }, { transform: "scale(1)" }], { duration: T.dur.control + 60, easing: T.ease });
}

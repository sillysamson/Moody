import { h } from "../ui/dom.js";
import { backBar, btn, card, seg, toast } from "../ui/components.js";
import { haptic } from "../system/haptics.js";
import { reduced } from "../system/motion.js";
import { t } from "../system/i18n.js";

const PAT = { box: [["Breathe in", 4], ["Hold", 4], ["Breathe out", 4], ["Hold", 4]], equal: [["Breathe in", 4], ["Breathe out", 4]] };
const Z = { pat: "box", min: 3 };
let ui = null, state = "idle", el = 0, last = 0, raf = 0, pi = -1;
const total = () => Z.min * 60000, fmt = (ms) => { const s = Math.ceil(ms / 1000); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`; };

function frame(now) {
  if (state !== "run") return;
  el += now - last; last = now;
  if (el >= total()) { haptic("success"); toast(t("Session complete.")); stop(); return; }
  const S = PAT[Z.pat], cyc = S.reduce((a, s) => a + s[1] * 1000, 0);
  let tt = el % cyc, i = 0; while (tt >= S[i][1] * 1000) { tt -= S[i][1] * 1000; i++; }
  const [name, sec] = S[i], e = (1 - Math.cos(Math.PI * (tt / (sec * 1000)))) / 2, prev = S[(i - 1 + S.length) % S.length][0];
  const sc = name === "Breathe in" ? 0.62 + 0.38 * e : name === "Breathe out" ? 1 - 0.38 * e : prev === "Breathe in" ? 1 : 0.62;
  if (i !== pi) { pi = i; if (ui) ui.label.textContent = t(name); haptic("select"); }
  if (ui) { ui.circle.style.transform = reduced() ? "none" : `scale(${sc.toFixed(3)})`; ui.time.textContent = fmt(total() - el); }
  raf = requestAnimationFrame(frame);
}
function paint() {
  if (!ui) return;
  ui.opts.hidden = state !== "idle"; ui.controls.replaceChildren(
    ...(state === "idle" ? [btn(t("Start"), { icon: "play", onclick: start })] :
      [btn(state === "run" ? t("Pause") : t("Resume"), { icon: state === "run" ? "pause" : "play", onclick: state === "run" ? pause : resume }), btn(t("End"), { kind: "ghost", icon: "stop", onclick: () => stop() })]));
  if (state === "idle") { ui.label.textContent = t("Ready when you are"); ui.time.textContent = fmt(total()); ui.circle.style.transform = "none"; }
}
function start() { state = "run"; el = 0; pi = -1; last = performance.now(); raf = requestAnimationFrame(frame); paint(); }
function pause() { cancelAnimationFrame(raf); state = "pause"; paint(); }
function resume() { state = "run"; last = performance.now(); raf = requestAnimationFrame(frame); paint(); }
function stop() { cancelAnimationFrame(raf); state = "idle"; el = 0; pi = -1; paint(); }
export function leave() { cancelAnimationFrame(raf); state = "idle"; el = 0; pi = -1; ui = null; }
document.addEventListener("visibilitychange", () => { if (document.hidden && state === "run") pause(); });

export function zen() {
  const circle = h("div", { class: "zc" }), label = h("p", { class: "zl", "aria-live": "polite" }), time = h("p", { class: "mu zt" }), controls = h("div", { class: "acts center" });
  const opts = h("div", { class: "form" }, seg([["box", t("Box")], ["equal", t("Equal")]], Z.pat, (v) => { Z.pat = v; }, t("Pattern")),
    seg([[1, "1 min"], [3, "3 min"], [5, "5 min"]], Z.min, (v) => { Z.min = v; time.textContent = fmt(total()); }, t("Duration")),
    h("p", { class: "mu sm" }, t("Box: in 4 · hold 4 · out 4 · hold 4. Equal: in 4 · out 4.")));
  ui = { circle, label, time, controls, opts };
  const page = h("div", { class: "page" }, backBar(t("Zen"), t("Restore")),
    card(null, h("div", { class: "zstage" }, circle), label, time, controls, opts,
      h("p", { class: "mu sm" }, t("Stop any time. Don’t hold your breath if it’s uncomfortable. If you feel dizzy, stop and breathe normally."))));
  paint(); return page;
}

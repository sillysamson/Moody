import { h } from "./dom.js";
import { ic } from "./icons.js";
import { glass } from "./glass.js";
import { haptic } from "../system/haptics.js";
import { reduced } from "../system/motion.js";
import { T } from "../system/tokens.js";
import { t } from "../system/i18n.js";
import { goBack } from "../core/app.js";

export const btn = (label, o = {}) =>
  h("button", { type: "button", class: `btn ${o.kind || "primary"}${o.sm ? " sm" : ""}`, disabled: o.disabled, "aria-label": o.aria,
    onclick: (e) => { haptic(o.kind === "danger" ? "warning" : "button"); o.onclick && o.onclick(e); } }, o.icon ? ic(o.icon, 18) : null, label);
export const card = (title, ...kids) => h("section", { class: "card" }, title ? h("h2", {}, title) : null, ...kids);
export const empty = (icon, text, action) => h("div", { class: "empty" }, ic(icon, 30), h("p", { class: "mu" }, text), action);
// Visible Back control for sub-pages. Returns to where the page was opened from (see goBack).
export const backBar = (title, eyebrow, fallback = "home", noBtn = false) => h("div", { class: "top" }, h("div", {}, h("p", { class: "eyebrow" }, eyebrow), h("h1", {}, title)),
  noBtn ? null : h("button", { type: "button", class: "btn ghost sm", "aria-label": t("Back"), onclick: () => { haptic("nav"); goBack(fallback); } }, ic("back", 18), t("Back")));

const RING = new Map();
export function ring(id, p, txt) {
  const R = 42, C = 2 * Math.PI * R, prev = RING.has(id) ? RING.get(id) : p; RING.set(id, p);
  const s = document.createElement("span"); s.className = "ring";
  s.innerHTML = `<svg width="104" height="104" viewBox="0 0 104 104" aria-hidden="true"><circle cx="52" cy="52" r="${R}" class="rt"/><circle cx="52" cy="52" r="${R}" class="ra" transform="rotate(-90 52 52)"/></svg>`;
  const a = s.querySelector(".ra"), set = (v) => { a.style.strokeDasharray = `${C * v} ${C}`; a.style.opacity = v > 0 ? 1 : 0; };
  set(prev); s.append(h("b", {}, txt));
  if (prev !== p) requestAnimationFrame(() => requestAnimationFrame(() => set(p)));
  return s;
}

let tm;
export function toast(msg, err) {
  tm && tm.remove();
  const el = glass(h("div", { class: "toast" + (err ? " err" : ""), role: "status" }, msg), Infinity); tm = el;
  document.body.append(el);
  setTimeout(() => { el._lg && el._lg(); el.remove(); }, 3200);
}

function modal(node) {
  const d = h("dialog", { class: "dlg" }, node);
  d.finish = (v) => {
    if (d._c) return; d._c = 1;
    const a = reduced() ? null : d.animate([{ opacity: 1, transform: "none" }, { opacity: 0, transform: "translateY(10px) scale(.97)" }], { duration: T.dur.control + 40, easing: T.ease, fill: "forwards" });
    (a ? a.finished : Promise.resolve()).then(() => d.close(v), () => d.close(v));
  };
  d.addEventListener("cancel", (e) => { e.preventDefault(); d.finish("no"); });
  d.addEventListener("close", () => { d._lg && d._lg(); d.remove(); });
  document.body.append(d); d.showModal(); glass(d, T.radius.lg);
  if (!reduced()) {
    d.animate([{ opacity: 0, transform: "translateY(14px) scale(.97)" }, { opacity: 1, transform: "none" }], { duration: T.dur.dialog, easing: T.ease });
    try { d.animate([{ opacity: 0 }, { opacity: 1 }], { duration: T.dur.dialog, easing: T.ease, pseudoElement: "::backdrop" }); } catch {}
  }
  return d;
}
export const confirmBox = ({ title, body, ok, keep, danger }) => new Promise((res) => {
  const d = modal(h("div", { class: "dlgc", role: "alertdialog", "aria-label": title }, h("h3", {}, title), h("p", { class: "mu" }, body),
    h("div", { class: "acts end" }, btn(keep || t("Cancel"), { kind: "ghost", onclick: () => d.finish("no") }), btn(ok, { kind: danger ? "danger" : "primary", onclick: () => d.finish("yes") }))));
  d.addEventListener("close", () => res(d.returnValue === "yes"));
  if (danger) haptic("warning");
});
export const pick = ({ title, options, value }) => new Promise((res) => {
  const d = modal(h("div", { class: "dlgc" }, h("h3", {}, title), h("div", { class: "opts", role: "radiogroup", "aria-label": title },
    options.map(([v, l]) => h("button", { type: "button", role: "radio", class: "opt", "aria-checked": String(v === value), onclick: () => { haptic("select"); d.finish(v); } }, h("span", {}, l), v === value ? ic("check", 18) : null)))));
  d.addEventListener("close", () => res(d.returnValue && d.returnValue !== "no" ? d.returnValue : undefined));
});
export const textDialog = (title, paras) => {
  const d = modal(h("div", { class: "dlgc" }, h("div", { class: "dh" }, h("h3", {}, title), h("button", { type: "button", class: "icbtn", "aria-label": t("Close"), onclick: () => d.finish("no") }, ic("close"))),
    h("div", { class: "txt sel" }, paras.map((p) => h("p", {}, p)))));
};

export const sw = (on, fn, label, { disabled } = {}) => {
  const b = h("button", { type: "button", role: "switch", class: "sw" + (on ? " on" : ""), "aria-checked": String(!!on), "aria-label": label, disabled }, h("i"));
  b.addEventListener("click", () => { on = !on; b.classList.toggle("on", on); b.setAttribute("aria-checked", String(on)); haptic("toggle", on); fn(on); });
  return b;
};
export const seg = (opts, val, fn, label) => {
  let cur = Math.max(0, opts.findIndex((o) => o[0] === val));
  const thumb = h("i", { class: "thumb" }), el = h("div", { class: "seg", role: "radiogroup", "aria-label": label });
  el.style.setProperty("--n", opts.length); thumb.style.setProperty("--i", cur);
  const bs = opts.map(([v, l], i) => h("button", { type: "button", role: "radio", "aria-checked": String(i === cur),
    onclick: () => { if (cur === i) return; cur = i; thumb.style.setProperty("--i", i); bs.forEach((b, j) => b.setAttribute("aria-checked", String(j === i))); haptic("select"); fn(v); } }, l));
  el.append(thumb, ...bs); return el;
};
export const slider = ({ min, max, step, value, fmt = (v) => v, label, onInput, onCommit }) => {
  let last = value;
  const out = h("output", {}, fmt(value)), pct = (v) => ((v - min) / (max - min)) * 100;
  const r = h("input", { type: "range", min, max, step, value, "aria-label": label,
    oninput: () => { const v = +r.value; out.textContent = fmt(v); r.style.setProperty("--pct", pct(v) + "%"); if (v !== last) { last = v; haptic("slider"); } onInput && onInput(v); },
    onchange: () => onCommit && onCommit(+r.value) });
  r.style.setProperty("--pct", pct(value) + "%");
  return h("div", { class: "slider" }, r, out);
};
export const timeInput = (value, fn, label, disabled) =>
  h("input", { type: "time", class: "tin", value, "aria-label": label, disabled, onchange: (e) => { const v = e.target.value; if (/^\d{2}:\d{2}$/.test(v)) { haptic("select"); fn(v); } else e.target.value = value; } });
export const row = ({ icon, title, sub, end, onclick, sid, danger, wide, dim }) => {
  const kids = [icon ? h("span", { class: "rico" }, ic(icon, 20)) : null, h("span", { class: "grow rtx" }, h("b", {}, title), sub ? h("span", { class: "mu sm" }, sub) : null), end || null];
  const cls = "srow" + (danger ? " danger" : "") + (wide ? " wide" : "") + (dim ? " dim" : "");
  return onclick ? h("button", { type: "button", class: cls, "data-sid": sid, onclick: (e) => { haptic("button"); onclick(e); } }, ...kids) : h("div", { class: cls + " static" }, ...kids);
};
export const group = (label, ...rows) => h("section", { class: "sgroup" }, label ? h("h3", { class: "glabel" }, label) : null, h("div", { class: "glist" }, ...rows.filter(Boolean)));

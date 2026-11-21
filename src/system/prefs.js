import { setBars } from "./native.js";
import { get, commit } from "../core/store.js";
import { reduced } from "./motion.js";
import { cssVars, VARS } from "./palette.js";
import { applyBg } from "../ui/background.js";
export const P = () => get().prefs;
export function setPref(path, val) {
  const ks = path.split("."); let o = P();
  for (const k of ks.slice(0, -1)) o = o[k];
  o[ks[ks.length - 1]] = val;
  const ok = commit(); apply(); return ok;
}
export const applyFont = (v) => { document.documentElement.style.fontSize = (16 * v) / 100 + "px"; };
export function apply() {
  const r = document.documentElement, p = P();
  p.theme === "system" ? r.removeAttribute("data-theme") : (r.dataset.theme = p.theme);
  applyFont(p.font);
  const v = cssVars(p.accent, p.contrast); VARS.forEach((k) => (k in v ? r.style.setProperty(k, v[k]) : r.style.removeProperty(k))); // accent palette overrides the stylesheet one; moss = none
  applyBg();
  setBars(p.theme === "dark" || (p.theme === "system" && typeof matchMedia !== "undefined" && matchMedia("(prefers-color-scheme: dark)").matches)); // system bar icons follow the resolved scheme
  r.dataset.cb = p.cb ? "1" : "0"; r.dataset.contrast = p.contrast; r.dataset.tap = p.tap; r.lang = p.lang; r.dataset.fx = p.fx; r.dataset.rm = reduced() ? "1" : "0";
}

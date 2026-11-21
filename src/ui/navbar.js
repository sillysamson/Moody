// Floating navigation pill (1.6): anchored at the bottom centre by CSS, never draggable. Tapping a destination navigates; only the selection
// thumb moves (CSS transform on .nthumb). Drag interactions elsewhere (dashboard reorder, mood dial) are untouched.
import { h } from "./dom.js";
import { ic } from "./icons.js";
import { glass } from "./glass.js";
import { t } from "../system/i18n.js";

let el, thumb;

export function createNav({ items, onGo }) {
  thumb = h("i", { class: "nthumb", "aria-hidden": "true" });
  const btns = items.map(([k, label, icon]) => h("button", { type: "button", class: "nv", "data-k": k, onclick: () => onGo(k) }, h("span", { class: "ni" }, ic(icon)), h("span", { class: "nl" }, t(label))));
  el = glass(h("nav", { "aria-label": t("Main"), style: "--n:" + items.length }, h("div", { class: "nitems" }, thumb, btns)), Infinity);
  return el;
}

export function syncNav(cur) {
  if (!el) return;
  const bs = [...el.querySelectorAll(".nv")]; let i = -1;
  bs.forEach((b, j) => { const on = b.dataset.k === cur; if (on) i = j; on ? b.setAttribute("aria-current", "page") : b.removeAttribute("aria-current"); });
  thumb.style.opacity = i < 0 ? 0 : 1; if (i >= 0) el.style.setProperty("--i", i);
  const L = { home: "Dashboard", habits: "Habits", mood: "Mood", diary: "Diary" };
  bs.forEach((b) => (b.querySelector(".nl").textContent = t(L[b.dataset.k]))); el.setAttribute("aria-label", t("Main"));
}

export const setMin = (on) => { if (el && el.classList.contains("min") !== on) el.classList.toggle("min", on); };

import { h } from "../ui/dom.js";
import { ic } from "../ui/icons.js";
import { recIcon, moodText } from "./mood.js";
import { backBar, empty } from "../ui/components.js";
import { openPanel } from "../system/shared.js";
import { haptic } from "../system/haptics.js";
import { reduced } from "../system/motion.js";
import { P } from "../system/prefs.js";
import { T } from "../system/tokens.js";
import { t } from "../system/i18n.js";
import { today, long, monthName, dn, short, clock } from "../core/dates.js";
import { dayInfo, monthMarks } from "../core/logic.js";
import { orb } from "./habits.js";

let Cal = null;
const dayBody = (date) => () => {
  const i = dayInfo(date), none = !i.habits.length && !i.moods.length && !i.diary.length;
  return h("div", { class: "pbody" }, h("div", { class: "phead" }, h("div", { class: "grow" }, h("p", { class: "eyebrow" }, t("Daily overview")), h("h2", {}, long(date)))),
    none ? empty("calendar", t("Nothing recorded for this day.")) : null,
    i.habits.length ? h("div", { class: "stack" }, h("h3", {}, t("Habits")), i.habits.map((x) => h("div", { class: "row" }, orb(x, date), h("span", { class: "grow" }, x.name)))) : null,
    i.moods.length ? h("div", { class: "stack" }, h("h3", {}, t("Mood")), i.moods.map((m) => h("div", { class: "row top-row" }, recIcon(m, 36), h("div", { class: "grow" }, h("b", {}, moodText(m)), h("p", { class: "mu sm" }, clock(m.ts)), m.note ? h("p", { class: "mu" }, m.note) : null)))) : null,
    i.diary.length ? h("div", { class: "stack" }, h("h3", {}, t("Diary")), i.diary.map((e) => h("div", { class: "mini" }, h("b", {}, e.title || t("Untitled")), h("p", { class: "mu" }, e.body.slice(0, 120) + (e.body.length > 120 ? "…" : ""))))) : null,
    h("p", { class: "mu sm" }, short(date)));
};

export const openDay = (date) => { haptic("select"); openPanel({ sid: T.sid.day(date), mode: "sheet", label: long(date), render: dayBody(date) }); };

export function calendar() {
  if (!Cal) { const n = new Date(); Cal = { y: n.getFullYear(), m: n.getMonth() }; }
  const wrap = h("div", { class: "calwrap" }), title = h("h2", { class: "calt", "aria-live": "polite" });
  const build = (dir) => {
    const { y, m } = Cal, ws = P().weekStart, off = (new Date(y, m, 1).getDay() - ws + 7) % 7, dim = new Date(y, m + 1, 0).getDate();
    const prefix = `${y}-${String(m + 1).padStart(2, "0")}`, marks = monthMarks(prefix), td = today(), grid = h("div", { class: "cal" });
    title.textContent = monthName(y, m);
    for (let i = 0; i < 7; i++) grid.append(h("span", { class: "wd", "aria-hidden": "true" }, dn((ws + i) % 7).slice(0, 2)));
    for (let i = 0; i < off; i++) grid.append(h("span"));
    for (let d = 1; d <= dim; d++) {
      const date = `${prefix}-${String(d).padStart(2, "0")}`, k = marks[date] || { h: 0, m: 0, d: 0 };
      grid.append(h("button", { type: "button", class: "day" + (date === td ? " today" : ""), "data-sid": T.sid.day(date),
        "aria-label": `${long(date)}. ${t("{n} habits completed", { n: k.h })}, ${t("{n} moods", { n: k.m })}, ${t("{n} diary entries", { n: k.d })}`,
        onclick: () => openDay(date) },
        h("b", {}, String(d)), h("span", { class: "mks", "aria-hidden": "true" }, k.h ? h("i", { class: "mk h" }) : null, k.m ? h("i", { class: "mk m" }) : null, k.d ? h("i", { class: "mk d" }) : null)));
    }
    wrap.replaceChildren(grid);
    if (dir && !reduced()) grid.animate([{ opacity: 0, transform: `translateX(${dir * 28}px)` }, { opacity: 1, transform: "none" }], { duration: T.dur.component, easing: T.ease });
  };
  const shift = (n) => { Cal.m += n; if (Cal.m < 0) { Cal.m = 11; Cal.y--; } if (Cal.m > 11) { Cal.m = 0; Cal.y++; } haptic("select"); build(n); };
  build(0);
  const nb = (icn, lab, fn) => h("button", { type: "button", class: "icbtn", "aria-label": lab, onclick: fn }, ic(icn));
  return h("div", { class: "page" }, backBar(t("Calendar"), t("Browse")),
    h("section", { class: "card" }, h("div", { class: "calhead" }, nb("back", t("Previous month"), () => shift(-1)), title, nb("next", t("Next month"), () => shift(1))), wrap,
      h("div", { class: "legend" }, h("span", {}, h("i", { class: "mk h" }), t("Habit completed")), h("span", {}, h("i", { class: "mk m" }), t("Mood")), h("span", {}, h("i", { class: "mk d" }), t("Diary")))));
}

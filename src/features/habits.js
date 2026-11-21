import { h } from "../ui/dom.js";
import { ic } from "../ui/icons.js";
import { btn, card, empty, toast, confirmBox } from "../ui/components.js";
import { openPanel } from "../system/shared.js";
import { haptic } from "../system/haptics.js";
import { pop, reduced } from "../system/motion.js";
import { T } from "../system/tokens.js";
import { t } from "../system/i18n.js";
import { get, commit, uid } from "../core/store.js";
import { sched, isDone, toggle, stat } from "../core/logic.js";
import { today, ago, dt, dn } from "../core/dates.js";
import { app } from "../core/app.js";

const FAIL = () => t("Couldn’t save. Please try again.");
const days7 = (x) => (x.days.length === 7 ? t("Every day") : x.days.map(dn).join(", "));

export function orb(x, date = today()) {
  const on = sched(x, date) && date <= today(), lab = (d) => `${x.name}, ${!on ? t("not scheduled") : d ? t("marked complete") : t("not marked complete yet")}`;
  const b = h("button", { type: "button", class: "orb" + (isDone(x, date) ? " on" : ""), disabled: !on, "aria-pressed": String(isDone(x, date)), "aria-label": lab(isDone(x, date)),
    onclick: (e) => {
      e.stopPropagation();
      if (!toggle(x, date)) { toast(FAIL(), true); haptic("error"); return; }
      const d = isDone(x, date);
      b.classList.toggle("on", d); b.setAttribute("aria-pressed", String(d)); b.setAttribute("aria-label", lab(d));
      haptic(d ? "success" : "select"); pop(b); app.soft();
    } }, ic("check", 20));
  return b;
}
export const openHabit = (x) => { const sid = T.sid.habit(x.id); haptic("select"); openPanel({ sid, mode: "full", label: x.name, render: detail(x) }); };
export const habitRow = (x) => h("div", { class: "row", "data-sid": T.sid.habit(x.id) }, orb(x), h("button", { type: "button", class: "info", onclick: () => openHabit(x) }, h("span", { class: "grow" }, x.name)));

function form(x, done) {
  let name = x ? x.name : "", days = x ? [...x.days] : [0, 1, 2, 3, 4, 5, 6];
  const err = h("p", { class: "er", role: "alert" }), chips = h("div", { class: "chips" });
  const draw = () => chips.replaceChildren(...[0, 1, 2, 3, 4, 5, 6].map((i) => h("button", { type: "button", class: "chip" + (days.includes(i) ? " on" : ""), "aria-pressed": String(days.includes(i)),
    onclick: () => { days = days.includes(i) ? (days.length > 1 ? days.filter((d) => d !== i) : days) : [...days, i]; haptic("select"); draw(); } }, dn(i))));
  draw();
  const inp = h("input", { type: "text", id: "hn" + (x ? x.id : "new"), value: name, autocomplete: "off", maxlength: "80", oninput: (e) => (name = e.target.value) });
  return h("div", { class: "form" }, h("label", { for: inp.id }, t("Name")), inp, h("p", { class: "mu" }, t("Days")), chips, err,
    btn(x ? t("Save changes") : t("Save habit"), { icon: "check", onclick: () => {
      if (!name.trim()) { err.textContent = t("Please give your habit a name."); haptic("error"); inp.focus(); return; }
      if (x) { x.name = name.trim(); x.days = [...days].sort(); } else get().habits.push({ id: uid(), name: name.trim(), days: [...days].sort(), start: today(), status: "active" });
      if (!commit()) { toast(FAIL(), true); haptic("error"); return; }
      haptic("success"); done();
    } }));
}

async function remove(x, ctx) {
  if (!(await confirmBox({ title: t("Delete “{name}”?", { name: x.name }), body: t("Its history is deleted too. This can’t be undone."), ok: t("Delete habit"), keep: t("Keep habit"), danger: true }))) return;
  const s = get(); s.habits = s.habits.filter((y) => y.id !== x.id);
  Object.keys(s.done).forEach((k) => k.startsWith(x.id + "|") && delete s.done[k]);
  commit() ? toast(t("Habit deleted.")) : toast(FAIL(), true);
  ctx ? ctx.close() : app.refresh();
}

function detail(x) { return (ctx) => detailBody(x, ctx); }
const detailBody = (x, ctx) => {
  const { n, c } = stat(x); let a = 0, b = 0;
  const strip = h("div", { class: "strip", role: "img" });
  for (let i = 6; i >= 0; i--) { const d = ago(i), sd = sched(x, d), dn1 = isDone(x, d); if (sd) b++; if (dn1) a++; strip.append(h("div", { class: "dot" + (dn1 ? " on" : sd ? "" : " off") }, h("i"), dn(dt(d).getDay()).slice(0, 2))); }
  strip.setAttribute("aria-label", t("Last 7 days: {a} marked complete, {b} scheduled", { a, b }));
  return h("div", { class: "pbody" },
    h("div", { class: "phead" }, orb(x), h("div", { class: "grow" }, h("h2", {}, x.name), h("p", { class: "mu sm" }, days7(x)))),
    strip, h("p", { class: "mu sm" }, n ? t("Marked complete {c} of {n} scheduled days (last 30 days)", { c, n }) : t("No scheduled days yet.")),
    h("h3", {}, t("Edit habit")), form(x, () => { toast(t("Saved.")); app.refresh(); }),
    h("div", { class: "acts" },
      btn(t("Archive"), { kind: "ghost", sm: true, icon: "archive", onclick: () => { x.status = "archived"; commit(); haptic("success"); toast(t("Habit archived.")); ctx.close(); } }),
      btn(t("Delete"), { kind: "danger", sm: true, icon: "trash", onclick: () => remove(x, ctx) })));
};
// Opened from the header Add button (data-sid fab:habit): the panel morphs out of that button and back into it on close.
const addPanel = () => openPanel({ sid: T.sid.fab("habit"), mode: "sheet", label: t("New habit"),
  render: (ctx) => h("div", { class: "pbody" }, h("div", { class: "phead" }, h("h2", {}, t("New habit"))), form(null, () => { toast(t("Habit saved.")); ctx.close(); })) });

export function habits() {
  app.primary = { label: t("Add a habit"), run: addPanel, sid: T.sid.fab("habit") };
  const all = get().habits, act = all.filter((x) => x.status === "active"), arc = all.filter((x) => x.status === "archived");
  const item = (x) => {
    const sid = T.sid.habit(x.id), on = sched(x, today());
    return h("section", { class: "card item", "data-sid": sid }, h("div", { class: "row" }, orb(x),
      h("button", { type: "button", class: "info", onclick: () => openHabit(x) },
        h("span", { class: "grow" }, h("b", {}, x.name), h("span", { class: "mu sm" }, on ? days7(x) : t("Not scheduled today"))), ic("next", 18))));
  };
  return h("div", { class: "page" },
    h("div", {}, h("p", { class: "eyebrow" }, t("Build")), h("h1", {}, t("Habits"))),
    act.length ? act.map(item) : card(null, empty("habits", t("No habits yet. Add one when you’re ready."), btn(t("Add a habit"), { sm: true, onclick: addPanel }))),
    arc.length ? card(t("Archived"), h("p", { class: "mu sm" }, t("History is kept.")), ...arc.map((x) => h("div", { class: "row" }, h("span", { class: "grow" }, x.name),
      btn(t("Restore"), { kind: "ghost", sm: true, icon: "restore", onclick: () => { x.status = "active"; commit(); toast(t("Habit restored.")); app.refresh(); } }),
      btn(t("Delete"), { kind: "danger", sm: true, icon: "trash", onclick: () => remove(x, null) })))) : null,
    null);
}

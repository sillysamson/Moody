// Dashboard (1.5): a bento grid built only from features that exist. Two columns; modules are small (s, half width), medium (m) or large (l, full width
// with more content). In edit mode the real grid is shown: drag a grip to rearrange (2-D), remove with -, resize with the size control, add from the list.
// Layout lives in prefs.dash {order, hidden, sizes}; resolveLayout()/resolveSize() make any saved layout safe (removed/new/duplicate modules, bad sizes).
import { h } from "../ui/dom.js";
import { ic } from "../ui/icons.js";
import { btn, card, empty, ring, seg, row, group, toast } from "../ui/components.js";
import { habitRow } from "./habits.js";
import { preselect, recIcon, moodIcon, moodText } from "./mood.js";
import { openEntry } from "./diary.js";
import { openDay } from "./calendar.js";
import { haptic } from "../system/haptics.js";
import { reduced } from "../system/motion.js";
import { resolveLayout, move, resolveSize, spans } from "../system/layout.js";
import { T } from "../system/tokens.js";
import { t } from "../system/i18n.js";
import { get, commit } from "../core/store.js";
import { sched, isDone, monthMarks } from "../core/logic.js";
import { today, long, short, greet, addD, dt, dn } from "../core/dates.js";
import { app, go } from "../core/app.js";

const P = () => get().prefs, to = (l, r) => btn(l, { kind: "soft", sm: true, onclick: () => go(r) });
const noMarks = { h: 0, m: 0, d: 0 };
// A small tile is one big button: the whole tile is the action.
const tile = (cls, onclick, ...kids) => h("button", { type: "button", class: "card bt tile " + cls, onclick: () => { haptic("button"); onclick(); } }, ...kids);
const tiled = (icon, title, ...kids) => [h("span", { class: "tt" }, ic(icon, 18), h("b", {}, t(title))), ...kids];

// id, title, icon, blurb (add list), sizes it supports (first = smallest), default size, render(size) -> element | null
const MODS = [
  { id: "today", title: "Today", icon: "habits", blurb: "Habit progress for today.", sizes: ["m", "l"], def: "l", render: (z) => {
    const s = get(), td = today(), hs = s.habits.filter((x) => sched(x, td)), dn_ = hs.filter((x) => isDone(x, td)).length;
    const any = s.habits.some((x) => x.status === "active"); // no habits at all vs. habits that simply aren't scheduled today: different states, different words
    return h("section", { class: "card bt hero2" }, h("div", { class: "hero" }, hs.length ? ring("home", dn_ / hs.length, `${dn_}/${hs.length}`) : null,
      h("div", { class: "grow" }, h("p", { class: "eyebrow" }, t("Today")), h("h2", {}, hs.length ? t("{n} of {m} marked", { n: dn_, m: hs.length }) : any ? t("Nothing scheduled today") : t("No habits yet")),
        h("p", { class: "mu sm" }, hs.length ? t("Habits scheduled for today.") : any ? t("Your habits will appear on the days they are scheduled.") : t("Add one when you’re ready.")), to(hs.length || any ? t("All habits") : t("Add a habit"), "habits"))),
      z === "l" && hs.length ? h("div", { class: "stack" }, hs.map(habitRow)) : null);
  } },
  { id: "mood", title: "Mood", icon: "mood", blurb: "Today’s check-ins and quick feelings.", sizes: ["s", "m"], def: "s", render: (z) => {
    const tm = get().moods.filter((m) => m.date === today()).sort((a, b) => a.ts - b.ts), last = tm[tm.length - 1];
    if (z === "s") return tile("s", () => go("mood"), ...tiled("mood", "Mood", last ? recIcon(last, 40) : h("span", { class: "tbig mu" }, "–"),
      h("span", { class: "mu sm tclamp" }, last ? moodText(last) : t("No check-in yet"))));
    return card(t("Mood"), tm.length ? h("div", { class: "row" }, tm.map((m) => recIcon(m, 36)), h("span", { class: "grow" }, t("Recorded today: {m}", { m: tm.map(moodText).join(", ") }))) : [
      h("p", { class: "mu" }, t("No mood recorded today. Check in if it feels useful.")),
      h("div", { class: "quick" }, ["Happy", "Calm", "Tired", "Anxious", "Sad"].map((m) => h("button", { type: "button", class: "face", onclick: () => { haptic("select"); preselect(m); go("mood"); } }, moodIcon(m, 38), h("span", {}, t(m)))))],
      to(tm.length ? t("Open mood") : t("Check in"), "mood"));
  } },
  { id: "diary", title: "Diary", icon: "diary", blurb: "Your latest entry.", sizes: ["s", "m"], def: "s", render: (z) => {
    const last = [...get().diary].sort((a, b) => b.updated - a.updated)[0];
    if (z === "s") return tile("s", () => (last ? openEntry(last) : go("diary")), ...tiled("diary", "Diary", h("span", { class: "tclamp" }, last ? last.title || t("Untitled") : t("Write something")), h("span", { class: "mu sm" }, last ? short(last.date) : t("Your pages will appear here when you write."))));
    return card(t("Diary"), last ? h("button", { type: "button", class: "info", "data-sid": T.sid.entry(last.id), onclick: () => openEntry(last) }, h("span", { class: "grow" }, h("b", {}, last.title || t("Untitled")), h("span", { class: "mu sm" }, short(last.date)),
      last.body ? h("span", { class: "mu sm tclamp" }, last.body) : null), ic("next", 18)) : h("p", { class: "mu" }, t("Your pages will appear here when you write.")), to(last ? t("Open diary") : t("Write something"), "diary"));
  } },
  { id: "calendar", title: "Calendar", icon: "calendar", blurb: "This week, or the whole month.", sizes: ["m", "l"], def: "m", render: (z) => {
    const td = today(), ws = P().weekStart, d0 = dt(td).getDay(), start = addD(td, -((d0 - ws + 7) % 7));
    const day = (date, k, wd) => h("button", { type: "button", class: "day" + (date === td ? " today" : ""), "data-sid": T.sid.day(date), "aria-label": `${long(date)}. ${t("{n} habits completed", { n: k.h })}, ${t("{n} moods", { n: k.m })}, ${t("{n} diary entries", { n: k.d })}`, onclick: () => openDay(date) },
      wd ? h("span", { class: "wd", "aria-hidden": "true" }, dn(dt(date).getDay()).slice(0, 2)) : null, h("b", {}, String(dt(date).getDate())),
      h("span", { class: "mks", "aria-hidden": "true" }, k.h ? h("i", { class: "mk h" }) : null, k.m ? h("i", { class: "mk m" }) : null, k.d ? h("i", { class: "mk d" }) : null));
    if (z === "l") {
      const y = +td.slice(0, 4), mo = +td.slice(5, 7) - 1, off = (new Date(y, mo, 1).getDay() - ws + 7) % 7, dim = new Date(y, mo + 1, 0).getDate(), pre = td.slice(0, 7), marks = monthMarks(pre), g = h("div", { class: "cal mini" });
      for (let i = 0; i < 7; i++) g.append(h("span", { class: "wd", "aria-hidden": "true" }, dn((ws + i) % 7).slice(0, 2)));
      for (let i = 0; i < off; i++) g.append(h("span"));
      for (let d = 1; d <= dim; d++) { const date = `${pre}-${String(d).padStart(2, "0")}`; g.append(day(date, marks[date] || noMarks, false)); }
      return card(t("Calendar"), g, to(t("Open calendar"), "calendar"));
    }
    const days = Array.from({ length: 7 }, (_, i) => addD(start, i)), marks = {};
    for (const pre of new Set(days.map((d) => d.slice(0, 7)))) Object.assign(marks, monthMarks(pre));
    return card(t("Calendar"), h("div", { class: "cal wk" }, days.map((date) => day(date, marks[date] || noMarks, true))), to(t("Open calendar"), "calendar"));
  } },
  { id: "zen", title: "Zen", icon: "play", blurb: "A short breathing pause.", sizes: ["s", "m"], def: "s", render: (z) =>
    tile(z === "s" ? "s" : "w", () => go("zen"), ...(z === "s" ? tiled("play", "Zen", h("span", { class: "mu sm" }, t("A short breathing pause"))) : [ic("play", 22), h("span", { class: "grow tcol" }, h("b", {}, t("Zen")), h("span", { class: "mu sm" }, t("A short breathing pause")))])) },
  { id: "prompt", title: "Prompt", icon: "edit", blurb: "An optional writing prompt.", sizes: ["s", "m"], def: "s", render: (z) => {
    const td = today(); if (P().pd === td) return null;
    const dismiss = btn(t("Dismiss"), { kind: "ghost", sm: true, onclick: () => { P().pd = td; commit(); app.refresh(); } });
    return card(z === "s" ? null : t("A prompt, if you want one"), z === "s" ? h("p", { class: "eyebrow" }, t("Prompt")) : null, h("p", { class: "prompt" + (z === "s" ? " tclamp" : "") }, t("What stayed with you today?")),
      h("div", { class: "acts" }, btn(t("Write about it"), { sm: true, onclick: () => go("diary/new") }), dismiss));
  } },
];
const IDS = MODS.map((m) => m.id), BY = Object.fromEntries(MODS.map((m) => [m.id, m]));
// Old 1.4 layouts hid the habit list with an option; that maps onto the smaller Today size.
const sizeOf = (id) => { const m = BY[id], d = P().dash; return resolveSize(d.sizes && d.sizes[id], m.sizes, id === "today" && d.opts && d.opts.today && d.opts.today.list === false ? "m" : m.def); };
let edit = false, live = null;
export const leave = () => { edit = false; endDrag(false); };

function save(order, hidden) {
  const d = P().dash; d.order = order; d.hidden = hidden;
  if (!commit()) { haptic("error"); toast(t("Couldn’t save. Please try again."), true); return false; } return true;
}
const setSize = (id, z) => { const d = P().dash; (d.sizes ||= {})[id] = z; commit() ? refreshFlip() : toast(t("Couldn’t save. Please try again."), true); };
const circ = (icn, label, fn, cls = "") => h("button", { type: "button", class: "icbtn " + cls, "aria-label": label, onclick: fn }, ic(icn, 20));

// FLIP: re-render, then slide every tile from where it was to where it is now (so reorder / resize / add / remove read as one continuous move).
function refreshFlip() {
  const grid = document.querySelector(".bento"), before = new Map();
  grid && [...grid.children].forEach((c) => c.dataset.mod && before.set(c.dataset.mod, c.getBoundingClientRect()));
  app.refresh();
  if (reduced()) return;
  const g = document.querySelector(".bento"); if (!g) return;
  for (const c of g.children) { const b = before.get(c.dataset.mod); if (!b) continue; const r = c.getBoundingClientRect(), dx = b.left - r.left, dy = b.top - r.top;
    if (dx || dy) c.animate([{ transform: `translate(${dx}px,${dy}px)` }, { transform: "none" }], { duration: T.dur.component, easing: T.ease }); }
}

// ---- drag to rearrange in the grid (grip only; tile bodies are inert in edit mode, so a drag can never open something) ----
function endDrag(commitIt) { const d = live; if (!d) return; live = null; d.stop(commitIt); }
function startDrag(e, item, list, scroller) {
  if (live || (e.pointerType === "mouse" && e.button !== 0)) return;
  // Capture on the grid, not on the grip: the tile (and its grip) is moved in the DOM while dragging, and a node that moves loses pointer capture.
  const handle = list, id = e.pointerId, orig = [...list.children];
  const r0 = item.getBoundingClientRect(), gx = e.clientX - r0.left, gy = e.clientY - r0.top, sc0 = scroller.scrollTop;
  let px = e.clientX, py = e.clientY, raf = 0, moved = false, blocked = null;
  handle.setPointerCapture(id); item.classList.add("lifting"); haptic("select");
  const place = () => {
    const L = list.getBoundingClientRect(), sibs = [...list.children].filter((c) => c !== item);
    // Swap with the tile under the finger. Hysteresis: after a swap that tile is ignored until the finger leaves it, otherwise tiles of different sizes flip back and forth.
    const over = sibs.find((c) => { const r = c.getBoundingClientRect(); return px >= r.left && px <= r.right && py >= r.top && py <= r.bottom; });
    if (blocked && blocked !== over) blocked = null;
    if (over && over !== blocked) {
      const before = new Map(sibs.map((c) => [c, c.getBoundingClientRect()])), all = [...list.children], from = all.indexOf(item), at = all.indexOf(over);
      list.insertBefore(item, from < at ? over.nextSibling : over); blocked = over; haptic("select");
      if (!reduced()) for (const c of sibs) { const b = before.get(c), n = c.getBoundingClientRect(), dx = b.left - n.left, dy = b.top - n.top; if (dx || dy) c.animate([{ transform: `translate(${dx}px,${dy}px)` }, { transform: "none" }], { duration: T.dur.component, easing: T.ease }); }
    }
    item.style.transform = "none"; const base = item.getBoundingClientRect(); // layout slot (no transform)
    item.style.transform = `translate(${px - gx - base.left}px,${py - gy - base.top}px)`; // 1:1 with the finger
  };
  const tick = () => { // edge auto-scroll near the top/bottom of the scroller
    const r = scroller.getBoundingClientRect(), z = 64; let v = 0;
    if (py < r.top + z) v = -Math.ceil(((r.top + z - py) / z) * 14); else if (py > r.bottom - z) v = Math.ceil(((py - (r.bottom - z)) / z) * 14);
    if (v) { scroller.scrollTop += v; place(); } raf = requestAnimationFrame(tick);
  };
  const move_ = (ev) => { if (ev.pointerId !== id) return; px = ev.clientX; py = ev.clientY; if (!moved && Math.hypot(px - e.clientX, py - e.clientY) < 3) return; moved = true; place(); };
  const stop = (ok) => {
    cancelAnimationFrame(raf); handle.removeEventListener("pointermove", move_); for (const n of ["pointerup", "pointercancel", "lostpointercapture"]) handle.removeEventListener(n, up);
    try { handle.releasePointerCapture(id); } catch {}
    const was = item.style.transform, from = item.getBoundingClientRect(); item.classList.remove("lifting"); item.style.transform = "";
    if (!ok) orig.forEach((c) => list.append(c)); // cancelled: put everything back, save nothing
    else if (moved && !reduced()) { const to_ = item.getBoundingClientRect(); item.animate([{ transform: `translate(${from.left - to_.left}px,${from.top - to_.top}px)` }, { transform: "none" }], { duration: T.dur.component, easing: T.ease }); }
    if (ok && moved) { const order = [...list.children].map((c) => c.dataset.mod), lay = resolveLayout(P().dash, IDS); if (order.join() !== lay.order.join() && save(order, lay.hidden)) haptic("button"); }
  };
  const up = (ev) => { if (ev.pointerId === id && live) { const ok = ev.type === "pointerup"; live = null; stop(ok); } };
  live = { stop };
  handle.addEventListener("pointermove", move_); for (const n of ["pointerup", "pointercancel", "lostpointercapture"]) handle.addEventListener(n, up);
  raf = requestAnimationFrame(tick);
}

function editItem(id, i, order, list) {
  const m = BY[id], z = sizeOf(id), body = m.render(z);
  const handle = circ("grip", t("Reorder {m}. Use the arrow keys, or drag.", { m: t(m.title) }), undefined, "grip");
  handle.addEventListener("pointerdown", (e) => startDrag(e, handle.closest(".dm"), list, document.getElementById("view")));
  handle.addEventListener("keydown", (e) => {
    const d = { ArrowUp: -1, ArrowLeft: -1, ArrowDown: 1, ArrowRight: 1 }[e.key]; if (!d) return; e.preventDefault();
    const j = Math.max(0, Math.min(order.length - 1, i + d)); if (j === i) return;
    if (save(move(order, i, j), resolveLayout(P().dash, IDS).hidden)) { haptic("select"); refreshFlip(); requestAnimationFrame(() => { const b = document.querySelector(`.dm[data-mod="${id}"] .grip`); b && b.focus(); }); }
  });
  const sizeLab = { s: t("Small"), m: t("Medium"), l: t("Large") };
  return h("section", { class: "card dm", "data-mod": id },
    h("div", { class: "dm-h" }, handle, h("b", { class: "grow" }, t(m.title)), circ("minus", t("Remove {m} from the dashboard", { m: t(m.title) }), () => { haptic("button"); save(order.filter((x) => x !== id), [...resolveLayout(P().dash, IDS).hidden, id]) && refreshFlip(); })),
    h("div", { class: "dm-b", inert: true }, body || h("p", { class: "mu sm" }, t("Hidden for today after you dismissed it."))),
    m.sizes.length > 1 ? seg(m.sizes.map((s) => [s, sizeLab[s]]), z, (v) => setSize(id, v), t("Size of {m}", { m: t(m.title) })) : null);
}
const layout = (els, ids) => { const sp = spans(ids.map(sizeOf)); return els.map((el, i) => (el.dataset.mod = ids[i], el.classList.add(sp[i] === 1 ? "c1" : "c2"), el)); };

export function dashboard() {
  const lay = resolveLayout(P().dash, IDS), td = today(), head = h("div", { class: "top" }, h("div", {}, h("p", { class: "eyebrow" }, long(td)), h("h1", {}, greet() + ".")),
    edit ? btn(t("Done"), { sm: true, icon: "check", onclick: () => { edit = false; haptic("success"); app.refresh(); } })
      : circ("layout", t("Customize dashboard"), () => { edit = true; haptic("button"); app.refresh(); }, "quiet"));
  if (!edit) {
    const rendered = lay.order.map((id) => [id, BY[id].render(sizeOf(id))]).filter((x) => x[1]), ids = rendered.map((x) => x[0]);
    return h("div", { class: "page" }, head, rendered.length ? h("div", { class: "bento" }, layout(rendered.map((x) => x[1]), ids))
      : card(null, empty("layout", t("Your dashboard is empty. Customize it to add modules."), btn(t("Customize"), { sm: true, onclick: () => { edit = true; app.refresh(); } }))));
  }
  const list = h("div", { class: "bento dlist" });
  const els = lay.order.map((id, i) => editItem(id, i, lay.order, list)); list.append(...layout(els, lay.order));
  const add = lay.hidden.map((id) => row({ icon: BY[id].icon, title: t(BY[id].title), sub: t(BY[id].blurb), end: ic("plus", 20), onclick: () => { save([...lay.order, id], lay.hidden.filter((x) => x !== id)) && refreshFlip(); } }));
  return h("div", { class: "page editing" }, head, h("p", { class: "mu sm pad" }, t("Drag the handle to rearrange. Tap − to remove a module, or pick a size. Nothing opens while you are customizing.")),
    list, add.length ? group(t("Add to dashboard"), ...add) : h("p", { class: "mu sm pad" }, t("Every module is on your dashboard.")));
}

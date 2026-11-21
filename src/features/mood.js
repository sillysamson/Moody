import { h } from "../ui/dom.js";
import { face, MOODS, ic } from "../ui/icons.js";
import { btn, card, empty, toast, confirmBox, seg } from "../ui/components.js";
import { openPanel } from "../system/shared.js";
import { spring, enter } from "../system/motion.js";
import { SCALE, STEPS, labelOf, valueOf, tOf, flowerParams, flowerSVG, flowerEl } from "../system/moodscale.js";
import { haptic } from "../system/haptics.js";
import { T } from "../system/tokens.js";
import { t } from "../system/i18n.js";
import { get, commit, uid } from "../core/store.js";
import { today, ago, short, clock } from "../core/dates.js";
import { app } from "../core/app.js";

const IL = () => [t("A little"), t("Mild"), t("Moderate"), t("Strong"), t("Very strong")];

// ---- emotions (stage B). Grouped by where the person is on the scale; "core" shows first, "more" sits behind an expander. ----
export const EMO = {
  low: { core: ["Anxious", "Stressed", "Sad", "Angry", "Lonely", "Overwhelmed", "Tired", "Frustrated"], more: ["Disappointed", "Worried", "Irritated", "Discouraged", "Ashamed", "Drained", "Restless", "Mixed", "Not sure"] },
  mid: { core: ["Calm", "Content", "Tired", "Mixed", "Not sure", "Restless", "Indifferent", "Surprised"], more: ["Bored", "Thoughtful", "Hopeful", "Grateful", "Anxious", "Sad"] },
  high: { core: ["Happy", "Calm", "Content", "Grateful", "Hopeful", "Excited", "Joyful", "Proud"], more: ["Peaceful", "Relieved", "Amused", "Confident", "Inspired", "Passionate", "Optimistic", "Surprised"] },
};
export const groupOf = (v) => (!v ? "mid" : v <= 3 ? "low" : v === 4 ? "mid" : "high");
// A record's emotions: the named ones (1.5 allows several), else the single feeling/scale label older records hold.
export const emos = (m) => (Array.isArray(m.feels) && m.feels.length ? m.feels : [m.mood]);
export const moodText = (m) => emos(m).map((x) => t(x)).join(", ");

// F = the check-in being made. t = continuous position 0..1 (null = untouched), v = its scale step 1..7 (what is saved), feels = chosen emotions.
const F = { t: null, v: null, feels: [], i: 0, note: "", id: null, open: false };
const reset = () => Object.assign(F, { t: null, v: null, feels: [], i: 0, note: "", id: null, open: false });
export const preselect = (m) => { reset(); F.feels = [m]; F.open = true; }; // dashboard quick feeling: opens the check-in with this emotion chosen
const cb = () => !!get().prefs.cb;
const avgT = (label) => { const l = get().moods.filter((x) => x.v && emos(x).includes(label)); return l.length ? l.reduce((a, x) => a + tOf(x.v), 0) / l.length : 0.5; };
// A scale label or a record with a scale value draws as a flower; a named feeling with a face draws as that face; any other emotion as the flower of its usual tone.
export const moodIcon = (label, size = 40) => { const v = valueOf(label); return v ? flowerEl(tOf(v), size, { cb: cb() }) : MOODS[label] ? face(label, size) : flowerEl(avgT(label), size, { cb: cb() }); };
export const recIcon = (m, size = 40) => (m.v ? flowerEl(tOf(m.v), size, { cb: cb() }) : moodIcon(m.mood, size));
const recTitle = (m) => moodText(m) + (m.v && !emos(m).includes(labelOf(m.v)) ? " · " + t(labelOf(m.v)) : "");

function submit(ctx) {
  const a = get().moods, v = { mood: F.feels[0] || labelOf(F.v), v: F.v || null, feels: [...F.feels], intensity: F.i || null, note: F.note.trim() };
  if (F.id) Object.assign(a.find((x) => x.id === F.id), v); else a.push({ id: uid(), ts: Date.now(), date: today(), ...v });
  if (commit()) { haptic("success"); toast(t("Saved.")); reset(); ctx.close(); } else { haptic("error"); toast(t("Couldn’t save. Your note is still here; try again."), true); }
}

const report = (m) => () => {
  const all = get().moods.filter((x) => emos(x).includes(m)).sort((a, b) => b.ts - a.ts), rec = all.filter((x) => x.date >= ago(29)), L = IL();
  const dist = [1, 2, 3, 4, 5].map((i) => all.filter((x) => x.intensity === i).length), mx = Math.max(1, ...dist);
  return h("div", { class: "pbody" },
    h("div", { class: "phead" }, moodIcon(m, 56), h("div", { class: "grow" }, h("h2", {}, t(m)), h("p", { class: "mu sm" }, t("{n} check-ins · {k} in the last 30 days", { n: all.length, k: rec.length })))),
    h("h3", {}, t("Strength you chose")),
    dist.some(Boolean) ? h("div", { class: "bars" }, dist.map((c, i) => h("div", { class: "brow" }, h("span", { class: "mu sm" }, L[i]), h("span", { class: "bar2" }, h("i", { style: `width:${(c / mx) * 100}%` })), h("b", {}, String(c))))) : h("p", { class: "mu sm" }, t("No strength recorded for this mood.")),
    h("h3", {}, t("Recent check-ins")),
    h("div", { class: "stack" }, all.slice(0, 10).map((x) => h("div", { class: "mini" }, h("b", {}, `${short(x.date)}, ${clock(x.ts)}`), x.note ? h("p", { class: "mu" }, x.note) : null))),
    h("p", { class: "mu sm" }, t("These are counts of your own check-ins. They are not a measure of health.")));
};

// ---- stage A: the flower (focal point) and a continuous slider. t -> step -> label -> flower all derive from F.t, so they can never disagree. ----
const STEP = 1 / (STEPS - 1);
function scaleSlider(onChange) {
  const flower = h("div", { class: "ckflower", "aria-hidden": "true" }), halo = h("div", { class: "ckhalo", "aria-hidden": "true" }), label = h("p", { class: "mlabel", "aria-live": "polite" });
  const thumb = h("i", { class: "sthumb" }), rail = h("i", { class: "srail" });
  const track = h("div", { class: "strack", role: "slider", tabindex: "0", "aria-label": t("Mood, from very unpleasant to very pleasant"), "aria-valuemin": "0", "aria-valuemax": "100" }, rail, thumb);
  rail.style.background = `linear-gradient(90deg,${[0, 0.5, 1].map((x) => flowerParams(x, { cb: cb() }).pet).join(",")})`;
  let ctl = null, drag = null;
  const paint = () => {
    const x = F.t === null ? 0.5 : F.t, p = flowerParams(x, { cb: cb() });
    flower.innerHTML = flowerSVG(x, { cb: cb(), muted: F.t === null }); halo.style.setProperty("--hc", F.t === null ? "var(--mu)" : p.pet);
    track.style.setProperty("--x", String(x)); track.classList.toggle("set", F.t !== null); thumb.style.background = p.pet;
    label.textContent = F.v ? t(labelOf(F.v)) : t("Slide or tap to choose");
    if (F.t !== null) { track.setAttribute("aria-valuenow", String(Math.round(x * 100))); track.setAttribute("aria-valuetext", t(labelOf(F.v))); } else { track.removeAttribute("aria-valuenow"); track.setAttribute("aria-valuetext", t("Nothing chosen yet")); }
  };
  // The scale step only changes once the thumb is clearly past a boundary, so it cannot chatter (or buzz the haptic) at an edge.
  const setT = (x) => {
    F.t = Math.min(1, Math.max(0, x));
    const nv = F.v && Math.abs(F.t - tOf(F.v)) < STEP / 2 + 0.025 ? F.v : 1 + Math.round(F.t * (STEPS - 1));
    if (nv !== F.v) { F.v = nv; haptic("slider"); }
    paint(); onChange();
  };
  const at = (e) => { const r = track.getBoundingClientRect(), pad = 18; return Math.min(1, Math.max(0, (e.clientX - r.left - pad) / Math.max(1, r.width - pad * 2))); };
  track.addEventListener("pointerdown", (e) => {
    if (drag !== null) return; drag = { id: e.pointerId, x0: e.clientX }; track.setPointerCapture(e.pointerId); track.classList.add("on"); ctl && ctl.stop();
    const x = at(e), from = F.t === null ? 0.5 : F.t;
    if (F.t === null || Math.abs(x - from) > 0.12) { drag.glide = true; ctl = spring({ from, to: x, v: 0, ...T.spring.sheet }, setT, () => { if (drag) drag.glide = false; }); } // a tap far from the thumb glides there; a grab on the thumb tracks 1:1
    else setT(x);
  });
  track.addEventListener("pointermove", (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    if (drag.glide) { if (Math.abs(e.clientX - drag.x0) < 6) return; ctl && ctl.stop(); drag.glide = false; } // the finger moved on: stop gliding, follow it exactly
    setT(at(e));
  });
  const end = (e) => { if (!drag || e.pointerId !== drag.id) return; drag = null; track.classList.remove("on"); };
  for (const ev of ["pointerup", "pointercancel", "lostpointercapture"]) track.addEventListener(ev, end);
  track.addEventListener("keydown", (e) => {
    const d = { ArrowLeft: -0.05, ArrowDown: -0.05, ArrowRight: 0.05, ArrowUp: 0.05, PageDown: -STEP, PageUp: STEP }[e.key];
    if (e.key === "Home") { e.preventDefault(); setT(0); } else if (e.key === "End") { e.preventDefault(); setT(1); } else if (d) { e.preventDefault(); setT((F.t === null ? 0.5 : F.t) + d); }
  });
  paint();
  return h("div", { class: "ckdial" }, h("div", { class: "ckstage" }, halo, flower), label, track, h("div", { class: "mends", "aria-hidden": "true" }, h("span", {}, t(SCALE[0])), h("span", {}, t(SCALE[STEPS - 1]))));
}

// ---- the check-in sheet: two stages, state kept in F so going Back never loses a choice ----
function openCheckin(rec) {
  if (rec) Object.assign(F, { id: rec.id, v: rec.v || null, t: rec.v ? tOf(rec.v) : null, feels: [...(Array.isArray(rec.feels) && rec.feels.length ? rec.feels : valueOf(rec.mood) ? [] : [rec.mood])], i: rec.intensity || 0, note: rec.note || "" });
  let stage = 0;
  openPanel({ sid: T.sid.fab("mood"), mode: "full", label: F.id ? t("Edit check-in") : t("New check-in"), onClose: reset, render: (ctx) => {
    const body = h("div", { class: "ckb" }), foot = h("div", { class: "ckf" }), dots = h("span", { class: "ckdots", role: "img" });
    let more = false, det = false;
    const ready = () => !!(F.v || F.feels.length);
    const go_ = (n) => { const dir = n > stage ? 1 : -1; stage = n; draw(dir); };
    const next = btn(t("Next"), { icon: "next", onclick: () => ready() && go_(1) });
    const stageA = () => h("div", { class: "ckst" }, h("h2", { tabindex: "-1" }, F.id ? t("Edit check-in") : t("How are you feeling?")), h("p", { class: "mu sm" }, t("Slide to where it sits for you right now.")), scaleSlider(() => (next.disabled = !ready())));
    const stageB = () => {
      const g = EMO[groupOf(F.v)], extra = F.feels.filter((x) => !g.core.includes(x) && !g.more.includes(x)), chips = h("div", { class: "chips", role: "group", "aria-label": t("Feeling") }), exp = h("button", { type: "button", class: "chip more", "aria-expanded": "false" });
      const show = () => {
        const all = [...g.core, ...(more || F.feels.some((x) => g.more.includes(x)) ? g.more : []), ...extra];
        chips.replaceChildren(...all.map((m) => h("button", { type: "button", class: "chip" + (F.feels.includes(m) ? " on" : ""), "aria-pressed": String(F.feels.includes(m)),
          onclick: (e) => { F.feels = F.feels.includes(m) ? F.feels.filter((x) => x !== m) : [...F.feels, m]; e.currentTarget.classList.toggle("on"); e.currentTarget.setAttribute("aria-pressed", String(F.feels.includes(m))); haptic("select"); } }, t(m))));
        const open = more || F.feels.some((x) => g.more.includes(x)); exp.setAttribute("aria-expanded", String(open)); exp.replaceChildren(ic("chevron", 16), t(open ? "Fewer emotions" : "More emotions")); exp.classList.toggle("open", open);
      };
      exp.addEventListener("click", () => { more = !more && !F.feels.some((x) => g.more.includes(x)) ? true : false; haptic("select"); show(); });
      show();
      const dbtn = h("button", { type: "button", class: "chip more", "aria-expanded": String(det) }, ic("chevron", 16), t("Add a note or strength")), dbox = h("div", { class: "form", hidden: !det },
        h("p", { class: "mu sm" }, t("How strong? Optional, your own rating.")), seg([[0, "–"], [1, "1"], [2, "2"], [3, "3"], [4, "4"], [5, "5"]], F.i, (v) => { F.i = v; }, t("Intensity")),
        h("label", { class: "mu sm", for: "mn" }, t("Note (optional)")), h("textarea", { id: "mn", rows: "3", oninput: (e) => (F.note = e.target.value) }, F.note));
      if (F.note || F.i) { det = true; dbox.hidden = false; dbtn.setAttribute("aria-expanded", "true"); dbtn.classList.add("open"); }
      dbtn.addEventListener("click", () => { det = !det; dbox.hidden = !det; dbtn.setAttribute("aria-expanded", String(det)); dbtn.classList.toggle("open", det); haptic("select"); });
      return h("div", { class: "ckst" }, h("h2", { tabindex: "-1" }, t("What describes this feeling best?")),
        F.v ? h("div", { class: "ckcat" }, flowerEl(tOf(F.v), 28, { cb: cb() }), h("b", {}, t(labelOf(F.v)))) : null, h("p", { class: "mu sm" }, t("Choose as many as fit. You can also choose none.")), chips, exp, dbtn, dbox);
    };
    const draw = (dir = 0) => {
      const el = stage ? stageB() : stageA(); body.replaceChildren(el); dir && enter(el, dir); el.querySelector("h2").focus({ preventScroll: true });
      dots.replaceChildren(h("i", { class: stage === 0 ? "on" : "" }), h("i", { class: stage === 1 ? "on" : "" })); dots.setAttribute("aria-label", t("Step {n} of 2", { n: stage + 1 }));
      next.disabled = !ready(); foot.replaceChildren(...(stage ? [btn(t("Back"), { kind: "ghost", icon: "back", onclick: () => go_(0) }), btn(F.id ? t("Save changes") : t("Save check-in"), { icon: "check", onclick: () => submit(ctx) })] : [next]));
    };
    const root = h("div", { class: "ck" }, h("div", { class: "ckh" }, h("button", { type: "button", class: "icbtn", "aria-label": t("Close"), onclick: () => { haptic("button"); ctx.close(); } }, ic("close")), dots, h("span", { class: "ckh2" })), body, foot);
    draw(0); return root;
  } });
}

export function mood(arg) {
  if (arg === "new") { reset(); F.open = true; }
  const s = get(), hist = [...s.moods].sort((a, b) => b.ts - a.ts), L = IL();
  const rec = s.moods.filter((m) => m.date >= ago(29)), days = new Set(rec.map((m) => m.date)), cn = {};
  s.moods.forEach((m) => new Set(emos(m)).forEach((e) => (cn[e] = (cn[e] || 0) + 1)));
  const r30 = {}; rec.forEach((m) => new Set(emos(m)).forEach((e) => (r30[e] = (r30[e] || 0) + 1)));
  const top = Object.entries(r30).sort((a, b) => b[1] - a[1])[0], tm = s.moods.filter((m) => m.date === today()).sort((a, b) => a.ts - b.ts), tiles = Object.entries(cn).sort((a, b) => b[1] - a[1]);
  app.primary = { label: t("New check-in"), run: () => { reset(); openCheckin(); }, sid: T.sid.fab("mood") };
  if (F.open) { F.open = false; requestAnimationFrame(() => openCheckin()); }
  return h("div", { class: "page" },
    h("div", {}, h("p", { class: "eyebrow" }, t("Understand")), h("h1", {}, t("Mood"))),
    card(t("How are you feeling?"), tm.length ? h("div", { class: "row" }, tm.map((m) => recIcon(m, 36)), h("span", { class: "grow" }, t("Recorded today: {m}", { m: tm.map(moodText).join(", ") }))) : h("p", { class: "mu" }, t("No mood recorded today. Check in if it feels useful.")),
      h("div", { class: "acts" }, btn(t("Check in"), { icon: "plus", onclick: () => { reset(); openCheckin(); } }))),
    tiles.length ? card(t("Your moods"), h("p", { class: "mu sm" }, t("Tap a mood to see its report.")),
      h("div", { class: "tiles3" }, tiles.map(([m, n]) => h("button", { type: "button", class: "mtile", "data-sid": T.sid.mood(m), onclick: () => { haptic("select"); openPanel({ sid: T.sid.mood(m), mode: "full", label: t(m), render: report(m) }); } },
        moodIcon(m, 40), h("b", {}, t(m)), h("span", { class: "mu sm" }, String(n))))),
      h("p", { class: "mu sm" }, t("In the last 30 days, you recorded a mood on {n} days.", { n: days.size }) + (top && rec.length >= 5 ? " " + t("Most recorded: {m} ({p}% of {c} check-ins).", { m: t(top[0]), p: Math.round((top[1] / rec.length) * 100), c: rec.length }) : ""))) :
      card(null, empty("mood", t("No check-in recorded yet. Insights appear as you build history. Nothing to interpret yet."))),
    hist.length ? h("h2", { class: "sec" }, t("History")) : null,
    hist.map((m) => card(null, h("div", { class: "row top-row" }, recIcon(m, 40),
      h("div", { class: "grow" }, h("b", {}, recTitle(m) + (m.intensity ? " · " + L[m.intensity - 1] : "")), h("p", { class: "mu sm" }, `${short(m.date)}, ${clock(m.ts)}`))),
      m.note ? h("p", { class: "note sel" }, m.note) : null,
      h("div", { class: "acts" },
        btn(t("Edit"), { kind: "ghost", sm: true, icon: "edit", onclick: () => { reset(); openCheckin(m); } }),
        btn(t("Delete"), { kind: "danger", sm: true, icon: "trash", onclick: async () => {
          if (await confirmBox({ title: t("Delete this check-in?"), body: t("This can’t be undone."), ok: t("Delete check-in"), keep: t("Keep it"), danger: true })) {
            s.moods = s.moods.filter((x) => x.id !== m.id);
            commit() ? toast(t("Check-in deleted.")) : toast(t("Couldn’t save. Please try again."), true); app.refresh();
          } } })))));
}

import { h } from "../ui/dom.js";
import { ic } from "../ui/icons.js";
import { btn, toast, confirmBox, sw, seg, slider, pick, timeInput, textDialog, row, group, backBar } from "../ui/components.js";
import { openPanel } from "../system/shared.js";
import { haptic, hapticMode } from "../system/haptics.js";
import { P, setPref, applyFont, apply } from "../system/prefs.js";
import { PRESETS, swatch, hasWallpaper } from "../system/palette.js";
import { isNative, canAuth, authenticate, setSecure, openNotificationSettings } from "../system/native.js";
import { BGS, BLUR, loadPhoto, savePhoto, removePhoto, readPhoto, paint } from "../ui/background.js";
import { supported, permission, syncSoon } from "../system/notify.js";
import { shareBackup, copyText } from "../system/share.js";
import { toJSON, validate, sizes, fmtBytes } from "../system/backup.js";
import { T } from "../system/tokens.js";
import { t, LANGS } from "../system/i18n.js";
import { get, wipe, setData } from "../core/store.js";
import { today, short } from "../core/dates.js";
import { app } from "../core/app.js";

const val = (path) => path.split(".").reduce((o, k) => o[k], P());
const set = (path, v, ctx, re = true) => { if (!setPref(path, v)) { toast(t("Couldn’t save. Please try again."), true); haptic("error"); } syncSoon(); if (re && ctx) ctx.update(); };
const prow = (ctx, title, opts, path, o = {}) => row({ title, sub: o.sub, dim: o.dim, end: h("span", { class: "val" }, (opts.find((x) => x[0] === val(path)) || [0, ""])[1], ic("next", 16)),
  onclick: o.dim ? null : async () => { const v = await pick({ title, options: opts, value: val(path) }); if (v === undefined) return; set(path, v, ctx); o.after && o.after(v); } });
const trow = (ctx, title, path, dim) => row({ title, dim, end: timeInput(val(path), (v) => set(path, v, ctx, false), title, dim) });
const phead = (title) => h("div", { class: "phead" }, h("h2", {}, title));
const bodyOf = (title, ...kids) => h("div", { class: "pbody" }, phead(title), ...kids);

const general = (ctx) => bodyOf(t("General"), group(null,
  prow(ctx, t("Language"), LANGS, "lang", { after: () => app.refresh() }),
  prow(ctx, t("Date format"), [["system", t("System")], ["dmy", "DD/MM/YYYY"], ["mdy", "MM/DD/YYYY"], ["ymd", "YYYY-MM-DD"]], "dateFmt", { sub: short(today()) }),
  row({ title: t("Time format"), end: seg([["system", t("System")], ["12", "12h"], ["24", "24h"]], P().timeFmt, (v) => set("timeFmt", v, ctx, false), t("Time format")) }),
  prow(ctx, t("Open the app on"), [["home", t("Dashboard")], ["habits", t("Habits")], ["mood", t("Mood")], ["diary", t("Diary")], ["calendar", t("Calendar")]], "start"),
  row({ title: t("Week starts on"), end: seg([[1, t("Mon")], [0, t("Sun")]], P().weekStart, (v) => set("weekStart", v, ctx, false), t("Week starts on")) })));

const notifications = (ctx) => {
  const n = P().notif, off = !n.on || !supported, q = n.quiet;
  const master = async (v) => {
    if (v) {
      if (!supported) { toast(t("Reminders need the Android app."), true); haptic("error"); return ctx.update(); }
      if (!(await permission())) { toast(t("Notifications are blocked. Turn them on in system settings."), true); haptic("error"); return ctx.update(); }
    }
    set("notif.on", v, ctx);
  };
  const quietSet = (path, other) => (v) => { if (v === other) { toast(t("Start and end times must differ."), true); haptic("error"); ctx.update(); return; } set(path, v, ctx, false); };
  return bodyOf(t("Notifications"),
    !supported ? h("p", { class: "mu sm pad" }, t("Reminders need the Android app. They can’t be scheduled in a browser.")) : null,
    group(null, row({ title: t("Enable notifications"), end: sw(n.on && supported, master, t("Enable notifications"), { disabled: !supported }) })),
    group(t("Reminders"),
      row({ title: t("Daily check-in"), dim: off, end: sw(n.checkin.on, (v) => set("notif.checkin.on", v, ctx), t("Daily check-in"), { disabled: off }) }),
      n.checkin.on ? trow(ctx, t("Check-in time"), "notif.checkin.time", off) : null,
      row({ title: t("Mood reminder"), dim: off, end: sw(n.mood.on, (v) => set("notif.mood.on", v, ctx), t("Mood reminder"), { disabled: off }) }),
      n.mood.on ? trow(ctx, t("Mood reminder time"), "notif.mood.time", off) : null,
      prow(ctx, t("Habit reminders"), [["off", t("Off")], ["day", t("On scheduled day")], ["before", t("One day before")], ["until", t("Every day until completed")]], "notif.habit.freq", { dim: off }),
      n.habit.freq !== "off" ? trow(ctx, t("Habit reminder time"), "notif.habit.time", off) : null),
    isNative ? group(t("Alerts"), row({ icon: "bell", title: t("Sound and vibration"), sub: t("Set separately for habits, mood and check-in in Android’s notification settings."), dim: off, onclick: () => { haptic("button"); openNotificationSettings(); }, end: ic("next", 16) })) : null,
    group(t("Quiet hours"),
      row({ title: t("Quiet hours"), sub: t("Reminders in this window are skipped."), dim: off, end: sw(q.on, (v) => set("notif.quiet.on", v, ctx), t("Quiet hours"), { disabled: off }) }),
      q.on ? row({ title: t("From"), dim: off, end: timeInput(q.from, quietSet("notif.quiet.from", q.to), t("Quiet hours start"), off) }) : null,
      q.on ? row({ title: t("Until"), dim: off, end: timeInput(q.to, quietSet("notif.quiet.to", q.from), t("Quiet hours end"), off) }) : null),
    h("p", { class: "mu sm pad" }, t("Reminders use generic text and are scheduled on this device. They refresh whenever you open the app.")));
};

// ---- accent colour: presets + a custom hue/vividness. Applies live (the app itself is the preview); the palette derives every surface and keeps text readable. ----
const ACC = { wallpaper: "Wallpaper colours", moss: "Moss", terracotta: "Terracotta", rose: "Rose", ochre: "Ochre", teal: "Teal", ocean: "Ocean", lavender: "Lavender", graphite: "Graphite" };
const accentRow = (ctx) => {
  const a = P().accent, on = (id) => a.id === id, wrap = h("div", { class: "swatches", role: "radiogroup", "aria-label": t("Accent colour") });
  const pickA = (id) => { if (a.id === id) return; haptic("select"); set("accent", { ...a, id }, ctx); };
  PRESETS.forEach((p) => wrap.append(h("button", { type: "button", role: "radio", class: "swt" + (on(p.id) ? " on" : ""), "aria-checked": String(on(p.id)), "aria-label": t(ACC[p.id]), style: `--sw:light-dark(${swatch({ id: p.id }, false)},${swatch({ id: p.id }, true)})`, onclick: () => pickA(p.id) }, on(p.id) ? ic("check", 18) : null)));
  if (hasWallpaper()) wrap.append(h("button", { type: "button", role: "radio", class: "swt" + (on("wallpaper") ? " on" : ""), "aria-checked": String(on("wallpaper")), "aria-label": t("Wallpaper colours"), style: `--sw:light-dark(${swatch({ id: "wallpaper" }, false)},${swatch({ id: "wallpaper" }, true)})`, onclick: () => pickA("wallpaper") }, on("wallpaper") ? ic("check", 18) : null));
  wrap.append(h("button", { type: "button", role: "radio", class: "swt custom" + (on("custom") ? " on" : ""), "aria-checked": String(on("custom")), "aria-label": t("Custom colour"), onclick: () => pickA("custom") }, on("custom") ? ic("check", 18) : null));
  const live = (k) => (v) => { P().accent[k] = k === "c" ? v / 100 : v; apply(); }; // while dragging: apply only; saved on release
  return [row({ title: t("Accent colour"), sub: on("custom") ? t("Custom colour") : t(ACC[a.id] || "Moss"), wide: true, end: wrap }),
    on("custom") ? row({ title: t("Hue"), wide: true, end: h("div", { class: "hue", dir: "ltr" }, slider({ min: 0, max: 360, step: 1, value: Math.round(a.h), fmt: (v) => v + "°", label: t("Hue"), onInput: live("h"), onCommit: () => set("accent", { ...P().accent }, ctx, false) })) }) : null,
    on("custom") ? row({ title: t("Vividness"), wide: true, end: slider({ min: 2, max: 14, step: 1, value: Math.round(a.c * 100), fmt: (v) => v + "%", label: t("Vividness"), onInput: live("c"), onCommit: () => set("accent", { ...P().accent }, ctx, false) }) }) : null];
};

// ---- background: choose, see it in a preview frame (with a mock card and nav pill), then Apply. Nothing changes until Apply. ----
const bgName = (id) => t((BGS.find((b) => b[0] === id) || BGS[0])[1]);
function openBg() {
  const cur = P().bg || {}, sel = { id: BGS.some((b) => b[0] === cur.id) ? cur.id : "aura", blur: Number.isFinite(cur.blur) ? cur.blur : 14 };
  let pending = null; const photoNow = () => pending || loadPhoto();
  openPanel({ sid: T.sid.set("bg"), mode: "full", label: t("Background"), render: (pctx) => {
    const prev = h("div", { class: "bgl" }), frame = h("div", { class: "bgprev", role: "img", "aria-label": t("Preview of the background") }, prev,
      h("div", { class: "mock" }, h("div", { class: "mcard" }, h("h3", {}, t("Today")), h("p", { class: "mu sm" }, t("Habits scheduled for today."))), h("p", { class: "mu sm pad" }, t("Text sits directly on the background here."))), h("div", { class: "mpill glass" }));
    const opts = h("div", { class: "bgopts", role: "radiogroup", "aria-label": t("Background") }), photoBox = h("div", { class: "form" }), apply_ = btn(t("Apply"), { icon: "check" });
    const ok = () => sel.id !== "photo" || !!photoNow();
    const refresh = () => {
      paint(prev, sel, photoNow()); apply_.disabled = !ok();
      if (pthumb) { paint(pthumb, { id: "photo", blur: 10 }, photoNow()); pnone.hidden = !!photoNow(); } // the thumbnail shows the chosen photo
      opts.querySelectorAll(".bgopt").forEach((b) => { const on = b.dataset.id === sel.id; b.setAttribute("aria-pressed", String(on)); });
      photoBox.hidden = sel.id !== "photo"; if (sel.id !== "photo") return;
      const ph = photoNow();
      photoBox.replaceChildren(
        h("div", { class: "acts" }, btn(ph ? t("Choose another photo") : t("Choose a photo"), { kind: "soft", sm: true, icon: "upload", onclick: choose }), ph ? btn(t("Remove photo"), { kind: "ghost", sm: true, icon: "trash", onclick: () => { pending = null; removePhoto(); haptic("warning"); refresh(); } }) : null),
        ph ? h("div", { class: "sgroup" }, h("label", { class: "mu sm", for: "bgb" }, t("Blur")), slider({ min: BLUR.min, max: BLUR.max, step: 1, value: sel.blur, fmt: (v) => v + " px", label: t("Blur"), onInput: (v) => { sel.blur = v; prev.style.setProperty("--bgblur", v + "px"); } })) : h("p", { class: "mu sm" }, t("Pick a photo from your device. It stays on this device, and is made soft and light enough that text stays readable.")));
    };
    function choose() {
      const i = h("input", { type: "file", accept: "image/*", style: "display:none" });
      i.onchange = async () => { const f = i.files[0]; i.remove(); if (!f) return; try { pending = await readPhoto(f); haptic("select"); refresh(); } catch { haptic("error"); toast(t("That image couldn’t be opened."), true); } };
      document.body.append(i); i.click();
    }
    let pthumb = null, pnone = null;
    BGS.forEach(([id, name]) => { const th = h("div", { class: "bgthumb" }), el = h("div", { class: "bgl" }); th.append(el); paint(el, { id, blur: 10 }, id === "photo" ? photoNow() : null);
      if (id === "photo") { pthumb = el; pnone = h("span", { class: "none" }, ic("upload", 22)); pnone.hidden = !!photoNow(); th.append(pnone); }
      opts.append(h("button", { type: "button", class: "bgopt", "data-id": id, "aria-pressed": "false", onclick: () => { if (sel.id === id) return; sel.id = id; haptic("select"); refresh(); } }, th, h("span", {}, t(name)))); });
    apply_.onclick = () => {
      if (!ok()) return;
      if (sel.id === "photo" && pending && !savePhoto(pending)) { haptic("error"); toast(t("Couldn’t save the photo. Try a smaller one."), true); return; }
      if (!setPref("bg", { id: sel.id, blur: sel.blur })) { haptic("error"); toast(t("Couldn’t save. Please try again."), true); return; }
      haptic("success"); toast(t("Background applied.")); pctx.close();
    };
    refresh();
    return h("div", { class: "pbody" }, h("div", { class: "phead" }, h("h2", {}, t("Background"))), frame, opts, photoBox, h("div", { class: "acts end" }, btn(t("Cancel"), { kind: "ghost", onclick: () => pctx.close() }), apply_));
  } });
}

const appearance = (ctx) => bodyOf(t("Appearance and accessibility"),
  group(t("Display"),
    row({ title: t("Theme"), end: seg([["system", t("System")], ["light", t("Light")], ["dark", t("Dark")]], P().theme, (v) => set("theme", v, ctx, false), t("Theme")) }),
    row({ title: t("Font size"), wide: true, end: slider({ min: 85, max: 130, step: 5, value: P().font, fmt: (v) => v + "%", label: t("Font size"), onInput: applyFont, onCommit: (v) => set("font", v, ctx, false) }) }),
    row({ title: t("Colour-blind friendly colours"), sub: t("Safer mood colours. Labels always stay."), end: sw(P().cb, (v) => { set("cb", v, ctx, false); app.refresh(); }, t("Colour-blind friendly colours")) }),
    row({ title: t("Transparency effects"), sub: t("Reduced replaces glass with solid surfaces."), end: seg([["on", t("Full")], ["off", t("Reduced")]], P().fx, (v) => set("fx", v, ctx, false), t("Transparency effects")) }),
    row({ title: t("Contrast"), end: seg([["standard", t("Standard")], ["high", t("High")]], P().contrast, (v) => set("contrast", v, ctx, false), t("Contrast")) })),
  group(t("Colour"), ...accentRow(ctx)),
  group(t("Background"), row({ icon: "layout", title: t("Background"), sub: bgName((P().bg || {}).id), sid: T.sid.set("bg"), end: ic("next", 16), onclick: openBg })),
  group(t("Motion and touch"),
    row({ title: t("Reduced motion"), end: seg([["system", t("System")], ["on", t("Reduce")], ["off", t("Full")]], P().motion, (v) => set("motion", v, ctx, false), t("Reduced motion")) }),
    row({ title: t("Haptic feedback"), sub: hapticMode() === "none" ? t("This device doesn’t report vibration support.") : null, end: sw(P().haptics, (v) => set("haptics", v, ctx), t("Haptic feedback")) }),
    row({ title: t("Haptic strength"), dim: !P().haptics, end: seg([["light", t("Light")], ["medium", t("Medium")], ["strong", t("Strong")]], P().hapticLevel, (v) => set("hapticLevel", v, ctx, false), t("Haptic strength")) }),
    row({ title: t("Control size"), end: seg([["standard", t("Standard")], ["large", t("Large")]], P().tap, (v) => set("tap", v, ctx, false), t("Control size")) })));

function importFile() {
  const i = h("input", { type: "file", accept: ".json,application/json", style: "display:none" });
  i.onchange = async () => {
    const f = i.files[0]; i.remove(); if (!f) return;
    if (f.size > MAXB) { toast(t("This file is too large to be a backup."), true); haptic("error"); return; }
    importText(await f.text());
  };
  document.body.append(i); i.click();
}
const MAXB = 2 * 1024 * 1024;
// Shared by the file picker and by a file dropped in from another app (validated the same way, always confirmed before anything is replaced).
export async function importText(text) {
  {
    let o; try { o = JSON.parse(text); } catch { toast(t("This file isn’t an Interception backup."), true); haptic("error"); return; }
    const r = validate(o); if (r.error) { toast(t(r.error), true); haptic("error"); return; }
    const d = r.data;
    if (await confirmBox({ title: t("Replace data on this device?"), body: t("The backup has {a} habits, {b} mood entries and {c} diary entries. Your current data will be replaced.", { a: d.habits.length, b: d.moods.length, c: d.diary.length }), ok: t("Replace data"), keep: t("Keep my data"), danger: true })) {
      if (setData(d)) { haptic("success"); toast(t("Backup imported.")); } else { haptic("error"); toast(t("Couldn’t save. Please try again."), true); }
      syncSoon(); app.refresh();
    }
  }
}
const PRIV = () => [t("Interception keeps your habits, moods and diary on this device only. There is no account and nothing is uploaded."), t("Reminders are scheduled locally with generic text. They never include your diary or mood notes."), t("A backup leaves the device only when you share or copy it yourself. Treat backup files as private."), t("Interception is not a medical service and does not replace professional care.")];
let lockCtx;
const privacy = (ctx) => (lockCtx = ctx, bodyOf(t("Privacy and data"),
  group(null, row({ icon: "lock", title: t("Your data stays on this device"), sub: t("Nothing is sent anywhere unless you share a backup.") })),
  group(t("Backup"),
    row({ icon: "upload", title: t("Share backup"), sub: t("Send a copy to another app."), onclick: async () => {
      if (!(await confirmBox({ title: t("Share a backup?"), body: t("The file contains all of your habits, moods and diary entries. Only send it to somewhere you trust."), ok: t("Choose where"), keep: t("Cancel") }))) return;
      try { await shareBackup(toJSON(), `interception-${today()}.json`); haptic("success"); } catch (e) { const m = String(e && (e.message || e)); if (!/cancel/i.test(m)) { haptic("error"); toast(/receiver/i.test(m) ? t("No app on this device can receive it.") : t("Couldn’t share the backup."), true); } } } }),
    row({ icon: "copy", title: t("Copy backup"), onclick: async () => { const ok = await copyText(toJSON()); haptic(ok ? "success" : "error"); toast(ok ? t("Backup copied.") : t("Couldn’t copy."), !ok); } }),
    row({ icon: "download", title: t("Import backup"), sub: t("Replaces the data on this device."), onclick: importFile }),
    isNative ? h("div", { class: "dropzone", "aria-hidden": "true" }, t("You can also drag a backup file in from another app.")) : null),
  isNative ? group(t("App lock"), row({ icon: "lock", title: t("Require unlock"), sub: t("Asks for your fingerprint, face or screen lock when the app opens or after 15 seconds away. It controls who can open Interception on this device. It does not encrypt your data."), end: sw(P().lock.on, async (v) => {
    const ctx = lockCtx;
    if (v) { const s = await canAuth(); if (s !== "ok") { toast(s === "none" ? t("Set up a fingerprint, face or screen lock in Android settings first.") : t("This device can’t offer an unlock prompt."), true); haptic("error"); return ctx.update(); } }
    const r = await authenticate(v ? t("Turn on app lock") : t("Turn off app lock"), "");
    if (!r.ok) { haptic("error"); return ctx.update(); }
    setPref("lock.on", v); setSecure(v); haptic("success"); ctx.update();
  }, t("Require unlock")) })) : null,
  group(null,
    row({ icon: "info", title: t("Privacy information"), onclick: () => textDialog(t("Privacy information"), PRIV()) }),
    row({ icon: "trash", title: t("Clear application data"), danger: true, onclick: async () => {
      if (await confirmBox({ title: t("Clear all data?"), body: t("Every habit, mood entry and diary entry on this device will be removed. This can’t be undone."), ok: t("Clear everything"), keep: t("Keep my data"), danger: true })) {
        wipe() ? toast(t("All data cleared.")) : toast(t("Couldn’t clear. Please try again."), true); syncSoon(); app.refresh();
      } } }))));

const storage = () => {
  const z = sizes(), s = get(), tot = Object.values(z).reduce((a, b) => a + b, 0), mx = Math.max(1, tot);
  const line = (icon, title, n, bytes) => row({ icon, title, sub: `${t("{n} items", { n })} · ${fmtBytes(bytes)}`, end: h("span", { class: "mbar" }, h("i", { style: `width:${Math.max(2, (bytes / mx) * 100)}%` })) });
  return bodyOf(t("Storage"), group(null, row({ icon: "db", title: t("Total on this device"), sub: fmtBytes(tot) })),
    group(null, line("diary", t("Diary data"), s.diary.length, z.diary), line("mood", t("Mood history"), s.moods.length, z.mood), line("habits", t("Habit data"), s.habits.length, z.habits), line("calendar", t("Health calendar data"), Object.keys(s.done).length, z.calendar)));
};

const VER = typeof __APP_VERSION__ === "undefined" ? "dev" : __APP_VERSION__, BUILD = typeof __BUILD_TIME__ === "undefined" ? "" : __BUILD_TIME__;
const about = () => bodyOf(t("About"),
  group(null, row({ title: t("Version"), end: h("span", { class: "val" }, VER) }), row({ title: t("Build"), end: h("span", { class: "val" }, BUILD ? new Date(BUILD).toLocaleDateString() : "–") })),
  group(null,
    row({ title: t("Credits"), onclick: () => textDialog(t("Credits"), [t("Made with JavaScript, Vite and Capacitor."), t("The glass material follows dashersw’s liquid-glass-js; the lens idea is from Shu Ding’s liquid-glass."), t("Mood faces and icons are drawn for this app.")]), end: ic("next", 16) }),
    row({ title: t("Licenses"), onclick: () => textDialog(t("Licenses"), ["liquid-glass · MIT · Copyright (c) 2025 Shu Ding", "liquid-glass-js · MIT · Copyright (c) 2025 Armagan Amcalar", "multihaptic (design reference only, no code included) · see licenses/multihaptic-LICENSE", "Capacitor · MIT", "Vite · MIT", "Interception · private"]), end: ic("next", 16) }),
    row({ title: t("Privacy policy"), onclick: () => textDialog(t("Privacy policy"), PRIV()), end: ic("next", 16) })));

export function settings() {
  const z = Object.values(sizes()).reduce((a, b) => a + b, 0);
  const cats = [
    ["general", "settings", t("General"), (LANGS.find((l) => l[0] === P().lang) || [])[1], general],
    ["notifications", "bell", t("Notifications"), P().notif.on ? t("On") : t("Off"), notifications],
    ["appearance", "eye", t("Appearance and accessibility"), P().font + "%", appearance],
    ["privacy", "lock", t("Privacy and data"), t("Backup, import, clear"), privacy],
    ["storage", "db", t("Storage"), fmtBytes(z), storage],
    ["about", "info", t("About"), VER, about],
  ];
  return h("div", { class: "page" }, backBar(t("Settings"), t("Preferences"), "home", true),
    h("section", { class: "glist cats" }, cats.map(([k, icon, title, sub, render]) => row({ sid: T.sid.set(k), icon, title, sub, end: ic("next", 16),
      onclick: () => openPanel({ sid: T.sid.set(k), mode: "full", label: title, render }) }))));
}

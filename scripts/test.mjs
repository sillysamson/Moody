// Pure-logic tests (no DOM, no Capacitor). Run: npm test
const mem = {};
globalThis.localStorage = { getItem: (k) => mem[k] ?? null, setItem: (k, v) => { mem[k] = v; } };
globalThis.requestAnimationFrame = (cb) => setTimeout(() => cb(performance.now()), 4);
globalThis.cancelAnimationFrame = clearTimeout;
let fails = 0, n = 0;
const ok = (c, m) => { n++; if (!c) { fails++; console.error("FAIL", m); } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const st = await import("../src/core/store.js"), mo = await import("../src/system/motion.js"), { plan, inQuiet } = await import("../src/system/plan.js");
const { validate, fmtBytes } = await import("../src/system/backup.js"), { t } = await import("../src/system/i18n.js"), D = await import("../src/core/dates.js"), L = await import("../src/core/logic.js");
let S, P; const bind = () => { S = st.get(); P = S.prefs; }; st.load(); bind();

// store: corrupt data is preserved, defaults restored
mem["interception.v1"] = "{bad"; st.load(); ok(st.loadError && mem["interception.v1.corrupt"] === "{bad", "corrupt kept");
st.load(); bind(); ok(P.notif.quiet.from === "22:00", "nested prefs merged");

// spring: converges, <2% overshoot, interruptible without a jump
P.motion = "off";
let mx = 0, fin = null; const c1 = mo.spring({ from: 0, to: 1, k: 280, c: 30 }, (x) => { mx = Math.max(mx, x); fin = x; });
await sleep(1200); ok(Math.abs(fin - 1) < 0.001, "spring settles"); ok(mx < 1.02, "spring overshoot " + mx);
let last = 0; const c2 = mo.spring({ from: 0, to: 1, k: 280, c: 30 }, (x) => { last = x; }); await sleep(120);
const x1 = c2.x, v1 = c2.v; c2.stop(); let first = null;
const c3 = mo.spring({ from: x1, to: 0, v: v1, k: 280, c: 30 }, (x) => { if (first === null) first = x; }); await sleep(30);
ok(Math.abs(first - x1) < 0.08, "retarget starts from current value " + first + " vs " + x1); c3.stop();
P.motion = "on"; let once = null; mo.spring({ from: 0, to: 1 }, (x) => { once = x; }); ok(once === 1, "reduced motion jumps");

// reminder planner
const now = new Date(2026, 10, 16, 8, 0);
const reset = () => { P.notif.on = true; P.notif.checkin.on = false; P.notif.mood.on = false; P.notif.habit.freq = "off"; P.notif.quiet.on = false; S.habits.length = 0; for (const k in S.done) delete S.done[k]; };
reset(); P.notif.checkin.on = true; ok(plan(P, S, now).length === 14, "check-in daily x14");
P.notif.quiet.on = true; P.notif.checkin.time = "23:00"; ok(plan(P, S, now).length === 0, "quiet hours skip"); P.notif.checkin.time = "20:00"; ok(plan(P, S, now).length === 14, "outside quiet kept");
ok(inQuiet({ on: true, from: "22:00", to: "07:00" }, "03:00") && !inQuiet({ on: true, from: "22:00", to: "07:00" }, "12:00"), "overnight window");
reset(); S.habits.push({ id: "a", name: "x", days: [0, 1, 2, 3, 4, 5, 6], start: "2026-11-01", status: "active" });
P.notif.habit.freq = "day"; ok(plan(P, S, now).length === 14, "habit on scheduled day"); S.done["a|2026-11-16"] = 1; ok(plan(P, S, now).length === 13, "completed today not reminded");
P.notif.habit.freq = "before"; delete S.done["a|2026-11-16"]; S.done["a|2026-11-17"] = 1; ok(plan(P, S, now).length === 13, "one day before skips completed target");
P.notif.habit.freq = "until"; for (const k in S.done) delete S.done[k]; S.done["a|2026-11-16"] = 1; ok(plan(P, S, now).length === 13, "until completed");
const ids = plan(P, S, now).map((p) => p.id); ok(new Set(ids).size === ids.length && ids.every((i) => Number.isInteger(i) && i < 2147483647), "ids unique int32");
reset(); P.notif.on = false; P.notif.checkin.on = true; ok(plan(P, S, now).length === 0, "master off");

// backup validation
const good = { data: { habits: [{ id: "a", name: "n", days: [1], start: "2026-01-01", status: "active" }], moods: [{ id: "m", ts: 1, date: "2026-01-01", mood: "Calm" }], diary: [{ id: "d", title: "", body: "x", date: "2026-01-01", updated: 1 }], done: { "a|2026-01-01": 1 } } };
ok(validate(good).data, "valid backup"); ok(validate(null).error && validate({}).error, "rejects non-backup");
const bad1 = structuredClone(good); bad1.data.habits[0].days = [9]; ok(validate(bad1).error, "rejects bad weekday");
const bad2 = structuredClone(good); bad2.data.done["a|x"] = 5; ok(validate(bad2).error, "rejects bad completion");
const bad3 = structuredClone(good); bad3.data.diary[0].body = 7; ok(validate(bad3).error, "rejects bad diary");
ok(fmtBytes(2048) === "2.0 KB", "fmtBytes");
st.setData(validate(good).data); bind(); ok(S.habits.length === 1 && S.prefs.notif, "setData keeps prefs");

// i18n, dates, logic
P.lang = "en"; ok(t("Save habit") === "Save habit" && t("{n} of {m} marked", { n: 1, m: 2 }) === "1 of 2 marked", "en passthrough");
P.lang = "id"; ok(t("Save habit") === "Simpan kebiasaan" && t("{n} of {m} marked", { n: 1, m: 2 }) === "1 dari 2 ditandai" && t("not in dictionary") === "not in dictionary", "id + fallback");
P.dateFmt = "dmy"; ok(D.short("2026-11-16") === "16/11/2026", "dmy"); P.dateFmt = "mdy"; ok(D.short("2026-11-16") === "11/16/2026", "mdy"); P.dateFmt = "ymd"; ok(D.short("2026-11-16") === "2026-11-16", "ymd");
ok(D.addD("2026-12-31", 1) === "2027-01-01" && D.addD("2026-03-01", -1) === "2026-02-28", "addD");
const hb = { id: "z", name: "z", days: [1], start: "2026-11-01", status: "active" }; ok(L.sched(hb, "2026-11-16") && !L.sched(hb, "2026-11-17") && !L.sched(hb, "2026-10-26"), "sched weekday + start");
S.habits.length = 0; S.habits.push(hb); L.toggle(hb, "2026-11-16"); ok(L.monthMarks("2026-11")["2026-11-16"].h === 1, "month marks");

// liquid-glass displacement map maths
Object.defineProperty(globalThis, "navigator", { value: { userAgent: "Safari" }, configurable: true });
let px; globalThis.document = { createElement: () => ({ getContext: () => ({ createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }), putImageData: (i) => { px = i.data; } }), toDataURL: () => "data:x" }) };
const { build } = await import("../src/ui/glass.js"); const g = build(200, 70, 30);
ok(g.scale > 0 && isFinite(g.scale), "glass scale"); ok(Math.abs(px[(35 * 200 + 100) * 4] - 127.5) < 6, "glass centre neutral"); ok([...px].some((v, i) => i % 4 === 0 && Math.abs(v - 127.5) > 20), "glass edge displaced");

// ---- 1.4 ----
const LY = await import("../src/system/layout.js"), MS = await import("../src/system/moodscale.js"), HP = await import("../src/system/hapticplan.js"), GL = await import("../src/ui/glass.js");
const lids = ["a", "b", "c", "d"];
ok(LY.resolveLayout(null, lids).order.join() === "a,b,c,d", "layout: first run = defaults");
const L1 = LY.resolveLayout({ order: ["c", "zz", "a", "a"], hidden: ["b", "c", "q"] }, lids, ["a", "b", "c", "d"]);
ok(L1.order.join() === "c,a,d" && L1.hidden.join() === "b", "layout: unknown dropped, dupes removed, new module appended " + JSON.stringify(L1));
ok(LY.resolveLayout({ order: ["a"], hidden: [] }, lids, ["a"]).hidden.join() === "b,c,d", "layout: new non-default module goes to the add list");
ok(LY.move(["a", "b", "c"], 0, 2).join() === "b,c,a" && LY.move(["a", "b"], 5, 0).join() === "a,b", "layout: move");
ok(MS.SCALE.length === 7 && MS.labelOf(1) === "Very unpleasant" && MS.labelOf(7) === "Very pleasant" && MS.valueOf("Neutral") === 4 && MS.valueOf("Happy") === null, "mood scale mapping");
ok(MS.stepAt(-50, 0, 100) === 1 && MS.stepAt(999, 0, 100) === 7 && MS.stepAt(50, 0, 100) === 4, "mood stepAt clamps and reaches every end");
let po = -1, pt = 99; for (let v = 1; v <= 7; v++) { const f = MS.flowerParams(MS.tOf(v)); ok(f.open >= po && f.tilt <= pt, "flower opens monotonically, droop decreases"); po = f.open; pt = f.tilt; }
ok(MS.flowerSVG(0.5).startsWith("<svg") && MS.flowerParams(0.5, { muted: true }).pet !== MS.flowerParams(0.5).pet, "flower svg + muted state");
ok(HP.plan("select").id === "micro" && HP.plan("slider").id === "picker" && HP.plan("button").id === "mini" && HP.plan("toggle").id === "toggle" && HP.plan("nav").id === "nav" && HP.plan("success").id === "full150" && HP.plan("warning").id === "full80" && HP.plan("error").n === 2 && HP.plan("nope") === null && HP.plan("tap") === null, "haptic: all 8 semantic kinds map; old names are gone");
ok(HP.plan("button", "light").s < HP.plan("button", "medium").s && HP.plan("button", "medium").s < HP.plan("button", "strong").s && HP.plan("button", "bogus").level === "medium", "haptic strength scales and bad levels fall back");
const gs = { k: "", t: -1e9 }; ok(HP.gate(gs, "button", 1000) && !HP.gate(gs, "button", 1030) && HP.gate(gs, "success", 1040) && !HP.gate(gs, "select", 1050) && HP.gate(gs, "select", 1200), "haptic gate: dupes dropped, stronger kinds pass, no flooding");
const gl = { k: "", t: -1e9 }; let fired = 0; for (let ms = 0; ms < 1000; ms += 8) if (HP.gate(gl, "slider", ms)) fired++; ok(fired <= 17, "haptic gate: a 1 s slider drag fires at most ~16 ticks, never per frame (" + fired + ")");
const sd = GL.sdf(0, -30, 100, 35, 35); ok(sd.d === -5 && sd.ny === -1, "glass sdf: pill, 5px inside the top edge, normal points out");
ok(GL.sdf(0, 0, 40, 40, 40).d === -40, "glass sdf: circle centre");
ok(GL.lens(0, 5).mag > GL.lens(10, 5).mag && GL.lens(10, 5).mag > 0, "glass lens strongest at the rim, decays inward");
const gp = GL.build(300, 64, Infinity); ok(gp.scale > 0 && isFinite(gp.scale) && px[(32 * 300 + 1) * 4] < 100 && px[(32 * 300 + 298) * 4] > 155, "glass pill map: opposite edges displace in opposite directions");


// ---- 1.5 ----
const PL = await import("../src/system/palette.js"), BG = await import("../src/ui/background.js");
ok(LY.spans(["m", "s", "s", "l"]).join() === "2,1,1,2" && LY.spans(["s"]).join() === "2" && LY.spans(["s", "s", "s"]).join() === "1,1,2" && LY.spans(["s", "m", "s", "s"]).join() === "2,2,1,1" && LY.spans([]).length === 0, "bento: two small tiles share a row, a lone small tile widens (no holes)");
ok(LY.resolveSize("l", ["m", "l"], "m") === "l" && LY.resolveSize("s", ["m", "l"], "m") === "m" && LY.resolveSize(undefined, ["s", "m"], "s") === "s" && LY.resolveSize({}, ["s"], "s") === "s", "bento: unsupported/corrupt saved size falls back to the default");
ok(LY.nextSize("s", ["s", "m"]) === "m" && LY.nextSize("m", ["s", "m"]) === "s" && LY.nextSize("x", ["m", "l"]) === "l", "bento: nextSize wraps");
// accent palettes: contrast is enforced for EVERY hue/vividness, in both modes, standard and high contrast
let low = 99, cn = 0; for (let h = 0; h < 360; h += 7) for (const c of [0.02, 0.06, 0.1, 0.14]) for (const hi of [0, 1]) {
  const m = PL.modes({ id: "custom", h, c }, hi ? "high" : "standard");
  for (const M of [m.light, m.dark]) { for (const k of ["--bg", "--s1", "--s2", "--s3"]) { low = Math.min(low, PL.contrast(M["--mu"], M[k]) / (hi ? 7 : 4.5), PL.contrast(M["--tx"], M[k]) / (hi ? 10 : 9)); cn++; } for (const k of ["--bg", "--s1", "--s2"]) low = Math.min(low, PL.contrast(M["--pr"], M[k]) / (hi ? 7 : 4.5)); low = Math.min(low, PL.contrast(M["--on"], M["--pr"]) / 4.5); }
}
ok(low >= 1, "accent palette: text, muted text, accent and on-accent meet WCAG AA (AAA in high contrast) for all hues (" + cn + " surfaces, worst ratio vs target " + low.toFixed(2) + ")");
ok(Object.keys(PL.cssVars({ id: "moss" })).length === 0 && Object.keys(PL.cssVars(null)).length === 0 && Object.keys(PL.cssVars({ id: "bogus" })).length === 0 && PL.VARS.every((k) => k in PL.cssVars({ id: "ocean" })), "accent: moss/unknown = stylesheet palette; presets override every variable");
ok(PL.resolveAccent({ id: "custom", h: "x", c: 1 }) === null && PL.resolveAccent({ id: "custom", h: 400, c: 9 }).h === 40 && PL.resolveAccent({ id: "custom", h: 10, c: 9 }).c === 0.14 && PL.resolveAccent({ id: "custom", h: 10, c: 0 }).c === 0.02, "accent: corrupt custom falls back; hue wraps and vividness clamps");
ok(PL.cssVars({ id: "ocean" })["--pr"].startsWith("light-dark(#") && PL.cssVars({ id: "ocean" })["--pr"] !== PL.cssVars({ id: "rose" })["--pr"], "accent: output is light-dark() pairs and differs per preset");
const o = PL.toOklch("#4a6b43"), hx = PL.hex(o.L, o.C, o.H); ok(hx === "#4a6b43", "oklch round-trip " + hx);
ok(/^#[0-9a-f]{6}$/.test(PL.hex(0.5, 0.4, 100)) && /^#[0-9a-f]{6}$/.test(PL.hex(1.2, 0.3, -40)), "oklch: out-of-gamut and out-of-range values still yield valid hex");
// photo background: veil guarantees text contrast at the photo's average tone
const bgL = [239, 233, 218], muL = [86, 98, 73], bgD = [18, 25, 18], muD = [169, 179, 157], rat = (a, b) => { const y = (c) => { const f = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]); }; return (Math.max(y(a), y(b)) + 0.05) / (Math.min(y(a), y(b)) + 0.05); };
let okv = true; for (const g of [0, 0.2, 0.5, 0.8, 1]) for (const [bg, mu] of [[bgL, muL], [bgD, muD]]) { const v = BG.veilFor(g, bg, mu), comp = bg.map((c) => v * c + (1 - v) * g * 255); if (v < 0.95 && rat(comp, mu) < 4.5) okv = false; }
ok(okv, "photo veil: text meets 4.5:1 at the photo's average tone for dark..light photos in both appearances");
ok(BG.veilFor(0, bgL, muL) > BG.veilFor(0.9, bgL, muL) && BG.veilFor(1, bgD, muD) > BG.veilFor(0.1, bgD, muD), "photo veil: a photo that fights the page colour gets a stronger veil");
ok(validate({ data: { habits: [], done: {}, moods: [{ id: "m", ts: 1, date: "2026-01-01", mood: "Happy", v: 6, feels: ["Happy", "Calm"] }], diary: [] } }).data, "backup accepts multi-emotion check-ins");
ok(validate({ data: { habits: [], done: {}, moods: [{ id: "m", ts: 1, date: "2026-01-01", mood: "Happy", feels: [3] }], diary: [] } }).error, "backup rejects a malformed feels list");

// ---- 1.6 ----
const BGM = await import("../src/ui/background.js");
ok(BGM.glassTone(0.93) === "bright" && BGM.glassTone(0.06) === "dim" && BGM.glassTone(0.5) === "", "adaptive glass: bright / dim / mid buckets");
ok(BGM.glassTone(0.63, "bright") === "bright" && BGM.glassTone(0.63, "") === "" && BGM.glassTone(0.37, "dim") === "dim", "adaptive glass: hysteresis keeps the bucket near a threshold");
ok(BGM.toneBehind(null, 0, false) > 0.9 && BGM.toneBehind(null, 0, true) < 0.1 && Math.abs(BGM.toneBehind(0.2, 0.5, false) - 0.565) < 0.01, "adaptive glass: tone from scheme and photo veil");
ok(GL.lens(0, 0, 0).mag > GL.lens(40, 40, 0.4).mag, "refraction (and so chromatic aberration) is strongest at the edge, weaker toward the centre");
const { T: TT } = await import("../src/system/tokens.js"); ok(TT.glass.ca > 0 && TT.glass.ca < 0.2, "chromatic aberration stays subtle");
const NS = await import("../src/system/navscroll.js"), SN = await import("../src/system/snapshot.js"), PA = await import("../src/system/palette.js");
ok(NS.navMin(false, 200, 20) === true && NS.navMin(true, 200, -20) === false && NS.navMin(true, 3, 0) === false && NS.navMin(true, 200, 2) === true && NS.navMin(false, 200, -2) === false, "nav collapse: down collapses, up expands, top expands, jitter keeps state");
const blueHC = PA.hexToHC("#3a7bd5"); ok(blueHC.h > 235 && blueHC.h < 275 && blueHC.c >= 0.02 && blueHC.c <= 0.14, "wallpaper accent: blue maps to a blue hue and an in-range chroma");
ok(Math.abs(PA.hexToHC("#e03a2c").h - 28) < 10, "wallpaper accent: red hue is about 28 degrees in OKLCH");
PA.setWallpaper(null); ok(PA.resolveAccent({ id: "wallpaper" }) === null, "wallpaper accent falls back to moss when unsupported"); PA.setWallpaper({ h: 120, c: 0.1 }); ok(PA.resolveAccent({ id: "wallpaper" }).h === 120, "wallpaper accent resolves once the system colour is known"); PA.setWallpaper(null);
const SS = { habits: [{ id: "a", name: "Read", status: "active", start: "2020-01-01", days: [0, 1, 2, 3, 4, 5, 6], freq: "daily" }], done: {}, moods: [{ date: "2026-11-20" }, { date: "2026-11-19" }] };
const snap = SN.snapshot(SS, "2026-11-20"); ok(snap.moods === 1 && snap.date === "2026-11-20" && snap.done + (snap.total - snap.done) === snap.total && !("diary" in snap), "widget snapshot: counts only, no diary");

// 1.8 performance: bounded displacement-map cache, quality governor
for (let i = 0; i < 40; i++) GL.build(60 + i, 40, 20);
ok(GL.cacheSize() <= 16, "glass cache stays bounded");
const PF = await import("../src/system/perf.js"), gv = PF.governor();
const run = (arr) => arr.map(gv).includes(true);
ok(!run(Array(80).fill(16.7)), "governor: smooth frames never trip");
ok(run([...Array(30).fill(16.7), ...Array(10).fill(50)]), "governor: sustained slow frames trip once");
ok(!run([...Array(30).fill(400), ...Array(30).fill(16.7)]), "governor: a backgrounded gap is ignored");
GL.setGlassLevel(5); ok(GL.glassLevel() === 2, "glass level clamps at blur-only"); GL.setGlassLevel(0);
console.log(fails ? `${fails} FAILED of ${n}` : `ALL ${n} CHECKS PASSED`); process.exit(fails ? 1 : 0);

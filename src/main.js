import "./styles/tokens.css";
import "./styles/main.css";
import { h } from "./ui/dom.js";
import { ic } from "./ui/icons.js";
import { createNav, syncNav, setMin } from "./ui/navbar.js";
import { glass } from "./ui/glass.js";
import { load, loadError, onCommit, get } from "./core/store.js";
import { app, go, goBack, track, trailDepth, wasBack } from "./core/app.js";
import { applyTokens } from "./system/tokens.js";
import { apply } from "./system/prefs.js";
import { enter } from "./system/motion.js";
import { reapply, refreshPanels } from "./system/shared.js";
import { sync, syncSoon, setTapHandler } from "./system/notify.js";
import { navMin } from "./system/navscroll.js";
import { snapshot } from "./system/snapshot.js";
import { getInsets, systemAccent, setSnapshot, launchRoute, on as nativeOn } from "./system/native.js";
import { setWallpaper, hexToHC } from "./system/palette.js";
import { initLock, whenUnlocked } from "./features/lock.js";
import { today } from "./core/dates.js";
import { toast } from "./ui/components.js";
import { haptic } from "./system/haptics.js";
import { t } from "./system/i18n.js";
import { dashboard, leave as leaveDash } from "./features/dashboard.js";
import { habits } from "./features/habits.js";
import { mood } from "./features/mood.js";
import { diary, leave as leaveDiary } from "./features/diary.js";
import { calendar } from "./features/calendar.js";
import { zen, leave as leaveZen } from "./features/zen.js";
import { settings, importText } from "./features/settings.js";

const VIEWS = { home: dashboard, habits, mood, diary, calendar, zen, settings }; // "home" stays the route key so saved start pages and links keep working
const TABS = [["home", "Dashboard", "home"], ["habits", "Habits", "habits"], ["mood", "Mood", "mood"], ["diary", "Diary", "diary"]], TAB = TABS.map((x) => x[0]);

// Long-press / drag on Android WebView must never start a native drag (it showed the page URL as a "localhost" tile).
document.addEventListener("dragstart", (e) => e.preventDefault());

applyTokens(); load(); apply(); // widgets read a small snapshot the app rewrites after every change (they never read diary text)
let snapT = 0; const pushSnap = () => { clearTimeout(snapT); snapT = setTimeout(() => setSnapshot(snapshot(get(), today())), 400); };
onCommit(() => { pushSnap(); get().prefs.notif.on && syncSoon(); });
if (typeof matchMedia !== "undefined") for (const q of ["(prefers-reduced-motion: reduce)", "(prefers-color-scheme: dark)"]) matchMedia(q).addEventListener("change", apply); // the photo veil depends on the resolved scheme

const view = h("main", { id: "view" }), root = document.getElementById("root");
const sbtn = h("button", { type: "button", class: "icbtn", id: "sbtn", hidden: true, onclick: () => { if (app.primary) { haptic("button"); app.primary.run(); } } }, ic("plus", 22));
// One control for Settings: the gear opens it, and while Settings is open the same button is the exit (distinct from Android system Back).
const setBtn = h("button", { type: "button", class: "icbtn hb", onclick: () => { haptic(cur === "settings" ? "nav" : "button"); cur === "settings" ? goBack("home") : go("settings"); } }, ic("settings"));
const header = h("header", { class: "topbar" }, h("div", { class: "hacts" }, sbtn, setBtn)); // 1.7: no brand lockup on the dashboard (identity lives in the launcher icon and About)
const shell = h("div", { class: "app" }, header, loadError ? h("div", { class: "banner", role: "alert" }, t("Your saved data couldn’t be read. A copy was kept in this browser under “interception.v1.corrupt”.")) : null, view);
root.append(shell);
const navEl = createNav({ items: TABS, onGo: (k) => { if (cur !== k) { haptic("nav"); go(k); } } });
shell.append(navEl);
// The pill collapses on a real downward scroll and returns on an upward one, at the top, on tap or on a page change. It is fixed, so nothing in the page ever moves.
let lastY = 0, navMinned = false;
const expand = () => { if (navMinned) { navMinned = false; setMin(false); } };
view.addEventListener("scroll", () => { const y = view.scrollTop, m = navMin(navMinned, y, y - lastY); lastY = y; if (m !== navMinned) { navMinned = m; setMin(m); } }, { passive: true });
navEl.addEventListener("pointerdown", expand);

// Top-edge tug fix, belt and braces. The document itself no longer scrolls (see main.css), so there is nothing for the WebView to stretch;
// this guard also makes sure no gesture can leave the root offset or scrolled.
const rest = () => { const d = document.scrollingElement; if (d && d.scrollTop) d.scrollTop = 0; const s = root.style; if (s.transform || s.translate) { s.transform = ""; s.translate = ""; } };
for (const ev of ["touchend", "touchcancel", "pointerup", "pointercancel"]) addEventListener(ev, rest, { capture: true, passive: true });
addEventListener("scroll", rest, { passive: true });

let cur = null;
function render(arg, animate, dir = 0) {
  app.primary = null; expand(); lastY = view.scrollTop;
  const el = VIEWS[cur](arg), y = view.scrollTop;
  view.replaceChildren(el);
  syncNav(cur);
  { const on = cur === "settings"; setBtn.setAttribute("aria-label", on ? t("Close settings") : t("Settings")); setBtn.replaceChildren(ic(on ? "close" : "settings")); }
  sbtn.hidden = !app.primary; if (app.primary) { sbtn.setAttribute("aria-label", app.primary.label); sbtn.dataset.sid = app.primary.sid; } else delete sbtn.dataset.sid;
  reapply();
  if (animate) enter(el, dir); else view.scrollTop = y;
}
function route() {
  leaveDash(); leaveDiary(); leaveZen();
  let raw = location.hash.slice(1);
  if (!raw) { raw = get().prefs.start; history.replaceState(history.state, "", "#" + raw); }
  // Opened straight onto Settings (deep link): give it a real "previous" entry so Back and Android back both land on the dashboard.
  if (!trailDepth() && raw === "settings") { history.replaceState(null, "", "#home"); history.pushState(null, "", "#settings"); track("home", false); }
  const [r, arg] = raw.split("/"), prev = cur, next = VIEWS[r] ? r : "home";
  const back = wasBack(raw); // the hash we are arriving at is the one before the current entry
  const d = !prev ? 0 : TAB.includes(prev) && TAB.includes(next) ? Math.sign(TAB.indexOf(next) - TAB.indexOf(prev)) : back ? -1 : TAB.includes(next) ? -1 : 1;
  track(raw, back); cur = next;
  render(arg, true, d); view.scrollTop = 0;
}
let soon = 0;
app.refresh = () => { render(undefined, false); refreshPanels(); };
app.soft = () => { clearTimeout(soon); soon = setTimeout(() => app.refresh(), 220); };
addEventListener("hashchange", route);
route(); sync();

// ---- 1.7 native wiring (all no-ops in a browser) ----
const px = (o) => { if (!o) return; const st = document.documentElement.style; for (const k of ["top", "right", "bottom", "left"]) st.setProperty("--ni-" + k, o[k] + "px"); };
getInsets().then(px); nativeOn("insets", px);
systemAccent().then((r) => { if (r.supported && r.color) { setWallpaper(hexToHC(r.color)); if (get().prefs.accent.id === "wallpaper") apply(); } });
initLock(); // before anything is shown to a locked user
const open = (r) => whenUnlocked(() => r && go(r)); // shortcut, widget and reminder taps: open the screen only; nothing is created without the user
launchRoute().then((r) => r && open(r)); nativeOn("route", (e) => e && open(e.route)); setTapHandler(open);
nativeOn("dragstate", (e) => { document.documentElement.dataset.drag = e && e.on ? "1" : "0"; });
nativeOn("drop", (e) => { if (!e) return; if (e.mime === "too_large") { toast(t("This file is too large to be a backup."), true); return; } whenUnlocked(() => importText(e.text)); });
pushSnap(); document.addEventListener("visibilitychange", () => { if (!document.hidden) pushSnap(); });

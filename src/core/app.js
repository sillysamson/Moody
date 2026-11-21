export const app = { refresh() {}, soft() {}, primary: null /* the header Add button: {label, run, sid} set by the page that owns an "add" action; sid = the panel it opens, so the panel grows out of this button */ };
const trail = []; // hashes visited in this session, so Back can tell "came from the app" from "opened directly"
export const trailDepth = () => trail.length;
export const wasBack = (hash) => trail.length > 1 && trail[trail.length - 2] === hash;
export function track(hash, back) { if (back && trail.length) trail.pop(); else if (!back && trail[trail.length - 1] !== hash) trail.push(hash); }
export const go = (r) => { if (location.hash.slice(1) !== r) location.hash = r; };
// Back control for sub-pages (Settings, Calendar, Zen). Same path as Android system back: history.back() when the app has history,
// otherwise replace with a safe fallback so there is never an exit loop or a dead end. Guarded against double taps.
let lock = 0;
export function goBack(fallback = "home") {
  if (lock) return; lock = setTimeout(() => (lock = 0), 380);
  if (trail.length > 1) history.back(); else location.replace("#" + fallback);
}

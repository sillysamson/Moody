// Pure haptic planning (no Capacitor): semantic kind -> pattern, and the rate limiter. Unit-tested.
// Kinds follow Apple's feedback categories: selection, toggle, button, success, warning (+ error), slider, navigation.
//   select   a choice changed (segments, calendar, chips, reorder)      slider  a value crosses a meaningful step (mood scale, font size)
//   toggle   a switch flipped (carries on/off)                          nav     the destination changed (tabs, Back)
//   button   an ordinary press                                          success a deliberate action completed (saved, habit done)
//   warning  a destructive or important action                          error   an operation failed
export const PRI = { slider: 1, select: 1, nav: 1, toggle: 2, button: 2, success: 3, warning: 4, error: 5 };
// kind -> [composition id used by HapticPlugin.java when no system effect applies, repeat count]
const MAP = { select: ["micro", 1], slider: ["picker", 1], nav: ["nav", 1], toggle: ["toggle", 1], button: ["mini", 1], success: ["full150", 1], warning: ["full80", 1], error: ["full230", 2] };
const LEVEL = { light: 0.6, medium: 1, strong: 1.3 };
// Pure: what to play for a kind at a strength level. Exported for tests.
export const plan = (kind, level = "medium") => { const m = MAP[kind]; return m ? { kind, level: LEVEL[level] ? level : "medium", id: m[0], n: m[1], s: Math.min(1, (LEVEL[level] || 1) * 0.85 + (level === "strong" ? 0.15 : 0)) } : null; };
// Pure rate limiter: same kind within 60 ms is dropped, and nothing fires faster than 24 ms apart unless it is stronger. Exported for tests.
export function gate(state, kind, now) {
  if (kind === state.k && now - state.t < 60) return false;
  if (now - state.t < 24 && PRI[kind] <= PRI[state.k || "select"]) return false;
  state.k = kind; state.t = now; return true;
}

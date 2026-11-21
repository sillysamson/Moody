// Frame-time governor. Fed with real frame gaps (ms) from running animations only, so it costs nothing while the app is idle.
// If too many recent frames are slow, glass drops one tier (see ui/glass.js). It never raises a tier mid-session: no flip-flopping.
import { setGlassLevel, glassLevel } from "../ui/glass.js";
export function governor({ slow = 34, span = 40, limit = 10, ignore = 250 } = {}) {
  let n = 0, bad = 0;
  return (dt) => {
    if (dt >= ignore) { n = 0; bad = 0; return false; } // backgrounded or paused: not a rendering problem
    n++; if (dt > slow) bad++;
    if (n < span) return false;
    const trip = bad >= limit; n = 0; bad = 0; return trip;
  };
}
const gov = governor();
export const frame = (dt) => { if (gov(dt)) setGlassLevel(glassLevel() + 1); };

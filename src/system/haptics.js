// Central haptic service. One function for the whole app: haptic(kind, on?). Kinds are semantic (see hapticplan.js), never raw vibration lengths.
// Android path, best first: IHaptic plugin -> View.performHapticFeedback (the system's own tuned effects, honours the user's touch-feedback setting)
//   -> VibrationEffect compositions (also used when Haptic strength is Light/Strong, which the system effects cannot scale) -> plain vibrate.
// Fallbacks: Capacitor Haptics, then navigator.vibrate in a browser. `on` is only used by toggle (TOGGLE_ON / TOGGLE_OFF).
// The .wav/.ahap files named in the 1.4 manifest were never supplied, so nothing here claims to play them.
import { Capacitor, registerPlugin } from "@capacitor/core";
import { Haptics, ImpactStyle, NotificationType } from "@capacitor/haptics";
import { get } from "../core/store.js";
const native = Capacitor.isNativePlatform();
const IH = native && Capacitor.isPluginAvailable("IHaptic") ? registerPlugin("IHaptic") : null;
import { PRI, plan, gate } from "./hapticplan.js";
const on_ = () => get().prefs.haptics !== false;
let pend = null, pOn = true, timer = 0; const G = { k: "", t: -1e9 };
export function haptic(kind, on = true) {
  if (!on_() || !PRI[kind]) return;
  if (!pend || PRI[kind] > PRI[pend]) { pend = kind; pOn = on; } // same-tick requests collapse to the strongest
  if (!timer) timer = setTimeout(fire, 0);
}
function fire() {
  timer = 0; const k = pend, on = pOn; pend = null;
  if (!k || !gate(G, k, performance.now())) return;
  const p = plan(k, get().prefs.hapticLevel);
  try {
    if (IH) IH.play({ ...p, on }).catch(() => {});
    else if (native) {
      const S = [ImpactStyle.Light, ImpactStyle.Medium, ImpactStyle.Heavy], L = { light: 0, medium: 1, strong: 2 }[get().prefs.hapticLevel] ?? 1;
      if (k === "select" || k === "slider" || k === "nav") Haptics.impact({ style: S[Math.max(0, L - 1)] });
      else if (k === "button" || k === "toggle") Haptics.impact({ style: S[L] });
      else Haptics.notification({ type: k === "success" ? NotificationType.Success : k === "warning" ? NotificationType.Warning : NotificationType.Error });
    } else if (typeof navigator !== "undefined" && navigator.vibrate) {
      const f = [0.6, 1, 1.5][{ light: 0, medium: 1, strong: 2 }[get().prefs.hapticLevel] ?? 1], r = (n) => Math.round(n * f);
      navigator.vibrate({ select: [r(6)], slider: [r(4)], nav: [r(5)], toggle: [r(9)], button: [r(12)], success: [12, 40, r(12)], warning: [20, 40, 20], error: [30, 50, 30, 50, 30] }[k]);
    }
  } catch { /* unsupported hardware: stay silent */ }
}
export const hapticMode = () => (IH ? "native" : native ? "native-basic" : typeof navigator !== "undefined" && navigator.vibrate ? "web" : "none");

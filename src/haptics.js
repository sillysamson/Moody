// Haptic pipeline per HAPTICS.md: collapse same-tick requests, rate-gate, then native plugin -> Capacitor Haptics -> vibrate.
import { registerPlugin } from '@capacitor/core';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';

const Native = registerPlugin('IHaptic');
const PRI = { slider: 1, select: 1, nav: 1, toggle: 2, button: 2, success: 3, warning: 4, error: 5 };
let prefs = { on: true, level: 'medium' };
export const setHapticPrefs = (p) => { prefs = p; };

let pend = null, timer = 0, last = { kind: '', t: -1e9, pri: 0 };
const gate = (kind, now) => {
  const dt = now - last.t;
  if (kind === last.kind && dt < 60) return false;
  if (dt < 24 && PRI[kind] <= last.pri) return false;
  return true;
};
export function haptic(kind, on = true) {
  if (!prefs.on || !PRI[kind]) return;
  if (!pend || PRI[kind] > PRI[pend.kind]) pend = { kind, on };
  if (!timer) timer = setTimeout(fire, 0);
}
function fire() {
  timer = 0;
  const p = pend; pend = null;
  const now = performance.now();
  if (!p || !gate(p.kind, now)) return;
  last = { kind: p.kind, t: now, pri: PRI[p.kind] };
  Native.play({ kind: p.kind, level: prefs.level, on: p.on }).catch(() => fallback(p.kind));
}
function fallback(kind) {
  const f = prefs.level === 'light' ? 0.6 : prefs.level === 'strong' ? 1.5 : 1;
  const style = f < 1 ? ImpactStyle.Light : f > 1 ? ImpactStyle.Heavy : ImpactStyle.Medium;
  const run = (p) => { try { p.catch(() => vib(kind, f)); } catch { vib(kind, f); } };
  if (kind === 'success') run(Haptics.notification({ type: NotificationType.Success }));
  else if (kind === 'warning') run(Haptics.notification({ type: NotificationType.Warning }));
  else if (kind === 'error') run(Haptics.notification({ type: NotificationType.Error }));
  else run(Haptics.impact({ style }));
}
function vib(kind, f) {
  const base = { select: 6, slider: 4, nav: 5, toggle: 9, button: 12 }[kind];
  try { navigator.vibrate?.(kind === 'error' ? [30, 50, 30, 50, 30] : kind === 'warning' ? [20, 40, 20] : kind === 'success' ? [12, 40, 12] : Math.round((base || 8) * f)); } catch {}
}

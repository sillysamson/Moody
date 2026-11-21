// Optional app lock (1.7). The system BiometricPrompt (fingerprint / face / screen lock) decides; Interception never sees biometric data.
// It controls who can open the app on this device; it does not encrypt the stored data, and the settings text says so.
import { h } from "../ui/dom.js";
import { ic } from "../ui/icons.js";
import { btn } from "../ui/components.js";
import { t } from "../system/i18n.js";
import { get } from "../core/store.js";
import { authenticate, setSecure, isNative } from "../system/native.js";

const AWAY = 15000, NO_LOCK = [1, 11, 12, 14]; // BiometricPrompt codes: HW unavailable, none enrolled, no hardware, no device credential
let el = null, busy = false, away = 0, msg = null; const waiters = [];
export const whenUnlocked = (fn) => (el ? waiters.push(fn) : fn());

function open() { el.remove(); el = null; document.getElementById("root").inert = false; waiters.splice(0).forEach((f) => f()); }
async function unlock() {
  if (busy || !el) return; busy = true;
  const r = await authenticate(t("Unlock Interception"), t("Confirm it’s you"));
  busy = false;
  if (r.ok) return open();
  if (NO_LOCK.includes(r.code)) { msg.textContent = t("This device has no screen lock set up, so there is nothing to ask for. You can open the app."); el.querySelector("button").onclick = open; el.querySelector("button").textContent = t("Open"); return; }
  msg.textContent = t("Locked. Your data is still on this device.");
}
export function engage() {
  if (el || !isNative || !get().prefs.lock.on) return;
  msg = h("p", { class: "mu", "aria-live": "polite" }, t("Interception is locked."));
  el = h("div", { id: "lock", role: "dialog", "aria-modal": "true", "aria-label": t("Interception is locked.") }, h("div", { class: "mark" }, ic("lock", 40)), h("h2", {}, "Interception"), msg, btn(t("Unlock"), { kind: "primary", onclick: unlock }));
  document.getElementById("root").inert = true; document.body.append(el); unlock();
}
export function initLock() {
  setSecure(isNative && get().prefs.lock.on); engage();
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) { away = Date.now(); return; }
    const t0 = away; away = 0; if (t0 && Date.now() - t0 > AWAY) engage();
  });
}

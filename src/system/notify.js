// Native scheduling through @capacitor/local-notifications. Text is always generic (no personal content).
import { Capacitor } from "@capacitor/core";
import { LocalNotifications as LN } from "@capacitor/local-notifications";
import { get } from "../core/store.js";
import { plan } from "./plan.js";
import { t } from "./i18n.js";
import { openNotificationSettings } from "./native.js";
export const supported = Capacitor.isNativePlatform();
const BODY = { checkin: "A moment for your daily check-in, if you want one.", mood: "A reminder you set in Interception.", habit: "Your scheduled habit is ready when you are." };
// Stable channels (one per kind) so the user tunes sound, vibration and importance per kind in Android's own settings. Created once; creating again is a no-op.
const CH = { habit: ["habits", "Habit reminders", "Reminders for habits you scheduled."], mood: ["mood", "Mood reminders", "A reminder to check in with your mood."], checkin: ["checkin", "Daily check-in", "A gentle daily check-in prompt."] };
const ROUTE = { habit: "habits", mood: "mood/new", checkin: "mood/new" };
let ready = false;
async function channels() {
  if (ready) return; ready = true;
  try { for (const c of (await LN.listChannels()).channels) if (/^r-/.test(c.id)) await LN.deleteChannel({ id: c.id }); } catch { /* old 1.6 channels: best effort */ }
  for (const [id, name, description] of Object.values(CH)) await LN.createChannel({ id, name, description, importance: 3, vibration: true });
}
export const openChannelSettings = openNotificationSettings;
let onTap = () => {};
export const setTapHandler = (f) => { onTap = f; };
if (supported) LN.addListener("localNotificationActionPerformed", (e) => { const k = e.notification && e.notification.extra && e.notification.extra.kind; if (ROUTE[k]) onTap(ROUTE[k]); });
export async function permission() {
  if (!supported) return false;
  try { const c = await LN.checkPermissions(); if (c.display === "granted") return true; return (await LN.requestPermissions()).display === "granted"; } catch { return false; }
}
export async function sync() {
  if (!supported) return;
  try {
    const pend = await LN.getPending();
    if (pend.notifications.length) await LN.cancel({ notifications: pend.notifications.map((n) => ({ id: n.id })) });
    const P = get().prefs;
    if (!P.notif.on || (await LN.checkPermissions()).display !== "granted") return;
    await channels();
    const items = plan(P, get()).map((p) => ({ id: p.id, title: "Interception", body: t(BODY[p.kind]), schedule: { at: p.at, allowWhileIdle: true }, channelId: CH[p.kind][0], extra: { kind: p.kind } }));
    if (items.length) await LN.schedule({ notifications: items });
  } catch (e) { console.warn("reminder sync failed", e); }
}
let tm;
export const syncSoon = () => { clearTimeout(tm); tm = setTimeout(sync, 600); };

// The one place the web layer talks to the Android bridge ("INative", see resources/android/java/NativePlugin.java). On the web every call is a quiet no-op,
// and a native failure never breaks the app: callers get the fallback value.
import { Capacitor, registerPlugin } from "@capacitor/core";
const N = Capacitor.isNativePlatform() ? registerPlugin("INative") : null;
export const isNative = !!N;
const safe = async (f, d) => { try { return N ? await f() : d; } catch { return d; } };
export const setBars = (dark) => safe(() => N.setBars({ dark: !!dark }));
export const getInsets = () => safe(() => N.insets(), null);
export const systemAccent = () => safe(() => N.systemAccent(), { supported: false });
export const setSnapshot = (o) => safe(() => N.setSnapshot({ json: JSON.stringify(o) }));
export const launchRoute = async () => (await safe(() => N.launchRoute(), { route: "" })).route || "";
export const canAuth = async () => (await safe(() => N.canAuth(), { status: "unavailable" })).status;
export const authenticate = (title, subtitle) => safe(() => N.authenticate({ title, subtitle }), { ok: false, code: -1 });
export const setSecure = (on) => safe(() => N.setSecure({ on: !!on }));
export const shareFile = (name, mime, text) => N.shareFile({ name, mime, text }); // rejects when nothing can receive it; the caller reports that
export const openNotificationSettings = () => safe(() => N.openNotificationSettings());
export const on = (name, cb) => { try { N && N.addListener(name, cb); } catch { /* ignore */ } };

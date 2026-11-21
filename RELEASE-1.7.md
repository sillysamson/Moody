# Interception 1.7: implementation notes

Status of each manifest section. "Logic-tested" = covered by `npm test` (80 checks). "Native, untested" = written, but no Android build or device was available while writing; the first CI build and a device run are the real test.

| § | Feature | Where | State |
|---|---|---|---|
| 0.1 | In-place update | `scripts/android-setup.mjs`, `.github/workflows/android.yml`, `interception.jks` in CI secrets | Same applicationId (`com.interception.app`) and same key. versionCode = minutes since 1970 (always rises). versionName `1.7.<run>`. Native, untested |
| 1.1 | No dashboard wordmark | `src/main.js` | Done. Launcher icon is the heart; About unchanged |
| 1.2/1.3 | Mood drag, flower | existing 1.5 slider + flower (no change) | Already present; not re-audited on device |
| 1.4/21.5 | Honest habit empty states, no dash ring | `features/dashboard.js` | Done. Three states: no habits / none today / progress |
| 2 | Customize quiet, Settings + Exit | 1.6 + this | Done |
| 3 | Liquid glass | `ui/glass.js`, tokens, CSS | Chromatic aberration, adaptive tone, shared material, `Transparency effects` setting, solid fallback |
| 4 | Fixed nav, tap only, collapse on scroll | `ui/navbar.js`, `system/navscroll.js` | Done, collapse rule logic-tested |
| 5/21.1 | Add-button morph | `system/shared.js` | Root cause fixed (opaque panel disc and stripped ghost under a glass source). Resize recalculation added. Not seen on a device |
| 7 | Predictive back | manifest `enableOnBackInvokedCallback` | Opt-in only. In-app back stack unchanged. No progress-driven custom animation (not possible from a WebView) |
| 8 | Edge-to-edge | `MainActivity.java`, `--sat/--sab/--sal/--sar` | Native insets pushed to CSS; larger of env() and native wins. Keyboard shrinks the content area. Native, untested |
| 9/14 | Dynamic Color | `NativePlugin.systemAccent`, `palette.js` | Android 12+ wallpaper accent offered as "Wallpaper colours" (hue/chroma mapped into the existing accent system). Falls back to moss. Native views and widgets use system colours (values-v31) |
| 10 | Haptics | 1.5/1.6 system | Unchanged, plus panel close and drag-threshold tick |
| 11 | Notification channels | `system/notify.js` | Stable channels: habits, mood, checkin. Old `r-*` channels removed. Tap opens the right screen. Sound/vibration are set in Android's channel settings (row opens them) |
| 12 | Shortcuts | `res/xml/shortcuts.xml` | Three static shortcuts open Mood check-in, new Diary entry, Zen. They open the screen only |
| 13 | Widgets | `HabitWidget`, `MoodWidget`, `system/snapshot.js` | Today's habits (counts and up to two names) and a mood check-in. Fed by a snapshot the app rewrites after every change. No diary text. Shows an honest prompt when the snapshot is from another day |
| 15 | Drag and drop | `MainActivity.java` | JSON backups dragged in from another app: content URI with a temporary permission, 2 MB cap, always confirmed before replacing data. No diary attachments exist, so there is no other drop target |
| 16 | Adaptive layout | `main.css` | Width-based: wider windows get a 4-column dashboard and a capped content width; landscape bottom spacing; open panels recalculate on resize. Not tested on a foldable |
| 17 | Sharesheet | `NativePlugin.shareFile` | Real `.json` file through a content URI with temporary read grant, preceded by a confirmation. "No app can receive it" is handled |
| 18 | Biometric lock | `features/lock.js`, `NativePlugin.authenticate` | AndroidX BiometricPrompt, device-credential fallback. Locks the whole app on open and after 15 s away. Hides the app from recents while on. Says plainly it does not encrypt. If the device has no screen lock, the user is let in rather than locked out |
| 19 | Settings | `features/settings.js` | Every row is wired. Added: Transparency effects, Wallpaper colours, App lock, Sound and vibration (system) |
| 20 | WebView / production | `capacitor.config.json` | `webContentsDebuggingEnabled: false`. Packaged assets, no dev server. The blue "localhost" tile was the native drag shadow of the page URL (fixed in 1.4 by cancelling `dragstart`, selection untouched); the new drag listener only accepts JSON file drags, so it cannot bring it back |
| 22/23 | Persistence, a11y | | New prefs (`fx`, `lock`) merge into old data by `deepMerge`, so 1.6 data loads unchanged. Removed `prefs.nav` is ignored |

## Not done, on purpose
- No in-app updater. The channel is a signed APK from GitHub Releases, which Android updates in place when installed over the old one. A checker needs a release URL you have not given me, and the manifest says not to assume a host.
- No Google Play In-App Updates (not distributed on Play).
- Predictive-back progress animations.
- Expanded sheets (`.panel`) stay solid, not glass, for reading comfort.

## Upgrade test (release blocker, to be run on a device)
1. Install the current build, add a habit, a mood, a diary entry, change the dashboard layout.
2. `adb shell dumpsys package com.interception.app | grep -E "versionCode|versionName"` and note the signer: `apksigner verify --print-certs`.
3. Install the 1.7 APK over it (no uninstall). Expect "Update", one launcher icon, all data present.
4. Repeat on a clean install.

Note: the first 1.6 builds were signed with a throwaway debug key. Android will refuse to update those; uninstall once, then every later build updates in place.

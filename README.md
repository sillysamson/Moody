# Interception 1.6

A calm, private space for habits, mood, diary, a calendar and a breathing pause. JavaScript, bundled into an Android WebView with Capacitor. Everything stays on the device.

## Develop (works in Termux or any machine with Node 20+)
```bash
npm install
npm run dev        # http://localhost:5173  (development only)
npm test           # pure-logic tests (springs, reminder planner, backup validation, i18n, glass maths)
npm run build      # production bundle in dist/
```

## 1.6 Pass 1 (quick fixes and glass foundation)
No launch splash (the Capacitor splash is removed by `android-setup.mjs`; Android 12+ still shows its own icon-only system splash). Dashboard Customize is a quiet icon button. Settings has one exit: the header gear becomes an exit while Settings is open (no second Back button; Android Back still works). The navigation bar is anchored and cannot be dragged. Glass is clearer, has chromatic aberration at refractive edges (`T.glass.ca`, 0 turns it off), adapts to the background tone (`data-glass`), and secondary buttons and the Add button share the material. Panels give a haptic on close and once when a drag crosses the dismiss threshold.

## Updating without reinstalling
Android only treats a new APK as an update when it has the **same package id, the same signing key and a higher versionCode**. Debug builds are signed with a throwaway key, so each one conflicted with the last. Now every build is signed with one permanent key (`interception.jks`, kept in GitHub Secrets, never in the repo) and `versionCode` = the workflow run number. Install the new APK over the old one; data is kept.

One-time setup: GitHub repo > Settings > Secrets and variables > Actions > add `KEYSTORE_BASE64` (contents of `interception.jks.b64`) and `KEYSTORE_PASSWORD`. Back the keystore up. If it is lost, the next build cannot update installed copies.

Downloads: each push to `main` publishes a signed APK under the repo's Releases page.

## Build the Android APK
**GitHub (recommended):** push to `main`. `.github/workflows/android.yml` runs tests, builds, creates the Android project, patches it and uploads `app-debug.apk` as an artifact.

**Locally** (needs JDK 21 + Android SDK):
```bash
npm install && npm run build
npx cap add android && node scripts/android-setup.mjs
npx cap sync android && cd android && ./gradlew assembleDebug
```
The APK loads the bundled `dist/` assets. `capacitor.config.json` has no `server.url` and sets `webContentsDebuggingEnabled: false`, so no dev server is needed and WebView debugging is off. The launcher icon (heart) is copied from `resources/android/res` by `android-setup.mjs`.

Minimum WebView: Chrome 123 (CSS `light-dark()`). Continuous squircle corners need Chrome 139+; older WebViews show the same radii as plain rounded corners.

## The "localhost" blue tile
Long-pressing a link in Android WebView starts a native link drag whose shadow shows the page URL (`https://localhost/…`). 1.2 used `<a href>` for navigation. 1.3 navigates with `<button>` elements and cancels `dragstart` globally (`src/main.js`); `-webkit-user-drag:none` and `-webkit-touch-callout:none` are set on controls. Text selection in the diary and notes still works. Confirm on a device (see Testing).

## Architecture
```
src/system/   palette (accent colours, OKLCH) · tokens (geometry, spacing, motion, springs, shared-element ids) · motion (spring, enter) ·
              shared (container-transform panels) · haptics (bridge) · prefs (settings persistence + apply) ·
              layout · navpos · moodscale (scale + flower) · hapticplan · notify + plan (reminders) · backup · share · i18n · defaults
src/core/     store (localStorage, schema unchanged from 1.0) · dates · logic · app
src/ui/       background (backgrounds, photo) · dom helper · icons · components (buttons, switch, segmented, slider, dialogs, rows) · glass · navbar
src/features/ dashboard · habits · mood · diary · calendar · zen · settings
src/styles/   tokens.css (colour + elevation, light-dark()) · main.css
```
**Motion.** One spring (`T.spring.sheet`, k 280, c 30, m 1, ζ≈0.9) drives every panel. It starts from the current value *and velocity*, so panels can be grabbed, reversed or retargeted mid-flight. CSS transitions use `--dur-*` and `--ease` from tokens. Reduced motion (system or Settings) turns springs into instant jumps.

**Shared elements.** `openPanel({sid,…})` clones the source element, then morphs one panel (rect, radius, colour, shadow, content) with a single progress value `p`. Closing runs the same `p` back to the *live* position of the source, found again by `data-sid`; if it no longer exists the panel fades. Used for: habit → detail, mood tile → mood report, calendar day → daily overview, diary entry → full entry, floating button → new-habit / new-entry panel, settings category → detail. Drag the handle at the top of a panel to dismiss; release velocity carries into the spring. Android Back closes the top panel (history entry per panel).

**Depth.** Layer 0 background · 1 surfaces (`--s1`) · 2 controls (`--s2`) · 3 floating (nav, dialogs, toasts; translucent, with liquid-glass refraction in Chromium) · 4 scrim.

**Haptics bridge** (`src/system/haptics.js`, one function: `haptic(kind, on?)`; patterns in `hapticplan.js`)
| kind | use | Android (strength Medium: system effect via `performHapticFeedback`) |
|---|---|---|
| select | choosing in segments, chips, calendar, reorder | `SEGMENT_TICK` (API 34) / `CLOCK_TICK` |
| toggle | switches (`on` picks the direction) | `TOGGLE_ON` / `TOGGLE_OFF` (API 34) / `CONTEXT_CLICK` |
| button | ordinary presses | `VIRTUAL_KEY` |
| success | saved, habit done, session complete | `CONFIRM` (API 30) / click composition |
| warning | destructive actions | THUD composition (no system constant exists) |
| error | failed operations | `REJECT` (API 30) / double click composition |
| slider | a value crosses a step (mood scale, font size, hue, blur) | `SEGMENT_FREQUENT_TICK` (API 34) / `CLOCK_TICK` |
| nav | tab changes, Back | `KEYBOARD_TAP` |

Light / Strong strength cannot scale a system effect, so they use `VibrationEffect` compositions instead. Same-tick requests collapse to the strongest, identical repeats within 60 ms are dropped, nothing fires faster than 24 ms apart unless stronger (so a slider drag ticks at steps, never per frame). The global switch lives in Settings, and Android's own *touch feedback* setting is honoured. Fallbacks: Capacitor Haptics, then `navigator.vibrate`.

**Reminders.** `plan()` is a pure function: next 14 days of check-in, mood and habit reminders (habit frequency: off / on scheduled day / one day before / every day until completed), minus quiet hours and completed habits. `sync()` cancels and reschedules through `@capacitor/local-notifications` when settings change, data changes, or the app opens. Text is generic. Sound and vibration choose an Android channel.

## Known limits (read before trusting)
- Written and unit-tested in a sandbox with **no network, no Android SDK and no browser**. `npm install`, the Gradle build, notifications, haptics, squircle rendering, animations and the localhost fix are **unverified on a device**.
- Reminders only schedule on Android (the browser can't). Android may delay inexact alarms under battery optimisation.
- Quiet hours skip reminders; they do not move them.
- Indonesian covers the UI; long privacy paragraphs and a few new strings fall back to English where a key is missing.
- Share backup sends the JSON as text through the Android share sheet.
- Panels animate width/height (content is not reflowed); everything else uses transform and opacity.

## 1.5 changes
**1.4 bug fix: the orphaned Add interface.** The header Add button was never registered as a shared-element source (no `data-sid`), so the Add panel grew from the screen centre. Pages now declare `app.primary = {label, run, sid}` and `render()` stamps the sid on the header button, so every Add panel (habit, diary entry, mood check-in) morphs out of that button and back into it on close. The shared-element clone also dropped a duplicate `id`, and a circular source now starts as a true circle. Measured: panel's first frame = the button's rect (272,14, 46x46); the last frame returns to it.

**Also fixed on the way** (each was reproduced in a browser first):
- Every `btn ghost` (Back, Edit, Cancel, Archive...) collided with the shared-element clone class `.ghost` (`position:absolute; pointer-events:none`), making them unclickable. The clone class is now `.sxg`.
- Dragging a tile moved it in the DOM, which makes the browser drop pointer capture, cancelling the drag after the first swap (1.4's list reorder had this too). Capture is now held on the stable grid.
- The calendar grid overflowed at 320 px width (`1fr` columns). Now `minmax(0,1fr)`.

**Bento dashboard.** Two columns. Each module has sizes: small `s` (half width), medium `m`, large `l` (full width, more content). `spans()` pairs two small tiles per row and widens a lone one, so there are never holes. *Customize* shows the real grid: drag the grip (2-D reorder, FLIP animated, edge auto-scroll, arrow keys on the grip), `-` removes, a size control resizes, hidden modules come back from *Add to dashboard*. Stored in `prefs.dash {order, hidden, sizes}`. The 1.4 per-module option toggles are replaced by sizes (Today: Medium = no habit list; Mood: Medium = quick feelings; Diary: Medium = excerpt; Calendar: Large = month grid). An old saved "hide habit list" maps to Today = Medium.

**Mood check-in.** A two-stage sheet that opens from the header Add button (or the Mood page / dashboard quick feelings). Stage A: a flower and halo as the focal point, a *continuous* slider (1:1 with the finger, a tap far away glides there, the scale step changes with hysteresis so it cannot chatter), live category label, ticks only when the step changes. Stage B: emotions as multi-select chips grouped by where you are on the scale, an expander for more, optional note and strength. Stage B's final action is *Save check-in* (it is the last step, so a second *Next* would go nowhere). Records keep `mood` and `v` and gain `feels: []` (validated in backups; older records keep working).

**Haptics.** Eight semantic kinds (table above), system effects first on Android.

**Accent colour.** Eight presets plus a custom hue/vividness (two sliders: Android WebView does not reliably show a colour picker). One OKLCH generator derives surfaces, text, accent, on-accent, secondary and glow for light AND dark, and it *enforces* contrast (tested over all hues/vividness, standard and high contrast). *Moss* is the shipped hand-tuned palette and generates nothing. Live, persisted in `prefs.accent`.

**Backgrounds.** Aura (the original), Blurred photo, Seascape, Paper, Speckled graphite. Settings > Appearance > Background shows a preview with a mock card and nav and applies only on *Apply*. Static layers (no animation, no per-frame cost); colours derive from the palette so they follow the accent and both appearances. The photo comes from your device (no stock photo is bundled), is downscaled to 960 px, stored under its own key, and gets a veil computed from its average brightness so text directly on it stays at 4.5:1 or better (average tone; blur evens out the rest, a very bright or dark spot can still locally dip).

## 1.4 changes
- **Top-edge tug fixed.** Cause: the whole document scrolled, so Android's native overscroll stretch (and any rubber-band) moved the entire page. Now `html/body` never scroll; content scrolls in `#view` with `overscroll-behavior:none`, and `MainActivity` sets `OVER_SCROLL_NEVER` on the WebView (written by `scripts/android-setup.mjs`). A small guard in `main.js` also resets any stray root offset after a gesture ends.
- **Dashboard** replaces Home (route key stays `home`). Modules: Today, Mood, Diary, Calendar, Zen, Prompt, all built from existing features. *Customize* (on the Dashboard only, not Settings) lets you show/hide modules, toggle what each shows, and reorder by dragging the grip (or Up/Down arrows on the focused grip). Saved in `prefs.dash`; unknown/new/duplicate modules are resolved by `resolveLayout` (tested).
- **Navigation bar:** one glass pill with a drag grip. Only the grip drags. Position is stored as fractions of the free range, clamped below the header and to the screen, re-clamped on rotation/resize, springs back from edges. Reset: Settings > Navigation bar (or Home key on the focused grip).
- **Static button:** the "add" action lives in the header (fixed, not draggable). *1.4 shipped it without a shared element; fixed in this build, see 1.5.*
- **Back button** on Settings, Calendar and Zen. Same path as Android back; opened directly (deep link) it falls back to Dashboard.
- **Mood:** Very unpleasant to Very pleasant (7 steps) with a flower that blooms/wilts with the value (drag or tap the track, arrow keys, screen-reader slider). Saved as `v` (1..7) on the existing mood record; `mood` holds the optional named feeling or the scale label. Old records are untouched. Nothing is saved or changed until you press Save.
- **Geometry** tokens: `--r-ctl 14`, `--r-std 22`, `--r-lg 30`, `--r-float` (pill), `--r-circle`. Icon buttons are true circles; nav/chips/toast are pills.
- **Liquid Glass** follows dashersw/liquid-glass-js: same SDF shapes, edge/rim/corner/ripple refraction terms and parameters (`T.glass`). It is baked into an SVG displacement map used as a live `backdrop-filter` instead of html2canvas + WebGL (no stale snapshot while scrolling, no page capture cost). Fallbacks: blur + tint, then a solid fill for reduced transparency or high contrast.
- **Transitions:** tab changes slide by direction, sub-pages slide in and Back reverses it; the nav highlight slides between items.
- **Haptics:** one service, `haptic(kind)` with kinds `select, pick, tap, confirm, warn, error`. Android uses a small native plugin (`HapticPlugin.java`, generated by `android-setup.mjs`) with composed primitives, then amplitude waveforms, then plain vibrate; it respects the system touch-feedback setting. **The `.wav`/`.ahap` files named in the manifest were not supplied**, so they are not played; the 80/150/230 Hz classes are approximated with THUD/CLICK/TICK primitives. Send the files and the mapping can be tuned against them.

## Verification and what is still unverified
Run in this build's sandbox: `npm test` (75 checks, incl. accent contrast over every hue and the photo veil), and a Chromium (Playwright) regression of 100 checks at 390x844, 360x640, 320x568, 844x390 and 768x1024 in light and dark: Add panels open from and return into the button, mood flow end to end, bento customize/resize/drag/keyboard/persistence, accent and background apply/persist/reload, haptic kinds and the disable switch, no overflow/overlap/console errors. `HapticPlugin.java` was compile-checked against stubbed Android signatures.

Not verified: `vite build` and `npm install` (no network), the Gradle build, and **anything on a physical Android device**: how each haptic constant feels, Android WebView's file chooser for the photo, drag behaviour under real touch (tested with a synthetic mouse), the 1.4 device checks (top-edge pull, nav drag and rotation, real-touch reorder with auto-scroll, localhost link-drag fix), and squircle rendering. The reference images for the mood redesign were not in the files provided, so it follows the written spec.

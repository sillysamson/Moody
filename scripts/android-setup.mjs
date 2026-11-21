// 4. app icon (resources/android/res -> android/app/src/main/res)
// 5. release signing + versionCode in app/build.gradle, so every build is signed with the SAME key and can update the installed app
// Run once after `cap add android`. Patches the generated Android project:
//  1. manifest: permissions, allowBackup=false
//  2. HapticPlugin.java: native haptics through VibrationEffect (the only Android-specific haptic code; JS calls it as plugin "IHaptic")
//  3. 1.7: NativePlugin (insets, bars, dynamic colour, biometrics, share, widgets snapshot, notification settings), MainActivity (edge-to-edge, drag and drop), widgets, shortcuts, predictive back
import { readFileSync, writeFileSync, existsSync, mkdirSync, cpSync, readdirSync, rmSync } from "node:fs";
const f = "android/app/src/main/AndroidManifest.xml";
if (!existsSync(f)) { console.error("Run `npx cap add android` first."); process.exit(1); }
let x = readFileSync(f, "utf8");
for (const p of ["android.permission.VIBRATE", "android.permission.POST_NOTIFICATIONS", "android.permission.RECEIVE_BOOT_COMPLETED"])
  if (!x.includes(p)) x = x.replace("</manifest>", `    <uses-permission android:name="${p}" />\n</manifest>`);
x = x.replace(/<application(?![^>]*allowBackup)/, '<application android:allowBackup="false"');
x = x.replace("@style/AppTheme.NoActionBarLaunch", "@style/AppTheme.NoActionBar"); // 1.6: no launch splash screen / Capacitor splash logo
writeFileSync(f, x);
const res = "android/app/src/main/res";
for (const d of readdirSync(res)) if (d.startsWith("drawable")) for (const n of ["splash.png", "splash.xml"]) rmSync(`${res}/${d}/${n}`, { force: true });


// 5. signing: same keystore every build + rising versionCode = Android installs it as an update, no uninstall.
const g = "android/app/build.gradle";
let b = readFileSync(g, "utf8");
if (!b.includes("signingConfigs.release")) {
  const must = (ok, what) => { if (!ok) { console.error("build.gradle: could not patch " + what); process.exit(1); } };
  must(/versionCode\s+\d+/.test(b) && /versionName\s+"[^"]*"/.test(b), "versionCode/versionName");
  b = b.replace(/versionCode\s+\d+/, 'versionCode Integer.parseInt(System.getenv("VERSION_CODE") ?: "1")')
       .replace(/versionName\s+"[^"]*"/, 'versionName (System.getenv("VERSION_NAME") ?: "1.0")');
  must(/buildTypes\s*\{/.test(b), "buildTypes");
  b = b.replace(/buildTypes\s*\{/, `signingConfigs {
        release {
            if (System.getenv("KEYSTORE_FILE")) {
                storeFile file(System.getenv("KEYSTORE_FILE"))
                storePassword System.getenv("KEYSTORE_PASSWORD")
                keyAlias System.getenv("KEY_ALIAS")
                keyPassword System.getenv("KEYSTORE_PASSWORD")
            }
        }
    }
    buildTypes {`);
  must(/release\s*\{/.test(b.split("buildTypes")[1] || ""), "release block");
  b = b.replace(/(buildTypes\s*\{\s*release\s*\{)/, "$1\n            signingConfig signingConfigs.release");
  writeFileSync(g, b);
}

const pkg = JSON.parse(readFileSync("capacitor.config.json", "utf8")).appId; // Capacitor 7 puts the package in appId / build.gradle namespace, not the manifest
const dir = `android/app/src/main/java/${pkg.replaceAll(".", "/")}`; mkdirSync(dir, { recursive: true });

writeFileSync(`${dir}/HapticPlugin.java`, `package ${pkg};

import android.content.Context;
import android.media.AudioAttributes;
import android.os.Build;
import android.os.VibrationAttributes;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.os.VibratorManager;
import android.provider.Settings;
import android.view.HapticFeedbackConstants;
import android.view.View;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Semantic haptics for Interception. JS sends {kind, level, on, id, s (0..1 strength), n (repeat)}.
 * 1. Strength "medium" (default): the system's own effect via View.performHapticFeedback (HapticFeedbackConstants), which the OS tunes per device.
 * 2. Otherwise, or when this Android version has no matching effect: composed primitives (API 30+) -> amplitude waveform (API 26+) -> plain vibrate.
 *    Android has no frequency control, so the 80/150/230 Hz classes map to THUD / CLICK / TICK+CLICK primitives.
 * Respects the system "touch feedback" setting and uses the TOUCH usage so system vibration settings apply.
 */
@CapacitorPlugin(name = "IHaptic")
public class HapticPlugin extends Plugin {
  private Vibrator vib;

  private Vibrator vibrator() {
    if (vib == null) {
      Context c = getContext();
      if (Build.VERSION.SDK_INT >= 31) {
        VibratorManager m = (VibratorManager) c.getSystemService(Context.VIBRATOR_MANAGER_SERVICE);
        if (m != null) vib = m.getDefaultVibrator();
      }
      if (vib == null) vib = (Vibrator) c.getSystemService(Context.VIBRATOR_SERVICE);
    }
    return vib;
  }

  @PluginMethod
  public void play(PluginCall call) {
    try {
      String kind = call.getString("kind", "button");
      String level = call.getString("level", "medium");
      Boolean onb = call.getBoolean("on", true);
      String id = call.getString("id", "mini");
      Float sf = call.getFloat("s", 1f);
      Integer nn = call.getInt("n", 1);
      float s = Math.max(0.05f, Math.min(1f, sf == null ? 1f : sf));
      int n = Math.max(1, Math.min(3, nn == null ? 1 : nn));
      boolean touchOn = Settings.System.getInt(getContext().getContentResolver(), Settings.System.HAPTIC_FEEDBACK_ENABLED, 1) != 0;
      if (touchOn) {
        int c = "medium".equals(level) ? systemEffect(kind, onb == null || onb) : -1;
        if (c >= 0 && viewHaptic(c)) { call.resolve(); return; }
        Vibrator v = vibrator();
        if (v != null && v.hasVibrator()) perform(v, id, s, n);
      }
    } catch (Exception ignored) {
      // haptics must never crash the app
    }
    call.resolve();
  }

  /** The system's own effect for a kind, or -1 when this Android version has none (a composition is used instead). */
  private int systemEffect(String kind, boolean on) {
    int sdk = Build.VERSION.SDK_INT;
    switch (kind) {
      case "select":  return sdk >= 34 ? HapticFeedbackConstants.SEGMENT_TICK : HapticFeedbackConstants.CLOCK_TICK;
      case "slider":  return sdk >= 34 ? HapticFeedbackConstants.SEGMENT_FREQUENT_TICK : HapticFeedbackConstants.CLOCK_TICK;
      case "nav":     return HapticFeedbackConstants.KEYBOARD_TAP;
      case "button":  return HapticFeedbackConstants.VIRTUAL_KEY;
      case "toggle":  return sdk >= 34 ? (on ? HapticFeedbackConstants.TOGGLE_ON : HapticFeedbackConstants.TOGGLE_OFF) : HapticFeedbackConstants.CONTEXT_CLICK;
      case "success": return sdk >= 30 ? HapticFeedbackConstants.CONFIRM : -1;
      case "error":   return sdk >= 30 ? HapticFeedbackConstants.REJECT : -1;
      default:        return -1; // warning has no system constant: it uses the THUD composition
    }
  }

  private boolean viewHaptic(final int c) {
    if (getBridge() == null || getBridge().getWebView() == null) return false;
    final View w = getBridge().getWebView();
    w.post(new Runnable() { @Override public void run() { w.performHapticFeedback(c); } });
    return true;
  }

  private void perform(Vibrator v, String id, float s, int n) {
    int prim = VibrationEffect.Composition.PRIMITIVE_CLICK, prim2 = -1;
    float scale = 0.8f;
    long ms = 14; int amp = 160;
    switch (id) {
      case "toggle":  prim = VibrationEffect.Composition.PRIMITIVE_TICK;     scale = 0.7f;  ms = 8;  amp = 90;  break;
      case "nav":     prim = VibrationEffect.Composition.PRIMITIVE_LOW_TICK; scale = 0.8f;  ms = 7;  amp = 55;  break;
      case "micro":   prim = VibrationEffect.Composition.PRIMITIVE_LOW_TICK; scale = 0.5f; ms = 6;  amp = 40;  break;
      case "picker":  prim = VibrationEffect.Composition.PRIMITIVE_TICK;     scale = 0.45f; ms = 8; amp = 70;  break;
      case "mini":    prim = VibrationEffect.Composition.PRIMITIVE_CLICK;    scale = 0.4f; ms = 10;  amp = 100; break;
      case "full80":  prim = VibrationEffect.Composition.PRIMITIVE_THUD;     scale = 1f;   ms = 30;  amp = 255; break;
      case "full150": prim = VibrationEffect.Composition.PRIMITIVE_CLICK;    scale = 0.85f; ms = 20; amp = 200; break;
      case "full230": prim = VibrationEffect.Composition.PRIMITIVE_TICK; prim2 = VibrationEffect.Composition.PRIMITIVE_CLICK; scale = 1f; ms = 14; amp = 255; break;
      default: break;
    }
    scale = Math.min(1f, scale * s);
    VibrationEffect effect = null;
    if (Build.VERSION.SDK_INT >= 30) {
      int[] ids = prim2 < 0 ? new int[] {prim} : new int[] {prim, prim2};
      if (v.areAllPrimitivesSupported(ids)) {
        VibrationEffect.Composition c = VibrationEffect.startComposition();
        for (int i = 0; i < n; i++) {
          for (int p : ids) c.addPrimitive(p, scale, i > 0 && p == ids[0] ? 70 : 0);
        }
        effect = c.compose();
      }
    }
    if (effect == null && Build.VERSION.SDK_INT >= 26) {
      int a = Math.max(1, Math.min(255, Math.round(amp * s)));
      if (!v.hasAmplitudeControl()) a = VibrationEffect.DEFAULT_AMPLITUDE;
      if (n == 1) effect = VibrationEffect.createOneShot(ms, a);
      else {
        long[] t = new long[n * 2 - 1]; int[] amps = new int[n * 2 - 1];
        for (int i = 0; i < t.length; i++) { boolean on = i % 2 == 0; t[i] = on ? ms : 70; amps[i] = on ? a : 0; }
        effect = VibrationEffect.createWaveform(t, amps, -1);
      }
    }
    if (effect != null) {
      if (Build.VERSION.SDK_INT >= 33) {
        v.vibrate(effect, new VibrationAttributes.Builder().setUsage(VibrationAttributes.USAGE_TOUCH).build());
      } else {
        v.vibrate(effect, new AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_ASSISTANCE_SONIFICATION).setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION).build());
      }
    } else {
      legacy(v, ms);
    }
  }

  @SuppressWarnings("deprecation")
  private void legacy(Vibrator v, long ms) {
    v.vibrate(ms);
  }
}
`);

// 1.7: native layer. Java templates (package placeholder __PKG__) and Android resources (icons, widgets, shortcuts, strings) are copied in.
const sub = (t) => t.replaceAll("__PKG__", pkg);
for (const n of ["NativePlugin", "MainActivity", "HabitWidget", "MoodWidget"]) writeFileSync(`${dir}/${n}.java`, sub(readFileSync(`resources/android/java/${n}.java`, "utf8")));
cpSync("resources/android/res", "android/app/src/main/res", { recursive: true });
const sx = "android/app/src/main/res/xml/shortcuts.xml"; writeFileSync(sx, sub(readFileSync(sx, "utf8")));

// manifest: predictive back opt-in, launcher shortcuts, interception:// links (shortcuts + widgets), widget receivers
x = readFileSync(f, "utf8");
if (!x.includes("enableOnBackInvokedCallback")) x = x.replace("<application", '<application android:enableOnBackInvokedCallback="true"');
if (!x.includes("android.app.shortcuts")) x = x.replace("</activity>", `        <meta-data android:name="android.app.shortcuts" android:resource="@xml/shortcuts" />
            <intent-filter>
                <action android:name="android.intent.action.VIEW" />
                <category android:name="android.intent.category.DEFAULT" />
                <data android:scheme="interception" android:host="open" />
            </intent-filter>
        </activity>`);
if (!x.includes("HabitWidget")) x = x.replace("</application>", `    <receiver android:name=".HabitWidget" android:exported="false"><intent-filter><action android:name="android.appwidget.action.APPWIDGET_UPDATE" /></intent-filter><meta-data android:name="android.appwidget.provider" android:resource="@xml/habit_widget_info" /></receiver>
        <receiver android:name=".MoodWidget" android:exported="false"><intent-filter><action android:name="android.appwidget.action.APPWIDGET_UPDATE" /></intent-filter><meta-data android:name="android.appwidget.provider" android:resource="@xml/mood_widget_info" /></receiver>
    </application>`);
x = x.replace(/android:debuggable="true"/g, "");
writeFileSync(f, x);

// biometrics (AndroidX Biometric). Everything else uses libraries Capacitor already brings.
b = readFileSync(g, "utf8");
if (!b.includes("androidx.biometric")) { if (!/dependencies\s*\{/.test(b)) { console.error("build.gradle: no dependencies block"); process.exit(1); } b = b.replace(/dependencies\s*\{/, 'dependencies {\n    implementation "androidx.biometric:biometric:1.1.0"'); writeFileSync(g, b); }

console.log("Patched", f, "+ native layer (package", pkg + ")");

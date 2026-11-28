package com.synapse.moodys;

import android.content.Context;
import android.os.Build;
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

// Haptics per HAPTICS.md: medium uses the system effect, light/strong use primitive compositions,
// older devices fall back to one-shots (at least 15 ms when there is no amplitude control).
@CapacitorPlugin(name = "IHaptic")
public class HapticPlugin extends Plugin {
    private Vibrator vib;

    @Override
    public void load() {
        if (Build.VERSION.SDK_INT >= 31) {
            VibratorManager m = (VibratorManager) getContext().getSystemService(Context.VIBRATOR_MANAGER_SERVICE);
            vib = m.getDefaultVibrator();
        } else {
            vib = (Vibrator) getContext().getSystemService(Context.VIBRATOR_SERVICE);
        }
    }

    @PluginMethod
    public void play(PluginCall call) {
        String kind = call.getString("kind", "select");
        String level = call.getString("level", "medium");
        boolean on = Boolean.TRUE.equals(call.getBoolean("on", true));
        try {
            if (Settings.System.getInt(getContext().getContentResolver(), Settings.System.HAPTIC_FEEDBACK_ENABLED, 1) == 0) {
                call.resolve();
                return;
            }
            float lv = "light".equals(level) ? 0.51f : "strong".equals(level) ? 1f : 0.85f;
            if ("medium".equals(level) && system(kind, on)) { call.resolve(); return; }
            compose(kind, lv);
            call.resolve();
        } catch (Exception e) {
            call.reject("haptic failed");
        }
    }

    private boolean system(String kind, boolean on) {
        int sdk = Build.VERSION.SDK_INT;
        int c = -1;
        switch (kind) {
            case "select": c = sdk >= 34 ? HapticFeedbackConstants.SEGMENT_TICK : HapticFeedbackConstants.CLOCK_TICK; break;
            case "slider": c = sdk >= 34 ? HapticFeedbackConstants.SEGMENT_FREQUENT_TICK : HapticFeedbackConstants.CLOCK_TICK; break;
            case "nav": c = HapticFeedbackConstants.KEYBOARD_TAP; break;
            case "button": c = HapticFeedbackConstants.VIRTUAL_KEY; break;
            case "toggle":
                c = sdk >= 34 ? (on ? HapticFeedbackConstants.TOGGLE_ON : HapticFeedbackConstants.TOGGLE_OFF) : HapticFeedbackConstants.CONTEXT_CLICK;
                break;
            case "success": if (sdk >= 30) c = HapticFeedbackConstants.CONFIRM; break;
            case "error": if (sdk >= 30) c = HapticFeedbackConstants.REJECT; break;
            default: break;
        }
        if (c < 0) return false;
        final int fc = c;
        final View v = getActivity().getWindow().getDecorView();
        getActivity().runOnUiThread(() -> v.performHapticFeedback(fc));
        return true;
    }

    private void compose(String kind, float lv) {
        int sdk = Build.VERSION.SDK_INT;
        int tick = sdk >= 30 ? VibrationEffect.Composition.PRIMITIVE_TICK : 0;
        int click = sdk >= 30 ? VibrationEffect.Composition.PRIMITIVE_CLICK : 0;
        int thud = sdk >= 30 ? VibrationEffect.Composition.PRIMITIVE_THUD : 0;
        int low = sdk >= 31 ? VibrationEffect.Composition.PRIMITIVE_LOW_TICK : tick;
        int p1 = low, p2 = -1, ms = 6, amp = 40;
        float base = 0.5f;
        boolean twice = false;
        switch (kind) {
            case "slider": p1 = tick; base = 0.45f; ms = 8; amp = 70; break;
            case "nav": p1 = low; base = 0.8f; ms = 7; amp = 55; break;
            case "toggle": p1 = tick; base = 0.7f; ms = 8; amp = 90; break;
            case "button": p1 = click; base = 0.4f; ms = 10; amp = 100; break;
            case "success": p1 = click; base = 0.85f; ms = 20; amp = 200; break;
            case "warning": p1 = thud; base = 1f; ms = 30; amp = 255; break;
            case "error": p1 = tick; p2 = click; base = 1f; ms = 14; amp = 255; twice = true; break;
            default: break;
        }
        if (vib == null || !vib.hasVibrator()) return;
        float sc = Math.min(1f, base * lv);
        if (sdk >= 30) {
            boolean ok = p2 >= 0 ? allSupported(p1, p2) : allSupported(p1);
            if (ok) {
                VibrationEffect.Composition c = VibrationEffect.startComposition();
                c.addPrimitive(p1, sc);
                if (p2 >= 0) c.addPrimitive(p2, sc);
                if (twice) {
                    c.addPrimitive(p1, sc, 70);
                    if (p2 >= 0) c.addPrimitive(p2, sc);
                }
                vib.vibrate(c.compose());
                return;
            }
        }
        oneShot(ms, Math.max(1, Math.min(255, Math.round(amp * lv))), twice);
    }

    private boolean allSupported(int... ps) {
        return Build.VERSION.SDK_INT >= 30 && vib.areAllPrimitivesSupported(ps);
    }

    @SuppressWarnings("deprecation")
    private void oneShot(int ms, int amp, boolean twice) {
        boolean ampCtl = Build.VERSION.SDK_INT >= 26 && vib.hasAmplitudeControl();
        int dur = ampCtl ? ms : Math.max(ms, 15);
        if (Build.VERSION.SDK_INT >= 26) {
            int a = ampCtl ? amp : VibrationEffect.DEFAULT_AMPLITUDE;
            if (twice) {
                vib.vibrate(ampCtl
                    ? VibrationEffect.createWaveform(new long[]{0, dur, 70, dur}, new int[]{0, a, 0, a}, -1)
                    : VibrationEffect.createWaveform(new long[]{0, dur, 70, dur}, -1));
            } else {
                vib.vibrate(VibrationEffect.createOneShot(dur, a));
            }
        } else {
            vib.vibrate(dur);
        }
    }
}

package com.synapse.moodys;

import androidx.activity.BackEventCompat;
import androidx.activity.OnBackPressedCallback;
import androidx.annotation.NonNull;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

// Predictive back: while a screen is open the web app enables this callback and gets the swipe progress.
// With no screen open it stays disabled, so the system back-to-home preview plays as usual.
@CapacitorPlugin(name = "PredictiveBack")
public class BackPlugin extends Plugin {
    private OnBackPressedCallback cb;

    @Override
    public void load() {
        cb = new OnBackPressedCallback(false) {
            @Override public void handleOnBackStarted(@NonNull BackEventCompat e) { emit("backStart", e); }
            @Override public void handleOnBackProgressed(@NonNull BackEventCompat e) { emit("backProgress", e); }
            @Override public void handleOnBackCancelled() { notifyListeners("backCancel", new JSObject()); }
            @Override public void handleOnBackPressed() { notifyListeners("backCommit", new JSObject()); }
        };
        getActivity().getOnBackPressedDispatcher().addCallback(getActivity(), cb);
    }

    private void emit(String name, BackEventCompat e) {
        JSObject o = new JSObject();
        o.put("progress", e.getProgress());
        o.put("edge", e.getSwipeEdge());
        notifyListeners(name, o);
    }

    @PluginMethod
    public void setActive(final PluginCall call) {
        final boolean active = Boolean.TRUE.equals(call.getBoolean("active", false));
        getActivity().runOnUiThread(() -> { cb.setEnabled(active); call.resolve(); });
    }
}

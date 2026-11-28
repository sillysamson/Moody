package com.synapse.moodys;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(HapticPlugin.class);
        registerPlugin(BackPlugin.class);
        super.onCreate(savedInstanceState);
    }
}

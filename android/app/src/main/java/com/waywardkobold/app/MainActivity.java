package com.waywardkobold.app;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onPause() {
        if (bridge != null) {
            bridge.triggerWindowJSEvent("delveAppState", "{\"isActive\":false}");
        }
        super.onPause();
    }

    @Override
    public void onResume() {
        super.onResume();
        if (bridge != null) {
            bridge.triggerWindowJSEvent("delveAppState", "{\"isActive\":true}");
        }
    }
}

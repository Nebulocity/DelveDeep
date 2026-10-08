package com.waywardkobold.app;

import com.getcapacitor.BridgeActivity;


// Capacitor hosts the web game in this Android activity. Most gameplay stays in JavaScript.
public class MainActivity extends BridgeActivity {

    @Override
    public void onPause() {

        // Tell BackgroundProgress that Android is hiding the app before the base activity pauses.
        // The escaped JSON becomes event data in JavaScript: { isActive: false }.
        // bridge can be absent during startup or teardown, so check it before sending.
        if (bridge != null) {
            bridge.triggerWindowJSEvent("delveAppState", "{\"isActive\":false}");
        }

        // Let Capacitor finish its normal pause handling after sending our notification.
        super.onPause();
    }

    @Override
    public void onResume() {

        // Resume Capacitor first so the web bridge is ready to receive the foreground event.
        super.onResume();

        // The JavaScript service accounts for the time missed while Android suspended the app.
        if (bridge != null) {
            bridge.triggerWindowJSEvent("delveAppState", "{\"isActive\":true}");
        }
    }
}

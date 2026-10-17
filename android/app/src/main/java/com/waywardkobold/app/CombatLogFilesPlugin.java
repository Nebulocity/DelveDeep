package com.waywardkobold.app;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.ClipData;
import android.content.Intent;
import android.net.Uri;
import androidx.activity.result.ActivityResult;
import androidx.core.content.FileProvider;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;

// Export only the JSON provided by the game. The picker and temporary URI grants avoid
// broad storage permissions, and saving to Documents/Downloads survives uninstalling.
@CapacitorPlugin(name = "CombatLogFiles")
public class CombatLogFilesPlugin extends Plugin {
    private static final int MAX_BYTES = 64 * 1024 * 1024;

    @PluginMethod
    public void exportFile(PluginCall call) {
        String text = call.getString("text");
        String filename = call.getString("filename", "delve-combat.json");
        if (text == null || text.length() > MAX_BYTES
            || !filename.matches("[A-Za-z0-9._-]+\\.json")) {
            call.reject("Invalid combat log export.");
            return;
        }
        // Encoding and file writes run on Capacitor's worker executor, not the UI thread.
        execute(() -> {
            byte[] bytes = text.getBytes(StandardCharsets.UTF_8);
            if (bytes.length > MAX_BYTES) {
                call.reject("This log exceeds the 64 MB Android export limit. Export shorter recording sessions.");
                return;
            }
            getActivity().runOnUiThread(() -> new AlertDialog.Builder(getActivity())
                .setTitle("Export combat log")
                .setItems(new String[] { "Save JSON file", "Share JSON file" }, (dialog, choice) -> {
                    if (choice == 0) {
                        Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
                        intent.addCategory(Intent.CATEGORY_OPENABLE);
                        intent.setType("application/json");
                        intent.putExtra(Intent.EXTRA_TITLE, filename);
                        try {
                            startActivityForResult(call, intent, "savedLog");
                        } catch (Exception ignored) {
                            call.reject("Could not open the Android save picker. The recording is still kept in the app.");
                        }
                    } else {
                        shareLog(call, bytes, filename);
                    }
                })
                .setNegativeButton("Cancel", (dialog, which) -> call.resolve(new JSObject().put("cancelled", true)))
                .setOnCancelListener(dialog -> call.resolve(new JSObject().put("cancelled", true)))
                .show());
        });
    }

    @ActivityCallback
    private void savedLog(PluginCall call, ActivityResult result) {
        if (call == null) return;
        Uri uri = result.getData() == null ? null : result.getData().getData();
        if (result.getResultCode() != Activity.RESULT_OK || uri == null) {
            call.resolve(new JSObject().put("cancelled", true));
            return;
        }
        execute(() -> {
            try (OutputStream stream = getContext().getContentResolver().openOutputStream(uri, "w")) {
                if (stream == null) throw new IllegalStateException("No output stream");
                stream.write(call.getString("text").getBytes(StandardCharsets.UTF_8));
                stream.flush();
                call.resolve(new JSObject().put("cancelled", false).put("saved", true));
            } catch (Exception ignored) {
                call.reject("Could not save the JSON file. The recording is still kept in the app; choose another location and try again.");
            }
        });
    }

    private void shareLog(PluginCall call, byte[] bytes, String filename) {
        execute(() -> {
            try {
                // Each share gets its own folder so another export cannot overwrite an
                // attachment while a recipient app is still reading it. Android may evict
                // cache files later; the actual recording remains in IndexedDB.
                File root = new File(getContext().getCacheDir(), "combat-log-exports");
                if (!root.exists() && !root.mkdirs()) throw new IllegalStateException("No export directory");
                File temporary = File.createTempFile("log-", ".tmp", root);
                if (!temporary.delete() || !temporary.mkdir()) throw new IllegalStateException("No share directory");
                File file = new File(temporary, filename);
                try (OutputStream stream = new FileOutputStream(file)) {
                    stream.write(bytes);
                }
                Uri uri = FileProvider.getUriForFile(getContext(), getContext().getPackageName() + ".fileprovider", file);
                Intent send = new Intent(Intent.ACTION_SEND);
                send.setType("application/json");
                send.putExtra(Intent.EXTRA_STREAM, uri);
                send.putExtra(Intent.EXTRA_SUBJECT, "Delve Deep combat log");
                send.setClipData(ClipData.newRawUri("Combat log", uri));
                send.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                Intent chooser = Intent.createChooser(send, "Send combat log");
                chooser.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                getActivity().runOnUiThread(() -> {
                    try {
                        getActivity().startActivity(chooser);
                        // Android cannot confirm that the recipient app sent the file.
                        call.resolve(new JSObject().put("cancelled", false).put("shareOpened", true));
                    } catch (Exception ignored) {
                        call.reject("Could not open sharing. Try Save JSON file instead; the recording is still kept in the app.");
                    }
                });
            } catch (Exception ignored) {
                call.reject("Could not prepare the JSON attachment. The recording is still kept in the app.");
            }
        });
    }
}

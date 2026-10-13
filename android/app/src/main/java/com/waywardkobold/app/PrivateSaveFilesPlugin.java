package com.waywardkobold.app;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import androidx.activity.result.ActivityResult;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.InputStream;
import java.io.OutputStream;
import java.io.ByteArrayOutputStream;
import java.nio.charset.StandardCharsets;

// The document picker grants access to the one file the player chooses. No broad
// storage permission is needed, and the chosen destination survives app uninstall.
@CapacitorPlugin(name = "PrivateSaveFiles")
public class PrivateSaveFilesPlugin extends Plugin {
    private static final int MAX_BYTES = 12 * 1024 * 1024;

    @PluginMethod
    public void saveFile(PluginCall call) {
        String text = call.getString("text");
        String filename = call.getString("filename", "DelveDeep-backup.ddsave");
        if (text == null || text.getBytes(StandardCharsets.UTF_8).length > MAX_BYTES
            || !filename.matches("[A-Za-z0-9._-]+\\.ddsave")) {
            call.reject("Invalid backup file.");
            return;
        }
        Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        intent.setType("application/octet-stream");
        intent.putExtra(Intent.EXTRA_TITLE, filename);
        startActivityForResult(call, intent, "savedDocument");
    }

    @PluginMethod
    public void openFile(PluginCall call) {
        Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        intent.setType("*/*");
        startActivityForResult(call, intent, "openedDocument");
    }

    // File I/O can involve a cloud document provider. Run it off the UI thread and
    // resolve only after writing and closing the stream, so cancellation cannot restore.
    @ActivityCallback
    private void savedDocument(PluginCall call, ActivityResult result) {
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
            } catch (Exception ignored) {
                call.reject("Could not save the backup. Choose another location and try again.");
                return;
            }
            call.resolve(new JSObject().put("cancelled", false));
        });
    }

    @ActivityCallback
    private void openedDocument(PluginCall call, ActivityResult result) {
        if (call == null) return;
        Uri uri = result.getData() == null ? null : result.getData().getData();
        if (result.getResultCode() != Activity.RESULT_OK || uri == null) {
            call.resolve(new JSObject().put("cancelled", true));
            return;
        }
        execute(() -> {
            try (InputStream stream = getContext().getContentResolver().openInputStream(uri);
                 ByteArrayOutputStream bytes = new ByteArrayOutputStream()) {
                if (stream == null) throw new IllegalStateException("No input stream");
                byte[] buffer = new byte[8192];
                int count;
                while ((count = stream.read(buffer)) != -1) {
                    if (bytes.size() + count > MAX_BYTES) throw new IllegalArgumentException("Backup too large");
                    bytes.write(buffer, 0, count);
                }
                call.resolve(new JSObject().put("cancelled", false)
                    .put("text", bytes.toString(StandardCharsets.UTF_8)));
            } catch (Exception ignored) {
                call.reject("Could not read the backup, or it exceeds 12 MB.");
            }
        });
    }
}

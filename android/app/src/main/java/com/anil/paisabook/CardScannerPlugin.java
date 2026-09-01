package com.anil.paisabook;

import android.Manifest;
import android.app.Activity;
import android.content.Intent;

import androidx.activity.result.ActivityResult;

import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

/**
 * Opens a live camera scanner that reads a payment card with on-device OCR.
 *
 * The full card number never crosses into the web layer: the scanner activity uses it only
 * to run the Luhn check and work out the network, then returns the last four digits.
 */
@CapacitorPlugin(
    name = "CardScanner",
    permissions = {
        @Permission(strings = { Manifest.permission.CAMERA }, alias = CardScannerPlugin.CAMERA)
    }
)
public class CardScannerPlugin extends Plugin {

    static final String CAMERA = "camera";

    @PluginMethod
    public void scan(PluginCall call) {
        if (getPermissionState(CAMERA) != PermissionState.GRANTED) {
            requestPermissionForAlias(CAMERA, call, "cameraPermissionCallback");
        } else {
            launchScanner(call);
        }
    }

    @PermissionCallback
    private void cameraPermissionCallback(PluginCall call) {
        if (getPermissionState(CAMERA) == PermissionState.GRANTED) {
            launchScanner(call);
        } else {
            call.reject("Camera permission was denied", "PERMISSION_DENIED");
        }
    }

    private void launchScanner(PluginCall call) {
        Intent intent = new Intent(getContext(), CardScanActivity.class);
        startActivityForResult(call, intent, "scanResult");
    }

    @ActivityCallback
    private void scanResult(PluginCall call, ActivityResult result) {
        if (call == null) {
            return;
        }
        JSObject ret = new JSObject();
        Intent data = result.getData();

        if (result.getResultCode() != Activity.RESULT_OK || data == null) {
            ret.put("cancelled", true);
            call.resolve(ret);
            return;
        }

        ret.put("cancelled", false);
        ret.put("last4", data.getStringExtra(CardScanActivity.EXTRA_LAST4));
        ret.put("network", data.getStringExtra(CardScanActivity.EXTRA_NETWORK));
        ret.put("expiry", data.getStringExtra(CardScanActivity.EXTRA_EXPIRY));
        call.resolve(ret);
    }
}

package com.vibecode.redcarpet;

import android.Manifest;
import android.annotation.SuppressLint;
import android.content.Intent;
import android.net.Uri;

import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

// Llama directamente con ACTION_CALL para que la app permanezca activa en background.
// Si el permiso CALL_PHONE no está concedido, solicita y reintenta; si se deniega,
// abre el marcador (ACTION_DIAL) como fallback.
@CapacitorPlugin(
    name = "CallPhone",
    permissions = {
        @Permission(strings = { Manifest.permission.CALL_PHONE }, alias = "callPhone")
    }
)
public class CallPhonePlugin extends Plugin {

    private static final String DEFAULT_NUMBER = "112";

    @PluginMethod
    public void call(PluginCall call) {
        String number = call.getString("number", DEFAULT_NUMBER);
        call.setKeepAlive(true);

        if (getPermissionState("callPhone") == PermissionState.GRANTED) {
            makeDirectCall(call, number);
        } else {
            requestPermissionForAlias("callPhone", call, "callPermissionResult");
        }
    }

    @PermissionCallback
    private void callPermissionResult(PluginCall call) {
        String number = call.getString("number", DEFAULT_NUMBER);
        if (getPermissionState("callPhone") == PermissionState.GRANTED) {
            makeDirectCall(call, number);
        } else {
            openDialer(call, number);
        }
    }

    @SuppressLint("MissingPermission")
    private void makeDirectCall(PluginCall call, String number) {
        try {
            Intent intent = new Intent(Intent.ACTION_CALL, Uri.parse("tel:" + number));
            getActivity().startActivity(intent);
            call.resolve();
        } catch (Exception e) {
            openDialer(call, number);
        }
    }

    private void openDialer(PluginCall call, String number) {
        Intent intent = new Intent(Intent.ACTION_DIAL, Uri.parse("tel:" + number));
        getActivity().startActivity(intent);
        call.resolve();
    }
}

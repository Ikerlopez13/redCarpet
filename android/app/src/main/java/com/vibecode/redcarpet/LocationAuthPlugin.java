package com.vibecode.redcarpet;

import android.Manifest;
import android.content.pm.PackageManager;
import android.os.Build;

import androidx.core.content.ContextCompat;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

// Detección EXACTA del nivel de permiso de ubicación:
//   always     → foreground concedido + ACCESS_BACKGROUND_LOCATION concedido
//                 (en Android < 10 el background va implícito con el fine/coarse)
//   foreground → fine/coarse concedido pero SIN background ("mientras se usa")
//   denied     → sin permiso de ubicación
// (Android no tiene el estado "prompt/notDetermined" fiable como iOS; si no está
//  concedido se reporta 'denied' y el flujo pedirá el permiso.)
@CapacitorPlugin(name = "LocationAuth")
public class LocationAuthPlugin extends Plugin {

    @PluginMethod
    public void check(PluginCall call) {
        boolean fine = granted(Manifest.permission.ACCESS_FINE_LOCATION);
        boolean coarse = granted(Manifest.permission.ACCESS_COARSE_LOCATION);
        boolean foreground = fine || coarse;

        String status;
        if (!foreground) {
            status = "denied";
        } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            // Android 10+: el background es un permiso separado.
            boolean background = granted(Manifest.permission.ACCESS_BACKGROUND_LOCATION);
            status = background ? "always" : "foreground";
        } else {
            // Android 9 y anteriores: el permiso de ubicación ya cubre background.
            status = "always";
        }

        JSObject ret = new JSObject();
        ret.put("status", status);
        call.resolve(ret);
    }

    private boolean granted(String permission) {
        return ContextCompat.checkSelfPermission(getContext(), permission)
                == PackageManager.PERMISSION_GRANTED;
    }
}

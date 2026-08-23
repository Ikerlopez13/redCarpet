import Foundation
import Capacitor
import CoreLocation

// Detección EXACTA del nivel de permiso de ubicación en iOS mediante
// CLLocationManager.authorizationStatus:
//   always     → authorizedAlways ("Siempre")
//   foreground → authorizedWhenInUse ("Mientras se usa")
//   denied     → denied / restricted
//   prompt     → notDetermined (aún no se ha preguntado)
//
// Plugin app-local con CAPBridgedPlugin (Capacitor 6): no requiere fichero .m.
@objc(LocationAuthPlugin)
public class LocationAuthPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "LocationAuthPlugin"
    public let jsName = "LocationAuth"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "check", returnType: CAPPluginReturnPromise)
    ]

    @objc func check(_ call: CAPPluginCall) {
        let status: CLAuthorizationStatus
        if #available(iOS 14.0, *) {
            status = CLLocationManager().authorizationStatus
        } else {
            status = CLLocationManager.authorizationStatus()
        }

        var result = "prompt"
        switch status {
        case .authorizedAlways:
            result = "always"
        case .authorizedWhenInUse:
            result = "foreground"
        case .denied, .restricted:
            result = "denied"
        case .notDetermined:
            result = "prompt"
        @unknown default:
            result = "prompt"
        }

        call.resolve(["status": result])
    }
}

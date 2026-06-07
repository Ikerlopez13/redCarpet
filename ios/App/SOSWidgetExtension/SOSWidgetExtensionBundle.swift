//
//  SOSWidgetExtensionBundle.swift
//  SOSWidgetExtension
//
//  Created by Iker López Alegre on 31/05/2026.
//

import WidgetKit
import SwiftUI

@main
struct SOSWidgetExtensionBundle: WidgetBundle {
    var body: some Widget {
        SOSWidgetExtension()
        SOSWidgetExtensionControl()
        SOSWidgetExtensionLiveActivity()
    }
}

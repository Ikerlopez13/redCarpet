import WidgetKit
import SwiftUI

struct Provider: TimelineProvider {
    func placeholder(in context: Context) -> SimpleEntry {
        SimpleEntry(date: Date())
    }

    func getSnapshot(in context: Context, completion: @escaping (SimpleEntry) -> ()) {
        let entry = SimpleEntry(date: Date())
        completion(entry)
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<Entry>) -> ()) {
        var entries: [SimpleEntry] = []
        // Static widget, no need to update frequently
        entries.append(SimpleEntry(date: Date()))
        let timeline = Timeline(entries: entries, policy: .never)
        completion(timeline)
    }
}

struct SimpleEntry: TimelineEntry {
    let date: Date
}

struct SOSWidgetExtensionEntryView : View {
    var entry: Provider.Entry

    var body: some View {
        ZStack {
            // Background
            Color(red: 0.1, green: 0.05, blue: 0.05)
            
            VStack {
                Spacer()
                
                // SOS Button simulation
                ZStack {
                    Circle()
                        .fill(Color.red)
                        .frame(width: 80, height: 80)
                        .shadow(color: Color.red.opacity(0.8), radius: 10, x: 0, y: 0)
                    
                    Text("SOS")
                        .font(.system(size: 24, weight: .black, design: .rounded))
                        .foregroundColor(.white)
                }
                
                Spacer()
                
                Text("PULSAR")
                    .font(.system(size: 10, weight: .bold))
                    .foregroundColor(.white.opacity(0.6))
                    .padding(.bottom, 8)
            }
        }
        .widgetURL(URL(string: "com.vibecode.redcarpet://sos/activate"))
    }
}

struct SOSWidgetExtension: Widget {
    let kind: String = "SOSWidgetExtension"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: Provider()) { entry in
            if #available(iOS 17.0, *) {
                SOSWidgetExtensionEntryView(entry: entry)
                    .containerBackground(Color(red: 0.1, green: 0.05, blue: 0.05), for: .widget)
            } else {
                SOSWidgetExtensionEntryView(entry: entry)
                    .background(Color(red: 0.1, green: 0.05, blue: 0.05))
            }
        }
        .configurationDisplayName("Botón de SOS")
        .description("Abre la app e inicia una alerta de emergencia.")
        .supportedFamilies([.systemSmall])
    }
}

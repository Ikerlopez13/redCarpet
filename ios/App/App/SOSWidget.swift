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
        let entries = [SimpleEntry(date: Date())]
        let timeline = Timeline(entries: entries, policy: .never)
        completion(timeline)
    }
}

struct SimpleEntry: TimelineEntry {
    let date: Date
}

struct SOSWidgetEntryView : View {
    var entry: Provider.Entry

    var body: some View {
        ZStack {
            Color.black
            
            VStack {
                Link(destination: URL(string: "com.vibecode.redcarpet://travel/activate")!) {
                    ZStack {
                        Circle()
                            .fill(Color(red: 1.0, green: 0.19, blue: 0.19)) // Urban Guide Primary Red
                            .shadow(color: Color(red: 1.0, green: 0.19, blue: 0.19).opacity(0.3), radius: 10)
                        
                        Text("GO")
                            .font(.system(size: 20, weight: .black, design: .rounded))
                            .italic()
                            .foregroundColor(.white)
                    }
                    .frame(width: 80, height: 80)
                }
            }
        }
    }
}

@main
struct SOSWidget: Widget {
    let kind: String = "SOSWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: Provider()) { entry in
            SOSWidgetEntryView(entry: entry)
        }
        .configurationDisplayName("Urban Guide")
        .description("Activate your journey companion instantly.")
        .supportedFamilies([.systemSmall])
    }
}

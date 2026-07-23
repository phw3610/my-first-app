import SwiftUI
import WidgetKit

struct TodayEntry: TimelineEntry {
  let date: Date
  let todos: [SharedTodo]
}

struct TodayProvider: TimelineProvider {
  func placeholder(in context: Context) -> TodayEntry {
    TodayEntry(date: .now, todos: [])
  }

  func getSnapshot(in context: Context, completion: @escaping (TodayEntry) -> Void) {
    completion(TodayEntry(date: .now, todos: loadSharedSnapshot().todos.filter { $0.isToday }))
  }

  func getTimeline(in context: Context, completion: @escaping (Timeline<TodayEntry>) -> Void) {
    let todos = loadSharedSnapshot().todos.filter { $0.isToday }
    completion(Timeline(entries: [TodayEntry(date: .now, todos: todos)], policy: .never))
  }
}

struct TodayWidgetView: View {
  var entry: TodayEntry
  @Environment(\.widgetFamily) var family

  var body: some View {
    let maxRows = family == .systemSmall ? 3 : 6
    VStack(alignment: .leading, spacing: 6) {
      HStack {
        Text("🥚 오늘 할일")
          .font(.caption)
          .fontWeight(.bold)
          .foregroundStyle(.secondary)
        Spacer()
        Text("\(entry.todos.count)")
          .font(.caption)
          .fontWeight(.bold)
      }
      if entry.todos.isEmpty {
        Spacer()
        Text("오늘 할일이 없어요")
          .font(.footnote)
          .foregroundStyle(.secondary)
        Spacer()
      } else {
        ForEach(Array(entry.todos.prefix(maxRows)), id: \.id) { todo in
          HStack(spacing: 4) {
            Text(todo.important ? "⭐" : "🥚")
              .font(.caption2)
            Text(todo.title)
              .font(.caption)
              .lineLimit(1)
          }
        }
        Spacer(minLength: 0)
      }
    }
    .padding()
    .containerBackground(.fill.tertiary, for: .widget)
  }
}

struct TodayWidget: Widget {
  let kind = "TodayWidget"

  var body: some WidgetConfiguration {
    StaticConfiguration(kind: kind, provider: TodayProvider()) { entry in
      TodayWidgetView(entry: entry)
    }
    .configurationDisplayName("오늘 할일")
    .description("오늘 마감이거나 진행 중인 할 일을 보여줍니다.")
    .supportedFamilies([.systemSmall, .systemMedium])
  }
}

import AppIntents
import SwiftUI
import WidgetKit

struct CategoryEntity: AppEntity {
  let id: String
  let name: String

  static var typeDisplayRepresentation: TypeDisplayRepresentation = "분류"
  static var defaultQuery = CategoryQuery()

  var displayRepresentation: DisplayRepresentation {
    DisplayRepresentation(title: "\(name)")
  }
}

struct CategoryQuery: EntityQuery {
  func entities(for identifiers: [String]) async throws -> [CategoryEntity] {
    loadSharedSnapshot().categories
      .filter { identifiers.contains($0.id) }
      .map { CategoryEntity(id: $0.id, name: $0.name) }
  }

  func suggestedEntities() async throws -> [CategoryEntity] {
    loadSharedSnapshot().categories.map { CategoryEntity(id: $0.id, name: $0.name) }
  }
}

struct CategoryWidgetConfigIntent: WidgetConfigurationIntent {
  static var title: LocalizedStringResource = "분류 선택"
  static var description = IntentDescription("미완료 항목을 보여줄 분류를 선택하세요.")

  @Parameter(title: "분류")
  var category: CategoryEntity?
}

struct CategoryEntry: TimelineEntry {
  let date: Date
  let categoryName: String
  let todos: [SharedTodo]
}

struct CategoryProvider: AppIntentTimelineProvider {
  func placeholder(in context: Context) -> CategoryEntry {
    CategoryEntry(date: .now, categoryName: "분류", todos: [])
  }

  func snapshot(for configuration: CategoryWidgetConfigIntent, in context: Context) async -> CategoryEntry {
    makeEntry(configuration: configuration)
  }

  func timeline(
    for configuration: CategoryWidgetConfigIntent,
    in context: Context
  ) async -> Timeline<CategoryEntry> {
    Timeline(entries: [makeEntry(configuration: configuration)], policy: .never)
  }

  private func makeEntry(configuration: CategoryWidgetConfigIntent) -> CategoryEntry {
    guard let category = configuration.category else {
      return CategoryEntry(date: .now, categoryName: "분류를 선택하세요", todos: [])
    }
    let todos = loadSharedSnapshot().todos.filter { $0.categoryId == category.id }
    return CategoryEntry(date: .now, categoryName: category.name, todos: todos)
  }
}

struct CategoryWidgetView: View {
  var entry: CategoryEntry
  @Environment(\.widgetFamily) var family

  var body: some View {
    let maxRows = family == .systemSmall ? 3 : 6
    VStack(alignment: .leading, spacing: 6) {
      HStack {
        Text(entry.categoryName)
          .font(.caption)
          .fontWeight(.bold)
          .lineLimit(1)
        Spacer()
        Text("\(entry.todos.count)")
          .font(.caption)
          .fontWeight(.bold)
      }
      if entry.todos.isEmpty {
        Spacer()
        Text("미완료 항목이 없어요")
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

struct CategoryWidget: Widget {
  let kind = "CategoryWidget"

  var body: some WidgetConfiguration {
    AppIntentConfiguration(
      kind: kind,
      intent: CategoryWidgetConfigIntent.self,
      provider: CategoryProvider()
    ) { entry in
      CategoryWidgetView(entry: entry)
    }
    .configurationDisplayName("분류별 할 일")
    .description("선택한 분류의 미완료 할 일을 보여줍니다.")
    .supportedFamilies([.systemSmall, .systemMedium])
  }
}

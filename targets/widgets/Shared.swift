import Foundation

let appGroupId = "group.com.phw3610.myfirstapp"

struct SharedTodo: Codable {
  let id: String
  let title: String
  let categoryId: String?
  let totalSteps: Int
  let doneSteps: Int
  let important: Bool
  let pinned: Bool
  let isToday: Bool
}

struct SharedCategory: Codable {
  let id: String
  let name: String
  let color: String
}

struct WidgetSnapshot: Codable {
  let updatedAt: String
  let categories: [SharedCategory]
  let todos: [SharedTodo]
}

// 메인 앱이 App Group 공유 컨테이너에 써 둔 스냅샷을 읽는다. 없으면 빈 스냅샷.
func loadSharedSnapshot() -> WidgetSnapshot {
  guard
    let url = FileManager.default
      .containerURL(forSecurityApplicationGroupIdentifier: appGroupId)?
      .appendingPathComponent("widget-data.json"),
    let data = try? Data(contentsOf: url),
    let snapshot = try? JSONDecoder().decode(WidgetSnapshot.self, from: data)
  else {
    return WidgetSnapshot(updatedAt: "", categories: [], todos: [])
  }
  return snapshot
}

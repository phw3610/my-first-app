import ExpoModulesCore
import WidgetKit

private let appGroupId = "group.com.phw3610.myfirstapp"

public class WidgetBridgeModule: Module {
  public func definition() -> ModuleDefinition {
    Name("WidgetBridge")

    // 위젯이 읽을 App Group 공유 컨테이너에 JSON 스냅샷을 쓰고 타임라인을 갱신한다.
    Function("syncWidgetData") { (json: String) in
      guard let containerURL = FileManager.default.containerURL(
        forSecurityApplicationGroupIdentifier: appGroupId
      ) else { return }
      let fileURL = containerURL.appendingPathComponent("widget-data.json")
      try? json.data(using: .utf8)?.write(to: fileURL, options: .atomic)
      WidgetCenter.shared.reloadAllTimelines()
    }
  }
}

/** @type {import('@bacons/apple-targets/app.plugin').Config} */
module.exports = {
  type: 'widget',
  name: 'QuackWidgets',
  displayName: '꽥! 투두',
  deploymentTarget: '17.0',
  frameworks: ['WidgetKit', 'SwiftUI', 'AppIntents'],
  colors: {
    $accent: '#FF9E2C',
  },
  // App Group은 app.json의 ios.entitlements에서 자동으로 이어받는다.
};

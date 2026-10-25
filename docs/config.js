// 画面の設定（GAS の Web アプリの URL・action の名前・LIFF ID・教室）。
// 中身：window.APP_CONFIG。読むところ：learn.html・admin.html・index.html（ほかの js より先に）。
window.APP_CONFIG = {
  gasWebAppUrl: "https://script.google.com/macros/s/AKfycbx7Y2q-UDDP-SfzEu7UmN94lXpLSdkl6xFwkVUncBJiYffvfI2QPm2T75et-cK6n-tCAA/exec",
  healthAction: "health",
  setupStatusAction: "getSetupStatus",
  bootstrapAction: "bootstrapLearning",
  meAction: "getMe",
  homeAction: "getHome",
  resolveDailySessionAction: "resolveDailySession",
  createAnswerEventAction: "createAnswerEvent",
  createShareReceiptAction: "createShareReceipt",
  adminLearnersAction: "listAdminLearners",
  adminLearnerDetailAction: "getAdminLearnerDetail",
  liffId: "2011071914-4lKlbUGo",
  premiumShareEntitlementKey: "shareTargetPicker",
  lineShareEntitlementKey: "lineResultShare",
  tenantId: "tenant_demo_001",
  appName: "LearningPlatform",
  appVersion: "local"
};

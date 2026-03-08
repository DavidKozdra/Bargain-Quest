(function bridgeNotificationManager(root) {
  if (typeof root.NotificationManager === "function") return;
  const api = root.BQLib?.ui?.notificationManager;
  if (api && typeof api.NotificationManager === "function") {
    root.NotificationManager = api.NotificationManager;
  }
})(typeof globalThis !== "undefined" ? globalThis : this);

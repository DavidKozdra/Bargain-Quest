const { NotificationManager } = require("../../Koz_Engine_Lib/ui/notificationManager");

describe("Koz_Engine_Lib/ui/notificationManager", () => {
  test("exports NotificationManager constructor", () => {
    expect(typeof NotificationManager).toBe("function");
  });
});

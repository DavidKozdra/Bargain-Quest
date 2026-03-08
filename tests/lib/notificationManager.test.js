const { NotificationManager } = require("../../Koz_Engine_Lib/Events/notificationManager");

describe("Koz_Engine_Lib/Events/notificationManager", () => {
  test("exports NotificationManager constructor", () => {
    expect(typeof NotificationManager).toBe("function");
  });
});

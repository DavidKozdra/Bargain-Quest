const { NotificationCenter, getNotificationColor } = require("../../Koz_Engine_Lib/Events/notificationCenter");

describe("Koz_Engine_Lib/Events/notificationCenter", () => {
  test("enforces max notifications", () => {
    const center = new NotificationCenter({ maxNotifications: 2 });
    center.enqueue({ message: "1", duration: 1000 });
    center.enqueue({ message: "2", duration: 1000 });
    center.enqueue({ message: "3", duration: 1000 });
    expect(center.list().length).toBe(2);
  });

  test("returns palette colors", () => {
    expect(getNotificationColor("success")).toBe("#388e3c");
    expect(getNotificationColor("unknown")).toBe("#333");
  });
});

const { CountdownTimer } = require("../../Koz_Engine_Lib/core/countdownTimer");

describe("Koz_Engine_Lib/core/countdownTimer", () => {
  test("clears timer state", () => {
    let now = 1000;
    const timer = new CountdownTimer(() => now);
    timer.start(5, () => {});
    expect(timer.remainingSeconds()).toBe(5);
    timer.clear();
    expect(timer.remainingSeconds()).toBe(0);
  });
});


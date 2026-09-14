const { EventSystem } = require("../../Koz_Engine_Lib/Events/eventSystem");

describe("Koz_Engine_Lib/Events/eventSystem", () => {
  test("exports EventSystem constructor", () => {
    expect(typeof EventSystem).toBe("function");
  });

  test("disables the Sick Traveler herb choice unless Herbs are in inventory", () => {
    const previousPlayer = global.player;
    let earnedGold = 0;
    global.player = {
      inventory: new Map([["Herbs", { quantity: 0 }]]),
      removeItem({ name }) {
        const entry = this.inventory.get(name);
        if (!entry || entry.quantity <= 0) return;
        entry.quantity -= 1;
        if (entry.quantity === 0) this.inventory.delete(name);
      },
      earnGold(amount) {
        earnedGold += amount;
      },
    };

    try {
      const system = new EventSystem();
      system.currentEvent = system.events.find((event) => event.name === "Sick Traveler");

      expect(system.getChoiceAvailability(0)).toEqual({
        available: false,
        reason: "Requires Herbs in your inventory.",
      });

      global.player.inventory.set("Herbs", { quantity: 1 });
      expect(system.getChoiceAvailability(0)).toEqual({ available: true, reason: "" });

      const result = system.currentEvent.choices[0].resolve();
      expect(result.type).toBe("success");
      expect(global.player.inventory.has("Herbs")).toBe(false);
      expect(earnedGold >= 15).toBe(true);
    } finally {
      if (typeof previousPlayer === "undefined") delete global.player;
      else global.player = previousPlayer;
    }
  });

  test("blocks an unavailable choice before its resolver runs", () => {
    const system = new EventSystem();
    let resolved = false;
    system.currentEvent = {
      choices: [{
        isAvailable: () => false,
        unavailableMessage: "Requires Herbs in your inventory.",
        resolve: () => {
          resolved = true;
          return { message: "Should not run", type: "success" };
        },
      }],
    };

    const result = system.resolveChoice(0);

    expect(result).toEqual({
      message: "Requires Herbs in your inventory.",
      type: "warning",
      blocked: true,
    });
    expect(resolved).toBe(false);
    expect(system.currentEvent).not.toBe(null);
  });
});

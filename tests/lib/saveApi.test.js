const { SaveAPI } = require("../../Koz_Engine_Lib/api/saveApi");
const { createMemoryDriver } = require("../../Koz_Engine_Lib/io/storageDrivers");

describe("Koz_Engine_Lib/api/saveApi", () => {
  test("saves and loads payload via driver", () => {
    const api = new SaveAPI({
      driver: createMemoryDriver(),
      key: "slot",
      sharePrefix: "X:",
      serializer: JSON,
    });
    api.save({ version: 1, ok: true });
    expect(api.has()).toBe(true);
    expect(api.load()).toEqual({ version: 1, ok: true });
  });

  test("exports and imports share token", () => {
    const api = new SaveAPI({
      driver: createMemoryDriver(),
      key: "slot",
      sharePrefix: "X:",
      serializer: JSON,
    });
    api.save({ version: 1, foo: "bar" });
    const token = api.exportShareToken();
    expect(token.startsWith("X:")).toBe(true);

    const api2 = new SaveAPI({
      driver: createMemoryDriver(),
      key: "slot",
      sharePrefix: "X:",
      serializer: JSON,
    });
    api2.importShareToken(token);
    expect(api2.load()).toEqual({ version: 1, foo: "bar" });
  });
});


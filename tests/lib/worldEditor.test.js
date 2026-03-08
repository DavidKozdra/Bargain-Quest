const { createWorldSpace } = require("../../Koz_Engine_Lib/World/worldSpace");
const { createWorldEditor } = require("../../Koz_Engine_Lib/World/worldEditor");

describe("Koz_Engine_Lib/World/worldEditor", () => {
  test("paints, places elements, and supports undo/redo", () => {
    const world = createWorldSpace({ cols: 5, rows: 5, defaultCell: "Water" });
    const editor = createWorldEditor({ world });

    editor.beginStroke();
    editor.paintArea(2, 2, "Grass", { brushSize: 2 });
    editor.endStroke();
    editor.placeElement("city", 2, 2, { name: "Forge" }, { uniqueKindPerTile: true, select: true });

    expect(world.getCell(2, 2)).toBe("Grass");
    expect(editor.getSelectedElement().kind).toBe("city");

    editor.undo();
    expect(world.findElementAt(2, 2, "city")).toBe(null);

    editor.undo();
    expect(world.getCell(2, 2)).toBe("Water");

    editor.redo();
    editor.redo();
    expect(world.getCell(2, 2)).toBe("Grass");
    expect(world.findElementAt(2, 2, "city")).not.toBe(null);
  });

  test("supports unique singleton world elements", () => {
    const world = createWorldSpace({ cols: 6, rows: 6, defaultCell: "Void" });
    const editor = createWorldEditor({ world });

    editor.placeElement("playerStart", 1, 1, {}, { uniqueKind: true, select: true });
    editor.placeElement("playerStart", 4, 4, {}, { uniqueKind: true, select: true });

    const starts = world.listElements("playerStart");
    expect(starts).toHaveLength(1);
    expect(starts[0].x).toBe(4);
    expect(starts[0].y).toBe(4);
  });
});

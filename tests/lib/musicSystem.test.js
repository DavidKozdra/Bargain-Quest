const {
  MusicSystem,
  readStoredVolume,
  writeStoredVolume,
} = require("../../Koz_Engine_Lib/Audio/musicSystem");

function makeTrack() {
  let playing = false;
  let volume = 0;
  let loop = false;
  return {
    setVolume(v) { volume = v; },
    getVolume() { return volume; },
    setLoop(v) { loop = !!v; },
    getLoop() { return loop; },
    play() { playing = true; },
    stop() { playing = false; },
    isPlaying() { return playing; },
  };
}

describe("Koz_Engine_Lib/Audio/musicSystem", () => {
  test("reads and writes normalized volume", () => {
    const storage = new Map();
    const adapter = {
      getItem: (k) => storage.has(k) ? storage.get(k) : null,
      setItem: (k, v) => storage.set(k, String(v)),
    };

    expect(readStoredVolume(adapter, "music", 0.5)).toBe(0.5);
    adapter.setItem("music", "80");
    expect(readStoredVolume(adapter, "music", 0.5)).toBe(0.8);
    expect(writeStoredVolume(adapter, "music", 1.4)).toBe(1);
  });

  test("plays main track and random track with injected dependencies", async () => {
    const storage = {
      getItem: () => "0.6",
      setItem: jest.fn(),
    };
    const audioContext = {
      state: "suspended",
      resume: jest.fn(async () => { audioContext.state = "running"; }),
    };
    const main = makeTrack();
    const other = makeTrack();
    const system = new MusicSystem(main, [other], {
      storage,
      storageKey: "music_vol",
      audioContext,
      random: () => 0.9,
    });

    await system.playMainTheme();
    expect(audioContext.resume).toHaveBeenCalled();
    expect(main.isPlaying()).toBe(true);
    expect(main.getLoop()).toBe(true);
    expect(main.getVolume()).toBe(0.6);

    main.stop();
    await system.playRandom(0);
    expect(other.isPlaying()).toBe(true);
    expect(other.getLoop()).toBe(false);
  });
});

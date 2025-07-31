// MusicSystem.js

class MusicSystem {
  static instance = null;

  /**
   * Initialize with your main theme + array of other tracks.
   * Reads saved volume from localStorage (defaults to 0.5).
   */
  static init(mainTheme, otherTracks) {
    if (!MusicSystem.instance) {
      MusicSystem.instance = new MusicSystem(mainTheme, otherTracks);
    }
    return MusicSystem.instance;
  }

  /** Grab the singleton after init() */
  static getInstance() {
    if (!MusicSystem.instance) {
      throw new Error("MusicSystem not initialized! Call MusicSystem.init() first.");
    }
    return MusicSystem.instance;
  }

  constructor(mainTheme, otherTracks) {
    this.mainTheme = mainTheme;
    this.otherTracks = otherTracks;
    this.current = null;

    // load saved volume or default
    const saved = parseFloat(localStorage.getItem("musicVolume"));
    //console.log(saved, isNaN(saved))
    this.volume = isNaN(saved) ? 0.5 : saved;

    const v100 = isNaN(parseFloat(this.volume)) ? 50 : parseFloat(this.volume);
    this.volume = constrain(v100 / 100, 0, 1);
    // apply to all tracks so setVolume() can be called once
    [this.mainTheme, ...this.otherTracks].forEach(t => t.setVolume(this.volume));
  }

  /** Returns current volume (0.0 – 1.0) */
  getVolume() {
    return this.volume;
  }

  /**
   * Update volume, persist it, and apply to all tracks (including
   * the one currently playing).
   */
setVolume() {
  const raw = localStorage.getItem("musicVolume");
  const v100 = isNaN(parseFloat(raw)) ? 50 : parseFloat(raw);
  this.volume = constrain(v100 / 100, 0, 1);
  [this.mainTheme, ...this.otherTracks].forEach(t => {
    if (t && typeof t.setVolume === 'function') {
      t.setVolume(this.volume);
    }
  });
}



  async playMainTheme() {
    // 1) make sure the audio context is running
    const ctx = getAudioContext();
    if (ctx.state !== 'running') {
      await ctx.resume();      // resume if suspended
      //console.log("AudioContext resumed");
    }

    // 2) now do your usual once-per-state logic
    if (this.current === this.mainTheme && this.current.isPlaying()) {
      return;
    }
    this._stopCurrent();
    this.current = this.mainTheme;
    this.current.setLoop(true);
    this.current.setVolume(this.volume);
    this.current.play();
  }
  /**
   * Play a random track (with chanceEmpty% chance of silence),
   * but only once per state change.
   * @param {number} chanceEmpty – integer 0–100 chance to skip playing anything
   */
  playRandom(chanceEmpty = 0) {
    // already playing one of the others?
    if (this.otherTracks.includes(this.current) && this.current.isPlaying()) {
      return;
    }

    // roll to stay silent
    if (random(100) < chanceEmpty) {
      this.stop();
      return;
    }

    // pick & start a random track
    this._stopCurrent();
    const idx = floor(random(this.otherTracks.length));
    this.current = this.otherTracks[idx];
    this.current.setLoop(false);
    this.current.setVolume(this.volume);
    this.current.play();
  }

  /** Stop whatever’s playing and reset so it can restart later */
  stop() {
    this._stopCurrent();
    this.current = null;
  }

  _stopCurrent() {
    if (this.current && this.current.isPlaying()) {
      this.current.stop();
    }
  }
}
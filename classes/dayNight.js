class DayNightCycle {
  constructor(dayCycleLength = 60) {
    this.timeOfDay = 0;
    this.dayCycleLength = dayCycleLength;
    this.daysElapsed = 0;
    this.daysPerYear = 100;
    this.weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    this.seasonNames = ["Winter", "Spring", "Summer", "Fall"];
    this.seasonLength = this.daysPerYear / 4;
  }

  update(deltaTime) {
    const prevTime = this.timeOfDay;

    // Time always advances at the same rate, whether in a city or on the world map
    const dt = deltaTime / 1000;
    this.timeOfDay = (this.timeOfDay + dt * TWO_PI / this.dayCycleLength) % TWO_PI;

    if (prevTime > this.timeOfDay) {
      this.daysElapsed++;

      const event = new CustomEvent("dayChanged", {
        detail: {
          daysElapsed: this.daysElapsed,
          season: this.getSeason(),
          year: this.getYear()
        }
      });

      window.dispatchEvent(event);

      // Auto-save every 5 days (skip if game is over, e.g. permadeath just deleted save)
      if (this.daysElapsed % 5 === 0 && typeof SaveSystem !== 'undefined') {
        if (typeof gameStateManager === 'undefined' || !gameStateManager.is(GameStates.GAMELOSE)) {
          SaveSystem.save({ silent: true });
        }
      }
    }

    // Sky color (2D background)
    const t = this.getLightFactor();
    background(
      lerp(15, 100, t),
      lerp(15, 160, t),
      lerp(30, 210, t)
    );
  }

  // Call this AFTER all world rendering to darken for night
  renderOverlay() {
    const t = this.getLightFactor();
    const nightAlpha = lerp(160, 0, t);

    if (nightAlpha > 5) {
      push();
      noStroke();
      // Blue-ish night overlay
      fill(10, 10, 40, nightAlpha);
      rect(0, 0, width, height);
      pop();
    }

    // Dawn/dusk tint
    const sunAngle = this.timeOfDay;
    const dawnDusk = sin(sunAngle * 2);
    if (dawnDusk > 0.3) {
      push();
      noStroke();
      fill(200, 100, 30, dawnDusk * 20);
      rect(0, 0, width, height);
      pop();
    }
  }

  getLightFactor() {
    return (cos(this.timeOfDay) + 1) * 0.5;
  }

  getCurrentTimeRadians() {
    return this.timeOfDay;
  }

  setTimeRadians(t) {
    this.timeOfDay = t % TWO_PI;
  }

  getDaysElapsed() {
    return this.daysElapsed;
  }

  setDaysElapsed(d) {
    this.daysElapsed = d;
  }

  getDayOfWeek() {
    return this.weekdays[this.daysElapsed % 7];
  }

  getYear() {
    return Math.floor(this.daysElapsed / this.daysPerYear) + 1;
  }

  getSeason() {
    const dayInYear = this.daysElapsed % this.daysPerYear;
    const seasonIndex = Math.floor(dayInYear / this.seasonLength);
    return this.seasonNames[seasonIndex];
  }

  getTimeString() {
    const hourFraction = this.timeOfDay / TWO_PI;
    const hour = Math.floor(hourFraction * 24);
    const minute = Math.floor((hourFraction * 24 - hour) * 60);
    return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
  }
}

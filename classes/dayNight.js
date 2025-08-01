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

    if (player.currentCity == null) {
      const dt = deltaTime / 1000;
      this.timeOfDay = (this.timeOfDay + dt * TWO_PI / this.dayCycleLength) % TWO_PI;
    }

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
    }

    // Sky and lighting
    const t = this.getLightFactor();
    background(
      lerp(30, 135, t),
      lerp(30, 206, t),
      lerp(60, 255, t)
    );

    const ambNight = { r: 10, g: 10, b: 10 };
    const ambDay = { r: 255, g: 255, b: 255 };
    ambientLight(
      lerp(ambNight.r, ambDay.r, t),
      lerp(ambNight.g, ambDay.g, t),
      lerp(ambNight.b, ambDay.b, t)
    );

    const moonCol = { r: 160, g: 170, b: 200 };
    const sunCol = { r: 255, g: 250, b: 240 };
    const dx = cos(this.timeOfDay);
    const dy = sin(this.timeOfDay);

    directionalLight(
      lerp(moonCol.r, sunCol.r, t),
      lerp(moonCol.g, sunCol.g, t),
      lerp(moonCol.b, sunCol.b, t),
      dx, dy, 0
    );
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
}

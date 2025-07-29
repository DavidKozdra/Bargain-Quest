
class DayNightCycle {
  constructor(dayCycleLength = 60) {
    this.timeOfDay = 0; // radians [0, TWO_PI)
    this.dayCycleLength = dayCycleLength; // seconds per full cycle
    this.daysElapsed = 0;
    this.weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  }

  update(deltaTime) {
    const dt = deltaTime / 1000;
    const prevTime = this.timeOfDay;
    this.timeOfDay = (this.timeOfDay + dt * TWO_PI / this.dayCycleLength) % TWO_PI;

    // Count days when the cycle wraps around
    if (prevTime > this.timeOfDay) {
      this.daysElapsed++;
    }
  }

  getLightFactor() {
    return (cos(this.timeOfDay) + 1) * 0.5; // 0 at night, 1 at noon
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
}

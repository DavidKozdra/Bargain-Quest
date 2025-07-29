
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

  if (prevTime > this.timeOfDay) {
    this.daysElapsed++;
  }

  let t = dayNight.getLightFactor(); // 0 at night, 1 at noon

  // Brighter night sky baseline
  background(
    lerp(30, 135, t),  // from 15 → 30
    lerp(30, 206, t),  // from 15 → 30
    lerp(60, 255, t)   // from 40 → 60
  );

  // Brighter ambient light during night
  const ambNight = { r: 10, g: 10, b: 10 }; // was 80,80,100
  const ambDay   = { r: 255, g: 255, b: 255 };


  ambientLight(
    lerp(ambNight.r, ambDay.r, t),
    lerp(ambNight.g, ambDay.g, t),
    lerp(ambNight.b, ambDay.b, t)
  );

  // Directional light (moon/sun)
  const moonCol = { r: 160, g: 170, b: 200 }; // slightly brighter moonlight
  const sunCol  = { r: 255, g: 250, b: 240 };
  let dx = cos(dayNight.getCurrentTimeRadians());
  let dy = sin(dayNight.getCurrentTimeRadians());
  directionalLight(
    lerp(moonCol.r, sunCol.r, t),
    lerp(moonCol.g, sunCol.g, t),
    lerp(moonCol.b, sunCol.b, t),
    dx, dy, 0
  );


    let dayLab= document.getElementById("dayDisplay")
    dayLab.innerHTML= dayNight.daysElapsed
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

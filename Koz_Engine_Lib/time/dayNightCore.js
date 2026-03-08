(function initDayNightCoreLib(root, factory) {
  const api = factory();

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function createDayNightCoreApi() {
  const TAU = Math.PI * 2;

  function normalizeRadians(value) {
    var t = Number(value) || 0;
    t %= TAU;
    return t < 0 ? t + TAU : t;
  }

  function advanceTime(timeOfDay, deltaMs, dayCycleLengthSec) {
    var prev = normalizeRadians(timeOfDay);
    var dt = (Number(deltaMs) || 0) / 1000;
    var cycle = Math.max(1, Number(dayCycleLengthSec) || 60);
    var next = normalizeRadians(prev + (dt * TAU) / cycle);
    return {
      previous: prev,
      current: next,
      rolledDay: prev > next,
    };
  }

  function getLightFactor(timeOfDay) {
    return (Math.cos(normalizeRadians(timeOfDay)) + 1) * 0.5;
  }

  function getSeason(daysElapsed, daysPerYear, seasonNames) {
    var totalDays = Math.max(1, Number(daysPerYear) || 100);
    var seasons = Array.isArray(seasonNames) && seasonNames.length ? seasonNames : ["Winter", "Spring", "Summer", "Fall"];
    var seasonLength = totalDays / seasons.length;
    var dayInYear = ((Number(daysElapsed) || 0) % totalDays + totalDays) % totalDays;
    var idx = Math.floor(dayInYear / seasonLength);
    return seasons[Math.min(Math.max(idx, 0), seasons.length - 1)];
  }

  function getYear(daysElapsed, daysPerYear) {
    return Math.floor((Number(daysElapsed) || 0) / (Math.max(1, Number(daysPerYear) || 100))) + 1;
  }

  function getTimeString(timeOfDay) {
    var hourFraction = normalizeRadians(timeOfDay) / TAU;
    var hour = Math.floor(hourFraction * 24);
    var minute = Math.floor((hourFraction * 24 - hour) * 60);
    return String(hour).padStart(2, "0") + ":" + String(minute).padStart(2, "0");
  }

  return {
    TAU: TAU,
    normalizeRadians: normalizeRadians,
    advanceTime: advanceTime,
    getLightFactor: getLightFactor,
    getSeason: getSeason,
    getYear: getYear,
    getTimeString: getTimeString,
  };
});

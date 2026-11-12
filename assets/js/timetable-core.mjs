/**
 * Shared pure utilities and constants for NITOCバスナビ.
 * Used by both the static HTML generator (Node) and the browser scripts.
 */

export const STOP_LABELS = {
  gate: "正門",
  entrance: "入口",
  nakakuki2: "中二",
};

export const ROUTE_ORDER = ["taka", "joto", "kuwa"];

export const CALENDAR_MARKS = {
  daily: "",
  joto_weekday: "※",
  kuwa_mon_fri: "◆",
};

export const CALENDAR_DESCRIPTIONS = {
  joto_weekday: "※ 平日のみ",
  kuwa_mon_fri: "◆ 月～金運行（土・日・12/29～1/3は運休）",
};

/** Japanese public holidays (and observed) relevant to the 2026–2027 period. */
export const HOLIDAYS = new Set([
  "2026-01-01", "2026-01-12", "2026-02-11", "2026-02-23", "2026-03-20",
  "2026-04-29", "2026-05-03", "2026-05-04", "2026-05-05", "2026-05-06",
  "2026-07-20", "2026-08-11", "2026-09-21", "2026-09-22", "2026-09-23",
  "2026-10-12", "2026-11-03", "2026-11-23",
  "2027-01-01", "2027-01-11", "2027-02-11", "2027-02-23", "2027-03-21",
  "2027-03-22", "2027-04-29", "2027-05-03", "2027-05-04", "2027-05-05",
  "2027-07-19", "2027-08-11", "2027-09-20", "2027-09-23", "2027-10-11",
  "2027-11-03", "2027-11-23",
]);

/** Convert "HH:MM" to minutes since midnight. */
export function toMinutes(value) {
  const [hour, minute] = String(value).split(":").map(Number);
  return hour * 60 + minute;
}

/** Minimal HTML escape for attribute / text content. */
export function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "\u0026amp;")
    .replace(/</g, "\u0026lt;")
    .replace(/>/g, "\u0026gt;")
    .replace(/"/g, "\u0026quot;")
    .replace(/'/g, "\u0026#39;");
}

/**
 * Get date/time parts in Asia/Tokyo.
 * @returns {{ year: number, month: number, day: number, hour: number, minute: number, second: number }}
 */
export function getJstParts(date = new Date()) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });

  const parts = {};
  for (const part of formatter.formatToParts(date)) {
    if (part.type !== "literal") parts[part.type] = part.value;
  }

  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    second: Number(parts.second),
  };
}

/** "YYYY-MM-DD" */
export function dateKey(parts) {
  return [
    String(parts.year).padStart(4, "0"),
    String(parts.month).padStart(2, "0"),
    String(parts.day).padStart(2, "0"),
  ].join("-");
}

/**
 * Add days in the calendar sense (UTC-based to avoid local TZ issues).
 * @returns {{ year: number, month: number, day: number, weekday: number }}
 */
export function addDays(base, offset) {
  const date = new Date(Date.UTC(base.year, base.month - 1, base.day + offset));
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
    weekday: date.getUTCDay(), // 0 = Sunday
  };
}

/**
 * Whether a trip runs on the given calendar date.
 * @param {object} trip
 * @param {{ year: number, month: number, day: number, weekday: number }} date
 * @param {Record<string, object>} calendars
 * @param {Set<string>} [holidays]
 */
export function runsOnDate(trip, date, calendars, holidays = HOLIDAYS) {
  const calendar = calendars?.[trip.calendar_id];
  if (!calendar) return true;

  const weekday = date.weekday === 0 ? 7 : date.weekday; // 1–7 (Mon–Sun)
  if (Array.isArray(calendar.weekdays) && !calendar.weekdays.includes(weekday)) {
    return false;
  }

  const monthDay = String(date.month).padStart(2, "0") + "-" + String(date.day).padStart(2, "0");
  if (Array.isArray(calendar.excluded_month_days) && calendar.excluded_month_days.includes(monthDay)) {
    return false;
  }

  if (calendar.public_holidays === false && holidays.has(dateKey(date))) {
    return false;
  }

  return true;
}

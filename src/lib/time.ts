const PACIFIC = "America/Los_Angeles";
const SHANGHAI = "Asia/Shanghai";

function calendarDayInZone(date: Date, timeZone: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/** YYYY-MM-DD plus whole calendar days (UTC date arithmetic, no DST). */
export function addCalendarDays(isoDate: string, delta: number) {
  const [year, month, day] = isoDate.split("-").map(Number);
  const utc = new Date(Date.UTC(year, month - 1, day + delta));
  return utc.toISOString().slice(0, 10);
}

export function shanghaiDay(date: Date) {
  return calendarDayInZone(date, SHANGHAI);
}

export function shanghaiYesterday(date = new Date()) {
  return addCalendarDays(shanghaiDay(date), -1);
}

export function pacificHourMinute(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: PACIFIC,
    hour: "numeric",
    minute: "numeric",
    hourCycle: "h23",
  }).formatToParts(date);
  const hour = Number(parts.find((part) => part.type === "hour")?.value);
  const minute = Number(parts.find((part) => part.type === "minute")?.value);
  return { hour, minute };
}

/**
 * Last fully finished calendar day in US Pacific.
 * Cron at ~03:00 PT on 8/27 labels data as 8/26.
 */
export function lastCompletedPacificDay(date = new Date()) {
  return addCalendarDays(calendarDayInZone(date, PACIFIC), -1);
}

/**
 * Winter extra slot: 10:00 UTC = 02:00 PST. Wait for 11:00 UTC = 03:00.
 * Summer 10:00 UTC = 03:00 PDT (keep).
 */
export function isPacificCronTwinSlot(date = new Date()) {
  return pacificHourMinute(date).hour === 2;
}

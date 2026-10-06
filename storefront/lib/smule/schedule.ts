const STORE_TIME_ZONE = "Asia/Tehran";

export function getStoreScheduleNow(now: Date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: STORE_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));

  return {
    date: `${values.year}-${values.month}-${values.day}`,
    time: `${values.hour}:${values.minute}`,
  };
}

export function isRequestedTimeInPast(date: string, time: string, now: Date = new Date()) {
  if (!date || !time) return false;
  const current = getStoreScheduleNow(now);
  return date < current.date || (date === current.date && time.slice(0, 5) <= current.time);
}

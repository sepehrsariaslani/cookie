import test from "node:test";
import assert from "node:assert/strict";
import { getStoreScheduleNow, isRequestedTimeInPast } from "../../lib/smule/schedule.ts";

test("store scheduling uses Tehran date and time, regardless of browser timezone", () => {
  assert.deepEqual(getStoreScheduleNow(new Date("2026-09-28T19:00:00.000Z")), {
    date: "2026-09-28",
    time: "22:30",
  });
});

test("same-day requested times at or before the current minute are rejected", () => {
  const now = new Date("2026-09-28T19:00:00.000Z");

  assert.equal(isRequestedTimeInPast("2026-09-28", "22:29", now), true);
  assert.equal(isRequestedTimeInPast("2026-09-28", "22:30", now), true);
  assert.equal(isRequestedTimeInPast("2026-09-28", "22:31", now), false);
});

test("past dates are rejected and future dates remain selectable", () => {
  const now = new Date("2026-09-28T19:00:00.000Z");

  assert.equal(isRequestedTimeInPast("2026-09-27", "09:00", now), true);
  assert.equal(isRequestedTimeInPast("2026-09-29", "09:00", now), false);
  assert.equal(isRequestedTimeInPast("", "", now), false);
});

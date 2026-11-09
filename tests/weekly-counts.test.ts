import { describe, expect, it } from "@jest/globals"
import dayjs from "dayjs"

import { dayOpenCount, defaultDayRules, weekStartOf, weeklyOpenCount } from "~utils"

import { factoryInput } from "./utils"

// Every day has a maximum of 20 opens, and all seven days are on
const everyDay = (max: number) =>
  factoryInput({
    frequency: "random",
    url: "https://example.com",
    dayRules: defaultDayRules().map((rule) => ({
      ...rule,
      enabled: true,
      timesPerDay: max,
      minGapMinutes: 0,
      windowStart: "00:00",
      windowEnd: "23:00",
    })),
  })

// The count for each day of one week, Monday first
const weekCounts = (input: ReturnType<typeof everyDay>, monday: dayjs.Dayjs) =>
  [0, 1, 2, 3, 4, 5, 6].map((i) => dayOpenCount(input, monday.add(i, "day")))

describe("weekly random counts", () => {
  const input = everyDay(20)
  // Mondays from 2026 onward
  const mondays = Array.from({ length: 12 }, (_, i) => weekStartOf(dayjs("2026-01-05").add(i * 7, "day")))

  it("never goes above a day's maximum", () => {
    for (const monday of mondays) {
      for (const count of weekCounts(input, monday)) {
        expect(count).toBeGreaterThanOrEqual(0)
        expect(count).toBeLessThanOrEqual(20)
      }
    }
  })

  it("is never the same for a weekday as the week before", () => {
    for (let w = 1; w < mondays.length; w++) {
      const now = weekCounts(input, mondays[w])
      const before = weekCounts(input, mondays[w - 1])
      now.forEach((count, day) => expect(count).not.toBe(before[day]))
    }
  })

  it("gives a different weekly total from one week to the next", () => {
    for (let w = 1; w < mondays.length; w++) {
      const total = (monday: dayjs.Dayjs) => weekCounts(input, monday).reduce((a, b) => a + b, 0)
      expect(total(mondays[w])).not.toBe(total(mondays[w - 1]))
    }
  })

  it("gives the same counts when the same week is asked for again", () => {
    expect(weekCounts(input, mondays[3])).toEqual(weekCounts(input, mondays[3]))
  })

  it("weeklyOpenCount matches the sum of the days in that week", () => {
    for (const monday of mondays.slice(0, 4)) {
      expect(weeklyOpenCount(input, monday)).toBe(weekCounts(input, monday).reduce((a, b) => a + b, 0))
    }
  })

  it("does not change with the date inside the same week", () => {
    const monday = mondays[2]
    expect(dayOpenCount(input, monday.add(3, "day"))).toBe(dayOpenCount(input, monday.add(3, "day").hour(15)))
  })
})

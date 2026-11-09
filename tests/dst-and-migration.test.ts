import { beforeAll, describe, expect, it } from "@jest/globals"
import dayjs from "dayjs"

import { dayOpenCount, defaultDayRules, migrateRandomInput, planRandomTimes } from "~utils"

import { factoryInput } from "./utils"

// Run these tests in London time, so the daylight saving changes actually happen
beforeAll(() => {
  process.env.TZ = "Europe/London"
})

const onlyDay = (weekday: number, window: { start: string; end: string; timesPerDay: number }) =>
  factoryInput({
    frequency: "random",
    url: "https://example.com",
    dayRules: defaultDayRules().map((rule) =>
      rule.day === weekday
        ? {
            ...rule,
            enabled: true,
            timesPerDay: window.timesPerDay,
            windowStart: window.start,
            windowEnd: window.end,
          }
        : { ...rule, enabled: false }
    ),
  })

describe("random opens on clock-change days", () => {
  it("keeps every open inside the window on the day the clocks go forward", () => {
    // Sunday 29 March 2026: clocks go from 01:00 GMT to 02:00 BST
    const input = onlyDay(0, { start: "00:30", end: "03:30", timesPerDay: 6 })
    const day = dayjs("2026-03-29")
    const startAt = dayjs("2026-03-29 00:30")
    const endAt = dayjs("2026-03-29 03:30")

    const times = planRandomTimes(input, day)

    expect(times).toHaveLength(dayOpenCount(input, day))
    expect(times.length).toBeLessThanOrEqual(6)
    times.forEach((time) => {
      expect(time.isBefore(startAt)).toBe(false)
      expect(time.isBefore(endAt)).toBe(true)
    })
  })

  it("keeps every open inside the window on the day the clocks go back", () => {
    // Sunday 25 October 2026: clocks go from 02:00 BST back to 01:00 GMT
    const input = onlyDay(0, { start: "00:00", end: "03:00", timesPerDay: 6 })
    const day = dayjs("2026-10-25")
    const startAt = dayjs("2026-10-25 00:00")
    const endAt = dayjs("2026-10-25 03:00")

    const times = planRandomTimes(input, day)

    expect(times).toHaveLength(dayOpenCount(input, day))
    expect(times.length).toBeLessThanOrEqual(6)
    times.forEach((time) => {
      expect(time.isBefore(startAt)).toBe(false)
      expect(time.isBefore(endAt)).toBe(true)
    })
  })

  it("gives the same times on an ordinary day as before", () => {
    const input = onlyDay(1, { start: "10:00", end: "18:00", timesPerDay: 4 })
    const day = dayjs("2026-11-02")

    const times = planRandomTimes(input, day)
    times.forEach((time) => {
      expect(time.format("YYYY-MM-DD")).toBe("2026-11-02")
      expect(time.hour() >= 10 && time.hour() < 18).toBe(true)
    })
  })
})

describe("migrateRandomInput", () => {
  it("turns the first version's shared settings into per-day rules", () => {
    const old = {
      ...factoryInput({ frequency: "random", url: "https://example.com" }),
      days: [1, 3],
      windowStart: "09:00",
      windowEnd: "17:00",
      timesPerDay: 5,
      minGapMinutes: 15,
    } as any

    const migrated = migrateRandomInput(old)

    expect(migrated.dayRules).toHaveLength(7)
    const monday = migrated.dayRules!.find((rule) => rule.day === 1)!
    const tuesday = migrated.dayRules!.find((rule) => rule.day === 2)!
    expect(monday).toMatchObject({ enabled: true, timesPerDay: 5, minGapMinutes: 15, windowStart: "09:00", windowEnd: "17:00" })
    expect(tuesday.enabled).toBe(false)
    expect("days" in migrated).toBe(false)
    expect("windowStart" in migrated).toBe(false)
  })

  it("leaves schedules that are already upgraded unchanged", () => {
    const current = factoryInput({ frequency: "random", url: "https://example.com", dayRules: defaultDayRules() })
    expect(migrateRandomInput(current)).toBe(current)
  })

  it("leaves non-random schedules unchanged", () => {
    const daily = factoryInput({ frequency: "daily", url: "https://example.com" })
    expect(migrateRandomInput(daily)).toBe(daily)
  })
})

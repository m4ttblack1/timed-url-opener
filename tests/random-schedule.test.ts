import { describe, expect, it } from "@jest/globals"
import dayjs from "dayjs"

import {
  defaultDayRules,
  generateNext5Dates,
  hashSeed,
  pickSpacedOffsets,
  planRandomTimes,
  randomScheduleError,
  seededRandom
} from "~utils"

import { factoryInput } from "./utils"

// Start from the default rules (Mon-Fri, 3 opens, 10:00-18:00) and override as needed
const randomInput = (options = {}) =>
  factoryInput({
    frequency: "random",
    url: "https://example.com",
    dayRules: defaultDayRules(),
    ...options
  })

// Build day rules where only the given days are on
const rulesFor = (
  rules: Record<
    number,
    { timesPerDay: number; windowStart: string; windowEnd: string; minGapMinutes?: number }
  >
) =>
  defaultDayRules().map((rule) =>
    rules[rule.day]
      ? { ...rule, ...rules[rule.day], enabled: true }
      : { ...rule, enabled: false }
  )

// Your example: Monday 7 opens 10:00-18:00, Tuesday 10 opens 10:00-18:00, Friday 18 opens 11:00-19:00
const exampleRules = () =>
  rulesFor({
    1: { timesPerDay: 7, windowStart: "10:00", windowEnd: "18:00" },
    2: { timesPerDay: 10, windowStart: "10:00", windowEnd: "18:00" },
    5: { timesPerDay: 18, windowStart: "11:00", windowEnd: "19:00" }
  })

describe("seededRandom", () => {
  it("returns the same sequence for the same seed", () => {
    const a = seededRandom(hashSeed("abc"))
    const b = seededRandom(hashSeed("abc"))
    expect([a(), a(), a()]).toEqual([b(), b(), b()])
  })

  it("returns values in [0, 1)", () => {
    const rand = seededRandom(42)
    for (let i = 0; i < 1000; i++) {
      const value = rand()
      expect(value).toBeGreaterThanOrEqual(0)
      expect(value).toBeLessThan(1)
    }
  })
})

describe("pickSpacedOffsets", () => {
  it("returns the requested number of sorted offsets within bounds, spaced by the gap", () => {
    for (let seed = 1; seed <= 200; seed++) {
      const offsets = pickSpacedOffsets(479, 4, 30, seededRandom(seed))

      expect(offsets).toHaveLength(4)
      offsets.forEach((offset) => {
        expect(offset).toBeGreaterThanOrEqual(0)
        expect(offset).toBeLessThanOrEqual(479)
      })
      for (let i = 1; i < offsets.length; i++) {
        expect(offsets[i] - offsets[i - 1]).toBeGreaterThanOrEqual(30)
      }
    }
  })

  it("returns an empty list for a zero count", () => {
    expect(pickSpacedOffsets(100, 0, 10, seededRandom(1))).toEqual([])
  })
})

describe("planRandomTimes with per-day rules", () => {
  it("gives the number of opens each day asks for", () => {
    const input = randomInput({ dayRules: exampleRules() })

    expect(planRandomTimes(input, dayjs("2026-11-02"))).toHaveLength(7) // Monday
    expect(planRandomTimes(input, dayjs("2026-11-03"))).toHaveLength(10) // Tuesday
    expect(planRandomTimes(input, dayjs("2026-11-06"))).toHaveLength(18) // Friday
  })

  it("keeps each day's opens inside that day's own window", () => {
    const input = randomInput({ dayRules: exampleRules() })

    planRandomTimes(input, dayjs("2026-11-02")).forEach((time) => {
      const minutes = time.hour() * 60 + time.minute()
      expect(minutes).toBeGreaterThanOrEqual(10 * 60)
      expect(minutes).toBeLessThan(18 * 60)
    })

    planRandomTimes(input, dayjs("2026-11-06")).forEach((time) => {
      const minutes = time.hour() * 60 + time.minute()
      expect(minutes).toBeGreaterThanOrEqual(11 * 60)
      expect(minutes).toBeLessThan(19 * 60)
    })
  })

  it("plans nothing on days that are switched off", () => {
    const input = randomInput({ dayRules: exampleRules() })

    expect(planRandomTimes(input, dayjs("2026-11-04"))).toEqual([]) // Wednesday, off
    expect(planRandomTimes(input, dayjs("2026-11-01"))).toEqual([]) // Sunday, off
  })

  it("respects the minimum gap between opens", () => {
    const input = randomInput({
      dayRules: rulesFor({
        1: { timesPerDay: 5, windowStart: "09:00", windowEnd: "17:00", minGapMinutes: 45 }
      })
    })
    const times = planRandomTimes(input, dayjs("2026-11-02"))

    expect(times).toHaveLength(5)
    for (let i = 1; i < times.length; i++) {
      expect(times[i].diff(times[i - 1], "minute")).toBeGreaterThanOrEqual(45)
    }
  })

  it("gives the same times for the same schedule and day", () => {
    const input = randomInput({ dayRules: exampleRules() })
    const day = dayjs("2026-11-02")
    const first = planRandomTimes(input, day).map((t) => t.valueOf())
    const second = planRandomTimes(input, day).map((t) => t.valueOf())

    expect(first).toEqual(second)
  })

  it("gives different times on different days", () => {
    const input = randomInput()
    const monday = planRandomTimes(input, dayjs("2026-11-02")).map((t) => t.format("HH:mm"))
    const tuesday = planRandomTimes(input, dayjs("2026-11-03")).map((t) => t.format("HH:mm"))

    expect(monday).not.toEqual(tuesday)
  })

  it("returns nothing for an invalid window", () => {
    const input = randomInput({
      dayRules: rulesFor({ 1: { timesPerDay: 3, windowStart: "18:00", windowEnd: "10:00" } })
    })
    expect(planRandomTimes(input, dayjs("2026-11-02"))).toEqual([])
  })
})

describe("generateNext5Dates for random frequency", () => {
  it("returns five future times", () => {
    const dates = generateNext5Dates(randomInput({ dayRules: exampleRules() }))

    expect(dates).toHaveLength(5)
    dates.forEach((date) => expect(date.isAfter(dayjs())).toBe(true))
  })
})

describe("randomScheduleError", () => {
  it("accepts your example schedule", () => {
    expect(randomScheduleError(randomInput({ dayRules: exampleRules() }))).toBeNull()
  })

  it("requires at least one day to be on", () => {
    const rules = defaultDayRules().map((rule) => ({ ...rule, enabled: false }))
    expect(randomScheduleError(randomInput({ dayRules: rules }))).toBe("Turn on at least one day.")
  })

  it("requires each enabled day's window to end after it starts", () => {
    const input = randomInput({
      dayRules: rulesFor({ 1: { timesPerDay: 3, windowStart: "18:00", windowEnd: "10:00" } })
    })
    expect(randomScheduleError(input)).toBe("Monday: \"until\" must be later than \"from\".")
  })

  it("requires at least one open on an enabled day", () => {
    const input = randomInput({
      dayRules: rulesFor({ 1: { timesPerDay: 0, windowStart: "10:00", windowEnd: "18:00" } })
    })
    expect(randomScheduleError(input)).toBe("Monday: opens must be at least 1.")
  })

  it("rejects more opens than fit in the window with the minimum gap", () => {
    // 10:00-18:00 with a 30 minute gap fits at most 17 opens
    const input = randomInput({
      dayRules: rulesFor({
        1: { timesPerDay: 18, windowStart: "10:00", windowEnd: "18:00", minGapMinutes: 30 }
      })
    })
    expect(randomScheduleError(input)).not.toBeNull()
  })

  it("gap is per day: a big gap on one day does not affect another", () => {
    const input = randomInput({
      dayRules: rulesFor({
        1: { timesPerDay: 18, windowStart: "10:00", windowEnd: "18:00", minGapMinutes: 30 },
        2: { timesPerDay: 18, windowStart: "10:00", windowEnd: "18:00", minGapMinutes: 0 }
      })
    })
    // Monday is impossible with a 30 minute gap, so the error is about Monday
    expect(randomScheduleError(input)).toMatch(/^Monday:/)

    const tuesdayOnly = randomInput({
      dayRules: rulesFor({
        2: { timesPerDay: 18, windowStart: "10:00", windowEnd: "18:00", minGapMinutes: 0 }
      })
    })
    expect(randomScheduleError(tuesdayOnly)).toBeNull()
    expect(planRandomTimes(tuesdayOnly, dayjs("2026-11-03"))).toHaveLength(18)
  })

  it("applies each day's own gap when planning", () => {
    const input = randomInput({
      dayRules: rulesFor({
        1: { timesPerDay: 4, windowStart: "10:00", windowEnd: "18:00", minGapMinutes: 60 },
        2: { timesPerDay: 4, windowStart: "10:00", windowEnd: "18:00", minGapMinutes: 0 }
      })
    })
    const monday = planRandomTimes(input, dayjs("2026-11-02"))
    for (let i = 1; i < monday.length; i++) {
      expect(monday[i].diff(monday[i - 1], "minute")).toBeGreaterThanOrEqual(60)
    }
  })

  it("ignores days that are switched off", () => {
    const rules = defaultDayRules().map((rule) =>
      rule.day === 3 ? { ...rule, enabled: true, windowStart: "18:00", windowEnd: "10:00" } : rule
    )
    // Wednesday is on and has a bad window, so this should be reported
    expect(randomScheduleError(randomInput({ dayRules: rules }))).not.toBeNull()

    const offRules = defaultDayRules().map((rule) =>
      rule.day === 3 ? { ...rule, enabled: false, windowStart: "18:00", windowEnd: "10:00" } : rule
    )
    expect(randomScheduleError(randomInput({ dayRules: offRules }))).toBeNull()
  })
})

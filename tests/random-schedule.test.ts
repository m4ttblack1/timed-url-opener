import { describe, expect, it } from "@jest/globals"
import dayjs from "dayjs"

import {
  generateNext5Dates,
  hashSeed,
  pickSpacedOffsets,
  planRandomTimes,
  randomScheduleError,
  seededRandom
} from "~utils"

import { factoryInput } from "./utils"

const randomInput = (options = {}) =>
  factoryInput({
    frequency: "random",
    url: "https://example.com",
    days: [1, 2, 3, 4, 5],
    windowStart: "09:00",
    windowEnd: "17:00",
    timesPerDay: 3,
    minGapMinutes: 30,
    ...options
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

  it("caps the count when the gap cannot fit that many opens", () => {
    // 60 minutes with a 30 minute gap fits at most 3 opens (0, 30, 60)
    const offsets = pickSpacedOffsets(60, 10, 30, seededRandom(7))
    expect(offsets).toHaveLength(3)
  })

  it("returns an empty list for a zero count", () => {
    expect(pickSpacedOffsets(100, 0, 10, seededRandom(1))).toEqual([])
  })
})

describe("planRandomTimes", () => {
  it("only plans on the selected days of the week", () => {
    const input = randomInput({ days: [1] }) // Mondays only
    const monday = dayjs("2026-11-02") // a Monday
    const tuesday = dayjs("2026-11-03")

    expect(planRandomTimes(input, monday)).toHaveLength(3)
    expect(planRandomTimes(input, tuesday)).toEqual([])
  })

  it("keeps every time inside the window [start, end)", () => {
    const input = randomInput()
    const day = dayjs("2026-11-02")

    planRandomTimes(input, day).forEach((time) => {
      const minutes = time.hour() * 60 + time.minute()
      expect(minutes).toBeGreaterThanOrEqual(9 * 60)
      expect(minutes).toBeLessThan(17 * 60)
      expect(time.format("YYYY-MM-DD")).toBe("2026-11-02")
    })
  })

  it("respects the minimum gap between opens", () => {
    const input = randomInput({ timesPerDay: 5, minGapMinutes: 45 })
    const times = planRandomTimes(input, dayjs("2026-11-02"))

    expect(times).toHaveLength(5)
    for (let i = 1; i < times.length; i++) {
      expect(times[i].diff(times[i - 1], "minute")).toBeGreaterThanOrEqual(45)
    }
  })

  it("gives the same times for the same schedule and day", () => {
    const input = randomInput()
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
    expect(planRandomTimes(randomInput({ windowStart: "17:00", windowEnd: "09:00" }), dayjs("2026-11-02"))).toEqual([])
  })
})

describe("generateNext5Dates for random frequency", () => {
  it("returns five future times", () => {
    const dates = generateNext5Dates(randomInput())

    expect(dates).toHaveLength(5)
    dates.forEach((date) => expect(date.isAfter(dayjs())).toBe(true))
  })
})

describe("randomScheduleError", () => {
  it("accepts a valid schedule", () => {
    expect(randomScheduleError(randomInput())).toBeNull()
  })

  it("requires at least one day", () => {
    expect(randomScheduleError(randomInput({ days: [] }))).toBe("Select at least one day.")
  })

  it("requires the window to end after it starts", () => {
    expect(randomScheduleError(randomInput({ windowEnd: "08:00" }))).not.toBeNull()
  })

  it("requires at least one open per day", () => {
    expect(randomScheduleError(randomInput({ timesPerDay: 0 }))).toBe("Opens per day must be at least 1.")
  })
})

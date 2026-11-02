import { describe, expect, it } from "@jest/globals"
import dayjs from "dayjs"

import { collectWeekEntries } from "~components/week-view"
import { defaultDayRules } from "~utils"

import { factoryInput } from "./utils"

describe("collectWeekEntries", () => {
  // Start of today, so every planned day is in the 7-day view
  const start = dayjs().startOf("day")

  const randomSchedule = (dayRules: ReturnType<typeof defaultDayRules>) =>
    factoryInput({
      frequency: "random",
      url: "https://example.com",
      title: "Test",
      enabled: true,
      dayRules,
      minGapMinutes: 0
    })

  it("lists only times in the next 7 days, in time order", () => {
    const entries = collectWeekEntries([randomSchedule(defaultDayRules())], start)

    entries.forEach((entry) => {
      expect(entry.time.isAfter(dayjs())).toBe(true)
      expect(entry.time.isBefore(start.add(7, "day"))).toBe(true)
    })

    for (let i = 1; i < entries.length; i++) {
      expect(entries[i].time.valueOf()).toBeGreaterThanOrEqual(entries[i - 1].time.valueOf())
    }
  })

  it("skips disabled schedules and schedules with no URL", () => {
    const disabled = { ...randomSchedule(defaultDayRules()), enabled: false }
    const noUrl = { ...randomSchedule(defaultDayRules()), url: "" }

    expect(collectWeekEntries([disabled, noUrl], start)).toEqual([])
  })

  it("does not break on a schedule with bad settings", () => {
    const broken = randomSchedule(defaultDayRules().map((r) => ({ ...r, windowStart: "bad" })))
    const good = randomSchedule(defaultDayRules())

    expect(() => collectWeekEntries([broken, good], start)).not.toThrow()
  })
})

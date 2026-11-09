import { describe, expect, it } from "@jest/globals"

import dayjs from "dayjs"
import { dayOpenCount, defaultDayRules, describeSeconds, weekStartOf, weeklyOpenCount } from "~utils"

import { factoryInput } from "./utils"

describe("weeklyOpenCount", () => {
  it("is the exact sum of this week's counts on the enabled days", () => {
    const rules = defaultDayRules().map((rule) => ({ ...rule, enabled: rule.day === 1 || rule.day === 5, timesPerDay: 7 }))
    const input = factoryInput({ dayRules: rules })
    const monday = weekStartOf(dayjs())
    const total = [0, 1, 2, 3, 4, 5, 6].reduce((sum, i) => sum + dayOpenCount(input, monday.add(i, "day")), 0)
    expect(weeklyOpenCount(input)).toBe(total)
    expect(weeklyOpenCount(input)).toBeLessThanOrEqual(14)
  })

  it("is zero when no day is on", () => {
    expect(weeklyOpenCount(factoryInput({ dayRules: [] }))).toBe(0)
  })
})

describe("describeSeconds", () => {
  it("says the tab stays open for 0", () => {
    expect(describeSeconds(0)).toBe("The tab stays open.")
  })

  it("describes minutes and seconds", () => {
    expect(describeSeconds(240)).toBe("The tab closes after 4 minutes.")
    expect(describeSeconds(90)).toBe("The tab closes after 1 minute 30 seconds.")
    expect(describeSeconds(45)).toBe("The tab closes after 45 seconds.")
  })
})

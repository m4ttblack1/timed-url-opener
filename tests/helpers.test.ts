import { describe, expect, it } from "@jest/globals"

import { defaultDayRules, describeSeconds, weeklyOpenCount } from "~utils"

import { factoryInput } from "./utils"

describe("weeklyOpenCount", () => {
  it("adds up the enabled days only", () => {
    const rules = defaultDayRules().map((rule) => ({ ...rule, enabled: rule.day === 1 || rule.day === 5, timesPerDay: 7 }))
    expect(weeklyOpenCount(factoryInput({ dayRules: rules }))).toBe(14)
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

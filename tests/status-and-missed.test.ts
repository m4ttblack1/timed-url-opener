import { describe, expect, it } from "@jest/globals"
import dayjs from "dayjs"

import { defaultDayRules, describeSeconds, missedPlannedOpens, planRandomTimes, scheduleHealth } from "~utils"

import { factoryInput } from "./utils"

const randomWithDays = (overrides = {}) =>
  factoryInput({
    frequency: "random",
    url: "https://example.com",
    enabled: true,
    added_at: "2020-01-01T00:00:00.000Z",
    dayRules: defaultDayRules().map((rule) => ({ ...rule, enabled: true, timesPerDay: 4, windowStart: "00:00", windowEnd: "23:00" })),
    ...overrides,
  })

describe("scheduleHealth", () => {
  it("is off when disabled", () => {
    expect(scheduleHealth(randomWithDays({ enabled: false }))).toBe("off")
  })

  it("needs a URL that is valid", () => {
    expect(scheduleHealth(randomWithDays({ url: "" }))).toBe("needs-url")
    expect(scheduleHealth(randomWithDays({ url: "not a url" }))).toBe("needs-url")
  })

  it("needs settings when a random schedule has a problem", () => {
    const rules = defaultDayRules().map((rule) => ({ ...rule, enabled: false }))
    expect(scheduleHealth(randomWithDays({ dayRules: rules }))).toBe("needs-settings")
  })

  it("is ok when everything is set", () => {
    expect(scheduleHealth(randomWithDays())).toBe("ok")
  })
})

describe("missedPlannedOpens", () => {
  it("reports a planned open that passed with no log entry", () => {
    const input = randomWithDays()
    // a day can have zero opens (random picks start at 0), so use the first day that has some
    const offset = Array.from({ length: 14 }, (_, i) => i).find((i) => planRandomTimes(input, dayjs().add(i, "day")).length > 0)
    expect(offset).not.toBeUndefined()
    const now = dayjs().add(offset as number, "day").endOf("day")
    const missed = missedPlannedOpens(input, now, [], [])
    expect(missed.length).toBeGreaterThan(0)
  })

  it("does not report an open that is in the log", () => {
    const input = randomWithDays()
    const now = dayjs().endOf("day")
    const all = missedPlannedOpens(input, now, [], [])
    const logged = all.map((m) => ({ uuid: input.uuid, at: m.time.valueOf() }))
    expect(missedPlannedOpens(input, now, logged, [])).toHaveLength(0)
  })

  it("does not report the same miss twice", () => {
    const input = randomWithDays()
    const now = dayjs().endOf("day")
    const all = missedPlannedOpens(input, now, [], [])
    const notified = all.map((m) => m.key)
    expect(missedPlannedOpens(input, now, [], notified)).toHaveLength(0)
  })

  it("ignores opens planned before the schedule was created", () => {
    const input = randomWithDays({ added_at: dayjs().endOf("day").toISOString() })
    expect(missedPlannedOpens(input, dayjs().endOf("day"), [], [])).toHaveLength(0)
  })

  it("ignores disabled schedules", () => {
    expect(missedPlannedOpens(randomWithDays({ enabled: false }), dayjs().endOf("day"), [], [])).toHaveLength(0)
  })
})

describe("describeSeconds for short times", () => {
  it("explains the 30 second minimum", () => {
    expect(describeSeconds(10)).toContain("30 seconds")
  })
})

import dayjs, { Dayjs } from "dayjs"
import type { DayRule, ScheduleInput, Unit } from "~options"

export const generateUUID = () => {
    // Public Domain/MIT
    var d = new Date().getTime() //Timestamp
    var d2 = (performance && performance.now && performance.now() * 1000) || 0 //Time in microseconds since page-load or 0 if unsupported
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(
        /[xy]/g,
        function (c) {
            var r = Math.random() * 16 //random number between 0 and 16
            if (d > 0) {
                //Use timestamp until depleted
                r = (d + r) % 16 | 0
                d = Math.floor(d / 16)
            } else {
                //Use microseconds since page-load if supported
                r = (d2 + r) % 16 | 0
                d2 = Math.floor(d2 / 16)
            }
            return (c === "x" ? r : (r & 0x3) | 0x8).toString(16)
        }
    )
}

export const getCloseTime = (unit: Unit, amount: number, startTime: Dayjs) => {
    const now = dayjs()
    const diffInMinutes = now.diff(startTime, "minute")

    let surplus = 0

    switch (unit) {
        case "minutes":
            surplus = diffInMinutes % amount
        case "hours":
            surplus = diffInMinutes % (amount * 60)
        case "days":
            surplus = diffInMinutes % (amount * 60 * 24)
    }

    if (surplus > 0) {
        return dayjs().second(0).subtract(surplus, "minute")
    }

    return startTime.second(0).add(amount, "minute")
}

// ---------------------------------------------------------------------------
// Random frequency: N opens per day at random minutes inside a time window.
//
// The random picks are seeded from (schedule uuid + calendar date), so the same
// day always produces the same times. That keeps the UI preview and the alarms
// in agreement, and stops the times from reshuffling every time the alarms are
// rebuilt, while still looking random to the user.
// ---------------------------------------------------------------------------

// FNV-1a 32-bit hash of a string
export const hashSeed = (text: string): number => {
    let h = 0x811c9dc5
    for (let i = 0; i < text.length; i++) {
        h ^= text.charCodeAt(i)
        h = Math.imul(h, 0x01000193)
    }
    return h >>> 0
}

// mulberry32 PRNG: returns a function producing floats in [0, 1)
export const seededRandom = (seed: number): (() => number) => {
    let a = seed >>> 0
    return () => {
        a = (a + 0x6d2b79f5) >>> 0
        let t = a
        t = Math.imul(t ^ (t >>> 15), t | 1)
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    }
}

// Pick `count` distinct integer offsets in [0, total] that are at least `minGap` apart.
// Falls back to evenly spaced offsets if random rejection sampling does not find a fit.
export const pickSpacedOffsets = (
    total: number,
    count: number,
    minGap: number,
    rand: () => number
): number[] => {
    if (total < 0 || count <= 0) return []

    const gap = Math.max(0, Math.floor(minGap))
    const maxCount = gap > 0 ? Math.floor(total / gap) + 1 : total + 1
    const n = Math.min(Math.floor(count), maxCount)

    if (n <= 0) return []
    if (n === 1) return [Math.floor(rand() * (total + 1))]

    for (let attempt = 0; attempt < 200; attempt++) {
        const picks = new Set<number>()
        while (picks.size < n) {
            picks.add(Math.floor(rand() * (total + 1)))
        }

        const sorted = [...picks].sort((a, b) => a - b)
        if (sorted.every((value, i) => i === 0 || value - sorted[i - 1] >= gap)) {
            return sorted
        }
    }

    return Array.from({ length: n }, (_, i) => Math.round((i * total) / (n - 1)))
}

// "HH:mm" -> minutes since midnight, or null if invalid
const parseMinuteOfDay = (hhmm: string | undefined): number | null => {
    if (!hhmm) return null
    const [h, m] = hhmm.split(":").map(Number)
    if (Number.isNaN(h) || Number.isNaN(m)) return null
    return h * 60 + m
}

// The random open times for one calendar day. Returns [] if the day is not selected
// or the window or count is invalid. The window is [windowStart, windowEnd).
export const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]

// Every day of the week, switched off by default except Monday to Friday
export const defaultDayRules = (): DayRule[] =>
    DAY_NAMES.map((_, day) => ({
        day,
        enabled: day >= 1 && day <= 5,
        timesPerDay: 3,
        minGapMinutes: 0,
        windowStart: "10:00",
        windowEnd: "18:00",
    }))

// The enabled rule for a day of the week (0 = Sunday), or undefined if that day is off
export const findDayRule = (input: ScheduleInput, weekday: number): DayRule | undefined =>
    (input.dayRules ?? []).find((rule) => rule.day === weekday && rule.enabled)

export const planRandomTimes = (input: ScheduleInput, day: Dayjs): Dayjs[] => {
    const rule = findDayRule(input, day.day())
    if (!rule) return []

    const dateText = day.format("YYYY-MM-DD")

    // Convert the window to real clock times on this date. On days when the clocks
    // change, the number of real minutes in the window differs from the wall-clock difference,
    // so the window is measured in real time between its two ends.
    const startAt = dayjs(`${dateText} ${rule.windowStart}`)
    const endAt = dayjs(`${dateText} ${rule.windowEnd}`)
    if (!startAt.isValid() || !endAt.isValid() || !endAt.isAfter(startAt)) return []

    const perDay = Math.floor(Number(rule.timesPerDay))
    if (!(perDay >= 1)) return []

    const totalMinutes = endAt.diff(startAt, "minute")
    const rand = seededRandom(hashSeed(`${input.uuid}|${dateText}`))
    const offsets = pickSpacedOffsets(totalMinutes - 1, perDay, Number(rule.minGapMinutes) || 0, rand)

    return offsets
        .sort((a, b) => a - b)
        .map((offset) => startAt.add(offset, "minute"))
}

// Turns schedules saved by the first version of Random (one shared set of days and
// window) into per-day rules. Schedules that already have dayRules are returned unchanged.
export const migrateRandomInput = (input: any): ScheduleInput => {
    if (input.frequency !== "random" || Array.isArray(input.dayRules)) return input as ScheduleInput

    const days: number[] = Array.isArray(input.days) ? input.days : []
    const dayRules = defaultDayRules().map((rule) => ({
        ...rule,
        enabled: days.includes(rule.day),
        timesPerDay: Number(input.timesPerDay) || rule.timesPerDay,
        minGapMinutes: Number(input.minGapMinutes) || 0,
        windowStart: input.windowStart || rule.windowStart,
        windowEnd: input.windowEnd || rule.windowEnd,
    }))

    const { days: _days, windowStart: _ws, windowEnd: _we, timesPerDay: _tpd, minGapMinutes: _mgm, ...rest } = input
    return { ...rest, dayRules } as ScheduleInput
}

// A message describing why a "random" schedule cannot run, or null if it is valid
export const randomScheduleError = (input: ScheduleInput): string | null => {
    const enabled = (input.dayRules ?? []).filter((rule) => rule.enabled)
    if (enabled.length === 0) return "Turn on at least one day."

    for (const rule of enabled) {
        const name = DAY_NAMES[rule.day]
        const start = parseMinuteOfDay(rule.windowStart)
        const end = parseMinuteOfDay(rule.windowEnd)

        if (start === null || end === null || end <= start) {
            return `${name}: "until" must be later than "from".`
        }

        const perDay = Math.floor(Number(rule.timesPerDay))
        if (!(perDay >= 1)) return `${name}: opens must be at least 1.`

        // how many opens fit in the window with this day's minimum gap
        const gap = Math.max(0, Math.floor(Number(rule.minGapMinutes) || 0))
        const total = end - start - 1
        const maxCount = gap > 0 ? Math.floor(total / gap) + 1 : total + 1
        if (perDay > maxCount) {
            return `${name}: ${perDay} opens don't fit between those times with a ${gap} minute gap.`
        }
    }

    return null
}

// The next 5 random open times, looking ahead up to 60 days (used by the UI preview)
export const generateRandomNext5 = (input: ScheduleInput): Dayjs[] => {
    const now = dayjs()
    const result: Dayjs[] = []

    for (let offset = 0; offset < 60 && result.length < 5; offset++) {
        for (const time of planRandomTimes(input, now.add(offset, "day"))) {
            if (time.isAfter(now) && result.length < 5) {
                result.push(time)
            }
        }
    }

    return result
}

export const generateNext5Dates = (input: ScheduleInput): Dayjs[] => {
    if (input.frequency === "random") {
        return generateRandomNext5(input)
    }

    // daily
    if (input.frequency === "daily") {
        const dates = []

        const hour = parseInt(input.time.split(":")[0])
        const minute = parseInt(input.time.split(":")[1])
        const startTime = dayjs().hour(hour).minute(minute).second(0)

        for (let i = 0; i < 5; i++) {
            if (startTime.isAfter(dayjs())) {
                dates.push(startTime.add(i, "day"))
                continue
            }

            dates.push(startTime.add(i + 1, "day"))
        }

        return dates
    }

    // weekday
    if (input.frequency === "weekday") {
        const dates = []

        const hour = parseInt(input.time.split(":")[0])
        const minute = parseInt(input.time.split(":")[1])
        let startTime = dayjs().hour(hour).minute(minute).second(0)

        // get next 5 weekdays
        while (dates.length < 5) {
            if (startTime.day() !== 0 && startTime.day() !== 6) {
                if (startTime.isAfter(dayjs())) {
                    dates.push(startTime)
                }
            }

            startTime = startTime.add(1, "day")
        }

        return dates
    }

    if (input.frequency === "oneshot") {
        const dates = []

        const year = parseInt(input.date.split("-")[0])
        const month = parseInt(input.date.split("-")[1])
        const day = parseInt(input.date.split("-")[2])
        const hour = parseInt(input.time.split(":")[0])
        const minute = parseInt(input.time.split(":")[1])

        dates.push(
            dayjs()
                .year(year)
                .month(month - 1)
                .date(day)
                .hour(hour)
                .minute(minute)
                .second(0)
        )

        return dates
    }

    let now = dayjs()

    const year = parseInt(input.date.split("-")[0])
    const month = parseInt(input.date.split("-")[1])
    const day = parseInt(input.date.split("-")[2])
    const hour = parseInt(input.time.split(":")[0])
    const minute = parseInt(input.time.split(":")[1])

    now = now
        .year(year)
        .month(month - 1)
        .date(day)
        .hour(hour)
        .minute(minute)
        .second(0)

    const dates = []

    // generate dates while next 5 days from now is reached
    let i = 0

    const current = dayjs()

    let currentTime = getCloseTime(input.unit, input.amount, now)

    while (dates.length < 5) {
        if (currentTime.isBefore(current)) {
            currentTime = currentTime.add(input.amount, input.unit)
            continue
        }

        dates.push(currentTime)

        currentTime = currentTime.add(input.amount, input.unit)
    }

    return dates
}

export function computeNextAlarmTime(time: string) {
    const now = new Date();
    const [hours, minutes] = time.split(':');
    const scheduledTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), parseInt(hours), parseInt(minutes));

    if (scheduledTime <= now) {
        scheduledTime.setDate(now.getDate() + 1);
    }

    return scheduledTime.getTime();
}

export function computeNextFiveWeekdayAlarmTime(time: string): Dayjs[] {
    const now = dayjs();
    const [hours, minutes] = time.split(':');
    let scheduledTime = dayjs(now).hour(parseInt(hours)).minute(parseInt(minutes)).second(0);

    if (scheduledTime.isBefore(now)) {
        scheduledTime = scheduledTime.add(1, 'day');
    }

    const dates = []

    while (dates.length < 5) {
        if (scheduledTime.day() !== 0 && scheduledTime.day() !== 6) {
            dates.push(scheduledTime);
        }
        scheduledTime = scheduledTime.add(1, 'day');
    }

    return dates
}

export const capitalize = (str) => {
    if (typeof str !== "string" || !str) return str
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase()
}
// How many opens a random schedule makes in a normal week (sum of the enabled days)
export const weeklyOpenCount = (input: ScheduleInput): number =>
    (input.dayRules ?? [])
        .filter((rule) => rule.enabled)
        .reduce((sum, rule) => sum + (Math.floor(Number(rule.timesPerDay)) || 0), 0)

// "240" -> "4 minutes", "45" -> "45 seconds", "0" -> "" (the tab stays open)
export const describeSeconds = (value: number | undefined): string => {
    const seconds = Math.floor(Number(value) || 0)
    if (seconds <= 0) return "The tab stays open."
    if (seconds < 30) return "The tab closes after 30 seconds. Chrome and Brave do not close tabs faster than that."
    const minutes = Math.floor(seconds / 60)
    const rest = seconds % 60
    const parts: string[] = []
    if (minutes) parts.push(`${minutes} minute${minutes === 1 ? "" : "s"}`)
    if (rest || !minutes) parts.push(`${rest} second${rest === 1 ? "" : "s"}`)
    return `The tab closes after ${parts.join(" ")}.`
}

// Overall state of a schedule, shown as a coloured dot in the schedule list
export type ScheduleHealth = "off" | "needs-url" | "needs-settings" | "ok"

export const scheduleHealth = (input: ScheduleInput): ScheduleHealth => {
    if (!input.enabled) return "off"
    try {
        new URL(input.url)
    } catch (err) {
        return "needs-url"
    }
    if (input.frequency === "random" && randomScheduleError(input)) return "needs-settings"
    return "ok"
}

export type MissedOpen = { key: string; time: Dayjs }

// Planned opens for today that were due more than 5 minutes ago, were planned after the
// schedule was created, and have no matching entry in the open log. Each is returned once,
// because `notified` holds the keys already reported.
export const missedPlannedOpens = (
    input: ScheduleInput,
    now: Dayjs,
    log: { uuid: string; at: number }[],
    notified: string[]
): MissedOpen[] => {
    if (!input.enabled || !input.url || input.frequency !== "random") return []

    const created = dayjs(input.added_at)
    const cutoff = now.subtract(5, "minute")
    const planned = planRandomTimes(input, now.startOf("day"))

    return planned
        .filter((time) => time.isBefore(cutoff) && (!created.isValid() || time.isAfter(created)))
        .filter((time) => !log.some((record) => record.uuid === input.uuid && Math.abs(record.at - time.valueOf()) <= 2 * 60 * 1000))
        .map((time) => ({ key: `${input.uuid}|${time.toISOString()}`, time }))
        .filter((missed) => !notified.includes(missed.key))
}

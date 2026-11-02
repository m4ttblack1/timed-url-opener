import dayjs, { Dayjs } from "dayjs"

import type { ScheduleInput } from "~options"
import { generateNext5Dates, planRandomTimes } from "~utils"

const DAYS_SHOWN = 7

export type Entry = {
  time: Dayjs
  label: string
  url: string
}

// Every open time for enabled schedules over the 7 days from `start`, in time order
export const collectWeekEntries = (inputs: ScheduleInput[], start: Dayjs): Entry[] => {
  const end = start.add(DAYS_SHOWN, "day")
  const now = dayjs()
  const entries: Entry[] = []

  for (const input of inputs) {
    if (!input.enabled || !input.url) continue

    let times: Dayjs[] = []
    try {
      if (input.frequency === "random") {
        // every day is planned exactly, so the calendar matches what will open
        for (let i = 0; i < DAYS_SHOWN; i++) {
          times.push(...planRandomTimes(input, start.add(i, "day")))
        }
      } else {
        times = generateNext5Dates(input)
      }
    } catch (err) {
      // a schedule with bad settings is skipped, not allowed to break the page
      continue
    }

    times
      .filter((time) => time.isAfter(now) && time.isBefore(end))
      .forEach((time) => {
        entries.push({ time, label: input.title || input.url, url: input.url })
      })
  }

  return entries.sort((a, b) => a.time.valueOf() - b.time.valueOf())
}

import { ClockIcon } from "@primer/octicons-react"
import dayjs, { Dayjs } from "dayjs"
import React, { FC, useEffect, useState } from "react"

import type { ScheduleInput } from "~options"
import { generateNext5Dates, planRandomTimes } from "~utils"

const DAYS_SHOWN = 7

type Entry = {
  time: Dayjs
  label: string
  url: string
}

// Every open time for enabled schedules over the next 7 days, in time order
export const collectWeekEntries = (inputs: ScheduleInput[], start: Dayjs): Entry[] => {
  const end = start.add(DAYS_SHOWN, "day")
  const now = dayjs()
  const entries: Entry[] = []

  for (const input of inputs) {
    if (!input.enabled || !input.url) continue

    let times: Dayjs[] = []
    try {
      if (input.frequency === "random") {
        // every day is planned exactly, so the week view matches what will open
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

export const WeekView: FC<{ inputs: ScheduleInput[] }> = ({ inputs }) => {
  // re-check once a minute so past opens drop off the list
  const [, setTick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 60_000)
    return () => clearInterval(id)
  }, [])

  const start = dayjs().startOf("day")
  const entries = collectWeekEntries(inputs, start)
  const total = entries.length

  const days = Array.from({ length: DAYS_SHOWN }, (_, i) => {
    const day = start.add(i, "day")
    return { day, items: entries.filter((entry) => entry.time.isSame(day, "day")) }
  })

  return (
    <div>
      <h2 className="text-xl mb-1">Next 7 days</h2>
      <p className="text-sm opacity-70 mb-4">
        {total} open{total === 1 ? "" : "s"} planned. Random times are fixed for each day,
        so this is exactly what will open.
      </p>
      <div className="grid grid-cols-1 md:grid-cols-7 gap-3">
        {days.map(({ day, items }) => (
          <div key={day.format("YYYY-MM-DD")} className="card bg-base-200 p-3">
            <h3 className="font-bold">{day.format("ddd D MMM")}</h3>
            <p className="text-xs opacity-70 mb-2">
              {items.length} open{items.length === 1 ? "" : "s"}
            </p>
            {items.length === 0 ? (
              <p className="text-sm opacity-50">Nothing planned</p>
            ) : (
              <ul className="flex flex-col gap-1">
                {items.map((entry, i) => (
                  <li key={i} className="flex items-center gap-2 text-sm">
                    <ClockIcon size={14} />
                    <span className="font-mono">{entry.time.format("HH:mm")}</span>
                    <span className="truncate" title={entry.url}>
                      {entry.label}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

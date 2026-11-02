import dayjs from "dayjs"
import React, { FC, useEffect, useState } from "react"

import type { ScheduleInput } from "~options"

import { collectWeekEntries } from "./week-view"

type Props = {
  inputs: ScheduleInput[]
}

// One day at a time, with arrows to step through the calendar
export const DayCalendar: FC<Props> = ({ inputs }) => {
  const [offset, setOffset] = useState(0) // days from today

  // re-check once a minute so passed opens drop off
  const [, setTick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 60_000)
    return () => clearInterval(id)
  }, [])

  const now = dayjs()
  const today = now.startOf("day")
  const day = today.add(offset, "day")

  const dayEntries = collectWeekEntries(inputs, day).filter((entry) =>
    entry.time.isSame(day, "day")
  )
  const nextOpen = collectWeekEntries(inputs, today).find((entry) => entry.time.isAfter(now))

  const relative =
    offset === 0 ? "Today" : offset === 1 ? "Tomorrow" : offset === -1 ? "Yesterday" : ""

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <button
          className="btn btn-circle btn-sm"
          aria-label="Previous day"
          onClick={() => setOffset((o) => o - 1)}>
          ‹
        </button>
        <div className="text-center">
          <h2 className="text-lg font-bold">{day.format("dddd D MMMM")}</h2>
          <p className="text-sm opacity-70">{relative || day.format("YYYY")}</p>
        </div>
        <button
          className="btn btn-circle btn-sm"
          aria-label="Next day"
          onClick={() => setOffset((o) => o + 1)}>
          ›
        </button>
      </div>

      <div className="flex justify-center">
        <button
          className="btn btn-xs btn-ghost"
          disabled={offset === 0}
          onClick={() => setOffset(0)}>
          Back to today
        </button>
      </div>

      <div className="rounded-box bg-base-100 p-3">
        <p className="text-xs opacity-70">Next open</p>
        {nextOpen ? (
          <>
            <p className="font-mono text-xl font-bold">
              {nextOpen.time.format("ddd D MMM, HH:mm")}
            </p>
            <p className="truncate text-sm opacity-70">{nextOpen.label}</p>
          </>
        ) : (
          <p className="text-sm opacity-70">Nothing planned in the next 7 days.</p>
        )}
      </div>

      <div className="text-sm opacity-70">
        {dayEntries.length} open{dayEntries.length === 1 ? "" : "s"}
      </div>

      <ul className="flex max-h-[60vh] flex-col gap-2 overflow-y-auto pr-1">
        {dayEntries.map((entry, i) => (
          <li key={i} className="flex items-center gap-3 rounded-box bg-base-100 px-3 py-2">
            <span className="h-2 w-2 shrink-0 rounded-full bg-primary" aria-hidden="true" />
            <span className="font-mono">{entry.time.format("HH:mm")}</span>
            <span className="flex-1 truncate text-sm">{entry.label}</span>
          </li>
        ))}
        {dayEntries.length === 0 && (
          <li className="text-sm opacity-60">Nothing planned for this day.</li>
        )}
      </ul>
    </div>
  )
}

import dayjs from "dayjs"
import React, { FC, useEffect, useState } from "react"

import { useStorage } from "@plasmohq/storage/hook"

import { store } from "~storage"
import type { ScheduleInput } from "~options"

import { collectWeekEntries } from "./week-view"

type Props = {
  inputs: ScheduleInput[]
}

type OpenRecord = { uuid: string; url: string; at: number }

// An open counts as "Opened" if the log has it within two minutes of the planned time
const MATCH_WINDOW_MS = 2 * 60 * 1000

// One day at a time, with arrows to step through the calendar
export const DayCalendar: FC<Props> = ({ inputs }) => {
  const [offset, setOffset] = useState(0) // days from today
  const [openLog] = useStorage<OpenRecord[]>({ key: "openLog", instance: store }, [])
  const [openCounts] = useStorage<Record<string, number>>({ key: "openCounts", instance: store }, {})

  // re-check once a minute so passed opens update
  const [, setTick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 60_000)
    return () => clearInterval(id)
  }, [])

  const now = dayjs()
  const today = now.startOf("day")
  const day = today.add(offset, "day")

  const dayEntries = collectWeekEntries(inputs, day, true).filter((entry) =>
    entry.time.isSame(day, "day")
  )
  const nextOpen = collectWeekEntries(inputs, today).find((entry) => entry.time.isAfter(now))

  const statusFor = (entry: { time: dayjs.Dayjs; uuid: string }): "upcoming" | "opened" | "missed" => {
    if (entry.time.isAfter(now)) return "upcoming"
    const logged = (openLog ?? []).some(
      (record) =>
        record.uuid === entry.uuid && Math.abs(record.at - entry.time.valueOf()) <= MATCH_WINDOW_MS
    )
    return logged ? "opened" : "missed"
  }

  const counts = dayEntries.reduce(
    (acc, entry) => {
      acc[statusFor(entry)] += 1
      return acc
    },
    { upcoming: 0, opened: 0, missed: 0 }
  )

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

      {counts.missed > 0 && (
        <div role="alert" className="alert alert-warning py-2 text-sm">
          {counts.missed} planned open{counts.missed === 1 ? "" : "s"} on this day{" "}
          {counts.missed === 1 ? "was" : "were"} missed. The extension was not running in the browser it is loaded in at those times.
        </div>
      )}

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
        {counts.opened > 0 && `, ${counts.opened} opened`}
        {counts.missed > 0 && `, ${counts.missed} missed`}
      </div>

      <ul className="flex max-h-[60vh] flex-col gap-2 overflow-y-auto pr-1">
        {dayEntries.map((entry, i) => {
          const status = statusFor(entry)
          return (
            <li key={i} className="flex items-center gap-3 rounded-box bg-base-100 px-3 py-2">
              <span
                className={`h-2 w-2 shrink-0 rounded-full ${
                  status === "missed" ? "bg-error" : status === "opened" ? "bg-success" : "bg-primary"
                }`}
                aria-hidden="true"
              />
              <span className="font-mono">{entry.time.format("HH:mm")}</span>
              <span className="flex-1 truncate text-sm">{entry.label}</span>
              <span className="text-xs opacity-70">
                {status === "upcoming" ? "" : status === "opened" ? "Opened" : "Missed"}
              </span>
            </li>
          )
        })}
        {dayEntries.length === 0 && (
          <li className="text-sm opacity-60">Nothing planned for this day.</li>
        )}
      </ul>

      <div className="rounded-box bg-base-100 p-3">
        <p className="text-xs opacity-70">Total opens (all time)</p>
        <p className="text-xl font-bold">
          {Object.values(openCounts ?? {}).reduce((sum, n) => sum + n, 0)}
        </p>
        <ul className="mt-2 flex flex-col gap-1 text-sm">
          {inputs
            .filter((schedule) => (openCounts ?? {})[schedule.uuid])
            .map((schedule) => (
              <li key={schedule.uuid} className="flex justify-between gap-2">
                <span className="truncate">{schedule.title || schedule.url}</span>
                <span className="font-mono">{(openCounts ?? {})[schedule.uuid]}</span>
              </li>
            ))}
        </ul>
      </div>

      <p className="text-xs opacity-60">
        Opens only happen in the browser the extension is loaded in, and that browser must be open.
        "Missed" means no open was recorded at that time.
      </p>
    </div>
  )
}

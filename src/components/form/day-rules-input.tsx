import React, { FC, useEffect, useRef, useState } from "react"

import type { DayRule, ScheduleInput } from "~options"
import { DAY_NAMES } from "~utils"

// Above this many opens on one day, saving asks first
const LARGE_DAY = 30

type Props = {
  input: ScheduleInput
  index: number
  handleInputChange: (index: number, key: string, value: any) => void
}

type Patch = Partial<Pick<DayRule, "enabled" | "timesPerDay" | "minPerDay" | "minGapMinutes" | "windowStart" | "windowEnd">>

// One row per day of the week: on/off, number of opens, and the from/until window
export const DayRulesInput: FC<Props> = ({ input, index, handleInputChange }) => {
  const rules = input.dayRules ?? []

  // What the user is typing, shown straight away
  const [drafts, setDrafts] = useState<Record<number, Patch>>({})

  // The latest full set of rules, including changes not yet saved. Every change is
  // merged into this copy, so two quick edits to different days cannot overwrite each other.
  const latest = useRef<DayRule[]>(rules)
  const pending = useRef(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // When nothing is waiting to be saved, follow the stored rules
  useEffect(() => {
    if (!pending.current) latest.current = input.dayRules ?? []
  }, [input.dayRules])

  const flush = () => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = null
    if (!pending.current) return
    pending.current = false

    // Ask before saving a day with a lot of opens, and undo that day's change if the user says no
    const stored = input.dayRules ?? []
    const large = latest.current.filter((rule) => {
      const before = stored.find((r) => r.day === rule.day)
      return Number(rule.timesPerDay) > LARGE_DAY && Number(rule.timesPerDay) !== Number(before?.timesPerDay)
    })
    if (large.length > 0) {
      const names = large.map((rule) => DAY_NAMES[rule.day]).join(", ")
      if (!window.confirm(`${names}: more than ${LARGE_DAY} opens on one day. Save it?`)) {
        latest.current = latest.current.map((rule) => {
          const before = stored.find((r) => r.day === rule.day)
          return large.some((r) => r.day === rule.day) && before ? before : rule
        })
        setDrafts({})
        return
      }
    }

    handleInputChange(index, "dayRules", latest.current)
  }

  const queue = (day: number, patch: Patch, saveNow: boolean) => {
    latest.current = latest.current.map((rule) =>
      rule.day === day ? { ...rule, ...patch } : rule
    )
    pending.current = true

    if (timer.current) clearTimeout(timer.current)
    if (saveNow) {
      flush()
    } else {
      timer.current = setTimeout(flush, 600)
    }
  }

  const changeEnabled = (day: number, enabled: boolean) => {
    setDrafts((prev) => {
      const next = { ...prev }
      delete next[day]
      return next
    })
    queue(day, { enabled }, true)
  }

  const changeField = (day: number, field: keyof Patch, value: string) => {
    setDrafts((prev) => ({ ...prev, [day]: { ...prev[day], [field]: value } }))
    queue(day, { [field]: value } as Patch, false)
  }

  return (
    <div className="w-full mt-4">
      <label className="label">
        <span className="label-text">Each day</span>
      </label>
      <p className="px-1 pb-2 text-xs opacity-70">
        Each week the app picks a new number for every day, between the fewest and most opens you set. A day never repeats its number from the week before. Changing a day's times, gap or most opens redraws that day's planned times.
      </p>
      <div className="flex flex-col gap-2">
        {rules.map((rule) => {
          const draft = drafts[rule.day] ?? {}
          const timesPerDay = draft.timesPerDay ?? rule.timesPerDay
          const minPerDay = draft.minPerDay ?? rule.minPerDay ?? 0
          const minGapMinutes = draft.minGapMinutes ?? rule.minGapMinutes
          const windowStart = draft.windowStart ?? rule.windowStart
          const windowEnd = draft.windowEnd ?? rule.windowEnd
          const dayName = DAY_NAMES[rule.day]

          return (
            <div
              key={rule.day}
              className={`flex flex-wrap items-center gap-2 ${rule.enabled ? "" : "opacity-50"}`}>
              <input
                type="checkbox"
                className="checkbox checkbox-secondary"
                aria-label={`Turn on ${dayName}`}
                checked={rule.enabled}
                onChange={(e) => changeEnabled(rule.day, e.target.checked)}
              />
              <span className="w-24 font-medium">{dayName}</span>
              <input
                type="number"
                min={0}
                aria-label={`${dayName} fewest opens`}
                disabled={!rule.enabled}
                value={minPerDay}
                onChange={(e) => changeField(rule.day, "minPerDay", e.target.value)}
                className="input input-bordered input-secondary input-sm w-20"
              />
              <span>to</span>
              <input
                type="number"
                min={1}
                aria-label={`${dayName} most opens`}
                disabled={!rule.enabled}
                value={timesPerDay}
                onChange={(e) => changeField(rule.day, "timesPerDay", e.target.value)}
                className="input input-bordered input-secondary input-sm w-20"
              />
              <span>opens</span>
              <input
                type="number"
                min={0}
                aria-label={`${dayName} minimum minutes apart`}
                disabled={!rule.enabled}
                value={minGapMinutes}
                onChange={(e) => changeField(rule.day, "minGapMinutes", e.target.value)}
                className="input input-bordered input-secondary input-sm w-20"
              />
              <span>min apart, from</span>
              <input
                type="time"
                aria-label={`${dayName} from`}
                disabled={!rule.enabled}
                value={windowStart}
                onChange={(e) => changeField(rule.day, "windowStart", e.target.value)}
                className="input input-bordered input-secondary input-sm"
              />
              <span>until</span>
              <input
                type="time"
                aria-label={`${dayName} until`}
                disabled={!rule.enabled}
                value={windowEnd}
                onChange={(e) => changeField(rule.day, "windowEnd", e.target.value)}
                className="input input-bordered input-secondary input-sm"
              />
            </div>
          )
        })}
      </div>
    </div>
  )
}

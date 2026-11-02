import React, { FC, useRef, useState } from "react"

import type { DayRule, ScheduleInput } from "~options"
import { DAY_NAMES } from "~utils"

type Props = {
  input: ScheduleInput
  index: number
  handleInputChange: (index: number, key: string, value: any) => void
}

type Draft = Partial<Pick<DayRule, "timesPerDay" | "windowStart" | "windowEnd">>

// One row per day of the week: on/off, number of opens, and the from/until window
export const DayRulesInput: FC<Props> = ({ input, index, handleInputChange }) => {
  const rules = input.dayRules ?? []

  // Typed values are shown straight away and saved after a short pause, like the other inputs
  const [drafts, setDrafts] = useState<Record<number, Draft>>({})
  const timers = useRef<Record<number, ReturnType<typeof setTimeout>>>({})

  const saveRule = (day: number, patch: Partial<DayRule>) => {
    // read input.dayRules when saving, so an earlier save for another day is not lost
    const next = (input.dayRules ?? []).map((rule) =>
      rule.day === day ? { ...rule, ...patch } : rule
    )
    handleInputChange(index, "dayRules", next)
  }

  const changeEnabled = (day: number, enabled: boolean) => {
    saveRule(day, { enabled })
  }

  const changeField = (day: number, field: keyof Draft, value: string) => {
    setDrafts((prev) => ({ ...prev, [day]: { ...prev[day], [field]: value } }))

    clearTimeout(timers.current[day])
    timers.current[day] = setTimeout(() => {
      saveRule(day, { [field]: value } as Partial<DayRule>)
    }, 600)
  }

  return (
    <div className="w-full mt-4">
      <label className="label">
        <span className="label-text">Each day</span>
      </label>
      <div className="flex flex-col gap-2">
        {rules.map((rule) => {
          const draft = drafts[rule.day] ?? {}
          const timesPerDay = draft.timesPerDay ?? rule.timesPerDay
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
                min={1}
                aria-label={`${dayName} number of opens`}
                disabled={!rule.enabled}
                value={timesPerDay}
                onChange={(e) => changeField(rule.day, "timesPerDay", e.target.value)}
                className="input input-bordered input-secondary input-sm w-20"
              />
              <span>opens from</span>
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

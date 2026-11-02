import React, { FC } from "react"

import { ScheduleInput } from "~options"

type Props = {
  input: ScheduleInput
  index: number
  handleInputChange: (index: number, key: string, value: any) => void
}

const WEEKDAYS = [
  { label: "Sun", value: 0 },
  { label: "Mon", value: 1 },
  { label: "Tue", value: 2 },
  { label: "Wed", value: 3 },
  { label: "Thu", value: 4 },
  { label: "Fri", value: 5 },
  { label: "Sat", value: 6 }
]

// Toggle buttons for choosing which days of the week a "random" schedule runs on
export const WeekdayInput: FC<Props> = ({ input, index, handleInputChange }) => {
  const selected = input.days ?? []

  const toggle = (day: number) => {
    const next = selected.includes(day)
      ? selected.filter((d) => d !== day)
      : [...selected, day].sort((a, b) => a - b)

    handleInputChange(index, "days", next)
  }

  return (
    <div className="mt-4 md:mt-0">
      <label className="label">
        <span className="label-text">Days</span>
      </label>
      <div className="join flex-wrap">
        {WEEKDAYS.map(({ label, value }) => {
          const isSelected = selected.includes(value)
          return (
            <button
              key={value}
              type="button"
              aria-pressed={isSelected}
              onClick={() => toggle(value)}
              className={`join-item btn btn-sm ${isSelected ? "btn-secondary" : "btn-outline"}`}>
              {label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

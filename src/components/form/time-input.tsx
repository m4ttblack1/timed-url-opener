import { Icon } from "@primer/octicons-react"
import React, { FC, useState } from "react"

import { ScheduleInput } from "~options"

type Props = {
  icon: Icon
  label: string
  input: ScheduleInput
  index: number
  // which schedule field this input writes to (defaults to "time")
  inputKey?: keyof ScheduleInput
  handleInputChange: (index: number, key: string, value: any) => void
  setEditing: React.Dispatch<React.SetStateAction<boolean>>
}

export const TimeInput: FC<Props> = ({
  icon,
  label,
  input,
  index,
  inputKey = "time",
  handleInputChange,
  setEditing
}) => {
  const [time, setTime] = useState(input[inputKey] as string)
  const [timer, setTimer] = useState(null)
  const Icon = icon

  const handleChange = (index, key, value) => {
    clearTimeout(timer)
    setTime(value)
    setEditing(true)

    setTimer(
      setTimeout(() => {
        handleInputChange(index, key, value)
        setEditing(false)
      }, 600)
    )
  }

  return (
    <div className="mt-4 md:mt-0 w-32">
      <label className="label">
        <span className="label-text">
          <>
            <Icon size={16} className="mr-2" verticalAlign="middle" />
            {label}
          </>
        </span>
      </label>
      <input
        type="time"
        value={time}
        onChange={(e) => {
          handleChange(index, inputKey, e.target.value)
        }}
        className="input input-bordered input-secondary mt-1 p-2 border rounded-md w-full"
      />
    </div>
  )
}

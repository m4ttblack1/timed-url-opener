import {
  BrowserIcon,
  CalendarIcon,
  ClockIcon,
  NumberIcon,
  PulseIcon,
  QuestionIcon,
  SingleSelectIcon,
  TrashIcon
} from "@primer/octicons-react"
import React, { useState } from "react"
import toast from "react-hot-toast"

import { useStorage } from "@plasmohq/storage/hook"

import { store } from "~storage"
import { describeSeconds, randomScheduleError, weeklyOpenCount } from "~utils"

import { DateInput } from "./form/date-input"
import { NumberInput } from "./form/number-input"
import { SelectInput } from "./form/select-input"
import { TextInput } from "./form/text-input"
import { TimeInput } from "./form/time-input"
import { ToggleInput } from "./form/toggle-input"
import { UrlInput } from "./form/url-input"
import { DayRulesInput } from "./form/day-rules-input"

export const OptionInput = ({ input, index }) => {
  const [editing, setEditing] = useState(false)
  const [testing, setTesting] = useState(false)
  const [inputs, setInputs] = useStorage({ key: "inputs", instance: store }, [])

  const handleDeleteInput = (index: number) => {
    const name = inputs[index]?.title || inputs[index]?.url || "this schedule"
    if (!window.confirm(`Delete ${name}? This cannot be undone.`)) return
    const newInputs = [...inputs]
    const oldInput = newInputs[index]
    newInputs.splice(index, 1)
    setInputs(newInputs)
    toast(`Schedule ID: ${oldInput.uuid} Deleted.`, { icon: "🗑️" })
  }

  // Opens this schedule's URL straight away, using the same settings as a scheduled open
  const handleTestNow = async () => {
    if (!input.url) {
      toast("Add a URL first.")
      return
    }
    setTesting(true)
    try {
      const reply = await chrome.runtime.sendMessage({ type: "testOpen", uuid: input.uuid })
      toast(reply?.ok ? "Opened. Check your tabs." : reply?.error ?? "Could not open the URL.")
    } catch (err) {
      toast("Could not reach the background worker. Reload the extension and try again.")
    } finally {
      setTesting(false)
    }
  }

  const handleInputChange = (index: number, key: string, value: any) => {
    const newInputs = [...inputs]
    newInputs[index][key] = value
    setInputs(newInputs)
  }

  return (
    <>
      <div className="text-md">Schedule ID: {input.uuid}</div>
      <div key={input.uuid} className="flex flex-wrap gap-4">
        <TextInput
          label="Title (option)"
          placeholder="e.g. My Schedule"
          index={index}
          input={input}
          handleInputChange={handleInputChange}
          setEditing={setEditing}
        />
        <UrlInput
          icon={BrowserIcon}
          label="URL (required)"
          index={index}
          input={input}
          handleInputChange={handleInputChange}
          setEditing={setEditing}
        />

        <SelectInput
          icon={PulseIcon}
          index={index}
          input={input}
          handleInputChange={handleInputChange}
          setEditing={setEditing}
          inputKey="frequency"
          options={[
            { key: "Every", value: "every" },
            { key: "Daily", value: "daily" },
            { key: "Weekday", value: "weekday" },
            { key: "Oneshot", value: "oneshot" },
            { key: "Random", value: "random" }
          ]}
        />

        {input.frequency === "every" && (
          <NumberInput
            icon={NumberIcon}
            label="Amount"
            index={index}
            input={input}
            handleInputChange={handleInputChange}
            setEditing={setEditing}
          />
        )}
        {input.frequency === "every" && (
          <SelectInput
            icon={SingleSelectIcon}
            index={index}
            input={input}
            handleInputChange={handleInputChange}
            setEditing={setEditing}
            inputKey="unit"
            options={[
              { key: "Minutes", value: "minutes" },
              { key: "Hours", value: "hours" },
              { key: "Days", value: "days" }
            ]}
          />
        )}
        {input.frequency === "every" && (
          <DateInput
            icon={CalendarIcon}
            label="Start Date"
            index={index}
            input={input}
            handleInputChange={handleInputChange}
            setEditing={setEditing}
          />
        )}
        {input.frequency === "oneshot" && (
          <DateInput
            icon={CalendarIcon}
            label="Date"
            index={index}
            input={input}
            handleInputChange={handleInputChange}
            setEditing={setEditing}
          />
        )}
        {input.frequency === "every" && (
          <TimeInput
            icon={ClockIcon}
            label="Start Time"
            index={index}
            input={input}
            handleInputChange={handleInputChange}
            setEditing={setEditing}
          />
        )}
        {["oneshot", "daily", "weekday"].includes(input.frequency) && (
          <TimeInput
            icon={ClockIcon}
            label="Time"
            index={index}
            input={input}
            handleInputChange={handleInputChange}
            setEditing={setEditing}
          />
        )}
        {input.frequency === "random" && (
          <>
            <DayRulesInput
              index={index}
              input={input}
              handleInputChange={handleInputChange}
            />
            {randomScheduleError(input) ? (
              <p className="w-full text-error">{randomScheduleError(input)}</p>
            ) : (
              <p className="w-full text-sm opacity-70">
                About {weeklyOpenCount(input)} opens a week.
              </p>
            )}
          </>
        )}
        <div className="mt-4 md:mt-0">
          <label className="label">
            <span className="label-text">Open in</span>
          </label>
          <select
            className="select select-bordered select-secondary mt-1 w-full"
            value={input.background ? "background" : "active"}
            onChange={(e) =>
              handleInputChange(index, "background", e.target.value === "background")
            }>
            <option value="active">Active tab</option>
            <option value="background">Background tab</option>
          </select>
        </div>
        <NumberInput
          icon={ClockIcon}
          label="Close tab after (seconds, 0 = never)"
          inputKey="closeAfterSeconds"
          min={0}
          index={index}
          input={input}
          handleInputChange={handleInputChange}
          setEditing={setEditing}
        />
        <p className="w-full text-sm opacity-70 -mt-2">
          {describeSeconds(input.closeAfterSeconds)}
        </p>
      </div>
      <div className="form-control">
        <label className="label">
          <span className="label-text flex">
            Enabled
            <button
              className="tooltip tooltip-right"
              data-tip="Enable or disable this schedule.">
              <QuestionIcon size={20} className="ml-2" />
            </button>
          </span>
          <ToggleInput
            index={index}
            input={input}
            handleInputChange={handleInputChange}
            setEditing={setEditing}
            inputKey="enabled"
          />
        </label>
      </div>
      <div className="row flex justify-center p-4">
        {editing ? (
          <div>
            <p>
              <span className="loading loading-spinner loading-xs"></span>{" "}
              Saving...
            </p>
          </div>
        ) : (
          <div>
            <p className="invisible">Placeholder</p>
          </div>
        )}
      </div>
      <div className="row flex justify-center">
        <button
          onClick={handleTestNow}
          disabled={testing}
          className="btn btn-outline btn-sm mt-4">
          {testing ? "Opening..." : "Test now"}
        </button>
      </div>
      <div className="row flex justify-center">
        <button
          onClick={() => handleDeleteInput(index)}
          className="btn btn-secondary mt-4 w-1/3 mb-4 text-md">
          <TrashIcon size={24} />
          Delete
        </button>
      </div>
      {index !== inputs.length - 1 && <div className="w-full divider"></div>}
    </>
  )
}

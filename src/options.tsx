import React, { useEffect, useState } from "react"
import { resolveValue, toast, Toaster } from "react-hot-toast"

import { migrateToLocal, store } from "~storage"
import { useStorage } from "@plasmohq/storage/hook"

import "~style.css"

import {
  EyeIcon,
  MarkGithubIcon,
  DownloadIcon,
  PeopleIcon,
  UploadIcon,
  PlusIcon,
  StopwatchIcon
} from "@primer/octicons-react"
import dayjs from "dayjs"

import { DayCalendar } from "~components/day-calendar"
import { ThemeSelectButton } from "~components/form/theme-select-button"
import { Modal } from "~components/modal"
import { OptionInput } from "~components/option-input"
import { projectLinks } from "~config"
import { defaultDayRules, generateUUID, migrateRandomInput, scheduleHealth } from "~utils"

import { version } from "../package.json"

export type ScheduleInput = {
  title: string
  url: string
  time: string
  date: string
  frequency: Frequency
  amount: number
  unit: Unit
  background: boolean
  closeAfterSeconds?: number // close the opened tab after this many seconds; 0 keeps it open
  enabled: boolean
  uuid: string
  added_at: string
  is_valid: boolean
  // "random" frequency only: one rule per day of the week
  dayRules?: DayRule[]
}

// One row of the "random" frequency: what to do on one day of the week
export type DayRule = {
  day: number // 0 = Sunday ... 6 = Saturday
  enabled: boolean
  timesPerDay: number
  minGapMinutes: number // shortest allowed time between two opens that day
  windowStart: string // "HH:mm", inclusive
  windowEnd: string // "HH:mm", exclusive
}

export type Unit = "minutes" | "hours" | "days"
export type Frequency = "every" | "daily" | "weekday" | "oneshot" | "random"

const lightThemes = ["light", "nord", "valentine", "retro", "lofi", "cupcake"]
const darkThemes = ["midnight-gold", "dark", "dracula", "dim", "synthwave", "sunset", "coffee"]
const defaultTheme = "midnight-gold"

function OptionsIndex() {
  const [inputs, setInputs] = useStorage<ScheduleInput[]>({ key: "inputs", instance: store }, [])
  const [storedTheme, setTheme] = useStorage<string>({
    key: "theme",
    instance: store
  })
  const theme = storedTheme || defaultTheme
  const [paused, setPaused] = useStorage<boolean>({ key: "paused", instance: store }, false)
  const [selected, setSelected] = useState<number>(0)
  const [loading, setLoading] = useState<boolean>(true)
  // wait for saved schedules to be moved to local storage before showing or saving anything
  const [migrated, setMigrated] = useState<boolean>(false)
  useEffect(() => {
    migrateToLocal().finally(() => setMigrated(true))
  }, [])

  const schedules: ScheduleInput[] = inputs ?? []
  // keep the selection valid after a schedule is deleted
  const current = Math.min(selected, Math.max(0, schedules.length - 1))

  const handleAddInput = () => {
    setInputs([
      ...schedules,
      {
        enabled: true,
        title: "",
        url: "",
        time: dayjs().add(5, "minutes").format("HH:mm"),
        date: dayjs().format("YYYY-MM-DD"),
        frequency: "random",
        uuid: generateUUID(),
        amount: 1,
        unit: "minutes",
        background: false,
        added_at: new Date().toISOString(),
        is_valid: false,
        dayRules: defaultDayRules(),
        closeAfterSeconds: 0
      }
    ])
    setSelected(schedules.length)
    toast("New schedule added.", { className: "bg-secondary", icon: "👏" })
  }

  // Upgrade schedules saved by the first version of Random to per-day rules
  useEffect(() => {
    if (!inputs || !inputs.some((input) => input.frequency === "random" && !input.dayRules)) return
    setInputs(inputs.map(migrateRandomInput))
  }, [inputs])

  useEffect(() => {
    try {
      document.documentElement.setAttribute("data-theme", theme)
    } catch (e) {}

    setTimeout(() => {
      setLoading(false)
    }, 300)
  })

  const selectedSchedule = schedules[current]

  // Saves all schedules and settings to a file you can keep or move to another computer
  const handleExport = () => {
    const payload = { exportedAt: new Date().toISOString(), version, inputs: schedules }
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" })
    const link = document.createElement("a")
    link.href = URL.createObjectURL(blob)
    link.download = `timed-url-opener-${dayjs().format("YYYY-MM-DD")}.json`
    link.click()
    URL.revokeObjectURL(link.href)
    toast(`Exported ${schedules.length} schedule${schedules.length === 1 ? "" : "s"}.`)
  }

  // Loads schedules from a file made by Export. Replaces the current list after asking.
  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ""
    if (!file) return
    try {
      const data = JSON.parse(await file.text())
      const list = Array.isArray(data) ? data : data?.inputs
      if (!Array.isArray(list) || !list.every((item) => item && typeof item.uuid === "string")) {
        toast("That file is not a Timed URL Opener export.")
        return
      }
      if (!window.confirm(`Replace your ${schedules.length} current schedule(s) with ${list.length} from the file?`)) return
      const imported = list.map(migrateRandomInput) as ScheduleInput[]
      setInputs(imported)
      setSelected(0)
      // check every imported schedule so a broken one is spotted straight away
      const broken = imported.filter((item) => {
        const health = scheduleHealth(item)
        return health === "needs-url" || health === "needs-settings"
      }).length
      toast(
        `Imported ${imported.length} schedule${imported.length === 1 ? "" : "s"}.` +
          (broken > 0 ? ` ${broken} need${broken === 1 ? "s" : ""} fixing (orange dot).` : "")
      )
    } catch (err) {
      toast("Could not read that file.")
    }
  }

  return (
    <>
      <div
        className={`drawer h-full transition-all duration-300 ease-in-out ${
          !loading ? "" : "blur-lg"
        }`}
        data-theme={theme}>
        <input id="my-drawer" type="checkbox" className="drawer-toggle" />
        <div className="drawer-content flex min-h-screen flex-col">
          <Toaster
            containerClassName="toast"
            gutter={12}
            toastOptions={{ duration: 2000 }}>
            {(t) => (
              <div className="text-base-100 alert text-lg w-11/12 bg-secondary">
                {resolveValue(t.icon, t)} {resolveValue(t.message, t)}
              </div>
            )}
          </Toaster>

          <div className="navbar premium-navbar bg-base-100 px-4">
            <div className="navbar-start">
              <label htmlFor="my-drawer" className="btn btn-ghost btn-circle" aria-label="Open menu">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M4 6h16M4 12h16M4 18h7"
                  />
                </svg>
              </label>
            </div>
            <div className="navbar-center">
              <StopwatchIcon size={24} />
              <h1 className="premium-title ml-2 text-xl font-bold">Timed URL Opener</h1>
              <span className="ml-3 text-sm opacity-60">v{version}</span>
            </div>
            <div className="navbar-end gap-2">
              <button
                onClick={() => setPaused(!paused)}
                className={`btn btn-sm ${paused ? "btn-warning" : "btn-ghost"}`}>
                {paused ? "Resume all" : "Pause all"}
              </button>
              <a
                href={projectLinks.github}
                target="_blank"
                rel="noreferrer"
                title="View this project on GitHub"
                aria-label="View this project on GitHub"
                className="btn btn-ghost btn-circle">
                <MarkGithubIcon size={20} />
              </a>
              <button onClick={handleAddInput} className="btn btn-primary btn-sm">
                <PlusIcon size={18} />
                Add schedule
              </button>
            </div>
          </div>

          {paused && (
            <div role="alert" className="alert alert-warning mx-4 mt-4 py-2 text-sm">
              All schedules are paused. Nothing will open until you press Resume all.
            </div>
          )}

          <main className="grid flex-1 grid-cols-1 items-start gap-4 p-4 xl:grid-cols-2">
            <section className="card min-w-0 bg-base-200 p-4">
              {schedules.length === 0 ? (
                <p className="py-8 text-center opacity-70">
                  No schedules yet. Click Add schedule to create one.
                </p>
              ) : (
                <>
                  <div className="mb-4 flex flex-wrap gap-2" role="tablist" aria-label="Schedules">
                    {schedules.map((schedule, i) => (
                      <button
                        key={schedule.uuid}
                        role="tab"
                        aria-selected={i === current}
                        onClick={() => setSelected(i)}
                        className={`btn btn-sm ${i === current ? "btn-secondary" : "btn-ghost"}`}>
                        <span
                          aria-hidden="true"
                          className={`mr-2 inline-block h-2 w-2 rounded-full ${
                            { ok: "bg-success", "needs-url": "bg-warning", "needs-settings": "bg-warning", off: "bg-neutral" }[
                              scheduleHealth(schedule)
                            ]
                          }`}
                        />
                        {schedule.title || "Untitled"}
                      </button>
                    ))}
                  </div>
                  {selectedSchedule && (
                    <OptionInput
                      key={selectedSchedule.uuid}
                      index={current}
                      input={selectedSchedule}
                    />
                  )}
                </>
              )}
            </section>

            <section className="card min-w-0 bg-base-200 p-4">
              <DayCalendar inputs={schedules} />
            </section>
          </main>

          <footer className="px-4 pb-6 text-center text-sm opacity-70">
            Forked from{" "}
            <a href={projectLinks.original} target="_blank" rel="noreferrer" className="link">
              Timed URL Opener
            </a>{" "}
            by {projectLinks.originalAuthor}, released under the MIT License. Thank you to the
            original author.
          </footer>
        </div>

        <div className="drawer-side">
          <label htmlFor="my-drawer" aria-label="close sidebar" className="drawer-overlay"></label>
          <ul className="menu min-h-full w-80 bg-base-200 p-4 text-base-content">
            <li>
              <label htmlFor="theme_modal">
                <EyeIcon size={20} />
                Theme
              </label>
            </li>
            <li>
              <button onClick={handleExport}>
                <DownloadIcon size={20} />
                Export schedules
              </button>
            </li>
            <li>
              <label htmlFor="import-file">
                <UploadIcon size={20} />
                Import schedules
              </label>
              <input
                id="import-file"
                type="file"
                accept="application/json,.json"
                className="hidden"
                onChange={handleImport}
              />
            </li>
            <li>
              <label htmlFor="about_modal">
                <PeopleIcon size={20} />
                About
              </label>
            </li>
          </ul>
        </div>

        <Modal
          id="theme_modal"
          icon={<EyeIcon size={24} />}
          lead="Theme"
          body={
            <>
              <h3 className="mb-2 text-lg">Light themes</h3>
              <div className="join mb-2">
                {lightThemes.map((target) => (
                  <ThemeSelectButton
                    key={target}
                    current={theme}
                    target={target}
                    setTheme={setTheme}
                  />
                ))}
              </div>
              <h3 className="mb-2 text-lg">Dark themes</h3>
              <div className="join">
                {darkThemes.map((target) => (
                  <ThemeSelectButton
                    key={target}
                    current={theme}
                    target={target}
                    setTheme={setTheme}
                  />
                ))}
              </div>
            </>
          }
        />
        <Modal
          id="about_modal"
          icon={<PeopleIcon size={24} />}
          lead="About"
          body={
            <>
              <p>Timed URL Opener opens a URL at times you choose, including random times on the days you pick.</p>
              <p className="mt-4 text-sm opacity-80">
                Based on Timed URL Opener by {projectLinks.originalAuthor}, released under the MIT
                License.{" "}
                <a href={projectLinks.original} target="_blank" rel="noreferrer" className="link">
                  Original project
                </a>
                {" · "}
                <a href={projectLinks.github} target="_blank" rel="noreferrer" className="link">
                  This fork
                </a>
              </p>
            </>
          }
        />
      </div>
      {(loading || !migrated) && (
        <div className="fixed inset-0 bg-blur z-50">
          <div className="fixed inset-0 bg-blur z-50 flex items-center justify-center">
            <div className="border-t-4 border-blue-500 border-solid rounded-full animate-spin h-12 w-12"></div>
          </div>
        </div>
      )}
    </>
  )
}

export default OptionsIndex

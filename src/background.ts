import { Storage } from "@plasmohq/storage"
import dayjs from "dayjs";
import type { ScheduleInput } from "~options";
import { computeNextAlarmTime, computeNextFiveWeekdayAlarmTime, generateNext5Dates, migrateRandomInput, planRandomTimes } from "~utils";

// Record of each open that actually happened, shown by the calendar. Kept short.
const OPEN_LOG_KEY = "openLog";
const OPEN_LOG_LIMIT = 300;
const OPEN_COUNTS_KEY = "openCounts";

// @ts-ignore
import activeIcon from "../assets/icon_active_32x32.png"
// @ts-ignore
import inactiveIcon from "../assets/icon_inactive_32x32.png"

const env = process.env.NODE_ENV;
const envPrefix = env === "development" ? "DEV | " : "";
const defaultTitle = `${envPrefix}Timed URL Opener`

// Alarm names are `openURL<uuid>` with an optional `|<suffix>` for alarms that need
// to be unique per date or time. The uuid is always the part before the first `|`.
const OPEN_ALARM_PREFIX = "openURL";
// Hourly alarm that re-plans "random" schedules, so the next days get planned after midnight
const REFRESH_RANDOM_ALARM = "refreshRandomSchedules";

const main = async () => {

    const storage = new Storage();

    const keepAlive = () => setInterval(chrome.runtime.getPlatformInfo, 20e3);

    chrome.runtime.onInstalled.addListener(async () => {
        await updateAlarms();
    });

    chrome.runtime.onStartup.addListener(async () => {
        await updateAlarms();
        keepAlive();
    });

    keepAlive();

    chrome.action.onClicked.addListener(function (tab) {
        chrome.runtime.openOptionsPage(() => console.log("options page opened"));
    })

    console.info("background script loaded")

    storage.watch({
        "inputs": async (c) => {
            await updateAlarms();
        },
        make: (c) => {
            console.log(c.newValue)
        }
    })

    async function updateAlarms() {
        await chrome.alarms.clearAll();

        const inputs: ScheduleInput[] = await loadInputs();

        await updateIcon(inputs);

        if (inputs.some((input) => input.frequency === "random")) {
            chrome.alarms.create(REFRESH_RANDOM_ALARM, { periodInMinutes: 60 });
        }

        inputs.forEach((input) => {

            // return if url is empty
            if (!input.url) return;

            // return if url is not valid
            try {
                new URL(input.url);
            } catch (err) {
                return;
            }

            // return if time is empty when frequency is (daily, weekday, oneshot)
            if (!input.time && ["daily", "weekday", "oneshot"].includes(input.frequency)) return;

            // process by frequency
            switch (input.frequency) {
                case "every":
                    processEveryFrequency(input);
                    return;
                case "daily":
                    processDailyFrequency(input);
                    return;
                case "weekday":
                    processWeekdayFrequency(input);
                    return;
                case "oneshot":
                    processOneshotFrequency(input);
                    return;
                case "random":
                    processRandomFrequency(input);
                    return;
                default:
                    return;
            }
        });
    }

    async function updateIcon(inputs: ScheduleInput[]) {
        // set icon to active if enabled inputs exists
        const active = inputs.some(({ url, enabled }) => url.length > 0 && enabled);

        if (active) {
            setIconActive()
        } else {
            setIconInactive()
        }

        // set badge text
        const enabledInputs = inputs.filter(({ url, enabled }) => url.length > 0 && enabled);
        const badgeText = enabledInputs.length > 0 ? enabledInputs.length.toString() : "";
        chrome.action.setBadgeText({ text: badgeText });

        // set title
        chrome.action.setTitle({ title: enabledInputs.length > 0 ? `${defaultTitle} (${enabledInputs.length} active schedules)` : defaultTitle });
    }

    function setIconActive() {
        chrome.action.setIcon({ path: activeIcon });
    }

    function setIconInactive() {
        chrome.action.setIcon({ path: inactiveIcon });
    }

    function processEveryFrequency(input: ScheduleInput) {
        const startTime = dayjs(`${input.date} ${input.time}`);
        const currentTime = dayjs();

        let periodInMinutes = 0;

        // convert amount to number if it is string
        if (typeof input.amount === "string") {
            input.amount = parseInt(input.amount);
        }

        switch (input.unit) {
            case "minutes":
                periodInMinutes = input.amount;
                break;
            case "hours":
                periodInMinutes = input.amount * 60;
                break;
            case "days":
                periodInMinutes = input.amount * 24 * 60;
                break;
        }

        const next5Dates = generateNext5Dates(input);

        chrome.alarms.create(`${OPEN_ALARM_PREFIX}${input.uuid}`, {
            when: startTime.valueOf() < currentTime.valueOf() ?
                next5Dates.at(0).valueOf() // if startTime is before currentTime, set alarm to next first date
                : startTime.valueOf(), // else set alarm to startTime
            periodInMinutes: periodInMinutes,
        });
    }

    function processDailyFrequency(input: ScheduleInput) {
        chrome.alarms.create(`${OPEN_ALARM_PREFIX}${input.uuid}`, {
            when: computeNextAlarmTime(input.time),
            periodInMinutes: 24 * 60,
        });
    }

    function processWeekdayFrequency(input: ScheduleInput) {
        const dates = computeNextFiveWeekdayAlarmTime(input.time);

        dates.forEach((date) => {
            chrome.alarms.create(`${OPEN_ALARM_PREFIX}${input.uuid}|${date.valueOf()}`, {
                when: date.valueOf(),
                periodInMinutes: 24 * 60 * 7,
            });
        });
    }

    function processOneshotFrequency(input: ScheduleInput) {
        chrome.alarms.create(`${OPEN_ALARM_PREFIX}${input.uuid}`, {
            when: computeNextAlarmTime(input.time),
        });
    }

    // Plans one-off alarms for today and tomorrow. Each alarm is named with its date and
    // index, so re-planning can find and replace them. Times already in the past are skipped.
    function processRandomFrequency(input: ScheduleInput) {
        if (!input.enabled) return;

        const now = dayjs();

        for (const offset of [0, 1]) {
            const day = now.add(offset, "day");

            planRandomTimes(input, day).forEach((when, index) => {
                if (!when.isAfter(now)) return;

                chrome.alarms.create(`${OPEN_ALARM_PREFIX}${input.uuid}|${day.format("YYYYMMDD")}|${index}`, {
                    when: when.valueOf(),
                });
            });
        }
    }

    // Rebuilds only the random-frequency alarms. This is cheaper than a full updateAlarms(),
    // and it must not touch other schedules: one-shot and weekday alarms recreated with their
    // original timing would fire again.
    async function refreshRandomAlarms() {
        const inputs: ScheduleInput[] = await loadInputs();
        const randomInputs = inputs.filter((input) => input.frequency === "random" && input.enabled && input.url);

        if (randomInputs.length === 0) return;

        const alarms = await chrome.alarms.getAll();

        for (const input of randomInputs) {
            for (const alarm of alarms) {
                if (alarm.name.startsWith(`${OPEN_ALARM_PREFIX}${input.uuid}|`)) {
                    await chrome.alarms.clear(alarm.name);
                }
            }

            processRandomFrequency(input);
        }
    }

    // Loads schedules, upgrading any saved by the first version of Random
    async function loadInputs(): Promise<ScheduleInput[]> {
        const raw = ((await storage.get("inputs")) ?? []) as any[];
        return raw.map(migrateRandomInput);
    }

    // Adds an entry to the open log that the calendar reads
    async function recordOpen(uuid: string, url: string) {
        const log: { uuid: string; url: string; at: number }[] = (await storage.get(OPEN_LOG_KEY)) ?? [];
        log.push({ uuid, url, at: Date.now() });
        await storage.set(OPEN_LOG_KEY, log.slice(-OPEN_LOG_LIMIT));

        // running total per schedule, never trimmed
        const counts: Record<string, number> = (await storage.get(OPEN_COUNTS_KEY)) ?? {};
        counts[uuid] = (counts[uuid] ?? 0) + 1;
        await storage.set(OPEN_COUNTS_KEY, counts);
    }

    // open url when alarm is triggered
    chrome.alarms.onAlarm.addListener(async alarm => {
        if (alarm.name === REFRESH_RANDOM_ALARM) {
            await refreshRandomAlarms();
            return;
        }

        // strip the prefix, then drop any `|suffix` to get the schedule uuid
        const uuid = alarm.name.substring(OPEN_ALARM_PREFIX.length).split("|")[0];
        const inputs: ScheduleInput[] = await loadInputs();

        // get property from inputs matched uuid
        const schedule = inputs.find(({ uuid: inputUUID }) => inputUUID === uuid);
        if (!schedule) return;

        const { enabled, url, background } = schedule;

        // do nothing if not enabled
        if (!enabled) return;

        const active = !background;
        // open url
        if (url) {
            const tab = await chrome.tabs.create({ url, active });
            await recordOpen(uuid, url);

            // close the tab after the chosen number of seconds (0 = keep it open)
            const closeAfter = Number(schedule.closeAfterSeconds) || 0;
            if (closeAfter > 0 && tab.id !== undefined) {
                setTimeout(() => {
                    chrome.tabs.remove(tab.id!).catch(() => {});
                }, closeAfter * 1000);
            }
            setIconActive()
        }
    });

};

main();

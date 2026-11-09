import { Storage } from "@plasmohq/storage"

// Local storage has no per-item size limit. Synced storage does (8 KB per item), which
// the open log outgrew, so everything is kept locally.
export const store = new Storage({ area: "local" })

const legacy = new Storage({ area: "sync" })
const KEYS_TO_COPY = ["inputs", "theme"]
const MARKER = "movedToLocal"

// Copies schedules and the theme from synced storage to local storage, once.
export const migrateToLocal = async (): Promise<void> => {
    try {
        if (await store.get(MARKER)) return

        for (const key of KEYS_TO_COPY) {
            const existing = await store.get(key)
            if (existing !== undefined) continue
            const old = await legacy.get(key)
            if (old !== undefined) await store.set(key, old)
        }

        await store.set(MARKER, true)
    } catch (err) {
        console.warn("Could not move saved data to local storage", err)
    }
}

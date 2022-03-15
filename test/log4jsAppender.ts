import {LoggingEvent} from "log4js";
import delay from "delay";
import {AssertionError} from "chai";

const listeners = []

export function configure() {
    return function (event: LoggingEvent) {
        for (let listener of listeners) {
            listener(event)
        }
        if (event.level.levelStr.toLowerCase() === "error") {
            throw new Error(`Logger recorded error event: ${event.data.join(" ")}`)
        }
    }
}

declare type EventFilter = ((LoggingEvent) => boolean) | { level: string, data: string | RegExp }

export async function hasEvent(filter: EventFilter, timeout = 500): Promise<boolean> {
    if (typeof filter !== "function") {
        const {level, data} = filter
        filter = (event: LoggingEvent) => {
            const dataStr = event.data.join(" "), levelStr = event.level.levelStr.toLowerCase()
            return levelStr === level.toLowerCase() && (typeof data === "string" ? dataStr === data : data.test(dataStr))
        }
    }
    let result = false
    const timer = delay(timeout)
    const listener = (event: LoggingEvent) => {
        if ((<(LoggingEvent) => boolean>filter)(event)) {
            result = true
            timer.clear()
        }
    }
    listeners.push(listener)
    await timer
    return result
}

export async function expectEvent(filter: EventFilter, timeout = 500): Promise<void> {
    if (!await hasEvent(filter, timeout)) throw new AssertionError(`expected event ${filter["data"]} should have been emited`)
}

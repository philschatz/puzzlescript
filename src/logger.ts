export enum LOG_LEVEL {
    SEVERE = 'SEVERE',
    WARN = 'WARN',
    INFO = 'INFO',
    DEBUG = 'DEBUG',
    TRACE = 'TRACE'
}

const LEVELS = [
    LOG_LEVEL.SEVERE,
    LOG_LEVEL.WARN,
    LOG_LEVEL.INFO,
    LOG_LEVEL.DEBUG,
    LOG_LEVEL.TRACE,
]

function toNum(level: LOG_LEVEL) {
    return LEVELS.indexOf(level)
}

function toLevel(level?: string) {
    if (level) {
        switch(level.toUpperCase()) {
            case LOG_LEVEL.SEVERE: return LOG_LEVEL.SEVERE
            case LOG_LEVEL.DEBUG: return LOG_LEVEL.DEBUG
            case LOG_LEVEL.TRACE: return LOG_LEVEL.TRACE
            default:
                throw new Error(`ERROR: Invalid log level. valid levels are ${JSON.stringify(LEVELS)}`)
        }
    } else {
        return LOG_LEVEL.SEVERE
    }
}

type LogMessage = (() => any) | any

export const logger = new class Logger {
    private readonly currentLevelNum: number
    constructor() {
        this.currentLevelNum = toNum(toLevel(process.env.LOG_LEVEL))
    }
    isLevel(level: LOG_LEVEL) {
        return toNum(level) <= this.currentLevelNum
    }
    private logFn(level: LOG_LEVEL, fn: () => string) {
        if (this.isLevel(level)) {
            console.warn(fn())
        }
    }
    private log(level: LOG_LEVEL, message: LogMessage) {
        if (typeof message === 'string') {
            this.logFn(level, () => message)
        } else {
            this.logFn(level, message)
        }
    }

    warn(message: LogMessage) {
        this.log(LOG_LEVEL.WARN, message)
    }
    info(message: LogMessage) {
        this.log(LOG_LEVEL.INFO, message)
    }
    debug(message: LogMessage) {
        this.log(LOG_LEVEL.DEBUG, message)
    }
    trace(message: LogMessage) {
        this.log(LOG_LEVEL.TRACE, message)
    }
}
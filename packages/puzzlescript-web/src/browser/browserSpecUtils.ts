/* eslint-env jasmine */
import type {Page, Browser, Dialog, ConsoleMessage} from 'puppeteer' // tslint:disable-line:no-implicit-dependencies

// Defined via jest-puppeteer environment
declare let page: Page
declare let browser: Browser
declare let puppeteerConfig: {
    server: { port: number }
}

const ignoredMessages = [
    'The AudioContext was not allowed to start. It must be resumed (or created) after a user gesture on the page. https://goo.gl/7K7WLu',
    "The resource http://localhost:12490/puzzlescript-webworker.js was preloaded using link preload but not used within a few seconds from the window's load event. Please make sure it has an appropriate `as` value and it is preloaded intentionally."
]

const dismissedCount: string[] = []

const dialogHandler = async(dialog: Dialog) => {
    dismissedCount.push(dialog.message())
    await dialog.dismiss()
}

export const getUrl = (path: string) => `http://localhost:${puppeteerConfig.server.port}/${path.replace(/^\/+/, '')}`

// redirect browser console messages to the terminal
export const consoleHandler = (message: ConsoleMessage) => {
    const type = message.type()
    const text = message.text()

    if (ignoredMessages.indexOf(text) >= 0) return
    switch (type) {
        case 'log': console.log(text); break // tslint:disable-line:no-console
        case 'debug': console.debug(text); break // tslint:disable-line:no-console
        case 'info': console.info(text); break // tslint:disable-line:no-console
        case 'error': console.error(text); break // tslint:disable-line:no-console
        case 'dir': console.dir(text); break // tslint:disable-line:no-console
        case 'dirxml': console.dirxml(text); break // tslint:disable-line:no-console
        case 'table': console.table(text); break // tslint:disable-line:no-console
        case 'trace': console.trace(text); break // tslint:disable-line:no-console
        case 'assert': console.assert(text); break // tslint:disable-line:no-console
        case 'profile': console.profile(text); break // tslint:disable-line:no-console
        case 'profileEnd': console.profileEnd(); break // tslint:disable-line:no-console
        case 'count': console.count(text); break // tslint:disable-line:no-console
        case 'timeEnd': console.timeEnd(text); break // tslint:disable-line:no-console

        case 'clear': console.clear(); break // tslint:disable-line:no-console
        case 'warn': console.warn(text); break // tslint:disable-line:no-console
        case 'startGroup':
        case 'startGroupCollapsed':
        case 'endGroup':
            console.info(type, text); break // tslint:disable-line:no-console
    }
}

export const browserBeforeEach = () => {
    // jest-puppeteer will expose the `page` and `browser` globals to Jest tests.
    if (!browser || !page) {
        throw new Error('Browser has not been started! Did you remember to specify `@jest-environment puppeteer`?')
    }

    page.on('console', consoleHandler)
    page.on('dialog', dialogHandler)

    // page.on('pageerror', async e => {
    //     const newStack = await mapStackTrace(e.message, { isChromeOrEdge: true })
    //     console.error(newStack)
    // })
}

export const browserAfterEach = () => {
    if (!page.isClosed()) {
        page.off('console', consoleHandler)
        page.off('dialog', dialogHandler)
    }
}

export const browserDismissedDialogs = () => dismissedCount

/* eslint-env jasmine */
import puppeteer from 'puppeteer' // tslint:disable-line:no-implicit-dependencies

// Defined via jest-puppeteer environment
declare var page: puppeteer.Page
declare var browser: puppeteer.Browser
declare var puppeteerConfig: {
    server: { port: number }
}

const dismissedCount: string[] = []

const dialogHandler = async(dialog: puppeteer.Dialog) => {
    dismissedCount.push(dialog.message())
    await dialog.dismiss()
}

export const getUrl = (path: string) => `http://localhost:${puppeteerConfig.server.port}/${path.replace(/^\/+/, '')}`

// redirect browser console messages to the terminal
export const consoleHandler = (message: puppeteer.ConsoleMessage) => {
    const type = message.type()
    const text = message.text()

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
        case 'profileEnd': console.profileEnd(text); break // tslint:disable-line:no-console
        case 'count': console.count(text); break // tslint:disable-line:no-console
        case 'timeEnd': console.timeEnd(text); break // tslint:disable-line:no-console

        case 'clear': console.clear(); break // tslint:disable-line:no-console
        case 'warning': console.warn(text); break // tslint:disable-line:no-console
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
        // Node 8 does not have EventListener.off(...)
        page.removeListener('console', consoleHandler)
        page.removeListener('dialog', dialogHandler)
    }
}

export const browserDismissedDialogs = () => dismissedCount

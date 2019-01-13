/** @jest-environment puppeteer */
/* eslint-env jasmine */
import fs from 'fs'
import path from 'path'
import puppeteer from 'puppeteer' // tslint:disable-line:no-implicit-dependencies
// import mapStackTrace from 'sourcemapped-stacktrace-node')

// Defined via jest-puppeteer environment
declare var page: puppeteer.Page
declare var browser: puppeteer.Browser

async function sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms))
}

async function getAttrs() {
    return page.$eval('.ps-table', (el) => {
        return {
            count: el.getAttribute('data-ps-last-input-processed'),
            isAcceptingInput: el.getAttribute('data-ps-accepting-input'),
            levelNum: el.getAttribute('data-ps-current-level')
        }
    })
}

async function pressKeys(keys: string[]) {
    for (const key of keys) {
        if (key === ',') { continue }
        await page.waitFor(`.ps-table[data-ps-accepting-input='true']`)
        if (key === '.') {
            // wait long enough for a tick to occur
            await sleep(100)
            continue
        }
        const { count } = await getAttrs()
        // await page.keyboard.press(`Key${key}`)
        await page.keyboard.down(`Key${key}`)
        await sleep(100) // because alerts might show up and they take some time to pop open?
        await page.keyboard.up(`Key${key}`)
        await sleep(100)
        // wait until the keypress was processed
        await page.waitFor(`.ps-table:not([data-ps-last-input-processed='${count}'])`)
    }
}

// redirect browser console messages to the terminal
const consoleHandler = (message: puppeteer.ConsoleMessage) => {
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

async function evaluateWithStackTrace(fn: puppeteer.EvaluateFn, ...args: any[]) {
    // try {
    return page.evaluate(fn, ...args)
    // } catch (e) {
    //     const stack = e.stack
    //     const message = stack.split('\n')[0]
    //     const newStack = await mapStackTrace(stack, { isChromeOrEdge: true })
    //     console.error(`${message}\n${newStack}`)
    //     e.stack = newStack
    //     throw e
    // }
}

async function playLevel() {
    const source = fs.readFileSync(path.join(__dirname, '../../gists/pot-wash-panic_itch/script.txt'), 'utf-8')
    const startLevel = 3

    // This variable is _actually_ defined in the JS file, not here but it is in the body of page.evaluate
    const HackTableStart = (sourceBrowser: string, startLevelBrowser: number) => 'actually implemented in the browser'

    await evaluateWithStackTrace(({ source, startLevel }) => { // tslint:disable-line:no-shadowed-variable
        if (HackTableStart) {
            if (source && typeof startLevel === 'number') {
                HackTableStart(source, startLevel)
            } else {
                throw new Error(`BUG: Source was not a string or startLevel was not a number`)
            }
        } else {
            throw new Error(`BUG: The browser JS does not have HackTableStart defined`)
        }
    }, { source, startLevel })

    await pressKeys('SAAASASDDDWDDDDWDDSAAASASAW'.split(''))
}

describe('Browser', () => {

    const dismissedCount: string[] = []

    const dialogHandler = async(dialog: puppeteer.Dialog) => {
        dismissedCount.push(dialog.message())
        await dialog.dismiss()
    }

    beforeEach(() => {
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
    })

    afterEach(() => {
        // Node 8 does not have EventListener.off(...)
        page.removeListener('console', consoleHandler)
        page.removeListener('dialog', dialogHandler)
    })

    it('plays a game in the browser using the SyncTableEngine', async() => {
        // browser tests are slow. Headless is slower it seems (from jest watch mode)
        jest.setTimeout(process.env.NODE_ENV === 'development' ? 90 * 1000 : 90 * 1000)
        await page.goto(`http://localhost:8000/src/browser/spec/html-table.xhtml`)
        return playLevel()
    })

    it('plays a game in the browser using the WebworkerTableEngine', async() => {
        // browser tests are slow. Headless is slower it seems (from jest watch mode)
        jest.setTimeout(process.env.NODE_ENV === 'development' ? 90 * 1000 : 90 * 1000)
        await page.goto(`http://localhost:8000/src/browser/spec/html-table-webworker.xhtml`)
        return playLevel()
    })

    it('plays a couple levels using the demo page', async() => {
        const waitForDialogAfter = async(fn: () => Promise<any>) => {
            // page.once('dialog', dialogHandler)
            const oldCount = dismissedCount.length
            await fn()
            // Keep checking for the dialog to be dismissed
            if (dismissedCount.length > oldCount) {
                return
            }
            await sleep(100) // wait a little bit
            if (dismissedCount.length > oldCount) {
                return
            }
            await sleep(1000) // wait for the dialog to open and be dismissed
            if (dismissedCount.length > oldCount) {
                return
            }
            await sleep(10000) // wait a long time
            expect(dismissedCount.length).toBeGreaterThan(oldCount)
        }

        // The game shows a dialog immediately (uggh)
        await waitForDialogAfter(async() => {
            await page.goto(`http://localhost:8000/index.xhtml`)
            await page.waitForSelector(`#loadingIndicator.hidden`)
        })

        // play a level and then wait for the dialog to open
        await page.waitForSelector(`.ps-table[data-ps-current-level="${1}"]`)
        await waitForDialogAfter(async() => pressKeys('.AWAW'.split('')))

        await page.waitForSelector(`.ps-table[data-ps-current-level="${3}"]`)
        await waitForDialogAfter(async() => pressKeys('.WASDW'.split('')))

        await page.waitForSelector(`.ps-table[data-ps-current-level="${5}"]`)

        expect(dismissedCount.length).toBe(5)
    })
})

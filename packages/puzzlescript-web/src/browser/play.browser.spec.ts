/** @jest-environment puppeteer */
/* eslint-env jasmine */
import fs from 'fs'
import path from 'path'
import { EvaluateFunc, KeyInput, Page } from 'puppeteer'
import { browserAfterEach, browserBeforeEach, getUrl } from './browserSpecUtils'
// import mapStackTrace from 'sourcemapped-stacktrace-node')

// Defined via jest-puppeteer environment
declare let page: Page

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

const dialogMessages: string[] = []

async function closeDialog() {
    const dialogMessage = await page.evaluate(() => {
        function findEl(sel: string) {
            const ret = window.document.querySelector(sel)
            if (!ret) { throw new Error(`BUG: Could not find selector "${sel}". Maybe it was renamed?`) }
            return ret as HTMLElement
        }

        const dialog = findEl('#messageDialog')
        const dialogCloseButton = findEl('#messageDialogClose')
        const dialogText = findEl('#messageDialogText')

        if (dialog.hasAttribute('open')) {
            dialogCloseButton.click()
            const oldCount = parseInt(dialog.getAttribute('data-dismissed-count') || '0', 10)
            dialog.setAttribute('data-dismissed-count', `${oldCount + 1}`)
            return dialogText.textContent
        } else {
            throw new Error(`BUG: Dialog was not open`)
        }
    }) as string

    dialogMessages.push(dialogMessage)

    // Verify the dialog was closed before continuing
    await sleep(100)
    await page.evaluate(() => {
        const dialog = window.document.querySelector('#messageDialog')
        const dialogCloseButton = window.document.querySelector('#messageDialogClose')
        if (dialog && dialogCloseButton && !dialog.hasAttribute('open')) {
            return
        } else {
            throw new Error(`BUG: Dialog does not exist or is still open`)
        }
    })
}

async function waitForDialogAndClose() {
    await page.waitForSelector(`#messageDialog[open]`)
    await closeDialog()
}

async function pressKeys(keys: string[], isLastPressADialog: boolean) {
    for (let index = 0; index < keys.length; index++) {
        const key = keys[index]
        if (key === ',') { continue }
        await page.waitForSelector(`.ps-table[data-ps-accepting-input='true']`)
        if (key === '.') {
            // wait long enough for a tick to occur
            await sleep(100)
            continue
        }
        let k: KeyInput = 'Power'
        if (key === 'W') { k = 'KeyW'}
        else if (key === 'A') { k = 'KeyA'}
        else if (key === 'S') { k = 'KeyS'}
        else if (key === 'D') { k = 'KeyD'}
        else { throw new Error(`Unsupported key '${key}'`)}

        const { count } = await getAttrs()
        // await page.keyboard.press(k)
        await page.keyboard.down(k)
        await sleep(100) // because alerts might show up and they take some time to pop open?
        await page.keyboard.up(k)
        await sleep(100)
        // wait until the keypress was processed (might need to dismiss a dialog)
        if (isLastPressADialog && index === keys.length - 1) {
            await waitForDialogAndClose()
        } else {
            await page.waitForSelector(`.ps-table:not([data-ps-last-input-processed='${count}'])`)
        }
    }
}

async function evaluateWithStackTrace(fn: EvaluateFunc<{ source: string, startLevel: number }[]>, ...args: any[]) {
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
    const source = fs.readFileSync(path.join(__dirname, '../../../puzzlescript/games/pot-wash-panic/script.txt'), 'utf-8')
    const startLevel = 3

    await evaluateWithStackTrace(({ source, startLevel }) => { // tslint:disable-line:no-shadowed-variable
        if ((window as any).HackTableStart) {
            if (source && typeof startLevel === 'number') {
                (window as any).HackTableStart(source, startLevel)
            } else {
                throw new Error(`BUG: Source was not a string or startLevel was not a number`)
            }
        } else {
            throw new Error(`BUG: The browser JS does not have HackTableStart defined`)
        }
    }, { source, startLevel })

    await pressKeys('SAAASASDDDWDDDDWDDSAAASASAW'.split(''), false)
}

describe('Browser', () => {

    beforeEach(browserBeforeEach)
    afterEach(browserAfterEach)

    it('plays a game in the browser using the SyncTableEngine', async() => {
        // browser tests are slow. Headless is slower it seems (from jest watch mode)
        await page.goto(getUrl(`/_test-html-table.xhtml`))
        return playLevel()
    }, process.env.NODE_ENV === 'development' ? 90 * 1000 : 90 * 1000)

    it('plays a game in the browser using the WebworkerTableEngine', async() => {
        // browser tests are slow. Headless is slower it seems (from jest watch mode)
        await page.goto(getUrl(`/_test-html-table-webworker.xhtml`))
        return playLevel()
    }, process.env.NODE_ENV === 'development' ? 90 * 1000 : 90 * 1000)

    it('plays a couple levels using the demo page', async() => {
        const jsDismissedDialogs = async() => {
            const ret = await page.evaluate(() => {
                const dialog = window.document.querySelector('#messageDialog')
                if (dialog) {
                    return parseInt(dialog.getAttribute('data-dismissed-count') || '0', 10)
                } else {
                    return -1
                }
            })
            return ret as number
        }

        // The game shows a dialog immediately (uggh)
        await page.goto(getUrl(`index.xhtml#icecrates`))
        await page.waitForSelector(`#loadingDialog:not([open])`)
        await waitForDialogAndClose()

        // play a level and then wait for the dialog to open
        await page.waitForSelector(`.ps-table[data-ps-current-level="${1}"]`)
        await pressKeys('.AWAW'.split(''), true)

        await page.waitForSelector(`.ps-table[data-ps-current-level="${3}"]`)
        await pressKeys('.WASDW'.split(''), true)

        await page.waitForSelector(`.ps-table[data-ps-current-level="${5}"]`)

        const dismissedCount = await jsDismissedDialogs()
        // if (dismissedCount !== 3) {
        //     throw new Error(`Dialog count mismatch. Expected ${3} but got these: ${JSON.stringify(dialogMessages)}`)
        // }
        expect(dismissedCount).toBe(3)
    }, process.env.NODE_ENV === 'development' ? 90 * 1000 : 90 * 1000)
})

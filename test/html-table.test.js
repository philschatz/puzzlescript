/** @jest-environment puppeteer */
/* eslint-env jasmine */
const fs = require('fs')
const path = require('path')
// const puppeteer = require('puppeteer')
// const mapStackTrace = require('sourcemapped-stacktrace-node').default

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms))
}

async function pressKeys(page, keys) {
    for (const key of keys) {
        if (key === ',') { continue }
        await page.waitFor(`table[data-ps-accepting-input='true']`)
        if (key === '.') {
            // wait long enough for a tick to occur
            await sleep(100)
            continue
        }
        // await sleep(500/*Math.ceil(1000/60)*/) // enough for requestAnimationFrame to run (60fps)
        await page.keyboard.press(`Key${key}`)
        // wait until the keypress was processed
        await sleep(100)
        // await page.waitFor(`table[data-ps-accepting-input='false']`)
    }
}


async function startBrowser() {
    const url = `http://localhost:8000/test/browser/html-table.xhtml`

    // jest-puppeteer will expose the `page` and `browser` globals to Jest tests.
    if (!browser || !page) {
        throw new Error('Browser has not been started! Did you remember to specify `@jest-environment puppeteer`?');
    }

    // redirect browser console messages to the terminal
    page.on('console', (consoleMessage) => {
        const type = consoleMessage.type()
        const text = consoleMessage.text()

        const fn = console[type] || console.log
        fn.apply(console, [text])
    })

    // page.on('pageerror', async e => {
    //     const newStack = await mapStackTrace(e.message, { isChromeOrEdge: true })
    //     console.error(newStack)
    // })

    await page.goto(url)

    return {page, browser}
}

async function evaluateWithStackTrace(page, fn, args) {
    // try {
        return await page.evaluate(fn, args)
    // } catch (e) {
    //     const stack = e.stack
    //     const message = stack.split('\n')[0]
    //     const newStack = await mapStackTrace(stack, { isChromeOrEdge: true })
    //     console.error(`${message}\n${newStack}`)
    //     e.stack = newStack
    //     throw e
    // }
}

describe('Browser', () => {

    it('plays a game in the browser', async () => {
        // browser tests are slow. Headless is slower it seems (from jest watch mode)
        jest.setTimeout(process.env.NODE_ENV === 'development' ? 90 * 1000 : 90 * 1000)

        await startBrowser()
        const source = fs.readFileSync(path.join(__dirname, '../gists/_pot-wash-panic_itch/script.txt'), 'utf-8')
        const startLevel = 3

        await sleep(500) // wait long enough for the JS to load maybe?
        await evaluateWithStackTrace(page, ({source, startLevel}) => {
            window.HackTableStart(source, startLevel)
        }, {source, startLevel})

        return new Promise( async (resolve) => {
            // const dialogHandler = async dialog => {
            //     expect(dialog.message()).toBe('I want to see my face in them! Level 3/14')
            //     await dialog.dismiss()
            //     page.off('dialog', dialogHandler)
            //     resolve()
            // }
            // page.once('dialog', dialogHandler)

            // page.on('dialog', async dialog => {
            //     expect(dialog.message()).toBe('I want to see my face in them! Level 3/14')
            //     await dialog.dismiss()
            //     resolve()
            // })
            await pressKeys(page, 'SAAASASDDDWDDDDWDDSAAASASAW'.split(''))
            // await jestPuppeteer.debug()
            resolve()
        })
    })

    // it.skip('Plays an arbitrary game', async () => {
    //     // browser tests are slow. Headless is slower it seems (from jest watch mode)
    //     jest.setTimeout(process.env.NODE_ENV === 'development' ? 10 * 60 * 1000 : 10 * 60 * 1000)

    //     const {page, browser} = await startBrowser()

    //     const source = fs.readFileSync(path.join(__dirname, '../gists/_entanglement/script.txt'), 'utf-8')
    //     const solutions = JSON.parse(fs.readFileSync(path.join(__dirname, '../gist-solutions/_entanglement.json'), 'utf-8'))
    //     const startLevel = 3
    //     const partial = solutions.solutions[startLevel].partial

    //     await sleep(500) // wait for the browser JS to execute
    //     await page.evaluate(({source, startLevel}) => {
    //         window.HackTableStart(source, startLevel)
    //     }, {source, startLevel})

    //     await pressKeys(page, partial.split(''))
    //     await stopBrowser(browser)
    // })
})
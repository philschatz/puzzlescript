/* eslint-env jasmine */
const fs = require('fs')
const path = require('path')
const puppeteer = require('puppeteer')

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms))
}

async function pressKeys(page, keys) {
    for (const key of keys) {
        if (key === ',') { continue }
        await page.waitFor(`.ps-accepting-input`)
        if (key === '.') {
            // wait long enough for a tick to occur
            await sleep(70)
            continue
        }
        // await sleep(500/*Math.ceil(1000/60)*/) // enough for requestAnimationFrame to run (60fps)
        await page.keyboard.press(`Key${key}`)
    }
}


async function startBrowser() {
    const url = `file://${__dirname}/browser/html-table.xhtml`

    const puppeteerArgs = []
    // See https://github.com/GoogleChrome/puppeteer/blob/master/docs/troubleshooting.md#running-puppeteer-on-travis-ci
    if (process.env['CI'] === 'true') {
        puppeteerArgs.push('--no-sandbox')
    }

    const browser = await puppeteer.launch({
        devtools: process.env.NODE_ENV === 'development',
        args: puppeteerArgs
    })
    const page = await browser.newPage()

    // redirect browser console messages to the terminal
    page.on('console', (consoleMessage) => {
        const type = consoleMessage.type()
        const text = consoleMessage.text()

        const fn = console[type] || console.log
        fn.apply(console, [text])
    })

    await page.goto(url)

    return {page, browser}
}

async function stopBrowser(browser) {
    await browser.close()
}

// Disable Browser tests on Travis for now
// (results in "Failed to launch chrome. See https://github.com/GoogleChrome/puppeteer/blob/master/docs/troubleshooting.md")
describeFn = process.env['CI'] === 'true' ? describe.skip : describe

describeFn('Browser', () => {

    it('plays a game in the browser', async () => {
        // browser tests are slow. Headless is slower it seems (from jest watch mode)
        jest.setTimeout(process.env.NODE_ENV === 'development' ? 90 * 1000 : 90 * 1000)

        const {page, browser} = await startBrowser()
        const source = fs.readFileSync(path.join(__dirname, '../gists/_pot-wash-panic_itch/script.txt'), 'utf-8')
        const startLevel = 3

        await sleep(500) // wait long enough for the JS to load maybe?
        await page.evaluate(({source, startLevel}) => {
            window.HackTableStart(source, startLevel)
        }, {source, startLevel})

        return new Promise( async (resolve) => {
            page.on('dialog', async dialog => {
                expect(dialog.message()).toBe('Congratulations! You completed the level.')
                await dialog.dismiss()
                await stopBrowser(browser)
                resolve()
            })
            await pressKeys(page, 'SAAASASDDDWDDDDWDDSAAASASAW'.split(''))
        })
    })

    it.skip('Plays an arbitrary game', async () => {
        // browser tests are slow. Headless is slower it seems (from jest watch mode)
        jest.setTimeout(process.env.NODE_ENV === 'development' ? 10 * 60 * 1000 : 10 * 60 * 1000)

        const {page, browser} = await startBrowser()

        const source = fs.readFileSync(path.join(__dirname, '../gists/_entanglement/script.txt'), 'utf-8')
        const solutions = JSON.parse(fs.readFileSync(path.join(__dirname, '../gist-solutions/_entanglement.json'), 'utf-8'))
        const startLevel = 3
        const partial = solutions.solutions[startLevel].partial

        await sleep(500) // wait for the browser JS to execute
        await page.evaluate(({source, startLevel}) => {
            window.HackTableStart(source, startLevel)
        }, {source, startLevel})

        await pressKeys(page, partial.split(''))
        await stopBrowser(browser)
    })
})
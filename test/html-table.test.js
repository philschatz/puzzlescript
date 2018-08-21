/* eslint-env jasmine */
const puppeteer = require('puppeteer')

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms))
}

async function pressKeys(page, keys) {
    for (const key of keys) {
        await sleep(500/*Math.ceil(1000/60)*/) // enough for requestAnimationFrame to run (60fps)
        await page.keyboard.press(`Key${key}`)
    }
}

// Disable Browser tests on Travis for now
// (results in "Failed to launch chrome. See https://github.com/GoogleChrome/puppeteer/blob/master/docs/troubleshooting.md")
describeFn = process.env['CI'] === 'true' ? describe.skip : describe

describeFn('Browser', () => {
    it('plays a game in the browser (using sleep so needs to be sped up)', async () => {
        jest.setTimeout(60 * 1000) // browser tests are slow
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
        await page.goto(url)

        // send some keystrokes to play level 1
        pressKeys(page, 'DDDDDD'.split('')) // just press right 6 times
        await sleep(5000) // wait for level 2 to load

        return new Promise( async (resolve) => {
            page.on('dialog', async dialog => {
                console.log(dialog.message())
                await dialog.dismiss()
                await browser.close()
                resolve()
            })
            await pressKeys(page, 'SDDDDDSAAAWAAAAAASDWDSASDDWWDDDSSASAW'.split(''))
            // Verify that the "You Won!" alert box showed up

        })
    })
})
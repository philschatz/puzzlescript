#!/usr/bin/env node

const fs = require('fs')
const URL = require('url')
const path = require('path')
const fetch = require('node-fetch')
const mkdirp = require('mkdirp')
const commander = require('commander')
const puppeteer = require('puppeteer')


const URL_REGEXP = /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{2,256}\.[a-z]{2,6}\b([-a-zA-Z0-9@:%_\+.~#?&//=]*)/

commander
.version(require('../package.json').version)
.usage('<url>')
.parse(process.argv)


async function doImport() {
    const browser = await puppeteer.launch({
        devtools: process.env.NODE_ENV === 'development'
    })
    const page = await browser.newPage()

    for (const gameUrl of commander.args) {
        const url = URL.parse(gameUrl, {parseQueryString: true})
        let dirName
        if (/puzzlescript\.net/.test(url.hostname)) {
            // It's a puzzlescript game. Just use the GIST query parameter
            const gistId = url.query['p']
            const response = await fetch(`https://api.github.com/gists/${gistId}`)
            const gist = await response.json()

            dirName = gistId
            const outDir = path.join(__dirname, `../gists`, dirName)
            const outFile = path.join(outDir, `script.txt`)

            mkdirp.sync(outDir)
            fs.writeFileSync(outFile, gist["files"]["script.txt"]["content"])
            continue

        } else if (/itch\.io/.test(url.hostname)) {
            const itchPath = url.pathname.split('/')[1] // since it begins with a '/'
            dirName = `_${url.hostname}_${itchPath}`
        } else {
            throw new Error(`BUG: Unsupported URL. Unsure how to name the game file`)
        }
        const outDir = path.join(__dirname, `../gists`, dirName)
        const outFile = path.join(outDir, `script.txt`)

        const {sourceCode} = await getSourceFromUrl(page, gameUrl)

        mkdirp.sync(outDir)
        fs.writeFileSync(outFile, sourceCode)
    }

    await browser.close()
}

async function getSourceFromUrl(page, gameUrl) {
    await page.goto(gameUrl)
    const {sourceCode, iframeUrl} = await page.evaluate(() => {
        if (window.sourceCode) {
            return {sourceCode: window.sourceCode}
        } else {
            const iframes = document.querySelectorAll('iframe')
            const links = document.querySelectorAll('a[href]')
            if (iframes.length === 1) {
                const iframeUrl = iframes[0].src
                return {iframeUrl}
            } else if (links.length === 1) {
                // follow the link
                return {iframeUrl: links[0].href}
            } else {
                throw new Error(`Could not find the sourceCode or exactly one <iframe>`)
            }
        }
    })

    if (sourceCode) {
        return {sourceCode}
    } else if (iframeUrl) {
        return await getSourceFromUrl(page, iframeUrl)
    } else {
        throw new Error(`ERROR: Could not find sourceCode for ${gameUrl}`)
    }
}

doImport().then(null, err => {
    console.error(err)
    process.exit(111)
})
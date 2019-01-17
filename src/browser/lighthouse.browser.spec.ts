/** @jest-environment puppeteer */
/* eslint-env jasmine */
import lighthouse from 'lighthouse' // tslint:disable-line:no-implicit-dependencies
import puppeteer from 'puppeteer' // tslint:disable-line:no-implicit-dependencies
import { browserAfterEach, browserBeforeEach, getUrl } from './browserSpecUtils'
// import mapStackTrace from 'sourcemapped-stacktrace-node')

// Defined via jest-puppeteer environment
declare var browser: puppeteer.Browser

export const checkLighthouse = async(urlPath: string) => {

    const { port } = (new URL(browser.wsEndpoint()))
    const { lhr } = await lighthouse(getUrl(urlPath), { port })

    expect(lhr.categories.accessibility.score).toBeGreaterThanOrEqual(1)
    expect(lhr.categories.seo.score).toBeGreaterThanOrEqual(1)
    expect(lhr.categories.pwa.score).toBeGreaterThanOrEqual(0.73) // since it is not https
    expect(lhr.categories['best-practices'].score).toBeGreaterThanOrEqual(0.64)
    expect(lhr.categories.performance.score).toBeGreaterThanOrEqual(0.94)
}

describe('Browser', () => {

    beforeEach(browserBeforeEach)
    afterEach(browserAfterEach)

    it('runs a Lighthouse Audit', async() => {
        jest.setTimeout(60 * 1000)
        await checkLighthouse('/index.xhtml')
    })

})
